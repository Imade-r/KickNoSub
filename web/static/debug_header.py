import re

with open(r'C:\Users\Boulsan\.gemini\antigravity-ide\brain\ac6e5486-75e4-4150-ba94-73c58a4b5513\.system_generated\steps\301\content.md', 'r', encoding='utf-8') as f:
    tns_html = f.read()

header_match = re.search(r'<header class="header">.*?</header>', tns_html, flags=re.DOTALL)
if header_match:
    print('Header found in original HTML')
    
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
    # But wait, earlier I removed all the junk. Is bg-glow-secondary still there? Let's check!
    if '<div class="bg-glow-secondary"></div>' in html:
        print('Found insertion point')
        html = html.replace('<div class="bg-glow-secondary"></div>', '<div class="bg-glow-secondary"></div>\n' + header_html)
    else:
        print('Insertion point NOT found')
        
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)
        print('Wrote index.html')
else:
    print('Header NOT found')
