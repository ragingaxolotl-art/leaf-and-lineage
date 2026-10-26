"""Build a self-contained Pattern Lab from the current browser entry point."""
from pathlib import Path
import re
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
page=page.replace('</body>','<script>\n'+'\n'.join(scripts)+'\n</script></body>')
(source/'Pattern-Lab.html').write_text(page)
print('Packaged',len(scripts),'scripts into Pattern-Lab.html')
