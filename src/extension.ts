import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import { DOCUMENT_VIEW_TYPE, MLscriptDocumentViewProvider } from "./documentView";
import { DocumentBuildService, addDocumentLibrary } from "./documentBuild";
import {
  diagnosticText,
  Hkmc2Compiler,
  type Hkmc2Diagnostic,
  type Hkmc2FileDiagnostics,
} from "./hkmc2";

const DIAGNOSTIC_SOURCE = "hkmc2";
const OUTPUT_NAME = "MLscript hkmc2";

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel(OUTPUT_NAME);
  const diagnostics = vscode.languages.createDiagnosticCollection(DIAGNOSTIC_SOURCE);
  const compiler = new Hkmc2Compiler(context.extensionPath);
  const coordinator = new CompileCoordinator(compiler, diagnostics, output);
  const builds = new DocumentBuildService(context.extensionPath, output);
  const documentView = new MLscriptDocumentViewProvider(context, builds);

  context.subscriptions.push(
    output,
    diagnostics,
    builds,
    vscode.window.registerCustomEditorProvider(DOCUMENT_VIEW_TYPE, documentView, {
      webviewOptions: { retainContextWhenHidden: false },
      supportsMultipleEditorsPerDocument: false,
    }),
    vscode.commands.registerCommand("mlscriptStudio.compileActive", () => coordinator.compileActive()),
    vscode.commands.registerCommand("mlscriptStudio.compileFile", (uri?: vscode.Uri) => coordinator.compileUri(uri)),
    vscode.commands.registerCommand("mlscriptStudio.openStudioWorkspace", (uri?: vscode.Uri) => openDocumentView(uri, documentView.activeUri)),
    vscode.commands.registerCommand("mlscriptStudio.openDocumentView", (uri?: vscode.Uri) => openDocumentView(uri, documentView.activeUri)),
    vscode.commands.registerCommand("mlscriptStudio.addDocumentLibrary", () => addDocumentLibrary(context.extensionPath)),
    vscode.commands.registerCommand("mlscriptStudio.buildHtmlDocument", async (uri?: vscode.Uri) => {
      const target = uri ?? vscode.window.activeTextEditor?.document.uri ?? documentView.activeUri;
      if (!target) { void vscode.window.showInformationMessage("Open an .mls file first."); return; }
      const document = await vscode.workspace.openTextDocument(target);
      await builds.build(document);
    }),
    vscode.commands.registerCommand("mlscriptStudio.clearDiagnostics", () => {
      diagnostics.clear();
      output.appendLine("Cleared MLscript hkmc2 diagnostics.");
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (isMlscript(document) && configuration().get<boolean>("compileOnSave", true)) {
        void coordinator.compile(document, { revealOutput: false });
      }
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      diagnostics.delete(document.uri);
    }),
  );

  output.appendLine("MLscript Studio: hkmc2 compiler runtime loaded.");
}

class CompileCoordinator {
  private readonly compiling = new Set<string>();

  constructor(
    private readonly compiler: Hkmc2Compiler,
    private readonly collection: vscode.DiagnosticCollection,
    private readonly output: vscode.OutputChannel,
  ) {}

  async compileActive(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      void vscode.window.showInformationMessage("Open an .mls file to compile it with hkmc2.");
      return;
    }
    await this.compile(editor.document, { revealOutput: true });
  }

  async compileUri(uri?: vscode.Uri): Promise<void> {
    const target = uri ?? vscode.window.activeTextEditor?.document.uri;
    if (!target) {
      void vscode.window.showInformationMessage("Choose an .mls file to compile it with hkmc2.");
      return;
    }
    const document = await vscode.workspace.openTextDocument(target);
    await this.compile(document, { revealOutput: true });
  }

  async compile(document: vscode.TextDocument, options: { revealOutput: boolean }): Promise<void> {
    if (!isMlscript(document)) return;
    if (document.uri.scheme !== "file") {
      const message = "hkmc2 compilation currently requires a local .mls file. Save the document in a local workspace first.";
      this.collection.set(document.uri, [new vscode.Diagnostic(new vscode.Range(0, 0, 0, 1), message, vscode.DiagnosticSeverity.Error)]);
      void vscode.window.showErrorMessage(message);
      return;
    }

    const key = document.uri.toString();
    if (this.compiling.has(key)) return;
    this.compiling.add(key);
    const status = vscode.window.setStatusBarMessage("$(sync~spin) MLscript: compiling with hkmc2…");
    const started = Date.now();
    let temporary: TemporaryCompileFile | undefined;

    try {
      if (options.revealOutput) this.output.show(true);
      this.output.appendLine(`\n[${new Date().toLocaleTimeString()}] hkmc2 compile: ${document.uri.fsPath}`);

      const target = document.isDirty ? await createTemporarySibling(document) : { path: document.uri.fsPath, generatedPath: generatedPath(document.uri.fsPath) };
      temporary = "cleanup" in target ? target : undefined;
      const rawDiagnostics = await this.compiler.compile(target.path);
      const vscodeDiagnostics = flattenDiagnostics(rawDiagnostics, document, target.path);
      this.collection.set(document.uri, vscodeDiagnostics);

      const errors = vscodeDiagnostics.filter((diagnostic) => diagnostic.severity === vscode.DiagnosticSeverity.Error);
      const elapsed = Date.now() - started;
      if (errors.length) {
        this.output.appendLine(`Failed: ${errors.length} error(s), ${vscodeDiagnostics.length - errors.length} other diagnostic(s) in ${elapsed} ms.`);
        for (const diagnostic of vscodeDiagnostics) {
          this.output.appendLine(formatDiagnostic(document, diagnostic));
        }
        if (options.revealOutput) {
          void vscode.window.showErrorMessage(`MLscript: hkmc2 found ${errors.length} error${errors.length === 1 ? "" : "s"}.`);
        }
      } else {
        const generated = !document.isDirty && await exists(target.generatedPath);
        this.output.appendLine(`Success: no hkmc2 errors (${elapsed} ms).${generated ? ` Generated ${target.generatedPath}` : ""}`);
        if (configuration().get<boolean>("showSuccessNotification", false) && options.revealOutput) {
          void vscode.window.showInformationMessage("MLscript: hkmc2 compilation succeeded.");
        }
      }
    } catch (error) {
      const detail = error instanceof Error ? error.stack ?? error.message : String(error);
      this.output.appendLine(`Compiler crash:\n${detail}`);
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, Math.max(document.lineAt(0).text.length, 1)),
        `hkmc2 compiler failed: ${error instanceof Error ? error.message : String(error)}`,
        vscode.DiagnosticSeverity.Error,
      );
      this.collection.set(document.uri, [diagnostic]);
      void vscode.window.showErrorMessage("MLscript: hkmc2 compiler failed. See the MLscript hkmc2 Output channel.");
    } finally {
      await temporary?.cleanup();
      status.dispose();
      this.compiling.delete(key);
    }
  }
}

