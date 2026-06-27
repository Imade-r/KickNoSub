import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Replace padding-top with padding-top + margin-top for the custom views
html = html.replace('padding-top:150px;', 'padding-top:150px; margin-top:80px;')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
