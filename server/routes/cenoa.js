const express = require('express');
const db = require('../db');
const { verifyCsrf, ensureCsrfToken } = require('../csrf');
const { availableMonths, currentOrStartMonth, monthLabel } = require('../dateUtils');

const router = express.Router();
const ESTADOS = ['aprobado', 'desaprobado', 'revisar'];

router.get('/', (req, res) => {
  const current = currentOrStartMonth();
  const year = parseInt(req.query.year, 10) || current.year;
  const month = parseInt(req.query.month, 10) || current.month;
  const tipo = req.query.tipo === 'video' ? 'video' : 'placa';

  const items = db.cenoaContent
    .all()
    .filter((c) => c.year === year && c.month === month && c.tipo === tipo)
    .sort((a, b) => new Date(a.fechaEntrega || 0) - new Date(b.fechaEntrega || 0));

  res.render('cenoa/dashboard', {
    user: req.session.user,
    items,
    year, month, tipo,
    months: availableMonths(),
    monthLabelText: monthLabel(month, year),
    csrfToken: ensureCsrfToken(req),
  });
});

router.post('/:id/estado', verifyCsrf, (req, res) => {
  const { estado, year, month, tipo } = req.body;
  const items = db.cenoaContent.all();
  const idx = items.findIndex((c) => c.id === req.params.id);

  const back = `/portal/cenoa?year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}&tipo=${encodeURIComponent(tipo)}`;

  if (idx === -1 || !ESTADOS.includes(estado)) {
    return res.redirect(back);
  }

  items[idx].estado = estado;
  items[idx].updatedAt = new Date().toISOString();
  db.cenoaContent.save(items);

  res.redirect(back);
});

module.exports = router;
