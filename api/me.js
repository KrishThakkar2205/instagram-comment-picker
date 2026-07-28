// api/me.js
// Proxies user profile requests to Facebook / Instagram Graph API.
// Reads access token and IG Account ID from HttpOnly cookie.

const fetch = require('node-fetch');
const { requireToken, getIgAccountId } = require('./_utils');

module.exports = async (req, res) => {
  const token = requireToken(req, res);
  if (!token) return;
  const igAccountId = getIgAccountId(req);

  try {
    const targetUrl = igAccountId
      ? `https://graph.facebook.com/v25.0/${igAccountId}?fields=id,name,username,profile_picture_url&access_token=${token}`
      : `https://graph.facebook.com/v25.0/me?fields=id,name,username,profile_picture_url&access_token=${token}`;

    const igRes = await fetch(targetUrl);
    const data  = await igRes.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

