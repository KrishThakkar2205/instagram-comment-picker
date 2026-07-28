// api/status.js
// Returns whether the user is currently connected (has a valid cookie).
// The frontend calls this on load to decide which screen to show.

const { getToken, getIgAccountId } = require('./_utils');
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  const token = getToken(req);
  const igAccountId = getIgAccountId(req);

  if (!token) {
    return res.json({ connected: false });
  }

  try {
    const targetUrl = igAccountId
      ? `https://graph.facebook.com/v25.0/${igAccountId}?fields=id,username,profile_picture_url&access_token=${token}`
      : `https://graph.facebook.com/v25.0/me?fields=id,username,profile_picture_url&access_token=${token}`;

    const igRes = await fetch(targetUrl);
    const data  = await igRes.json();

    if (data.error) {
      // Token is invalid/expired — clear the cookie
      res.setHeader('Set-Cookie', 'ig_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax');
      return res.json({ connected: false, reason: data.error.message });
    }

    res.json({
      connected:           true,
      username:            data.username            || '',
      profile_picture_url: data.profile_picture_url || '',
    });
  } catch (err) {
    res.json({ connected: false, reason: err.message });
  }
};

