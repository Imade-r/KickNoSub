import re
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

m_player = re.search(r'<div[^>]*id="player-section"[^>]*>', html)
if m_player:
    print('Player element:', m_player.group(0))
else:
    print('No player-section ID found!')

m_hero = re.search(r'<div[^>]*class="[^"]*hero[^"]*"[^>]*>', html)
if m_hero:
    print('Hero element:', m_hero.group(0))
else:
    print('No hero class found!')

m_recent = re.search(r'id="recent-history-widget"', html)
print('recent-history-widget exists:', bool(m_recent))
