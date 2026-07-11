// Shared staff-password check used by the clinician-facing API routes.
// This is a single shared passphrase for the whole practice, NOT per-user
// authentication. It's a stopgap to keep the app from being wide open on a
// public URL, not a substitute for real auth in a compliant deployment.
// See README.md "Security & compliance" section.

export function checkAuth(req) {
  const expected = process.env.APP_PASSWORD || '';
  if (!expected) {
    // No password configured on the server. Fail closed rather than open,
    // so a missing env var doesn't accidentally leave the app unprotected.
    return false;
  }
  const provided = req.headers['x-app-password'] || '';
  return provided === expected;
}
