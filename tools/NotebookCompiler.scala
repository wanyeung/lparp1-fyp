package hkmc2

import scala.scalajs.js
import scala.scalajs.js.annotation.*

/**
  * Node-facing hkmc2 facade for the Streamlit notebook.
  *
  * The upstream hkmc2 JavaScript compiler already exposes a Compiler class, but
  * its compiler context is a Scala contextual parameter. This small adapter
  * constructs that context with the notebook's copied standard library and
  * exports a JavaScript-friendly constructor.
  */
@JSExportTopLevel("NotebookCompiler")
class NotebookCompiler(projectRoot: String):

  private val root = io.Path(projectRoot)
  private val std = root / "runtime" / "std"

  private val paths = new MLsCompiler.Paths:
    val preludeFile: io.Path = std / "Prelude.mls"
    val runtimeFile: io.Path = std / "Runtime.mjs"
    val runtimeSourceFile: io.Path = std / "Runtime.mls"
    val termFile: io.Path = std / "Term.mjs"

  private given CompilerCtx =
    CompilerCtx.fresh(io.FileSystem.default, paths, Config.default(root))

  private val compiler = new Compiler

  @JSExport
  def compile(filePath: String): js.Array[js.Dynamic] =
    compiler.compile(filePath)
