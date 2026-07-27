// api/comments/[mediaId].js
// Fetches ALL comments for a given media ID (fully paginated).
// Uses a dynamic route — Vercel maps /api/comments/123 → mediaId = "123"

const fetch = require('node-fetch');
const { requireToken } = require('../_utils');

module.exports = async (req, res) => {
  const token = requireToken(req, res);
  if (!token) return;

  // Vercel dynamic route: req.query.mediaId
  const mediaId = req.query.mediaId;
  if (!mediaId) return res.status(400).json({ error: 'mediaId is required' });

  const allComments = [];
  const fields      = 'id,text,username,timestamp,like_count';
  let   url         = `https://graph.instagram.com/${mediaId}/comments?fields=${fields}&limit=100&access_token=${token}`;

  try {
    // Auto-paginate through ALL comment pages
    while (url) {
      const igRes = await fetch(url);
      const data  = await igRes.json();

      if (data.error) return res.status(400).json({ error: data.error.message });

      if (data.data && data.data.length) allComments.push(...data.data);

      // Move to next page or stop
      url = data.paging?.next || null;
    }

    res.json({ comments: allComments, total: allComments.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
