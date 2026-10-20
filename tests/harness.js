// Loads filter-hobbyist.html's non-UI <script> blocks into one node:vm
// context (with a fake `window`) and returns window.FH.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadFH() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'filter-hobbyist.html'), 'utf8');
  const window = {};
  const ctx = vm.createContext({ window, console, Math });
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    if (/data-module\s*=\s*["']ui["']/.test(m[1])) continue; // UI needs a browser
    vm.runInContext(m[2], ctx, { filename: 'filter-hobbyist.html' });
  }
  return window.FH;
}

module.exports = { loadFH };
