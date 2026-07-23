const crypto = require('crypto');

// Token anti-CSRF simple: se genera uno por sesión y se exige en cada
// formulario que modifica datos (crear/editar/eliminar).
function ensureCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }
  return req.session.csrfToken;
}

function verifyCsrf(req, res, next) {
  const token = req.body && req.body._csrf;
  if (!token || !req.session || token !== req.session.csrfToken) {
    return res.status(403).render('error', {
      title: 'Sesión expirada',
      message: 'Tu sesión expiró o la página estaba desactualizada. Volvé atrás y probá de nuevo.',
      user: req.session ? req.session.user : null,
    });
  }
  next();
}

module.exports = { ensureCsrfToken, verifyCsrf };
