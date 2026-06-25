from pathlib import Path
import re

summary_files = ['asia.html','europe.html','modems.html','numbers-stations.html','rusmil.html','time-stations.html','usa.html']

status_cache = {}

def resolve_target(base_file, href):
    href = href.strip()
    if href.startswith(('http:', 'https:', 'mailto:')) or href.startswith('#'):
        return None
    if href.startswith('./'):
        href = href[2:]
    if href.startswith('/'):
        href = href[1:]
    current_dir = Path(base_file).parent
    candidate = current_dir / href
    if candidate.exists():
        return candidate
    candidate = Path(href)
    if candidate.exists():
        return candidate
    # try relative to root
    root = Path('.').resolve()
    candidate = root / href
    if candidate.exists():
        return candidate
    return None


def detect_status(path):
    path = Path(path)
    if path in status_cache:
        return status_cache[path]
    try:
        text = path.read_text(encoding='utf-8')
    except Exception:
        status_cache[path] = None
        return None
    m = re.search(r'<th>\s*Status\s*</th>\s*<td>\s*([^<]+)', text, re.I)
    if m:
        status = m.group(1).strip()
    elif re.search(r'<p>\s*Soon\s*\.\.\.', text, re.I):
        status = 'Soon'
    else:
        status = None
    status_cache[path] = status
    return status


def status_class(status):
    if not status:
        return None
    s = status.lower()
    if re.search(r'\binactive\b', s) or re.search(r'\bdisbanded\b', s):
        return 'status-inactive'
    if re.search(r'\bactive\b', s):
        return 'status-active'
    if re.search(r'\bunknown\b', s):
        return 'status-unknown'
    if re.search(r'\bsoon\b', s):
        return 'status-soon'
    return 'status-other'

anchor_re = re.compile(r'<a([^>]*\shref=["\']([^"\']+)["\'][^>]*)>(.*?)</a>', re.S | re.I)

for fname in summary_files:
    path = Path(fname)
    if not path.exists():
        print('MISSING', fname)
        continue
    text = path.read_text(encoding='utf-8')
    changed = [False]
    def repl(match):
        full = match.group(0)
        attrs = match.group(1)
        href = match.group(2)
        inner = match.group(3)
        target = resolve_target(path, href)
        if not target:
            return full
        status = detect_status(target)
        css = status_class(status)
        if not css:
            return full
        class_match = re.search(r'class=["\']([^"\']*)["\']', attrs, re.I)
        if class_match:
            classes = [c for c in class_match.group(1).split() if not c.startswith('status-')]
            classes.append(css)
            new_attrs = attrs[:class_match.start(1)] + ' '.join(classes) + attrs[class_match.end(1):]
            changed[0] = True
            return f'<a{new_attrs}>{inner}</a>'
        changed[0] = True
        return f'<a{attrs} class="{css}">{inner}</a>'
    new_text = anchor_re.sub(repl, text)
    if changed[0]:
        path.write_text(new_text, encoding='utf-8')
        print('UPDATED', fname)
    else:
        print('NO CHANGE', fname)
