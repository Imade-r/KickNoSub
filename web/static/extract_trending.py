import re

with open('trending_html.txt', 'r', encoding='utf-8') as f:
    html = f.read()

match = re.search(r'<div class="trending-vods-grid[^"]*">(.*?)</div>', html, flags=re.DOTALL)
if match:
    print(match.group(1)[:1500])
else:
    print('Grid not found')
