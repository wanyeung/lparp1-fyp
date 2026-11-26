// Loads the built library modules and the Marks.js chart script for the browser host.
import Csv from '../../../build/library/io/Csv.mjs'
import Export from '../../../build/library/io/Export.mjs'
import Html from '../../../build/library/service/Html.mjs'
import Controller from '../../../build/library/controller/Controller.mjs'

const marks = await (await fetch(new URL('../../../build/library/controller/D3Manipulation/Marks.js', import.meta.url))).text()

export { Csv, Export, Html, Controller, marks }
