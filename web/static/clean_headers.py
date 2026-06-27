import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Extract the very first header
first_header_match = re.search(r'<header class="header">.*?</header>', html, flags=re.DOTALL)
first_header = first_header_match.group(0)

# Remove ALL headers
html = re.sub(r'<header class="header">.*?</header>', '', html, flags=re.DOTALL)

# Re-insert the first header after <div class="bg-glow-secondary"></div>
html = html.replace('<div class="bg-glow-secondary"></div>', '<div class="bg-glow-secondary"></div>\n' + first_header)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
