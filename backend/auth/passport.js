// backend/auth/passport.js

import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

import { getUsersCollection } from '../config/mongodb.js';

// Remove MongoDB-internal migration fields before passing
// users into Passport/JWT/API code.
function cleanUser(user) {
  if (!user) return null;

  const {
    _id,
    _cosmosRid,
    ...clean
  } = user;

  return clean;
}

async function findUserByEmail(email) {
  const users = getUsersCollection();

  const user = await users.findOne(
    {
      email: String(email)
        .trim()
        .toLowerCase(),

      type: {
        $ne: 'email_lock',
      },
    },
    {
      projection: {
        _id: 0,
        _cosmosRid: 0,
      },
    }
  );

  return user || null;
}

async function findUserById(id) {
  const users = getUsersCollection();

  const user = await users.findOne(
    { id },
    {
      projection: {
        _id: 0,
        _cosmosRid: 0,
      },
    }
  );

  return user || null;
}

export const initPassport = () => {

  // ── Local Strategy (email + password) ────────────────

  passport.use(
    new LocalStrategy(
      {
        usernameField: 'email',
      },

      async (email, password, done) => {
        try {
          const user =
            await findUserByEmail(email);

          if (!user) {
            return done(
              null,
              false,
              {
                message: 'User not found',
              }
            );
          }

          if (
            user.authProvider === 'google'
          ) {
            return done(
              null,
              false,
              {
                message:
                  'Please sign in with Google',
              }
            );
          }

          const valid =
            await bcrypt.compare(
              password,
              user.passwordHash
            );

          if (!valid) {
            return done(
              null,
              false,
              {
                message: 'Wrong password',
              }
            );
          }

          return done(
            null,
            cleanUser(user)
          );

        } catch (err) {
          return done(err);
        }
      }
    )
  );


  // ── Google Strategy ──────────────────────────────────

  passport.use(
    new GoogleStrategy(
      {
        clientID:
          process.env.GOOGLE_CLIENT_ID,

        clientSecret:
          process.env.GOOGLE_CLIENT_SECRET,

        callbackURL:
          process.env.GOOGLE_CALLBACK_URL,
      },

      async (
        accessToken,
        refreshToken,
        profile,
        done
      ) => {
        try {
          const users =
            getUsersCollection();

          const email =
            profile.emails?.[0]?.value;

          if (!email) {
            return done(
              new Error(
                'Google account did not provide an email'
              )
            );
          }

          let user =
            await findUserByEmail(email);

          const googleAvatar =
            profile.photos?.[0]?.value ||
            '';

          const displayName =
            profile.displayName?.trim();


          // ── Create new Google user ────────────────────

          if (!user) {
            const newUser = {
              id: `user-${uuid()}`,

              name:
                profile.displayName ||
                email,

              email,

              authProvider:
                'google',

              googleId:
                profile.id,

              avatar:
                googleAvatar,

              progress: {},

              bookmarks: [],

              bookmarkEntries: [],

              recentQuizzes: [],

              createdAt:
                new Date().toISOString(),
            };

            await users.insertOne(
              newUser
            );

            user =
              cleanUser(newUser);
          }

          // ── Update Google profile if necessary ────────

          else if (
            user.avatar !==
              googleAvatar ||

            user.googleId !==
              profile.id ||

            (
              displayName &&
              user.name !==
                displayName
            ) ||

            !user.name
          ) {
            const profileUpdates = {
              name:
                displayName ||
                user.name ||
                profile.displayName,

              googleId:
                user.googleId ||
                profile.id,

              avatar:
                googleAvatar ||
                user.avatar ||
                '',
            };

            await users.updateOne(
              {
                id: user.id,
              },
              {
                $set:
                  profileUpdates,
              }
            );

            user = {
              ...user,
              ...profileUpdates,
            };
          }


          return done(
            null,
            cleanUser(user)
          );

        } catch (err) {
          return done(err);
        }
      }
    )
  );


  // ── Passport serialization ───────────────────────────

  passport.serializeUser(
    (user, done) => {
      done(null, user.id);
    }
  );


  passport.deserializeUser(
    async (id, done) => {
      try {
        const user =
          await findUserById(id);

        done(
          null,
          user || null
        );

      } catch (err) {
        done(err);
      }
    }
  );
};

export default passport;
