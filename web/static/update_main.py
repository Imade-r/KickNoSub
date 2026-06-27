with open('main.js', 'r', encoding='utf-8') as f:
    js = f.read()

spa_logic = """

// SPA Routing and Features
document.addEventListener('DOMContentLoaded', () => {
    const views = document.querySelectorAll('.view-section');
    const navLinks = document.querySelectorAll('[data-action^="navigate-"]');

    function showView(viewId) {
        views.forEach(v => {
            if(v.id === viewId) {
                v.style.display = 'block';
                setTimeout(() => v.classList.add('active'), 10);
            } else {
                v.style.display = 'none';
                v.classList.remove('active');
            }
        });
        
        // Hide player if we are navigating away
        if(viewId !== 'player-section') {
            document.getElementById('player-section').style.display = 'none';
            if(window.hls) window.hls.stopLoad();
        }
        
        window.scrollTo(0,0);
        
        // Fetch data if needed
        if(viewId === 'trending-view') loadTrending();
        if(viewId === 'games-view') loadGames();
        if(viewId === 'history-view') renderHistory();
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const action = link.getAttribute('data-action');
            const viewName = action.replace('navigate-', '') + '-view';
            if(viewName === 'how-it-works-view') {
                showView('home-view');
                setTimeout(() => {
                    document.getElementById('how-it-works').scrollIntoView({behavior: 'smooth'});
                }, 100);
            } else {
                showView(viewName);
            }
        });
    });
    
    // Language switching
    const langLinks = document.querySelectorAll('[data-action="change-language"]');
    langLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const lang = link.getAttribute('data-lang');
            if(window.setLanguage) window.setLanguage(lang);
        });
    });

    // Trending API
    async function loadTrending() {
        const grid = document.getElementById('trending-grid');
        grid.innerHTML = '<div style="color:var(--text-muted);">Chargement...</div>';
        try {
            const res = await fetch('/api/trending');
            const data = await res.json();
            if(data.trending) {
                grid.innerHTML = data.trending.map(vod => `
                    <div class="glass-card" style="padding:10px; cursor:pointer;" onclick="playVOD('https://kick.com/video/${vod.video.uuid}')">
                        <img src="${vod.session_title ? (vod.thumbnail ? vod.thumbnail.url : '') : ''}" style="width:100%; border-radius:var(--radius-sm); margin-bottom:10px; background:#16161a; aspect-ratio:16/9; object-fit:cover;" onerror="this.src='https://kick.com/favicon.ico'">
                        <div style="font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${vod.session_title || 'VOD'}</div>
                        <div style="color:var(--text-muted); font-size:0.9em;">${vod.channel_slug}</div>
                    </div>
                `).join('');
            }
        } catch(e) {
            grid.innerHTML = '<div style="color:#ef4444;">Erreur lors du chargement des tendances.</div>';
        }
    }

    // Games API
    async function loadGames() {
        const grid = document.getElementById('games-grid');
        grid.innerHTML = '<div style="color:var(--text-muted);">Chargement...</div>';
        try {
            const res = await fetch('/api/categories');
            const data = await res.json();
            if(data && data.length) {
                grid.innerHTML = data.map(game => `
                    <div class="glass-card" style="padding:10px;">
                        <img src="${game.banner ? game.banner.url : ''}" style="width:100%; border-radius:var(--radius-sm); margin-bottom:10px; background:#16161a; aspect-ratio:3/4; object-fit:cover;">
                        <div style="font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${game.name}</div>
                    </div>
                `).join('');
            }
        } catch(e) {
            grid.innerHTML = '<div style="color:#ef4444;">Erreur lors du chargement des jeux.</div>';
        }
    }

    // History System
    function saveToHistory(url, title, streamer, avatar) {
        let history = JSON.parse(localStorage.getItem('kicknosub_history') || '[]');
        // Remove if already exists
        history = history.filter(h => h.url !== url);
        history.unshift({
            url, title, streamer, avatar, date: new Date().toISOString()
        });
        if(history.length > 20) history = history.slice(0, 20);
        localStorage.setItem('kicknosub_history', JSON.stringify(history));
    }
    
    // Make it global so initializePlayer can call it
    window.saveToHistory = saveToHistory;

    function renderHistory() {
        const grid = document.getElementById('history-grid');
        const history = JSON.parse(localStorage.getItem('kicknosub_history') || '[]');
        if(history.length === 0) {
            grid.innerHTML = '<div style="color:var(--text-muted);">Aucun historique pour le moment.</div>';
            return;
        }
        
        grid.innerHTML = history.map(h => `
            <div class="glass-card" style="padding:10px; cursor:pointer;" onclick="playVOD('${h.url}')">
                <div style="display:flex; align-items:center; margin-bottom:10px;">
                    <img src="${h.avatar || 'https://kick.com/favicon.ico'}" style="width:40px; height:40px; border-radius:50%; margin-right:10px;">
                    <div style="font-weight:bold;">${h.streamer}</div>
                </div>
                <div style="font-size:0.9em; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${h.title}</div>
            </div>
        `).join('');
    }
    
    window.playVOD = function(url) {
        document.getElementById('twitch_url').value = url;
        showView('home-view');
        document.getElementById('watch-now-btn').click();
    };

    // Override the logo to go home
    document.querySelector('.logo-container').addEventListener('click', (e) => {
        e.preventDefault();
        showView('home-view');
    });

    // Make sure we start on home
    showView('home-view');
    
    // Set default language
    if(window.setLanguage) window.setLanguage('fr');
});
"""

# Now we need to hook saveToHistory inside initializePlayer
js = js.replace("streamInfo.innerHTML =", "if(window.saveToHistory) window.saveToHistory(document.getElementById('twitch_url').value, metadata.session_title || 'Kick VOD', channel.slug, channel.profile_pic);\n            streamInfo.innerHTML =")

if "// SPA Routing and Features" not in js:
    with open('main.js', 'w', encoding='utf-8') as f:
        f.write(js + "\n" + spa_logic)
