// api/status.js
// Returns whether the user is currently connected (has a valid cookie).
// The frontend calls this on load to decide which screen to show.

const { getToken } = require('./_utils');
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  const token = getToken(req);

  if (!token) {
    return res.json({ connected: false });
  }

  // Optionally verify the token is still valid by pinging /me
  try {
    const igRes = await fetch(
      `https://graph.instagram.com/me?fields=id,username,profile_picture_url&access_token=${token}`
    );
    const data = await igRes.json();

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
