import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Replace trending view
html = re.sub(
    r'(<div id="trending-view"[^>]*>)\s*<h2', 
    r'\1\n    <div class="container">\n        <h2', 
    html
)
html = html.replace('<div id="trending-grid"', '        <div id="trending-grid"')
html = re.sub(
    r'(<div id="trending-grid"[^>]*></div>)', 
    r'\1\n    </div>', 
    html
)

# Replace games view
html = re.sub(
    r'(<div id="games-view"[^>]*>)\s*<h2', 
    r'\1\n    <div class="container">\n        <h2', 
    html
)
html = html.replace('<div id="games-grid"', '        <div id="games-grid"')
html = re.sub(
    r'(<div id="games-grid"[^>]*></div>)', 
    r'\1\n    </div>', 
    html
)

# Remove text-align:center; from style
html = html.replace('text-align:center;', '')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
