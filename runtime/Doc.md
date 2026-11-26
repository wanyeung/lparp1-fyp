# Runtime

- `compiler/MLscript.mjs`: the MLscript compiler, built with Scala.js from https://github.com/hkust-taco/mlscript (branch `hkmc2`). The commit is in `VERSION.md`.
- `std/`: the standard library. The compiler reads its `.mls` sources, and every compiled program imports `std/Runtime.mjs` when it runs, so both are needed.
- `compile.mjs`: calls the compiler. The bundle exports `NotebookCompiler(projectRoot)`, a small adapter added on top of upstream (`hkmc2/js/src/main/scala/hkmc2/NotebookCompiler.scala`, not upstream), because upstream's `Compiler` takes a Scala context parameter that JavaScript cannot construct. `compile.mjs` also turns the absolute Windows paths in compiled imports into relative ones, and `npm run build` uses it to compile `library/` into `build/library/`.

## Refresh by hand

Build upstream with `sbt hkmc2JS/fastOptJS` plus the adapter, copy the output to `compiler/MLscript.mjs` and the standard library to `std/`, then put the new commit in `VERSION.md`.

## TODO

- CI workflow, triggered by hand (`workflow_dispatch`): run all tests, then publish `MLscript.mjs` as a release asset.
- Download hook: fetch that release asset into `compiler/`, so teammates need neither sbt nor a JDK.
