// api/auth/disconnect.js
// Clears the ig_token cookie, effectively logging the user out.

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Expire the cookie immediately by setting Max-Age=0
  res.setHeader('Set-Cookie', 'ig_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax');
  res.json({ success: true });
};
