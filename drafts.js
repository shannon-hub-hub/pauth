import { kv } from '@vercel/kv';
import { checkAuth } from '../lib/auth.js';

const DRAFTS_KEY = 'pa:drafts';

function lookupKey(code) {
  return 'pa:lookup:' + code;
}

export default async function handler(req, res) {
  if (!checkAuth(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const drafts = (await kv.get(DRAFTS_KEY)) || [];
      res.status(200).json(drafts);
      return;
    }

    if (req.method === 'POST') {
      const entry = req.body;
      if (!entry || !entry.id || !entry.referenceCode) {
        res.status(400).json({ error: 'Missing required entry fields' });
        return;
      }
      const drafts = (await kv.get(DRAFTS_KEY)) || [];
      drafts.unshift(entry);
      await kv.set(DRAFTS_KEY, drafts);

      // Seed the patient-facing lookup record at the same time.
      await kv.set(lookupKey(entry.referenceCode), {
        code: entry.referenceCode,
        treatment: entry.treatment,
        outcome: entry.outcome || 'pending',
        updatedAt: Date.now()
      });

      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === 'PATCH') {
      const { id, outcome } = req.body || {};
      if (!id || !outcome) {
        res.status(400).json({ error: 'Missing id or outcome' });
        return;
      }
      const drafts = (await kv.get(DRAFTS_KEY)) || [];
      const idx = drafts.findIndex((d) => d.id === id);
      if (idx === -1) {
        res.status(404).json({ error: 'Draft not found' });
        return;
      }
      drafts[idx].outcome = outcome;
      await kv.set(DRAFTS_KEY, drafts);

      if (drafts[idx].referenceCode) {
        await kv.set(lookupKey(drafts[idx].referenceCode), {
          code: drafts[idx].referenceCode,
          treatment: drafts[idx].treatment,
          outcome,
          updatedAt: Date.now()
        });
      }

      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) {
        res.status(400).json({ error: 'Missing id' });
        return;
      }
      const drafts = (await kv.get(DRAFTS_KEY)) || [];
      const filtered = drafts.filter((d) => d.id !== id);
      await kv.set(DRAFTS_KEY, filtered);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({
      error: 'Storage error. Confirm Vercel KV is connected to this project.',
      detail: err.message || String(err)
    });
  }
}
