(function(){
'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>(n/100).toFixed(2).replace(/\.00$/,'').replace(/(\.\d)0$/,'$1');
const days=['周一','周二','周三','周四','周五','周六','周日'],meals=['早餐','午餐','晚餐'],times=['08:15','12:10','18:45'];
const storageKey='yirisanmai-demo-v3',planner=MaiPlanner.create(MAI_DATA);
let settings={...MaiPlanner.defaults},plan=[],retained=[],day=0,weekView=false,swapIndex=0,swapPlan=null,toastTimer,traceTimers=[],loaded=false;
try{
 const saved=JSON.parse(localStorage.getItem(storageKey));
 if(saved?.version===3){
  const s={...MaiPlanner.defaults,...saved.settings};
  if(!MaiNutrition.targets(s).valid||!Number.isFinite(s.budget)||s.budget<100||s.budget>1500||!['cash','amortized'].includes(s.budgetBasis)||![5,10,15,20,30].includes(s.maxDetour)||!['balanced','saving','speed','variety'].includes(s.mode)||!Number.isInteger(s.seed))throw Error('Invalid saved profile');
  for(const prefix of ['card','gold'])if(!['owned','none','new'].includes(s[prefix])||!Number.isFinite(s[prefix+'Price'])||s[prefix+'Price']<0||s[prefix+'Price']>300||!Number.isInteger(s[prefix+'Days'])||s[prefix+'Days']<7||s[prefix+'Days']>366||!Number.isInteger(s[prefix+'Uses'])||s[prefix+'Uses']<0||s[prefix+'Uses']>(prefix==='card'?7:14))throw Error('Invalid saved card');
  if(!Array.isArray(saved.plan)||saved.plan.length!==21)throw Error('Invalid saved plan');
  retained=saved.plan.map((p,i)=>{const d=Math.floor(i/3),m=i%3,r=planner.recipes.find(x=>x.id===p.recipe),store=planner.storesFor(d,m,{...s,maxDetour:30}).find(x=>x.id===p.store);if(!r||!store||(!r.legacy&&!planner.forStore(r,store.id))||(r.type==='早餐')!==(m===0))throw Error('Invalid saved meal');return {day:d,meal:m,recipe:r.id,store,locked:!!p.locked};});if(planner.budgetCost(planner.totals(retained,s),s)>Math.round(s.budget*100))throw Error("Saved plan exceeds budget");settings=s;plan=retained;loaded=true;
 }
}catch(_){settings={...MaiPlanner.defaults};retained=[];}
const clone=x=>JSON.parse(JSON.stringify(x));
let draft=clone(settings),history=[],recent={},feedback=null,lastChanged=-1,hasEdited=loaded,swapOptions=[];
const fingerprint=()=>JSON.stringify({settings,plan:plan.map(p=>({recipe:p.recipe,store:p.store.id,locked:p.locked}))});
let savedFingerprint=loaded?fingerprint():null;
const dirty=()=>JSON.stringify(draft)!==JSON.stringify(settings);
const signed=(n,unit='')=>(n>0?'+':n<0?'−':'')+Math.abs(n)+unit;
function checkpoint(){history.push(clone({settings,plan,retained,day,weekView,recent,hasEdited}));if(history.length>20)history.shift();}
function draftErrors(){
 const out=MaiNutrition.targets(draft).errors.slice();
 if(!Number.isFinite(draft.budget)||draft.budget<100||draft.budget>1500)out.unshift('每周预算请填 ¥100–1500');
 if(!Number.isInteger(draft.age))out.push('年龄请填写整数');
 for(const pre of ['card','gold']){
  if(!Number.isFinite(draft[pre+'Price'])||draft[pre+'Price']<0||draft[pre+'Price']>300)out.push((pre==='card'?'早餐卡':'麦金卡')+'卡价请填 0–300 元');
  if(!Number.isInteger(draft[pre+'Days'])||draft[pre+'Days']<7||draft[pre+'Days']>366)out.push('卡有效天数请填 7–366 的整数');
  if(!Number.isInteger(draft[pre+'Uses'])||draft[pre+'Uses']<0||draft[pre+'Uses']>(pre==='card'?7:14))out.push('请检查本周用卡次数');
 }
 return [...new Set(out)];
}
function updateDraftUI(){
 const pending=dirty(),ready=plan.length===21;
 $('#pending-banner').hidden=!pending;
 $('#pending-copy').textContent=`当前餐单仍按 ¥${settings.budget} ${settings.budgetBasis==='cash'?'现金':'折算'}预算及${MaiNutrition.labels[settings.objective]}目标生成。应用后才会更新。`;
 $('#regenerate').textContent=pending?'应用条件，重新生成 →':'按当前条件生成周计划 →';
 $('#undo').disabled=!history.length||pending;$('#reroll-week').disabled=pending||!ready;
 $('#save').disabled=pending||!ready;$('#export').disabled=pending||!ready;
 $('#save-state').textContent=pending?'有条件等待应用':savedFingerprint===fingerprint()?'已保存到本浏览器':hasEdited?'餐单已修改 · 尚未保存':'示例周计划 · 可先试试随机换餐';
 for(const attr of ['objective','mode'])$$('[data-'+attr+']').forEach(b=>{const on=b.dataset[attr]===draft[attr];b.classList.toggle('active',on);b.setAttribute('aria-pressed',on);});
 for(const pre of ['card','gold'])for(const field of ['price','days','uses'])$('#'+pre+'-'+field).disabled=draft[pre]==='none';
 $$('[data-random],[data-swap],[data-lock]').forEach(b=>{const key=b.dataset.random??b.dataset.swap??b.dataset.lock;b.disabled=pending||((b.hasAttribute('data-random')||b.hasAttribute('data-swap'))&&plan[Number(key)]?.locked);});
 $$('[data-prompt],#prompt-form button,#prompt').forEach(b=>b.disabled=pending);
 $('#change-feedback').hidden=!feedback;
 if(feedback)$('#change-feedback').innerHTML=`<div><b>${esc(feedback.title)}</b><p>${esc(feedback.detail)}</p></div><button class="outlined" id="undo-change" ${pending||!history.length?'disabled':''}>撤销这次修改</button>`;
}
function stage(key,value){draft[key]=value;$('#draft-error').hidden=true;updateDraftUI();}
function applySettings(){
 const errors=draftErrors();if(errors.length){$('#draft-error').textContent=errors.join('；');$('#draft-error').hidden=false;$('#draft-error').scrollIntoView({block:'nearest'});return;}
 checkpoint();const before=plan;settings=clone(draft);plan=planner.generate(settings,retained);if(plan.length===21)retained=clone(plan);
 hasEdited=true;recent={};lastChanged=-1;draft=clone(settings);
 const changed=plan.filter((p,i)=>!before[i]||p.recipe!==before[i].recipe||p.store.id!==before[i].store.id).length;
 feedback={title:plan.length===21?'已按新条件生成周计划':'当前条件无法排满一周',detail:plan.length===21?`更新 ${changed} 餐，已锁定餐次保留。预算上限 ¥${settings.budget}。`:'预算没有被提高。可以调整条件，也可以撤销回到上一份餐单。'};
 render();if(innerWidth<=760)$('#plan-title').scrollIntoView({block:'start',behavior:'smooth'});
}
function undo(){if(!history.length||dirty())return;const prior=history.pop();settings=prior.settings;draft=clone(settings);plan=prior.plan;retained=prior.retained;day=prior.day;weekView=prior.weekView;recent=prior.recent;hasEdited=prior.hasEdited;feedback=null;lastChanged=-1;$('#draft-error').hidden=true;render();toast('已撤销，恢复上一步的条件、套餐和锁定状态');}
function replaceOne(i,result,random=false){
 if(!result||dirty()||plan[i].locked)return;
 const before=plan,from=planner.recipe(before[i]),oldDay=planner.daily(before,before[i].day),newDay=planner.daily(result.plan,before[i].day);
 checkpoint();const oldSeen=random&&result.reset?[]:(recent[i]||[]);recent[i]=[...new Set([...oldSeen,from.id,result.recipe.id])];
 plan=clone(result.plan);retained=clone(plan);lastChanged=i;hasEdited=true;
 feedback={title:`${days[plan[i].day]}${meals[plan[i].meal]}：${from.title} → ${result.recipe.title}`,detail:`只换了这一餐 · 整周费用 ${result.delta<0?'减少':result.delta>0?'增加':'不变'}${result.delta?' ¥'+money(Math.abs(result.delta)):''} · 当日能量 ${signed(newDay.kcal-oldDay.kcal,' kcal')} / 蛋白质 ${signed(newDay.protein-oldDay.protein,'g')} / 钠 ${signed(newDay.sodium-oldDay.sodium,'mg')}。营养差距已同步更新。`};
 render();$('#meal-cards [data-'+(random?'random':'swap')+'="'+i+'"]').focus({preventScroll:true});
}
function randomSwap(i){
 if(dirty()||plan[i]?.locked)return;
 const seen=[...(recent[i]||[]),plan[i].recipe],result=planner.randomReplacement(plan,i,settings,seen);
 if(!result){toast('保持其他餐次不变时，没有预算内的替代套餐。可以自己选查看差额，或整周重排。');return;}
 replaceOne(i,result,true);
}
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);}
function syncControls(){
 for(const k of ['budget','height','weight','age','sex','activity'])$('#'+k).value=draft[k];
 $('#budget-basis').value=draft.budgetBasis;$('#detour').value=draft.maxDetour;
 for(const k of ['training','special','coupons'])$('#'+k).checked=draft[k];$('#home-wednesday').checked=draft.homeWednesday;
 for(const prefix of ['card','gold']){$('#'+prefix).value=draft[prefix];for(const f of ['price','days','uses']){const el=$('#'+prefix+'-'+f);el.value=draft[prefix+f[0].toUpperCase()+f.slice(1)];el.disabled=draft[prefix]==='none';}}
 for(const attr of ['objective','mode'])$$('[data-'+attr+']').forEach(b=>{const active=b.dataset[attr]===draft[attr];b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});
}
function assessment(p=plan){
 const target=MaiNutrition.targets(settings);if(!target.valid)return target.errors;
 if(p.length!==21)return ['当前预算下无法排满 21 份完整套餐'];
 const out=[];let energy=0,protein=0,salt=0;
 for(let d=0;d<7;d++){const v=planner.daily(p,d);if(v.kcal<target.kcalMin||v.kcal>target.kcalMax)energy++;if(v.protein<target.protein)protein++;if(v.sodium>=target.sodium)salt++;}
 if(energy)out.push(energy+' 天热量未进入参考区间');if(protein)out.push(protein+' 天蛋白质未到参考量');if(salt)out.push(salt+' 天钠高于成人参考限量');
 if(p.some(x=>x.store.minutes>settings.maxDetour))out.push('有锁定套餐超过距离换算时间上限');
 if(p.some(x=>x.day===2&&x.meal===1&&x.store.id==='office'&&settings.homeWednesday))out.push('周三锁定门店与在家办公冲突');
 return out;
}
const fallbackName=name=>/奶|豆浆|可乐|美式/.test(name)?'🥤':/粥/.test(name)?'🥣':/薯/.test(name)?'🍟':/玉米/.test(name)?'🌽':/苹果/.test(name)?'🍎':'🍔';
function foodImage(name,cls=''){const f=MAI_DATA.foods[name];return f?.image?`<img class="${cls}" src="${esc(f.image)}" alt="${esc(name)}" loading="lazy" referrerpolicy="no-referrer">`:`<span class="food-icon ${cls}" role="img" aria-label="${esc(name)}">${fallbackName(name)}</span>`;}
function tray(r){return `<div class="set-tray"><span class="tray-label">${r.items.length} 件 · ${r.kind||'自选组合'}</span>${r.items.map((name,i)=>foodImage(name,['tray-main','tray-side','tray-drink','tray-extra'][i]||'tray-extra')).join('')}</div>`;}
function valueText(r,price=r.price){const v=planner.valueMetrics(r,price);return `${v.perYuan===null?'—':v.perYuan.toFixed(2)} g / 元 · ${v.per100Kcal===null?'—':v.per100Kcal.toFixed(2)} g / 100 kcal`;}
function renderValue(){
 const type=$('#value-type').value,sort=$('#value-sort').value;
 const storeId=$('#value-store').value,eligible=planner.storesFor(0,1,settings);
 let rows=planner.active.map(r=>{if(storeId!=='eligible')return planner.forStore(r,storeId);return eligible.map(st=>planner.forStore(r,st.id)).filter(Boolean).sort((a,b)=>a.price-b.price)[0];}).filter(r=>r&&(type==='all'||r.type===type));
 if(sort==='unit')rows=rows.filter(r=>r.route.length===1);
 rows.sort((a,b)=>sort==='price'?a.price-b.price:sort==='density'?b.proteinPer100Kcal-a.proteinPer100Kcal:b.proteinPerYuan-a.proteinPerYuan);
 $('#value-table').innerHTML=`<table><thead><tr><th>买法 / 餐品</th><th>价格</th><th>热量</th><th>蛋白质</th><th>蛋白 / 元</th><th>蛋白 / 100 kcal</th></tr></thead><tbody>${rows.slice(0,12).map(r=>`<tr><td><b>${esc(r.title)}</b><small>${r.kind} · ${MAI_DATA.nearbyStores.find(st=>st.id===r.storeId)?.name||r.source}</small></td><td>¥${money(r.price)}</td><td>${r.kcal} kcal</td><td>${r.protein} g</td><td><b>${r.proteinPerYuan.toFixed(2)} g</b></td><td>${r.proteinPer100Kcal.toFixed(2)} g</td></tr>`).join('')}</tbody></table><p class="value-source">展示排序前 ${Math.min(rows.length,12)} 项 / 当前 ${rows.length} 个候选。价格不含个人新卡支出；周总账另计卡费。</p>`;
}
$('#value-store').innerHTML='<option value="eligible">当前距离范围内最低价</option>'+MAI_DATA.nearbyStores.filter(st=>st.priced).map(st=>`<option value="${st.id}">${st.name}</option>`).join('');
$('#value-sort').onchange=renderValue;$('#value-type').onchange=renderValue;$('#value-store').onchange=renderValue;

