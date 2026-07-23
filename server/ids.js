const crypto = require('crypto');

function makeId() {
  return crypto.randomBytes(8).toString('hex');
}

module.exports = { makeId };
