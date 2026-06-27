with open('style.css', 'r', encoding='utf-8') as f:
    css = f.read()

avatar_css = """
.stream-avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--primary);
}

.video-player {
    width: 100%;
    height: 100%;
    border-radius: var(--radius);
    background-color: #000;
}
"""

if '.stream-avatar' not in css:
    with open('style.css', 'w', encoding='utf-8') as f:
        f.write(css + "\n" + avatar_css)
        print('CSS added.')
else:
    print('CSS already exists.')
