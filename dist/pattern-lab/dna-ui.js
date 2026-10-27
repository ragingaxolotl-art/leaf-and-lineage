(async function(){
'use strict';
await globalThis.PatternLabReady;
const A=PatternLabApp,G=PatternGenetics,B=PatternBeetles,D=PatternDNA,$=id=>document.getElementById(id);
let preview=null,busy=false;
function source(){const b=A.getState().beetles[A.getSelected()];if(!b)throw Error('Select a beetle first.');if(globalThis.PatternFieldLife?.away(A.getState(),b.id))throw Error('Recall this beetle from its expedition before copying its DNA.');return b;}
function openImport(){if(A.isBlocked())return;$('dna-input').value='';preview=null;updatePreview();$('dna-import').showModal();$('dna-input').focus();}
function updatePreview(){
 preview=null;$('dna-preview').hidden=true;$('dna-confirm').disabled=true;
 const code=$('dna-input').value;if(!code.trim()){$('dna-import-status').textContent='Paste a DNA string to see the beetle before adding it.';return;}
 try{preview=D.decode(code);const b=preview.beetle,p=G.phenotype(b);$('dna-preview-art').innerHTML=B.draw(b,'dna-preview');$('dna-preview-description').textContent=(p.visibleLayers?p.shape+' markings · '+p.visibleLayers+' pattern '+(p.visibleLayers===1?'color':'colors'):'Plain shell')+' · '+G.antennaNames[p.antenna]+' antennae · '+G.legNames[p.leg]+'.';$('dna-preview').hidden=false;$('dna-import-status').textContent='DNA checked. All inherited traits and the exact marking layout are ready to recreate.';$('dna-confirm').disabled=A.isBlocked()||busy;}catch(e){$('dna-import-status').textContent=e.message;}
}
$('dna-export-open').onclick=()=>{try{const b=source();$('dna-output').value=D.encode(b);$('dna-export-art').innerHTML=B.draw(b,'dna-export');$('dna-export-name').textContent=b.name||b.id;$('dna-export-status').textContent='Ready to copy · '+D.codeLength.toLocaleString()+' characters. Anyone with the complete string can recreate this beetle.';$('dna-export').showModal();}catch(e){A.toast(e.message);}};
$('dna-copy').onclick=async()=>{try{await navigator.clipboard.writeText($('dna-output').value);$('dna-export-status').textContent='DNA copied. Paste the complete string into Import beetle DNA on another device.';}catch{$('dna-output').focus();$('dna-output').select();$('dna-export-status').textContent='DNA selected. Use your device’s Copy command to copy the complete string.';}};
$('dna-download').onclick=()=>{const url=URL.createObjectURL(new Blob([$('dna-output').value+'\n'],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='Pattern-Lab-Beetle-DNA.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('dna-import-open').onclick=openImport;$('dna-import-from-export').onclick=()=>{$('dna-export').close();openImport();};
$('dna-input').oninput=updatePreview;
$('dna-confirm').onclick=async()=>{if(busy||!preview||A.isBlocked())return;busy=true;$('dna-confirm').disabled=true;$('dna-input').disabled=true;try{const b=await A.addDNABeetle(preview);$('dna-import').close();A.inspect(b.id);A.toast('DNA recreated as '+b.id+' and saved '+(G.container(A.getState(),b.id)==='nursery'?'in Nursery (main tank full).':'in your tank.'));}catch(e){$('dna-import-status').textContent='Beetle was not added: '+e.message;}finally{busy=false;$('dna-input').disabled=false;$('dna-confirm').disabled=!preview||A.isBlocked();}};
// A dialog may close during a save; disable Escape until the transaction resolves.
$('dna-import').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
})();
