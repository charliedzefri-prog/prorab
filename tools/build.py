#!/usr/bin/env python3
"""Собирает ПРОраб pro в один автономный HTML-файл: prorab.html"""
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
ORDER = ['data.js', 'assets.js', 'core.js', 'calcs.js', 'ui-calc.js', 'ui-smeta.js', 'ui-misc.js']
rd = lambda n: open(os.path.join(SRC, n), encoding='utf-8').read()
js = '\n;\n'.join(f'/* ===== {n} ===== */\n' + rd(n).replace("'use strict';", '') for n in ORDER)
js = "'use strict';\n" + js.replace('</script', '<\\/script')
html = rd('index.html')
icon = re.search(r"[\"']icon[\"']\s*:\s*[\"']([^\"']+)", rd('assets.js'))
html = html.replace('/*ICON*/', icon.group(1) if icon else '')
html = html.replace('/*CSS*/', rd('styles.css')).replace('/*JS*/', lambda m: js) if False else html.replace('/*CSS*/', rd('styles.css'))
html = html.replace('/*JS*/', js)
out = os.path.join(ROOT, 'prorab.html')
open(out, 'w', encoding='utf-8').write(html)
open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(html)
print('OK', out, round(len(html.encode()) / 1024), 'KB')
