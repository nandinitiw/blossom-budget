// Optional sign-up allowlist. Set ALLOWED_SIGNUP_EMAILS in the environment to a
// comma-separated list of addresses to restrict who can create an account
// (e.g. keep a personal deployment single-user). Leave it unset/empty to allow
// open registration.
//
// This gates *new account creation* only. Existing users can always sign in.
export function signupAllowed(email: string): boolean {
  const raw = process.env.ALLOWED_SIGNUP_EMAILS?.trim();
  if (!raw) return true; // no allowlist configured → open signup

  const allowed = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return true;

  return allowed.includes(email.trim().toLowerCase());
}
