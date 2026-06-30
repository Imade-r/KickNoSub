// Server status modal, isolated from the main player/chat application code.
(function () {
    function tr(key, fallback) {
        return typeof t === 'function' ? t(key, fallback) : fallback;
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
        }[char]));
    }

    function statusPill(ok) {
        const className = ok ? 'status-pill-ok' : 'status-pill-down';
        return `<span class="${className}">${ok ? 'OK' : 'DOWN'}</span>`;
    }

    function row(label, value) {
        return `<div class="status-row"><strong>${escapeHtml(label)}</strong><span>${value}</span></div>`;
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('api-status-link')?.addEventListener('click', async e => {
            e.preventDefault();
            const modal = document.getElementById('status-modal');
            const content = document.getElementById('status-content');
            if (!modal || !content) return;

            modal.style.display = 'flex';
            content.textContent = tr('trending_loading', 'Chargement...');

            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                const services = data.services || {};
                const playback = data.playback || {};
                const appStatus = String(data.status || 'unknown').toUpperCase();
                const appStatusClass = data.status === 'online' ? 'status-pill-ok' : 'status-pill-warn';

                content.innerHTML = [
                    row('App', `<span class="${appStatusClass}">${escapeHtml(appStatus)}</span>`),
                    row('Version', escapeHtml(data.version || 'Unknown')),
                    row('Kick', statusPill(!!services.kick)),
                    row('Twitch', statusPill(!!services.twitch)),
                    row('Chat', statusPill(!!services.chat)),
                    row('Proxy', statusPill(!!services.proxy)),
                    row('Téléchargements', statusPill(!!services.downloads)),
                    row('Cache', escapeHtml(String(data.cache_keys || 0))),
                    row('Auto qualité', `${escapeHtml(String(playback.default_quality_height || 720))}p`),
                    row('Proxy max', `${escapeHtml(String(playback.max_proxy_quality_height || 720))}p`),
                    row('Direct Safari/iOS', playback.direct_twitch_native_hls ? 'ON' : 'OFF'),
                ].join('');
            } catch {
                content.innerHTML = '<span class="status-pill-down">Erreur de connexion au serveur.</span>';
            }
        });

        document.getElementById('btn-close-status-modal')?.addEventListener('click', () => {
            const modal = document.getElementById('status-modal');
            if (modal) modal.style.display = 'none';
        });
    });
})();
