import re
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()
print('hero exists:', bool(re.search(r'class="[^"]*hero\b[^"]*"', html)))
print('hero-content exists:', bool(re.search(r'class="[^"]*hero-content\b[^"]*"', html)))
