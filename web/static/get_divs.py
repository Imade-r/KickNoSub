import re
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

m = re.findall(r'<div[^>]*id="[^"]*"[^>]*>', html)
for match in m:
    print(match)
