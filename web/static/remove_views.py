import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Remove Nav Links
html = re.sub(r'<a href="[^"]*" data-action="navigate-trending"[^>]*>.*?</a>\s*', '', html, flags=re.DOTALL)
html = re.sub(r'<a href="[^"]*" data-action="navigate-games"[^>]*>.*?</a>\s*', '', html, flags=re.DOTALL)

# Remove Views
# Since I am not sure if there's an HTML comment like <!-- end trending-view -->, I'll match until the next <div id="...-view"
# Actually, I know my inject_views.py added exactly this structure: 
# <div id="trending-view"...> ... </div> <!-- end trending-view -->

html = re.sub(r'<div id="trending-view".*?<!-- end trending-view -->\s*', '', html, flags=re.DOTALL)
html = re.sub(r'<div id="games-view".*?<!-- end games-view -->\s*', '', html, flags=re.DOTALL)

# Let's fallback if there are no comments
html = re.sub(r'<div id="trending-view"[^>]*>.*?<div id="trending-grid"[^>]*>.*?</div>\s*</div>\s*</div>\s*', '', html, flags=re.DOTALL)
html = re.sub(r'<div id="games-view"[^>]*>.*?<div id="games-grid"[^>]*>.*?</div>\s*</div>\s*</div>\s*', '', html, flags=re.DOTALL)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

with open('main.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Make history functional by calling renderHistory()
new_logic = r"""            if(viewName === 'how-it-works-view') {
                showView('home-view');
                setTimeout(() => {
                    document.getElementById('how-it-works').scrollIntoView({behavior: 'smooth'});
                }, 100);
            } else {
                if (viewName === 'history-view') {
                    if (typeof renderHistory === 'function') renderHistory();
                }
                showView(viewName);
            }"""
            
js = re.sub(r"if\(viewName === 'how-it-works-view'\) \{.*?showView\(viewName\);\s*\}", new_logic, js, flags=re.DOTALL)

with open('main.js', 'w', encoding='utf-8') as f:
    f.write(js)
