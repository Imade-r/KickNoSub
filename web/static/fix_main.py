with open('main.js', 'r', encoding='utf-8') as f:
    js = f.read()

replacements = {
    "document.getElementById('urlInput')": "document.getElementById('twitch_url')",
    "document.getElementById('loadBtn')": "document.getElementById('watch-now-btn')",
    "document.getElementById('inputSection')": "document.querySelector('.hero')",
    "document.getElementById('playerSection')": "document.getElementById('player-section')",
    "document.getElementById('videoPlayer')": "document.getElementById('video_player')",
    "document.getElementById('chatList')": "document.getElementById('chat-messages')",
    "document.getElementById('backBtn')": "document.querySelector('.logo-container')",
    "document.getElementById('streamInfo')": "document.querySelector('.video-info')",
    "errorMsg.textContent = msg": "alert(msg)",
    "loader.classList.add('active')": "loadBtn.innerText = 'Chargement...'",
    "loader.classList.remove('active')": "loadBtn.innerText = 'Regarder maintenant'"
}

for k, v in replacements.items():
    js = js.replace(k, v)

# Update DOM manipulation since inputSection is now .hero which shouldn't be fully hidden maybe?
# Twitchnosub hides main and shows player-section
js = js.replace("inputSection.classList.add('hidden');", "inputSection.style.display = 'none'; document.getElementById('recent-history-widget').style.display='none';")
js = js.replace("inputSection.classList.remove('hidden');", "inputSection.style.display = 'block'; document.getElementById('recent-history-widget').style.display='block';")
js = js.replace("playerSection.classList.add('hidden');", "playerSection.style.display = 'none';")
js = js.replace("playerSection.classList.remove('hidden');", "playerSection.style.display = 'block'; window.scrollTo(0,0);")

with open('main.js', 'w', encoding='utf-8') as f:
    f.write(js)
