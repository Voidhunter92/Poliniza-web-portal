// Crea las cuentas iniciales (admin, PAR Equipamientos, CENOA) la primera
// vez que corre el servidor. Si ya existen usuarios, no hace nada.
const db = require('./db');
const { hashPassword } = require('./auth');
const { makeId } = require('./ids');

function seedIfEmpty() {
  const users = db.users.all();
  if (users.length > 0) {
    return { seeded: false, count: users.length };
  }

  const now = new Date().toISOString();
  const initial = [
    {
      id: makeId(),
      username: 'admin',
      passwordHash: hashPassword('Poliniza.Marketing.333'),
      role: 'admin',
      displayName: 'Administrador',
      createdAt: now,
    },
    {
      id: makeId(),
      username: 'parequipamientos',
      passwordHash: hashPassword('par2026'),
      role: 'client',
      displayName: 'PAR Equipamientos',
      createdAt: now,
    },
    {
      id: makeId(),
      username: 'cenoa',
      passwordHash: hashPassword('cenoa2026'),
      role: 'cenoa',
      displayName: 'CENOA',
      createdAt: now,
    },
  ];

  db.users.save(initial);
  return { seeded: true, count: initial.length };
}

if (require.main === module) {
  const result = seedIfEmpty();
  if (result.seeded) {
    console.log('Cuentas iniciales creadas: admin, parequipamientos, cenoa');
  } else {
    console.log(`Ya existen ${result.count} usuarios. No se volvió a sembrar.`);
  }
}

module.exports = { seedIfEmpty };
