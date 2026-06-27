"""
Fix index.html structure:
1. Remove duplicate <div id="home-view"> (line 109)
2. Remove minimal how-it-works (lines 172-178) inside home-view
3. Move the full how-it-works (lines 272-318) INSIDE home-view, before closing </div>
4. Add display:none to player-section
5. Remove stray </div> on line 267
"""

with open('index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"Original: {len(lines)} lines")

# Step 1: Remove duplicate home-view div (line 109, 0-indexed: 108)
# Line 109 is: <div id="home-view" class="view-section active">
assert 'id="home-view"' in lines[108], f"Line 109 unexpected: {lines[108]}"
lines[108] = ''  # Remove it

# Step 2: Extract the full how-it-works section (lines 272-318, 0-indexed: 271-317)
# Find exact boundaries
hiw_start = None
hiw_end = None
for i in range(265, 320):
    if '<section class="how-it-works"' in lines[i] and 'id="how-it-works"' in lines[i]:
        hiw_start = i
    if hiw_start and '</section>' in lines[i] and i > hiw_start:
        hiw_end = i
        break

assert hiw_start is not None, "Could not find full how-it-works section"
assert hiw_end is not None, "Could not find end of full how-it-works section"
print(f"Full how-it-works: lines {hiw_start+1}-{hiw_end+1}")

# Extract the content
hiw_content = lines[hiw_start:hiw_end+1]

# Remove the full how-it-works from its current position
for i in range(hiw_start, hiw_end+1):
    lines[i] = ''

# Step 3: Remove minimal how-it-works inside home-view (lines 172-178, 0-indexed: 171-177)
# And replace the closing </div> on line 179 with: hiw_content + closing </div>
mini_hiw_start = None
mini_hiw_end = None
for i in range(168, 180):
    if '<section class="how-it-works"' in lines[i]:
        mini_hiw_start = i
    if mini_hiw_start and '</section>' in lines[i] and i >= mini_hiw_start:
        mini_hiw_end = i
        break

if mini_hiw_start is not None:
    print(f"Mini how-it-works: lines {mini_hiw_start+1}-{mini_hiw_end+1}")
    for i in range(mini_hiw_start, mini_hiw_end+1):
        lines[i] = ''

# Find the closing </div> <!-- end home-view --> 
home_close_idx = None
for i in range(175, 185):
    if 'end home-view' in lines[i] or (lines[i].strip() == '</div>' and i > 175):
        home_close_idx = i
        break

assert home_close_idx is not None, "Could not find home-view closing div"
print(f"Home-view closing div: line {home_close_idx+1}")

# Replace the closing div with: how-it-works content + closing div
lines[home_close_idx] = ''.join(hiw_content) + '</div> <!-- end home-view -->\n'

# Step 4: Add display:none to player-section
for i in range(len(lines)):
    if '<section class="player-section" id="player-section">' in lines[i]:
        lines[i] = lines[i].replace(
            '<section class="player-section" id="player-section">',
            '<section class="player-section" id="player-section" style="display:none">'
        )
        print(f"Added display:none to player-section at line {i+1}")
        break

# Step 5: Remove stray </div> before </section> of player-section
# Find the </section> that closes player-section
for i in range(len(lines)-1, 0, -1):
    if '</section>' in lines[i] and lines[i].strip() == '</section>':
        # Check if the line before is a stray </div>
        prev = i - 1
        while prev > 0 and lines[prev].strip() == '':
            prev -= 1
        if lines[prev].strip() == '</div>':
            # Check if this </div> is stray (more closes than opens in player section)
            # Just look at the context - the line before should be closing chat-sidebar or similar
            prev_prev = prev - 1
            while prev_prev > 0 and lines[prev_prev].strip() == '':
                prev_prev -= 1
            if '</div>' in lines[prev_prev]:
                # Two consecutive </div> before </section> - the second one (at prev) is likely stray
                print(f"Removing stray </div> at line {prev+1}")
                lines[prev] = ''
                break

# Clean up empty lines (don't leave too many gaps)
result = []
empty_count = 0
for line in lines:
    if line == '':
        continue  # Skip completely removed lines
    if line.strip() == '':
        empty_count += 1
        if empty_count <= 2:
            result.append(line)
    else:
        empty_count = 0
        result.append(line)

with open('index.html', 'w', encoding='utf-8') as f:
    f.writelines(result)

print(f"Fixed: {len(result)} lines")
print("Done!")
