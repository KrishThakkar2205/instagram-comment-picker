# 📸 Instagram Comment Picker

Pick winners from Instagram Reel/Post comments by checking:
1. ✅ The comment contains the **correct answer** (case-insensitive)
2. ✅ The comment has **3+ distinct @mentions**

Deployed on **Vercel** — no server to manage, always online.

---

## 🔐 How the Token is Stored

```
OAuth Flow:
  Instagram → /api/auth/callback → sets HttpOnly cookie (ig_token)
                                         ↓
                              Browser stores it automatically
                                         ↓
                    Every API call sends it automatically (cookie)
                                         ↓
                     Server reads cookie, calls Instagram API
                                         ↓
                       Frontend NEVER sees the raw token
```

The token lives in an **HttpOnly Secure cookie** — it cannot be read by JavaScript, is only sent over HTTPS, and automatically expires after 60 days (matching Instagram's token lifetime).

---

## 🚀 Deployment to Vercel

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Set up environment variables in Vercel Dashboard
Go to your Vercel project → **Settings → Environment Variables** and add:

| Variable | Value |
|---|---|
| `INSTAGRAM_APP_ID` | Your Meta App ID |
| `INSTAGRAM_APP_SECRET` | Your Meta App Secret |
| `REDIRECT_URI` | `https://your-app.vercel.app/api/auth/callback` |

### 3. Deploy
```bash
cd "e:\VIdhya Group Tuition\Comment picker"
vercel --prod
```

Vercel will give you a URL like `https://comment-picker-xyz.vercel.app`

### 4. Configure Meta App
In [Meta Developers Dashboard](https://developers.facebook.com/):
- Go to your App → **Instagram → API Setup**
- Under **Valid OAuth Redirect URIs** add:
  ```
  https://your-app.vercel.app/api/auth/callback
  ```
- Required permissions: `instagram_business_basic`, `instagram_business_manage_comments`

---

## 📁 Project Structure

```
Comment picker/
├── api/                          ← Vercel Serverless Functions
│   ├── auth/
│   │   ├── instagram.js          ← GET  Redirects to Instagram OAuth
│   │   ├── callback.js           ← GET  Exchanges code → sets cookie
│   │   └── disconnect.js         ← POST Clears cookie
│   ├── comments/
│   │   └── [mediaId].js          ← GET  Fetch all comments (paginated)
│   ├── _utils.js                 ← Shared cookie helper
│   ├── me.js                     ← GET  Proxy /me
│   ├── media.js                  ← GET  Proxy /me/media
│   └── status.js                 ← GET  Check if cookie is valid
├── public/                       ← Static frontend
│   ├── index.html
│   ├── style.css
│   └── app.js
└── vercel.json
```

---

## 🏆 Filtering Logic

| Comment | Result |
|---|---|
| Correct answer ✅ + 3 distinct `@tags` ✅ | 🏆 **Winner** |
| Correct answer only | ⚠️ **Partial** |
| 3+ tags only | ⚠️ **Partial** |
| Neither | ❌ **Disqualified** |

---

## 🧪 Local Development

```bash
npm install
vercel dev        # runs Vercel serverless functions locally
```

Then open `http://localhost:3000`

> For local dev, set `REDIRECT_URI=http://localhost:3000/api/auth/callback` in your local `.env`

---

## ⚠️ Notes
- Your Instagram account must be a **Business or Creator** account
- The `ig_token` cookie expires after **60 days** — just reconnect when it expires
- For production, the cookie is `HttpOnly; Secure; SameSite=Lax` — maximum security
