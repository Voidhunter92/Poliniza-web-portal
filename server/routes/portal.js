const express = require('express');
const db = require('../db');
const { hashPassword, verifyPassword, requireAuth } = require('../auth');
const { ensureCsrfToken, verifyCsrf } = require('../csrf');
const rateLimit = require('../rateLimit');

const router = express.Router();

function redirectForRole(role) {
  if (role === 'admin') return '/portal/admin/clientes';
  if (role === 'cenoa') return '/portal/cenoa';
  return '/portal/cliente';
}

router.get('/', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect(redirectForRole(req.session.user.role));
  }
  res.redirect('/portal/login');
});

router.get('/login', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect(redirectForRole(req.session.user.role));
  }
  res.render('login', { error: null, username: '', csrfToken: ensureCsrfToken(req) });
});

router.post('/login', (req, res) => {
  const csrfToken = ensureCsrfToken(req);
  const { username, password, _csrf } = req.body;

  if (!_csrf || _csrf !== req.session.csrfToken) {
    return res.status(403).render('login', {
      error: 'La página estaba desactualizada. Probá de nuevo.',
      username: username || '',
      csrfToken,
    });
  }

  const ip = req.ip || 'unknown';
  if (rateLimit.isLocked(ip, username)) {
    return res.status(429).render('login', {
      error: 'Demasiados intentos fallidos. Esperá 15 minutos y volvé a intentar.',
      username,
      csrfToken,
    });
  }

  const user = db.users.all().find(
    (u) => u.username.toLowerCase() === String(username || '').trim().toLowerCase()
  );

  if (!user || !verifyPassword(password || '', user.passwordHash)) {
    rateLimit.registerFailure(ip, username);
    return res.status(401).render('login', {
      error: 'Usuario o contraseña incorrectos.',
      username,
      csrfToken,
    });
  }

  rateLimit.clear(ip, username);
  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).render('login', { error: 'Ocurrió un error. Probá de nuevo.', username, csrfToken });
    }
    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
    };
    res.redirect(redirectForRole(user.role));
  });
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/portal/login');
  });
});

router.get('/cambiar-password', requireAuth, (req, res) => {
  res.render('cambiar-password', {
    user: req.session.user,
    error: null,
    success: null,
    csrfToken: ensureCsrfToken(req),
  });
});

router.post('/cambiar-password', requireAuth, verifyCsrf, (req, res) => {
  const { actual, nueva, repetir } = req.body;
  const csrfToken = ensureCsrfToken(req);
  const users = db.users.all();
  const idx = users.findIndex((u) => u.id === req.session.user.id);

  if (idx === -1) {
    return res.status(404).render('error', { title: 'Usuario no encontrado', message: 'Tu cuenta ya no existe.', user: req.session.user });
  }

  if (!verifyPassword(actual || '', users[idx].passwordHash)) {
    return res.render('cambiar-password', { user: req.session.user, error: 'La contraseña actual no es correcta.', success: null, csrfToken });
  }
  if (!nueva || nueva.length < 6) {
    return res.render('cambiar-password', { user: req.session.user, error: 'La nueva contraseña debe tener al menos 6 caracteres.', success: null, csrfToken });
  }
  if (nueva !== repetir) {
    return res.render('cambiar-password', { user: req.session.user, error: 'Las contraseñas nuevas no coinciden.', success: null, csrfToken });
  }

  users[idx].passwordHash = hashPassword(nueva);
  db.users.save(users);

  res.render('cambiar-password', { user: req.session.user, error: null, success: 'Contraseña actualizada correctamente.', csrfToken });
});

module.exports = router;
