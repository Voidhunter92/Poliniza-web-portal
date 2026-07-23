const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

function hashPassword(plain) {
  return bcrypt.hashSync(plain, SALT_ROUNDS);
}

function verifyPassword(plain, hash) {
  try {
    return bcrypt.compareSync(plain, hash);
  } catch (err) {
    return false;
  }
}

// Debe haber iniciado sesión, sin importar el rol.
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/portal/login');
  }
  next();
}

// Debe haber iniciado sesión Y tener alguno de los roles indicados.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.redirect('/portal/login');
    }
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).render('error', {
        title: 'Acceso no permitido',
        message: 'Tu usuario no tiene permiso para ver esta página.',
        user: req.session.user,
      });
    }
    next();
  };
}

module.exports = { hashPassword, verifyPassword, requireAuth, requireRole };
