import re
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

nav = re.search(r'<nav class="nav-links" id="navLinks">.*?</nav>', html, flags=re.DOTALL)
if nav:
    print('Nav links:')
    print(nav.group(0))

views = re.findall(r'<div id="[a-z]+-view"[^>]*>', html)
print('\nViews found:')
for v in views:
    print(v)
