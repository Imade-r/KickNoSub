// ========================================
// KickNoSub - Main Application Logic
// ========================================

// 💰 MONÉTISATION - SCRIPTS PUBLICITAIRES 💰
// --> Si vous utilisez une régie comme Adsterra, Monetag ou Clickadu
// --> Collez leurs scripts (Popunders, Social Bar, Push) juste en dessous de ce commentaire :

// ========================================
document.addEventListener('DOMContentLoaded', () => {

    // ── DOM References ──────────────────────
    const urlInput      = document.getElementById('kick_url');
    const loadBtn       = document.getElementById('watch-now-btn');
    const heroSection   = document.querySelector('.hero');
    const playerSection = document.getElementById('player-section');
    const video         = document.getElementById('video_player');
    const streamInfo    = document.querySelector('.video-info');
    const chatList      = document.getElementById('chat-messages');

    // ── State ───────────────────────────────
    let hls               = null;
    let chatActiveSession = 0;
    let chatMessages      = [];
    let chatChannelId     = null;
    let videoStartTime    = null;
    let lastRenderedMsgId = null;
    let isUserScrolled    = false;
    let playerCleanup     = null;
    let currentVODUrl     = null;
    let currentVODMeta    = null;   // { title, streamer, thumbnail, duration, url }
    let lastProgressSave  = 0;
    let autoNextTimer     = null;   // timer du compte à rebours auto-next

    // Cache streamer VODs (slug → { data, ts }), TTL 5 min
    const _streamerCache = new Map();
    const CACHE_TTL_MS   = 5 * 60 * 1000;

    function getCachedStreamer(slug) {
        const entry = _streamerCache.get(slug);
        if (!entry) return null;
        if (Date.now() - entry.ts > CACHE_TTL_MS) { _streamerCache.delete(slug); return null; }
        return entry.data;
    }

    function setCachedStreamer(slug, data) {
        _streamerCache.set(slug, { data, ts: Date.now() });
    }

    // Debounce helper
    function debounce(fn, delay) {
        let timer;
        return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
    }

    // ── Utilities ───────────────────────────
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function resolveUsernameColor(color) {
        if (color && /^#[0-9A-Fa-f]{3,6}$/.test(color)) {
            const r = parseInt(color.slice(1, 3), 16) || 0;
            const g = parseInt(color.slice(3, 5), 16) || 0;
            const b = parseInt(color.slice(5, 7), 16) || 0;
            if ((0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.15) return color;
        }
        return 'var(--accent-primary)';
    }

    function formatTime(secs) {
        if (!isFinite(secs) || secs < 0) return '0:00';
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = Math.floor(secs % 60);
        if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    // ── Badges chat Kick ────────────────────
    const BADGE_ICONS = {
        broadcaster: { color: '#fa5050', svg: '<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/></svg>' },
        moderator:   { color: '#00b87a', svg: '<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1.2 14.3-3.5-3.5 1.4-1.4 2.1 2.1 4.6-4.6 1.4 1.4-6 6z"/></svg>' },
        vip:         { color: '#ff4ade', svg: '<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M5 3 2 9l10 12L22 9l-3-6H5zm2.6 2h8.8l1.6 3.2H6L7.6 5z"/></svg>' },
        og:          { color: '#1fd0c3', svg: '<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>' },
        founder:     { color: '#ffb300', svg: '<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M5 16 3 5l5.5 4L12 4l3.5 5L21 5l-2 11H5zm0 2h14v3H5v-3z"/></svg>' },
        verified:    { color: '#2f9bff', svg: '<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="m23 12-2.4-2.8.3-3.7-3.6-.8L15.4 1 12 2.5 8.6 1 6.7 4.7l-3.6.8.3 3.7L1 12l2.4 2.8-.3 3.7 3.6.8L8.6 23 12 21.5 15.4 23l1.9-3.7 3.6-.8-.3-3.7L23 12zm-12.9 4.5L6 12.4l1.4-1.4 2.7 2.7 6.5-6.5L18 8.6l-7.9 7.9z"/></svg>' },
        subscriber:  { color: '#53fc18', svg: '<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>' },
        sub_gifter:  { color: '#9147ff', svg: '<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M20 7h-2.2a3 3 0 0 0-5.8-1 3 3 0 0 0-5.8 1H4a1 1 0 0 0-1 1v3h9V7h0v4h9V8a1 1 0 0 0-1-1zM4 13v7a1 1 0 0 0 1 1h6v-8H4zm9 8h6a1 1 0 0 0 1-1v-7h-7v8z"/></svg>' },
        staff:       { color: '#53fc18', svg: '<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M12 2 2 7l10 5 10-5-10-5zm0 7L2 14l10 5 10-5-10-5z"/></svg>' },
    };

    function renderBadges(badges) {
        if (!Array.isArray(badges) || !badges.length) return '';
        return badges.map(b => {
            const def   = BADGE_ICONS[b.type];
            const count = b.count ? ` (${b.count})` : '';
            const title = escapeHtml((b.text || b.type || '') + count);
            if (def) {
                return `<span class="chat-badge" title="${title}" style="color:${def.color}">${def.svg}</span>`;
            }
            return `<span class="chat-badge chat-badge-text" title="${title}">${escapeHtml((b.type || '?').charAt(0).toUpperCase())}</span>`;
        }).join('');
    }

    function renderChatContent(text) {
        const parts = text.split(/(\[emote:\d+:[^\]]+\])/g);
        return parts.map(part => {
            const m = part.match(/\[emote:(\d+):([^\]]+)\]/);
            if (m) {
                const id   = m[1];
                const name = escapeHtml(m[2]);
                return `<img class="chat-emote" src="https://files.kick.com/emotes/${id}/fullsize" alt=":${name}:" title=":${name}:" loading="lazy">`;
            }
            return escapeHtml(part);
        }).join('');
    }

    // ── Progress Persistence ────────────────
    function saveProgress(url, time) {
        if (!url || time < 10) return;
        try {
            const all = JSON.parse(localStorage.getItem('ksn_progress') || '{}');
            all[url] = Math.floor(time);
            localStorage.setItem('ksn_progress', JSON.stringify(all));
        } catch (_) {}
    }

    function getSavedProgress(url) {
        if (!url) return 0;
        try {
            const all = JSON.parse(localStorage.getItem('ksn_progress') || '{}');
            return all[url] || 0;
        } catch (_) { return 0; }
    }

    function clearProgress(url) {
        if (!url) return;
        try {
            const all = JSON.parse(localStorage.getItem('ksn_progress') || '{}');
            delete all[url];
            localStorage.setItem('ksn_progress', JSON.stringify(all));
        } catch (_) {}
    }

    // ── Toast Notifications ─────────────────
    function showToast(type, title, message, duration = 5000) {
        const container = document.querySelector('.toast-container');
        if (!container) return;
        const icons = {
            success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><polyline points="20 6 9 17 4 12"/></svg>`,
            error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
            warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        };
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.error}</div>
            <div class="toast-content">
                <div class="toast-title">${escapeHtml(title)}</div>
                <div class="toast-message">${escapeHtml(message)}</div>
            </div>
            <button class="toast-close" aria-label="Fermer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>`;
        toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));
        container.appendChild(toast);
        if (duration > 0) setTimeout(() => removeToast(toast), duration);
    }

    function removeToast(toast) {
        if (!toast?.parentNode) return;
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }

    function showError(msg, retryUrl = null) {
        if (!msg) return;
        const container = document.querySelector('.toast-container');
        if (!container) return;
        const icons = { error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>` };
        const toast = document.createElement('div');
        toast.className = 'toast error';
        toast.innerHTML = `
            <div class="toast-icon">${icons.error}</div>
            <div class="toast-content">
                <div class="toast-title">Erreur</div>
                <div class="toast-message">${escapeHtml(friendlyError(msg))}</div>
                ${retryUrl ? `<button class="toast-retry-btn" data-url="${escapeHtml(retryUrl)}">Réessayer</button>` : ''}
            </div>
            <button class="toast-close" aria-label="Fermer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>`;
        toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));
        const retryBtn = toast.querySelector('.toast-retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                removeToast(toast);
                fetchStreamUrl(retryBtn.dataset.url);
            });
        }
        container.appendChild(toast);
        setTimeout(() => removeToast(toast), 8000);
    }

    function friendlyError(msg) {
        if (!msg) return 'Une erreur est survenue.';
        if (/not found|introuvable|404/i.test(msg)) return 'VOD introuvable. Elle est peut-être expirée ou privée.';
        if (/invalid url|url invalide/i.test(msg)) return 'URL invalide. Colle un lien Kick valide (ex : kick.com/streamer/video/uuid).';
        if (/offset|stream.*valid/i.test(msg)) return 'Impossible de trouver le flux vidéo. La VOD est peut-être trop ancienne.';
        if (/network|réseau|fetch/i.test(msg)) return 'Erreur réseau. Vérifie ta connexion et réessaie.';
        return msg;
    }

    

    // ── Watch Button ────────────────────────
    loadBtn?.addEventListener('click', () => {
        const url = urlInput?.value.trim();
        if (!url) { showError('Veuillez entrer une URL de VOD ou de clip Kick/Twitch.'); return; }
        if (!/kick\.com\/|twitch\.tv\//.test(url)) { showError('Colle un lien valide de VOD/clip Kick ou Twitch.'); return; }
        fetchStreamUrl(url);
    });

    urlInput?.addEventListener('keypress', e => { if (e.key === 'Enter') loadBtn?.click(); });

    // ── Fetch Stream ────────────────────────
    // Overlay de chargement sur le player existant
    function showPlayerLoading(title, thumbnail) {
        const wrapper = document.getElementById('video-wrapper-container');
        if (!wrapper) return;
        let ov = document.getElementById('vod-switch-overlay');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'vod-switch-overlay';
            ov.className = 'vod-switch-overlay';
            wrapper.appendChild(ov);
        }
        ov.innerHTML = `
            ${thumbnail ? `<div class="vod-switch-thumb"><img src="${escapeHtml(thumbnail)}" alt=""></div>` : ''}
            <div class="vod-switch-spinner">
                <svg viewBox="0 0 50 50" width="48" height="48">
                    <circle cx="25" cy="25" r="20" fill="none" stroke="var(--accent-primary,#53fc18)" stroke-width="4"
                        stroke-dasharray="100 28" stroke-linecap="round">
                        <animateTransform attributeName="transform" type="rotate"
                            from="0 25 25" to="360 25 25" dur="0.9s" repeatCount="indefinite"/>
                    </circle>
                </svg>
            </div>
            <p class="vod-switch-label">${t('loading_vod')}</p>
            ${title ? `<p class="vod-switch-title">${escapeHtml(title)}</p>` : ''}`;
        ov.style.display = 'flex';
    }

    function hidePlayerLoading() {
        document.getElementById('vod-switch-overlay')?.remove();
    }

    async function fetchStreamUrl(kickUrl, fromStreamerSearch = false, switchTitle = '', switchThumb = '') {
        if (!loadBtn) return;
        const origHTML = loadBtn.innerHTML;
        loadBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg><span>${t('loading')}</span>`;
        loadBtn.classList.add('is-loading');
        loadBtn.disabled = true;

        // Si un player est déjà ouvert, afficher l'overlay de transition
        const playerAlreadyOpen = playerSection && playerSection.style.display !== 'none';
        if (playerAlreadyOpen) showPlayerLoading(switchTitle, switchThumb);

        try {
            const res  = await fetch('/api/get_stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: kickUrl })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Impossible de récupérer le flux.');
            if (data.stream_url) {
                currentVODUrl = kickUrl;
                // URL partageables : met à jour l'URL du navigateur
                const vodTitle = data.metadata?.session_title || 'Kick VOD';
                history.pushState({ vodUrl: kickUrl }, vodTitle, `?vod=${encodeURIComponent(kickUrl)}`);
                hidePlayerLoading();
                initializePlayer(data.stream_url, data.metadata, data.channel, !!data.is_clip, !!data.is_twitch, data.vod_id, data.storyboard);
                window.currentDownloadUrl = data.download_url || null;
                if (data.is_clip) {
                    clearRelatedVods();
                } else if (data.is_twitch) {
                    const login = data.channel?.login;
                    if (login) silentFetchTwitchRelatedVods(login, kickUrl);
                    else clearRelatedVods();
                } else {
                    const slug = data.channel?.slug;
                    if (slug) {
                        if (fromStreamerSearch && _lastStreamerInfo?.slug === slug && _lastStreamerVods.length > 0) {
                            renderRelatedVods(kickUrl);
                        } else {
                            silentFetchRelatedVods(slug, kickUrl);
                        }
                    } else {
                        clearRelatedVods();
                    }
                }
            }
            else throw new Error('Aucun flux valide trouvé.');
        } catch (err) {
            hidePlayerLoading();
            showError(err.message, kickUrl);
        } finally {
            loadBtn.innerHTML = origHTML;
            loadBtn.classList.remove('is-loading');
            loadBtn.disabled = false;
        }
    }

    async function silentFetchRelatedVods(slug, currentUrl) {
        // Utilise le cache si disponible
        const cached = getCachedStreamer(slug);
        if (cached) {
            _lastStreamerVods = cached.vods;
            _lastStreamerInfo = cached.streamer;
            renderRelatedVods(currentUrl);
            return;
        }
        try {
            const res  = await fetch(`/api/streamer_vods?slug=${encodeURIComponent(slug)}`);
            if (!res.ok) return;
            const data = await res.json();
            _lastStreamerVods = data.vods  || [];
            _lastStreamerInfo = data.streamer || null;
            setCachedStreamer(slug, { vods: _lastStreamerVods, streamer: _lastStreamerInfo });
            renderRelatedVods(currentUrl);
        } catch (_) { /* silencieux */ }
    }

    async function silentFetchTwitchRelatedVods(login, currentUrl) {
        const key = 'tw:' + login;
        const cached = getCachedStreamer(key);
        if (cached) {
            _lastStreamerVods = cached.vods;
            _lastStreamerInfo = cached.streamer;
            renderRelatedVods(currentUrl);
            return;
        }
        try {
            const res = await fetch(`/api/twitch/streamer_vods?login=${encodeURIComponent(login)}`);
            if (!res.ok) return;
            const data = await res.json();
            _lastStreamerVods = data.vods || [];
            _lastStreamerInfo = data.streamer || null;
            setCachedStreamer(key, { vods: _lastStreamerVods, streamer: _lastStreamerInfo });
            renderRelatedVods(currentUrl);
        } catch (_) { /* silencieux */ }
    }

    function clearRelatedVods() {
        const el = document.getElementById('related-vods-section');
        if (el) el.remove();
    }

    function renderRelatedVods(currentUrl) {
        clearRelatedVods();
        if (!_lastStreamerVods.length || !_lastStreamerInfo) return;
        const others = _lastStreamerVods.filter(v => v.url !== currentUrl);
        if (!others.length) return;

        const section = document.createElement('div');
        section.id = 'related-vods-section';
        section.className = 'related-vods-section';
        section.innerHTML = `
            <div class="related-vods-header">
                <img src="${escapeHtml(_lastStreamerInfo.avatar || '')}" class="related-vods-avatar" alt="" onerror="this.style.display='none'">
                <div class="related-vods-title">${t('related_vods_title')} <strong>${escapeHtml(_lastStreamerInfo.name || _lastStreamerInfo.slug)}</strong></div>
            </div>
            <div class="related-vods-grid">
                ${others.map(vod => {
                    const savedSec = getSavedProgress(vod.url);
                    const totalSec = vod.duration ? Math.floor(vod.duration / 1000) : 0;
                    const pct = (totalSec > 0 && savedSec > 0) ? Math.min(100, Math.round((savedSec / totalSec) * 100)) : 0;
                    return `
                    <div class="vod-result-card related-vod-item" data-url="${escapeHtml(vod.url)}" data-thumb="${escapeHtml(vod.thumbnail || '')}">
                        <div class="vod-result-thumb">
                            <div class="vod-skeleton"></div>
                            ${vod.thumbnail ? `<img src="${escapeHtml(vod.thumbnail)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
                            ${vod.duration  ? `<span class="vod-result-duration">${formatDuration(vod.duration)}</span>` : ''}
                            <div class="vod-result-play-overlay"><svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M8 5v14l11-7z"/></svg></div>
                            ${pct > 0 ? `<div class="history-progress-bar"><div class="history-progress-fill" style="width:${pct}%"></div></div>` : ''}
                            ${getMiniFavBtn({
                                url: vod.url,
                                title: vod.title,
                                streamer: _lastStreamerInfo.name || _lastStreamerInfo.slug,
                                avatar: _lastStreamerInfo.avatar || '',
                                duration: vod.duration || 0,
                                thumbnail: vod.thumbnail || ''
                            })}
                        </div>
                        <div class="vod-result-info">
                            <div class="vod-result-title">${escapeHtml(vod.title)}</div>
                            <div class="vod-result-meta">
                                ${vod.date ? `<span>${timeAgo(vod.date.replace(' ', 'T') + 'Z')}</span>` : ''}
                                ${vod.views ? `<span>${vod.views.toLocaleString('fr-FR')} vues</span>` : ''}
                            </div>
                        </div>
                    </div>`;
                }).join('')}
            </div>`;

        // Insert below the player-section
        playerSection?.insertAdjacentElement('afterend', section);

        section.querySelectorAll('.related-vod-item').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.mini-fav-btn')) return;
                const url   = card.dataset.url;
                const title = card.querySelector('.vod-result-title')?.textContent || '';
                const thumb = card.dataset.thumb || '';
                if (urlInput) urlInput.value = url;
                window.scrollTo({ top: 0, behavior: 'smooth' });
                showToast('success', t('loading'), title || t('loading_vod'), 3000);
                fetchStreamUrl(url, true, title, thumb);
            });
        });
    }

    // ── Initialize Player ───────────────────
    function initializePlayer(m3u8Url, metadata, channel, isClip = false, isTwitch = false, twitchVodId = null, storyboard = null) {
        if (heroSection) heroSection.style.display = 'none';
        document.querySelector('#home-view .how-it-works')?.style.setProperty('display', 'none');
        document.getElementById('trending-section')?.style.setProperty('display', 'none');
        if (playerSection) { playerSection.style.display = 'block'; window.scrollTo(0, 0); }

        window.currentM3U8Url = m3u8Url;
        setupPlayerControls();

        if (metadata && channel && streamInfo) {
            videoStartTime = new Date(
                metadata.start_time.replace(' ', 'T') + (metadata.start_time.endsWith('Z') ? '' : 'Z')
            );
            chatChannelId = channel.id;

            saveToHistory(
                urlInput?.value || '',
                metadata.session_title || 'Kick VOD',
                channel.slug,
                channel.profile_pic,
                (metadata.thumbnail || {}).src || '',
                metadata.duration || 0
            );

            const views = metadata.views ? metadata.views.toLocaleString('fr-FR') : 'N/A';
            const date  = metadata.start_time
                ? new Date(metadata.start_time.replace(' ', 'T') + 'Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                : '';

            streamInfo.innerHTML = `
                <img src="${escapeHtml(channel.profile_pic || '')}" alt="${escapeHtml(channel.slug)}"
                     class="streamer-avatar" onerror="this.style.display='none'">
                <div class="stream-details">
                    <div class="stream-title">${escapeHtml(metadata.session_title || 'Kick VOD')}</div>
                    <div class="stream-meta">
                        <span><span style="color:var(--text-muted)">Streamer :</span> ${escapeHtml(channel.slug)}</span>
                        <span><span style="color:var(--text-muted)">Vues :</span> ${views}</span>
                        ${date ? `<span><span style="color:var(--text-muted)">Date :</span> ${date}</span>` : ''}
                    </div>
                </div>
                <div class="stream-quality-ctrl" id="quality-ctrl-wrap" style="display:none">
                    <label for="quality-select-player">Qualité</label>
                    <select id="quality-select-player" class="quality-select-player">
                        <option value="-1">Auto</option>
                    </select>
                </div>
                <button class="stream-back-btn" id="back-to-home-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="m15 18-6-6 6-6"/></svg>
                    Retour
                </button>`;

            document.getElementById('back-to-home-btn')?.addEventListener('click', goBackHome);

            document.getElementById('quality-select-player')?.addEventListener('change', e => {
                if (!hls) return;
                const idx = parseInt(e.target.value);
                hls.currentLevel = idx;
                const label = idx === -1
                    ? 'Automatique'
                    : (hls.levels[idx]?.height ? `${hls.levels[idx].height}p` : `Niveau ${idx + 1}`);
                showToast('success', 'Qualité', label, 2500);
            });

            // Store current VOD metadata for favorites, stats, share
            currentVODMeta = {
                url: currentVODUrl,
                title: metadata.session_title || 'Kick VOD',
                streamer: channel.slug,
                avatar: channel.profile_pic || '',
                thumbnail: (metadata.thumbnail || {}).src || '',
                duration: metadata.duration || 0
            };

            // Dynamic meta tags
            document.title = `${currentVODMeta.title} — KickNoSub`;
            document.querySelector('meta[property="og:title"]')?.setAttribute('content', currentVODMeta.title);
            document.querySelector('meta[property="og:image"]')?.setAttribute('content', currentVODMeta.thumbnail);

            // Action buttons (copy, share, favorites)
            const actionBtns = document.getElementById('player-action-btns');
            if (actionBtns) {
                actionBtns.style.display = '';
                updateFavBtn();
            }
        }

        const chatHeader = document.querySelector('.chat-header-title');
        if (chatHeader) {
            chatHeader.innerHTML = `<span>Chat de la VOD</span>
                <span class="chat-live-badge"><span class="chat-live-dot"></span>EN DIRECT</span>`;
        }

        if (video && typeof Hls !== 'undefined') {
            if (Hls.isSupported()) {
                hls?.destroy();
                hls = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60 });
                hls.loadSource(m3u8Url);
                hls.attachMedia(video);

                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    populateQualityLevels();
                    
                    const saved = getSavedProgress(currentVODUrl);
                    if (saved > 30) {
                        video.currentTime = saved;
                        showResumePrompt(saved);
                    } else {
                        video.play().catch(() => {});
                    }
                });

                hls.on(Hls.Events.ERROR, (_, data) => {
                    if (!data.fatal) return;
                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
                    else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
                    else hls.destroy();
                });

                // Aperçu au survol : Twitch utilise son storyboard natif (léger, pas de
                // 2e flux) ; Kick extrait des frames via un 2e flux créé au 1er survol.
                if (isTwitch) setupTwitchPreview(storyboard);
                else if (!isClip) armSeekPreview(m3u8Url);
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = m3u8Url;
                video.addEventListener('loadedmetadata', () => {
                    
                    const saved = getSavedProgress(currentVODUrl);
                    if (saved > 30) {
                        video.currentTime = saved;
                        showResumePrompt(saved);
                    } else {
                        video.play().catch(() => {});
                    }
                });
            }

            // Auto-next : lancer la VOD suivante à la fin
            video.addEventListener('ended', onVideoEnded);
        }

        // Les clips n'ont pas de chat → masquer la sidebar
        const chatSidebar = document.getElementById('vod-chat-sidebar');
        if (isClip) {
            chatActiveSession++; // stoppe toute boucle de chat en cours
            if (chatSidebar) chatSidebar.style.display = 'none';
        } else if (isTwitch && chatList) {
            // Chat replay Twitch (via /api/twitch/chat, synchronisé sur la lecture)
            if (chatSidebar) chatSidebar.style.display = '';
            chatActiveSession++;
            startTwitchChat(twitchVodId, chatActiveSession);
        } else if (chatList) {
            if (chatSidebar) chatSidebar.style.display = '';
            chatActiveSession++;
            chatMessages      = [];
            lastRenderedMsgId = null;
            isUserScrolled    = false;
            chatList.innerHTML = `<div class="chat-status">${t('chat_connecting')}</div>`;

            chatList.removeEventListener('scroll', handleChatScroll);
            chatList.addEventListener('scroll', handleChatScroll, { passive: true });

            let scrollBtn = document.getElementById('chat-scroll-btn');
            if (!scrollBtn) {
                scrollBtn = document.createElement('button');
                scrollBtn.id        = 'chat-scroll-btn';
                scrollBtn.className = 'chat-scroll-btn';
                scrollBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><path d="m6 9 6 6 6-6"/></svg> Bas du chat`;
                scrollBtn.addEventListener('click', () => {
                    chatList.scrollTop = chatList.scrollHeight;
                    isUserScrolled = false;
                    scrollBtn.classList.remove('visible');
                });
                chatList.parentNode?.insertBefore(scrollBtn, chatList.nextSibling);
            }

            video?.removeEventListener('timeupdate', handleTimeUpdate);
            video?.addEventListener('timeupdate', handleTimeUpdate);
            video?.removeEventListener('seeking', handleSeeking);
            video?.addEventListener('seeking', handleSeeking);
            video?.addEventListener('ended', () => clearProgress(currentVODUrl));

            startChatLoop(chatActiveSession);
        }

        startChatHeightSync();
    }

    // ── Resume Prompt ───────────────────────
    function showResumePrompt(savedTime) {
        const overlay    = document.getElementById('resume-prompt-overlay');
        const timeEl     = document.getElementById('resume-time');
        if (!overlay) return;

        if (timeEl) timeEl.textContent = formatTime(savedTime);
        overlay.style.display = 'flex';

        // Replace buttons to clear any old listeners
        ['resume-btn', 'start-over-btn'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.replaceWith(el.cloneNode(true));
        });

        document.getElementById('resume-btn')?.addEventListener('click', () => {
            overlay.style.display = 'none';
            video?.play().catch(() => {});
        });

        document.getElementById('start-over-btn')?.addEventListener('click', () => {
            overlay.style.display = 'none';
            clearProgress(currentVODUrl);
            if (video) video.currentTime = 0;
            video?.play().catch(() => {});
        });
    }

    // ── Custom Player Controls ───────────────
    const SVG = {
        play:   `<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M8 5v14l11-7z"/></svg>`,
        pause:  `<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
        playLg: `<svg viewBox="0 0 24 24" fill="currentColor" width="34" height="34"><path d="M8 5v14l11-7z"/></svg>`,
        pauseLg:`<svg viewBox="0 0 24 24" fill="currentColor" width="34" height="34"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
        skipB:  `<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="9.2" y="16" font-size="5.5" font-weight="700" font-family="Arial,sans-serif" fill="currentColor">10</text></svg>`,
        skipF:  `<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M18 13c0 3.31-2.69 6-6 6s-6-2.69-6-6 2.69-6 6-6v4l5-5-5-5v4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8h-2z"/><text x="9.2" y="16" font-size="5.5" font-weight="700" font-family="Arial,sans-serif" fill="currentColor">10</text></svg>`,
        skipBLg:`<svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="9.2" y="16" font-size="5.5" font-weight="700" font-family="Arial,sans-serif" fill="currentColor">10</text></svg>`,
        skipFLg:`<svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M18 13c0 3.31-2.69 6-6 6s-6-2.69-6-6 2.69-6 6-6v4l5-5-5-5v4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8h-2z"/><text x="9.2" y="16" font-size="5.5" font-weight="700" font-family="Arial,sans-serif" fill="currentColor">10</text></svg>`,
        volOn:  `<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`,
        volOff: `<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`,
        fsIn:   `<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`,
        fsOut:  `<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`,
        pip:    `<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M19 11h-8v6h8v-6zm4 10V3H1v18h22zm-2-1.97H3V5h18v14.03z"/></svg>`,
        theater:`<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M19 7H5c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm0 10H5V9h14v8z"/></svg>`,
        share:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
    };

    // ── Synchronise la hauteur du chat sur celle de la carte vidéo ──────────
    // Le chat est un flex-item frère de la carte. Sa hauteur intrinsèque (= tous
    // les messages) gonflerait la rangée à l'infini, car le conteneur a une
    // hauteur auto. On fixe donc sa hauteur sur celle de la carte (bornée), et
    // les messages défilent à l'intérieur.
    let chatHeightObserver = null;
    function syncChatHeight() {
        const sidebar = document.getElementById('vod-chat-sidebar');
        const card    = document.querySelector('.player-card');
        if (!sidebar || !card) return;
        // Mode cinéma (géré en CSS) et mobile empilé : pas de hauteur figée.
        if (playerSection?.classList.contains('theater-mode') || window.innerWidth <= 768) {
            if (sidebar.style.height) sidebar.style.height = '';
            return;
        }
        // Garde d'idempotence : si déjà synchronisé, ne rien écrire. Ça casse la
        // boucle du ResizeObserver (nos écritures ne déclenchent pas de nouveau cycle).
        if (parseInt(sidebar.style.height, 10) === card.offsetHeight) return;
        // La hauteur est une valeur de layout pilotée en JS : on coupe la transition
        // pour qu'elle s'applique instantanément (sinon le chat « grandit » à chaque synchro).
        const prevTransition = sidebar.style.transition;
        sidebar.style.transition = 'none';
        sidebar.style.height = '0px';                     // n'inflige pas sa hauteur à la rangée
        sidebar.style.height = card.offsetHeight + 'px';  // épouse la carte
        void sidebar.offsetHeight;                        // commit le reflow sans animation
        sidebar.style.transition = prevTransition;
    }
    function startChatHeightSync() {
        const card = document.querySelector('.player-card');
        if (!card) return;
        syncChatHeight();
        if ('ResizeObserver' in window && !chatHeightObserver) {
            chatHeightObserver = new ResizeObserver(() => syncChatHeight());
            chatHeightObserver.observe(card);
        }
        window.addEventListener('resize', syncChatHeight);
    }
    function stopChatHeightSync() {
        chatHeightObserver?.disconnect();
        chatHeightObserver = null;
        window.removeEventListener('resize', syncChatHeight);
        const sidebar = document.getElementById('vod-chat-sidebar');
        if (sidebar) sidebar.style.height = '';
    }

    // ── Aperçu vidéo au survol de la barre de progression ───────────────────
    // 2e flux HLS caché (qualité la plus basse). La vidéo est découpée en
    // VIGNETTES à intervalle fixe (≈ 1 toutes les 30 s, plus espacé pour les
    // très longues VOD) : on snap la position survolée sur la vignette la plus
    // proche, on la met en cache, et on ne redessine QUE lorsqu'elle change
    // (anti-vacillement). Un watchdog évite de rester figé si un seek traîne.
    let previewHls         = null;
    let previewVideo       = null;
    let previewSrc         = null;  // m3u8 mémorisé ; le flux n'est créé qu'au 1er survol
    let previewReady       = false;
    let previewSeeking     = false;
    let previewErrCount    = 0;
    let previewWantedKey   = -1;   // dernière vignette demandée par la souris
    let previewSeekingKey  = -1;   // vignette en cours de chargement
    let previewShownKey    = -1;   // vignette actuellement dessinée
    let previewSeekTimer   = null;
    let previewBgOrder     = null; // ordre d'extraction de fond (grossier -> fin)
    let previewBgIdx       = 0;
    const previewCache     = new Map();   // key -> canvas hors-écran

    function previewStep() {
        // ~1 vignette / 30 s ; on espace pour les longues VOD (cible ~200 vignettes max)
        const d = previewVideo?.duration || 0;
        return Math.max(30, Math.round(d / 200));
    }
    function previewKey(time)      { return Math.floor(time / previewStep()); }
    function previewTimeForKey(k)  {
        const d = previewVideo?.duration || 0;
        return Math.min(k * previewStep() + previewStep() / 2, Math.max(0, d - 0.1));
    }

    // Mémorise la source à l'init, sans créer le 2e flux (évite la concurrence
    // avec le chargement du flux principal).
    function armSeekPreview(m3u8Url) {
        destroySeekPreview();
        previewSrc = (window.innerWidth > 768 && typeof Hls !== 'undefined' && Hls.isSupported()) ? m3u8Url : null;
    }

    // Création paresseuse : le flux d'aperçu n'est monté qu'au premier survol.
    function ensureSeekPreview() {
        if (previewVideo || !previewSrc) return;

        previewVideo = document.createElement('video');
        previewVideo.muted       = true;
        previewVideo.preload     = 'auto';
        previewVideo.playsInline = true;
        previewVideo.crossOrigin = 'anonymous';
        previewVideo.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;';
        document.body.appendChild(previewVideo);

        previewHls = new Hls({ maxBufferLength: 4, maxMaxBufferLength: 8 });
        previewHls.loadSource(previewSrc);
        previewHls.attachMedia(previewVideo);
        previewHls.on(Hls.Events.MANIFEST_PARSED, () => {
            const levels = previewHls.levels || [];
            if (levels.length) {                       // qualité la plus basse = vignettes rapides
                let lowest = 0;
                levels.forEach((l, i) => { if ((l.height || 1e9) < (levels[lowest].height || 1e9)) lowest = i; });
                previewHls.currentLevel = lowest;
            }
        });
        // Prêt quand la durée est connue ; on lance alors la construction du storyboard.
        previewVideo.addEventListener('loadedmetadata', () => { previewReady = true; pumpPreview(); });
        document.addEventListener('visibilitychange', onPreviewVisibility);
        // Récupération sur erreur plutôt que destruction immédiate (transitoires réseau).
        previewHls.on(Hls.Events.ERROR, (_, d) => {
            if (!d.fatal) return;
            if (++previewErrCount > 4) { destroySeekPreview(); return; }
            if (d.type === Hls.ErrorTypes.NETWORK_ERROR)    previewHls.startLoad();
            else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) previewHls.recoverMediaError();
            else destroySeekPreview();
        });
        previewVideo.addEventListener('seeked', onPreviewSeeked);
    }

    function drawCanvas(src) {
        const canvas = document.getElementById('seek-preview-canvas');
        if (canvas && src) { try { canvas.getContext('2d').drawImage(src, 0, 0, canvas.width, canvas.height); } catch (_) {} }
    }

    // Vignette en cache la plus proche d'une position (pour afficher tout de suite
    // une image approximativement bonne pendant que l'exacte se charge).
    function nearestCached(key) {
        let best = null, bestDist = Infinity;
        for (const k of previewCache.keys()) {
            const d = Math.abs(k - key);
            if (d < bestDist) { bestDist = d; best = k; }
        }
        return best;
    }

    // Affiche la vignette exacte si dispo, sinon la plus proche en cache (jamais
    // bloqué sur une image lointaine). Ne redessine que si la vignette change.
    function showKey(key) {
        let k = previewCache.has(key) ? key : nearestCached(key);
        if (k === null || k === previewShownKey) return;
        drawCanvas(previewCache.get(k));
        previewShownKey = k;
    }

    function cacheCurrentFrame(key) {
        if (!previewVideo || !previewVideo.videoWidth) return false;
        const off = document.createElement('canvas');
        off.width = 160; off.height = 90;
        try { off.getContext('2d').drawImage(previewVideo, 0, 0, 160, 90); } catch (_) { return false; }
        previewCache.set(key, off);
        if (previewCache.size > 250) previewCache.delete(previewCache.keys().next().value);
        return true;
    }

    function previewTotalBuckets() {
        const d = previewVideo?.duration || 0;
        return Math.max(0, Math.floor(Math.max(0, d - 0.2) / previewStep()));
    }

    // Ordre d'extraction de fond : grossier -> fin (couvre vite toute la barre,
    // puis affine), pour que la vignette « la plus proche » soit utile rapidement.
    function buildBgOrder(total) {
        const order = [], seen = new Set();
        let stride = 1;
        while (stride < total) stride *= 2;
        for (; stride >= 1; stride = Math.floor(stride / 2)) {
            for (let k = 0; k <= total; k += stride) {
                if (!seen.has(k)) { seen.add(k); order.push(k); }
            }
            if (stride === 1) break;
        }
        return order;
    }

    function nextBgKey() {
        if (!previewBgOrder) { previewBgOrder = buildBgOrder(previewTotalBuckets()); previewBgIdx = 0; }
        while (previewBgIdx < previewBgOrder.length && previewCache.has(previewBgOrder[previewBgIdx])) previewBgIdx++;
        return previewBgIdx < previewBgOrder.length ? previewBgOrder[previewBgIdx] : -1;
    }

    function requestPreviewAt(time) {
        if (!previewReady || !previewVideo || !previewVideo.duration) return;
        previewWantedKey = previewKey(time);
        showKey(previewWantedKey);            // exacte ou la plus proche : retour immédiat
        if (!previewSeeking) pumpPreview();   // (re)lance la file de chargement
    }

    function seekToKey(key) {
        previewSeeking    = true;
        previewSeekingKey = key;
        clearTimeout(previewSeekTimer);
        previewSeekTimer = setTimeout(onPreviewSeekTimeout, 1500);   // watchdog : ne pas rester bloqué
        try { previewVideo.currentTime = previewTimeForKey(key); }
        catch (_) { previewSeeking = false; }
    }

    function onPreviewSeeked() {
        clearTimeout(previewSeekTimer);
        cacheCurrentFrame(previewSeekingKey);
        showKey(previewWantedKey >= 0 ? previewWantedKey : previewSeekingKey);
        previewSeeking = false;
        pumpPreview();
    }

    function onPreviewSeekTimeout() {
        // le seek traîne : on saute cette vignette de fond pour ne pas boucler dessus
        if (previewBgOrder && previewBgOrder[previewBgIdx] === previewSeekingKey) previewBgIdx++;
        previewSeeking = false;
        pumpPreview();
    }

    // File de chargement : sert d'abord la position survolée, sinon construit le
    // storyboard en tâche de fond (-> survols futurs instantanés). S'auto-relance.
    function pumpPreview() {
        if (previewSeeking || !previewReady || !previewVideo || !previewVideo.duration) return;
        if (document.hidden) return;   // onglet en arrière-plan : on n'extrait rien (bande passante)
        if (previewWantedKey >= 0 && !previewCache.has(previewWantedKey)) { seekToKey(previewWantedKey); return; }
        const bg = nextBgKey();
        if (bg >= 0) seekToKey(bg);
    }

    // Reprend la construction du storyboard quand l'onglet redevient visible.
    function onPreviewVisibility() { if (!document.hidden) pumpPreview(); }

    function destroySeekPreview() {
        previewReady = false; previewSeeking = false; previewErrCount = 0;
        previewSrc = null;
        previewWantedKey = previewSeekingKey = previewShownKey = -1;
        previewBgOrder = null; previewBgIdx = 0;
        clearTimeout(previewSeekTimer);
        previewCache.clear();
        document.removeEventListener('visibilitychange', onPreviewVisibility);
        previewVideo?.removeEventListener('seeked', onPreviewSeeked);
        try { previewHls?.destroy(); } catch (_) {}
        previewHls = null;
        previewVideo?.remove();
        previewVideo = null;
        twitchStoryboard = null;
        twitchSbImages = {};
    }

    // ── Aperçu Twitch via storyboard natif (sprite de vignettes, ultra léger) ──
    let twitchStoryboard = null;
    let twitchSbImages   = {};   // index de planche -> Image préchargée

    function setupTwitchPreview(sb) {
        twitchStoryboard = (sb && Array.isArray(sb.images) && sb.images.length) ? sb : null;
        twitchSbImages = {};
        if (!twitchStoryboard) return;
        twitchStoryboard.images.forEach((url, i) => {
            // Pas de crossOrigin : on ne fait qu'afficher (drawImage), pas de lecture
            // de pixels — l'image se charge même si cloudfront n'envoie pas de CORS.
            const img = new Image();
            img.src = url;
            twitchSbImages[i] = img;
        });
    }

    function drawTwitchPreviewAt(t) {
        const sb = twitchStoryboard;
        const canvas = document.getElementById('seek-preview-canvas');
        if (!sb || !canvas || !sb.interval) return;
        let idx = Math.floor(t / sb.interval);
        idx = Math.max(0, Math.min((sb.count || 1) - 1, idx));
        const perSheet = Math.max(1, sb.cols * sb.rows);
        const sheet = Math.floor(idx / perSheet);
        const tile  = idx % perSheet;
        const sx = (tile % sb.cols) * sb.tileW;
        const sy = Math.floor(tile / sb.cols) * sb.tileH;
        const img = twitchSbImages[sheet];
        if (!img || !img.complete || !img.naturalWidth) return;
        try {
            canvas.getContext('2d').drawImage(img, sx, sy, sb.tileW, sb.tileH, 0, 0, canvas.width, canvas.height);
        } catch (_) {}
    }

    // ── Aide Raccourcis Clavier ────────────────────────
    document.getElementById('btn-shortcuts')?.addEventListener('click', () => toggleShortcutsHelp(true));

    function toggleShortcutsHelp(force) {
        const existing = document.getElementById('shortcuts-overlay');
        const show = force === undefined ? !existing : force;
        if (!show) { existing?.remove(); return; }
        if (existing) return;
        const rows = [
            ['Espace / K', 'Lecture / Pause'],
            ['&larr; / &rarr;', 'Reculer / Avancer de 10 s'],
            ['&uarr; / &darr;', 'Volume + / &minus;'],
            ['0 &ndash; 9', 'Aller à 0 % … 90 %'],
            ['F', 'Plein écran'],
            ['M', 'Couper le son'],
            ['P', 'Picture-in-Picture'],
            ['T', 'Mode cinéma'],
            ['V', 'Vitesse de lecture'],
            ['Double-clic', 'Plein écran (sur la vidéo)'],
            ['Échap', 'Quitter cinéma / fermer'],
            ['?', 'Afficher cette aide'],
        ];
        const ov = document.createElement('div');
        ov.id = 'shortcuts-overlay';
        ov.className = 'shortcuts-overlay';
        ov.innerHTML = `
            <div class="shortcuts-card">
                <button class="shortcuts-close" aria-label="Fermer">&times;</button>
                <h3>Raccourcis clavier</h3>
                <div class="shortcuts-grid">
                    ${rows.map(([k, d]) => `<kbd>${k}</kbd><span>${d}</span>`).join('')}
                </div>
            </div>`;
        ov.addEventListener('click', e => {
            if (e.target === ov || e.target.closest('.shortcuts-close')) toggleShortcutsHelp(false);
        });
        document.body.appendChild(ov);
    }

    function setupPlayerControls() {
        const wrapper = document.getElementById('video-wrapper-container');
        if (!wrapper || wrapper.querySelector('#player-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id        = 'player-overlay';
        overlay.className = 'player-controls-overlay';
        overlay.innerHTML = `
            <div id="player-click-zone" class="player-click-zone"></div>

            <div class="player-center-controls" id="player-center-controls">
                <button class="player-center-play" id="center-play-btn" title="Lecture / Pause">
                    <span class="pi-play">${SVG.playLg}</span>
                    <span class="pi-pause" style="display:none">${SVG.pauseLg}</span>
                </button>
            </div>

            <div class="player-bottom-controls" id="player-bottom-controls">
                <div class="player-seek-container" id="player-seek-container">
                    <div class="player-seek-bar" id="player-seek-bar">
                        <div class="player-seek-buffered" id="seek-buffered"></div>
                        <div class="player-seek-progress" id="seek-progress"></div>
                        <div class="player-seek-thumb"    id="seek-thumb"></div>
                    </div>
                    <div class="player-seek-tooltip" id="seek-tooltip">0:00</div>
                    <div class="seek-preview" id="seek-preview" aria-hidden="true">
                        <canvas id="seek-preview-canvas" width="160" height="90"></canvas>
                        <span class="seek-preview-time" id="seek-preview-time">0:00</span>
                    </div>
                </div>
                <div class="player-controls-row">
                    <div class="player-controls-left">
                        <button class="player-ctrl-btn" id="play-pause-btn" title="Lecture / Pause (Espace)">
                            <span class="pi-play">${SVG.play}</span>
                            <span class="pi-pause" style="display:none">${SVG.pause}</span>
                        </button>
                        <button class="player-ctrl-btn" id="skip-back-btn" title="-10s (←)">${SVG.skipB}</button>
                        <button class="player-ctrl-btn" id="skip-fwd-btn"  title="+10s (→)">${SVG.skipF}</button>
                        <div class="player-volume-group">
                            <button class="player-ctrl-btn" id="mute-btn" title="Muet (M)">
                                <span class="pi-vol">${SVG.volOn}</span>
                                <span class="pi-mute" style="display:none">${SVG.volOff}</span>
                            </button>
                            <div class="player-volume-track">
                                <input type="range" id="vol-range" class="player-vol-range" min="0" max="1" step="0.02" value="1" title="Volume">
                            </div>
                        </div>
                        <div class="player-time">
                            <span id="time-cur">0:00</span>
                            <span class="sep"> / </span>
                            <span id="time-dur">0:00</span>
                        </div>
                    </div>
                    <div class="player-controls-right">
                        <button class="player-ctrl-btn" id="pip-btn" title="Picture-in-Picture (P)">${SVG.pip}</button>
                        <button class="player-ctrl-btn" id="theater-btn" title="Mode cinéma (T)">${SVG.theater}</button>
                        <div class="player-speed-wrap">
                            <button class="player-ctrl-btn player-speed-btn" id="speed-btn" title="Vitesse de lecture (V)">
                                <span id="speed-label">1×</span>
                            </button>
                            <div class="player-speed-menu" id="speed-menu">
                                <button class="speed-opt" data-speed="0.5">0.5×</button>
                                <button class="speed-opt" data-speed="0.75">0.75×</button>
                                <button class="speed-opt active" data-speed="1">1×</button>
                                <button class="speed-opt" data-speed="1.25">1.25×</button>
                                <button class="speed-opt" data-speed="1.5">1.5×</button>
                                <button class="speed-opt" data-speed="2">2×</button>
                            </div>
                        </div>
                        <button class="player-ctrl-btn" id="fullscreen-btn" title="Plein écran (F)">
                            <span class="pi-fsin">${SVG.fsIn}</span>
                            <span class="pi-fsout" style="display:none">${SVG.fsOut}</span>
                        </button>
                    </div>
                </div>
            </div>`;

        wrapper.appendChild(overlay);
        playerCleanup = initPlayerEvents(wrapper, overlay);
    }

    function initPlayerEvents(wrapper, overlay) {
        const $ = id => overlay.querySelector('#' + id);
        const centerCtrl  = $('player-center-controls');
        const bottomCtrl  = $('player-bottom-controls');
        const seekCont    = $('player-seek-container');
        const seekBar     = $('player-seek-bar');
        const seekBuf     = $('seek-buffered');
        const seekProg    = $('seek-progress');
        const seekThumb   = $('seek-thumb');
        const seekTooltip = $('seek-tooltip');
        const timeCur     = $('time-cur');
        const timeDur     = $('time-dur');
        const volRange    = $('vol-range');
        const fsBtn       = $('fullscreen-btn');

        // ── Controls visibility ─────────────
        let hideTimer = null;

        function showControls() {
            clearTimeout(hideTimer);
            centerCtrl?.classList.add('visible');
            bottomCtrl?.classList.add('visible');
            wrapper.style.cursor = 'default';
            if (video && !video.paused) {
                hideTimer = setTimeout(hideControls, 3000);
            }
        }

        function hideControls() {
            if (video?.paused) return;
            centerCtrl?.classList.remove('visible');
            bottomCtrl?.classList.remove('visible');
            wrapper.style.cursor = 'none';
        }

        const onWrapperMove  = () => showControls();
        const onWrapperLeave = () => { if (!video?.paused) hideControls(); };
        wrapper.addEventListener('mousemove',  onWrapperMove,  { passive: true });
        wrapper.addEventListener('mouseleave', onWrapperLeave);

        // ── Play / Pause ────────────────────
        function togglePlay() {
            if (!video) return;
            video.paused ? video.play().catch(() => {}) : video.pause();
        }

        function syncPlayIcons(paused) {
            overlay.querySelectorAll('.pi-play').forEach(el  => el.style.display = paused ? '' : 'none');
            overlay.querySelectorAll('.pi-pause').forEach(el => el.style.display = paused ? 'none' : '');
        }

        const onPlay  = () => { syncPlayIcons(false); showControls(); };
        const onPause = () => { syncPlayIcons(true);  showControls(); clearTimeout(hideTimer); };
        video?.addEventListener('play',  onPlay);
        video?.addEventListener('pause', onPause);
        syncPlayIcons(true);

        $('player-click-zone')?.addEventListener('click', togglePlay);
        $('center-play-btn')?.addEventListener('click', e => { e.stopPropagation(); togglePlay(); });
        $('play-pause-btn')?.addEventListener('click', togglePlay);

        // ── Skip ────────────────────────────
        function skipBy(s) {
            if (!video) return;
            video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + s));
            showControls();
        }

        $('skip-back-center')?.addEventListener('click', e => { e.stopPropagation(); skipBy(-10); });
        $('skip-fwd-center')?.addEventListener('click', e => { e.stopPropagation(); skipBy(10); });
        $('skip-back-btn')?.addEventListener('click', () => skipBy(-10));
        $('skip-fwd-btn')?.addEventListener('click', () => skipBy(10));

        // ── Seek bar ────────────────────────
        let isSeeking = false;

        function pctFromMouse(e) {
            const rect = seekBar.getBoundingClientRect();
            return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        }

        seekCont?.addEventListener('mousedown', e => {
            isSeeking = true;
            if (video?.duration) video.currentTime = pctFromMouse(e) * video.duration;
        });

        const onDocMove = e => {
            if (!isSeeking) return;
            if (video?.duration) video.currentTime = pctFromMouse(e) * video.duration;
        };
        const onDocUp = () => { isSeeking = false; };
        document.addEventListener('mousemove', onDocMove);
        document.addEventListener('mouseup',   onDocUp);

        // Tooltip + aperçu image au survol
        const previewBox = $('seek-preview');
        seekCont?.addEventListener('mousemove', e => {
            if (!video?.duration) return;
            const pct  = pctFromMouse(e);
            const rect = seekCont.getBoundingClientRect();
            const x    = pct * rect.width;
            const t    = pct * video.duration;

            const showPreviewBox = () => {
                const pw = previewBox.offsetWidth || 160;
                previewBox.style.left = Math.max(pw / 2, Math.min(rect.width - pw / 2, x)) + 'px';
                previewBox.style.opacity = '1';
                const tl = document.getElementById('seek-preview-time');
                if (tl) tl.textContent = formatTime(t);
                if (seekTooltip) seekTooltip.style.opacity = '0';
            };

            if (twitchStoryboard && previewBox) {
                // Twitch : vignette du storyboard natif (instantané, aucun flux)
                drawTwitchPreviewAt(t);
                showPreviewBox();
                return;
            }

            ensureSeekPreview();   // création paresseuse au 1er survol (no-op ensuite)

            if (previewVideo && previewReady && previewBox) {
                // Kick : on dessine la frame extraite et on affiche le temps
                requestPreviewAt(t);
                showPreviewBox();
            } else if (seekTooltip) {
                // Repli : tooltip de temps seul (mobile, clips, Safari natif, aperçu pas prêt)
                const half = seekTooltip.offsetWidth / 2;
                seekTooltip.style.left    = Math.max(half, Math.min(rect.width - half, x)) + 'px';
                seekTooltip.textContent   = formatTime(t);
                seekTooltip.style.opacity = '1';
            }
        });
        seekCont?.addEventListener('mouseleave', () => {
            if (seekTooltip) seekTooltip.style.opacity = '0';
            if (previewBox)  previewBox.style.opacity  = '0';
        });

        // Touch seek
        seekCont?.addEventListener('touchstart', e => {
            isSeeking = true;
            const t = e.touches[0];
            if (video?.duration) video.currentTime = pctFromMouse(t) * video.duration;
        }, { passive: true });
        seekCont?.addEventListener('touchmove', e => {
            if (!isSeeking) return;
            const t = e.touches[0];
            if (video?.duration) video.currentTime = pctFromMouse(t) * video.duration;
        }, { passive: true });
        seekCont?.addEventListener('touchend', () => { isSeeking = false; });

        // ── Seek UI update ──────────────────
        function updateSeekUI() {
            if (!video) return;
            const dur = video.duration || 0;
            const cur = video.currentTime || 0;
            const pct = dur ? (cur / dur * 100) : 0;
            if (seekProg)  seekProg.style.width  = pct + '%';
            if (seekThumb) seekThumb.style.left  = pct + '%';
            if (timeCur)   timeCur.textContent   = formatTime(cur);
            if (timeDur)   timeDur.textContent   = formatTime(dur);
            if (seekBuf && video.buffered.length) {
                const bEnd = video.buffered.end(video.buffered.length - 1);
                seekBuf.style.width = (dur ? bEnd / dur * 100 : 0) + '%';
            }
        }

        const onTimeUpdate = () => updateSeekUI();
        const onProgress   = () => updateSeekUI();
        const onMetadata   = () => { updateSeekUI();  };
        video?.addEventListener('timeupdate',     onTimeUpdate);
        video?.addEventListener('progress',       onProgress);
        video?.addEventListener('loadedmetadata', onMetadata);

        // ── Volume ──────────────────────────
        const savedVol = parseFloat(localStorage.getItem('ksn_vol') ?? '1');
        if (video)    video.volume = Math.max(0, Math.min(1, savedVol));
        if (volRange) volRange.value = savedVol;
        setVolBg(savedVol);

        function setVolBg(v) {
            const p = Math.round(v * 100);
            if (volRange) volRange.style.background =
                `linear-gradient(to right, #53fc18 ${p}%, rgba(255,255,255,0.18) ${p}%)`;
        }

        function syncMuteIcons() {
            const muted = !video || video.muted || video.volume === 0;
            overlay.querySelectorAll('.pi-vol').forEach(el  => el.style.display = muted ? 'none' : '');
            overlay.querySelectorAll('.pi-mute').forEach(el => el.style.display = muted ? '' : 'none');
        }

        const onMuteClick = () => {
            if (!video) return;
            video.muted = !video.muted;
            if (volRange) { volRange.value = video.muted ? 0 : video.volume; setVolBg(video.muted ? 0 : video.volume); }
            syncMuteIcons();
        };
        $('mute-btn')?.addEventListener('click', onMuteClick);

        const onVolInput = e => {
            const v = parseFloat(e.target.value);
            if (video) { video.volume = v; video.muted = v === 0; }
            setVolBg(v);
            syncMuteIcons();
            localStorage.setItem('ksn_vol', v);
        };
        volRange?.addEventListener('input', onVolInput);

        const onVolumeChange = () => syncMuteIcons();
        video?.addEventListener('volumechange', onVolumeChange);
        syncMuteIcons();

        // ── Fullscreen ──────────────────────
        const onFsClick = () => {
            if (!document.fullscreenElement) wrapper.requestFullscreen?.().catch(() => {});
            else document.exitFullscreen?.();
        };
        fsBtn?.addEventListener('click', onFsClick);

        const onFsChange = () => {
            const isFs = !!document.fullscreenElement;
            overlay.querySelectorAll('.pi-fsin').forEach(el  => el.style.display = isFs ? 'none' : '');
            overlay.querySelectorAll('.pi-fsout').forEach(el => el.style.display = isFs ? '' : 'none');
        };
        document.addEventListener('fullscreenchange', onFsChange);

        // ── Playback Speed ──────────────────
        const speedMenu  = $('speed-menu');
        const speedLabel = $('speed-label');
        $('speed-btn')?.addEventListener('click', e => {
            e.stopPropagation();
            speedMenu?.classList.toggle('open');
        });
        speedMenu?.querySelectorAll('.speed-opt').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const speed = parseFloat(btn.dataset.speed);
                if (video) video.playbackRate = speed;
                if (speedLabel) speedLabel.textContent = speed === 1 ? '1×' : `${speed}×`;
                speedMenu?.querySelectorAll('.speed-opt').forEach(b => b.classList.toggle('active', b === btn));
                speedMenu?.classList.remove('open');
            });
        });
        const onDocClickSpeed = () => speedMenu?.classList.remove('open');
        document.addEventListener('click', onDocClickSpeed);

        // ── Picture-in-Picture ──────────────
        $('pip-btn')?.addEventListener('click', () => {
            if (!video) return;
            if (document.pictureInPictureElement) {
                document.exitPictureInPicture().catch(() => {});
            } else {
                video.requestPictureInPicture().catch(() => {
                    showToast('warning', 'PiP non supporté', 'Votre navigateur ne supporte pas le mode Picture-in-Picture.', 3000);
                });
            }
        });

        // ── Theater mode ────────────────────
        const theaterBtn = $('theater-btn');
        function toggleTheater() {
            const entering = !playerSection?.classList.contains('theater-mode');
            playerSection?.classList.toggle('theater-mode');
            document.body.classList.toggle('theater-mode-active', entering);
            theaterBtn?.classList.toggle('theater-active', entering);
            // En cinéma : la hauteur est gérée en CSS (on efface l'inline).
            // En sortie : on réaccroche la hauteur du chat sur la carte.
            syncChatHeight();

            if (entering) showTheaterHint();
        }
        theaterBtn?.addEventListener('click', toggleTheater);

        function showTheaterHint() {
            document.querySelector('.theater-hint')?.remove();
            const hint = document.createElement('div');
            hint.className = 'theater-hint';
            hint.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M19 7H5c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm0 10H5V9h14v8z"/></svg> Mode cinéma &nbsp;·&nbsp; <kbd>T</kbd> ou <kbd>Échap</kbd> pour quitter`;
            document.body.appendChild(hint);
            setTimeout(() => hint.remove(), 3200);
        }

        // ── Keyboard shortcuts ──────────────
        const onKeyDown = e => {
            if (playerSection?.style.display === 'none') return;
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
            switch (e.key) {
                case ' ': case 'k': e.preventDefault(); togglePlay(); break;
                case 'ArrowLeft':   e.preventDefault(); skipBy(-10); break;
                case 'ArrowRight':  e.preventDefault(); skipBy(10);  break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (video) { video.volume = Math.min(1, video.volume + 0.1); if (volRange) { volRange.value = video.volume; setVolBg(video.volume); } syncMuteIcons(); }
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    if (video) { video.volume = Math.max(0, video.volume - 0.1); if (volRange) { volRange.value = video.volume; setVolBg(video.volume); } syncMuteIcons(); }
                    break;
                case 'f': case 'F': e.preventDefault(); onFsClick(); break;
                case 'm': case 'M': e.preventDefault(); onMuteClick(); break;
                case 'p': case 'P': e.preventDefault(); $('pip-btn')?.click(); break;
                case 't': case 'T': e.preventDefault(); toggleTheater(); break;
                case '?': e.preventDefault(); toggleShortcutsHelp(); break;
                case 'Escape':
                    if (document.getElementById('shortcuts-overlay')) { e.preventDefault(); toggleShortcutsHelp(false); }
                    else if (playerSection?.classList.contains('theater-mode')) {
                        e.preventDefault(); toggleTheater();
                    }
                    break;
                case 'v': case 'V': e.preventDefault(); $('speed-btn')?.click(); break;
                default:
                    // 0-9 : seek à x*10% de la durée
                    if (/^[0-9]$/.test(e.key) && video && video.duration && isFinite(video.duration)) {
                        e.preventDefault();
                        video.currentTime = (parseInt(e.key) / 10) * video.duration;
                        showControls();
                    }
            }
            showControls();
        };
        document.addEventListener('keydown', onKeyDown);

        // ── Double-clic = plein écran ───────────────
        // Attaché au wrapper (capte le double-clic même quand les 2 clics tombent
        // sur des éléments différents — ex. le bouton central qui apparaît à la pause).
        // On ignore seulement la barre de contrôles du bas : double-cliquer play/pause,
        // muet, vitesse, etc. ne doit PAS basculer le plein écran.
        const onDblClick = e => {
            if (e.target.closest('.player-bottom-controls')) return;
            onFsClick();
        };
        wrapper.addEventListener('dblclick', onDblClick);

        showControls();

        return () => {
            document.removeEventListener('mousemove',        onDocMove);
            document.removeEventListener('mouseup',          onDocUp);
            document.removeEventListener('fullscreenchange', onFsChange);
            document.removeEventListener('keydown',          onKeyDown);
            document.removeEventListener('click',            onDocClickSpeed);
            wrapper.removeEventListener('mousemove',  onWrapperMove);
            wrapper.removeEventListener('mouseleave', onWrapperLeave);
            wrapper.removeEventListener('dblclick', onDblClick);
            video?.removeEventListener('play',           onPlay);
            video?.removeEventListener('pause',          onPause);
            video?.removeEventListener('timeupdate',     onTimeUpdate);
            video?.removeEventListener('progress',       onProgress);
            video?.removeEventListener('loadedmetadata', onMetadata);
            video?.removeEventListener('volumechange',   onVolumeChange);
            video?.removeEventListener('ended',          onVideoEnded);
            clearTimeout(hideTimer);
        };
    }

    // ── Populate HLS Quality Levels ─────────
    function populateQualityLevels() {
        if (!hls || !hls.levels?.length) return;
        const sorted = hls.levels.map((l, i) => ({ ...l, index: i }))
            .sort((a, b) => (b.height || 0) - (a.height || 0));
        const opts = `<option value="-1">Auto</option>` +
            sorted.map(l => `<option value="${l.index}">${l.height ? `${l.height}p` : `Niveau ${l.index + 1}`}</option>`).join('');
        const deskSel = document.getElementById('quality-select-player');
        if (deskSel) {
            deskSel.innerHTML = opts;
            document.getElementById('quality-ctrl-wrap')?.style.setProperty('display', 'flex');
        }
        const mobSel = document.getElementById('quality_select_mobile');
        if (mobSel) {
            mobSel.innerHTML = opts;
            if (!mobSel.dataset.wired) {
                mobSel.addEventListener('change', e => {
                    if (hls) {
                        hls.currentLevel = parseInt(e.target.value);
                        const d = document.getElementById('quality-select-player');
                        if (d) d.value = e.target.value;
                    }
                });
                mobSel.dataset.wired = '1';
            }
        }
    }

    // ── Chat Scroll Detection ───────────────
    function handleChatScroll() {
        if (!chatList) return;
        const fromBottom = chatList.scrollHeight - chatList.scrollTop - chatList.clientHeight;
        isUserScrolled = fromBottom > 80;
        document.getElementById('chat-scroll-btn')?.classList.toggle('visible', isUserScrolled);
    }

    // ── Go Back to Home ─────────────────────
    function goBackHome() {
        chatActiveSession++;
        stopTwitchChat();
        hls?.destroy(); hls = null;
        destroySeekPreview();
        if (video) video.src = '';

        playerCleanup?.();
        playerCleanup = null;
        stopChatHeightSync();
        document.getElementById('shortcuts-overlay')?.remove();
        document.getElementById('player-overlay')?.remove();
        playerSection?.classList.remove('theater-mode');
        document.body.classList.remove('theater-mode-active');
        document.querySelector('.theater-hint')?.remove();

        chatList?.removeEventListener('scroll', handleChatScroll);
        if (playerSection) playerSection.style.display = 'none';
        if (heroSection)   heroSection.style.display   = '';
        document.querySelector('#home-view .how-it-works')?.style.removeProperty('display');
        document.getElementById('trending-section')?.style.removeProperty('display');
        // Ré-affiche la sidebar chat (masquée par les clips)
        document.getElementById('vod-chat-sidebar')?.style.removeProperty('display');
        if (urlInput) urlInput.value = '';
        const chatHeader = document.querySelector('.chat-header-title');
        if (chatHeader) chatHeader.textContent = 'Chat de la VOD';
        // Remove related VODs panel
        document.getElementById('related-vods-section')?.remove();
    }

    // ── Chat Logic ──────────────────────────
    // Sauvegarde la progression toutes les 5s (sauf tout près de la fin).
    function maybeSaveProgress() {
        if (!video) return;
        const now = Date.now();
        if (now - lastProgressSave > 5000) {
            lastProgressSave = now;
            if (video.duration && video.duration - video.currentTime > 30) {
                saveProgress(currentVODUrl, video.currentTime);
            }
        }
    }

    function handleTimeUpdate() {
        if (!video) return;
        updateUIChat(video.currentTime);
        maybeSaveProgress();
    }

    function handleSeeking() {
        chatActiveSession++;
        chatMessages      = [];
        lastRenderedMsgId = null;
        isUserScrolled    = false;
        if (chatList) chatList.innerHTML = '<div class="chat-status">Synchronisation…</div>';
        startChatLoop(chatActiveSession);
    }

    async function startChatLoop(sessionId) {
        while (chatActiveSession === sessionId) {
            try {
                if (!video || !videoStartTime || !chatChannelId) { await sleep(2000); continue; }
                const target = new Date(videoStartTime.getTime() + video.currentTime * 1000);
                const res    = await fetch(`/api/chat?channel_id=${chatChannelId}&start_time=${target.toISOString()}`);
                if (!res.ok) { await sleep(5000); continue; }
                const data = await res.json();
                if (chatActiveSession !== sessionId) break;
                const msgs = data.messages || data.data?.messages || [];
                if (msgs.length) {
                    let added = false;
                    msgs.forEach(msg => { if (!chatMessages.some(m => m.id === msg.id)) { chatMessages.push(msg); added = true; } });
                    if (added) {
                        chatMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                        if (chatMessages.length > 600) chatMessages = chatMessages.slice(-600);
                        updateUIChat(video.currentTime);
                    }
                } else if (chatMessages.length === 0) {
                    const s = chatList?.querySelector('.chat-status');
                    if (s) s.textContent = 'Pas de messages pour le moment.';
                }
                await sleep(5000);
            } catch (e) {
                console.error('Chat Error:', e);
                await sleep(10000);
            }
        }
    }

    function updateUIChat(currentSeconds) {
        if (!videoStartTime || !chatList) return;
        const absTime = videoStartTime.getTime() + currentSeconds * 1000;
        let limit = -1;
        for (let i = chatMessages.length - 1; i >= 0; i--) {
            if (new Date(chatMessages[i].created_at).getTime() <= absTime) { limit = i; break; }
        }
        if (limit === -1) return;
        const lastM = chatMessages[limit];
        if (!lastM || lastRenderedMsgId === lastM.id) return;
        const subset = chatMessages.slice(Math.max(0, limit - 100), limit + 1);
        const existingIds = new Set();
        chatList.querySelectorAll('.chat-message[data-id]').forEach(el => existingIds.add(el.dataset.id));
        chatList.querySelector('.chat-status')?.remove();
        let appended = false;
        subset.forEach(msg => {
            if (!msg.sender || existingIds.has(String(msg.id))) return;
            const time  = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const color  = resolveUsernameColor(msg.sender.identity?.color);
            const badges = renderBadges(msg.sender.identity?.badges);
            const div    = document.createElement('div');
            div.className  = 'chat-message';
            div.dataset.id = String(msg.id);
            div.innerHTML  = `<span class="chat-time">${time}</span> ${badges}<span class="chat-username" style="color:${color}">${escapeHtml(msg.sender.username)}</span><span style="color:var(--text-muted)">:</span> <span class="chat-content">${renderChatContent(msg.content || '')}</span>`;
            chatList.appendChild(div);
            appended = true;
        });
        while (chatList.children.length > 150) chatList.removeChild(chatList.firstChild);
        lastRenderedMsgId = lastM.id;
        if (appended && !isUserScrolled) chatList.scrollTop = chatList.scrollHeight;
    }

    // ── Chat replay Twitch ──────────────────────────────────────────────────
    // Polling par offset au niveau de la tête de lecture : on bufferise les
    // commentaires à venir et on les affiche quand la lecture les atteint.
    let twitchChatBuf = [];
    let twitchSeenIds = new Set();
    let twitchVodId   = null;
    let twitchOnTime  = null;
    let twitchOnSeek  = null;

    function ensureChatScrollBtn() {
        if (!chatList || document.getElementById('chat-scroll-btn')) return;
        const btn = document.createElement('button');
        btn.id = 'chat-scroll-btn';
        btn.className = 'chat-scroll-btn';
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><path d="m6 9 6 6 6-6"/></svg> Bas du chat`;
        btn.addEventListener('click', () => {
            chatList.scrollTop = chatList.scrollHeight;
            isUserScrolled = false;
            btn.classList.remove('visible');
        });
        chatList.parentNode?.insertBefore(btn, chatList.nextSibling);
    }

    function stopTwitchChat() {
        if (twitchOnTime) video?.removeEventListener('timeupdate', twitchOnTime);
        if (twitchOnSeek) video?.removeEventListener('seeking', twitchOnSeek);
        twitchOnTime = twitchOnSeek = null;
    }

    function resetTwitchChat() {
        twitchChatBuf = [];
        twitchSeenIds = new Set();
        if (chatList) chatList.innerHTML = '<div class="chat-status">Synchronisation…</div>';
    }

    function startTwitchChat(vodId, sessionId) {
        stopTwitchChat();
        twitchVodId   = vodId;
        twitchChatBuf = [];
        twitchSeenIds = new Set();
        isUserScrolled = false;
        if (!vodId || !chatList) return;
        chatList.innerHTML = `<div class="chat-status">${t('chat_loading')}</div>`;

        chatList.removeEventListener('scroll', handleChatScroll);
        chatList.addEventListener('scroll', handleChatScroll, { passive: true });
        ensureChatScrollBtn();

        twitchOnTime = () => { renderTwitchChat(); maybeSaveProgress(); };
        twitchOnSeek = () => resetTwitchChat();
        video?.addEventListener('timeupdate', twitchOnTime);
        video?.addEventListener('seeking', twitchOnSeek);

        twitchChatPoll(sessionId);
    }

    async function twitchChatPoll(sessionId) {
        while (chatActiveSession === sessionId) {
            try {
                if (!video || !twitchVodId) { await sleep(1500); continue; }
                const off = Math.max(0, Math.floor(video.currentTime));
                const res = await fetch(`/api/twitch/chat?vod=${twitchVodId}&offset=${off}`);
                if (chatActiveSession !== sessionId) break;
                if (res.ok) {
                    const data = await res.json();
                    let added = false;
                    (data.comments || []).forEach(c => {
                        if (c.id && !twitchSeenIds.has(c.id)) {
                            twitchSeenIds.add(c.id); twitchChatBuf.push(c); added = true;
                        }
                    });
                    if (added) {
                        twitchChatBuf.sort((a, b) => a.offset - b.offset);
                        if (twitchChatBuf.length > 1500) {
                            twitchChatBuf = twitchChatBuf.slice(-1500);
                            twitchSeenIds = new Set(twitchChatBuf.map(c => c.id));
                        }
                    }
                    renderTwitchChat();
                    const s = chatList?.querySelector('.chat-status');
                    if (s && !twitchChatBuf.length) s.textContent = 'Pas de messages sur ce passage.';
                }
                await sleep(3000);
            } catch (e) {
                console.warn('Erreur chat Twitch:', e);
                const s = chatList?.querySelector('.chat-status');
                if (s && !twitchChatBuf.length) {
                    s.textContent = 'Erreur réseau. Reconnexion...';
                }
                await sleep(6000);
            }
        }
    }

    function renderTwitchChat() {
        if (!chatList || !video) return;
        const t = video.currentTime;
        const existing = new Set();
        chatList.querySelectorAll('.chat-message[data-id]').forEach(el => existing.add(el.dataset.id));
        let appended = false;
        twitchChatBuf.forEach(c => {
            if (c.offset > t || existing.has(String(c.id))) return;
            chatList.querySelector('.chat-status')?.remove();
            const color = resolveUsernameColor(c.color);
            const badges = (c.badges || []).map(b =>
                `<img class="chat-badge-img" src="${b.url}" alt="" title="${escapeHtml(b.title || '')}" loading="lazy">`).join('');
            const body = (c.frags || []).map(f => f.emote
                ? `<img class="chat-emote" src="${f.emote}" alt=":${escapeHtml(f.name || '')}:" title=":${escapeHtml(f.name || '')}:" loading="lazy">`
                : escapeHtml(f.text || '')).join('');
            const div = document.createElement('div');
            div.className  = 'chat-message';
            div.dataset.id = String(c.id);
            div.innerHTML  = `<span class="chat-time">${formatTime(c.offset)}</span> ${badges}<span class="chat-username" style="color:${color}">${escapeHtml(c.user)}</span><span style="color:var(--text-muted)">:</span> <span class="chat-content">${body}</span>`;
            chatList.appendChild(div);
            existing.add(String(c.id));
            appended = true;
        });
        while (chatList.children.length > 150) chatList.removeChild(chatList.firstChild);
        if (appended && !isUserScrolled) chatList.scrollTop = chatList.scrollHeight;
    }

    // ── Streamer Search ─────────────────────
    function formatDuration(ms) {
        if (!ms) return '';
        // Kick API returns duration in milliseconds
        const seconds = Math.floor(ms / 1000);
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    function formatVodDate(dateStr) {
        if (!dateStr) return '';
        try {
            return new Date(dateStr.replace(' ', 'T') + 'Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch (_) { return ''; }
    }

    const tabUrl      = document.getElementById('tab-url');
    const tabStreamer = document.getElementById('tab-streamer');
    const panelUrl    = document.getElementById('url-input-section');
    const panelStream = document.getElementById('streamer-search-section');
    const vodsGrid    = document.getElementById('vods_grid_container');
    const streamerInput = document.getElementById('streamer_name_input');

    function switchToTab(tab) {
        const isUrl = tab === 'url';
        tabUrl?.classList.toggle('active', isUrl);
        tabStreamer?.classList.toggle('active', !isUrl);
        if (panelUrl)    panelUrl.style.display    = isUrl ? '' : 'none';
        if (panelStream) panelStream.style.display = isUrl ? 'none' : '';
        if (isUrl && vodsGrid) vodsGrid.style.display = 'none';
    }

    tabUrl?.addEventListener('click', () => switchToTab('url'));
    tabStreamer?.addEventListener('click', () => { switchToTab('streamer'); streamerInput?.focus(); });

    // Context for related VODs panel shown below the player
    let _lastStreamerVods = [];
    let _lastStreamerInfo = null;

    let _streamerPlatform = 'kick';

    async function fetchStreamerVods(slug) {
        if (!slug || !vodsGrid) return;
        slug = slug.trim().toLowerCase();
        const platform = _streamerPlatform;
        const cacheKey = (platform === 'twitch' ? 'tw:' : '') + slug;

        // Utilise le cache si disponible
        const cached = getCachedStreamer(cacheKey);
        if (cached) {
            _lastStreamerVods = cached.vods;
            _lastStreamerInfo = cached.streamer;
            renderVodsGrid(cached.streamer, cached.vods);
            return;
        }

        const btn = document.getElementById('streamer-search-btn');
        const origHTML = btn?.innerHTML;
        if (btn) { btn.disabled = true; btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> ${escapeHtml(t('searching', 'Recherche…'))}`; }
        vodsGrid.style.display = 'block';
        // Skeleton de chargement
        vodsGrid.innerHTML = `
            <div class="vods-streamer-header vods-skeleton-header">
                <div class="vods-skeleton vods-skeleton-avatar"></div>
                <div>
                    <div class="vods-skeleton vods-skeleton-name"></div>
                    <div class="vods-skeleton vods-skeleton-count"></div>
                </div>
            </div>
            <div class="vods-grid">
                ${Array(6).fill('<div class="vod-skeleton-card"><div class="vod-skeleton-thumb vods-skeleton"></div><div class="vod-skeleton-info"><div class="vods-skeleton vods-skeleton-title"></div><div class="vods-skeleton vods-skeleton-meta"></div></div></div>').join('')}
            </div>`;
        try {
            const endpoint = platform === 'twitch'
                ? `/api/twitch/streamer_vods?login=${encodeURIComponent(slug)}`
                : `/api/streamer_vods?slug=${encodeURIComponent(slug)}`;
            const res  = await fetch(endpoint);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Streamer introuvable');
            _lastStreamerVods = data.vods || [];
            _lastStreamerInfo = data.streamer || null;
            setCachedStreamer(cacheKey, { vods: _lastStreamerVods, streamer: _lastStreamerInfo });
            renderVodsGrid(data.streamer, data.vods);
        } catch (err) {
            vodsGrid.innerHTML = `<div class="vods-status vods-error"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>${escapeHtml(err.message)}</div>`;
        } finally {
            if (btn && origHTML) { btn.disabled = false; btn.innerHTML = origHTML; }
        }
    }

    function renderVodsGrid(streamer, vods) {
        if (!vodsGrid) return;
        if (!vods.length) {
            vodsGrid.innerHTML = `<div class="vods-status">Aucune VOD trouvée pour <strong>${escapeHtml(streamer.name || streamer.slug)}</strong>.</div>`;
            return;
        }
        vodsGrid.innerHTML = `
            <div class="vods-streamer-header">
                <img src="${escapeHtml(streamer.avatar || '')}" class="vods-streamer-avatar" alt="" onerror="this.style.display='none'">
                <div>
                    <div class="vods-streamer-name">${escapeHtml(streamer.name || streamer.slug)}</div>
                    <div class="vods-streamer-count">${vods.length} VOD${vods.length > 1 ? 's' : ''} disponible${vods.length > 1 ? 's' : ''}</div>
                </div>
            </div>
            <div class="vods-grid">
                ${vods.map(vod => {
                    const savedSec = getSavedProgress(vod.url);
                    const totalSec = vod.duration ? Math.floor(vod.duration / 1000) : 0;
                    const pct = (totalSec > 0 && savedSec > 0) ? Math.min(100, Math.round((savedSec / totalSec) * 100)) : 0;
                    const metaObj = {
                        url: vod.url,
                        title: vod.title,
                        streamer: streamer.name || streamer.slug,
                        avatar: streamer.avatar || '',
                        duration: vod.duration || 0,
                        thumbnail: vod.thumbnail || ''
                    };
                    return `
                    <div class="vod-result-card" data-url="${escapeHtml(vod.url)}" data-thumb="${escapeHtml(vod.thumbnail || '')}">
                        <div class="vod-result-thumb">
                            <div class="vod-skeleton"></div>
                            ${vod.thumbnail ? `<img src="${escapeHtml(vod.thumbnail)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
                            ${vod.duration  ? `<span class="vod-result-duration">${formatDuration(vod.duration)}</span>` : ''}
                            <div class="vod-result-play-overlay"><svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M8 5v14l11-7z"/></svg></div>
                            ${pct > 0 ? `<div class="history-progress-bar"><div class="history-progress-fill" style="width:${pct}%"></div></div>` : ''}
                            ${getMiniFavBtn(metaObj)}
                        </div>
                        <div class="vod-result-info">
                            <div class="vod-result-title">${escapeHtml(vod.title)}</div>
                            <div class="vod-result-meta">
                                ${vod.date ? `<span>${timeAgo(vod.date.replace(' ', 'T') + 'Z')}</span>` : ''}
                                ${vod.views ? `<span>${vod.views.toLocaleString('fr-FR')} vues</span>` : ''}
                            </div>
                        </div>
                    </div>`;
                }).join('')}
            </div>`;

        vodsGrid.querySelectorAll('.vod-result-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.mini-fav-btn')) return;
                const url   = card.dataset.url;
                const title = card.querySelector('.vod-result-title')?.textContent || '';
                const thumb = card.dataset.thumb || '';
                if (urlInput) urlInput.value = url;
                switchToTab('url');
                showToast('success', t('loading'), title || t('loading_vod'), 3000);
                fetchStreamUrl(url, true, title, thumb);
            });
        });
    }

    // Sélecteur de plateforme (Kick / Twitch) pour la recherche par streamer
    document.querySelectorAll('#streamer-platform-toggle .platform-opt').forEach(btn => {
        btn.addEventListener('click', () => {
            _streamerPlatform = btn.dataset.platform;
            document.querySelectorAll('#streamer-platform-toggle .platform-opt')
                .forEach(b => b.classList.toggle('active', b === btn));
            const slug = streamerInput?.value.trim();
            if (slug && slug.length >= 2) fetchStreamerVods(slug);   // relance sur la nouvelle plateforme
        });
    });

    document.getElementById('streamer-search-btn')?.addEventListener('click', () => {
        const slug = streamerInput?.value.trim();
        if (!slug) { streamerInput?.focus(); return; }
        fetchStreamerVods(slug);
    });

    // Recherche en temps réel avec debounce 450ms
    const debouncedSearch = debounce((slug) => {
        if (slug.length >= 2) fetchStreamerVods(slug);
    }, 450);

    streamerInput?.addEventListener('input', e => {
        const slug = e.target.value.trim();
        if (slug.length >= 2) {
            vodsGrid.style.display = 'block';
            debouncedSearch(slug);
        } else if (!slug) {
            vodsGrid.style.display = 'none';
        }
    });

    streamerInput?.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
            const slug = streamerInput.value.trim();
            if (slug) fetchStreamerVods(slug);
        }
    });

    // ── SPA Navigation ──────────────────────
    const views = document.querySelectorAll('.view-section');

    function showView(viewId) {
        goBackHome();
        views.forEach(v => {
            const active = v.id === viewId;
            v.style.display = active ? '' : 'none';
            v.classList.toggle('active', active);
        });
        if (playerSection) playerSection.style.display = 'none';
        window.scrollTo(0, 0);
        
        if (viewId === 'history-view') {
            renderHistory();
            setupHistoryFilter();
        } else if (viewId === 'favorites-view') {
            renderFavorites();
            updateFavBadge();
        } else if (viewId === 'stats-view') {
            renderStats();
        } else if (viewId === 'home-view') {
            loadTrending();
        }
    }

    // ── Tendances (accueil) ─────────────────
    let _trendingLoaded = false;
    async function loadTrending(force = false) {
        const section = document.getElementById('trending-section');
        const grid    = document.getElementById('trending-grid');
        if (!section || !grid) return;
        
        // Tab switching logic
        const tabs = section.querySelectorAll('.search-tab');
        const gridKick = document.getElementById('trending-grid');
        const gridTwitch = document.getElementById('trending-twitch-grid');
        
        tabs.forEach(tBtn => {
            tBtn.addEventListener('click', () => {
                tabs.forEach(btn => btn.classList.remove('active'));
                tBtn.classList.add('active');
                if (tBtn.dataset.tab === 'kick-trending') {
                    gridTwitch.style.display = 'none';
                    gridKick.style.display = '';
                    loadTrendingGrid(gridKick, 'kick');
                } else {
                    gridKick.style.display = 'none';
                    gridTwitch.style.display = '';
                    loadTrendingGrid(gridTwitch, 'twitch');
                }
            });
        });

        if (_trendingLoaded && !force) { section.style.display = ''; return; }
        
        section.style.display = '';
        loadTrendingGrid(gridKick, 'kick');
        
        async function loadTrendingGrid(targetGrid, platform) {
            if (targetGrid.children.length > 0 && targetGrid.querySelector('.vod-result-card, .recent-history-card') && !force) return;
            
            targetGrid.innerHTML = `<div class="vods-status" style="grid-column:1/-1;">${t('trending_loading', 'Chargement...')}</div>`;
            try {
                const lang = window.currentLang || 'en';
                const res  = await fetch(`/api/trending?platform=${platform}&lang=${lang}`);
                const data = await res.json();
                const vods = data.trending || [];
                if (!vods.length) { targetGrid.innerHTML = `<div class="vods-status" style="grid-column:1/-1;">Aucune tendance.</div>`; return; }
                
                targetGrid.innerHTML = vods.map(item => {
                    const dur = item.duration ? formatDuration(item.duration) : '';
                    const savedSec = getSavedProgress ? getSavedProgress(item.url) : 0;
                    const totalSec = item.duration ? Math.floor(item.duration / 1000) : 0;
                    const pct = (totalSec > 0 && savedSec > 0) ? Math.min(100, Math.round((savedSec / totalSec) * 100)) : 0;

                    return `
                    <a href="#" class="recent-history-card" data-vod-url="${escapeHtml(item.url)}">
                        <div class="recent-history-thumb">
                            <img src="${escapeHtml(item.thumbnail || '')}" alt="" loading="lazy" onerror="this.style.display='none'">
                            <div class="history-thumb-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32" style="opacity:0.3"><polygon points="6 3 20 12 6 21 6 3"/></svg></div>
                            <div class="history-play-overlay"><svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M8 5v14l11-7z"/></svg></div>
                            ${dur ? `<span class="history-duration-badge">${escapeHtml(dur)}</span>` : ''}
                            ${pct > 0 ? `<div class="history-progress-bar"><div class="history-progress-fill" style="width:${pct}%"></div></div>` : ''}
                            ${getMiniFavBtn(item)}
                        </div>
                        <div class="recent-history-info">
                            <h3 class="recent-history-title">${escapeHtml(item.title)}</h3>
                            <div class="history-meta-row">
                                ${item.avatar ? `<img src="${escapeHtml(item.avatar)}" class="history-streamer-avatar" alt="" onerror="this.style.display='none'">` : ''}
                                <span class="recent-history-owner">${escapeHtml(item.streamer)}</span>
                            </div>
                            ${item.views ? `<p class="history-date">${item.views.toLocaleString('fr-FR')} vues</p>` : ''}
                        </div>
                    </a>`;
                }).join('');
                
                targetGrid.querySelectorAll('.recent-history-card').forEach(card => {
                    card.addEventListener('click', e => {
                        if (e.target.closest('.mini-fav-btn')) return;
                        e.preventDefault();
                        playVOD(card.getAttribute('data-vod-url'));
                    });
                });
                _trendingLoaded = true;
            } catch (e) {
                console.error(e);
                targetGrid.innerHTML = `<div class="vods-status vods-error">Erreur de chargement: ${escapeHtml(e.message)}</div>`;
            }
        }
    }

    document.querySelectorAll('[data-action^="navigate-"]').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const viewName = link.getAttribute('data-action').replace('navigate-', '') + '-view';
            if (viewName === 'how-it-works-view') {
                showView('home-view');
                setTimeout(() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' }), 100);
            } else {
                showView(viewName);
            }
            document.getElementById('navLinks')?.classList.remove('active');
        });
    });

    document.querySelector('.logo-container')?.addEventListener('click', e => { e.preventDefault(); showView('home-view'); });

    document.querySelectorAll('[data-action="change-language"]').forEach(link => {
        link.addEventListener('click', e => { e.preventDefault(); if (window.setLanguage) window.setLanguage(link.getAttribute('data-lang')); });
    });

    document.getElementById('mobileMenuToggle')?.addEventListener('click', () => {
        document.getElementById('navLinks')?.classList.toggle('active');
    });

    // ── History ─────────────────────────────
    function saveToHistory(url, title, streamer, avatar, thumbnail, duration) {
        if (!url) return;
        let h = JSON.parse(localStorage.getItem('kicknosub_history') || '[]');
        h = h.filter(i => i.url !== url);
        h.unshift({ url, title, streamer, avatar, thumbnail, duration, date: new Date().toISOString() });
        localStorage.setItem('kicknosub_history', JSON.stringify(h.slice(0, 30)));
    }

    function timeAgo(dateStr) {
        if (!dateStr) return '';
        const dateObj = new Date(dateStr);
        if (isNaN(dateObj.getTime())) return '';
        const diff = Math.floor((Date.now() - dateObj) / 1000);
        if (diff < 60)   return 'À l\'instant';
        if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
        if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
        if (diff < 604800) return `Il y a ${Math.floor(diff / 86400)} jour${Math.floor(diff / 86400) > 1 ? 's' : ''}`;
        return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    }

    function renderHistory(filter = '') {
        const grid = document.getElementById('history-grid');
        if (!grid) return;
        let h = JSON.parse(localStorage.getItem('kicknosub_history') || '[]');
        if (filter) {
            h = h.filter(item =>
                (item.title || '').toLowerCase().includes(filter) ||
                (item.streamer || '').toLowerCase().includes(filter)
            );
        }

        // Header with clear button
        const container = grid.parentElement;
        let header = container.querySelector('.history-page-header');
        if (!header) {
            header = document.createElement('div');
            header.className = 'history-page-header';
            container.insertBefore(header, grid);
        }
        if (h.length) {
            header.innerHTML = `
                <span class="history-count">${h.length} VOD${h.length > 1 ? 's' : ''} regardée${h.length > 1 ? 's' : ''}</span>
                <button class="history-clear-btn" id="history-clear-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    Effacer l'historique
                </button>`;
            document.getElementById('history-clear-btn')?.addEventListener('click', () => {
                localStorage.removeItem('kicknosub_history');
                renderHistory();
            });
        } else {
            header.innerHTML = '';
        }

        if (!h.length) {
            grid.innerHTML = `
                <div class="history-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48" style="opacity:0.3;margin-bottom:16px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <p>Aucun historique pour le moment.</p>
                    <p style="font-size:0.82rem;opacity:0.6;">Les VODs que tu regardes apparaîtront ici.</p>
                </div>`;
            return;
        }

        grid.innerHTML = h.map(item => {
            const dur = item.duration ? formatDuration(item.duration) : '';
            const thumb = item.thumbnail || item.avatar || '';
            const savedProgress = getSavedProgress ? getSavedProgress(item.url) : 0;
            const totalSec = item.duration ? Math.floor(item.duration / 1000) : 0;
            const progressPct = (totalSec > 0 && savedProgress > 0) ? Math.min(100, Math.round((savedProgress / totalSec) * 100)) : 0;
            return `
            <a href="#" class="recent-history-card" data-vod-url="${escapeHtml(item.url)}">
                <div class="recent-history-thumb">
                    <img src="${escapeHtml(thumb)}" alt="" loading="lazy" onerror="this.style.display='none'">
                    <div class="history-thumb-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32" style="opacity:0.3"><polygon points="6 3 20 12 6 21 6 3"/></svg></div>
                    <div class="history-play-overlay"><svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M8 5v14l11-7z"/></svg></div>
                    ${dur ? `<span class="history-duration-badge">${escapeHtml(dur)}</span>` : ''}
                    ${progressPct > 0 ? `
                        <div class="history-progress-bar"><div class="history-progress-fill" style="width:${progressPct}%"></div></div>` : ''}
                    ${getMiniFavBtn(item)}
                </div>
                <div class="recent-history-info">
                    <h3 class="recent-history-title">${escapeHtml(item.title)}</h3>
                    <div class="history-meta-row">
                        ${item.avatar ? `<img src="${escapeHtml(item.avatar)}" class="history-streamer-avatar" alt="" onerror="this.style.display='none'">` : ''}
                        <span class="recent-history-owner">${escapeHtml(item.streamer)}</span>
                    </div>
                    <p class="history-date">${timeAgo(item.date || item.timestamp)}</p>
                </div>
            </a>`;
        }).join('');

        grid.querySelectorAll('.recent-history-card').forEach(card => {
            card.addEventListener('click', e => { 
                if (e.target.closest('.mini-fav-btn')) return;
                e.preventDefault(); 
                playVOD(card.getAttribute('data-vod-url')); 
            });
        });
    }

    function playVOD(url) {
        showView('home-view');
        if (urlInput) urlInput.value = url;
        setTimeout(() => loadBtn?.click(), 100);
    }
    window.playVOD = playVOD;

    // ── Swipe mobile pour naviguer entre rediffs ──
    (function setupSwipe() {
        let touchStartX = 0, touchStartY = 0;
        const wrapper = document.getElementById('video-wrapper-container');
        if (!wrapper) return;

        wrapper.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].clientX;
            touchStartY = e.changedTouches[0].clientY;
        }, { passive: true });

        wrapper.addEventListener('touchend', e => {
            if (!playerSection || playerSection.style.display === 'none') return;
            const dx = e.changedTouches[0].clientX - touchStartX;
            const dy = e.changedTouches[0].clientY - touchStartY;
            // Swipe horizontal uniquement si plus grand que vertical
            if (Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 1.5) return;

            const currentIdx = _lastStreamerVods.findIndex(v => v.url === currentVODUrl);
            if (currentIdx === -1 || !_lastStreamerVods.length) return;

            let nextIdx;
            if (dx < 0) {
                // Swipe gauche → VOD suivante
                nextIdx = (currentIdx + 1) % _lastStreamerVods.length;
            } else {
                // Swipe droite → VOD précédente
                nextIdx = (currentIdx - 1 + _lastStreamerVods.length) % _lastStreamerVods.length;
            }
            const next = _lastStreamerVods[nextIdx];
            if (!next || next.url === currentVODUrl) return;
            showToast('success', dx < 0 ? 'Suivante →' : '← Précédente', next.title || 'Rediff', 2500);
            if (urlInput) urlInput.value = next.url;
            fetchStreamUrl(next.url, true, next.title, next.thumbnail || '');
        }, { passive: true });
    })();

    // ── URLs partageables : popstate (bouton Retour navigateur) ──
    window.addEventListener('popstate', e => {
        if (e.state?.vodUrl) {
            if (urlInput) urlInput.value = e.state.vodUrl;
            fetchStreamUrl(e.state.vodUrl);
        } else {
            goBackHome();
        }
    });

    // ════════════════════════════════════════════
    // AUTO-NEXT VOD
    // ════════════════════════════════════════════
    function onVideoEnded() {
        clearTimeout(autoNextTimer);
        const currentIdx = _lastStreamerVods.findIndex(v => v.url === currentVODUrl);
        if (currentIdx === -1 || !_lastStreamerVods.length) return;
        const nextVod = _lastStreamerVods[(currentIdx + 1) % _lastStreamerVods.length];
        if (!nextVod || nextVod.url === currentVODUrl) return;

        // Créer l'overlay compte à rebours
        const wrapper = document.getElementById('video-wrapper-container');
        if (!wrapper) return;
        let countdown = 10;
        const ov = document.createElement('div');
        ov.id = 'autonext-overlay';
        ov.className = 'autonext-overlay';
        ov.innerHTML = `
            <div class="autonext-inner">
                ${nextVod.thumbnail ? `<img src="${escapeHtml(nextVod.thumbnail)}" class="autonext-thumb" alt="">` : ''}
                <div class="autonext-info">
                    <p class="autonext-label">${t('autonext_label')}</p>
                    <p class="autonext-title">${escapeHtml(nextVod.title)}</p>
                    <div class="autonext-countdown-row">
                        <span id="autonext-num">${countdown}</span>
                        <button id="autonext-cancel" class="autonext-btn autonext-btn-cancel">${t('autonext_cancel')}</button>
                        <button id="autonext-now" class="autonext-btn autonext-btn-now">${t('autonext_watch_now')}</button>
                    </div>
                </div>
            </div>`;
        wrapper.appendChild(ov);

        const launchNext = () => {
            ov.remove();
            clearInterval(iv);
            fetchStreamUrl(nextVod.url, true, nextVod.title, nextVod.thumbnail || '');
        };

        ov.querySelector('#autonext-now').addEventListener('click', launchNext);
        ov.querySelector('#autonext-cancel').addEventListener('click', () => {
            clearInterval(iv); ov.remove();
        });

        const iv = setInterval(() => {
            countdown--;
            const el = document.getElementById('autonext-num');
            if (el) el.textContent = countdown;
            if (countdown <= 0) launchNext();
        }, 1000);

        autoNextTimer = setTimeout(launchNext, 10500);
    }

    // ════════════════════════════════════════════
    // FAVORIS
    // ════════════════════════════════════════════
    function getFavorites() {
        try { return JSON.parse(localStorage.getItem('ksn_favorites') || '[]'); } catch { return []; }
    }

    function isFavorite(url) {
        return getFavorites().some(f => f.url === url);
    }

    function getMiniFavBtn(meta) {
        const isFav = isFavorite(meta.url);
        const metaStr = btoa(encodeURIComponent(JSON.stringify(meta)));
        return `
        <button class="mini-fav-btn ${isFav ? 'active' : ''}" data-meta="${metaStr}" title="${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
            <svg viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" width="14" height="14">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
        </button>`;
    }

    document.addEventListener('click', e => {
        const btn = e.target.closest('.mini-fav-btn');
        if (btn) {
            e.preventDefault();
            e.stopPropagation();
            try {
                const meta = JSON.parse(decodeURIComponent(atob(btn.dataset.meta)));
                toggleFavorite(meta);
                const isFav = isFavorite(meta.url);
                btn.classList.toggle('active', isFav);
                btn.title = isFav ? 'Retirer des favoris' : 'Ajouter aux favoris';
                const svg = btn.querySelector('svg');
                if (svg) svg.setAttribute('fill', isFav ? 'currentColor' : 'none');
                
                // Force refresh favorites grid if visible
                const favView = document.getElementById('favorites-view');
                if (favView && favView.style.display !== 'none') {
                    renderFavorites();
                }
            } catch (err) {
                console.error("Erreur toggle fav", err);
            }
        }
    });

    function toggleFavorite(meta) {
        let favs = getFavorites();
        if (favs.some(f => f.url === meta.url)) {
            favs = favs.filter(f => f.url !== meta.url);
            showToast('warning', 'Retiré des favoris', meta.title, 2500);
        } else {
            favs.unshift({ ...meta, addedAt: new Date().toISOString() });
            showToast('success', 'Ajouté aux favoris ❤', meta.title, 2500);
        }
        localStorage.setItem('ksn_favorites', JSON.stringify(favs.slice(0, 100)));
        updateFavBtn();
        updateFavBadge();
    }

    function updateFavBtn() {
        const btn = document.getElementById('btn-fav');
        if (!btn || !currentVODMeta) return;
        const fav = isFavorite(currentVODMeta.url);
        btn.classList.toggle('active', fav);
        btn.title = fav ? 'Retirer des favoris' : 'Ajouter aux favoris';
        btn.querySelector('svg')?.setAttribute('fill', fav ? 'currentColor' : 'none');
    }

    function updateFavBadge() {
        const badge = document.getElementById('fav-count-badge');
        if (!badge) return;
        const count = getFavorites().length;
        badge.textContent = count;
        badge.style.display = count > 0 ? '' : 'none';
    }

    function renderFavorites() {
        const grid = document.getElementById('favorites-grid');
        if (!grid) return;
        const favs = getFavorites();
        if (!favs.length) {
            grid.innerHTML = `
                <div class="history-empty" style="grid-column:1/-1;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48" style="opacity:0.3;margin-bottom:16px;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    <p>${escapeHtml(t('favorites_empty', 'Aucun favori pour le moment.'))}</p>
                    <p style="font-size:0.82rem;opacity:0.6;">${escapeHtml(t('favorites_empty_hint', 'Clique sur ❤ dans le player pour sauvegarder une VOD.'))}</p>
                </div>`;
            return;
        }
        grid.innerHTML = favs.map(item => {
            const dur = item.duration ? formatDuration(item.duration) : '';
            return `
            <a href="#" class="recent-history-card" data-vod-url="${escapeHtml(item.url)}">
                <div class="recent-history-thumb">
                    <img src="${escapeHtml(item.thumbnail || item.avatar || '')}" alt="" loading="lazy" onerror="this.style.display='none'">
                    <div class="history-thumb-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32" style="opacity:0.3"><polygon points="6 3 20 12 6 21 6 3"/></svg></div>
                    <div class="history-play-overlay"><svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M8 5v14l11-7z"/></svg></div>
                    ${dur ? `<span class="history-duration-badge">${escapeHtml(dur)}</span>` : ''}
                    ${getMiniFavBtn(item)}
                </div>
                <div class="recent-history-info">
                    <h3 class="recent-history-title">${escapeHtml(item.title)}</h3>
                    <div class="history-meta-row">
                        ${item.avatar ? `<img src="${escapeHtml(item.avatar)}" class="history-streamer-avatar" alt="" onerror="this.style.display='none'">` : ''}
                        <span class="recent-history-owner">${escapeHtml(item.streamer)}</span>
                    </div>
                    <p class="history-date">${timeAgo(item.addedAt)}</p>
                </div>
            </a>`;
        }).join('');

        grid.querySelectorAll('.recent-history-card').forEach(card => {
            card.addEventListener('click', e => {
                if (e.target.closest('.mini-fav-btn')) return;
                e.preventDefault();
                playVOD(card.getAttribute('data-vod-url'));
            });
        });
    }

    // Player action buttons
    document.getElementById('btn-fav')?.addEventListener('click', () => {
        if (currentVODMeta) toggleFavorite(currentVODMeta);
    });

    document.getElementById('btn-copy-link')?.addEventListener('click', () => {
        const shareUrl = `${location.origin}${location.pathname}?vod=${encodeURIComponent(currentVODUrl || '')}`;
        navigator.clipboard.writeText(shareUrl).then(() => {
            showToast('success', 'Lien copié !', shareUrl, 3000);
        }).catch(() => {
            showToast('error', 'Erreur', 'Impossible de copier dans le presse-papier.', 3000);
        });
    });

    document.getElementById('btn-share')?.addEventListener('click', () => {
        if (navigator.share) {
            navigator.share({ title: 'KickNoSub VOD', url: window.location.href });
        } else {
            prompt('Copiez ce lien:', window.location.href);
        }
    });

    document.getElementById('btn-split-view')?.addEventListener('click', () => {
        document.body.classList.toggle('split-view-active');
        const isActive = document.body.classList.contains('split-view-active');
        document.getElementById('btn-split-view').style.color = isActive ? 'var(--accent-primary)' : '';
    });

    // Modal de téléchargement
    const downloadModal = document.getElementById('download-modal');
    document.getElementById('btn-download')?.addEventListener('click', () => {
        if (!window.currentM3U8Url) {
            showToast('error', 'Erreur', t('download_not_ready'), 3000);
            return;
        }
        // URL de téléchargement : préfère l'URL brute CloudFront (Twitch) si dispo
        const dlUrl = window.currentDownloadUrl || window.currentM3U8Url;
        document.getElementById('download-m3u8-input').value = dlUrl;
        
        // Générer le nom de fichier par défaut (ex: xqc_vod_123.mp4)
        const streamer = currentVODMeta?.streamer || 'streamer';
        const dateStr = currentVODMeta?.date ? currentVODMeta.date.split(' ')[0] : 'vod';
        const filename = `${streamer}_${dateStr}.mp4`.replace(/[^a-zA-Z0-9_.-]/g, '');
        document.getElementById('download-ffmpeg-input').value = `ffmpeg -i "${dlUrl}" -c copy ${filename}`;
        
        downloadModal.style.display = 'flex';
    });

    document.getElementById('btn-close-download-modal')?.addEventListener('click', () => {
        downloadModal.style.display = 'none';
    });
    
    // Fermer si on clique en dehors du modal
    downloadModal?.addEventListener('click', (e) => {
        if (e.target === downloadModal) downloadModal.style.display = 'none';
    });

    const copyInput = (inputId, btnId) => {
        const input = document.getElementById(inputId);
        navigator.clipboard.writeText(input.value).then(() => {
            const btn = document.getElementById(btnId);
            const origText = btn.innerText;
            btn.innerText = t('copied');
            setTimeout(() => btn.innerText = origText, 2000);
            showToast('success', t('copied'), t('copied_clipboard'), 2000);
        });
    };

    document.getElementById('btn-copy-m3u8')?.addEventListener('click', () => copyInput('download-m3u8-input', 'btn-copy-m3u8'));
    document.getElementById('btn-copy-ffmpeg')?.addEventListener('click', () => copyInput('download-ffmpeg-input', 'btn-copy-ffmpeg'));

    document.getElementById('btn-share')?.addEventListener('click', () => {
        const shareUrl = `${location.origin}${location.pathname}?vod=${encodeURIComponent(currentVODUrl || '')}`;
        if (navigator.share) {
            navigator.share({
                title: currentVODMeta?.title || 'Kick VOD',
                text: `Regarde cette rediff de ${currentVODMeta?.streamer || ''} sur KickNoSub !`,
                url: shareUrl
            }).catch(() => {});
        } else {
            navigator.clipboard.writeText(shareUrl).then(() => {
                showToast('success', 'Lien copié !', 'Web Share non disponible — lien copié à la place.', 3000);
            });
        }
    });

    // ════════════════════════════════════════════
    // STATS
    // ════════════════════════════════════════════
    function renderStats() {
        const container = document.getElementById('stats-grid');
        if (!container) return;
        const h = JSON.parse(localStorage.getItem('kicknosub_history') || '[]');
        const favs = getFavorites();
        const progress = JSON.parse(localStorage.getItem('ksn_progress') || '{}');

        if (!h.length) {
            container.innerHTML = `<div class="history-empty" style="grid-column:1/-1;"><p>${escapeHtml(t('stats_empty', 'Regarde des VODs pour voir tes stats !'))}</p></div>`;
            return;
        }

        // Calcul des stats
        const totalWatchSec = Object.values(progress).reduce((a, b) => a + b, 0);
        const streamerCounts = {};
        h.forEach(v => { streamerCounts[v.streamer] = (streamerCounts[v.streamer] || 0) + 1; });
        const topStreamer = Object.entries(streamerCounts).sort((a, b) => b[1] - a[1])[0];
        const totalDurMs = h.reduce((a, v) => a + (v.duration || 0), 0);
        const avgDurMin = h.length ? Math.round((totalDurMs / h.length) / 60000) : 0;

        const cards = [
            { icon: '🎬', label: t('stat_vods_watched', 'VODs regardées'), value: h.length, sub: `dont ${favs.length} en favoris` },
            { icon: '⏱️', label: t('stat_watch_time', 'Temps visionné'), value: formatTime(totalWatchSec), sub: 'temps total de lecture' },
            { icon: '🏆', label: t('stat_top_streamer', 'Streamer favori'), value: topStreamer ? topStreamer[0] : '—', sub: topStreamer ? `${topStreamer[1]} VOD${topStreamer[1] > 1 ? 's' : ''}` : '' },
            { icon: '📏', label: t('stat_avg_duration', 'Durée moyenne'), value: avgDurMin ? `${avgDurMin} min` : '—', sub: 'par VOD' },
            { icon: '❤️', label: t('stat_favorites', 'Favoris sauvegardés'), value: favs.length, sub: 'dans ta bibliothèque' },
            { icon: '🕐', label: t('stat_last_vod', 'Dernière VOD'), value: h[0] ? timeAgo(h[0].date) : '—', sub: h[0]?.streamer || '' },
        ];

        container.innerHTML = cards.map(c => `
            <div class="stat-card">
                <div class="stat-icon">${c.icon}</div>
                <div class="stat-value">${escapeHtml(String(c.value))}</div>
                <div class="stat-label">${escapeHtml(c.label)}</div>
                ${c.sub ? `<div class="stat-sub">${escapeHtml(c.sub)}</div>` : ''}
            </div>`).join('');

        // Graphique par streamer
        const top5 = Object.entries(streamerCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
        if (top5.length > 1) {
            const maxCount = top5[0][1];
            container.innerHTML += `
                <div class="stat-chart-card" style="grid-column:1/-1;">
                    <h3 class="stat-chart-title">${escapeHtml(t('stat_top_streamers_chart', 'Top streamers'))}</h3>
                    <div class="stat-bars">
                        ${top5.map(([name, count]) => `
                        <div class="stat-bar-row">
                            <span class="stat-bar-name">${escapeHtml(name)}</span>
                            <div class="stat-bar-track">
                                <div class="stat-bar-fill" style="width:${Math.round((count / maxCount) * 100)}%"></div>
                            </div>
                            <span class="stat-bar-count">${count}</span>
                        </div>`).join('')}
                    </div>
                </div>`;
        }
    }

    // ════════════════════════════════════════════
    // FILTRE HISTORIQUE
    // ════════════════════════════════════════════
    // Injecte la barre de filtre dans la vue historique
    function setupHistoryFilter() {
        const view = document.getElementById('history-view');
        const h1 = view?.querySelector('h1');
        if (!h1 || document.getElementById('history-filter-bar')) return;
        const bar = document.createElement('div');
        bar.id = 'history-filter-bar';
        bar.className = 'history-filter-bar';
        bar.innerHTML = `<input type="search" id="history-search" class="history-search-input" placeholder="${t('history_search_placeholder')}">`;
        h1.insertAdjacentElement('afterend', bar);

        document.getElementById('history-search').addEventListener('input', e => {
            renderHistory(e.target.value.trim().toLowerCase());
        });
    }

    // Réaffiche les vues dynamiques quand la langue change
    window.onLanguageChanged = () => {
        const activeView = document.querySelector('.view-section.active')?.id;
        if (activeView === 'favorites-view') renderFavorites();
        else if (activeView === 'stats-view') renderStats();
    };

    // Charger une VOD depuis l'URL si ?vod= présent
    const urlParams = new URLSearchParams(window.location.search);
    const vodFromUrl = urlParams.get('vod');
    if (vodFromUrl && /kick\.com\/|twitch\.tv\//.test(vodFromUrl)) {
        if (urlInput) urlInput.value = vodFromUrl;
        setTimeout(() => fetchStreamUrl(vodFromUrl), 300);
    }

    updateFavBadge();
    showView('home-view');
    if (window.setLanguage) window.setLanguage('fr');

    // ── Export/Import Data ──────────────────────────────
    document.getElementById('btn-export-data')?.addEventListener('click', () => {
        const data = {
            ksn_history: localStorage.getItem('ksn_history'),
            ksn_favorites: localStorage.getItem('ksn_favorites'),
            ksn_progress: localStorage.getItem('ksn_progress')
        };
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kicknosub_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    document.getElementById('btn-import-data')?.addEventListener('click', () => {
        document.getElementById('import-data-file')?.click();
    });

    document.getElementById('import-data-file')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (data.ksn_history) {
                    const current = JSON.parse(localStorage.getItem('ksn_history') || '[]');
                    const imported = JSON.parse(data.ksn_history);
                    const merged = [...current, ...imported].filter((v, i, a) => a.findIndex(t => (t.url === v.url)) === i);
                    localStorage.setItem('ksn_history', JSON.stringify(merged));
                }
                if (data.ksn_favorites) {
                    const current = JSON.parse(localStorage.getItem('ksn_favorites') || '[]');
                    const imported = JSON.parse(data.ksn_favorites);
                    const merged = [...current, ...imported].filter((v, i, a) => a.findIndex(t => (t.url === v.url)) === i);
                    localStorage.setItem('ksn_favorites', JSON.stringify(merged));
                }
                if (data.ksn_progress) {
                    const current = JSON.parse(localStorage.getItem('ksn_progress') || '{}');
                    const imported = JSON.parse(data.ksn_progress);
                    localStorage.setItem('ksn_progress', JSON.stringify({ ...current, ...imported }));
                }
                alert('Données importées avec succès !');
                location.reload();
            } catch (err) {
                alert('Fichier invalide.');
            }
        };
        reader.readAsText(file);
    });

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/static/sw.js').catch(() => {});
        });
    }
});
