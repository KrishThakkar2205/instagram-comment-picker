// api/media.js
// Proxies GET /me/media to Instagram Graph API.
// Supports ?after= for pagination.

const fetch = require('node-fetch');
const { requireToken } = require('./_utils');

module.exports = async (req, res) => {
  const token = requireToken(req, res);
  if (!token) return;

  const { after } = req.query;

  const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';
  let url = `https://graph.instagram.com/me/media?fields=${fields}&limit=20&access_token=${token}`;
  if (after) url += `&after=${encodeURIComponent(after)}`;

  try {
    const igRes = await fetch(url);
    const data  = await igRes.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
