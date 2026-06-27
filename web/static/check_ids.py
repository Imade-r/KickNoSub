import re
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()
print(re.search(r'<div[^>]*id="trending-grid"[^>]*>', html).group(0))
print(re.search(r'<div[^>]*id="games-grid"[^>]*>', html).group(0))
