import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Replace the video tag to include controls
html = re.sub(r'<video id="video_player" class="video-js vjs-big-play-centered"', r'<video id="video_player" class="video-player" controls', html)

# Remove player-controls-overlay and chapter-menu completely if they exist
html = re.sub(r'<div class="player-controls-overlay">.*?<div id="vod-game-container"', r'<div id="vod-game-container"', html, flags=re.DOTALL)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
