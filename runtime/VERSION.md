# Compiler bundle and standard library

- `compiler/MLscript.mjs`: Scala.js build (`sbt hkmc2JS/fastOptJS`, Scala 3.8.4) of
  https://github.com/hkust-taco/mlscript, branch `hkmc2`, commit `1a86e1c` (2026-09-02),
  plus one untracked adapter, `hkmc2/js/src/main/scala/hkmc2/NotebookCompiler.scala`.
- Why the adapter: upstream's JS-exported `Compiler` takes a Scala context parameter that
  JavaScript cannot construct. `NotebookCompiler(projectRoot)` builds it using the real
  file system and `<projectRoot>/runtime/std`.
- `std/`: the hkmc2 standard library (`.mls` sources plus their compiled `.mjs`).
- Both copied from a sibling checkout (`peter/mlscript-streamlit-notebook`); to refresh,
  rebuild from upstream with the adapter and copy the two paths here.
