import re

# Read the twitchnosub HTML
with open(r'C:\Users\Boulsan\.gemini\antigravity-ide\brain\ac6e5486-75e4-4150-ba94-73c58a4b5513\.system_generated\steps\301\content.md', 'r', encoding='utf-8') as f:
    tns_html = f.read()

# Extract header
header_match = re.search(r'<header class="header">.*?</header>', tns_html, flags=re.DOTALL)
header_html = header_match.group(0)

# Customize header for KickNoSub
header_html = header_html.replace('twitchnosub', 'kicknosub')
header_html = header_html.replace('TwitchNoSub', 'KickNoSub')
header_html = header_html.replace('Twitch', 'Kick')
header_html = header_html.replace('/fr/trending/vods', '#trending')
header_html = header_html.replace('/fr/games', '#games')
header_html = header_html.replace('/fr/faq/', '#faq')
header_html = header_html.replace('/fr/history', '#history')
header_html = header_html.replace('/fr/', '#home')
header_html = header_html.replace('href="/"', 'href="#" data-lang="en"')
header_html = header_html.replace('href="#home"', 'href="#" data-lang="fr"')
header_html = header_html.replace('href="/es/"', 'href="#" data-lang="es"')
header_html = header_html.replace('href="/pt/"', 'href="#" data-lang="pt"')
header_html = header_html.replace('data-href="#home"', 'data-action="navigate-home"')
header_html = header_html.replace('<img src="/static/img/logo.png" alt="Logo KickNoSub" />', '')

# Make links internal anchors instead of absolute paths
header_html = header_html.replace('href="#how-it-works"', 'href="#" data-action="navigate-how-it-works"')
header_html = header_html.replace('href="#trending"', 'href="#" data-action="navigate-trending"')
header_html = header_html.replace('href="#games"', 'href="#" data-action="navigate-games"')
header_html = header_html.replace('href="#faq"', 'href="#" data-action="navigate-faq"')
header_html = header_html.replace('href="#history"', 'href="#" data-action="navigate-history"')

# For the language links, we just use the data-lang attributes set above.
header_html = header_html.replace('class="lang-link"', 'class="lang-link" data-action="change-language"')

# Read current index.html
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Insert header after <div class="bg-glow-secondary"></div>
html = html.replace('<div class="bg-glow-secondary"></div>', '<div class="bg-glow-secondary"></div>\n' + header_html)

# Wrap hero in home-view and add other views
html = html.replace('<section class="hero">', '<div id="home-view" class="view-section active">\n<section class="hero">')
html = html.replace('</section>\n\n    <div id="recent-history-widget"', '</section>\n\n    <section class="how-it-works" id="how-it-works">\n        <div class="container">\n            <div class="section-header">\n                <h2 class="section-title" data-i18n="how_it_works_title">Comment ça marche</h2>\n            </div>\n        </div>\n    </section>\n</div> <!-- end home-view -->\n<div id="trending-view" class="view-section container" style="display:none; padding-top:100px; min-height:80vh;">\n    <h1 data-i18n="trending_title">Tendances</h1>\n    <div id="trending-grid" class="trending-vods-grid-home"></div>\n</div>\n<div id="games-view" class="view-section container" style="display:none; padding-top:100px; min-height:80vh;">\n    <h1 data-i18n="games_title">Jeux</h1>\n    <div id="games-grid" class="trending-vods-grid-home"></div>\n</div>\n<div id="faq-view" class="view-section container" style="display:none; padding-top:100px; min-height:80vh;">\n    <h1 data-i18n="faq_title">FAQ</h1>\n    <p data-i18n="faq_content">KickNoSub vous permet de regarder des rediffusions sans abonnement.</p>\n</div>\n<div id="history-view" class="view-section container" style="display:none; padding-top:100px; min-height:80vh;">\n    <h1 data-i18n="history_title">Historique</h1>\n    <div id="history-grid" class="trending-vods-grid-home"></div>\n</div>\n    <div id="recent-history-widget"')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
