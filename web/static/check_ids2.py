import re
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

print('kick_url:', bool(re.search(r'id="kick_url"', html)))
print('vodUrl:', bool(re.search(r'id="vodUrl"', html)))
print('twitch_url:', bool(re.search(r'id="twitch_url"', html)))
print('watch-now-btn:', bool(re.search(r'id="watch-now-btn"', html)))

m_btn = re.search(r'<button[^>]*>.*?</button>', html, flags=re.DOTALL)
if m_btn:
    print('First button:', m_btn.group(0))
