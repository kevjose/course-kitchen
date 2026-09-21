/* Shared browser and Node forecasting model. Quantities stay in each item's native unit. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Kitchen = api;
})(globalThis, function () {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const dateOK = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s+'T12:00:00Z').toISOString().slice(0,10) === s;
  const number = (n, low=0, high=1e6) => typeof n === 'number' && Number.isFinite(n) && n >= low && n <= high;
  const optional = n => n === null || number(n);
  const id = () => 'record-' + (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const itemName = it => `${it.name} · ${it.unit}`;
  const exposure = c => c.diners * c.days;
  const eligible = (c, now=today()) => c.status === 'completed' && c.date <= now && c.daysConfirmed && !c.purchaseOnly;
  const usage = l => l.opening + l.bought - l.remaining - l.spoiled;
  const courseKey = c => JSON.stringify([c.name.trim().toLowerCase(),c.date,c.diners,c.days,c.lines]);
  function estimate(item, courses, now=today()) {
    let rate=null, used=0, floor=null; const trace=[], shortages=[], seen=new Set();
    [...courses].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)).forEach(c=>{
      if (!eligible(c,now)) return;
      const line=c.lines.find(l=>l.item===item.id); if(!line) return;
      const key=courseKey(c); if(seen.has(key)) return; seen.add(key);
      const observed=(usage(line)+(line.shortage && line.unmet!==null?line.unmet:0))/exposure(c);
      if(line.shortage && line.unmet===null){
        floor=Math.max(floor??0,observed); shortages.push(c.name);
        trace.push({course:c.name,observed,lowerBound:true}); return;
      }
      // A full 260 diner-day course gets 30% weight; tiny records have less influence.
      const alpha=1-Math.pow(.7,Math.min(exposure(c)/260,2));
      rate=rate===null?observed:(1-alpha)*rate+alpha*observed; used++;
      trace.push({course:c.name,observed,rate,alpha});
    });
    let basis=used?'Measured usage':null, provisional=false;
    if(rate===null && item.base!==null){rate=item.base;basis='Manual starting rate';provisional=true;}
    if(rate===null){
      let total=0, dinerDays=0;
      const purchaseSeen=new Set();
      for(const c of courses){
        const lines=c.purchases.filter(p=>p.item===item.id && p.reviewed && p.quantity!==null);
        if(!lines.length)continue;
        const key=JSON.stringify([c.name.trim().toLowerCase(),c.date,c.diners,c.days,lines.map(p=>[p.item,p.quantity,p.amount,p.date,p.source])]);
        if(purchaseSeen.has(key))continue;purchaseSeen.add(key);
        total+=lines.reduce((sum,p)=>sum+p.quantity,0);dinerDays+=exposure(c);
      }
      if(dinerDays){rate=total/dinerDays;basis='Provisional purchases';provisional=true;}
    }
    if(floor!==null){rate=Math.max(rate??0,floor);basis=used?basis:'Shortage lower bound';}
    return {rate,basis:basis||'Quantity needed',used,provisional,floor,shortages,trace};
  }
  function project(item,courses,plan,now=today()){
    const model=estimate(item,courses,now), stockValid=item.stock.confirmedOn!==null && !item.stock.needsReview;
    const stock=stockValid?item.stock.quantity:0;
    if(model.rate===null)return {...model,expected:null,buy:null,stock,stockValid};
    const expected=model.rate*plan.diners*plan.days;
    const need=Math.max(0,expected*(1+plan.buffer/100)-stock);
    const buy=Number((Math.ceil(need/item.pack-1e-9)*item.pack).toFixed(6));
    return {...model,expected,buy,stock,stockValid};
  }
  function validate(d, now=today()){
    if(!d || !Array.isArray(d.items) || !d.items.length || d.items.length>300 || !Array.isArray(d.courses) || d.courses.length>2000)throw Error('Invalid ingredient or course list.');
    if(!d.plan || !number(d.plan.diners,1,10000) || !Number.isInteger(d.plan.diners) || !number(d.plan.days,.1,365) || ![0,5,10,15,20].includes(d.plan.buffer))throw Error('Check planned diners, feeding days and allowance.');
    const ids=new Set();
    for(const it of d.items){
      if(typeof it.id!=='string'||ids.has(it.id)||typeof it.name!=='string'||!it.name.trim()||it.name.length>80||!['kg','piece','bunch'].includes(it.unit)||!['fruit','vegetable'].includes(it.category)||!(it.base===null||number(it.base,0,5))||!number(it.pack,.001,1000)||(it.unit!=='kg'&&!Number.isInteger(it.pack)))throw Error('Invalid ingredient details.');
      ids.add(it.id);
      if(!it.stock||!number(it.stock.quantity)||typeof it.stock.needsReview!=='boolean'||!(it.stock.confirmedOn===null||dateOK(it.stock.confirmedOn)&&it.stock.confirmedOn<=now))throw Error('Invalid stock snapshot.');
    }
    const courseIds=new Set();
    for(const c of d.courses){
      if(typeof c.id!=='string'||courseIds.has(c.id)||typeof c.name!=='string'||!c.name.trim()||c.name.length>80||!dateOK(c.date)||!(c.startDate===null||dateOK(c.startDate)&&c.startDate<=c.date)||!number(c.diners,1,10000)||!number(c.days,.1,365)||!['in_progress','completed'].includes(c.status)||typeof c.daysConfirmed!=='boolean'||typeof c.purchaseOnly!=='boolean'||!['partial','complete'].includes(c.purchaseCoverage)||!Array.isArray(c.lines)||!Array.isArray(c.purchases)||c.purchases.length>5000)throw Error('Invalid course details.');
      courseIds.add(c.id);
      if(c.candidates!==undefined || c.staff!==undefined){
        if(!number(c.candidates,0,10000)||!number(c.staff,0,10000)||Math.abs(c.candidates+c.staff-c.diners)>1e-8)throw Error('Candidate and staff counts must match total diners.');
      }
      if(c.status==='completed' && c.date>now)throw Error('A future course cannot be marked completed.');
      if(c.status==='completed' && !c.purchaseOnly && !c.daysConfirmed)throw Error('Confirm actual feeding days before learning from usage.');
      const lineIds=new Set();
      for(const l of c.lines){
        if(!ids.has(l.item)||lineIds.has(l.item)||!['opening','bought','remaining','spoiled'].every(k=>number(l[k]))||l.remaining+l.spoiled>l.opening+l.bought+1e-8||typeof l.shortage!=='boolean'||!optional(l.unmet))throw Error('Check inventory amounts: remaining plus spoilage cannot exceed available stock.');
        lineIds.add(l.item);
      }
      if(!c.purchaseOnly && c.status==='completed' && !c.lines.length)throw Error('Enter measured inventory for at least one ingredient.');
      const purchaseIds=new Set();
      for(const p of c.purchases){
        if(typeof p.id!=='string'||purchaseIds.has(p.id)||!(p.item===null||ids.has(p.item))||typeof p.label!=='string'||p.label.length>100||!optional(p.quantity)||!optional(p.amount)||typeof p.reviewed!=='boolean'||!(p.date===null||dateOK(p.date))||typeof p.source!=='string'||p.source.length>100||typeof p.note!=='string'||p.note.length>2000)throw Error('Check invoice quantities, amounts and ingredient mapping.');
        if(p.quantity!==null && p.item===null && p.reviewed)throw Error('Choose an ingredient before approving a quantity.');
        if(p.date!==null && p.date>now)throw Error('A purchase receipt cannot have a future date.');
        purchaseIds.add(p.id);
      }
    }
    return d;
  }
  function saveCourse(dataset,course,now=today()){
    const d=clone(dataset), old=d.courses.find(c=>c.id===course.id);
    if(d.courses.some(c=>c.id!==course.id && c.date===course.date && c.name.trim().toLowerCase()===course.name.trim().toLowerCase()))throw Error('This course already exists. Add purchases to the existing record.');
    d.courses=old?d.courses.map(c=>c.id===course.id?course:c):[...d.courses,course];
    validate(d,now);
    if(eligible(course,now)){
      for(const line of course.lines){
        const it=d.items.find(it=>it.id===line.item);
        if(it.stock.confirmedOn!==null && course.date>=it.stock.confirmedOn)it.stock.needsReview=true;
      }
    }
    return d;
  }
  function migrateV1(d,now=today()){
    if(!d||!Array.isArray(d.items)||!Array.isArray(d.courses))throw Error('Invalid legacy backup.');
    const next={items:d.items.map(it=>({id:it.id,name:it.name,category:it.category,unit:'kg',base:it.base/1000,pack:it.pack,stock:{quantity:it.stock,confirmedOn:null,needsReview:it.stock>0}})),plan:clone(d.plan),courses:d.courses.map(c=>({id:c.id,name:c.name,date:c.date,startDate:null,diners:c.diners,candidates:c.diners,staff:0,days:c.days,daysConfirmed:true,status:c.date>now?'in_progress':'completed',purchaseCoverage:'complete',purchaseOnly:c.purchaseOnly,synthetic:!!c.synthetic,lines:c.purchaseOnly?[]:clone(c.lines),purchases:c.purchaseOnly?c.lines.map((l,i)=>({id:`${c.id}-purchase-${i}`,item:l.item,label:d.items.find(it=>it.id===l.item)?.name||l.item,quantity:l.bought,amount:null,reviewed:true,date:null,source:'Previous purchase record',note:'Imported from version 1; inventory is unknown.'})):[]}))};
    return validate(next,now);
  }
  function addSeed(dataset,seed){
    const d=clone(dataset);
    if(d.courses.some(c=>c.id===seed.course.id || c.date===seed.course.date && c.startDate===seed.course.startDate && c.diners===seed.course.diners))return {data:d,added:false};
    const mapping={};
    for(const item of seed.items){
      const existing=d.items.find(it=>(it.id===item.id||it.name.toLowerCase()===item.name.toLowerCase())&&it.unit===item.unit);
      if(existing)mapping[item.id]=existing.id;
      else{let newId=item.id;while(d.items.some(it=>it.id===newId))newId+='-seed';mapping[item.id]=newId;d.items.push({...clone(item),id:newId});}
    }
    const course=clone(seed.course);course.purchases.forEach(p=>{if(p.item)p.item=mapping[p.item];});d.courses.push(course);
    return {data:validate(d),added:true};
  }
  return {clone,today,dateOK,id,itemName,eligible,usage,estimate,project,validate,saveCourse,migrateV1,addSeed};
});
