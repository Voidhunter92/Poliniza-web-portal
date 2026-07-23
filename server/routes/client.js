const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { monthLabel } = require('../dateUtils');
const { getMime, getLabel } = require('../fileTypes');

const router = express.Router();
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'reports');

function myReports(req) {
  return db.reports
    .all()
    .filter((r) => r.clientUsername === req.session.user.username)
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return (b.month || 0) - (a.month || 0);
    });
}

router.get('/', (req, res) => {
  const reports = myReports(req);
  const anuales = reports.filter((r) => r.period === 'anual');
  const mensuales = reports.filter((r) => r.period === 'mensual');

  const mensualesPorAnio = {};
  mensuales.forEach((r) => {
    mensualesPorAnio[r.year] = mensualesPorAnio[r.year] || [];
    mensualesPorAnio[r.year].push(r);
  });

  res.render('client/dashboard', {
    user: req.session.user,
    anuales,
    mensualesPorAnio,
    monthLabel,
    fileLabel: (fileName) => getLabel(path.extname(fileName || '')),
  });
});

function findOwnReport(req, res) {
  const report = db.reports.all().find((r) => r.id === req.params.id);
  if (!report || report.clientUsername !== req.session.user.username) {
    res.status(404).render('error', {
      title: 'Informe no encontrado',
      message: 'Ese informe no existe o no te pertenece.',
      user: req.session.user,
    });
    return null;
  }
  return report;
}

function streamFile(req, res, disposition) {
  const report = findOwnReport(req, res);
  if (!report) return;
  if (report.type !== 'archivo') {
    return res.status(400).render('error', { title: 'Informe inválido', message: 'Este informe no es un archivo.', user: req.session.user });
  }
  const filePath = path.join(UPLOAD_DIR, report.fileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).render('error', { title: 'Archivo no encontrado', message: 'El archivo de este informe ya no está disponible. Avisale a Poliniza.', user: req.session.user });
  }
  const ext = path.extname(report.fileName);
  const safeName = (report.originalName || `informe${ext}`).replace(/"/g, '');
  res.setHeader('Content-Type', getMime(ext));
  res.setHeader('Content-Disposition', `${disposition}; filename="${safeName}"`);
  fs.createReadStream(filePath).pipe(res);
}

router.get('/informes/:id/ver', (req, res) => streamFile(req, res, 'inline'));
router.get('/informes/:id/descargar', (req, res) => streamFile(req, res, 'attachment'));

module.exports = router;
