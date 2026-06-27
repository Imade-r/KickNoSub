import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Remove Twitter banner
html = re.sub(r'<div id="twitterBanner".*?</div>', '', html, flags=re.DOTALL)

# Remove Access gate (Adblock)
html = re.sub(r'<div class="access-gate".*?</div>\s*</div>', '', html, flags=re.DOTALL)

# Remove Header Nav Links
html = re.sub(r'<nav class="nav-links".*?</nav>', '', html, flags=re.DOTALL)

# Remove Paris RP callout
html = re.sub(r'<a href="/fr/game/paris-rp".*?</a>', '', html, flags=re.DOTALL)

# Remove Trending Callout
html = re.sub(r'<a href="/fr/trending/vods" class="trending-callout".*?</a>', '', html, flags=re.DOTALL)

# Remove Cross-promotion block (KickNoSub cross promo)
html = re.sub(r'<section style="margin: 64px 0;">.*?</section>', '', html, flags=re.DOTALL)

# Remove Trending section
html = re.sub(r'<section class="trending-section".*?</section>', '', html, flags=re.DOTALL)

# Remove FAQ Preview section
html = re.sub(r'<section class="how-it-works" id="faq-preview">.*?</section>', '', html, flags=re.DOTALL)

# Remove Twitter Contact section
html = re.sub(r'<section class="how-it-works" id="contact">.*?</section>', '', html, flags=re.DOTALL)

# Remove VOD Download buttons
html = re.sub(r'<a href="https://vodgrab.com.*?</a>', '', html, flags=re.DOTALL)

# Remove Footer links and disclaimer
html = re.sub(r'<nav class="footer-links">.*?</nav>', '', html, flags=re.DOTALL)
html = re.sub(r'<div class="language-links">.*?</div>', '', html, flags=re.DOTALL)
html = re.sub(r'<div class="footer-disclaimer">.*?</div>', '', html, flags=re.DOTALL)

# Remove lang-switch and mobile menu toggle from header (since nav is gone)
html = re.sub(r'<button class="mobile-menu-toggle".*?</button>', '', html, flags=re.DOTALL)

# Keep the How It Works section as it explains the steps.
# In "How it works", change "Twitch" to "Kick"
html = html.replace('Twitch VOD', 'Kick VOD')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
