with open('main.js', 'r', encoding='utf-8') as f:
    js = f.read()

js = js.replace("'vodUrl'", "'kick_url'")
js = js.replace("'twitch_url'", "'kick_url'")

with open('main.js', 'w', encoding='utf-8') as f:
    f.write(js)
