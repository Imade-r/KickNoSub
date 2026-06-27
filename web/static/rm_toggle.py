import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Remove the mode-toggle tabs
html = re.sub(r'<div class="mode-toggle">.*?</div>', '', html, flags=re.DOTALL)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
