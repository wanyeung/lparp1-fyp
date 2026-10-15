/** Finds the hkmc2 compiler bundle (MLscript.mjs) that the runner loads. */
import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface CompilerLocation { bundle: string; stdDir?: string }

export function locateCompiler(context: vscode.ExtensionContext): CompilerLocation | undefined {
  const configured = vscode.workspace.getConfiguration('mls').get<string>('compilerBundle', '').trim();
  const candidates: string[] = [];
  if (configured) candidates.push(configured);
  // vscode-mls lives next to sheetbook-poc in the fyp-mlscript repo
  candidates.push(path.join(context.extensionPath, '..', 'sheetbook-poc', 'build', 'MLscript.mjs'));
  for (const f of vscode.workspace.workspaceFolders ?? []) {
    candidates.push(path.join(f.uri.fsPath, 'sheetbook-poc', 'build', 'MLscript.mjs'));
    candidates.push(path.join(f.uri.fsPath, 'build', 'MLscript.mjs'));
  }
  const bundle = candidates.find(p => fs.existsSync(p));
  if (!bundle) return undefined;
  const stdDir = path.join(path.dirname(bundle), '..', 'vendors', 'std');
  return { bundle, stdDir: fs.existsSync(stdDir) ? stdDir : undefined };
}
