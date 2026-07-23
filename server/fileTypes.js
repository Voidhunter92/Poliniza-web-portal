// Tipos de archivo que el administrador puede subir y asignar como informe.
// Centralizado acá para que la validación de subida (admin.js) y el
// servido con el Content-Type correcto (client.js) usen la misma lista.
const FILE_TYPES = {
  '.pdf': { mime: 'application/pdf', label: 'PDF' },
  '.html': { mime: 'text/html; charset=utf-8', label: 'HTML' },
  '.htm': { mime: 'text/html; charset=utf-8', label: 'HTML' },
  '.doc': { mime: 'application/msword', label: 'Word' },
  '.docx': {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    label: 'Word',
  },
  '.txt': { mime: 'text/plain; charset=utf-8', label: 'Texto' },
  '.ppt': { mime: 'application/vnd.ms-powerpoint', label: 'PowerPoint' },
  '.pptx': {
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    label: 'PowerPoint',
  },
  '.xls': { mime: 'application/vnd.ms-excel', label: 'Excel' },
  '.xlsx': {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    label: 'Excel',
  },
};

const ACCEPT_ATTR = Object.keys(FILE_TYPES).join(',');

function isAllowedExt(ext) {
  return Object.prototype.hasOwnProperty.call(FILE_TYPES, String(ext || '').toLowerCase());
}
function getMime(ext) {
  const entry = FILE_TYPES[String(ext || '').toLowerCase()];
  return entry ? entry.mime : 'application/octet-stream';
}
function getLabel(ext) {
  const entry = FILE_TYPES[String(ext || '').toLowerCase()];
  return entry ? entry.label : 'Archivo';
}

module.exports = { FILE_TYPES, ACCEPT_ATTR, isAllowedExt, getMime, getLabel };
