// api/auth/callback.js
// Handles Instagram's OAuth redirect, exchanges code for a long-lived token,
// then sets a secure HttpOnly cookie and redirects back to the app.

const fetch = require('node-fetch');

const COOKIE_NAME = 'ig_token';
const SIXTY_DAYS  = 60 * 24 * 60 * 60; // seconds

module.exports = async (req, res) => {
  const APP_ID       = process.env.INSTAGRAM_APP_ID;
  const APP_SECRET   = process.env.INSTAGRAM_APP_SECRET;
  const REDIRECT_URI = process.env.REDIRECT_URI;

  const { code, error, error_description } = req.query;

  // ── Instagram returned an error (user denied, etc.) ──────────────────────────
  if (error) {
    const msg = encodeURIComponent(error_description || error || 'Authorization denied');
    return res.redirect(302, `/?auth=error&msg=${msg}`);
  }

  if (!code) {
    return res.redirect(302, '/?auth=error&msg=No+authorization+code+received');
  }

  try {
    // ── Step 1: Exchange code → short-lived access token (1 hour) ────────────
    const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        client_id:     APP_ID,
        client_secret: APP_SECRET,
        grant_type:    'authorization_code',
        redirect_uri:  REDIRECT_URI,
        code,
      }),
    });
    const tokenData = await tokenRes.json();

    if (tokenData.error_type || tokenData.error_message || tokenData.error) {
      throw new Error(tokenData.error_message || tokenData.error?.message || 'Token exchange failed');
    }

    const shortLivedToken = tokenData.access_token;

    // ── Step 2: Upgrade → long-lived token (60 days) ─────────────────────────
    const longRes = await fetch(
      `https://graph.instagram.com/access_token` +
      `?grant_type=ig_exchange_token` +
      `&client_secret=${APP_SECRET}` +
      `&access_token=${shortLivedToken}`
    );
    const longData = await longRes.json();

    if (longData.error) throw new Error(longData.error.message);

    const longLivedToken = longData.access_token;
    const expiresIn      = longData.expires_in || SIXTY_DAYS; // seconds

    // ── Step 3: Fetch basic user info (to display in the UI) ─────────────────
    const meRes  = await fetch(
      `https://graph.instagram.com/me` +
      `?fields=id,name,username,profile_picture_url` +
      `&access_token=${longLivedToken}`
    );
    const meData = await meRes.json();

    // ── Step 4: Set HttpOnly cookie ───────────────────────────────────────────
    // HttpOnly  → JS cannot read the token (XSS safe)
    // Secure    → only sent over HTTPS
    // SameSite  → prevents CSRF
    const cookieValue = [
      `${COOKIE_NAME}=${longLivedToken}`,
      `Max-Age=${expiresIn}`,
      `Path=/`,
      `HttpOnly`,
      `Secure`,
      `SameSite=Lax`,
    ].join('; ');

    res.setHeader('Set-Cookie', cookieValue);

    // ── Step 5: Pass non-sensitive user info via URL params to the frontend ───
    const username = encodeURIComponent(meData.username || '');
    const name     = encodeURIComponent(meData.name     || '');
    const avatar   = encodeURIComponent(meData.profile_picture_url || '');
    const expiry   = encodeURIComponent(new Date(Date.now() + expiresIn * 1000).toISOString());

    console.log(`✅ Connected: @${meData.username} | Expires: ${new Date(Date.now() + expiresIn * 1000).toISOString()}`);

    res.redirect(302, `/?auth=success&username=${username}&name=${name}&avatar=${avatar}&expiry=${expiry}`);

  } catch (err) {
    console.error('OAuth callback error:', err.message);
    const msg = encodeURIComponent(err.message);
    res.redirect(302, `/?auth=error&msg=${msg}`);
  }
};
