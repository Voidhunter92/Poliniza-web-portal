const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const START_YEAR = 2026;
const START_MONTH = 7; // Julio 2026, arranque del dashboard de CENOA

// Lista de {year, month} desde julio 2026 hasta 6 meses después del mes actual,
// para que el selector siempre tenga margen hacia adelante sin hardcodear una fecha límite.
function availableMonths() {
  const now = new Date();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth() + 1 + 6; // 6 meses de margen

  const months = [];
  let y = START_YEAR;
  let m = START_MONTH;
  let normalizedEndYear = endYear + Math.floor((endMonth - 1) / 12);
  let normalizedEndMonth = ((endMonth - 1) % 12) + 1;

  while (y < normalizedEndYear || (y === normalizedEndYear && m <= normalizedEndMonth)) {
    months.push({ year: y, month: m, label: `${MESES[m - 1]} ${y}` });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}

function currentOrStartMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (y < START_YEAR || (y === START_YEAR && m < START_MONTH)) {
    return { year: START_YEAR, month: START_MONTH };
  }
  return { year: y, month: m };
}

function monthLabel(month, year) {
  return `${MESES[(month - 1 + 12) % 12]} ${year}`;
}

module.exports = { MESES, START_YEAR, START_MONTH, availableMonths, currentOrStartMonth, monthLabel };
