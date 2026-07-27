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

module.exports = { parseCookies, getToken, requireToken };
