from pathlib import Path
import re
summary_files = ['asia.html','europe.html','modems.html','numbers-stations.html','rusmil.html','time-stations.html','usa.html']
for fname in summary_files:
    path = Path(fname)
    if not path.exists():
        print('MISSING FILE', fname)
        continue
    print('\nFILE', fname)
    text = path.read_text(encoding='utf-8')
    links = re.findall(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', text, re.S)
    for href, label in links:
        href = href.strip()
        label = re.sub(r'\s+', ' ', label.strip())
        if href.startswith(('http:', 'https:', 'mailto:')) or href.startswith('#'):
            continue
        if href.startswith('./'):
            href = href[2:]
        if href.startswith('/'):
            href = href[1:]
        target = Path(href)
        if not target.exists():
            for base in [Path('.'), Path('..')]:
                candidate = base / href
                if candidate.exists():
                    target = candidate
                    break
        if not target.exists():
            print('  SKIP missing', href, label)
            continue
        text2 = target.read_text(encoding='utf-8')
        m = re.search(r'<th>\s*Status\s*</th>\s*<td>\s*([^<]+)', text2, re.I)
        if m:
            status = m.group(1).strip()
        elif re.search(r'<p>\s*Soon\s*\.\.\.', text2, re.I):
            status = 'Soon'
        else:
            status = 'Unknown'
        print(' ', href, '|', label, '|', status)
