import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

html = html.replace('id="history-grid" class="trending-vods-grid"', 'id="history-grid" class="recent-history-grid"')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

with open('main.js', 'r', encoding='utf-8') as f:
    js = f.read()

new_render = """function renderHistory() {
        const grid = document.getElementById('history-grid');
        const history = JSON.parse(localStorage.getItem('kicknosub_history') || '[]');
        if(history.length === 0) {
            grid.innerHTML = '<div style="color:var(--text-muted);">Aucun historique pour le moment.</div>';
            return;
        }
        
        grid.innerHTML = history.map(h => `
            <a href="#" class="recent-history-card" onclick="playVOD('${h.url}'); return false;">
                <div class="recent-history-thumb">
                    <img src="${h.avatar || 'https://kick.com/favicon.ico'}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='https://kick.com/favicon.ico'">
                </div>
                <div class="recent-history-info">
                    <h3 class="recent-history-title">${h.title}</h3>
                    <p class="recent-history-owner">${h.streamer}</p>
                    <p class="recent-history-game">${new Date(h.date).toLocaleDateString()}</p>
                </div>
            </a>
        `).join('');
    }"""

js = re.sub(r'function renderHistory\(\)\s*\{.*?\n    \}', new_render, js, flags=re.DOTALL)

with open('main.js', 'w', encoding='utf-8') as f:
    f.write(js)
