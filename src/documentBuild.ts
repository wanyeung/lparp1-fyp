import * as path from "node:path";
import { execFile } from "node:child_process";
import * as vscode from "vscode";
import type { Hkmc2FileDiagnostics } from "./hkmc2";

export type BuiltDocument = {
  ok: true;
  html: string;
  model: { items: any[]; order: string[]; groups?: any[] } | null;
  provenance: {
    version: number;
    entryFile: string;
    files: Array<{ path: string; label: string; isEntry: boolean }>;
    tables: Record<string, any>;
    charts: Record<string, any>;
    warnings: string[];
  } | null;
  outputFile: string;
  sourceFile: string;
  diagnostics: Hkmc2FileDiagnostics[];
  sourceText: string;
  dependencies: string[];
};

export class DocumentBuildService implements vscode.Disposable {
  private readonly builds = new Map<string, BuiltDocument>();
  private readonly watched = new Map<string, vscode.TextDocument>();
  private readonly stale = new Set<string>();
  private readonly errors = new Map<string, string>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly subscriptions: vscode.Disposable[] = [];
  private readonly changed = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidBuild = this.changed.event;
  private tail: Promise<unknown> = Promise.resolve();

  constructor(private readonly root: string, private readonly output: vscode.OutputChannel) {
    this.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument(document => this.sourceChanged(document, true)),
      vscode.workspace.onDidChangeTextDocument(event => {
        if (event.contentChanges.length) this.sourceChanged(event.document, false);
      }),
    );
  }

  liveEnabled(document: vscode.TextDocument): boolean {
    return vscode.workspace.getConfiguration("mlscriptStudio", document.uri).get<boolean>("livePreview", false);
  }

  watch(document: vscode.TextDocument): void {
    this.watched.set(document.uri.toString(), document);
    if (this.liveEnabled(document) && vscode.workspace.isTrusted && !this.get(document)) this.schedule(document);
  }

  unwatch(document: vscode.TextDocument): void {
    const key = document.uri.toString();
    this.watched.delete(key);
    clearTimeout(this.timers.get(key));
    this.timers.delete(key);
  }

  get(document: vscode.TextDocument): BuiltDocument | undefined { return this.builds.get(document.uri.toString()); }
  getError(document: vscode.TextDocument): string | undefined { return this.errors.get(document.uri.toString()); }
  isStale(document: vscode.TextDocument): boolean {
    const built = this.get(document);
    return !built || built.sourceText !== document.getText() || this.stale.has(document.uri.toString());
  }

  private sourceChanged(source: vscode.TextDocument, saved: boolean): void {
    if (!source.fileName.endsWith(".mls")) return;
    const file = path.resolve(source.fileName).toLowerCase();
    for (const [key, document] of this.watched) {
      const built = this.get(document);
      const affected = document.uri.toString() === source.uri.toString() || built?.dependencies.some(dep => path.resolve(dep).toLowerCase() === file);
      if (!affected) continue;
      this.stale.add(key);
      this.changed.fire(document.uri);
      if (saved && this.liveEnabled(document) && vscode.workspace.isTrusted) this.schedule(document);
    }
  }

  private schedule(document: vscode.TextDocument): void {
    const key = document.uri.toString();
    clearTimeout(this.timers.get(key));
    this.timers.set(key, setTimeout(() => {
      this.timers.delete(key);
      if (!document.isClosed && this.isStale(document)) void this.build(document, true);
    }, 700));
  }

  // Serialize builds: multiple documents may write the same imported .mjs file.
  build(document: vscode.TextDocument, automatic = false): Promise<BuiltDocument | undefined> {
    const run = this.tail.then(() => this.runBuild(document, automatic));
    this.tail = run.catch(() => undefined);
    return run;
  }

  private async runBuild(document: vscode.TextDocument, automatic: boolean): Promise<BuiltDocument | undefined> {
    if (automatic && !this.isStale(document)) return this.get(document);
    if (!vscode.workspace.isTrusted) {
      if (!automatic) void vscode.window.showWarningMessage("Building a document executes compiled MLscript. Trust this workspace before running it.");
      return;
    }
    if (document.uri.scheme !== "file" || !document.fileName.endsWith(".mls") || document.isClosed) {
      if (!automatic) void vscode.window.showWarningMessage("Save the MLscript file in a local workspace before building HTML.");
      return;
    }
    const key = document.uri.toString();
    clearTimeout(this.timers.get(key));
    this.timers.delete(key);
    const status = vscode.window.setStatusBarMessage("$(sync~spin) MLscript: building HTML document…");
    try {
      if (document.isDirty && !await document.save()) throw new Error("Could not save the source file.");
      const sourceText = document.getText();
      this.stale.delete(key);
      const runner = path.join(this.root, "scripts/build_document.mjs");
      this.output.appendLine(`\n${automatic ? "Live rebuild" : "Build HTML"} (executes trusted code): ${document.fileName}`);
      const env: NodeJS.ProcessEnv = { ELECTRON_RUN_AS_NODE: "1" };
      for (const name of ["PATH", "HOME", "USERPROFILE", "SYSTEMROOT", "SystemRoot", "TEMP", "TMP", "TMPDIR", "APPDATA", "LOCALAPPDATA"]) {
        if (process.env[name]) env[name] = process.env[name];
      }
      const result: any = await new Promise((resolve, reject) => {
        execFile(process.execPath, [runner, document.fileName, "--root", this.root, "--json"],
          { env, timeout: 30000, maxBuffer: 32 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
            if (stderr) this.output.appendLine(stderr);
            let payload: any;
            try { payload = JSON.parse(stdout); } catch { reject(new Error(error?.message ?? "Invalid build result. See the Output channel.")); return; }
            if (error || !payload.ok) {
              for (const perFile of payload.diagnostics ?? []) for (const item of perFile.diagnostics ?? []) this.output.appendLine(`${perFile.path}: ${item.mainMessage}`);
              reject(new Error(payload.error ?? error?.message ?? "Build failed")); return;
            }
            resolve(payload);
          });
      });
      const built = { ...result, sourceText } as BuiltDocument;
      this.builds.set(key, built);
      this.errors.delete(key);
      this.output.appendLine(`Generated ${built.outputFile}`);
      this.changed.fire(document.uri);
      return built;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.stale.add(key);
      this.errors.set(key, message);
      this.output.appendLine(message);
      if (!automatic) {
        this.output.show(true);
        void vscode.window.showErrorMessage(`MLscript document build failed: ${message}`);
      }
      this.changed.fire(document.uri);
      return;
    } finally { status.dispose(); }
  }

  dispose(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    for (const subscription of this.subscriptions) subscription.dispose();
    this.changed.dispose();
  }
}

