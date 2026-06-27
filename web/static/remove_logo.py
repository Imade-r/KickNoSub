import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

html = re.sub(r'<div class="logo-icon">.*?</div>', '', html, flags=re.DOTALL)
html = html.replace('<img src="/static/img/logo.png" alt="KickNoSub" />', '')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
