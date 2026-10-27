(function(root){
'use strict';
const G=root.PatternGenetics, rgb=a=>'rgb('+a.map(Math.round).join(',')+')';
const round=v=>Number(v.toFixed(2));
function bounds(p){const reachX=Math.max(70,72*p.legLength*p.legFactor*p.legSpread+30,65+(8+31*p.antennaLength*p.antennaFactor)*.3),reachTop=Math.max(95,80+31*p.antennaLength*p.antennaFactor+40,60+55*p.horn*p.hornFactor,70+32*p.jaw*p.jawFactor),bottom=Math.max(90,62*p.legLength*p.legFactor+50);return {reachX,reachTop,bottom,radius:Math.max(reachX+10,(reachTop+21)*p.bodyLength,(bottom+10)*p.bodyLength)*p.bodyFactor};}
function draw(b,prefix='bug'){
 const p=G.visualPhenotype(b),r=G.seeded(b.developmentSeed??b.appearance.developmentSeed),id=prefix+'-'+b.id;
 const body=rgb(p.body),limb=rgb(p.body.map(v=>v*p.appendageShade*.7+14)),line='rgba(24,42,35,.7)';
 const legPigment=rgb(p.legColor.map(v=>v*p.appendageShade*.7+14)),thoraxPigment=rgb(p.thoraxColor.map(v=>v*p.appendageShade*.7+14));
 const w=29*p.bodyWidth,parts=[];
 const world=['tank','keep','arena-a','arena-b'].includes(prefix);
 const {reachX,reachTop,bottom}=bounds(p);
 const box=world?'-110 -175 220 265':`${-reachX-10} ${(-reachTop-10)*p.bodyLength} ${2*reachX+20} ${(reachTop+bottom+20)*p.bodyLength}`;
 const overall=prefix.startsWith('arena-')?2**(.4*p.bodyGrowth):world?p.bodyFactor:1;
 parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" aria-hidden="true" focusable="false" style="overflow:visible;--gait-duration:${(.25+.65*(1-p.gait)).toFixed(2)}s"><defs><clipPath id="${id}"><ellipse cy="11" rx="${w}" ry="43"/></clipPath><linearGradient id="${id}-shine" x1="0" x2="1"><stop stop-color="#fff" stop-opacity=".32"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#152e25" stop-opacity=".22"/></linearGradient></defs>`);
 parts.push(`<g transform="scale(${overall} ${p.bodyLength*overall})">`);
 // Six jointed legs. Front, middle and hind modifiers preserve real leg-pair structure.
 for(const side of [-1,1])for(let pair=0;pair<3;pair++){
  const y=-14+pair*25,front=pair===0,hind=pair===2;
  let lx=(37+pair*2)*p.legLength*p.legFactor*p.legSpread,ly=y+(pair-1)*15+p.joint*15;
  let tx=lx+13*p.foot,ty=ly+(pair-1)*14+10;
  const thigh=(p.leg==='jumper'&&hind?6+7*p.hind:p.leg==='sturdy'?5:2.8)*p.femur;
  const shin=(p.leg==='shovel'&&front?8:p.leg==='paddle'&&hind?7:2.1)*p.tibia;
  const transform=`translate(${side*18} ${y}) scale(${side} 1)`;
  parts.push(`<g class="leg leg-${pair}" transform="${transform}"><g class="leg-swing"><path d="M0 0 L${round(lx-18)} ${round(ly-y)}" fill="none" stroke="${legPigment}" stroke-width="${thigh}" stroke-linecap="round"/><path d="M${round(lx-18)} ${round(ly-y)} L${round(tx-18)} ${round(ty-y)}" fill="none" stroke="${legPigment}" stroke-width="${shin}" stroke-linecap="round"/><path d="M${round(tx-18)} ${round(ty-y)} q${8*p.foot} 8 ${3-p.claw*8} ${10+p.claw*9}" fill="none" stroke="${legPigment}" stroke-width="2.2"/>`);
  const hairs=Math.round(p.legHair*7)+(p.leg==='paddle'&&hind?8:0),spines=Math.round(p.spines*4)+(p.leg==='spiny'?4:0);
  for(let i=0;i<hairs+spines;i++){const t=(i+1)/(hairs+spines+1),x=lx-18+(tx-lx)*t,yy=ly-y+(ty-ly)*t;parts.push(`<path d="M${round(x)} ${round(yy)} l${i<hairs?7:5} ${i%2?5:-5}" stroke="${legPigment}" stroke-width="${i<hairs?.7:1.5}"/>`);}
  if(p.leg==='hooked')parts.push(`<path d="M${round(tx-18)} ${round(ty-y)} q16 20 5 26 q-14 2 -8 -8" fill="none" stroke="${legPigment}" stroke-width="3"/>`);
  if(p.banding>.6)parts.push(`<circle cx="${round(lx-18)}" cy="${round(ly-y)}" r="2.5" fill="${rgb(p.primary)}"/>`);
  parts.push('</g></g>');
 }
 // Antenna framework, branch anatomy and fine hairs are separate inherited measurements.
 for(const side of [-1,1]){
  const len=8+p.antennaLength*p.antennaFactor*31,spread=13+p.spread*28,endX=spread+len*.2,endY=-51-len,curve=p.curve*35;
  const elbow=p.antenna==='elbow'?p.elbow*.35:0;
  const point=t=>({x:12+(endX-12)*t+Math.sin(t*Math.PI)*(curve+elbow),y:-48+(endY+48)*t});
  const n=Math.round(p.segments),pts=Array.from({length:n+1},(_,i)=>point(i/n));
  parts.push(`<g class="antenna" transform="scale(${side} 1)"><g class="antenna-sweep"><path d="${pts.map((v,i)=>(i?'L':'M')+round(v.x)+' '+round(v.y)).join(' ')}" fill="none" stroke="${limb}" stroke-width="${p.shaftWidth}" stroke-linejoin="round" stroke-linecap="round"/>`);
  for(let i=1;i<=n;i++){
   const t=i/n,q=point(t),bead=p.antenna==='bead'?1.3+p.beadRoundness*2:p.shaftWidth*.65;
   if(p.antenna==='bead'||p.banding>.45)parts.push(`<circle cx="${round(q.x)}" cy="${round(q.y)}" r="${round(bead)}" fill="${p.banding>.65&&i%2===0?rgb(p.primary):limb}"/>`);
   if(p.antenna==='saw')parts.push(`<path d="M${round(q.x)} ${round(q.y)} l${3+p.branchLength*9} 2 l-3 -7Z" fill="${limb}"/>`);
  }
  if(['comb','doublecomb','fan','plates','plume'].includes(p.antenna)){
   const count=Math.round(p.branches),fan=['fan','plates'].includes(p.antenna),plume=p.antenna==='plume';
   for(let i=0;i<count;i++){
    const t=fan?.64+i/count*.34:.15+i/count*.82,q=point(t),extent=(6+p.branchLength*25)*(fan?.6+.8*i/count:Math.sin(t*Math.PI)*.7+.3),plate=p.antenna==='plates';
    for(const branchSide of p.antenna==='comb'?[1]:[-1,1]){
     const ex=q.x+branchSide*extent,ey=q.y-(fan?12+p.plateWidth*18:4+extent*.35);
     parts.push(`<path d="M${round(q.x)} ${round(q.y)} Q${round(ex)} ${round(q.y-4)} ${round(ex)} ${round(ey)}" fill="none" stroke="${limb}" stroke-width="${plate?3+p.plateWidth*4:plume?.7:1.6}" stroke-linecap="round"/>`);
    }
   }
  }
  if(['club','knob','bristle'].includes(p.antenna)){
   const q=point(p.antenna==='club'?.88:1);parts.push(`<ellipse cx="${round(q.x)}" cy="${round(q.y)}" rx="${p.antenna==='bristle'?.8:2+p.tip*5}" ry="${p.antenna==='club'?8+p.tip*7:p.antenna==='bristle'?4:3+p.tip*4}" fill="${limb}"/>`);
  }
  if(p.antenna==='aristate'){const q=point(.65);parts.push(`<ellipse cx="${round(q.x)}" cy="${round(q.y)}" rx="4" ry="7" fill="${limb}"/><path d="M${round(q.x)} ${round(q.y)} q35 -15 22 -36" fill="none" stroke="${limb}" stroke-width="1"/>`);}
  for(let i=0;i<Math.round(p.hairs*23);i++){const q=point(.1+.87*i/Math.max(1,Math.round(p.hairs*23))),lenHair=2+p.hairLength*14;parts.push(`<path d="M${round(q.x)} ${round(q.y)} l${lenHair} -${lenHair*.8} M${round(q.x)} ${round(q.y)} l-${lenHair} -${lenHair*.6}" stroke="${limb}" stroke-width=".65"/>`);}
  parts.push('</g></g>');
 }
 parts.push(`<ellipse cy="11" rx="${w}" ry="43" fill="${body}" stroke="${line}" stroke-width="1.5"/>`);
 // Shared anchor field gives inherited placement tendencies. Development noise is fixed at birth.
 const anchors=[];const ar=G.seeded(1971);
 for(let i=0;i<44;i++){const x=(ar()-.5)*w*1.75,y=-26+ar()*72;anchors.push({x,y,rank:ar()});}
 if(p.visibleLayers){parts.push(`<g clip-path="url(#${id})">`);for(let layer=0;layer<p.visibleLayers;layer++){
  const density=layer?p.secondaryDensity:p.density,size=layer?p.secondarySize:p.radius,bias=layer?p.secondaryBias:p.frontBias,col=rgb(layer?p.secondary:p.primary);
  const ranked=anchors.map(a=>({...a,score:a.rank+bias*(a.y/45)*.6-p.edgeBias*Math.abs(a.x/w)*.45+p.cluster*Math.sin(a.x*.12+a.y*.06)*.3})).sort((a,b)=>a.score-b.score);
  const count=3+Math.round(density*17),rad=2.4+size*10;
  for(let i=0;i<count;i++){const a=ranked[i],x=a.x+(r()-.5)*p.jitter*7,y=a.y+(r()-.5)*p.jitter*7,rx=rad*(.7+r()*.5),ry=rx*p.patternStretch;
   for(const sx of p.symmetry>.55?[-Math.abs(x),Math.abs(x)]:[x]){
    if(p.shape==='stripe')parts.push(`<path d="M${round(sx)} ${round(y-ry)} q${rx*2} ${ry} 0 ${ry*2}" fill="none" stroke="${col}" stroke-width="${rx}" opacity=".9"/>`);
    else if(p.shape==='mottle'){const pts=Array.from({length:10},(_,k)=>{const a=k/10*Math.PI*2,f=.65+r()*.6;return `${round(sx+Math.cos(a)*rx*f)},${round(y+Math.sin(a)*ry*f)}`;});parts.push(`<polygon points="${pts.join(' ')}" fill="${col}" opacity="${.75+p.softness*.2}" stroke="${col}" stroke-width="${p.softness*3}" stroke-linejoin="round"/>`);}
    else parts.push(`<ellipse cx="${round(sx)}" cy="${round(y)}" rx="${p.shape==='speckle'?rx*.35:rx}" ry="${p.shape==='speckle'?ry*.35:ry}" fill="${col}" opacity="${.95-p.softness*.2}"/>`);
   }
  }
 }parts.push('</g>');}
 if(p.ridges>.5){parts.push(`<g clip-path="url(#${id})" fill="none" stroke="#172e27" opacity="${.08+p.ridgeHeight*.25}" stroke-width="${.5+p.ridgeHeight}">`);for(let i=1;i<=Math.round(p.ridges);i++){const x=-w+2*w*i/(Math.round(p.ridges)+1);parts.push(`<path d="M${x} -32 Q${x*1.15} 12 ${x*.75} 54"/>`);}parts.push('</g>');}
 if(p.gloss>.05)parts.push(`<ellipse cx="${-w*.4}" cy="0" rx="${w*.2}" ry="27" fill="#fff" opacity="${p.gloss*.45}" transform="rotate(12)"/>`);
 if(p.metallic>.05)parts.push(`<ellipse cy="11" rx="${w}" ry="43" fill="none" stroke="${rgb(p.primary)}" stroke-width="${1+p.metallic*2}" opacity="${p.metallic*.7}"/>`);
 // Horn number and shape transmit real parental copies; length grows continuously.
 for(let i=0;i<p.visibleHorns;i++){const offset=(i-(p.visibleHorns-1)/2)*11,h=3+45*p.horn*p.hornFactor,curve=p.hornShape==='curved'?h*.3:0;
 const path=p.hornShape==='forked'?`M-3 0 Q-6 ${-h*.5} -8 ${-h} Q-2 ${-h*.9} 0 ${-h*.5} Q2 ${-h*.9} 8 ${-h} Q6 ${-h*.5} 3 0Z`:`M-4 0 Q${-7+curve} ${-h*.65} ${curve} ${-h} Q${7+curve} ${-h*.65} 4 0Z`;
 parts.push(`<path class="inherited-horn" data-horn="${i+1}" d="${path}" transform="translate(${offset} -55)" fill="${limb}" stroke="${line}" stroke-width="1"/>`);}
 if(p.jaw>.01)parts.push(`<path transform="translate(0 -57) scale(${p.jawFactor}) translate(0 57)" d="M-7 -57 q${-8-p.jaw*8} ${-8-p.jaw*12} ${5+p.jaw*5} ${-10-p.jaw*14} M7 -57 q${8+p.jaw*8} ${-8-p.jaw*12} ${-5-p.jaw*5} ${-10-p.jaw*14}" stroke="${limb}" stroke-width="${1+p.jaw*3}" fill="none"/>`);
 parts.push(`<ellipse cy="11" rx="${w}" ry="43" fill="url(#${id}-shine)"/><path d="M0 -31 Q-2 12 0 54" fill="none" stroke="${line}" stroke-width="1.3"/><ellipse cy="-29" rx="${23*p.bodyWidth*p.pronotum}" ry="15" fill="${thoraxPigment}" stroke="${line}" stroke-width="1.5"/><g class="head-pose"><g transform="translate(0 -47) scale(${p.headFactor}) translate(0 47)"><ellipse cy="-47" rx="${16*p.headWidth}" ry="13" fill="${body}" stroke="${line}" stroke-width="1.5"/><ellipse cx="-13" cy="-49" rx="3" ry="5" fill="#182a24"/><ellipse cx="13" cy="-49" rx="3" ry="5" fill="#182a24"/><path d="M-5 -60 L-3 -64 M5 -60 L3 -64" stroke="${limb}" stroke-width="2" stroke-linecap="round"/></g></g></g></svg>`);
 return parts.join('');
}
root.PatternBeetles={draw,rgb,bounds};
})(globalThis);
