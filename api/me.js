// api/me.js
// Proxies GET /me to the Instagram Graph API.
// Reads the access token from the HttpOnly cookie set during OAuth.

const fetch = require('node-fetch');
const { requireToken } = require('./_utils');

module.exports = async (req, res) => {
  const token = requireToken(req, res);
  if (!token) return;

  try {
    const igRes = await fetch(
      `https://graph.instagram.com/me?fields=id,name,username,profile_picture_url&access_token=${token}`
    );
    const data = await igRes.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
