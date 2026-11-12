import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { parseDocumentModel, rewriteDisplayOrder, rewriteDocumentOrder, usesDocumentLibrary } from "./document";
import { DocumentBuildService, type BuiltDocument } from "./documentBuild";
import { replacementFor, type LiteralType } from "./edit";

export const DOCUMENT_VIEW_TYPE = "mlscriptStudio.document";

type PatchTarget =
  | { kind: "table"; itemId: string; row: number; column: number }
  | { kind: "chart"; itemId: string; barIndex: number }
  | { kind: "chart"; itemId: string; seriesIndex: number; pointIndex: number };

type WebviewMessage = {
  type?: "ready" | "refresh" | "build" | "updateSource" | "saveSource" | "reorder" | "patch" | "revealExternal";
  file?: string;
  source?: string;
  entrySource?: string;
  target?: PatchTarget;
  value?: string;
  order?: string[];
  start?: number;
  end?: number;
};

type SourceFile = { path: string; label: string; source: string; isEntry: boolean };

const DISPLAY_ORDER = /(^[ \t]*val[ \t]+displayOrder[ \t]*=[ \t]*)\[(?:[ \t\r\n]*"(?:[^"\\]|\\.)*"[ \t\r\n]*,?)*[ \t\r\n]*\]/gm;

/**
 * A two-pane custom editor.
 *
 * Left: the actual .mls modules, including imported models. Every edit writes
 * to the real VS Code TextDocument.
 *
 * Right: the document produced by hkmc2 executing Display/Model. Table cells
 * and chart bars are joined to exact source literals by the build's
 * provenance index. Editing one patches that literal, saves the module,
 * recompiles with hkmc2 and refreshes both views.
 */
export class MLscriptDocumentViewProvider implements vscode.CustomTextEditorProvider {
  private readonly panels = new Map<string, Set<vscode.WebviewPanel>>();
  private readonly documents = new Map<string, vscode.TextDocument>();
  private readonly status = new Map<string, string>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly css: string;
  private readonly script: string;
  activeUri?: vscode.Uri;

