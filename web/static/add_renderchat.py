with open('main.js', 'r', encoding='utf-8') as f:
    js = f.read()

render_chat_code = """
function renderChat(targetTime) {
    if (!chatMessages.length) return;
    
    const visibleMsgs = chatMessages.filter(m => new Date(m.created_at) <= targetTime);
    const displayMsgs = visibleMsgs.slice(-100);
    
    if (displayMsgs.length === 0) {
        // Leave the chat status alone or clear it if needed
        return;
    }
    
    chatList.innerHTML = displayMsgs.map(m => {
        const badges = m.sender.identity.badges ? m.sender.identity.badges.map(b => `<img src="${b.url}" class="chat-badge" alt="badge" style="width:16px;height:16px;vertical-align:middle;margin-right:4px;">`).join('') : '';
        const color = m.sender.identity.color || 'var(--text)';
        return `
            <div class="chat-message" style="margin-bottom: 8px; line-height: 1.4; font-size: 14px;">
                <span class="chat-badges">${badges}</span>
                <span class="chat-username" style="color: ${color}; font-weight: bold; margin-right: 4px;">${m.sender.username}</span>
                <span class="chat-text" style="color: var(--text-muted); word-break: break-word;">${m.content}</span>
            </div>
        `;
    }).join('');
    
    chatList.scrollTop = chatList.scrollHeight;
}
"""

if 'function renderChat' not in js:
    with open('main.js', 'w', encoding='utf-8') as f:
        f.write(js + "\n" + render_chat_code)
        print('renderChat added.')
else:
    print('renderChat already exists.')
