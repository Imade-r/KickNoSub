with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Make sure lang.js is included before main.js
html = html.replace('<script src="/static/main.js"></script>', '<script src="/static/lang.js"></script>\n<script src="/static/main.js"></script>')

# Add data-i18n attributes to the header
html = html.replace('>Accueil<', ' data-i18n="nav_home">Accueil<')
html = html.replace('>Tendance<', ' data-i18n="nav_trending">Tendance<')
html = html.replace('>Jeux<', ' data-i18n="nav_games">Jeux<')
html = html.replace('>Comment ça marche<', ' data-i18n="nav_how_it_works">Comment ça marche<')
html = html.replace('>FAQ<', ' data-i18n="nav_faq">FAQ<')
html = html.replace('>Historique<', ' data-i18n="nav_history">Historique<')
html = html.replace('>Dons<', ' data-i18n="nav_donate">Dons<')
html = html.replace('Regardez les VOD Kick <span class="text-glow">Sans abonnement</span>', '<span data-i18n="hero_title">Regardez les VOD Kick <span class="text-glow">Sans abonnement</span></span>')
html = html.replace('Collez une URL Kick pour regarder instantanément. Aucune connexion requise.', '<span data-i18n="hero_subtitle">Collez une URL Kick pour regarder instantanément. Aucune connexion requise.</span>')
html = html.replace('Regarder maintenant', '<span data-i18n="btn_watch">Regarder maintenant</span>')
html = html.replace('placeholder="https://kick.com/username/video/..."', 'placeholder="https://kick.com/username/video/..." data-i18n="input_placeholder"')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
