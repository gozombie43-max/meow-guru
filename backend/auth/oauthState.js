import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { saveOAuthState, consumeOAuthState } from '../repositories/oauthStateRepository.js';

const cookieName = 'oauthState';
const ttl = 10 * 60 * 1000;
const options = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
const hash = value => createHash('sha256').update(value).digest('hex');

// Passport's custom state store works without express-session and across instances.
export const oauthStateStore = {
  store(req, done) {
    const state = randomBytes(32).toString('hex');
    saveOAuthState(hash(state), new Date(Date.now() + ttl)).then(() => {
      req.res.cookie(cookieName, state, { ...options(), maxAge: ttl });
      done(null, state);
    }, done);
  },
  verify(req, state, done) {
    const cookie = req.cookies?.[cookieName];
    req.res.clearCookie(cookieName, options());
    if (typeof state !== 'string' || !/^[a-f0-9]{64}$/.test(state)
      || typeof cookie !== 'string' || !/^[a-f0-9]{64}$/.test(cookie)
      || !timingSafeEqual(Buffer.from(state), Buffer.from(cookie))) {
      return done(null, false, { message: 'Invalid OAuth state' });
    }
    consumeOAuthState(hash(state)).then(valid => done(null, valid, { message: 'Invalid or expired OAuth state' }), done);
  },
};
