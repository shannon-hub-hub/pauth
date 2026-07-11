import { kv } from '@vercel/kv';

// Intentionally NOT gated by checkAuth: patients don't have the staff
// password. This route only ever returns treatment name, status, and a
// timestamp, never clinical detail. See README.md for the tradeoffs of
// using a short code as the only lookup credential.

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const code = (req.query.code || '').toString().trim().toUpperCase();
  if (!code) {
    res.status(400).json({ error: 'Missing code' });
    return;
  }

  try {
    const record = await kv.get('pa:lookup:' + code);
    if (!record) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.status(200).json(record);
  } catch (err) {
    res.status(500).json({
      error: 'Storage error. Confirm Vercel KV is connected to this project.',
      detail: err.message || String(err)
    });
  }
}
