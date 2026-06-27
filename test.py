import cloudscraper, time, json
from datetime import datetime, timedelta, timezone

s = cloudscraper.create_scraper()
channel_id = s.get('https://kick.com/api/v1/channels/xqc').json()['id']
print('Channel ID:', channel_id)

bufferedUntil = datetime(2025, 6, 26, 20, 0, 0, tzinfo=timezone.utc)
currentCursor = None
messages = []

for i in range(15):
    url = f'https://kick.com/api/v2/channels/{channel_id}/messages'
    if currentCursor:
        url += f'?cursor={currentCursor}'
    else:
        targetTime = bufferedUntil
        url += f'?start_time={targetTime.isoformat().replace("+00:00", "Z")}'
    
    print(f'Fetching: {url}')
    res = s.get(url)
    if res.status_code != 200:
        print('HTTP ERROR:', res.status_code)
        break
    data = res.json()
    msgs = data.get('data', {}).get('messages', []) if 'data' in data else data.get('messages', [])
    print('Got messages:', len(msgs))
    if msgs:
        messages.extend(msgs)
        last_msg_t = max([datetime.fromisoformat(m['created_at'].replace('Z', '+00:00')) for m in msgs])
        bufferedUntil = max(bufferedUntil, last_msg_t + timedelta(milliseconds=1))
    else:
        bufferedUntil += timedelta(seconds=30)
    
    currentCursor = data.get('data', {}).get('cursor') if 'data' in data else data.get('cursor')
    print('Next cursor:', currentCursor)
    print('Buffered until:', bufferedUntil.isoformat())
    time.sleep(1)
