import re
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

m = re.search(r'<input[^>]*type="url"[^>]*>', html)
if m:
    print('Input element:', m.group(0))

m_form = re.search(r'<form[^>]*>', html)
if m_form:
    print('Form element:', m_form.group(0))
