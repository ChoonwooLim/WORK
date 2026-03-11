import re

file_path = '/home/stevenlim/WORK/orbitron/public/docs-content/ir-financials.md'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Strip leading spaces and tabs from every line
new_content = re.sub(r'^[ \t]+', '', content, flags=re.MULTILINE)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)
