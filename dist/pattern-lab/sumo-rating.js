(function(root){
'use strict';
const G=typeof module!=='undefined'&&module.exports?require('./genetics.js'):root.PatternGenetics;
// A transparent, fixed build rubric, not a prediction of a particular match.
// Neutral growth targets reward a balanced build rather than unlimited size.
const groups=[
 {key:'power',label:'Power and body',points:20,traits:['strength','mass','bodyWidth',{key:'bodyGrowth',ideal:0},'jaw',{key:'jawGrowth',ideal:1},{key:'headGrowth',ideal:-1}]},
 {key:'footing',label:'Grip and balance',points:20,traits:['grip','brace','lateralBalance','claw','legSpread']},
 {key:'movement',label:'Movement',points:15,traits:['motor','stride','acceleration','turnRate','legLength',{key:'legGrowth',ideal:0}]},
 {key:'sustain',label:'Stamina and recovery',points:15,traits:['endurance','recovery']},
 {key:'behavior',label:'Senses and behavior',points:20,traits:['tracking','reaction','focus','pushDrive','persistence',{key:'wander',ideal:0},'tactics','edgeSense','centerDrive','curiosity','sociality','caution',{key:'antennaGrowth',ideal:0}]},
 {key:'abilities',label:'Special abilities',points:10,traits:[
  {key:'horn',gate:'lift'},{key:'hornGrowth',ideal:0,gate:'lift'},{key:'hornCount',gate:'lift'},
  {key:'jumpGate',ability:'jump'},{key:'puffGate',ability:'puff'},
  ...['lift','jump','puff'].flatMap(move=>G.abilityFactors.map(factor=>({key:move+factor,gate:move})))
 ]}
].map(group=>({...group,traits:group.traits.map(trait=>typeof trait==='string'?{key:trait}:trait)}));
const traitKeys=groups.flatMap(group=>group.traits.map(trait=>trait.key));
const tiers=['empty','copper','silver','gold','diamond'];
function quality(value,definition,ideal=definition.max){
 if(value===ideal)return 1;
 const span=value<ideal?ideal-definition.min:definition.max-ideal;
 return span?G.clamp(1-Math.abs(value-ideal)/span):0;
}
function stars(rating){
 if(!Number.isInteger(rating)||rating<1||rating>20)throw Error('A sumo rating must be a whole number from 1 to 20.');
 const base=Math.floor(rating/5),extra=rating%5;
 return Array.from({length:5},(_,i)=>{const value=base+(i<extra?1:0);return {value,tier:tiers[value]};});
}
function evaluate(beetle){
 const p=G.phenotype(beetle),active={lift:p.visibleHorns>0&&p.horn*p.hornFactor>.008,jump:p.canJump,puff:p.canPuff};
 let perfect=true;
 const breakdown=groups.map(group=>{
  const traits=group.traits.map(trait=>{
   let value;
   if(trait.ability)value=active[trait.ability]?1:0;
   else if(trait.gate&&!active[trait.gate])value=0;
   else if(trait.key==='hornCount')value=p.visibleHorns/3;
   else value=quality(p[trait.key],G.byKey[trait.key],trait.ideal);
   if(value!==1)perfect=false;
   return {key:trait.key,quality:value};
  });
  return {key:group.key,label:group.label,maximum:group.points,points:group.points*traits.reduce((total,trait)=>total+trait.quality,0)/traits.length,traits};
 });
 const points=breakdown.reduce((total,group)=>total+group.points,0);
 // Check perfection before rounding: even 99.999999 must stay below 20/20.
 const rating=perfect?20:Math.max(1,Math.min(19,Math.floor(points/5)));
 return {rating,points,perfect,stars:stars(rating),groups:breakdown};
}
function markup(result){
 const label='Sumo trait rating '+result.rating+' out of 20. '+result.stars.map(star=>star.tier).join(', ')+'.';
 const path='M12 1.8 15.15 8.2 22.2 9.2 17.1 14.2 18.3 21.3 12 17.95 5.7 21.3 6.9 14.2 1.8 9.2 8.85 8.2Z';
 return '<div class="lens-sumo-rating" role="img" aria-label="'+label+'" title="Sumo trait rating. Copper = 1, silver = 2, gold = 3, diamond = 4. A build score, not a guaranteed win."><span class="lens-rating-label" aria-hidden="true">Sumo</span><span class="lens-rating-stars" aria-hidden="true">'+result.stars.map(star=>'<svg class="sumo-rating-star '+star.tier+'" data-tier="'+star.tier+'" viewBox="0 0 24 24" focusable="false"><path d="'+path+'"/><path class="star-shine" d="M12 3.8 14.5 9 12 12 9.5 9Z"/></svg>').join('')+'</span><strong aria-hidden="true">'+result.rating+'<small>/20</small></strong></div>';
}
const api={groups,traitKeys,evaluate,stars,markup};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PatternSumoRating=api;
})(typeof globalThis!=='undefined'?globalThis:this);