async function openDocumentView(uri?: vscode.Uri, fallback?: vscode.Uri): Promise<void> {
  const target = uri ?? vscode.window.activeTextEditor?.document.uri ?? fallback;
  if (!target) {
    void vscode.window.showInformationMessage("Open an .mls file before opening MLscript Document View.");
    return;
  }
  const document = await vscode.workspace.openTextDocument(target);
  if (!isMlscript(document)) {
    void vscode.window.showInformationMessage("MLscript Document View only supports .mls files.");
    return;
  }
  await vscode.commands.executeCommand("vscode.openWith", document.uri, DOCUMENT_VIEW_TYPE);
}

function configuration(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration("mlscriptStudio");
}

function isMlscript(document: vscode.TextDocument): boolean {
  return document.languageId === "mlscript" || document.uri.fsPath.toLowerCase().endsWith(".mls");
}

type TemporaryCompileFile = {
  path: string;
  generatedPath: string;
  cleanup: () => Promise<void>;
};

async function createTemporarySibling(document: vscode.TextDocument): Promise<TemporaryCompileFile> {
  const originalPath = document.uri.fsPath;
  const parsed = path.parse(originalPath);
  const token = crypto.randomBytes(6).toString("hex");
  const temporaryPath = path.join(parsed.dir, `.${parsed.name}.mlscript-studio-${token}${parsed.ext || ".mls"}`);
  const temporaryGenerated = generatedPath(temporaryPath);
  await fs.writeFile(temporaryPath, document.getText(), "utf8");
  return {
    path: temporaryPath,
    generatedPath: temporaryGenerated,
    cleanup: async () => {
      await Promise.all([
        fs.rm(temporaryPath, { force: true }),
        fs.rm(temporaryGenerated, { force: true }),
      ]);
    },
  };
}

function generatedPath(sourcePath: string): string {
  const parsed = path.parse(sourcePath);
  return path.join(parsed.dir, `${parsed.name}.mjs`);
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function flattenDiagnostics(
  files: Hkmc2FileDiagnostics[],
  document: vscode.TextDocument,
  compiledPath: string,
): vscode.Diagnostic[] {
  const result: vscode.Diagnostic[] = [];
  for (const file of files) {
    const sameTarget = !file.path || normalized(file.path) === normalized(compiledPath);
    for (const raw of file.diagnostics ?? []) {
      const message = sameTarget ? diagnosticText(raw) : `${file.path ?? "Imported module"}: ${diagnosticText(raw)}`;
      const range = sameTarget
        ? rangeFor(raw, document)
        : new vscode.Range(0, 0, 0, Math.max(document.lineAt(0).text.length, 1));
      const diagnostic = new vscode.Diagnostic(range, message, severityFor(raw.kind));
      diagnostic.source = DIAGNOSTIC_SOURCE;
      diagnostic.code = raw.source ?? "compilation";
      result.push(diagnostic);
    }
  }
  return result;
}

function normalized(filePath: string): string {
  return path.resolve(filePath).replace(/\\/g, "/").toLowerCase();
}

function rangeFor(raw: Hkmc2Diagnostic, document: vscode.TextDocument): vscode.Range {
  const location = raw.allMessages?.find((message) => message.location)?.location;
  if (!location || typeof location.start !== "number") {
    return new vscode.Range(0, 0, 0, Math.max(document.lineAt(0).text.length, 1));
  }
  const start = Math.min(Math.max(location.start, 0), document.getText().length);
  const end = Math.min(Math.max(location.end ?? start + 1, start + 1), document.getText().length);
  return new vscode.Range(document.positionAt(start), document.positionAt(end));
}

function severityFor(kind?: string): vscode.DiagnosticSeverity {
  switch ((kind ?? "").toLowerCase()) {
    case "warning": return vscode.DiagnosticSeverity.Warning;
    case "information":
    case "info": return vscode.DiagnosticSeverity.Information;
    case "hint": return vscode.DiagnosticSeverity.Hint;
    default: return vscode.DiagnosticSeverity.Error;
  }
}

function formatDiagnostic(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): string {
  const line = diagnostic.range.start.line + 1;
  const column = diagnostic.range.start.character + 1;
  return `${document.fileName}:${line}:${column} ${diagnostic.message}`;
}

export function deactivate(): void {
  // VS Code disposes all registered resources through ExtensionContext.
}
