// backend/auth/passport.js
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

let usersContainer; // injected after DB init

export const initPassport = (container) => {
  usersContainer = container;

  // ── Local Strategy (email + password) ──────────────────
  passport.use(new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
      try {
        const { resources } = await usersContainer.items
          .query({
            query: 'SELECT * FROM c WHERE c.email = @email',
            parameters: [{ name: '@email', value: email }],
          })
          .fetchAll();

        const user = resources[0];
        if (!user) return done(null, false, { message: 'User not found' });
        if (user.authProvider === 'google')
          return done(null, false, { message: 'Please sign in with Google' });

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return done(null, false, { message: 'Wrong password' });

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  ));

  // ── Google Strategy ─────────────────────────────────────
  passport.use(new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;

        // Check if user exists
        const { resources } = await usersContainer.items
          .query({
            query: 'SELECT * FROM c WHERE c.email = @email',
            parameters: [{ name: '@email', value: email }],
          })
          .fetchAll();

        let user = resources[0];
        const googleAvatar = profile.photos?.[0]?.value || '';
        const displayName = profile.displayName?.trim();

        // Create if new
        if (!user) {
          user = {
            id:           `user-${uuid()}`,
            name:         profile.displayName,
            email,
            authProvider: 'google',
            googleId:     profile.id,
            avatar:       googleAvatar,
            progress:     {},
            bookmarks:    [],
            bookmarkEntries: [],
            recentQuizzes: [],
            createdAt:    new Date().toISOString(),
          };
          await usersContainer.items.create(user);
        } else if (
          user.avatar !== googleAvatar ||
          user.googleId !== profile.id ||
          (displayName && user.name !== displayName) ||
          !user.name
        ) {
          user = {
            ...user,
            name: displayName || user.name || profile.displayName,
            googleId: user.googleId || profile.id,
            avatar: googleAvatar || user.avatar || '',
          };
          await usersContainer.items.upsert(user);
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  ));

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const { resources } = await usersContainer.items
        .query({
          query: 'SELECT * FROM c WHERE c.id = @id',
          parameters: [{ name: '@id', value: id }],
        })
        .fetchAll();
      done(null, resources[0] || null);
    } catch (err) {
      done(err);
    }
  });
};

export default passport;
