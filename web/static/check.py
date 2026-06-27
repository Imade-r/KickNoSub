import re
import json

with open('trending_html.txt', 'r', encoding='utf-8') as f:
    html = f.read()

classes = set(re.findall(r'class="([^"]*)"', html))
print("Classes:", classes)
