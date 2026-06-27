import urllib.request
import re

req = urllib.request.Request('https://twitchnosub.com/fr/games', headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
        links = re.findall(r'<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"', html)
        print('CSS Links:', links)
        
        # also fetch https://twitchnosub.com/fr/trending/vods
        req2 = urllib.request.Request('https://twitchnosub.com/fr/trending/vods', headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req2) as res2:
            h2 = res2.read().decode('utf-8')
            print('Trending CSS Links:', re.findall(r'<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"', h2))
            
except Exception as e:
    print('Error:', e)
