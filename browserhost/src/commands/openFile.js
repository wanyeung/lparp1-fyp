// The home commands: "Choose .mls file" saves a source to open, "Import CSV" turns a table into an .mls source, saves it and downloads it.
import { Csv, Export } from '../services/library.js'
import { save } from '../services/store.js'
import { saveText } from './download.js'

const nameOf = (file) => file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_]/g, '_') || 'untitled'

export const chooseMls = async (file) => {
  const name = nameOf(file)
  save(name, await file.text())
  return name
}

export const importCsv = async (file) => {
  const name = nameOf(file)
  const source = Export.mls(name, Csv.parse(await file.text()))
  save(name, source)
  saveText(`${name}.mls`, source, 'text/plain')
}
