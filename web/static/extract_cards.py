import urllib.request
import re
from html.parser import HTMLParser

def get_html(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as res:
        return res.read().decode('utf-8')

trending_html = get_html('https://twitchnosub.com/fr/trending/vods')
match1 = re.search(r'<a[^>]*class="[^"]*trending-vod-card[^"]*"[^>]*>.*?</a>', trending_html, flags=re.DOTALL)
if match1:
    print('--- TRENDING VOD CARD ---')
    print(match1.group(0))

games_html = get_html('https://twitchnosub.com/fr/games')
match2 = re.search(r'<a[^>]*class="[^"]*game-card[^"]*"[^>]*>.*?</a>', games_html, flags=re.DOTALL)
if match2:
    print('\n--- GAME CARD ---')
    print(match2.group(0))
