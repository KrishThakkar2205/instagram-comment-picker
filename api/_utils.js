// api/_utils.js
// Shared helpers used across all serverless functions

/**
 * Parse cookies from request headers manually (no external dependency needed).
 * Returns an object { cookieName: cookieValue }
 */
function parseCookies(req) {
  const cookieHeader = req.headers.cookie || '';
  const cookies = {};
  cookieHeader.split(';').forEach(part => {
    const [key, ...val] = part.trim().split('=');
    if (key) cookies[key.trim()] = decodeURIComponent(val.join('=').trim());
  });
  return cookies;
}

/**
 * Get the access token from the HttpOnly cookie.
 * Supports "token" or "token|ig_account_id" format.
 * Returns the token string or null.
 */
function getToken(req) {
  const cookies = parseCookies(req);
  const raw = cookies['ig_token'] || '';
  if (!raw) return null;
  const [token] = raw.split('|');
  return token || null;
}

/**
 * Get the Instagram Business Account ID from the HttpOnly cookie.
 * Returns the account ID string or null.
 */
function getIgAccountId(req) {
  const cookies = parseCookies(req);
  const raw = cookies['ig_token'] || '';
  if (!raw) return null;
  const parts = raw.split('|');
  return parts[1] || null;
}

/**
 * Return a 401 JSON response if no token is present.
 * Returns token if check passed, null if failed (caller should return immediately).
 */
function requireToken(req, res) {
  const token = getToken(req);
  if (!token) {
    res.status(401).json({ error: 'Not connected to Instagram. Please reconnect.' });
    return null;
  }
  return token;
}

/**
 * Get the exact REDIRECT_URI for Instagram OAuth.
 * Uses process.env.REDIRECT_URI if defined, otherwise falls back to current request host.
 */
function getRedirectUri(req) {
  if (process.env.REDIRECT_URI) {
    return process.env.REDIRECT_URI.trim().replace(/^["']|["']$/g, '').replace(/\/$/, '');
  }
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  const proto = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}/api/auth/callback`;
}

module.exports = { parseCookies, getToken, getIgAccountId, requireToken, getRedirectUri };

