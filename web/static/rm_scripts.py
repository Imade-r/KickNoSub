import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Remove remaining script tags that are not ours
html = re.sub(r'<script(?!\s+src="(/static/main\.js|https://cdn\.jsdelivr\.net/npm/hls\.js@latest)").*?</script>', '', html, flags=re.DOTALL)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