function fallbackImages(){$$('img').forEach(img=>{const replace=()=>{const el=document.createElement('span');el.className='food-icon '+img.className;el.textContent=fallbackName(img.alt);el.setAttribute('role','img');el.setAttribute('aria-label',img.alt);img.replaceWith(el);};img.onerror=replace;if(img.complete&&img.naturalWidth===0)replace();});}
function metric(label,value,foot,cls=''){return `<div class="metric ${cls}"><span class="metric-label">${label}</span><strong class="metric-value">${value}</strong><span class="metric-foot">${foot}</span></div>`;}
function method(target){return `<p><b>一般成人的规划参考，需结合体重趋势调整。</b>示例资料保存在本页；只有点“保存”才存入当前浏览器。</p><p><a href="https://pubmed.ncbi.nlm.nih.gov/2305711/" target="_blank" rel="noreferrer">Mifflin–St Jeor 公式</a>估算静息能量：10×体重 + 6.25×身高 − 5×年龄 + 性别常数（男 +5 / 女 −161）。再乘活动系数估算维持消耗。</p><p>本演示的产品假设：活动系数 1.2 / 1.375 / 1.55 / 1.725；减脂取维持量 −15%，增肌 +8%，维持不变。参考区间为能量目标 ±10%，不是精确测量。</p><p>蛋白质试排系数：一般维持 1.0g/kg、一般减脂 1.2g/kg；有规律力量训练或选增肌时 1.6g/kg。后者参考 <a href="https://link.springer.com/article/10.1186/s12970-017-0177-8" target="_blank" rel="noreferrer">ISSN 对运动人群的 1.4–2.0g/kg 讨论</a>；其余为演示规划假设，不是该论文给出的通用处方。脂肪暂分配目标能量的 30%，碳水按剩余能量折算。</p><p>钠按 <a href="https://www.who.int/news-room/fact-sheets/detail/sodium-reduction" target="_blank" rel="noreferrer">WHO 成人每日少于 2000mg</a>标记。食品营养来自官方 MCP 快照，按所选份量相加；纤维、饱和脂肪与过敏原信息缺失，不能视为 0，也不能判定三餐营养全面。</p><p>本页仅演示 18–65 岁一般成人；孕哺期、特殊营养管理或低体重减脂不自动规划。范围依据与适用限制可参阅 <a href="https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner" target="_blank" rel="noreferrer">NIDDK 成人体重规划说明</a>，18–65 岁是本演示自行收窄的支持范围。</p>`;}
function render(){
 renderValue();syncControls();const target=MaiNutrition.targets(settings),ready=plan.length===21,t=planner.totals(plan,settings),issues=assessment();
 $('#plan-title').textContent=ready?'下一周，三餐算清楚':'这周的套餐，等待调整';
 const used=planner.budgetCost(t,settings),basis=settings.budgetBasis==='cash'?'本周现金':'周折算';
 $('#target-summary').innerHTML=target.valid?`<div class="target-heading"><span class="target-icon">${settings.objective==='loss'?'↘':settings.objective==='gain'?'↗':'↔'}</span><div><b>${target.label}周计划 <span>按当前填写资料估算</span></b><p>${settings.height} cm · ${settings.weight} kg · ${settings.age} 岁，维持消耗约 ${target.tdee} kcal / 天</p></div></div><div class="target-values"><div><small>每日能量参考</small><strong>${target.kcal}<em> kcal</em></strong></div><div><small>蛋白质参考</small><strong>${target.protein}<em> g / 天</em></strong></div><div><small>整周预算上限</small><strong>¥${settings.budget}<em> ${basis}</em></strong></div></div>${target.trainingNote?'<p class="target-note">'+target.trainingNote+'</p>':''}`:`<b>请先调整身体资料或目标</b><p>${esc(target.errors.join('；'))}</p>`;
 $('#method-content').innerHTML=method(target);
 $('#metrics').innerHTML=ready?[
 metric(basis+'预算使用',`<small>¥</small>${money(used)}`,`上限 ¥${settings.budget} · 剩余 ¥${money(settings.budget*100-used)}`,'budget-metric'),
 metric('平均每天热量',Math.round(t.kcal/7)+'<small> kcal</small>',`参考 ${target.kcalMin}–${target.kcalMax} kcal`),
 metric('平均每天蛋白质',(t.protein/7).toFixed(0)+'<small> g</small>',`参考 ${target.protein} g / 天`),
 metric('整套搭配',t.unique+'<small> 种 / 21 餐</small>','单点、1+1、套餐、加购一起比')].join(''):metric('预算上限','<small>¥</small>'+settings.budget,'未生成超预算餐单');
 $('#plan-status').classList.toggle('warning',!!issues.length);
 $('#plan-status').textContent=ready?`✓ ${basis}在上限内。${issues.length?'△ '+issues.join('；')+'。这是一份待调整草案，不能据此认定适合长期全天食用。':'能量和蛋白质参考已满足；其他营养仍需补齐核验。'}`:issues.join('；');
 $('#empty-state').hidden=ready;
 if(!ready){const min=planner.minimum(settings,retained);$('#empty-state').innerHTML=target.valid?`<span class="empty-icon">⌁</span><h3>这个预算，暂时排不满一周。</h3><p>在当前套餐候选、卡券及锁定条件下，21 餐最低试算需 <b>¥${money(min)}</b>。不会自动加预算，也不会省掉配餐或饮品凑数。</p><p>最低价只说明能排满餐次，不代表营养目标达标。可以提高预算，或在正式 Skill 中改为只规划部分餐次。</p>${min<=150000?`<button class="outlined" data-raise="${Math.ceil(min/1000)*10}">我同意将预算改为 ¥${Math.ceil(min/1000)*10}</button>`:''}${retained.some(p=>p.locked)?'<button class="outlined" id="unlock-all">解锁全部套餐再试</button>':''}`:`<h3>暂不生成自动套餐</h3><p>${esc(target.errors.join('；'))}</p>`;}
 for(const sel of ['.set-note','#day-tabs','.day-heading','#day-summary','.benefit-comparison','.assistant-bar','.prompt-chips','#prompt-form','#prompt-response'])$(sel).hidden=!ready;
 $('#meal-cards').hidden=!ready||weekView;$('#week-grid').hidden=!ready||!weekView;
 $('#save').disabled=!ready;$('#export').disabled=!ready;
 if(!ready){$('#meal-cards').innerHTML='';$('#week-grid').innerHTML='';updateDraftUI();return;}
 $('#day-tabs').innerHTML=days.map((d,i)=>`<button class="day-tab ${i===day?'active':''}" role="tab" id="day-${i}" aria-selected="${i===day}" aria-controls="meal-cards" data-day="${i}"><span class="weekday">${d}</span><span class="date">${19+i}</span><span class="daily-price">¥${money(t.ledger.slice(i*3,i*3+3).reduce((n,x)=>n+(settings.budgetBasis==='cash'?x.cashMeal:x.net),0))}</span></button>`).join('');
 $('#day-title').innerHTML=weekView?'七天套餐，一眼看完':`${days[day]} · ${day===2&&settings.homeWednesday?'在家办公':day<5?'工作日三餐':'周末三餐'}<span>10.${19+day}</span>`;
 $('#meal-cards').setAttribute('aria-labelledby','day-'+day);
 $('#meal-cards').innerHTML=plan.slice(day*3,day*3+3).map((slot,j)=>{
  const i=day*3+j,r=planner.recipe(slot),bill=t.ledger[i];
  return `<article data-meal-index="${i}" class="meal-card ${i===lastChanged?'just-changed':''} ${slot.locked?'locked':''}"><div class="meal-card-top"><span class="meal-label">${['☀','◒','☾'][j]} ${meals[j]}<time>${times[j]}</time></span><button class="lock-button" data-lock="${i}" aria-pressed="${slot.locked}" aria-label="${slot.locked?'解锁':'锁定'}${days[day]}${meals[j]}">${slot.locked?'● 已锁定':'○ 锁定'}</button></div>${tray(r)}<div class="meal-info"><span class="set-type">${r.kind} · ${r.items.length} 件</span><h4>${r.title}</h4><ul class="set-components">${r.items.map((name,k)=>`<li><span>${k===0?'主食':/奶|豆浆|可乐|美式/.test(name)?'饮品':/堡|麦满分/.test(name)?'加餐':'配餐'}</span>${esc(name)}<small>×1</small></li>`).join('')}</ul><div class="meal-macros"><b>${r.kcal}<small> kcal / 整套</small></b><span>蛋白质 <b>${r.protein}g</b></span><span>碳水 ${r.carbs}g · 脂肪 ${r.fat}g</span><span>钠 ${r.sodium}mg</span></div><div class="meal-price"><strong><small>整套餐费 ¥</small>${money(bill.cashMeal)}</strong><span class="discount-tag">${r.source}</span></div><div class="protein-value"><b>${valueText(r,bill.cashMeal)}</b><span>约 ¥${(planner.valueMetrics(r,bill.cashMeal).cost20g||0).toFixed(2)} / 20g 蛋白质（比较指标）</span></div><p class="meal-cost-breakdown">餐次含卡分摊 ¥${money(bill.net)} · 全部食物已计入</p><details class="buy-route"><summary>为什么这样买？查看购买明细</summary>${r.route?r.route.map(o=>`<p>${esc(o.kind)} · ${esc(o.title)} <b>¥${money(o.price)}</b></p>`).join(''):'<p>旧版演示价格，不属于本次核价候选。</p>'}<p>${r.legacy?'此为保留的旧版草案，可重新生成使用新价格。':'单点与组合按相同食物数量比较购买成本；不是所有套餐都比单点便宜。门店快照，未来需复核。'}</p><div class="meal-store-prices">${MAI_DATA.nearbyStores.filter(st=>st.priced).map(st=>{const local=planner.forStore(r,st.id);return `<p>${st.name} · ${st.distance}m <b>${local?'¥'+money(local.price):'未取得完整报价'}</b>${st.id===slot.store.id?' · 本餐选择':''}${st.minutes>settings.maxDetour?' · 超出距离范围':''}</p>`;}).join('')}</div></details><p class="meal-route">⌖ ${slot.store.name} · 约 ${slot.store.distance}m / 参考 ${slot.store.minutes} 分钟</p><div class="meal-actions"><button class="random-button" data-random="${i}" ${slot.locked?'disabled':''} aria-label="随机换${days[day]}${meals[j]}">⚄ ${slot.locked?'已锁定':'随机换一套'}</button><button class="choose-button" data-swap="${i}" ${slot.locked?'disabled':''} aria-label="自己选${days[day]}${meals[j]}">自己选 ›</button></div><p class="swap-hint">${slot.locked?'解锁后可换餐':'预算内随机，优先营养接近 · 可撤销'}</p></div></article>`;
 }).join('');
 $('#week-grid').innerHTML=`<table class="week-table"><thead><tr><th>日期</th>${meals.map(x=>`<th>${x}</th>`).join('')}<th>每日营养</th></tr></thead><tbody>${days.map((d,i)=>{const v=planner.daily(plan,i);return `<tr><td>${d}<br>10.${19+i}</td>${plan.slice(i*3,i*3+3).map((p,j)=>{const r=planner.recipe(p);return `<td><button data-jump="${i}"><b>${r.title}${p.locked?' ●':''}</b></button><p>${r.items.join(' + ')}</p><small>${r.kcal} kcal · P ${r.protein}g<br>整套 ¥${money(t.ledger[i*3+j].cashMeal)}</small></td>`;}).join('')}<td>${v.kcal} kcal<br>蛋白 ${v.protein}g<br>碳水 ${v.carbs}g<br>脂肪 ${v.fat}g<br>钠 ${v.sodium}mg</td></tr>`;}).join('')}</tbody></table>`;
 const d=planner.daily(plan,day);
 const rings=[{label:'热量',key:'kcal',target:target.kcal,unit:'kcal',color:'#d7193f',radius:76},{label:'蛋白质',key:'protein',target:target.protein,unit:'g',color:'#eaa400',radius:58},{label:'脂肪',key:'fat',target:target.fat,unit:'g',color:'#292929',radius:40}];
 const dayCash=t.ledger.slice(day*3,day*3+3).reduce((n,x)=>n+x.cashMeal,0);
 const ringLabel=r=>`${r.label} ${d[r.key]} / ${r.target} ${r.unit}，${Math.round(d[r.key]/r.target*100)}%`;
 $('#day-summary').innerHTML=`<div class="daily-activity"><svg viewBox="0 0 180 180" class="activity-rings" role="img" aria-label="${days[day]}营养进度：${rings.map(ringLabel).join('；')}"><title>${days[day]}营养参考进度</title>${rings.map(r=>{const circle=2*Math.PI*r.radius,p=Math.min(1,Math.max(0,d[r.key]/r.target));return `<circle class="ring-track" cx="90" cy="90" r="${r.radius}" fill="none" stroke="${r.color}" stroke-opacity=".12" stroke-width="12"/><circle class="ring-progress" cx="90" cy="90" r="${r.radius}" fill="none" stroke="${r.color}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${p*circle} ${circle}" transform="rotate(-90 90 90)"/>`;}).join('')}<text x="90" y="88" text-anchor="middle" class="ring-center-day">${days[day]}</text><text x="90" y="105" text-anchor="middle" class="ring-center-label">营养进度</text></svg><div class="ring-legend"><h4>${days[day]} · 今日营养</h4>${rings.map(r=>{const diff=d[r.key]-r.target;return `<div class="ring-stat"><i style="background:${r.color}"></i><div><span>${r.label}</span><b>${d[r.key]} <small>/ ${r.target} ${r.unit}</small></b></div><em>${diff>0?'高于参考 '+diff:r.key==='protein'&&diff<0?'还差 '+(-diff):diff===0?'达到参考':'剩余参考 '+(-diff)}${diff!==0?' '+r.unit:''}</em></div>`;}).join('')}</div></div><div class="daily-facts"><span>碳水 <b>${d.carbs}g</b></span><span class="${d.sodium>=target.sodium?'salt-warning':''}">钠 <b>${d.sodium}mg</b>${d.sodium>=target.sodium?' · 偏高':''}</span><span>当天餐费 <b>¥${money(dayCash)}</b></span></div><details class="daily-detail"><summary>查看营养差距与参考说明</summary><p>能量参考区间 ${target.kcalMin}–${target.kcalMax} kcal；蛋白质参考 ${target.protein}g；碳水参考 ${target.carbs}g；脂肪参考 ${target.fat}g；钠参考少于 ${target.sodium}mg。</p><p>${d.kcal<target.kcalMin?'当天能量偏低。':d.kcal>target.kcalMax?'当天能量偏高。':''}${d.protein<target.protein?'蛋白质还差 '+(target.protein-d.protein)+'g。':''}${d.sodium>=target.sodium?'钠偏高，需要调整食物或部分餐次。':''}满环表示达到或超过参考值，不表示营养全面。脂肪和热量不是越多越好。膳食纤维、饱和脂肪和过敏原资料缺失。</p><p>当天餐费不重复计入整周新卡全额；卡费和分摊看周总账。</p></details>`;
 $('#day-summary').hidden=false;
 $('#daily-view').classList.toggle('active',!weekView);$('#week-view').classList.toggle('active',weekView);$('#daily-view').setAttribute('aria-pressed',!weekView);$('#week-view').setAttribute('aria-pressed',weekView);
 $('#card-summary').innerHTML=`<div class="ledger-overview"><b>整周现金 ¥${money(t.cashTotal)}</b><b>整周折算 ¥${money(t.total)}</b><span>新开卡付款 ¥${money(t.purchaseFees)} · 本周卡费分摊 ¥${money(t.fee)}</span></div><p class="card-cost-note">上方每日标签展示餐次费用；新卡全额付款或未使用卡的分摊额只计入整周总账，不重复加到每天。</p>${t.cardRows.map(c=>`<div class="card-cost-row"><div><b>${c.name}</b><small>¥${money(c.price)} / ${c.days} 天</small></div><span>本周分摊<strong>¥${money(c.weeklyFee)}</strong></span><span>用卡<strong>${c.used} 次</strong></span><span>每次分摊<strong>${c.perUse===null?'—':'¥'+money(c.perUse)}</strong></span></div><p class="card-cost-note">优惠 ¥${money(c.grossSavings)} − 分摊 ¥${money(c.weeklyFee)} = ${c.netSaving>=0?'净省':'增加成本'} ¥${money(Math.abs(c.netSaving))}。${c.used===0?'未使用的卡费仍保留。':''}${c.state==='new'?'本周另付全额开卡费。':'本周不重复付开卡费。'}</p>`).join('')}`;
 const variants=[['不持付费卡','none','none'],['仅早餐卡',settings.card==='none'?'new':settings.card,'none'],['仅麦金卡','none',settings.gold==='none'?'new':settings.gold],['两张都持有',settings.card==='none'?'new':settings.card,settings.gold==='none'?'new':settings.gold]];
 $('#card-comparison').innerHTML=`<table><thead><tr><th>同一餐单比较</th><th>周折算</th><th>本周现金</th></tr></thead><tbody>${variants.map(([label,card,gold])=>{const x=planner.totals(plan,{...settings,card,gold});return `<tr><td>${label}</td><td>¥${money(x.total)}</td><td>¥${money(x.cashTotal)}</td></tr>`;}).join('')}</tbody></table><p>“不持卡”假设从未购卡，不表示已购卡能退款。使用次数设为 0 时仍保留已购卡分摊。</p>`;
 fallbackImages();updateDraftUI();
}
for(const k of ['budget','height','weight','age'])$('#'+k).oninput=e=>stage(k,e.target.value===''?null:Number(e.target.value));
for(const [id,key,numeric] of [['sex','sex',false],['activity','activity',true],['budget-basis','budgetBasis',false],['detour','maxDetour',true]])$('#'+id).onchange=e=>stage(key,numeric?Number(e.target.value):e.target.value);
for(const [id,key] of [['training','training'],['special','special'],['coupons','coupons'],['home-wednesday','homeWednesday']])$('#'+id).onchange=e=>stage(key,e.target.checked);
for(const attr of ['objective','mode'])$$('[data-'+attr+']').forEach(b=>b.onclick=()=>stage(attr,b.dataset[attr]));
for(const prefix of ['card','gold']){
 $('#'+prefix).onchange=e=>stage(prefix,e.target.value);
 for(const f of ['price','days','uses'])$('#'+prefix+'-'+f).oninput=e=>stage(prefix+f[0].toUpperCase()+f.slice(1),e.target.value===''?null:Number(e.target.value));
}
$('#preferences').onkeydown=e=>{if(e.key==='Enter'&&e.target.tagName==='INPUT'&&e.target.type==='number'){e.preventDefault();applySettings();}};
$('#regenerate').onclick=applySettings;$('#apply-settings').onclick=applySettings;
$('#discard-settings').onclick=()=>{draft=clone(settings);$('#draft-error').hidden=true;syncControls();updateDraftUI();};
$('#undo').onclick=undo;$('#change-feedback').onclick=e=>{if(e.target.closest('#undo-change'))undo();};
$('#edit-conditions').onclick=()=>{$('#preferences').scrollIntoView({block:'start',behavior:'smooth'});$('#budget').focus({preventScroll:true});};
$('#reroll-week').onclick=()=>{
 if(dirty()||plan.length!==21)return;if(plan.every(p=>p.locked)){toast('21 餐都已锁定，先解锁想更换的餐次');return;}
 const old=plan;let next=null,seed=settings.seed;
 for(let n=0;n<12;n++){seed++;const candidate=planner.generate({...settings,seed},plan);if(candidate.length===21&&candidate.some((p,i)=>p.recipe!==plan[i].recipe||p.store.id!==plan[i].store.id)){next=candidate;break;}}
 if(!next){toast('当前约束下暂未找到不同的整周方案，可试试单餐随机换');return;}
 checkpoint();settings.seed=seed;draft=clone(settings);plan=next;retained=clone(plan);recent={};hasEdited=true;lastChanged=-1;
 feedback={title:'整周重新安排好了',detail:`共更换 ${plan.filter((p,i)=>p.recipe!==old[i].recipe||p.store.id!==old[i].store.id).length} 餐；预算上限和已锁定套餐保留。可以撤销回原方案。`};render();
};
$('#empty-state').onclick=e=>{const b=e.target.closest('[data-raise]');if(b){stage('budget',Number(b.dataset.raise));syncControls();applySettings();}if(e.target.id==='unlock-all'&&!dirty()){checkpoint();retained=retained.map(p=>({...p,locked:false}));plan=planner.generate(settings,retained);if(plan.length===21)retained=clone(plan);hasEdited=true;feedback={title:'已解锁套餐并重新尝试',detail:'预算上限保持不变。'};render();}};
$('#day-tabs').onclick=e=>{const b=e.target.closest('[data-day]');if(b){day=Number(b.dataset.day);weekView=false;render();}};
$('#day-tabs').onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();day=e.key==='Home'?0:e.key==='End'?6:(day+(e.key==='ArrowRight'?1:6))%7;weekView=false;render();$('#day-'+day).focus();};
$('#daily-view').onclick=()=>{weekView=false;render();};$('#week-view').onclick=()=>{weekView=true;render();};$('#week-grid').onclick=e=>{const b=e.target.closest('[data-jump]');if(b){day=Number(b.dataset.jump);weekView=false;render();}};
$('#meal-cards').onclick=e=>{
 if(dirty())return;const lock=e.target.closest('[data-lock]'),swap=e.target.closest('[data-swap]'),random=e.target.closest('[data-random]');
 if(lock){const i=Number(lock.dataset.lock);checkpoint();plan[i].locked=!plan[i].locked;retained=clone(plan);hasEdited=true;feedback={title:plan[i].locked?'已锁定这套餐':'已解锁这套餐',detail:`${days[plan[i].day]}${meals[plan[i].meal]} · ${planner.recipe(plan[i]).title}。${plan[i].locked?'整周重排时也会保留。':'可以随机换或自己选。'}`};render();$('#meal-cards [data-lock="'+i+'"]').focus({preventScroll:true});}
 if(random)randomSwap(Number(random.dataset.random));if(swap)openSwap(Number(swap.dataset.swap));
};
function renderSwapOptions(){
 const sort=$('#swap-sort').value,opts=swapOptions.slice().sort((a,b)=>Number(b.allowed)-Number(a.allowed)||(sort==='price'?a.delta-b.delta:sort==='protein'?b.recipe.protein-a.recipe.protein:sort==='value'?b.recipe.proteinPerYuan-a.recipe.proteinPerYuan:sort==='density'?b.recipe.proteinPer100Kcal-a.recipe.proteinPer100Kcal:a.score-b.score));
 $('#swap-count').textContent=`${opts.filter(x=>x.allowed).length} 套可在预算内直接替换`;
 $('#swap-options').innerHTML=opts.map(o=>{const r=o.recipe;return `<button class="swap-option" data-alternative="${r.id}" aria-pressed="false" ${o.allowed?'':'disabled'}>${foodImage(r.main)}<div><b>${r.title}</b><p>${r.items.join(' + ')}</p><p>${r.kcal} kcal · 蛋白 ${r.protein}g · 碳水 ${r.carbs}g · 脂肪 ${r.fat}g</p><p>¥${money(r.price)} · ${valueText(r)}</p></div><strong>${o.allowed?(o.delta===0?'费用不变':(o.delta>0?'+':'−')+'¥'+money(Math.abs(o.delta))):'超预算 ¥'+money(o.excess)}<small>${o.allowed?'替换后整周费用变化':'保持其他餐次不变'}</small></strong></button>`;}).join('');
 swapPlan=null;$('#apply-swap').disabled=true;$('#swap-impact').textContent='选一套查看差额。不会重排其他餐次，也不会自动锁定。';fallbackImages();
}
function openSwap(i){if(plan[i].locked||dirty())return;swapIndex=i;swapOptions=planner.replacementOptions(plan,i,settings);$('#swap-sort').value='similar';$('#swap-title').textContent=days[plan[i].day]+meals[plan[i].meal]+'，自己选一套';renderSwapOptions();$('#swap-dialog').showModal();}
$('#swap-sort').onchange=renderSwapOptions;
$('#swap-options').onclick=e=>{const b=e.target.closest('[data-alternative]');if(!b||b.disabled)return;const o=swapOptions.find(x=>x.recipe.id===b.dataset.alternative);if(!o?.allowed)return;swapPlan=o;
 $$('.swap-option').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',x===b);});$('#apply-swap').disabled=false;
 const before=planner.recipe(plan[swapIndex]),r=o.recipe;
 $('#swap-impact').innerHTML=`本周${settings.budgetBasis==='cash'?'现金':'折算'} <b>¥${money(planner.budgetCost(o.after,settings))}</b> / 上限 ¥${settings.budget}。<br>本餐 ¥${money(r.price)} · ${valueText(r)}。<br>本餐能量 ${signed(r.kcal-before.kcal,' kcal')}，蛋白 ${signed(r.protein-before.protein,'g')}，钠 ${signed(r.sodium-before.sodium,'mg')}。<br>只替换这一餐，其余 20 餐保持不变。${assessment(o.plan).length?'<br>营养待调整：'+esc(assessment(o.plan).join('；')):''}`;
};
$('#apply-swap').onclick=()=>{if(!swapPlan?.allowed)return;$('#swap-dialog').close();replaceOne(swapIndex,swapPlan);};
function prompt(text){
 if(dirty())return;let response='';
 if(/附近|门店|周三.*在家/.test(text)){$('#proof').scrollIntoView({behavior:'smooth'});response='已展示天津时代奥城附近门店。同一餐逐店核价；公司地点还未设置，当前不能计算真实通勤路线。';}
 else if(/周五.*双吉/.test(text)){
  if(plan.length!==21)return;const o=planner.replacementOptions(plan,13,settings).find(x=>x.recipe.title==='双吉＋小玉米 1+1'&&x.allowed);
  if(o){day=4;weekView=false;replaceOne(13,o);response='周五午餐换为双吉＋小玉米 1+1，其余 20 餐不变。喜欢的话可以锁定。';}
  else response=planner.recipe(plan[13]).title==='双吉＋小玉米 1+1'?'周五午餐已经是双吉＋小玉米 1+1。':plan[13].locked?'周五午餐已锁定，请先解锁。':'当前门店没有可用报价，或保留其他餐次时会超预算；可整周重排再比较附近门店。';
 }else if(/口味|吃腻/.test(text)){draft={...settings,mode:'variety',seed:settings.seed+1};applySettings();response='整周提高口味变化的优先级，保留预算上限和已锁定套餐。';}
 else response='演示支持上方三个指令；也可以直接随机换一餐。';
 $('#prompt-response').textContent=response;$('#prompt').value='';
}
$$('[data-prompt]').forEach(b=>b.onclick=()=>prompt(b.dataset.prompt));$('#prompt-form').onsubmit=e=>{e.preventDefault();const t=$('#prompt').value.trim();if(t)prompt(t);};
function info(title,html){$('#info-title').textContent=title;$('#info-content').innerHTML=html;$('#info-dialog').showModal();}
$('#about').onclick=()=>info('一日三麦 Skill · 演示范围','<p>这是安装在 AI 助手里的 Skill 的输出演示。核心流程是：每周预算 → 身体资料与目标 → 七天完整套餐 → 营养差距 → 卡券与通勤。</p><p><b>真实来源：</b>官方 MCP 160 条营养记录、所选餐品营养、商品图片、官方套餐入口、三店麦香鸡报价快照。</p><p><b>本地已实现：</b>身体参数估算、整套营养汇总、预算硬上限、换整套、锁定、卡费分摊、保存与导出。</p><p><b>仍为演示：</b>价格为天津时代奥城周边三店快照，复合餐按核价单元相加；卡权益、未采样门店和未来价格未核验。不保证有限候选的整周全局最优。</p><p>真实账户卡券、自动任务、下单与付款尚未接通。本页不使用凭证，不会交易。预算内也可能存在营养缺口，须看每日差距。</p>');
$('#save').onclick=()=>{if(plan.length!==21||dirty())return;try{localStorage.setItem(storageKey,JSON.stringify({version:3,settings,plan:plan.map(p=>({recipe:p.recipe,store:p.store.id,locked:p.locked}))}));savedFingerprint=fingerprint();hasEdited=true;updateDraftUI();toast('已保存当前 21 套餐和资料；下次打开原样恢复');}catch(_){info('暂时无法保存','<p>可用导出功能保存餐单。</p>');}};
$('#export').onclick=()=>{if(plan.length!==21||dirty())return;const t=planner.totals(plan,settings),target=MaiNutrition.targets(settings);let content=`# 一日三麦 · 2026.10.19—10.25 套餐草案\n\n预算上限 ¥${settings.budget}（${settings.budgetBasis==='cash'?'本周现金':'周折算'}）。现金 ¥${money(t.cashTotal)}；周折算 ¥${money(t.total)}；新卡付款 ¥${money(t.purchaseFees)}；周卡费分摊 ¥${money(t.fee)}。\n\n档案：${settings.height}cm / ${settings.weight}kg / ${settings.age}岁；${target.label}。每日参考 ${target.kcal} kcal、蛋白 ${target.protein}g、碳水 ${target.carbs}g、脂肪 ${target.fat}g、钠 <2000mg。\n\n待调整：${assessment().join('；')||'完整营养仍需核验'}。\n\n`;days.forEach((d,i)=>{content+=`## ${d}\n\n`;plan.slice(i*3,i*3+3).forEach((p,j)=>{const r=planner.recipe(p),b=t.ledger[i*3+j];content+=`- ${meals[j]}：${r.title}（${r.kind}）。${r.items.join(' + ')}。${r.kcal} kcal / 蛋白 ${r.protein}g / 碳水 ${r.carbs}g / 脂肪 ${r.fat}g / 钠 ${r.sodium}mg。整套餐费 ¥${money(b.cashMeal)}，卡分摊 ¥${money(b.cardShare)}，折算 ¥${money(b.net)}；${p.store.name}，接口距离 ${p.store.distance}m，按80米/分钟换算约 ${p.store.minutes} 分钟（非导航）${p.locked?'；锁定':''}。\n`;});const v=planner.daily(plan,i);content+=`\n全天：${v.kcal} kcal，蛋白 ${v.protein}g，碳水 ${v.carbs}g，脂肪 ${v.fat}g，钠 ${v.sodium}mg。\n\n`;});t.cardRows.forEach(c=>content+=`${c.name}：¥${money(c.price)} / ${c.days} 天，本周分摊 ¥${money(c.weeklyFee)}，实际用卡 ${c.used} 次，每次分摊 ${c.perUse===null?'未使用':'¥'+money(c.perUse)}。\n\n`);content+='营养来自官方 MCP 2026-10-18 快照；购买单元为天津时代奥城三店核价快照；复合搭配按单元相加，未来价格与权益、路线待核验。估算方法见页面说明。纤维、饱和脂肪、过敏原缺失，不代表 0。不构成营养处方。没有创建订单或任务。\n\n参考：[Mifflin 公式](https://pubmed.ncbi.nlm.nih.gov/2305711/) · [ISSN 运动人群蛋白质](https://link.springer.com/article/10.1186/s12970-017-0177-8) · [WHO 钠](https://www.who.int/news-room/fact-sheets/detail/sodium-reduction)\n';const url=URL.createObjectURL(new Blob([content],{type:'text/markdown;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='一日三麦-周套餐草案.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('整周套餐已导出，包含营养和费用明细');};
$('#reset').onclick=()=>{try{localStorage.removeItem(storageKey);localStorage.removeItem('yirisanmai-demo-v2');}catch(_){}settings={...MaiPlanner.defaults};draft=clone(settings);retained=[];day=0;weekView=false;history=[];recent={};feedback=null;lastChanged=-1;savedFingerprint=null;hasEdited=false;plan=planner.generate(settings);retained=clone(plan);$('#draft-error').hidden=true;render();toast('已恢复示例资料，删除本页保存的数据');};
const compareOffers=['s-正餐-1406','o-double-corn','o-breakfast-soy'];
$('#store-comparison').innerHTML=`<div class="value-table-wrap"><table><thead><tr><th>附近门店</th><th>单点板烧</th><th>双吉＋玉米 1+1</th><th>双蛋堡＋豆浆</th></tr></thead><tbody>${MAI_DATA.nearbyStores.filter(st=>st.priced).map(st=>`<tr><td><b>${st.name}</b><small>${st.distance}m · ${st.hours}</small></td>${compareOffers.map(id=>{const o=MAI_DATA.offers.find(o=>o.id===id),q=o?.storeQuotes[st.id];return `<td>${q?'¥'+money(q.price):'本次无报价'}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div><p class="value-source">单品便宜，不代表所有套餐都便宜。不能把双吉缺项的 13.9 元起价当成双吉套餐价。</p>`;
$('#official-sets').innerHTML=MAI_DATA.officialSets.map(x=>`<article><img src="${esc(x.image)}" alt="${esc(x.name)}" loading="lazy"><b>${esc(x.name)}</b><small>官方套餐入口 · ${x.code}</small><span>菜单曾展示 ¥${esc(x.menuPrice)}起</span><small>${esc(x.condition)} · 待核验规格/权益</small></article>`).join('');
function replay(){traceTimers.forEach(clearTimeout);const steps=[['先读预算和身体档案',`当前上限 ¥${settings.budget}，${settings.height}cm / ${settings.weight}kg，${MaiNutrition.labels[settings.objective]}目标。`],['估算目标，再查整套候选','身体参数换算每日参考；真实营养快照参与每套组合计算。'],['先卡预算，再排 21 餐','使用核价单元，比较单点和套餐；保留锁定餐次，超预算候选不能通过。'],['呈现差距，支持整套替换','只换选定套餐，保留其他餐次；展示费用和营养变化，支持撤销。'],['保存草案，临近用餐再核验','实际套餐规格、价格和权益待核验；不会直接下单。']];$('#trace-steps').innerHTML=steps.map((s,i)=>`<li class="trace-step" id="trace-${i}"><b>${i+1}　${s[0]}</b><p>${s[1]}</p></li>`).join('');$('#trace-dialog').showModal();traceTimers=steps.map((_,i)=>setTimeout(()=>$('#trace-'+i)?.classList.add('done'),i*700));}
$('#replay').onclick=replay;$('#workflow-replay').onclick=replay;$('#trace-dialog').addEventListener('close',()=>traceTimers.forEach(clearTimeout));$$('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const b=d.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)d.close();}}));
if(plan.length!==21)plan=planner.generate(settings,retained);retained=clone(plan);render();
})();
