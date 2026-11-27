#!/usr/bin/env python3
"""Scan every enterable room for z-fighting (coplanar overlapping faces of different colour).
Usage: python3 tools/zfight-scan.py [dist/index.html] > report.txt"""
import sys, time, json, os
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
URL = 'file://' + os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'dist', 'index.html'))
JS = open(os.path.join(HERE, 'zfight-scan.js')).read()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 480, 'height': 270}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('#go:not([hidden])', timeout=90000); pg.click('#go'); J = pg.evaluate
    for _ in range(120):
        if J('window.__neon && window.__neon.started'): break
        time.sleep(.25)
    J('() => { window.THREE_V = __neon.player.pos.constructor; }'); J('() => {' + JS + '}')
    keys = J("__neon.places.list.map(p => p.key)")
    total = 0
    for k in keys:
        try:
            J(f"__neon.debug.inside('{k}')"); time.sleep(1.2)
            r = J("(() => { const r = __neon.inside && __neon.inside.room; if (!r || !r.group) return null; return __zscan(r.group.parent && r.group.parent.isScene ? r.group : r.group, r.ox, 0, r.oz); })()")
        except Exception as e:
            print(f'== {k}: error {e}'); continue
        if r is None: print(f'== {k}: no room'); continue
        total += len(r)
        print(f'== {k}: {len(r)} spots' + ('' if not r else ''))
        for h in r[:12]: print(f"   at ({h['x']}, {h['y']}, {h['z']}) normal {h['n']}  pairs {h['pairs']}  area {h['area']:.3f} m2")
        J("__neon.places.exit && __neon.places.exit()"); time.sleep(.3)
    print(f'TOTAL {total} spots; page errors: {errs[:3]}')
    b.close()
