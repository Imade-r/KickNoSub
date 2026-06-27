import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Replace all script tags in <head>
html = re.sub(r'<script.*?</script>', '', html, flags=re.DOTALL)
# Inject my scripts and css
head_injection = '''
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
    <link rel="stylesheet" href="/static/style.css" />
'''
html = html.replace('</head>', head_injection + '</head>')

# Add my main.js before </body>
html = html.replace('</body>', '<script src="/static/main.js"></script></body>')

# Remove the TwitchNoSub external CSS since I merged it into style.css
html = re.sub(r'<link rel="stylesheet" href="/static/css/.*?>', '', html)

# By default, twitchnosub hides the url-input-section and shows streamer search.
# I want to show url-input-section by default, and hide streamer search.
html = html.replace('id="url-input-section" style="display: none;"', 'id="url-input-section"')
html = html.replace('id="streamer-search-section"', 'id="streamer-search-section" style="display: none;"')
html = html.replace('id="mode-url-btn"', 'id="mode-url-btn" class="mode-toggle-btn active"')
html = html.replace('id="mode-streamer-btn" class="mode-toggle-btn active"', 'id="mode-streamer-btn" class="mode-toggle-btn"')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
