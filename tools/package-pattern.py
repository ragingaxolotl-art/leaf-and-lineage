"""Build a self-contained Pattern Lab from the current browser entry point."""
from pathlib import Path
import re,json
source=Path(__file__).resolve().parents[1]/'dist/pattern-lab'
page=(source/'index.html').read_text()
scripts=[]
def script(match):
 name=match.group(1).split('?')[0]
 scripts.append((source/name).read_text().replace('</script','<\\/script'))
 return ''
page=re.sub(r'<script defer src="([^"<>]+)"></script>',script,page)
page=re.sub(r'<link rel="stylesheet" href="([^"<>]+)">',lambda m:'<style>\n'+(source/m.group(1).split('?')[0]).read_text()+'\n</style>',page)
page=page.replace('href="../"','href="https://ragingaxolotl-art.github.io/leaf-and-lineage/"').replace('href="../simplified/"','href="https://ragingaxolotl-art.github.io/leaf-and-lineage/simplified/"')
faq=(source/'faq.html').read_text()
faq_body=re.search(r'<main>([\s\S]*?)</main>',faq).group(1)
faq_dialog='<dialog id="offline-faq" aria-label="Beetle lab FAQ"><button type="button" id="offline-faq-close">Close FAQ</button><div class="offline-faq-body">'+faq_body+'</div></dialog>'
page=page.replace('</body>',faq_dialog+'</body>')
scripts.append("document.getElementById('offline-faq-close').onclick=()=>document.getElementById('offline-faq').close();document.addEventListener('click',e=>{const link=e.target.closest('a[data-faq],#offline-faq a[href^=\"#\"]');if(!link)return;e.preventDefault();const dialog=document.getElementById('offline-faq');if(!dialog.open)dialog.showModal();const target=link.hash&&document.getElementById(link.hash.slice(1));if(target&&dialog.contains(target)){if(target.tagName==='DETAILS')target.open=true;target.scrollIntoView({block:'start'});}else dialog.scrollTop=0;});")
page=page.replace('</body>','<script>\n'+'\n'.join(scripts)+'\n</script></body>')
(source/'Pattern-Lab.html').write_text(page)
print('Packaged',len(scripts),'scripts into Pattern-Lab.html')
