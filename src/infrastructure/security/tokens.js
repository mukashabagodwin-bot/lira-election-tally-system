const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');

let ephemeralKeys;

function loadKeyPair() {
  if (fs.existsSync(env.jwtPrivateKeyPath) && fs.existsSync(env.jwtPublicKeyPath)) {
    return {
      privateKey: fs.readFileSync(env.jwtPrivateKeyPath, 'utf8'),
      publicKey: fs.readFileSync(env.jwtPublicKeyPath, 'utf8')
    };
  }

  if (!ephemeralKeys) {
    ephemeralKeys = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
  }
  return ephemeralKeys;
}

function signApiToken(user) {
  const { privateKey } = loadKeyPair();
  return jwt.sign({ role: user.role, email: user.email }, privateKey, {
    algorithm: 'RS256',
    subject: String(user.id),
    issuer: env.jwtIssuer,
    audience: env.jwtAudience,
    expiresIn: '15m'
  });
}

function verifyApiToken(token) {
  const { publicKey } = loadKeyPair();
  return jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
    issuer: env.jwtIssuer,
    audience: env.jwtAudience
  });
}

module.exports = { signApiToken, verifyApiToken, loadKeyPair };
