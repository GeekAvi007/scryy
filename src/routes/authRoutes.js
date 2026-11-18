import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, isDbAvailable } from '../db/postgres.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_fallback_secret';

function signUserToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyAuthToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

router.post('/auth/register', async (req, res) => {
  if (!isDbAvailable()) {
    return res.status(503).json({ error: 'Database unavailable. Play as Guest!' });
  }

  const username = req.body?.username?.trim();
  const password = req.body?.password;

  if (!username || username.length < 2 || username.length > 16) {
    return res.status(400).json({ error: 'Username must be 2–16 characters.' });
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (username, password_hash)
       VALUES ($1, $2)
       RETURNING id, username, games_played, words_guessed, total_score`,
      [username, passwordHash]
    );

    const user = result.rows[0];
    const token = signUserToken(user);

    res.status(201).json({ token, user });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username is already registered.' });
    }
    res.status(500).json({ error: 'Registration failed.' });
  }
});

router.post('/auth/login', async (req, res) => {
  if (!isDbAvailable()) {
    return res.status(503).json({ error: 'Database unavailable. Play as Guest!' });
  }

  const username = req.body?.username?.trim();
  const password = req.body?.password;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const result = await query(
      `SELECT id, username, password_hash, games_played, words_guessed, total_score
       FROM users
       WHERE LOWER(username) = LOWER($1)`,
      [username]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = signUserToken(user);
    delete user.password_hash;

    res.json({ token, user });
  } catch {
    res.status(500).json({ error: 'Login failed.' });
  }
});

router.get('/leaderboard', async (_req, res) => {
  if (!isDbAvailable()) {
    return res.json({ leaderboard: [] });
  }

  try {
    const result = await query(
      `SELECT username, games_played, words_guessed, total_score
       FROM users
       ORDER BY total_score DESC
       LIMIT 10`
    );
    res.json({ leaderboard: result.rows });
  } catch {
    res.status(500).json({ error: 'Failed to load leaderboard.' });
  }
});

export default router;