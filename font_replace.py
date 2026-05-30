#!/usr/bin/env python3
import re, os

SIZE_TO_TOKEN = {}
for s, t in [(9,'...ILES = [
    'src/screens/ProcurementScreen.tsx',
    'src/screens/HomeScreen.tsx',
    'src/screens/LoginScreen.tsx',
    'src/screens/PartnerScreen.tsx',
    'src/screens/ExpenseHistoryScreen.tsx',
    'src/screens/ReconHistoryScreen.tsx',
    'src/screens/DailyRevenueHistory.tsx',
]

os.chdir('/Users/lanx/projects/snail-books-web')

changes = 0
for fpath in FILES:
    with open(fpath, 'r') as f:
        text = f.read()

    if "FONTS" not in text[:300]:
        if "from '../theme';" in text[:300]:
            text = text.replace(
                "from '../theme';",
                "from '../theme';\nimport { FONTS } from '../theme';",
                1
            )

    def replace_fs(m):
        s = int(m.group(1))
        t = SIZE_TO_TOKEN.get(s)
        if t:
            return 'fontSize: FONTS.' + t + '.size'
        return m.group(0)

    new_text = re.sub(r'fontSize:\s*(\d+)', replace_fs, text)

    if new_text != text:
        new_count = len(re.findall(r'FONTS\.\w+\.size', new_text))
        old_count = len(re.findall(r'FONTS\.\w+\.size', text))
        with open(fpath, 'w') as f:
            f.write(new_text)
        changes += 1
        print('OK', fpath, '-', new_count - old_count, 'replacements')

print('Total:', changes, 'files modified')
