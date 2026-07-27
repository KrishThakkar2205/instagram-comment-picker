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

  // Primary endpoint: Meta Graph API v20.0 (Official for Business/Creator accounts)
  let url = `https://graph.facebook.com/v20.0/${mediaId}/comments?fields=${fields}&limit=100&access_token=${token}`;

  try {
    let fetchCount = 0;
    while (url) {
      const igRes = await fetch(url);
      const data  = await igRes.json();

      console.log(`[Comments API Attempt ${++fetchCount}] URL: ${url.substring(0, 80)}... Response:`, JSON.stringify(data));

      // If graph.facebook.com returned an error, try fallback to graph.instagram.com on first page
      if (data.error && fetchCount === 1) {
        console.log('Falling back to graph.instagram.com...');
        url = `https://graph.instagram.com/${mediaId}/comments?fields=${fields}&limit=100&access_token=${token}`;
        const fallbackRes  = await fetch(url);
        const fallbackData = await fallbackRes.json();
        console.log('[Comments API Fallback Response]:', JSON.stringify(fallbackData));

        if (fallbackData.error) {
          return res.status(400).json({ error: fallbackData.error.message || 'Error fetching comments' });
        }
        if (fallbackData.data && fallbackData.data.length) {
          allComments.push(...fallbackData.data);
        }
        url = fallbackData.paging?.next || null;
        continue;
      }

      if (data.error) {
        return res.status(400).json({ error: data.error.message || 'Error fetching comments' });
      }

      if (data.data && data.data.length) {
        allComments.push(...data.data);
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