/** Install a project-local library without silently overwriting user files. */
export async function addDocumentLibrary(extensionRoot: string): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  let folder = folders?.[0];
  if (folders && folders.length > 1) folder = await vscode.window.showWorkspaceFolderPick();
  if (!folder) { void vscode.window.showInformationMessage("Open a workspace folder first."); return; }
  const destination = vscode.Uri.joinPath(folder.uri, "studio");
  await vscode.workspace.fs.createDirectory(destination);
  for (const name of ["Studio.mls", "Render.mjs"]) {
    const target = vscode.Uri.joinPath(destination, name);
    try { await vscode.workspace.fs.stat(target); continue; } catch { /* Only create missing files. */ }
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(path.join(extensionRoot, "library", name)));
    await vscode.workspace.fs.writeFile(target, bytes);
  }
  const example = vscode.Uri.joinPath(folder.uri, "studio-demo.mls");
  try { await vscode.workspace.fs.stat(example); } catch {
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(path.join(extensionRoot, "examples/library-report.mls")));
    const source = Buffer.from(bytes).toString("utf8").replace('../library/Studio.mls', './studio/Studio.mls');
    await vscode.workspace.fs.writeFile(example, Buffer.from(source));
  }
  // A second demo exercises imported-module provenance and an editable chart.
  const subscription = vscode.Uri.joinPath(folder.uri, "studio-subscription");
  await vscode.workspace.fs.createDirectory(subscription);
  for (const name of ["Subscription.mls", "SubscriptionReport.mls"]) {
    const target = vscode.Uri.joinPath(subscription, name);
    try { await vscode.workspace.fs.stat(target); continue; } catch { /* Only create missing files. */ }
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(path.join(extensionRoot, "examples/subscription", name)));
    let source = Buffer.from(bytes).toString("utf8");
    if (name === "SubscriptionReport.mls") source = source.replace("../../library/Studio.mls", "../studio/Studio.mls");
    await vscode.workspace.fs.writeFile(target, Buffer.from(source));
  }
  // The six worked cases live in a self-contained tree. Their source imports
  // point at the extension's library/ directory; the installed copy points at
  // the workspace's generated studio/ library instead.
  const usecases = vscode.Uri.joinPath(folder.uri, "studio-usecases");
  await copyUseCases(extensionRoot, usecases);
  await vscode.window.showTextDocument(example, { preview: false });
  void vscode.window.showInformationMessage("Studio library ready in studio/. Try studio-demo.mls, studio-subscription/SubscriptionReport.mls, or the six cases under studio-usecases/.");
}

async function copyUseCases(extensionRoot: string, destination: vscode.Uri): Promise<void> {
  const sourceRoot = path.join(extensionRoot, "examples", "usecases");
  const visit = async (relative: string): Promise<void> => {
    const sourceDir = vscode.Uri.file(path.join(sourceRoot, relative));
    const entries = await vscode.workspace.fs.readDirectory(sourceDir);
    for (const [name, type] of entries) {
      const rel = relative ? `${relative}/${name}` : name;
      const source = vscode.Uri.file(path.join(sourceRoot, rel));
      const target = vscode.Uri.joinPath(destination, ...rel.split("/"));
      if (type === vscode.FileType.Directory) {
        await vscode.workspace.fs.createDirectory(target);
        await visit(rel);
        continue;
      }
      if (!name.endsWith(".mls") && name !== "README.md") continue;
      try { await vscode.workspace.fs.stat(target); continue; } catch { /* Only create missing files. */ }
      const bytes = await vscode.workspace.fs.readFile(source);
      let text = Buffer.from(bytes).toString("utf8");
      if (rel.includes("case03/shared/")) {
        text = text.replace("../../../../library/Studio.mls", "../../../studio/Studio.mls");
      } else {
        text = text.replace("../../../library/Studio.mls", "../../studio/Studio.mls");
      }
      await vscode.workspace.fs.writeFile(target, Buffer.from(text));
    }
  };
  await vscode.workspace.fs.createDirectory(destination);
  await visit("");
}
