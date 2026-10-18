/* Adult planning estimates, not a prescription. See methodology in the UI / PRD v1.3. */
(function(root){
  'use strict';
  const labels={loss:'减脂',maintain:'维持',gain:'增肌'};
  function targets(s){
    const errors=[];
    for(const [key,min,max] of [['height',130,220],['weight',35,200],['age',18,65]])
      if(!Number.isFinite(s[key])||s[key]<min||s[key]>max)errors.push(`${{height:'身高',weight:'体重',age:'年龄'}[key]}需在 ${min}–${max} 范围内`);
    if(!['male','female'].includes(s.sex)||![1.2,1.375,1.55,1.725].includes(s.activity)||!labels[s.objective])errors.push('请完整填写估算参数');
    if(s.special)errors.push('孕哺期或需要特殊营养管理时，请使用专业人员制定的方案');
    if(errors.length)return {valid:false,errors};
    const bmi=s.weight/(s.height/100)**2;
    if(s.objective==='loss'&&bmi<18.5)return {valid:false,errors:['当前体重偏低，不生成减脂餐单；请重新评估目标。']};
    const resting=10*s.weight+6.25*s.height-5*s.age+(s.sex==='male'?5:-161);
    const tdee=resting*s.activity;
    // Product heuristics, not values prescribed by the Mifflin paper.
    const adjustment=s.objective==='loss'?-0.15:s.objective==='gain'?0.08:0;
    const kcal=Math.round(tdee*(1+adjustment)/10)*10;
    if(kcal<1200)return {valid:false,errors:['估算能量过低，超出本演示的自动规划范围，请由专业人员评估。']};
    const proteinFactor=s.objective==='gain'||s.training?1.6:s.objective==='loss'?1.2:1;
    const protein=Math.round(s.weight*proteinFactor);
    const fat=Math.round(kcal*0.3/9),carbs=Math.round((kcal-protein*4-fat*9)/4);
    return {valid:true,errors:[],label:labels[s.objective],bmi,resting:Math.round(resting),tdee:Math.round(tdee),adjustment,kcal,
      kcalMin:Math.round(kcal*.9),kcalMax:Math.round(kcal*1.1),protein,proteinFactor,fat,carbs,sodium:2000,
      trainingNote:s.objective==='gain'&&!s.training?'增肌需要配合力量训练；这里只估算饮食参考。':''};
  }
  root.MaiNutrition={targets,labels};
})(typeof window!=='undefined'?window:globalThis);
