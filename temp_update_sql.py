import re
from pathlib import Path

patterns = [
    (re.compile(r'(?<!await\s)(db\.prepare\([^)]*\)\.get\()'), r'await \1'),
    (re.compile(r'(?<!await\s)(db\.prepare\([^)]*\)\.all\()'), r'await \1'),
    (re.compile(r'(?<!await\s)(db\.prepare\([^)]*\)\.run\()'), r'await \1'),
    (re.compile(r'(?<!await\s)(db\.query\([^)]*\)\.get\()'), r'await \1'),
    (re.compile(r'(?<!await\s)(db\.query\([^)]*\)\.all\()'), r'await \1'),
    (re.compile(r'(?<!await\s)(db\.query\([^)]*\)\.run\()'), r'await \1'),
    (re.compile(r'(?<!await\s)([a-zA-Z_][a-zA-Z0-9_]*\.run\()'), r'await \1'),
    (re.compile(r'(?<!await\s)([a-zA-Z_][a-zA-Z0-9_]*\.get\()'), r'await \1'),
    (re.compile(r'(?<!await\s)([a-zA-Z_][a-zA-Z0-9_]*\.all\()'), r'await \1'),
]

root = Path('nextjsapp/app/api')
for path in root.rglob('*.ts'):
    text = path.read_text(encoding='utf-8')
    original = text
    for pattern, repl in patterns:
        text = pattern.sub(repl, text)
    if text != original:
        path.write_text(text, encoding='utf-8')
        print(f'Updated {path}')
