import { checkAuth, authRequired } from '../lib/auth.js';

export default function handler(req, res) {
  if (req.method === 'GET') {
    res.status(200).json({ required: authRequired() });
    return;
  }
  if (req.method === 'POST') {
    res.status(200).json({ ok: checkAuth(req) });
    return;
  }
  res.status(405).json({ error: 'Method not allowed' });
}
