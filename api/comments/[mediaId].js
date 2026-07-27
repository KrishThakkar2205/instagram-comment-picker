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
  const fields      = 'id,text,username,from,timestamp,like_count';

  // Endpoint: graph.instagram.com (Required for Instagram Business Login Access Tokens)
  let url = `https://graph.instagram.com/v25.0/${mediaId}/comments?fields=${fields}&limit=100&access_token=${token}`;

  try {
    let fetchCount = 0;
    while (url) {
      const igRes = await fetch(url);
      const data  = await igRes.json();

      console.log(`[Comments API Fetch ${++fetchCount}] URL: ${url.substring(0, 80)}... Data Count: ${data.data ? data.data.length : 0}`);

      if (data.error) {
        console.error('Comments API Error:', data.error);
        return res.status(400).json({ error: data.error.message || 'Error fetching comments' });
      }

      if (data.data && data.data.length) {
        const normalized = data.data.map(item => ({
          id:         item.id,
          text:       item.text,
          username:   item.username || item.from?.username || '',
          timestamp:  item.timestamp,
          like_count: item.like_count,
        }));
        allComments.push(...normalized);
      }

      // Move to next page or stop
      url = data.paging?.next || null;
    }

    res.json({ comments: allComments, total: allComments.length });
  } catch (err) {
    console.error('Server comments error:', err);
    res.status(500).json({ error: err.message });
  }
};
