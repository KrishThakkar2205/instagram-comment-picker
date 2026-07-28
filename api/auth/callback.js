// api/auth/callback.js
// Handles Facebook Login for Business OAuth redirect, exchanges code for long-lived User Access Token,
// retrieves connected Instagram Business Account, sets HttpOnly cookie, and redirects back to app.

const fetch = require('node-fetch');
const { getRedirectUri } = require('../_utils');

const COOKIE_NAME = 'ig_token';
const SIXTY_DAYS  = 60 * 24 * 60 * 60; // seconds

module.exports = async (req, res) => {
  const APP_ID       = process.env.INSTAGRAM_APP_ID;
  const APP_SECRET   = process.env.INSTAGRAM_APP_SECRET;
  const REDIRECT_URI = getRedirectUri(req);

  const { code, error, error_description } = req.query;

  // ── User denied or Meta returned an error ────────────────────────────────────
  if (error) {
    const msg = encodeURIComponent(error_description || error || 'Authorization denied');
    return res.redirect(302, `/?auth=error&msg=${msg}`);
  }

  if (!code) {
    return res.redirect(302, '/?auth=error&msg=No+authorization+code+received');
  }

  try {
    // ── Step 1: Exchange code → User access token ──────────────────────────────
    const tokenRes = await fetch(
      `https://graph.facebook.com/v25.0/oauth/access_token` +
      `?client_id=${APP_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&client_secret=${APP_SECRET}` +
      `&code=${code}`
    );
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      throw new Error(tokenData.error.message || 'Token exchange failed');
    }

    const shortLivedToken = tokenData.access_token;

    // ── Step 2: Exchange for long-lived User access token (~60 days) ───────────
    const longRes = await fetch(
      `https://graph.facebook.com/v25.0/oauth/access_token` +
      `?grant_type=fb_exchange_token` +
      `&client_id=${APP_ID}` +
      `&client_secret=${APP_SECRET}` +
      `&fb_exchange_token=${shortLivedToken}`
    );
    const longData = await longRes.json();

    const longLivedToken = longData.access_token || shortLivedToken;
    const expiresIn      = longData.expires_in || SIXTY_DAYS;

    // ── Step 3: Fetch Pages and connected Instagram Business Account ──────────
    const pagesRes = await fetch(
      `https://graph.facebook.com/v25.0/me/accounts` +
      `?fields=id,name,access_token,instagram_business_account` +
      `&access_token=${longLivedToken}`
    );
    const pagesData = await pagesRes.json();

    if (pagesData.error) {
      throw new Error(pagesData.error.message || 'Failed to fetch Facebook pages');
    }

    const pages = pagesData.data || [];
    const connectedPage = pages.find(p => p.instagram_business_account && p.instagram_business_account.id);

    if (!connectedPage) {
      throw new Error(
        'No Facebook Page connected to an Instagram Business account was found. ' +
        'Please ensure your Instagram account is converted to a Professional account and connected to a Facebook Page.'
      );
    }

    const igAccountId = connectedPage.instagram_business_account.id;

    // ── Step 4: Fetch Instagram Profile Info ───────────────────────────────────
    let meData = {};
    try {
      const meRes = await fetch(
        `https://graph.facebook.com/v25.0/${igAccountId}` +
        `?fields=id,name,username,profile_picture_url` +
        `&access_token=${longLivedToken}`
      );
      meData = await meRes.json();
    } catch { /* ignore profile fetch errors */ }

    // ── Step 5: Set HttpOnly Cookie (token|ig_account_id) ──────────────────────
    const cookiePayload = encodeURIComponent(`${longLivedToken}|${igAccountId}`);
    const cookieValue = [
      `${COOKIE_NAME}=${cookiePayload}`,
      `Max-Age=${expiresIn}`,
      `Path=/`,
      `HttpOnly`,
      `Secure`,
      `SameSite=Lax`,
    ].join('; ');

    res.setHeader('Set-Cookie', cookieValue);

    // ── Step 6: Pass user info via URL params to frontend ─────────────────────
    const username = encodeURIComponent(meData.username || '');
    const name     = encodeURIComponent(meData.name     || connectedPage.name || '');
    const avatar   = encodeURIComponent(meData.profile_picture_url || '');
    const expiry   = encodeURIComponent(new Date(Date.now() + expiresIn * 1000).toISOString());

    console.log(`✅ Connected Instagram Business Account @${meData.username || igAccountId} via Facebook Page "${connectedPage.name}"`);

    res.redirect(302, `/?auth=success&username=${username}&name=${name}&avatar=${avatar}&expiry=${expiry}`);

  } catch (err) {
    console.error('OAuth callback error:', err.message);
    const msg = encodeURIComponent(err.message);
    res.redirect(302, `/?auth=error&msg=${msg}`);
  }
};

