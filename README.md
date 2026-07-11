# PriorAuth Draft

A prototype tool for outpatient practices that drafts prior authorization justifications, tracks whether they actually get approved, and lets patients check their own status without calling the office.

It's built as a small, self-contained web app: one frontend page and four backend functions. No framework, no build step.

---

## What it does

### 1. New Draft — turn a clinical note into a submission-ready request

A staff member enters:
- a short clinical summary (diagnosis, history, relevant exam or imaging findings)
- the treatment or procedure being requested
- what's already been tried (medications, therapy, previous procedures)
- the payer, if known

The app sends this to Claude, which returns:
- suggested **ICD-10 diagnosis codes** and **CPT/HCPCS procedure codes**
- a written **medical necessity narrative**, ready to paste into a payer portal or fax cover sheet
- a list of **documentation gaps** likely to trigger a denial, so staff can fix them before submitting
- a **confidence read** — likely approved, needs more documentation, or high risk of denial — shown as a stamp
- a short **reference code**, generated for this case, meant to be handed to the patient

Nothing here is auto-submitted anywhere. It's a draft a clinician reviews, edits, and sends themselves.

### 2. Outcomes Log — see whether the tool is actually right

Every draft is saved automatically. Once a payer responds, staff mark the case **Approved** or **Denied**. The log then shows:
- total drafts, approvals, denials, and overall approval rate
- a **calibration chart**: for each confidence level the app gave at draft time (likely approved / needs more docs / high risk of denial), what fraction of those cases were *actually* approved

That calibration view is the point, it's the evidence that the confidence stamp means something, rather than just a claim.

### 3. Patient Status — a status check with no phone call required

A patient enters the reference code they were given and sees a plain-language status: pending, approved, or denied, plus the treatment name and when it was last updated. No diagnosis, no clinical notes, nothing else. This page needs no password, since patients won't have the staff one.

---

## How it's built

The frontend (`index.html`) never talks to Anthropic directly and never holds an API key. It calls this app's own backend routes, which do the real work:

| Route | Purpose |
|---|---|
| `api/generate.js` | Calls Claude server-side to draft the justification. Holds `ANTHROPIC_API_KEY`. |
| `api/drafts.js` | Reads and writes the outcomes log (list, add, update outcome, delete). |
| `api/lookup.js` | Public: looks up a single case by reference code for the Patient Status tab. |
| `api/auth.js` | Checks the shared staff password used to unlock New Draft and Outcomes Log. |

Data (the outcomes log and patient lookup records) is stored in **Vercel KV**, a hosted key-value store, so it persists across visits and devices rather than living only in one browser.

**New Draft is always open, no login**, drafting a justification doesn't touch any stored history on its own, so there's nothing sensitive to gate. **Outcomes Log can optionally sit behind one shared password** (`APP_PASSWORD`) for the whole practice, since that's the aggregated, more sensitive view. See the compliance section below for what that gate does and doesn't protect against.

```
index.html          the whole frontend — HTML, CSS, and JS in one file
api/generate.js      drafts the justification via Claude
api/drafts.js         the outcomes log (CRUD)
api/lookup.js          public patient status lookup
api/auth.js              staff password check
lib/auth.js                 shared auth helper used by the routes above
package.json, vercel.json, .env.example, .gitignore
```

---

## Setup

### 1. Get an Anthropic API key

Create one at [console.anthropic.com](https://console.anthropic.com). Anthropic bills you directly per API call; this app adds no billing layer of its own.

### 2. Push these files to your repo and deploy on Vercel

```bash
git add -A
git commit -m "Deploy PriorAuth Draft"
git push
```

### 3. Connect a Vercel KV database

In the Vercel dashboard: your project → **Storage** tab → create a **KV** database → connect it to this project. This automatically adds the `KV_REST_API_URL`, `KV_REST_API_TOKEN`, and related variables, you don't set those by hand. Skip this and the Outcomes Log and Patient Status tabs will fail with a storage error, since there's nowhere to save anything.

### 4. Set environment variables

**Settings → Environment Variables**:

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | your key from step 1 — **required** |
| `APP_PASSWORD` | a shared passphrase for your staff, e.g. `riverside-clinic-2026` — **optional** |

`APP_PASSWORD` is optional and only ever gates the Outcomes Log (viewing history, changing outcomes). New Draft never requires it, drafting a single justification doesn't touch stored history. Patient Status also never requires a password.

See `.env.example` for reference. Apply to Production (and Preview if you use it).

### 5. Redeploy

Env var changes don't apply retroactively:

```bash
git commit --allow-empty -m "Redeploy with env vars set"
git push
```

### 6. Test all three tabs

- **New Draft**: no login needed, click "Load example," then "Draft justification."
- **Outcomes Log**: enter the staff password if you set one; the case you just drafted should be there. Mark it Approved and watch the calibration chart update.
- **Patient Status**: open in a private window (no password needed), enter the reference code from your test, confirm you see status with no clinical detail.

---

## Security & compliance — read before using real patient data

**This is not HIPAA compliant as shipped.** Specifically:

- **No Business Associate Agreement (BAA) with Anthropic is set up by this code.** Sending real PHI without one in place is a compliance violation, use de-identified or synthetic cases until a BAA is signed.
- **One shared password, only on the Outcomes Log, and off by default.** New Draft never requires it. If `APP_PASSWORD` isn't set, the Outcomes Log is also wide open to anyone with the link. Even with it set, there's no record of *which* staff member drafted or updated a case. A real deployment needs individual accounts and audit logging.
- **Reference codes are convenient, not strong secrets.** A 6-character code is guessable at scale. The lookup route limits exposure by returning only treatment name and status, never diagnosis or notes, but a production version should add a second identifier (like date of birth) before revealing anything.
- **No formal data retention or deletion policy is implemented.**
- **The narrative is a draft, not a final answer.** Nothing here technically enforces clinician review before submission; that has to be a practice process, not a feature of this code.

If real patients are in scope, treat the list above as a pre-launch checklist and loop in whoever owns compliance at your practice first.

---

## Local development

```bash
npm i -g vercel
vercel link
vercel env pull
vercel dev
```

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Site shows a 404 | `index.html` isn't at the repo root, or the deploy failed, check Vercel's deployment logs |
| "Unauthorized" with the correct password | `APP_PASSWORD` isn't set, or you haven't redeployed since setting it |
| Draft generation fails (500) | `ANTHROPIC_API_KEY` missing, invalid, or out of credits, check the `api/generate` function logs |
| Outcomes Log or Patient Status show a storage error | Vercel KV isn't connected to this project (step 3) |
| Patient Status says "not found" right after generating | Confirm the draft actually saved in the Outcomes Log first, if that's also empty, it's the same KV issue |

Live logs for any `/api/*` route are in the Vercel dashboard's **Logs** tab, the fastest way to see the real error behind a 500.
