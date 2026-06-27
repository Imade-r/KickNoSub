import cloudscraper, time
from datetime import datetime, timedelta, timezone

s = cloudscraper.create_scraper()
channel_id = s.get('https://kick.com/api/v1/channels/xqc').json()['id']

bufferedUntil = datetime(2025, 6, 26, 20, 0, 0, tzinfo=timezone.utc)

for i in range(3):
    url = f'https://kick.com/api/v2/channels/{channel_id}/messages?start_time={bufferedUntil.isoformat().replace("+00:00", "Z")}'
    print(f'Fetching: {url}')
    res = s.get(url)
    data = res.json()
    msgs = data.get('data', {}).get('messages', []) if 'data' in data else data.get('messages', [])
    print('Got messages:', len(msgs))
    if msgs:
        newest = max([datetime.fromisoformat(m['created_at'].replace('Z', '+00:00')) for m in msgs])
        print('Newest in this block:', newest.isoformat())
        bufferedUntil = newest + timedelta(milliseconds=1)
    else:
        bufferedUntil += timedelta(seconds=30)
    time.sleep(1)
