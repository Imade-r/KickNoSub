import urllib.request
import re

req = urllib.request.Request('https://twitchnosub.com/fr/games', headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
        classes = set(re.findall(r'class="([^"]*card[^"]*)"', html))
        print('Card classes:', classes)
        print('Grid classes:', set(re.findall(r'class="([^"]*grid[^"]*)"', html)))
except Exception as e:
    print('Error:', e)
