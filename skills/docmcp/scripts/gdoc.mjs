#!/usr/bin/env node
import { getAuth, runAuthFlow } from './auth.mjs';
import * as docs from './docs.mjs';
import * as docsExtra from './docs-extra.mjs';
import * as sheets from './sheets.mjs';
import * as sheetsExtra from './sheets-extra.mjs';
import * as scripts from './apps-script.mjs';

const COMMANDS = {
  'docs.create': (a, p) => docs.create(a, p),
  'docs.read': (a, p) => docs.read(a, p),
  'docs.edit': (a, p) => docs.edit(a, p),
  'docs.insert': (a, p) => docs.insert(a, p),
  'docs.delete': (a, p) => docs.deleteText(a, p),
  'docs.format': (a, p) => docs.format(a, p),
  'docs.insert_table': (a, p) => docs.insertTable(a, p),
  'docs.get_info': (a, p) => docs.getInfo(a, p),
  'docs.get_structure': (a, p) => docs.getStructure(a, p),
  'docs.list': (a, p) => docs.list(a, p),
  'docs.get_sections': (a, p) => docsExtra.getSections(a, p),
  'docs.section': (a, p) => docsExtra.section(a, p),
  'docs.image': (a, p) => docsExtra.image(a, p),
  'docs.batch': (a, p) => docsExtra.batch(a, p),
  'drive.search': (a, p) => docsExtra.searchDrive(a, p),
  'sheets.create': (a, p) => sheets.create(a, p),
  'sheets.read': (a, p) => sheets.read(a, p),
  'sheets.edit': (a, p) => sheets.edit(a, p),
  'sheets.insert': (a, p) => sheets.insert(a, p),
  'sheets.get_cell': (a, p) => sheets.getCell(a, p),
  'sheets.set_cell': (a, p) => sheets.setCell(a, p),
  'sheets.edit_cell': (a, p) => sheets.editCell(a, p),
  'sheets.find_replace': (a, p) => sheets.findReplace(a, p),
  'sheets.get_info': (a, p) => sheets.getInfo(a, p),
  'sheets.list': (a, p) => sheets.list(a, p),
  'sheets.clear': (a, p) => sheets.clear(a, p),
  'sheets.get_formula': (a, p) => sheets.getFormula(a, p),
  'sheets.tab': (a, p) => sheetsExtra.tab(a, p),
  'sheets.format': (a, p) => sheetsExtra.format(a, p),
  'sheets.merge': (a, p) => sheetsExtra.merge(a, p),
  'sheets.freeze': (a, p) => sheetsExtra.freeze(a, p),
  'sheets.sort': (a, p) => sheetsExtra.sort(a, p),
  'sheets.rows_cols': (a, p) => sheetsExtra.rowsCols(a, p),
  'sheets.dimension_size': (a, p) => sheetsExtra.dimensionSize(a, p),
  'sheets.batch': (a, p) => sheetsExtra.batch(a, p),
  'scripts.create': (a, p) => scripts.createScript(a, p),
  'scripts.list': (a, p) => scripts.listScripts(a, p),
  'scripts.read': (a, p) => scripts.readScript(a, p),
  'scripts.write': (a, p) => scripts.writeScript(a, p),
  'scripts.edit': (a, p) => scripts.editScript(a, p),
  'scripts.delete': (a, p) => scripts.deleteScript(a, p),
  'scripts.run': (a, p) => scripts.runScript(a, p),
  'scripts.sync': (a, p) => scripts.syncScripts(a, p),
};

async function main() {
  const [command, argsJson] = process.argv.slice(2);

  if (!command || command === 'help') {
    console.log(JSON.stringify({ commands: Object.keys(COMMANDS), usage: 'gdoc.mjs <command> \'<json-args>\'' }));
    return;
  }

  if (command === 'auth') {
    const result = await runAuthFlow();
    console.log(JSON.stringify(result));
    return;
  }

  const handler = COMMANDS[command];
  if (!handler) {
    console.log(JSON.stringify({ error: `Unknown command: ${command}`, available: Object.keys(COMMANDS) }));
    process.exit(1);
  }

  let params = {};
  if (argsJson) {
    try { params = JSON.parse(argsJson); }
    catch (_) { console.log(JSON.stringify({ error: `Invalid JSON: ${argsJson}` })); process.exit(1); }
  }
  const auth = await getAuth();
  const result = await handler(auth, params);
  console.log(JSON.stringify(result));
}

main().catch(err => {
  console.log(JSON.stringify({ error: err.message }));
  process.exit(1);
});
