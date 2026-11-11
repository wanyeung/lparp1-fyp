import * as path from "node:path";
import { pathToFileURL } from "node:url";

export type Hkmc2MessageBit = { text?: string };

export type Hkmc2Diagnostic = {
  kind?: string;
  source?: string;
  mainMessage?: string;
  allMessages?: Array<{
    messageBits?: Hkmc2MessageBit[];
    location?: { start?: number; end?: number } | null;
  }>;
};

export type Hkmc2FileDiagnostics = {
  path?: string;
  diagnostics?: Hkmc2Diagnostic[];
};

type NotebookCompilerInstance = {
  compile(filePath: string): Hkmc2FileDiagnostics[];
};

type NotebookCompilerConstructor = new (projectRoot: string) => NotebookCompilerInstance;

/**
 * Thin Node-side facade around the Scala.js hkmc2 compiler build.
 *
 * `NotebookCompiler` is intentionally small: it only supplies the Scala
 * compiler context that the upstream JS-exported Compiler cannot receive from
 * JavaScript. All parsing, elaboration, diagnostics and JavaScript generation
 * are performed by hkmc2 itself.
 */
export class Hkmc2Compiler {
  private compiler: Promise<NotebookCompilerInstance> | undefined;

  constructor(private readonly extensionRoot: string) {}

  async compile(filePath: string): Promise<Hkmc2FileDiagnostics[]> {
    const compiler = await this.getCompiler();
    const diagnostics = compiler.compile(toHkmc2Path(filePath));
    return Array.from(diagnostics ?? []);
  }

  private getCompiler(): Promise<NotebookCompilerInstance> {
    if (!this.compiler) {
      this.compiler = this.loadCompiler();
    }
    return this.compiler;
  }

  private async loadCompiler(): Promise<NotebookCompilerInstance> {
    const compilerFile = path.join(this.extensionRoot, "runtime", "compiler", "MLscript.mjs");
    const moduleUrl = pathToFileURL(compilerFile).href;
    // Esbuild emits the extension as CommonJS. This indirection keeps the
    // Scala.js compiler as an external ESM runtime asset instead of trying to
    // bundle its Node filesystem dependency into the extension host bundle.
    const dynamicImport = new Function("specifier", "return import(specifier);") as (specifier: string) => Promise<{
      NotebookCompiler?: NotebookCompilerConstructor;
    }>;
    const compilerModule = await dynamicImport(moduleUrl);
    if (!compilerModule.NotebookCompiler) {
      throw new Error("The bundled hkmc2 runtime does not export NotebookCompiler.");
    }
    return new compilerModule.NotebookCompiler(toHkmc2Path(this.extensionRoot));
  }
}

export function toHkmc2Path(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

export function diagnosticText(diagnostic: Hkmc2Diagnostic): string {
  if (diagnostic.mainMessage) return diagnostic.mainMessage;
  const fallback = (diagnostic.allMessages ?? [])
    .map((message) => (message.messageBits ?? []).map((bit) => bit.text ?? "").join(""))
    .filter(Boolean)
    .join("\n");
  return fallback || "MLscript compilation diagnostic";
}
