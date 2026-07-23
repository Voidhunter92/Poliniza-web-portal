// Almacenamiento simple basado en archivos JSON.
// Alcanza sobradamente para la escala del portal (puñado de clientes y
// contenidos cargados a mano); evita depender de un motor de base de datos.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function ensureFile(file, defaultValue) {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, file);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
  }
  return filePath;
}

function readJSON(file, defaultValue) {
  const filePath = ensureFile(file, defaultValue);
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return defaultValue;
  }
}

function writeJSON(file, data) {
  const filePath = ensureFile(file, data);
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, filePath);
}

module.exports = {
  DATA_DIR,
  users: {
    all: () => readJSON('users.json', []),
    save: (list) => writeJSON('users.json', list),
  },
  reports: {
    all: () => readJSON('reports.json', []),
    save: (list) => writeJSON('reports.json', list),
  },
  cenoaContent: {
    all: () => readJSON('cenoa-content.json', []),
    save: (list) => writeJSON('cenoa-content.json', list),
  },
};
