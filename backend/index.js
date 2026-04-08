// backend/index.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import passport from './auth/passport.js';
import { initPassport } from './auth/passport.js';
import { initDB, initUsersDB } from './cosmos.js';
import { initAuthRoutes } from './routes/auth.routes.js';
import { initUserRoutes } from './routes/user.routes.js';
import questionRoutes from './routes/questionRoutes.js';    // ← replaces createRequire block

const app = express();
const isProd = process.env.NODE_ENV === 'production';
app.set('trust proxy', 1);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Middleware ──────────────────────────────────────────
app.use(express.json());

const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://localhost:5000',
  'https://brave-island-0a237e400.6.azurestaticapps.net',
]);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.has(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(session({
  secret:            process.env.SESSION_SECRET,
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge:   24 * 60 * 60 * 1000,
  },
}));

app.use(passport.initialize());
app.use('/api/questions', questionRoutes);

// ── Init DB + Routes ────────────────────────────────────
(async () => {
  try {
    const questionsContainer = await initDB();
    console.log('Questions DB Connected ✅');

    const usersContainer = await initUsersDB();
    console.log('Users DB Connected ✅');

    initPassport(usersContainer);

    app.use('/auth',  initAuthRoutes(usersContainer));
    app.use('/users', initUserRoutes(usersContainer));

    app.get('/', (req, res) => res.send('Server running 🚀'));

    app.post('/questions', async (req, res) => {
      try {
        const newItem = { id: Date.now().toString(), ...req.body };
        await questionsContainer.items.create(newItem);
        res.json({ message: 'Question added ✅', data: newItem });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.get('/questions', async (req, res) => {
      try {
        const category = req.query.category;
        const querySpec = category
          ? {
              query:      'SELECT * FROM c WHERE c.category = @category',
              parameters: [{ name: '@category', value: category }],
            }
          : { query: 'SELECT * FROM c' };

        const { resources } = await questionsContainer.items
          .query(querySpec)
          .fetchAll();
        res.json(resources);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`));

  } catch (err) {
    console.error('Startup error ❌', err.message);
    process.exit(1);
  }
})();