/* Local, deterministic demonstration planner. Prices and routes are fixtures. */
(function (root) {
  'use strict';
  // Whole-meal fixtures. These are custom combinations, not verified official bundle SKUs.
  const defs = [
    ['b0','早餐','猪柳蛋热奶三件餐','猪肉',1850,['猪柳蛋麦满分','脆薯饼','热牛奶小杯']],
    ['b1','早餐','火腿扒豆浆三件餐','猪肉',1500,['火腿扒麦满分','脆薯饼','优品豆浆小杯']],
    ['b2','早餐','板烧暖心粥餐','鸡肉',1750,['原味板烧鸡腿麦满分','皮蛋鸡肉粥','热牛奶小杯']],
    ['b3','早餐','猪柳薯饼热奶餐','猪肉',1650,['猪柳麦满分','脆薯饼','热牛奶小杯']],
    ['b4','早餐','双蛋热奶三件餐','猪肉',1950,['猪柳炒双蛋堡','苹果片','热牛奶小杯']],
    ['b5','早餐','脆鸡豆浆三件餐','鸡肉',1700,['大脆鸡扒麦满分','苹果片','优品豆浆小杯']],
    ['b6','早餐','烟肉蛋暖粥餐','猪肉',1650,['烟肉蛋麦满分','皮蛋鸡肉粥','优品豆浆小杯']],
    ['b7','早餐','双层板烧热奶餐','鸡肉',2250,['双层原味板烧鸡腿麦满分','脆薯饼','热牛奶小杯']],
    ['b8','早餐','板烧双蛋活力餐','鸡肉',2450,['原味板烧鸡腿炒双蛋堡','脆薯饼','热牛奶小杯']],
    ['b9','早餐','麦满分美式三件餐','猪肉',1750,['猪柳蛋麦满分','脆薯饼','热美式小杯']],
    ['m0','正餐','板烧双拼四件餐','鸡肉',2600,['板烧鸡腿堡','麦乐鸡5块','小杯玉米杯','无糖可口可乐中杯']],
    ['m1','正餐','巨无霸经典三件餐','牛肉',2800,['巨无霸','小薯条','无糖可口可乐中杯']],
    ['m2','正餐','鱼香双拼四件餐','鱼肉',2450,['麦香鱼','麦乐鸡5块','大杯玉米杯','无糖可口可乐中杯']],
    ['m3','正餐','双吉薯条三件餐','牛肉',2350,['双层吉士汉堡','小薯条','无糖可口可乐中杯']],
    ['m4','正餐','麦香鸡玉米牛奶餐','鸡肉',2200,['麦香鸡','大杯玉米杯','纯牛奶（盒装）']],
    ['m5','正餐','麦辣玉米三件餐','鸡肉',2500,['麦辣鸡腿汉堡','大杯玉米杯','无糖可口可乐中杯']],
    ['m6','正餐','蔬萃牛堡经典餐','牛肉',2700,['培根蔬萃双层牛堡','小薯条','无糖可口可乐中杯']],
    ['m7','正餐','双层鳕鱼牛奶餐','鱼肉',2900,['双层深海鳕鱼堡','大杯玉米杯','纯牛奶（盒装）']],
    ['m8','正餐','板烧玉米牛奶餐','鸡肉',2450,['板烧鸡腿堡','大杯玉米杯','纯牛奶（盒装）']],
    ['m9','正餐','双吉双拼牛奶餐','牛肉',3100,['双层吉士汉堡','麦乐鸡5块','纯牛奶（盒装）']],
    ['m10','正餐','板烧双拼牛奶餐','鸡肉',3200,['板烧鸡腿堡','麦乐鸡5块','纯牛奶（盒装）']],
    ['m11','正餐','鳕鱼双拼牛奶餐','鱼肉',3450,['双层深海鳕鱼堡','麦乐鸡5块','纯牛奶（盒装）']],
    ['m12','正餐','巨无霸充能四件餐','牛肉',3600,['巨无霸','中薯条','麦乐鸡5块','纯牛奶（盒装）']],
    ['m13','正餐','麦香鱼玉米牛奶餐','鱼肉',2250,['麦香鱼','大杯玉米杯','纯牛奶（盒装）']],
    ['m14','正餐','麦辣经典三件餐','鸡肉',2550,['麦辣鸡腿汉堡','小薯条','无糖可口可乐中杯']],
    ['m15','正餐','双吉玉米牛奶餐','牛肉',2500,['双层吉士汉堡','大杯玉米杯','纯牛奶（盒装）']]
  ];
  const settings = {budget:450,budgetBasis:'cash',height:175,weight:75,age:30,sex:'male',activity:1.375,objective:'loss',training:false,special:false,mode:'balanced',card:'none',cardPrice:30,cardDays:30,cardUses:7,gold:'none',goldPrice:19,goldDays:30,goldUses:14,coupons:false,maxDetour:20,homeWednesday:false,seed:0};
  function create(data) {
    const nutrientKeys=['kcal','protein','fat','carbs','sodium','calcium'];
    const sumNutrition=items=>Object.fromEntries(nutrientKeys.map(k=>[k,items.reduce((n,x)=>n+data.foods[x][k],0)]));
    const offers=data.offers;
    const count=items=>items.reduce((m,x)=>(m[x]=(m[x]||0)+1,m),{});
    // Exact multiset cover: same edible items, cheapest combination of observed purchase units.
    // Never assume an extra drink is free or that unrelated promotions stack.
    const purchaseCache=new Map();
    function purchase(items,type,storeId=null){
      const key=(storeId||'reference')+'|'+type+'|'+items.slice().sort().join('|');if(purchaseCache.has(key))return purchaseCache.get(key);
      if(!items.length)return {price:0,offers:[]};
      const remaining=count(items);let best=null;
      for(const original of offers.filter(o=>o.type===type&&o.items.includes(items[0])&&(!storeId||o.storeQuotes?.[storeId]))){
        const offer=storeId?{...original,...original.storeQuotes[storeId]}:original;
        const use=count(offer.items);if(Object.keys(use).some(k=>use[k]>(remaining[k]||0)))continue;
        const rest={...remaining};for(const k in use)rest[k]-=use[k];
        const next=purchase(Object.keys(rest).flatMap(k=>Array(rest[k]).fill(k)),type,storeId);
        if(next&&(!best||offer.price+next.price<best.price))best={price:offer.price+next.price,offers:[offer,...next.offers]};
      }
      purchaseCache.set(key,best);return best;
    }
    const recipes=defs.map(([id,type,title,family,price,items])=>({id,type,title,main:items[0],items,price,family,legacy:true,kind:'旧版自选组合',source:'旧版演示价',...sumNutrition(items)}));
    const signatures=new Set();
    const family=name=>/鱼/.test(name)?'鱼肉':/吉士|牛|巨无霸/.test(name)?'牛肉':/猪|火腿|烟肉/.test(name)?'猪肉':'鸡肉';
    function add(items,type,title){
      const signature=type+'|'+items.slice().sort().join('|');if(signatures.has(signature))return;
      const route=purchase(items,type);if(!route)return;
      signatures.add(signature);const main=items[0],nutrition=sumNutrition(items),id='n'+(recipes.length-defs.length);
      const kind=route.offers.length===1?route.offers[0].kind:route.offers.some(o=>o.kind!=='单点')?'组合＋加购':'单点搭配';
      recipes.push({id,type,title:title||items.join('＋'),main,items,family:family(main),price:route.price,route:route.offers,kind,
        source:route.offers.length===1?'核价快照':'核价单元合计',legacy:false,image:data.foods[main].image,...nutrition,
        proteinPerYuan:nutrition.protein/(route.price/100),proteinPer100Kcal:nutrition.kcal?nutrition.protein/nutrition.kcal*100:0});
    }
    const mains=new Set(['猪柳蛋麦满分','火腿扒麦满分','原味板烧鸡腿麦满分','猪柳麦满分','猪柳炒双蛋堡','大脆鸡扒麦满分','双层原味板烧鸡腿麦满分','原味板烧鸡腿炒双蛋堡','双层吉士汉堡','麦香鱼','麦香鸡','板烧鸡腿堡','麦辣鸡腿汉堡','培根蔬萃双层牛堡','麦乐鸡5块']);
    offers.forEach(o=>{if(o.kind!=='单点'||mains.has(o.items[0]))add(o.items,o.type,o.title);});
    // Keep combinations only when every item has a quoted buying route.
    defs.forEach(([,type,title,, ,items])=>add(items,type,title));
    offers.filter(o=>o.type==='早餐'&&o.kind==='单点'&&mains.has(o.items[0])).forEach(o=>{
      add([...o.items,'纯牛奶（盒装）'],'早餐');
      if(o.items[0]==='猪柳蛋麦满分'||o.items[0]==='原味板烧鸡腿炒双蛋堡')add([...o.items,'脆薯饼','纯牛奶（盒装）'],'早餐');
    });
    offers.filter(o=>o.kind==='1+1'&&o.items[0]!=='麦乐鸡5块').forEach(o=>{
      add([...o.items,'麦乐鸡5块'],'正餐');add([...o.items,'纯牛奶（盒装）'],'正餐');
    });
    for(const second of ['双层吉士汉堡','麦香鸡','麦香鱼'])add(['双层吉士汉堡','小杯玉米杯',second,'无糖可口可乐中杯'],'正餐');
    const byId=Object.fromEntries(recipes.map(r=>[r.id,r]));
    const localized=new Map();
    for(const r of recipes.filter(r=>!r.legacy)){
      const found=[];
      for(const store of data.nearbyStores.filter(x=>x.priced)){
        const route=purchase(r.items,r.type,store.id);if(!route)continue;
        const v={...r,price:route.price,route:route.offers,storeId:store.id,kind:route.offers.length===1?route.offers[0].kind:route.offers.some(o=>o.kind!=='单点')?'组合＋加购':'单点搭配',source:route.offers.length===1?'门店核价快照':'门店核价合计',proteinPerYuan:r.protein/(route.price/100)};
        localized.set(r.id+'|'+store.id,v);found.push(v);
      }
      if(found.length){const best=found.sort((a,b)=>a.price-b.price)[0];Object.assign(r,{price:best.price,route:best.route,source:best.source,proteinPerYuan:best.proteinPerYuan,lowestStore:best.storeId});}
    }
    const forStore=(r,id)=>r.legacy?r:localized.get(r.id+'|'+id)||null;
    const recipe=slot=>forStore(byId[slot.recipe],slot.store?.id)||byId[slot.recipe];
    const active=recipes.filter(r=>!r.legacy&&r.lowestStore);
    const valueMetrics=(r,price=r.price)=>({perYuan:price>0?r.protein/(price/100):null,per100Kcal:r.kcal>0?r.protein/r.kcal*100:null,cost20g:r.protein>0?(price/100)/r.protein*20:null});
    const storesFor=(day,meal,s)=>data.nearbyStores.filter(x=>x.priced&&x.minutes<=s.maxDetour).map(x=>({...x,delta:0,tag:'时代奥城周边 · 接口距离'}));
    const cost = slot => recipe(slot).price+(recipe(slot).legacy?slot.store.delta:0);
    const prorate=(fee,days,start=0,end=Math.min(start+7,days))=>Math.round(fee*Math.min(days,Math.max(0,end))/days)-Math.round(fee*Math.min(days,Math.max(0,start))/days);
    function cardModels(s) {
      return [
        {id:'breakfast',name:'早餐卡',state:s.card,price:Math.round(s.cardPrice*100),days:s.cardDays,limit:s.cardUses,discount:200,eligible:p=>p.meal===0&&recipe(p).legacy},
        {id:'gold',name:'麦金卡',state:s.gold,price:Math.round(s.goldPrice*100),days:s.goldDays,limit:s.goldUses,discount:250,eligible:p=>p.meal!==0&&recipe(p).legacy}
      ].filter(c=>c.state!=='none').map(c=>({...c,weeklyFee:prorate(c.price,c.days),cashPurchase:c.state==='new'?c.price:0}));
    }
    // Demo alternatives are mutually exclusive per meal. Real compatibility must be verified by MCP.
    function billMeals(plan,s,cards=cardModels(s)) {
      const used=Object.fromEntries(cards.map(c=>[c.id,0]));let coupons=s.coupons?2:0;
      return plan.map(p=>{
        const gross=cost(p);let best={amount:0,id:null};
        for(const c of cards)if(c.eligible(p)&&used[c.id]<c.limit&&c.discount>best.amount)best={amount:c.discount,id:c.id};
        const coupon=recipe(p).legacy&&p.meal===1&&coupons>0&&300>best.amount?300:0;
        if(coupon){coupons--;best={amount:0,id:null};}
        else if(best.id)used[best.id]++;
        return {gross,card:best.amount,cardSource:best.id,coupon,cashMeal:gross-best.amount-coupon,cardShare:0,net:gross-best.amount-coupon};
      });
    }
    function totals(plan,s) {
      const cards=cardModels(s),ledger=billMeals(plan,s,cards);let unallocated=0;
      const cardRows=cards.map(c=>{
        const indices=ledger.map((x,i)=>x.cardSource===c.id?i:-1).filter(i=>i>=0);
        const used=indices.length,grossSavings=indices.reduce((n,i)=>n+ledger[i].card,0);
        if(used){
          const base=Math.floor(c.weeklyFee/used),remainder=c.weeklyFee%used;
          indices.forEach((i,k)=>{ledger[i].cardShare=base+(k<remainder?1:0);ledger[i].net+=ledger[i].cardShare;});
        }else unallocated+=c.weeklyFee;
        return {...c,eligible:undefined,used,grossSavings,netSaving:grossSavings-c.weeklyFee,perUse:used?c.weeklyFee/used:null};
      });
      const sum=k=>ledger.reduce((n,x)=>n+x[k],0);
      const fee=cards.reduce((n,c)=>n+c.weeklyFee,0),purchaseFees=cards.reduce((n,c)=>n+c.cashPurchase,0);
      return {gross:sum('gross'),card:sum('card'),coupons:sum('coupon'),fee,purchaseFees,unallocated,cardRows,
        total:sum('net')+unallocated,cashTotal:sum('cashMeal')+purchaseFees,ledger,minutes:plan.reduce((n,p)=>n+p.store.minutes,0),
        unique:new Set(plan.map(p=>p.recipe)).size,
        kcal:plan.reduce((n,p)=>n+recipe(p).kcal,0),protein:plan.reduce((n,p)=>n+recipe(p).protein,0)};
    }
    const budgetCost=(t,s)=>s.budgetBasis==='cash'?t.cashTotal:t.total;
    const daily=(plan,day)=>Object.fromEntries(nutrientKeys.map(k=>[k,plan.filter(p=>p.day===day).reduce((n,p)=>n+recipe(p)[k],0)]));
    function choicesFor(s,old=[]){return Array.from({length:21},(_,i)=>{
      const day=Math.floor(i/3),meal=i%3,locked=old.find(p=>p.day===day&&p.meal===meal&&p.locked);
      if(locked)return [{...locked,store:{...locked.store}}];
      return active.filter(r=>r.kcal>=250&&(meal===0?r.type==='早餐':r.type==='正餐')).flatMap(r=>{
        const stores=storesFor(day,meal,s).filter(store=>forStore(r,store.id));
        // For identical food, a farther store at no lower price is dominated.
        return stores.filter(st=>!stores.some(other=>other.id!==st.id&&other.minutes<=st.minutes&&forStore(r,other.id).price<=forStore(r,st.id).price&&(other.minutes<st.minutes||forStore(r,other.id).price<forStore(r,st.id).price))).map(store=>({day,meal,recipe:r.id,store,locked:false}));
      });
    });}
    function generate(s,old=[]){
      const target=root.MaiNutrition.targets(s);if(!target.valid)return [];
      const choices=choicesFor(s,old);if(choices.some(x=>!x.length))return [];
      const cheapest=choices.map(xs=>xs.reduce((a,b)=>cost(a)<cost(b)?a:b));
      const fixed=budgetCost(totals(cheapest,s),s)-cheapest.reduce((n,p)=>n+cost(p),0),cap=Math.round(s.budget*100);
      if(cheapest.reduce((n,p)=>n+cost(p),fixed)>cap)return [];
      const suffix=Array(22).fill(0);for(let i=20;i>=0;i--)suffix[i]=suffix[i+1]+cost(cheapest[i]);
      const plan=[],counts={};let spent=fixed;
      for(let day=0;day<7;day++){
        const i=day*3,allow=cap-spent-suffix[i+3],dailyBudget=(cap-spent)/(7-day);let best=null,bestScore=Infinity;
        const xs=choices.slice(i,i+3).map((slots,j)=>slots.map(slot=>{const r=recipe(slot),price=cost(slot);return {slot,r,price,hash:Number(r.id.slice(1))||0,
          base:price/100*(s.mode==='saving'?1.15:.5)+slot.store.minutes*(s.mode==='speed'?2:s.mode==='saving'?.03:.12)+(counts[r.id]||0)*(s.mode==='variety'?8:3)
          +Math.max(0,target.protein*.22-r.protein)*1.2+Math.max(0,target.kcal*(j===0?.18:.25)-r.kcal)/25
          +(day>0&&plan[i-3+j].recipe===r.id?8:0)};}));
        for(const a of xs[0])for(const b of xs[1])for(const c of xs[2]){
          const price=a.price+b.price+c.price;if(price>allow)continue;
          const kcal=a.r.kcal+b.r.kcal+c.r.kcal,protein=a.r.protein+b.r.protein+c.r.protein;
          let score=Math.abs(kcal-target.kcal)/target.kcal*260+Math.max(0,target.protein-protein)/target.protein*320;
          score+=Math.max(0,a.r.sodium+b.r.sodium+c.r.sodium-target.sodium)/100;
          score+=Math.abs(a.r.fat+b.r.fat+c.r.fat-target.fat)/target.fat*12+Math.abs(a.r.carbs+b.r.carbs+c.r.carbs-target.carbs)/target.carbs*8;
          score+=Math.max(0,price-dailyBudget)/100*5+price/100/Math.max(1,Math.min(protein,target.protein))*18;
          score+=a.base+b.base+c.base+(b.r.id===c.r.id?22:0)+(b.r.family===c.r.family?4:0);
          score+=((a.hash*7+b.hash*11+c.hash*3+s.seed*13+day*5)%17)/12;
          if(score<bestScore){bestScore=score;best=[a.slot,b.slot,c.slot];}
        }
        if(!best)return [];plan.push(...best.map(p=>({...p,store:{...p.store}})));spent+=best.reduce((n,p)=>n+cost(p),0);best.forEach(p=>counts[p.recipe]=(counts[p.recipe]||0)+1);
      }
      return plan;
    }
    function minimum(s,old=[]){const choices=choicesFor(s,old);if(choices.some(x=>!x.length))return Infinity;const plan=choices.map(xs=>xs.reduce((a,b)=>cost(a)<cost(b)?a:b));return budgetCost(totals(plan,s),s);}
    function alternatives(plan,index,s) {
      const slot=plan[index];
      return active.filter(r=>forStore(r,slot.store.id)&&r.id!==slot.recipe && (slot.meal===0?r.type==='早餐':r.type==='正餐'))
        .map(r=>({ ...slot, recipe:r.id,locked:false }))
        .sort((a,b)=>{
          const count=id=>plan.filter(p=>p.recipe===id).length;
          return count(a.recipe)-count(b.recipe)||Math.abs(recipe(a).kcal-recipe(slot).kcal)-Math.abs(recipe(b).kcal-recipe(slot).kcal);
        });
    }
    // Replacing one meal never regenerates or changes the other twenty meals.
    function replacementOptions(plan,index,s){
      if(plan.length!==21||!plan[index]||plan[index].locked)return [];
      const target=root.MaiNutrition.targets(s);if(!target.valid)return [];
      const current=recipe(plan[index]),before=totals(plan,s),oldDay=daily(plan,plan[index].day);
      return alternatives(plan,index,s).map(slot=>{
        const next=plan.map((p,i)=>({...p,store:{...p.store},...(i===index?{recipe:slot.recipe}: {})}));
        const after=totals(next,s),r=recipe(slot),d=daily(next,slot.day);
        const nextCost=budgetCost(after,s),delta=nextCost-budgetCost(before,s);
        const deficit=(v,t)=>Math.max(0,t-v);
        const score=Math.abs(r.kcal-current.kcal)/50+Math.abs(r.protein-current.protein)/4
          +Math.max(0,deficit(d.protein,target.protein)-deficit(oldDay.protein,target.protein))/3
          +Math.max(0,d.sodium-oldDay.sodium)/300+plan.filter(p=>p.recipe===slot.recipe).length;
        return {slot,plan:next,recipe:r,after,delta,score,allowed:nextCost<=Math.round(s.budget*100),excess:Math.max(0,nextCost-Math.round(s.budget*100))};
      }).sort((a,b)=>Number(b.allowed)-Number(a.allowed)||a.score-b.score||a.delta-b.delta);
    }
    function randomReplacement(plan,index,s,seen=[],rng=Math.random){
      const allowed=replacementOptions(plan,index,s).filter(x=>x.allowed);
      if(!allowed.length)return null;
      // Avoid this slot's recent choices until its affordable pool has been exhausted.
      const fresh=allowed.filter(x=>!seen.includes(x.recipe.id));
      const reset=!fresh.length,pool=(reset?allowed:fresh).slice(0,5);
      const draw=Math.min(0.999999999,Math.max(0,Number(rng())||0));
      return {...pool[Math.floor(draw*pool.length)],reset,poolSize:pool.length};
    }
    return {recipes,active,purchase,valueMetrics,forStore,recipe,generate,totals,alternatives,cost,storesFor,cardModels,prorate,budgetCost,daily,minimum,replacementOptions,randomReplacement};
  }
  root.MaiPlanner={create,defaults:settings};
})(typeof window!=='undefined'?window:globalThis);
