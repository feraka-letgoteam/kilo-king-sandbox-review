"""Create an offline video index from the validated proof manifest."""
from pathlib import Path
import html
import json

root = Path('art/kilo-v77/proofs')
manifest = json.loads((root / 'final-manifest.json').read_text())
names = {'god-full': 'God Mode · full win', 'god-early-loss': 'God Mode · early loss',
         'god-late-overshoot': 'God Mode · late overshoot', 'vs-five': 'VS · five-reel merge'}
cards = []
for clip in manifest['clips']:
    identifier = clip['id']
    case, size = identifier.rsplit('-', 1)
    title = names.get(case, case) + ' · ' + size
    cards.append(f'''<article data-size="{size}"><h2>{html.escape(title)}</h2>
<video controls playsinline preload="metadata" src="{identifier}.mp4"></video>
<p>{clip['duration']:.2f}s · {clip['frames']} frames · 30fps</p>
<a href="{identifier}-sequence.webp">Consecutive proof frames</a> ·
<a href="{identifier}.json">Timing and credit record</a></article>''')
page = '''<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Kilo King v77 · Proofs</title>
<style>body{margin:0;background:#06131b;color:#fff8e9;font:16px/1.5 system-ui,sans-serif}main{max-width:1440px;margin:auto;padding:24px}h1{font-size:28px;margin:0}h2{font-size:18px}p{color:#b8c9c7}nav{display:flex;gap:8px;margin:20px 0}button{min-height:44px;padding:8px 16px;border:1px solid #ba995c;border-radius:6px;background:#0a222b;color:#fff8e9;cursor:pointer}button[aria-pressed=true]{background:#245954}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,480px),1fr));gap:24px}article{padding:16px;background:#0a1d27;border:1px solid #526367;border-radius:8px}article[hidden]{display:none}video{display:block;width:100%;max-height:650px;background:#020a0e}a{color:#dfc07c}footer{margin-top:28px;overflow-wrap:anywhere;font-size:13px}</style>
<main><h1>Kilo King v77 · God Mode &amp; VS</h1>
<p>Silent offline captures of the production stage and animation controllers, with a minimal WIN target. These are not browser/WebGL recordings of the complete control UI. Source and build are saved; no deployment.</p>
<nav aria-label="Proof size"><button aria-pressed="true" data-filter="all">All sizes</button><button aria-pressed="false" data-filter="1440x900">Desktop</button><button aria-pressed="false" data-filter="390x844">Phone</button></nav><section>'''
page += '\n'.join(cards)
page += '</section><footer>Production fingerprint: ' + html.escape(manifest['sourceFingerprint']) + '<br><a href="final-manifest.json">Validated file hashes</a></footer></main>'
page += '''<script>document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));document.querySelectorAll('article').forEach(a=>{a.hidden=b.dataset.filter!=='all'&&a.dataset.size!==b.dataset.filter;if(a.hidden)a.querySelector('video').pause()})})</script></html>'''
(root / 'index.html').write_text(page)
print(root / 'index.html')
