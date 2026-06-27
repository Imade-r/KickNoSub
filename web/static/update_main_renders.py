import re

with open('main.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Replace loadTrending
new_trending = """async function loadTrending() {
        const grid = document.getElementById('trending-grid');
        grid.className = 'trending-vods-grid-home'; // Ensure correct grid class
        grid.innerHTML = '<div style="color:var(--text-muted);">Chargement...</div>';
        try {
            const res = await fetch('/api/trending');
            const data = await res.json();
            if(data.trending) {
                grid.innerHTML = data.trending.map(vod => `
                    <a class="trending-vod-card" href="#" onclick="playVOD('https://kick.com/video/${vod.video.uuid}'); return false;">
                        <div class="trending-vod-thumbnail">
                            <img src="${vod.session_title ? (vod.thumbnail ? vod.thumbnail.url : '') : ''}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='https://kick.com/favicon.ico'">
                            <span class="trending-vod-badge">VOD</span>
                            ${vod.category ? `<span class="trending-vod-game-badge">${vod.category.name}</span>` : ''}
                        </div>
                        <div class="trending-vod-info">
                            <h3 style="font-size: 1rem; margin:0 0 5px 0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color: var(--text-primary);">${vod.session_title || 'VOD'}</h3>
                            <div class="trending-vod-meta">${vod.channel_slug}</div>
                        </div>
                    </a>
                `).join('');
            }
        } catch(e) {
            grid.innerHTML = '<div style="color:#ef4444;">Erreur lors du chargement des tendances.</div>';
        }
    }"""

js = re.sub(r'async function loadTrending\(\) \{.*?\}\s*\}', new_trending, js, flags=re.DOTALL)

# Replace loadGames
new_games = """async function loadGames() {
        const grid = document.getElementById('games-grid');
        grid.className = 'games-grid'; // Ensure correct grid class
        grid.innerHTML = '<div style="color:var(--text-muted);">Chargement...</div>';
        try {
            const res = await fetch('/api/categories');
            const data = await res.json();
            if(data && data.length) {
                grid.innerHTML = data.map(game => `
                    <a href="#" class="game-card-link" onclick="return false;">
                        <div class="game-card-artwork">
                            <img src="${game.banner ? game.banner.url : ''}" alt="${game.name}" loading="lazy" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                            <div class="game-card-artwork-fallback" style="display: none; align-items:center; justify-content:center; width:100%; height:100%; background:#16161a;">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                                    <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                                </svg>
                            </div>
                        </div>
                        <div class="game-card-info">
                            <h3 class="game-card-name">${game.name}</h3>
                        </div>
                    </a>
                `).join('');
            }
        } catch(e) {
            grid.innerHTML = '<div style="color:#ef4444;">Erreur lors du chargement des jeux.</div>';
        }
    }"""

js = re.sub(r'async function loadGames\(\) \{.*?\}\s*\}', new_games, js, flags=re.DOTALL)

with open('main.js', 'w', encoding='utf-8') as f:
    f.write(js)
