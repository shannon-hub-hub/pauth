import { checkAuth } from '../lib/auth.js';

const SYSTEM_PROMPT = `You are a clinical documentation assistant that drafts prior authorization justifications for outpatient practices. You are careful, conservative, and never invent clinical facts that were not provided. Respond with ONLY a raw JSON object (no markdown fences, no preamble) matching exactly this shape:
{
  "icd10": [{"code": "string", "label": "string"}],
  "cpt": [{"code": "string", "label": "string"}],
  "narrative": "a 2-4 paragraph medical necessity narrative written in professional clinical language, suitable to paste into a prior auth submission",
  "missing_documentation": ["short phrases describing documentation gaps that could cause a denial; empty array if none"],
  "confidence": "high | medium | low",
  "confidence_reasoning": "one sentence explaining the confidence level"
}
Base codes and reasoning only on the information given. If information is insufficient for a code, omit it rather than guessing.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!checkAuth(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { summary, treatment, prior, payer } = req.body || {};
  if (!summary || !treatment) {
    res.status(400).json({ error: 'Missing clinical summary or requested treatment' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY. Set it in Vercel project settings and redeploy.' });
    return;
  }

  const userMsg = `Clinical summary:\n${summary}\n\nRequested treatment/procedure:\n${treatment}\n\nPrior treatments already tried:\n${prior || 'None provided'}\n\nPayer:\n${payer || 'Not specified'}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMsg }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(502).json({ error: `Anthropic API returned ${response.status}`, detail: errText });
      return;
    }

    const data = await response.json();
    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/```\s*$/, '');

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      res.status(502).json({ error: 'Could not parse the model response as JSON', raw: text });
      return;
    }

    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unknown server error' });
  }
}
