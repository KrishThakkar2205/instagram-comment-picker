/* ════════════════════════════════════════════════════════════════════════════
   Instagram Comment Picker — app.js  (Vercel Edition)
   Token stored in HttpOnly cookie (server-side only).
   Frontend reads user info from URL params after OAuth redirect.
   ════════════════════════════════════════════════════════════════════════════ */

'use strict';

// ── App State ──────────────────────────────────────────────────────────────────
const appState = {
  isConnected:      false,
  user:             null,          // { username, profile_picture_url }
  mediaItems:       [],
  mediaAfterCursor: null,
  mediaFilter:      'ALL',
  selectedMedia:    null,
  allComments:      [],
  filteredResults:  { winners: [], partial: [], disqualified: [] },
  currentTab:       'winners',
};

const $ = id => document.getElementById(id);

// ════════════════════════════════════════════════════════════════════════════
//  BOOT
// ════════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  const authResult = handleOAuthRedirect();  // read URL params first
  await checkConnectionStatus(authResult);   // then verify cookie with server
});

// ── Read ?auth= params from Instagram OAuth redirect ──────────────────────────
function handleOAuthRedirect() {
  const params   = new URLSearchParams(window.location.search);
  const auth     = params.get('auth');
  if (!auth) return null;

  // Clean URL immediately so refresh doesn't re-trigger
  window.history.replaceState({}, '', '/');

  if (auth === 'success') {
    // Non-sensitive user info passed via URL (token is in the cookie, never in URL)
    return {
      type:     'success',
      username: decodeURIComponent(params.get('username') || ''),
      name:     decodeURIComponent(params.get('name')     || ''),
      avatar:   decodeURIComponent(params.get('avatar')   || ''),
      expiry:   decodeURIComponent(params.get('expiry')   || ''),
    };
  }

  if (auth === 'error') {
    return {
      type: 'error',
      msg:  decodeURIComponent(params.get('msg') || 'Unknown error'),
    };
  }
  return null;
}

