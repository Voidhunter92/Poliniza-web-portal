const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../db');
const { hashPassword } = require('../auth');
const { ensureCsrfToken, verifyCsrf } = require('../csrf');
const { makeId } = require('../ids');
const { availableMonths, currentOrStartMonth, monthLabel } = require('../dateUtils');
const { isAllowedExt, ACCEPT_ATTR, getLabel } = require('../fileTypes');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'reports');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, `${makeId()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!isAllowedExt(ext)) return cb(new Error('Formato no permitido. Subí un PDF, HTML, Word, Excel, PowerPoint o TXT.'));
    cb(null, true);
  },
});

const USERNAME_RE = /^[a-z0-9._-]{3,40}$/;
const ESTADOS = ['aprobado', 'desaprobado', 'revisar'];

function nonAdminUsers() {
  return db.users.all().filter((u) => u.role !== 'admin');
}
function clientUsers() {
  return db.users.all().filter((u) => u.role === 'client');
}

// ============================================================
// CLIENTES (crear / editar / eliminar cuentas de cliente y CENOA)
// ============================================================

router.get('/clientes', (req, res) => {
  res.render('admin/clientes', {
    user: req.session.user,
    adminTabs: true,
    activeTab: 'clientes',
    users: nonAdminUsers(),
    reportsCount: (username) => db.reports.all().filter((r) => r.clientUsername === username).length,
    error: req.query.error || null,
    success: req.query.success || null,
    csrfToken: ensureCsrfToken(req),
  });
});

router.post('/clientes', verifyCsrf, (req, res) => {
  const { username, password, displayName, role } = req.body;
  const csrfToken = ensureCsrfToken(req);
  const cleanUsername = String(username || '').trim().toLowerCase();

  const renderWithError = (error) =>
    res.status(400).render('admin/clientes', {
      user: req.session.user,
      adminTabs: true,
      activeTab: 'clientes',
      users: nonAdminUsers(),
      reportsCount: (u) => db.reports.all().filter((r) => r.clientUsername === u).length,
      error,
      success: null,
      csrfToken,
    });

  if (!USERNAME_RE.test(cleanUsername)) {
    return renderWithError('El usuario debe tener 3-40 caracteres: minúsculas, números, puntos, guiones o guión bajo.');
  }
  if (!password || password.length < 6) {
    return renderWithError('La contraseña debe tener al menos 6 caracteres.');
  }
  if (!displayName || !displayName.trim()) {
    return renderWithError('Ingresá un nombre para identificar la cuenta (ej: nombre de la empresa).');
  }
  if (!['client', 'cenoa', 'admin'].includes(role)) {
    return renderWithError('Rol inválido.');
  }

  const users = db.users.all();
  if (users.some((u) => u.username.toLowerCase() === cleanUsername)) {
    return renderWithError('Ya existe una cuenta con ese usuario.');
  }

  users.push({
    id: makeId(),
    username: cleanUsername,
    passwordHash: hashPassword(password),
    role,
    displayName: displayName.trim(),
    createdAt: new Date().toISOString(),
  });
  db.users.save(users);

  res.redirect('/portal/admin/clientes?success=' + encodeURIComponent(`Cuenta "${cleanUsername}" creada correctamente.`));
});

router.get('/clientes/:id/editar', (req, res) => {
  const target = db.users.all().find((u) => u.id === req.params.id);
  if (!target) return res.redirect('/portal/admin/clientes?error=' + encodeURIComponent('Esa cuenta no existe.'));
  res.render('admin/editar-cliente', {
    user: req.session.user,
    adminTabs: true,
    activeTab: 'clientes',
    target,
    error: null,
    csrfToken: ensureCsrfToken(req),
  });
});

router.post('/clientes/:id/editar', verifyCsrf, (req, res) => {
  const { displayName, role, password } = req.body;
  const users = db.users.all();
  const idx = users.findIndex((u) => u.id === req.params.id);
  if (idx === -1) return res.redirect('/portal/admin/clientes?error=' + encodeURIComponent('Esa cuenta no existe.'));

  const renderErr = (error) =>
    res.status(400).render('admin/editar-cliente', {
      user: req.session.user,
      adminTabs: true,
      activeTab: 'clientes',
      target: users[idx],
      error,
      csrfToken: ensureCsrfToken(req),
    });

  if (!displayName || !displayName.trim()) return renderErr('Ingresá un nombre para la cuenta.');
  if (!['client', 'cenoa', 'admin'].includes(role)) return renderErr('Rol inválido.');
  if (password && password.length > 0 && password.length < 6) return renderErr('La nueva contraseña debe tener al menos 6 caracteres.');

  users[idx].displayName = displayName.trim();
  users[idx].role = role;
  if (password && password.length >= 6) {
    users[idx].passwordHash = hashPassword(password);
  }
  db.users.save(users);

  res.redirect('/portal/admin/clientes?success=' + encodeURIComponent('Cuenta actualizada.'));
});

router.post('/clientes/:id/eliminar', verifyCsrf, (req, res) => {
  if (req.params.id === req.session.user.id) {
    return res.redirect('/portal/admin/clientes?error=' + encodeURIComponent('No podés eliminar tu propia cuenta.'));
  }
  const users = db.users.all();
  const target = users.find((u) => u.id === req.params.id);
  if (!target) return res.redirect('/portal/admin/clientes?error=' + encodeURIComponent('Esa cuenta no existe.'));

  db.users.save(users.filter((u) => u.id !== req.params.id));

  // Elimina en cascada los informes asignados a ese cliente (y sus archivos PDF).
  const reports = db.reports.all();
  const remaining = [];
  reports.forEach((r) => {
    if (r.clientUsername === target.username) {
      if (r.type === 'archivo' && r.fileName) {
        const filePath = path.join(UPLOAD_DIR, r.fileName);
        fs.unlink(filePath, () => {});
      }
    } else {
      remaining.push(r);
    }
  });
  db.reports.save(remaining);

  res.redirect('/portal/admin/clientes?success=' + encodeURIComponent(`Cuenta "${target.username}" eliminada.`));
});

// ============================================================
// INFORMES (subir / asignar / eliminar informes de clientes)
// ============================================================

router.get('/informes', (req, res) => {
  const reports = db.reports.all().sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  res.render('admin/informes', {
    user: req.session.user,
    adminTabs: true,
    activeTab: 'informes',
    reports,
    clients: clientUsers(),
    acceptAttr: ACCEPT_ATTR,
    fileLabel: (fileName) => getLabel(path.extname(fileName || '')),
    error: req.query.error || null,
    success: req.query.success || null,
    csrfToken: ensureCsrfToken(req),
  });
});

router.post('/informes', (req, res, next) => {
  upload.single('archivo')(req, res, (err) => {
    if (err) {
      return res.redirect('/portal/admin/informes?error=' + encodeURIComponent(err.message || 'No se pudo subir el archivo.'));
    }
    next();
  });
}, verifyCsrf, (req, res) => {
  const { clientUsername, title, period, month, year, type, url } = req.body;

  const fail = (msg) => {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.redirect('/portal/admin/informes?error=' + encodeURIComponent(msg));
  };

  const client = clientUsers().find((c) => c.username === clientUsername);
  if (!client) return fail('Seleccioná un cliente válido.');
  if (!title || !title.trim()) return fail('Ingresá un título para el informe.');
  if (!['mensual', 'anual'].includes(period)) return fail('Seleccioná el período del informe.');

  const yearNum = parseInt(year, 10);
  if (!yearNum || yearNum < 2020 || yearNum > 2100) return fail('Ingresá un año válido.');

  let monthNum = null;
  if (period === 'mensual') {
    monthNum = parseInt(month, 10);
    if (!monthNum || monthNum < 1 || monthNum > 12) return fail('Seleccioná el mes del informe.');
  }

  const report = {
    id: makeId(),
    clientUsername: client.username,
    title: title.trim(),
    period,
    month: monthNum,
    year: yearNum,
    uploadedAt: new Date().toISOString(),
  };

  if (type === 'archivo') {
    if (!req.file) return fail('Subí un archivo.');
    report.type = 'archivo';
    report.fileName = req.file.filename;
    report.originalName = req.file.originalname;
  } else if (type === 'link') {
    if (req.file) fs.unlink(req.file.path, () => {});
    if (!url || !/^https?:\/\//i.test(url.trim())) return fail('Ingresá un enlace válido (debe empezar con http:// o https://).');
    report.type = 'link';
    report.url = url.trim();
  } else {
    return fail('Tipo de informe inválido.');
  }

  const reports = db.reports.all();
  reports.push(report);
  db.reports.save(reports);

  res.redirect('/portal/admin/informes?success=' + encodeURIComponent('Informe asignado correctamente.'));
});

router.post('/informes/:id/eliminar', verifyCsrf, (req, res) => {
  const reports = db.reports.all();
  const target = reports.find((r) => r.id === req.params.id);
  if (!target) return res.redirect('/portal/admin/informes?error=' + encodeURIComponent('Ese informe no existe.'));

  if (target.type === 'archivo' && target.fileName) {
    fs.unlink(path.join(UPLOAD_DIR, target.fileName), () => {});
  }
  db.reports.save(reports.filter((r) => r.id !== req.params.id));

  res.redirect('/portal/admin/informes?success=' + encodeURIComponent('Informe eliminado.'));
});

// ============================================================
// CENOA (dashboard de contenidos: placas y videos por mes/año)
// ============================================================

function cenoaFilterParams(req) {
  const current = currentOrStartMonth();
  const year = parseInt(req.query.year, 10) || current.year;
  const month = parseInt(req.query.month, 10) || current.month;
  const tipo = req.query.tipo === 'video' ? 'video' : 'placa';
  return { year, month, tipo };
}

router.get('/cenoa', (req, res) => {
  const { year, month, tipo } = cenoaFilterParams(req);
  const items = db.cenoaContent
    .all()
    .filter((c) => c.year === year && c.month === month && c.tipo === tipo)
    .sort((a, b) => new Date(a.fechaEntrega || 0) - new Date(b.fechaEntrega || 0));

  res.render('admin/cenoa', {
    user: req.session.user,
    adminTabs: true,
    activeTab: 'cenoa',
    items,
    year, month, tipo,
    months: availableMonths(),
    monthLabel: monthLabel(month, year),
    error: req.query.error || null,
    success: req.query.success || null,
    csrfToken: ensureCsrfToken(req),
  });
});

router.get('/cenoa/nuevo', (req, res) => {
  const { year, month, tipo } = cenoaFilterParams(req);
  res.render('admin/cenoa-form', {
    user: req.session.user,
    adminTabs: true,
    activeTab: 'cenoa',
    mode: 'nuevo',
    item: { year, month, tipo, estado: 'revisar', numPiezas: 1 },
    months: availableMonths(),
    error: null,
    csrfToken: ensureCsrfToken(req),
  });
});

function readCenoaForm(body) {
  const [monthPart, yearPart] = String(body.monthYear || '').split('-');
  return {
    tipo: body.tipo === 'video' ? 'video' : 'placa',
    year: parseInt(yearPart, 10),
    month: parseInt(monthPart, 10),
    titulo: (body.titulo || '').trim(),
    empresa: (body.empresa || '').trim(),
    fechaPedido: body.fechaPedido || '',
    fechaEntrega: body.fechaEntrega || '',
    numPiezas: parseInt(body.numPiezas, 10) || 1,
    copy: (body.copy || '').trim(),
    driveLink: (body.driveLink || '').trim(),
    estado: ESTADOS.includes(body.estado) ? body.estado : 'revisar',
  };
}

function validateCenoaForm(data) {
  if (!data.empresa) return 'Ingresá la empresa.';
  if (!data.titulo) return 'Ingresá un título breve para identificar la pieza.';
  if (!data.year || data.year < 2020 || data.year > 2100) return 'Año inválido.';
  if (!data.month || data.month < 1 || data.month > 12) return 'Mes inválido.';
  if (data.numPiezas < 1) return 'El número de piezas debe ser al menos 1.';
  if (data.driveLink && !/^https?:\/\//i.test(data.driveLink)) return 'El enlace de Drive debe empezar con http:// o https://.';
  return null;
}

router.post('/cenoa', verifyCsrf, (req, res) => {
  const data = readCenoaForm(req.body);
  const validationError = validateCenoaForm(data);
  if (validationError) {
    return res.status(400).render('admin/cenoa-form', {
      user: req.session.user,
      adminTabs: true,
      activeTab: 'cenoa',
      mode: 'nuevo',
      item: data,
      months: availableMonths(),
      error: validationError,
      csrfToken: ensureCsrfToken(req),
    });
  }

  const items = db.cenoaContent.all();
  const now = new Date().toISOString();
  items.push({ id: makeId(), ...data, createdAt: now, updatedAt: now });
  db.cenoaContent.save(items);

  res.redirect(`/portal/admin/cenoa?year=${data.year}&month=${data.month}&tipo=${data.tipo}&success=` + encodeURIComponent('Contenido agregado.'));
});

router.get('/cenoa/:id/editar', (req, res) => {
  const item = db.cenoaContent.all().find((c) => c.id === req.params.id);
  if (!item) return res.redirect('/portal/admin/cenoa?error=' + encodeURIComponent('Ese contenido no existe.'));
  res.render('admin/cenoa-form', {
    user: req.session.user,
    adminTabs: true,
    activeTab: 'cenoa',
    mode: 'editar',
    item,
    months: availableMonths(),
    error: null,
    csrfToken: ensureCsrfToken(req),
  });
});

router.post('/cenoa/:id/editar', verifyCsrf, (req, res) => {
  const items = db.cenoaContent.all();
  const idx = items.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.redirect('/portal/admin/cenoa?error=' + encodeURIComponent('Ese contenido no existe.'));

  const data = readCenoaForm(req.body);
  const validationError = validateCenoaForm(data);
  if (validationError) {
    return res.status(400).render('admin/cenoa-form', {
      user: req.session.user,
      adminTabs: true,
      activeTab: 'cenoa',
      mode: 'editar',
      item: { ...data, id: req.params.id },
      months: availableMonths(),
      error: validationError,
      csrfToken: ensureCsrfToken(req),
    });
  }

  items[idx] = { ...items[idx], ...data, updatedAt: new Date().toISOString() };
  db.cenoaContent.save(items);

  res.redirect(`/portal/admin/cenoa?year=${data.year}&month=${data.month}&tipo=${data.tipo}&success=` + encodeURIComponent('Contenido actualizado.'));
});

router.post('/cenoa/:id/eliminar', verifyCsrf, (req, res) => {
  const items = db.cenoaContent.all();
  const target = items.find((c) => c.id === req.params.id);
  if (!target) return res.redirect('/portal/admin/cenoa?error=' + encodeURIComponent('Ese contenido no existe.'));

  db.cenoaContent.save(items.filter((c) => c.id !== req.params.id));

  res.redirect(`/portal/admin/cenoa?year=${target.year}&month=${target.month}&tipo=${target.tipo}&success=` + encodeURIComponent('Contenido eliminado.'));
});

module.exports = router;
