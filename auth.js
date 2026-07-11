// Shared staff-password check used by the clinician-facing API routes.
// This is a single shared passphrase for the whole practice, NOT per-user
// authentication. It's a stopgap to keep the app from being wide open on a
// public URL, not a substitute for real auth in a compliant deployment.
// See README.md "Security & compliance" section.
//
// Login is optional: if APP_PASSWORD isn't set, the app runs with no gate
// at all (useful for local testing or a fully internal deployment).

export function authRequired() {
  return !!(process.env.APP_PASSWORD || '');
}

export function checkAuth(req) {
  if (!authRequired()) {
    return true;
  }
  const expected = process.env.APP_PASSWORD;
  const provided = req.headers['x-app-password'] || '';
  return provided === expected;
}
