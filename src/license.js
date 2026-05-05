// Checks whether the current user has active access (trial or subscription).
// Reads from the cached auth status written by background.js every 15 minutes.
// The cache TTL controls when background.js re-verifies, not whether the user can act.
// A stale cache still reflects the last known good status — don't block on staleness.
export async function isLicensed() {
  const { authStatus } = await chrome.storage.local.get('authStatus');
  if (!authStatus) return false;
  return authStatus.allowed === true;
}
