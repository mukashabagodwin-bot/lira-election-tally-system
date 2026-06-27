const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const jsFiles = walk(root).filter((file) => file.endsWith('.js') && !file.includes('node_modules'));
const ejsFiles = walk(path.join(root, 'src', 'views')).filter((file) => file.endsWith('.ejs'));
const errors = [];

for (const file of jsFiles) {
  try {
    new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file });
  } catch (error) {
    errors.push(path.relative(root, file) + ': ' + error.message);
  }
}

for (const file of ejsFiles) {
  const src = fs.readFileSync(file, 'utf8');
  for (const match of src.matchAll(/include\(['"]([^'"]+)['"]\)/g)) {
    const target = path.resolve(path.dirname(file), match[1] + (match[1].endsWith('.ejs') ? '' : '.ejs'));
    if (!fs.existsSync(target)) errors.push(path.relative(root, file) + ': missing include ' + match[1]);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('Smoke check passed: ' + jsFiles.length + ' JS files and ' + ejsFiles.length + ' EJS templates.');
