require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const helmet = require('helmet');

const db = require('./db');
const { seedIfEmpty } = require('./seed');
const portalRouter = require('./routes/portal');
const adminRouter = require('./routes/admin');
const clientRouter = require('./routes/client');
const cenoaRouter = require('./routes/cenoa');
const { requireRole } = require('./auth');

const ROOT_DIR = path.join(__dirname, '..');
const SESSIONS_DIR = path.join(db.DATA_DIR, 'sessions');

// --- Clave de sesión: usa la de entorno si existe, si no genera una y la
// guarda para que sea estable entre reinicios del proceso.
function getSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const secretPath = path.join(db.DATA_DIR, 'session-secret.txt');
  if (fs.existsSync(secretPath)) {
    return fs.readFileSync(secretPath, 'utf-8').trim();
  }
  if (!fs.existsSync(db.DATA_DIR)) fs.mkdirSync(db.DATA_DIR, { recursive: true });
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(secretPath, secret);
  return secret;
}

// Crea las cuentas iniciales (admin / parequipamientos / cenoa) si es la
// primera vez que corre el servidor.
const seedResult = seedIfEmpty();
if (seedResult.seeded) {
  console.log('[poliniza] Cuentas iniciales creadas: admin, parequipamientos, cenoa');
}

const app = express();
app.set('trust proxy', 1); // detrás de un proxy/reverse-proxy (Coolify/Traefik)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(
  helmet({
    contentSecurityPolicy: false, // el sitio usa fuentes de Google Fonts inline; se mantiene simple
  })
);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    store: new FileStore({ path: SESSIONS_DIR, ttl: 60 * 60 * 24 * 7, retries: 1 }),
    secret: getSessionSecret(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días
    },
  })
);

// Archivos estáticos del sitio principal — se exponen SOLO estas carpetas
// puntuales (nunca la raíz completa, para no servir por accidente
// server/data (contraseñas) o server/uploads (PDFs de clientes) como
// archivos estáticos sin control de acceso).
app.get('/', (req, res) => res.sendFile(path.join(ROOT_DIR, 'index.html')));
app.use('/css', express.static(path.join(ROOT_DIR, 'css')));
app.use('/js', express.static(path.join(ROOT_DIR, 'js')));
app.use('/assets', express.static(path.join(ROOT_DIR, 'assets')));
// Estilos propios del portal
app.use('/portal-assets', express.static(path.join(__dirname, 'public')));

// Portal de clientes
app.use('/portal', portalRouter);
app.use('/portal/admin', requireRole('admin'), adminRouter);
app.use('/portal/cliente', requireRole('client'), clientRouter);
app.use('/portal/cenoa', requireRole('cenoa'), cenoaRouter);

app.use((req, res) => {
  res.status(404).send('Página no encontrada.');
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Ocurrió un error inesperado.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[poliniza] Servidor corriendo en el puerto ${PORT}`);
});
