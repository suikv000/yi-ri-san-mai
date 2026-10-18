#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),data=JSON.parse(fs.readFileSync(path.join(root,'references/snapshot.json'),'utf8'));
const c={window:{}};vm.createContext(c);for(const f of ['nutrition.js','planner.js'])vm.runInContext(fs.readFileSync(path.join(root,'lib',f),'utf8'),c);
try{
 const defaults=c.window.MaiPlanner.defaults,settings={...defaults};let input={};
 const args=process.argv.slice(2);for(let i=0;i<args.length;i++){
  const a=args[i];if(a==='--help'){console.log('Snapshot-only planning: node plan.cjs [--budget 450] [--goal loss|maintain|gain] [--settings profile.json]');process.exit(0);}
  if(!['--budget','--goal','--settings'].includes(a)||!args[i+1])throw Error('Unknown or incomplete argument; use --help');
  const value=args[++i];if(a==='--settings')Object.assign(input,JSON.parse(fs.readFileSync(value,'utf8')));else input[a==='--goal'?'objective':'budget']=a==='--budget'?Number(value):value;
 }
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Settings must be a JSON object');
 for(const [k,v] of Object.entries(input)){if(!Object.hasOwn(defaults,k))throw Error('Unknown settings field: '+k);settings[k]=v;}
 const target=c.window.MaiNutrition.targets(settings);if(!target.valid)throw Error(target.errors.join('; '));
 if(!Number.isFinite(settings.budget)||settings.budget<100||settings.budget>1500)throw Error('Budget must be between 100 and 1500 yuan');
 if(!['cash','amortized'].includes(settings.budgetBasis)||![5,10,15,20,30].includes(settings.maxDetour)||!['balanced','saving','speed','variety'].includes(settings.mode)||!Number.isInteger(settings.seed))throw Error('Invalid planning preference');
 for(const pre of ['card','gold'])if(!['none','owned','new'].includes(settings[pre])||!Number.isFinite(settings[pre+'Price'])||settings[pre+'Price']<0||settings[pre+'Price']>300||!Number.isInteger(settings[pre+'Days'])||settings[pre+'Days']<7||settings[pre+'Days']>366||!Number.isInteger(settings[pre+'Uses'])||settings[pre+'Uses']<0||settings[pre+'Uses']>(pre==='card'?7:14))throw Error('Invalid card settings');
 const p=c.window.MaiPlanner.create(data),plan=p.generate(settings),totals=p.totals(plan,settings);
 const days=Array.from({length:7},(_,day)=>{const n=p.daily(plan,day);return {day:day+1,nutrition:n,issues:[...(n.kcal<target.kcalMin||n.kcal>target.kcalMax?['energy_outside_reference']:[]),...(n.protein<target.protein?['protein_below_reference']:[]),...(n.sodium>=target.sodium?['sodium_high']:[]),...(n.fat>target.fat?['fat_above_reference']:[])]};});
 console.log(JSON.stringify({mode:'snapshot',snapshotDate:data.location.time,location:data.location,profileSource:Object.keys(input).length?'user settings merged with explicit sample defaults':'sample defaults',settings,target,feasible:plan.length===21,minimumCostFen:p.minimum(settings),budgetCostFen:p.budgetCost(totals,settings),cashTotalFen:totals.cashTotal,amortizedTotalFen:totals.total,feesFen:totals.fee,newCardPurchaseFen:totals.purchaseFees,meals:plan.map((slot,i)=>{const r=p.recipe(slot);return {day:slot.day+1,meal:slot.meal,title:r.title,items:r.items,store:slot.store,priceFen:totals.ledger[i].cashMeal,nutrition:Object.fromEntries(['kcal','protein','carbs','fat','sodium'].map(k=>[k,r[k]])),value:p.valueMetrics(r),purchase:r.route.map(o=>({name:o.title,kind:o.kind,priceFen:o.price,time:o.time}))};}),days,limitations:['Historical snapshot, not current or next-week availability','Combined basket equals summed purchase units; final whole-order quote pending','Walking minutes are distance/80m per minute, not navigation','No account coupons, automatic task, ordering or payment']},null,2));
}catch(e){console.error(JSON.stringify({error:e.message}));process.exitCode=1;}