// ── Ask server if the cookie is valid ────────────────────────────────────────
async function checkConnectionStatus(authResult) {
  // Show error alert right away if OAuth failed
  if (authResult?.type === 'error') {
    showAuthAlert('error', `❌ Connection failed: ${authResult.msg}`);
    showSection('connect');
    return;
  }

  try {
    const res  = await fetch('/api/status');
    const data = await res.json();

    if (data.connected) {
      // Prefer data from fresh OAuth redirect (has avatar URL), fall back to /api/status
      const user = authResult?.type === 'success'
        ? { username: authResult.username, profile_picture_url: authResult.avatar, expiry: authResult.expiry }
        : { username: data.username, profile_picture_url: data.profile_picture_url, expiry: '' };

      appState.isConnected = true;
      appState.user        = user;

      showConnectedState(user);
      updateHeaderBadge(user);

      if (authResult?.type === 'success') {
        showAuthAlert('success', `✅ Connected as @${user.username}! Welcome.`);
      }

      showSection('connect'); // shows the connected card
    } else {
      appState.isConnected = false;
      showSection('connect');
      if (data.reason) showAuthAlert('error', `⚠️ ${data.reason}`);
    }
  } catch {
    showToast('Cannot reach server', 'error');
    showSection('connect');
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  CONNECTED / DISCONNECTED STATE
// ════════════════════════════════════════════════════════════════════════════
function showConnectedState(user) {
  $('connectedCard')?.classList.remove('hidden');
  $('loginCard')?.classList.add('hidden');

  if ($('connectedUsername')) $('connectedUsername').textContent = `@${user.username}`;

  if (user.expiry && $('connectedExpiry')) {
    const d = Math.ceil((new Date(user.expiry) - Date.now()) / 86400000);
    $('connectedExpiry').textContent = d > 0 ? `Token valid for ${d} more day${d !== 1 ? 's' : ''}` : '⚠️ Token expired';
  }

  if (user.profile_picture_url) {
    const img = $('connectedAvatarImg');
    if (img) {
      img.src = user.profile_picture_url;
      img.classList.remove('hidden');
      $('connectedAvatarFallback')?.classList.add('hidden');
      img.onerror = () => { img.classList.add('hidden'); $('connectedAvatarFallback')?.classList.remove('hidden'); };
    }
  }

  $('goMediaBtn')?.classList.remove('hidden');
}

function updateHeaderBadge(user) {
  const badge = $('userBadge');
  if (!badge || !user?.username) return;
  badge.classList.remove('hidden');
  if ($('userUsername')) $('userUsername').textContent = `@${user.username}`;

  if (user.expiry && $('tokenExpiry')) {
    const d = Math.ceil((new Date(user.expiry) - Date.now()) / 86400000);
    $('tokenExpiry').textContent = d > 0 ? `${d}d left` : 'Expired';
  }

  if (user.profile_picture_url) {
    const img = $('userAvatar');
    if (img) {
      img.src = user.profile_picture_url;
      img.classList.remove('hidden');
      $('userAvatarFallback')?.classList.add('hidden');
      img.onerror = () => { img.classList.add('hidden'); $('userAvatarFallback')?.classList.remove('hidden'); };
    }
  }
}

async function disconnectAccount() {
  if (!confirm('Disconnect your Instagram account?')) return;
  try {
    await fetch('/api/auth/disconnect', { method: 'POST' });
  } catch { /* ignore */ }

  appState.isConnected = false;
  appState.user = null;

  $('connectedCard')?.classList.add('hidden');
  $('loginCard')?.classList.remove('hidden');
  $('userBadge')?.classList.add('hidden');
  $('goMediaBtn')?.classList.add('hidden');

  showSection('connect');
  showToast('Disconnected successfully', 'success');
}

// ════════════════════════════════════════════════════════════════════════════
//  NAVIGATION
// ════════════════════════════════════════════════════════════════════════════
function showSection(name) {
  if ((name === 'media' || name === 'picker') && !appState.isConnected) {
    showToast('Please connect your Instagram account first', 'error');
    return;
  }

  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  $(`section-${name}`)?.classList.add('active');

  const stepMap = { connect: 1, media: 2, picker: 3 };
  setStepActive(stepMap[name] || 1);

  if (name === 'media' && appState.mediaItems.length === 0) loadMedia();
}

function setStepActive(index) {
  ['step1','step2','step3','step4'].forEach((id, i) => {
    const s = $(id);
    if (!s) return;
    const n = i + 1;
    s.classList.remove('active','completed');
    if (n < index) s.classList.add('completed');
    else if (n === index) s.classList.add('active');
  });
}

function showAuthAlert(type, msg) {
  const el = $('authAlert');
  if (!el) return;
  el.className = `auth-alert ${type}`;
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ════════════════════════════════════════════════════════════════════════════
//  MEDIA LOADING
// ════════════════════════════════════════════════════════════════════════════
async function loadMedia(after = null) {
  const grid = $('mediaGrid');
  if (!after) {
    appState.mediaItems = [];
    appState.mediaAfterCursor = null;
    grid.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading your media…</p></div>`;
  }

  try {
    const url = after ? `/api/media?after=${after}` : '/api/media';
    const res  = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401) { showToast('Session expired — please reconnect', 'error'); showSection('connect'); return; }
      throw new Error(data.error || 'Failed to load media');
    }

    appState.mediaItems.push(...(data.data || []));
    appState.mediaAfterCursor = data.paging?.cursors?.after || null;
    $('loadMoreWrap')?.classList.toggle('hidden', !data.paging?.next);
    renderMediaGrid();
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><h3>⚠️ Error</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function loadMoreMedia() { if (appState.mediaAfterCursor) loadMedia(appState.mediaAfterCursor); }

function setFilter(type) {
  appState.mediaFilter = type;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  $(`filter-${type}`)?.classList.add('active');
  renderMediaGrid();
}

function renderMediaGrid() {
  const grid  = $('mediaGrid');
  const items = appState.mediaItems.filter(m => appState.mediaFilter === 'ALL' || m.media_type === appState.mediaFilter);

  if (!items.length) {
    grid.innerHTML = `<div class="empty-state"><h3>No media found</h3><p>Try a different filter.</p></div>`;
    return;
  }

  grid.innerHTML = '';
  items.forEach((item, i) => {
    const card = buildMediaCard(item);
    card.style.animationDelay = `${i * 25}ms`;
    grid.appendChild(card);
  });
}

function buildMediaCard(item) {
  const card      = document.createElement('div');
  card.className  = 'media-card';
  card.dataset.id = item.id;
  if (appState.selectedMedia?.id === item.id) card.classList.add('selected');

  const thumb    = item.thumbnail_url || item.media_url || '';
  const typeLabel = item.media_type === 'VIDEO' ? 'Reel' : item.media_type === 'CAROUSEL_ALBUM' ? 'Carousel' : 'Photo';
  const caption   = item.caption ? escapeHtml(item.caption.substring(0, 120)) : 'No caption';
  const date      = new Date(item.timestamp).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });

  card.innerHTML = `
    ${thumb ? `<img class="media-thumb" src="${escapeHtml(thumb)}" alt="Media" loading="lazy"
      onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>` : ''}
    <div class="media-placeholder" style="${thumb ? 'display:none' : ''}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
        <rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="12" cy="12" r="4"/>
      </svg>
    </div>
    <div class="media-type-badge badge-${item.media_type}">${typeLabel}</div>
    <div class="media-overlay">
      <div class="media-meta"><span>💬 ${item.comments_count ?? '?'}</span><span>${date}</span></div>
      <div class="media-caption">${caption}</div>
    </div>
  `;
  card.addEventListener('click', () => selectMedia(item));
  return card;
}

function selectMedia(item) {
  appState.selectedMedia = item;
  document.querySelectorAll('.media-card').forEach(c => c.classList.remove('selected'));
  document.querySelector(`.media-card[data-id="${item.id}"]`)?.classList.add('selected');

  const thumb = $('selectedThumb');
  if (thumb) { thumb.src = item.thumbnail_url || item.media_url || ''; }
  if ($('selectedTypeBadge')) $('selectedTypeBadge').textContent = item.media_type === 'VIDEO' ? 'REEL' : item.media_type;
  if ($('selectedCaption'))   $('selectedCaption').textContent   = item.caption || 'No caption';
  if ($('selectedMeta'))      $('selectedMeta').innerHTML = `<span style="font-size:12px;color:var(--text-faint)">💬 ${item.comments_count ?? '?'} comments</span>`;

  $('resultsSection')?.classList.add('hidden');
  appState.allComments = [];

  showSection('picker');
  setStepActive(3);
}

// ════════════════════════════════════════════════════════════════════════════
//  COMMENT ANALYSIS
// ════════════════════════════════════════════════════════════════════════════
async function fetchAndAnalyze() {
  if (!appState.selectedMedia) { showToast('No media selected', 'error'); return; }

  const answer       = $('answerInput')?.value.trim() || '';
  const minTags      = parseInt($('minTagsInput')?.value || '3', 10);
  const distinctOnly = $('distinctTagsCheck')?.checked ?? true;

  const btn    = $('fetchCommentsBtn');
  const status = $('fetchStatus');
  btn.disabled = true;
  btn.innerHTML = `<div class="spinner" style="width:18px;height:18px;border-width:2px"></div> Fetching…`;
  if (status) status.textContent = '';

  try {
    const res  = await fetch(`/api/comments/${appState.selectedMedia.id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch comments');

    appState.allComments = data.comments || [];
    if (status) status.textContent = `Loaded ${appState.allComments.length} comments`;

    analyzeComments(answer, minTags, distinctOnly);
    renderResults();
    $('resultsSection')?.classList.remove('hidden');
    setStepActive(4);
    setTimeout(() => $('resultsSection')?.scrollIntoView({ behavior:'smooth', block:'start' }), 100);
  } catch (err) {
    showToast(err.message, 'error');
    if (status) status.textContent = `Error: ${err.message}`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg> Fetch &amp; Analyze Comments`;
  }
}

function analyzeComments(answer, minTags, distinctOnly) {
  const winners = [], partial = [], disqualified = [];

  appState.allComments.forEach(comment => {
    const text         = comment.text || '';
    const answerMatch  = answer === '' || text.toLowerCase().includes(answer.toLowerCase());
    const tagMatches   = text.match(/@[\w.]+/g) || [];
    const tagCount     = distinctOnly ? new Set(tagMatches.map(t => t.toLowerCase())).size : tagMatches.length;
    const tagsOk       = tagCount >= minTags;
    const enriched     = { ...comment, _answerMatches: answerMatch, _tagsOk: tagsOk, _tagCount: tagCount };

    if (answerMatch && tagsOk)      winners.push(enriched);
    else if (answerMatch || tagsOk) partial.push(enriched);
    else                            disqualified.push(enriched);
  });

  appState.filteredResults = { winners, partial, disqualified };
}

// ════════════════════════════════════════════════════════════════════════════
//  RENDER RESULTS
// ════════════════════════════════════════════════════════════════════════════
function renderResults() {
  const { winners, partial, disqualified } = appState.filteredResults;
  const total = appState.allComments.length;

  $('statsRow').innerHTML = `
    <div class="stat-card winners"><div class="stat-value">${winners.length}</div><div class="stat-label">🏆 Winners</div></div>
    <div class="stat-card partial"><div class="stat-value">${partial.length}</div><div class="stat-label">⚠️ Partial</div></div>
    <div class="stat-card disqualified"><div class="stat-value">${disqualified.length}</div><div class="stat-label">❌ Disqualified</div></div>
    <div class="stat-card total"><div class="stat-value">${total}</div><div class="stat-label">💬 Total</div></div>
  `;
  $('count-winners').textContent      = winners.length;
  $('count-partial').textContent      = partial.length;
  $('count-disqualified').textContent = disqualified.length;
  $('count-all').textContent          = total;

  appState.currentTab = 'winners';
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  $('tab-winners')?.classList.add('active');
  renderTab('winners');
}

function switchTab(tab) {
  appState.currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  $(`tab-${tab}`)?.classList.add('active');
  renderTab(tab);
}

function renderTab(tab) {
  const { winners, partial, disqualified } = appState.filteredResults;
  const items = tab === 'winners' ? winners : tab === 'partial' ? partial : tab === 'disqualified' ? disqualified : appState.allComments;
  const list  = $('commentsList');
  if (!list) return;

  if (!items.length) {
    list.innerHTML = `<div class="empty-state" style="padding:40px 0"><h3>No comments here</h3></div>`;
    return;
  }

  const answer = $('answerInput')?.value.trim() || '';
  list.innerHTML = '';
  items.forEach((c, i) => {
    const card = buildCommentCard(c, answer);
    card.style.animationDelay = `${i * 18}ms`;
    list.appendChild(card);
  });
}

function buildCommentCard(comment, answer) {
  const text = comment.text || '', username = comment.username || 'unknown';
  const time = comment.timestamp
    ? new Date(comment.timestamp).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
    : '';

  let statusIcon = '💬', avatarClass = 'avatar-disqualified';
  const badges   = [];

  if (comment._answerMatches !== undefined) {
    if (comment._answerMatches && comment._tagsOk) {
      statusIcon = '✅'; avatarClass = 'avatar-winner';
      badges.push('<span class="badge badge-winner">Winner</span>');
    } else if (comment._answerMatches) {
      statusIcon = '⚠️'; avatarClass = 'avatar-partial';
      badges.push('<span class="badge badge-partial">Has Answer</span>');
      badges.push(`<span class="badge badge-no-answer">Only ${comment._tagCount} tag${comment._tagCount !== 1 ? 's' : ''}</span>`);
    } else if (comment._tagsOk) {
      statusIcon = '⚠️'; avatarClass = 'avatar-partial';
      badges.push('<span class="badge badge-partial">3+ Tags</span>');
      badges.push('<span class="badge badge-no-answer">Wrong Answer</span>');
    } else {
      statusIcon = '❌';
      badges.push('<span class="badge badge-no-answer">Wrong Answer</span>');
      badges.push(`<span class="badge badge-no-answer">${comment._tagCount} tag${comment._tagCount !== 1 ? 's' : ''}</span>`);
    }
    if (comment._tagCount > 0) badges.push(`<span class="badge badge-tags">@tags: ${comment._tagCount}</span>`);
    if (comment.is_reply) badges.push('<span class="badge badge-tags">Reply</span>');
  }

  let displayText = escapeHtml(text);
  if (answer) displayText = displayText.replace(new RegExp(`(${escapeRegex(answer)})`, 'gi'), '<span class="highlight">$1</span>');
  displayText = displayText.replace(/@[\w.]+/g, m => `<span class="mention">${m}</span>`);

  const card = document.createElement('div');
  card.className = 'comment-card';
  card.innerHTML = `
    <div class="comment-avatar ${avatarClass}">${(username[0] || '?').toUpperCase()}</div>
    <div class="comment-body">
      <div class="comment-header">
        <span class="comment-username">@${escapeHtml(username)}</span>
        <span class="comment-time">${time}</span>
      </div>
      <div class="comment-text">${displayText}</div>
      <div class="comment-badges">${badges.join('')}</div>
    </div>
    <div class="comment-status-icon">${statusIcon}</div>
  `;
  return card;
}

// ════════════════════════════════════════════════════════════════════════════
//  EXPORT & RANDOM WINNER
// ════════════════════════════════════════════════════════════════════════════
function exportCSV() {
  const { winners, partial, disqualified } = appState.filteredResults;
  const all = [
    ...winners.map(c => ({ ...c, _category:'Winner' })),
    ...partial.map(c => ({ ...c, _category:'Partial' })),
    ...disqualified.map(c => ({ ...c, _category:'Disqualified' })),
  ];
  if (!all.length) { showToast('No comments to export', 'error'); return; }

  const rows = [['Category','Username','Comment','Tag Count','Answer Match','Timestamp'],
    ...all.map(c => [c._category, c.username||'', (c.text||'').replace(/"/g,'""'), c._tagCount??'', c._answerMatches?'Yes':'No', c.timestamp||''])];
  const csv  = rows.map(r => r.map(v=>`"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `comment_results_${Date.now()}.csv` });
  a.click(); URL.revokeObjectURL(a.href);
  showToast('CSV exported!', 'success');
}

function pickRandomWinner() {
  const { winners } = appState.filteredResults;
  if (!winners.length) { showToast('No winners to pick!', 'error'); return; }
  const w = winners[Math.floor(Math.random() * winners.length)];
  $('winnerUsername').textContent = `@${w.username || 'unknown'}`;
  $('winnerComment').textContent  = w.text || '';
  $('winnerModal')?.classList.remove('hidden');
}

function closeWinnerModal(e) {
  if (!e || e.target === $('winnerModal')) $('winnerModal')?.classList.add('hidden');
}

// ════════════════════════════════════════════════════════════════════════════
//  UTILITIES
// ════════════════════════════════════════════════════════════════════════════
let toastTimer = null;
function showToast(msg, type='') {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg; t.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3500);
}
function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
