import re
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

print('errorMsg exists:', bool(re.search(r'id="errorMsg"', html)))
print('loader exists:', bool(re.search(r'id="loader"', html)))
print('chatStatus exists:', bool(re.search(r'id="chatStatus"', html)))
