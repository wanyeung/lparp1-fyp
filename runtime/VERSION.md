# Bundled hkmc2 runtime

- `compiler/MLscript.mjs` is a Scala.js build of [HKUST TACO MLscript](https://github.com/hkust-taco/mlscript), branch `hkmc2`, commit `1a86e1c` (2026-09-02).
- It contains the local `NotebookCompiler` adapter from `tools/NotebookCompiler.scala`. The adapter only creates hkmc2's compiler context and points it to this extension's `runtime/std` directory; hkmc2 performs parsing, elaboration, diagnostics, and JavaScript generation.
- `std/` contains the matching hkmc2 declarations, sources, and compiled JavaScript runtime modules.

Run `scripts/update-hkmc2.sh` with Java, sbt, Node.js, and git to refresh this runtime from the upstream `hkmc2` branch.