  constructor(context: vscode.ExtensionContext, private readonly builds: DocumentBuildService) {
    const media = path.join(context.extensionPath, "media");
    this.css = fs.readFileSync(path.join(media, "webview.css"), "utf8");
    this.script = fs.readFileSync(path.join(media, "webview.js"), "utf8");
    context.subscriptions.push(
      builds.onDidBuild((uri) => this.schedulePost(uri)),
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (this.panels.has(event.document.uri.toString())) this.schedulePost(event.document.uri);
      }),
    );
  }

  resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): void {
    panel.webview.options = { enableScripts: true, localResourceRoots: [] };
    panel.webview.html = this.html();
    if (usesDocumentLibrary(document.getText())) this.builds.watch(document);
    this.activeUri = document.uri;
    panel.onDidChangeViewState(() => { if (panel.active) this.activeUri = document.uri; });

    const key = document.uri.toString();
    this.documents.set(key, document);
    const attached = this.panels.get(key) ?? new Set<vscode.WebviewPanel>();
    attached.add(panel);
    this.panels.set(key, attached);

    panel.onDidDispose(() => {
      attached.delete(panel);
      if (!attached.size) {
        this.panels.delete(key);
        this.documents.delete(key);
        this.builds.unwatch(document);
        clearTimeout(this.timers.get(key));
        this.timers.delete(key);
      }
    });

    panel.webview.onDidReceiveMessage((message: WebviewMessage) => {
      void this.handle(document, panel, message);
    });

    void this.send(panel, document);
  }

  private schedulePost(uri: vscode.Uri): void {
    const key = uri.toString();
    clearTimeout(this.timers.get(key));
    this.timers.set(key, setTimeout(() => {
      this.timers.delete(key);
      const document = this.documents.get(key);
      if (!document) return;
      for (const panel of this.panels.get(key) ?? []) void this.send(panel, document);
    }, 80));
  }

  private async handle(document: vscode.TextDocument, panel: vscode.WebviewPanel, message: WebviewMessage): Promise<void> {
    if (!message || typeof message !== "object") return;
    try {
      switch (message.type) {
        case "ready":
        case "refresh":
          await this.send(panel, document);
          break;
        case "build":
          if (typeof message.entrySource === "string") await this.applySource(document, document.fileName, message.entrySource, false);
          await this.saveDirtyDependencies(document);
          await this.build(document, "Built from executed MLscript");
          break;
        case "updateSource":
          if (typeof message.file === "string" && typeof message.source === "string" && this.allowed(document, message.file)) {
            await this.applySource(document, message.file, message.source, false);
          }
          break;
        case "saveSource":
          if (typeof message.file === "string" && this.allowed(document, message.file)) {
            if (typeof message.source === "string") await this.applySource(document, message.file, message.source, false);
            await this.saveFile(message.file);
            if (this.builds.liveEnabled(document) && this.inBuild(document, message.file)) await this.build(document, "Rebuilt after save");
          } else {
            await document.save();
          }
          break;
        case "patch":
          await this.patch(document, message);
          break;
        case "reorder":
          if (Array.isArray(message.order)) await this.reorder(document, message.order, message.entrySource);
          break;
        case "revealExternal":
          if (typeof message.file === "string") await this.revealExternal(message.file, message.start ?? 0, message.end ?? 0);
          break;
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      this.status.set(document.uri.toString(), text);
      void vscode.window.showErrorMessage(`MLscript Studio: ${text}`);
      this.schedulePost(document.uri);
    }
  }

  private async send(panel: vscode.WebviewPanel, document: vscode.TextDocument | undefined): Promise<void> {
    if (!document || document.isClosed) return;
    const key = document.uri.toString();
    const source = document.getText();
    const libraryMode = usesDocumentLibrary(source);
    if (libraryMode) this.builds.watch(document);
    const built = this.builds.get(document);
    const paths = [...new Set([document.fileName, ...(built?.dependencies ?? [])])].filter((file) => file.endsWith(".mls"));
    const files: SourceFile[] = [];
    for (const file of paths) {
      files.push({
        path: file,
        label: relativeLabel(file, document.fileName),
        source: await this.readSource(file),
        isEntry: samePath(file, document.fileName),
      });
    }
    const dirtyFiles = files.filter((file) => this.findDocument(file.path)?.isDirty).map((file) => file.path);
    await panel.webview.postMessage({
      type: "workspace",
      fileName: path.basename(document.fileName),
      entryFile: document.fileName,
      files,
      model: libraryMode ? built?.model ?? { items: [], order: [], groups: [] } : parseDocumentModel(source),
      provenance: libraryMode ? built?.provenance ?? null : null,
      libraryMode,
      livePreview: this.builds.liveEnabled(document),
      buildError: this.builds.getError(document) ?? null,
      stale: libraryMode && this.builds.isStale(document),
      dirtyFiles,
      status: this.status.get(key) ?? "",
      diagnostics: flattenDiagnostics(built, document.fileName),
      trusted: vscode.workspace.isTrusted,
    });
  }

  private async build(document: vscode.TextDocument, label: string): Promise<BuiltDocument | undefined> {
    const key = document.uri.toString();
    const started = Date.now();
    await this.saveDirtyDependencies(document);
    const built = await this.builds.build(document);
    if (built) {
      const tables = (built.model?.items ?? []).filter((item: any) => item.kind === "table").length;
      const charts = (built.model?.items ?? []).filter((item: any) => item.kind === "chart").length;
      this.status.set(key, `${label} in ${Date.now() - started} ms · ${tables} table${tables === 1 ? "" : "s"} · ${charts} chart${charts === 1 ? "" : "s"}`);
    } else {
      this.status.set(key, `Build failed: ${this.builds.getError(document) ?? "see the Output channel"}`);
    }
    this.schedulePost(document.uri);
    return built;
  }

  private async patch(document: vscode.TextDocument, message: WebviewMessage): Promise<void> {
    const built = this.builds.get(document);
    if (!built || !built.provenance) throw new Error("Build the current document before editing a value.");
    if (this.builds.isStale(document)) throw new Error("The source changed after the last build. Rebuild before editing a value.");
    if (typeof message.entrySource === "string" && message.entrySource !== document.getText()) {
      throw new Error("The source pane has changes that have not been built. Build before editing a value.");
    }
    const cell = resolveTarget(built.provenance, message.target);
    if (!cell) throw new Error("That table cell or chart bar no longer exists in the compiled document.");
    if (!cell.editable || typeof cell.file !== "string" || typeof cell.start !== "number" || typeof cell.end !== "number") {
      throw new Error(cell.reason || "That value is computed and cannot be overwritten.");
    }
    const replacement = replacementFor(message.value ?? "", cell.literalType as LiteralType | undefined);
    if (replacement.error) throw new Error(replacement.error);
    const replacementText = replacement.text;
    if (replacementText === undefined) throw new Error("Could not format that value.");
    const target = await this.openDocument(cell.file);
    const current = target.getText().slice(cell.start, cell.end);
    if (current !== cell.expected) {
      throw new Error(`The source changed at ${path.basename(cell.file)}. Rebuild before editing again.`);
    }
    const edit = new vscode.WorkspaceEdit();
    edit.replace(target.uri, new vscode.Range(target.positionAt(cell.start), target.positionAt(cell.end)), replacementText);
    if (!await vscode.workspace.applyEdit(edit)) throw new Error("VS Code could not apply that source edit.");
    if (!await target.save()) throw new Error(`Could not save ${path.basename(cell.file)}.`);
    await this.saveDirtyDependencies(document);
    const line = target.positionAt(cell.start).line + 1;
    const label = relativeLabel(cell.file, document.fileName);
    const builtNext = await this.build(document, `Updated ${label}:${line} · ${cell.expected} → ${replacementText}`);
    if (!builtNext) throw new Error(`The edit was written to ${label}, but the document did not rebuild. Fix the source error and build again.`);
  }

  private async reorder(document: vscode.TextDocument, order: string[], entrySource?: string): Promise<void> {
    if (typeof entrySource === "string" && entrySource !== document.getText()) {
      throw new Error("The source pane has changes that have not been built. Build before reordering.");
    }
    const library = usesDocumentLibrary(document.getText());
    const built = this.builds.get(document);
    if (library) {
      if (!built || this.builds.isStale(document)) throw new Error("Build the current source before reordering.");
      const model = built.model;
      if (!model || order.length !== model.order.length || new Set(order).size !== order.length) throw new Error("Invalid document order.");
      const groupOf = new Map(model.items.map((item: any) => [item.id, item.groupId]));
      if (order.some((id, index) => !groupOf.has(id) || groupOf.get(id) !== groupOf.get(model.order[index]))) {
        throw new Error("Move items only within their existing group.");
      }
      const files = [...new Set([document.fileName, ...(built.dependencies ?? [])])];
      const candidates: Array<{ file: string; source: string }> = [];
      for (const file of files) {
        const source = await this.readSource(file);
        const matches = [...source.matchAll(DISPLAY_ORDER)];
        if (matches.length > 1) throw new Error(`More than one displayOrder literal in ${path.basename(file)}.`);
        if (matches.length === 1) candidates.push({ file, source });
      }
      if (candidates.length !== 1) throw new Error("Define exactly one `val displayOrder = [...]` in the entry file or an imported model to enable reordering.");
      const next = rewriteDisplayOrder(candidates[0].source, order);
      await this.applySource(document, candidates[0].file, next, true);
      await this.saveDirtyDependencies(document);
      await this.build(document, "Reordered displayOrder and rebuilt");
      return;
    }
    const next = rewriteDocumentOrder(document.getText(), order);
    await this.applySource(document, document.fileName, next, true);
    this.status.set(document.uri.toString(), "Reordered @order metadata");
    this.schedulePost(document.uri);
  }

  private async revealExternal(file: string, start: number, end: number): Promise<void> {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
    const range = new vscode.Range(document.positionAt(start), document.positionAt(Math.max(start + 1, end)));
    const editor = await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Beside, selection: range, preview: false });
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
  }

  private allowed(document: vscode.TextDocument, file: string): boolean {
    if (samePath(file, document.fileName)) return true;
    const built = this.builds.get(document);
    return Boolean(built?.dependencies.some((dependency) => samePath(dependency, file)));
  }

  private inBuild(document: vscode.TextDocument, file: string): boolean {
    return this.allowed(document, file);
  }

  private findDocument(file: string): vscode.TextDocument | undefined {
    return vscode.workspace.textDocuments.find((candidate) => samePath(candidate.fileName, file));
  }

  private async openDocument(file: string): Promise<vscode.TextDocument> {
    return this.findDocument(file) ?? vscode.workspace.openTextDocument(vscode.Uri.file(file));
  }

  private async readSource(file: string): Promise<string> {
    const open = this.findDocument(file);
    if (open) return open.getText();
    try { return await fs.promises.readFile(file, "utf8"); } catch { return ""; }
  }

  private async applySource(document: vscode.TextDocument, file: string, source: string, save: boolean): Promise<void> {
    const target = await this.openDocument(file);
    if (target.getText() === source) {
      if (save && target.isDirty) await target.save();
      return;
    }
    const edit = new vscode.WorkspaceEdit();
    edit.replace(target.uri, new vscode.Range(target.positionAt(0), target.positionAt(target.getText().length)), source);
    if (!await vscode.workspace.applyEdit(edit)) throw new Error(`Could not update ${path.basename(file)}.`);
    if (save && !await target.save()) throw new Error(`Could not save ${path.basename(file)}.`);
  }

  private async saveFile(file: string): Promise<void> {
    const target = await this.openDocument(file);
    if (target.isDirty && !await target.save()) throw new Error(`Could not save ${path.basename(file)}.`);
  }

  private async saveDirtyDependencies(document: vscode.TextDocument): Promise<void> {
    const built = this.builds.get(document);
    const files = [document.fileName, ...(built?.dependencies ?? [])];
    for (const file of files) {
      const open = this.findDocument(file);
      if (open?.isDirty && !await open.save()) throw new Error(`Could not save ${path.basename(file)}.`);
    }
  }

  private html(): string {
    const nonce = createNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <title>MLscript Studio</title>
  <style nonce="${nonce}">${this.css}</style>
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}">${this.script}</script>
</body>
</html>`;
  }
}

function resolveTarget(provenance: NonNullable<BuiltDocument["provenance"]>, target?: PatchTarget): any {
  if (!target || typeof target !== "object") return null;
  if (target.kind === "table") {
    const table = provenance.tables?.[target.itemId];
    if (!table || !Number.isInteger(target.row) || !Number.isInteger(target.column)) return null;
    return table.rows?.[target.row]?.[target.column] ?? null;
  }
  const chart = provenance.charts?.[target.itemId];
  if (!chart) return null;
  if ("barIndex" in target && Number.isInteger(target.barIndex)) return chart.bars?.[target.barIndex] ?? null;
  if ("seriesIndex" in target && "pointIndex" in target && Number.isInteger(target.seriesIndex) && Number.isInteger(target.pointIndex)) {
    return chart.series?.[target.seriesIndex]?.points?.[target.pointIndex] ?? null;
  }
  return null;
}

function relativeLabel(file: string, entry: string): string {
  const relative = path.relative(path.dirname(entry), file).replace(/\\/g, "/");
  return relative && !relative.startsWith("..") ? relative : path.basename(file);
}

function samePath(left: string, right: string): boolean {
  const normalize = (value: string) => process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value);
  return normalize(left) === normalize(right);
}

function flattenDiagnostics(built: BuiltDocument | undefined, entry: string): any[] {
  const result: any[] = [];
  for (const perFile of built?.diagnostics ?? []) {
    const file = perFile.path && perFile.path.endsWith(".mls") ? perFile.path : entry;
    for (const diagnostic of perFile.diagnostics ?? []) {
      const location = diagnostic.allMessages?.find((message) => message.location)?.location;
      const message = diagnostic.mainMessage || (diagnostic.allMessages ?? [])
        .map((item) => (item.messageBits ?? []).map((bit) => bit.text ?? "").join(""))
        .filter(Boolean)
        .join("\n") || "MLscript diagnostic";
      const kind = (diagnostic.kind ?? "").toLowerCase();
      result.push({
        file,
        label: relativeLabel(file, entry),
        message,
        severity: kind === "error" ? "error" : kind === "warning" ? "warning" : "info",
        start: typeof location?.start === "number" ? location.start : null,
        end: typeof location?.end === "number" ? location.end : null,
      });
    }
  }
  return result.slice(0, 50);
}

function createNonce(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 32 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}
