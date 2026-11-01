import {
  createPrivateKey,
  createPublicKey,
} from 'node:crypto';

import jwt from 'jsonwebtoken';

const TOKEN_TTL_SECONDS = 5 * 60;

function getConfig() {
  const issuer = process.env.CONVEX_JWT_ISSUER?.replace(/\/+$/, '');
  const audience = process.env.CONVEX_JWT_AUDIENCE || 'meow-convex';
  const keyId = process.env.CONVEX_JWT_KEY_ID;
  const privateKeyBase64 = process.env.CONVEX_JWT_PRIVATE_KEY_B64;

  if (!issuer || !keyId || !privateKeyBase64) {
    const error = new Error('Convex JWT configuration is incomplete');
    error.statusCode = 503;
    throw error;
  }

  if (!issuer.startsWith('https://')) {
    const error = new Error('Convex JWT issuer must use HTTPS');
    error.statusCode = 503;
    throw error;
  }

  const privateKeyPem = Buffer
    .from(privateKeyBase64, 'base64')
    .toString('utf8');

  const privateKey = createPrivateKey(privateKeyPem);

  if (
    privateKey.asymmetricKeyType !== 'ec' ||
    privateKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1'
  ) {
    throw new Error('Convex JWT requires an EC P-256 private key');
  }

  return {
    issuer,
    audience,
    keyId,
    privateKey,
  };
}

export function getConvexJwks() {
  const { privateKey, keyId } = getConfig();

  const publicKey = createPublicKey(privateKey);
  const jwk = publicKey.export({ format: 'jwk' });

  return {
    keys: [
      {
        kty: 'EC',
        crv: 'P-256',
        x: jwk.x,
        y: jwk.y,
        use: 'sig',
        key_ops: ['verify'],
        alg: 'ES256',
        kid: keyId,
      },
    ],
  };
}

export function createConvexToken(user) {
  if (!user?.id) {
    const error = new Error('Authenticated user ID is required');
    error.statusCode = 401;
    throw error;
  }

  const {
    issuer,
    audience,
    keyId,
    privateKey,
  } = getConfig();

  return jwt.sign(
    {
      ...(user.email ? { email: user.email } : {}),
      ...(user.name ? { name: user.name } : {}),
    },
    privateKey,
    {
      algorithm: 'ES256',
      keyid: keyId,
      issuer,
      audience,
      subject: String(user.id),
      expiresIn: TOKEN_TTL_SECONDS,
    }
  );
}

export const CONVEX_TOKEN_TTL_SECONDS = TOKEN_TTL_SECONDS;
