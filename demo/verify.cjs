const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const c={window:{}};vm.createContext(c);for(const f of ['data.js','nutrition.js','planner.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,f),'utf8'),c);
const {MaiPlanner,MAI_DATA,MaiNutrition}=c.window,p=MaiPlanner.create(MAI_DATA),s={...MaiPlanner.defaults};
const target=MaiNutrition.targets(s);assert.equal(target.resting,1699);assert.equal(target.tdee,2336);assert.equal(target.kcal,1990);assert.equal(target.protein,90);
assert.equal(MaiNutrition.targets({...s,objective:'gain'}).protein,120);
for(const change of [{age:17},{age:80},{weight:NaN},{special:true},{height:175,weight:45,objective:'loss'}]){assert.equal(MaiNutrition.targets({...s,...change}).valid,false);assert.equal(p.generate({...s,...change}).length,0);}
const find=(items,type='正餐')=>p.active.find(r=>r.type===type&&r.items.slice().sort().join('|')===items.slice().sort().join('|'));
const dc=find(['双层吉士汉堡','小杯玉米杯']);assert.equal(dc.price,1490);assert.equal(dc.kcal,482);assert.equal(dc.protein,29);assert.ok(Math.abs(dc.proteinPerYuan-29/14.9)<1e-9);assert.ok(Math.abs(p.valueMetrics(dc).cost20g-14.9/29*20)<1e-9);
assert.equal(find(['双层吉士汉堡']).price,2250);assert.equal(find(['麦香鸡','小杯玉米杯']).price,1390);
const same=p.purchase(['双层吉士汉堡','小杯玉米杯','纯牛奶（盒装）'],'正餐');assert.equal(same.price,2590);assert.equal(same.offers.length,2);
const two=p.purchase(['双层吉士汉堡','小杯玉米杯','双层吉士汉堡','无糖可口可乐中杯'],'正餐');assert.equal(two.price,2980);assert.equal(two.offers.length,2);
assert.equal(p.purchase(['无糖可口可乐中杯'],'正餐'),null,'Unreturned standalone cola is not a free product');
assert.equal(find(['原味板烧鸡腿炒双蛋堡','优品豆浆小杯'],'早餐').price,2100,'Conditional card display price must not replace ordinary quote');
assert.equal(find(['原味板烧鸡腿炒双蛋堡','纯牛奶（盒装）'],'早餐').price,2250);
assert.ok(!p.active.some(r=>r.title.includes('大堡口福')),'Unknown exact nutrition must not be fabricated');
for(const r of p.active){assert.ok(r.items.length>=1);assert.ok(r.route.length>=1);assert.equal(r.price,r.route.reduce((n,x)=>n+x.price,0));for(const k of ['kcal','protein','fat','carbs','sodium'])assert.equal(r[k],r.items.reduce((n,name)=>n+MAI_DATA.foods[name][k],0));assert.ok(r.route.every(o=>o.type===r.type));}
assert.equal(MAI_DATA.foods['板烧鸡腿堡'].fiber,null);
assert.equal(p.forStore(dc,'1980076'),null,'Nearest store must not inherit another store double-burger offer');
assert.equal(p.forStore(dc,'1980342').price,1490);
const soy=find(['原味板烧鸡腿炒双蛋堡','优品豆浆小杯'],'早餐');
assert.equal(p.forStore(soy,'1980076').price,2150);assert.equal(p.forStore(soy,'1980342').price,2200);assert.equal(p.forStore(soy,'1980183').price,2100);
const nearestSettings={...s,maxDetour:5,budget:800},near=p.generate(nearestSettings);assert.equal(near.length,21);assert.ok(near.every(x=>x.store.id==='1980076'));
assert.ok(near.every(x=>p.forStore(p.recipe(x),x.store.id)));

let tested=0;
for(const basis of ['cash','amortized'])for(const budget of [100,280,350,450,550,800])for(const objective of ['loss','maintain','gain'])for(const cards of [{card:'none',gold:'none'},{card:'new',gold:'new'}]){
 const v={...s,budget,budgetBasis:basis,objective,...cards},a=p.generate(v),minimum=p.minimum(v);
 if(minimum>budget*100)assert.equal(a.length,0);
 else{assert.equal(a.length,21);const t=p.totals(a,v);assert.ok(p.budgetCost(t,v)<=Math.round(budget*100));assert.equal(new Set(a.map(x=>x.day+'-'+x.meal)).size,21);assert.ok(a.every(x=>(x.meal===0)===(p.recipe(x).type==='早餐')));assert.ok(a.every(x=>!p.recipe(x).legacy));assert.ok(a.every(x=>p.forStore(p.recipe(x),x.store.id)));assert.ok(a.every(x=>p.cost(x)===p.forStore(p.recipe(x),x.store.id).price));assert.ok(a.every(x=>x.store.minutes<=v.maxDetour));assert.equal(t.card,0);assert.equal(t.coupons,0);}
 tested++;
}
let a=p.generate(s),locked=a.map(x=>({...x,store:{...x.store}}));locked[13].locked=true;
const changed=p.generate({...s,budget:550,seed:1},locked);assert.equal(changed[13].recipe,locked[13].recipe);assert.equal(changed[13].store.id,locked[13].store.id);
const min=p.minimum(s,locked);assert.equal(p.generate({...s,budget:min/100-.01},locked).length,0);assert.equal(p.generate({...s,budget:min/100},locked).length,21);
const noCards=p.totals(a,s),withCards=p.totals(a,{...s,card:'new',gold:'new',coupons:true});assert.equal(withCards.card,0);assert.equal(withCards.coupons,0);assert.equal(withCards.cashTotal,noCards.cashTotal+4900);assert.equal(withCards.total,noCards.total+1143);assert.equal(withCards.unallocated,1143);assert.ok(withCards.cardRows.every(x=>x.used===0));
assert.equal([0,7,14,21,28].reduce((n,start)=>n+p.prorate(3000,31,start,Math.min(31,start+7)),0),3000);
let randomChecks=0;
for(const basis of ['cash','amortized']){
 const v={...s,budget:550,budgetBasis:basis,gold:'new'},base=p.generate(v);base[13].locked=true;const original=JSON.stringify(base);
 for(let i=0;i<21;i++)for(const draw of [0,.31,.73,.999999]){
  const r=p.randomReplacement(base,i,v,[],()=>draw);if(base[i].locked){assert.equal(r,null);continue;}if(!r)continue;
  assert.notEqual(r.plan[i].recipe,base[i].recipe);assert.equal(r.plan[i].locked,false);assert.ok(p.budgetCost(p.totals(r.plan,v),v)<=v.budget*100);
  for(let j=0;j<21;j++)if(j!==i)assert.equal(JSON.stringify(r.plan[j]),JSON.stringify(base[j]));assert.equal(JSON.stringify(base),original);randomChecks++;
 }
 let cur=base,seen=[base[0].recipe];for(let n=0;n<12;n++){const fresh=p.replacementOptions(cur,0,v).filter(x=>x.allowed&&!seen.includes(x.recipe.id)),r=p.randomReplacement(cur,0,v,seen,()=>.7);if(!r)break;if(fresh.length)assert.ok(!seen.includes(r.recipe.id));if(r.reset)seen=[];seen.push(r.recipe.id);cur=r.plan;}
}
const grow={...s,budget:800,objective:'gain'},g=p.generate(grow),gt=p.totals(g,grow);assert.ok(gt.kcal/7>noCards.kcal/7);assert.ok(gt.protein/7>noCards.protein/7);
const html=fs.readFileSync(path.join(__dirname,'..','一日三麦-交互演示.html'),'utf8'),script=html.split('<script>')[1]?.split('</script>')[0];assert.ok(script);new vm.Script(script);
console.log(`PASS: ${tested} budget/goal/card scenarios; ${randomChecks} random swaps; exact purchase cover, single vs bundle, duplicate quantities, quote prices, protein ratios, no assumed discounts, fee accounting, nutrition sums, locks, exclusions, standalone syntax.`);
console.log(JSON.stringify({default:{cash:noCards.cashTotal/100,kcal:noCards.kcal/7,protein:noCards.protein/7},gain:{cash:gt.cashTotal/100,kcal:gt.kcal/7,protein:gt.protein/7},candidates:p.active.length}));
