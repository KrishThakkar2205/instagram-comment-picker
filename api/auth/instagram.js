// api/auth/instagram.js
// Redirects the user to Facebook Login for Business consent screen for Instagram onboarding

const { getRedirectUri } = require('../_utils');

module.exports = (req, res) => {
  const APP_ID       = process.env.INSTAGRAM_APP_ID;
  const REDIRECT_URI = getRedirectUri(req);

  if (!APP_ID) {
    return res.status(500).json({
      error: 'Server not configured. Set INSTAGRAM_APP_ID in environment variables.',
    });
  }

  const scopes = [
    'instagram_basic',
    'instagram_content_publish',
    'instagram_manage_comments',
    'instagram_manage_insights',
    'pages_show_list',
    'pages_read_engagement',
  ].join(',');

  const extras = JSON.stringify({ setup: { channel: 'IG_API_ONBOARDING' } });

  const authUrl = new URL('https://www.facebook.com/v25.0/dialog/oauth');
  authUrl.searchParams.set('client_id',     APP_ID);
  authUrl.searchParams.set('display',       'page');
  authUrl.searchParams.set('extras',        extras);
  authUrl.searchParams.set('redirect_uri',  REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope',         scopes);

  res.redirect(302, authUrl.toString());
};

