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
 * Get the ig_token from the HttpOnly cookie.
 * Returns the token string or null.
 */
function getToken(req) {
  const cookies = parseCookies(req);
  return cookies['ig_token'] || null;
}

/**
 * Return a 401 JSON response if no token is present.
 * Returns true if the check failed (caller should return immediately).
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

module.exports = { parseCookies, getToken, requireToken, getRedirectUri };
