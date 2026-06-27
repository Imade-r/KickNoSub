import re

with open('trending_html.txt', 'r', encoding='utf-8') as f:
    html = f.read()

card_match = re.search(r'<a href="[^"]*" class="vod-card">.*?</a>', html, flags=re.DOTALL)
if card_match:
    print(card_match.group(0))
else:
    print('No card found')

games_match = re.search(r'<a href="[^"]*" class="game-card">.*?</a>', html, flags=re.DOTALL)
if games_match:
    print(games_match.group(0))
else:
    print('No game card found')
