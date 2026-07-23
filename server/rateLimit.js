// Freno simple de fuerza bruta en el login: bloquea por 15 minutos
// combinando IP + usuario tras 5 intentos fallidos. Vive en memoria del
// proceso — es una protección básica, no de nivel empresarial, pero
// suficiente para la escala de este portal.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map();

function key(ip, username) {
  return `${ip}:${(username || '').toLowerCase()}`;
}

function isLocked(ip, username) {
  const rec = attempts.get(key(ip, username));
  if (!rec) return false;
  if (Date.now() - rec.first > WINDOW_MS) {
    attempts.delete(key(ip, username));
    return false;
  }
  return rec.count >= MAX_ATTEMPTS;
}

function registerFailure(ip, username) {
  const k = key(ip, username);
  const rec = attempts.get(k);
  if (!rec || Date.now() - rec.first > WINDOW_MS) {
    attempts.set(k, { count: 1, first: Date.now() });
  } else {
    rec.count += 1;
  }
}

function clear(ip, username) {
  attempts.delete(key(ip, username));
}

module.exports = { isLocked, registerFailure, clear, MAX_ATTEMPTS };
