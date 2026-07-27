// api/auth/instagram.js
// Redirects the user to Instagram's OAuth consent screen

module.exports = (req, res) => {
  const APP_ID      = process.env.INSTAGRAM_APP_ID;
  const REDIRECT_URI = process.env.REDIRECT_URI;

  if (!APP_ID || !REDIRECT_URI) {
    return res.status(500).json({
      error: 'Server not configured. Set INSTAGRAM_APP_ID and REDIRECT_URI in Vercel environment variables.',
    });
  }

  const scopes = [
    'instagram_business_basic',
    'instagram_business_manage_messages',
    'instagram_business_manage_comments',
    'instagram_business_content_publish',
    'instagram_business_manage_insights',
  ].join(',');

  const authUrl = new URL('https://www.instagram.com/oauth/authorize');
  authUrl.searchParams.set('force_reauth',  'true');
  authUrl.searchParams.set('client_id',     APP_ID);
  authUrl.searchParams.set('redirect_uri',  REDIRECT_URI);
  authUrl.searchParams.set('scope',         scopes);
  authUrl.searchParams.set('response_type', 'code');

  res.redirect(302, authUrl.toString());
};
