'use strict';
const K=window.Kitchen, seed=window.KITCHEN_SEED, $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=2)=>n===null?'Unknown':n.toLocaleString('en-IN',{maximumFractionDigits:d});
const units=it=>it.unit==='piece'?'pieces':it.unit==='bunch'?'bunches':'kg';
const quantity=(n,it)=>n===null?'Needs quantity':`${fmt(n)} ${units(it)}`;
const rateText=(rate,it)=>rate===null?'Unknown':it.unit==='kg'?`${fmt(rate*1000,1)} g`:`${fmt(rate,3)} ${units(it)}`;
const storageKey='course-kitchen-v2', legacyKey='course-kitchen-prototype-v1';
let datasets,mode='real',activeTab='plan',editingCourse=null,editingPurchase=null,purchaseCourse=null,toastTimer,storageBlocked=false;
const empty=()=>({items:K.clone(seed.items),courses:[],plan:{diners:26,days:10,buffer:10}});
const data=()=>datasets[mode];
function warnStorage(message){$('storage-warning').hidden=false;$('storage-warning').textContent=message;}
function load(){
  datasets={real:K.addSeed(empty(),seed).data,demo:K.migrateV1(window.makeExampleData())};
  try{
    const saved=localStorage.getItem(storageKey);
    if(saved){const parsed=JSON.parse(saved);K.validate(parsed.real);K.validate(parsed.demo);datasets=parsed;mode=parsed.mode==='demo'?'demo':'real';return;}
    const legacy=localStorage.getItem(legacyKey);
    if(legacy){
      const previous=JSON.parse(legacy);
      const migrated=K.migrateV1(previous.real), original=window.makeExampleData().items;
      const unusedDefaults=!previous.real.courses.length && previous.real.items.length===original.length && previous.real.items.every(it=>original.some(o=>o.id===it.id&&o.base===it.base&&o.pack===it.pack&&it.stock===0));
      const real=unusedDefaults?{...empty(),plan:migrated.plan}:migrated;
      datasets={real:K.addSeed(real,seed).data,demo:K.migrateV1(previous.demo)};
      if(!previous.real.courses.length && previous.real.plan.diners===20 && previous.real.plan.days===10)datasets.real.plan={diners:26,days:10,buffer:previous.real.plan.buffer};
    }
  }catch(error){storageBlocked=true;warnStorage('Saved data could not be loaded. It has been preserved. Export your original backup or import a valid backup before saving new records.');}
}
function save(){
  if(storageBlocked){warnStorage('Changes are in memory only. Existing saved data has been preserved. Export a backup to keep this session.');return;}
  try{localStorage.setItem(storageKey,JSON.stringify({...datasets,mode}));$('save-status').textContent='Saved in this browser only';}
  catch(error){warnStorage('Browser storage is unavailable or full. Export a backup before closing.');$('save-status').textContent='Not saved. Export a backup.';}
}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
function setTab(tab){activeTab=tab;for(const t of ['plan','history','learning']){$(t).hidden=t!==tab;$('tab-'+t).setAttribute('aria-selected',String(t===tab));$('tab-'+t).tabIndex=t===tab?0:-1;}}
function syncInputs(){for(const key of ['diners','days','buffer'])$(key).value=data().plan[key];}
function totalText(rows,category){
  const parts=[];
  for(const unit of ['kg','piece','bunch']){
    const subset=rows.filter(r=>r.item.category===category&&r.item.unit===unit&&r.buy!==null);
    if(subset.length){const total=subset.reduce((s,r)=>s+r.buy,0);parts.push(`${fmt(total)} <span>${unit==='kg'?'kg':unit==='piece'?'pieces':'bunches'}</span>`);}
  }
  return parts.length?parts.map((p,i)=>i?`<small>${p}</small>`:p).join(''):'Unknown';
}
function render(){
  const d=data(),rows=d.items.map(item=>({item,...K.project(item,d.courses,d.plan)}));
  for(const m of ['real','demo'])$('mode-'+m).setAttribute('aria-pressed',String(mode===m));
  $('dataset-title').textContent=mode==='real'?'Your kitchen records':'Example history · Synthetic';
  const seedRecord=d.courses.find(c=>c.id===seed.course.id),hasSeed=!!seedRecord;
  $('dataset-description').textContent=mode==='real'?(hasSeed?`September receipts are linked to one course for ${fmt(seedRecord.diners)} diners. All changes stay in this browser.`:'Your purchases and inventory stay in this browser. Export a backup to keep a separate copy.'):'These six invented courses demonstrate the calculations. They never train your kitchen records.';
  $('days-badge').textContent=fmt(d.plan.diners*d.plan.days)+' planned diner-days';
  const unknown=rows.filter(r=>r.buy===null).length, provisional=rows.filter(r=>r.provisional).length, shortages=rows.filter(r=>r.shortages.length).length, stale=rows.filter(r=>r.item.stock.needsReview||r.item.stock.quantity>0&&!r.stockValid).length;
  const warnings=[];
  if(provisional)warnings.push('Provisional estimates use purchases or manual assumptions. Check purchase coverage, feeding days and leftovers before buying.');
  const pending=d.courses.reduce((n,c)=>n+c.purchases.filter(p=>!p.reviewed||p.quantity===null||p.item===null).length,0);
  if(pending)warnings.push(`${pending} receipt lines need review and do not contribute quantities.`);
  if(unknown)warnings.push(`${unknown} ingredients have no usable quantity or rate. Totals exclude them.`);
  if(shortages)warnings.push(`${shortages} ingredients have unresolved shortages. Their recorded usage is a minimum; review before buying.`);
  if(stale)warnings.push(`${stale} stock quantities need reconfirmation and are excluded from subtraction.`);
  $('forecast-warning').textContent=warnings.join(' ')||'Measured usage assumes a comparable menu. The extra allowance is not a guarantee against shortages.';
  $('scale-note').hidden=d.plan.diners<=2*Math.max(26,...d.courses.map(c=>c.diners));
  $('scale-note').textContent='This plan is much larger than the recorded courses. Review recipe portions, kitchen capacity and delivery batches with the cook.';
  $('vegetable-total').innerHTML=totalText(rows,'vegetable');$('fruit-total').innerHTML=totalText(rows,'fruit');$('course-count').textContent=d.courses.length;
  $('count-caption').textContent=`${d.courses.filter(c=>K.eligible(c)).length} with measured usage`;
  $('estimate-title').textContent=rows.some(r=>r.used)?'Measured courses lead.':'A provisional starting point.';
  $('estimate-copy').textContent=`${rows.filter(r=>r.used).length} ingredients have measured usage. ${provisional} use provisional rates. ${unknown} need a quantity.`;
  $('seed-summary').hidden=mode!=='real'||!hasSeed;
  if(seedRecord){$('seed-headcount').textContent=`${fmt(seedRecord.candidates??seedRecord.diners)} candidates + ${fmt(seedRecord.staff??0)} staff`;$('seed-range').textContent=`${seedRecord.startDate||'Start unknown'} to ${seedRecord.date}. ${fmt(seedRecord.days)} ${seedRecord.daysConfirmed?'confirmed feeding':'nominal'} days.${seedRecord.daysConfirmed?'':' Arrival and departure meal coverage is unconfirmed.'}`;}
  $('shopping-subtitle').textContent=`${fmt(d.plan.diners)} diners · ${fmt(d.plan.days)} feeding days · ${d.plan.buffer}% allowance`;
  $('shopping-rows').innerHTML=rows.map(r=>`<tr><td><div class="produce"><span class="dot ${r.item.category==='fruit'?'fruit':''}"></span><div><div class="produce-name">${esc(r.item.name)}</div><div class="produce-category">${esc(units(r.item))}</div></div></div></td><td class="right num">${rateText(r.rate,r.item)}</td><td class="right num">${quantity(r.expected,r.item)}</td><td class="right"><input type="number" class="cell-input" min="0" max="1000000" step=".001" value="${r.item.stock.quantity}" data-stock="${esc(r.item.id)}" aria-label="${esc(r.item.name)} stock in ${r.item.unit}"><span class="stock-note">${r.stockValid?'Checked '+esc(r.item.stock.confirmedOn):r.item.stock.quantity>0||r.item.stock.needsReview?'Recheck · excluded':'Not checked'}</span></td><td class="right buy">${quantity(r.buy,r.item)}${r.shortages.length?'<span class="quantity-status">Minimum · shortage unresolved</span>':r.provisional?'<span class="quantity-status">Provisional</span>':''}</td><td class="evidence small">${esc(r.basis)}${r.used?`<div>${r.used} measured courses</div>`:''}</td></tr>`).join('');
  $('settings-rows').innerHTML=d.items.map(it=>`<tr><td>${esc(K.itemName(it))}</td><td class="right"><input class="cell-input" type="number" min="0" max="5" step=".001" value="${it.base??''}" placeholder="Auto" data-base="${esc(it.id)}" aria-label="${esc(it.name)} starting ${it.unit} per diner per day"></td><td class="right"><input class="cell-input" type="number" min="${it.unit==='kg'?'.001':'1'}" max="1000" step="${it.unit==='kg'?'.001':'1'}" value="${it.pack}" data-pack="${esc(it.id)}" aria-label="${esc(it.name)} purchase increment in ${it.unit}"></td></tr>`).join('');
  const selected=$('learn-item').value;$('learn-item').innerHTML=d.items.map(it=>`<option value="${esc(it.id)}">${esc(K.itemName(it))}</option>`).join('');if(d.items.some(it=>it.id===selected))$('learn-item').value=selected;
  renderHistory();renderLearning();
}
function renderHistory(){
  const d=data();$('load-seed').hidden=mode==='demo';
  $('history-list').innerHTML=[...d.courses].sort((a,b)=>b.date.localeCompare(a.date)).map(c=>{
    const needsReview=c.purchases.filter(p=>!p.reviewed||p.quantity===null||p.item===null).length;
    const purchaseRows=c.purchases.map(p=>{const it=d.items.find(it=>it.id===p.item);return `<tr><td>${esc(it?K.itemName(it):p.label)}<div class="small muted">${esc(p.date||'Date unknown')}</div></td><td class="num right">${p.quantity===null?'Unknown':fmt(p.quantity)+(it?' '+esc(units(it)):' · unit unknown')}</td><td class="right num">${p.amount===null?'Unknown':'₹'+fmt(p.amount)}</td><td class="small">${esc(p.source)}<details class="purchase-note"><summary>Notes</summary>${esc(p.note||'No additional notes.')}</details></td><td>${p.reviewed&&p.quantity!==null&&p.item?'<span class="badge">Reviewed</span>':'<span class="flag">Needs review</span>'}</td><td><button class="line-button" data-purchase="${esc(p.id)}" data-course="${esc(c.id)}">Review / edit</button></td></tr>`;}).join('');
    const measured=c.lines.length?`<div class="scroll"><table aria-label="Measured inventory"><thead><tr><th>Measured ingredient</th><th>Opening</th><th>Bought</th><th>Remaining</th><th>Spoiled</th><th>Shortage</th></tr></thead><tbody>${c.lines.map(l=>{const it=d.items.find(it=>it.id===l.item);return `<tr><td>${esc(K.itemName(it))}</td><td>${fmt(l.opening)}</td><td>${fmt(l.bought)}</td><td>${fmt(l.remaining)}</td><td>${fmt(l.spoiled)}</td><td>${l.shortage?l.unmet===null?'Unknown unmet demand':fmt(l.unmet)+' unmet':'None recorded'}</td></tr>`;}).join('')}</tbody></table></div>`:'';
    return `<details class="card history-entry"><summary><div class="course-title">${esc(c.name)}<small>${esc(c.startDate?c.startDate+' to ':'')}${esc(c.date)} · ${fmt(c.diners)} diners · ${fmt(c.days)} ${c.daysConfirmed?'confirmed':'nominal'} feeding days</small><small>${c.candidates!==undefined?`${fmt(c.candidates)} candidates + ${fmt(c.staff)} staff · `:''}${c.purchases.length} purchase lines · ${needsReview} need review</small></div><span class="badge">${c.status==='completed'?'Completed':'In progress / planned'}</span></summary><div class="actions"><span class="small muted">${K.eligible(c)?'Measured inventory can update the forecast.':`Purchase history · ${c.purchaseCoverage==='complete'?'all purchases reported':'coverage incomplete'}${c.daysConfirmed?'':' · feeding days unconfirmed'}`}</span><button data-edit-course="${esc(c.id)}">Edit course / inventory</button><button data-add-purchase="${esc(c.id)}">+ Add purchase</button><button data-delete-course="${esc(c.id)}">Delete course</button></div>${c.purchases.length?`<div class="scroll"><table aria-label="Course purchases"><thead><tr><th>Ingredient</th><th class="right">Quantity</th><th class="right">Line cost</th><th>Source</th><th>Status</th><th></th></tr></thead><tbody>${purchaseRows}</tbody></table></div>`:'<p class="log-help">No receipt lines recorded.</p>'}${measured}</details>`;
  }).join('')||'<div class="card empty"><h3>No courses yet.</h3><p>Add a course, then its purchases.</p></div>';
}
function renderLearning(){
  const it=data().items.find(it=>it.id===$('learn-item').value)||data().items[0],r=K.estimate(it,data().courses);
  $('learn-equation').textContent=`${K.itemName(it)}: ${rateText(r.rate,it)} per diner per day. ${r.basis}.`;
  $('learn-chart').innerHTML=r.trace.map(t=>`<p>${esc(t.course)}: ${rateText(t.observed,it)} ${t.lowerBound?'minimum; shortage unresolved':`measured; ${fmt(t.alpha*100,1)}% update weight after initialization`}.</p>`).join('')||'<p>No completed, measured observations yet.</p>';
  $('learn-note').textContent=`${r.used} measured observations. Purchases with missing quantities or review flags do not set rates. ${r.shortages.length?'An unresolved shortage prevents the estimate dropping below recorded usage.':''}`;
}
function showError(id,error){$(id).textContent=error.message||String(error);$(id).hidden=false;}
function openCourse(id=null){
  editingCourse=id;const c=data().courses.find(c=>c.id===id);$('course-form').reset();$('course-error').hidden=true;
  $('course-title').textContent=c?'Edit course and inventory':'Record a course';
  $('course-name').value=c?.name||'';$('course-start').value=c?.startDate||'';$('course-date').value=c?.date||K.today();$('course-status').value=c?.status||'in_progress';
  $('course-candidates').value=c?.candidates??c?.diners??data().plan.diners;$('course-staff').value=c?.staff??0;$('course-days').value=c?.days??data().plan.days;$('course-coverage').value=c?.purchaseCoverage||'partial';$('days-confirmed').checked=c?.daysConfirmed||false;$('measured').checked=c?!c.purchaseOnly:false;
  $('log-rows').innerHTML=data().items.map(it=>{const l=c?.lines.find(l=>l.item===it.id);return `<tr data-log="${esc(it.id)}"><td>${esc(K.itemName(it))}</td>${['opening','bought','remaining','spoiled'].map(k=>`<td><input type="number" min="0" max="1000000" step=".001" data-field="${k}" aria-label="${esc(it.name)} ${k} ${it.unit}" value="${l?l[k]:''}" placeholder="Unknown"></td>`).join('')}<td><input type="checkbox" data-field="shortage" aria-label="${esc(it.name)} ran out" ${l?.shortage?'checked':''}></td><td><input type="number" min="0" max="1000000" step=".001" data-field="unmet" aria-label="${esc(it.name)} unmet ${it.unit}" value="${l?.unmet??''}" placeholder="Unknown"></td></tr>`;}).join('');
  updateInventory();$('course-dialog').showModal();
}
function updateInventory(){const active=$('measured').checked;$('inventory-fields').hidden=!active;document.querySelectorAll('[data-log]').forEach(row=>{row.querySelectorAll('input').forEach(input=>{input.disabled=!active || input.dataset.field==='unmet'&&!row.querySelector('[data-field=shortage]').checked;});});}
function openPurchase(courseId,purchaseId=null){
  purchaseCourse=courseId;editingPurchase=purchaseId;const c=data().courses.find(c=>c.id===courseId),p=c.purchases.find(p=>p.id===purchaseId);
  $('purchase-form').reset();$('purchase-error').hidden=true;$('purchase-title').textContent=p?'Review purchase':'Add purchase';$('purchase-course').textContent=c.name+' · '+c.diners+' diners';
  $('purchase-item').innerHTML='<option value="">Unmapped / unit unknown</option>'+data().items.map(it=>`<option value="${esc(it.id)}">${esc(K.itemName(it))}</option>`).join('');
  $('purchase-item').value=p?.item||'';$('purchase-source').value=p?.source||'';$('purchase-label').value=p?.label||'';$('purchase-date').value=p?.date||'';$('purchase-quantity').value=p?.quantity??'';$('purchase-amount').value=p?.amount??'';$('purchase-note').value=p?.note||'';$('purchase-reviewed').checked=p?.reviewed||false;$('delete-purchase').hidden=!p;$('purchase-dialog').showModal();
}
for(const tab of ['plan','history','learning'])$('tab-'+tab).onclick=()=>setTab(tab);
document.querySelector('.tabs').onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=['plan','history','learning'],i=tabs.indexOf(activeTab),next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;setTab(tabs[next]);$('tab-'+tabs[next]).focus();};
for(const m of ['real','demo'])$('mode-'+m).onclick=()=>{mode=m;syncInputs();render();save();};
for(const key of ['diners','days','buffer'])$(key).addEventListener('input',()=>{
  if(['diners','days','buffer'].some(id=>!$(id).checkValidity()||$(id).value==='')){$('plan-error').hidden=false;$('plan-error').textContent='Enter 1 to 10,000 whole diners and 0.1 to 365 feeding days. The last valid plan remains below.';$('print').disabled=true;return;}
  data().plan={diners:+$('diners').value,days:+$('days').value,buffer:+$('buffer').value};$('plan-error').hidden=true;$('print').disabled=false;save();render();
});
document.addEventListener('change',e=>{
  const field=['stock','base','pack'].find(f=>e.target.dataset[f]);if(!field)return;
  if(!e.target.checkValidity() || field!=='base'&&e.target.value===''){toast('Enter a valid quantity.');render();return;}
  const it=data().items.find(it=>it.id===e.target.dataset[field]);
  if(field==='stock')it.stock={quantity:+e.target.value,confirmedOn:K.today(),needsReview:false};
  else it[field]=e.target.value===''?null:+e.target.value;
  save();render();
});
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.close)$(b.dataset.close).close();
  if(b.dataset.editCourse)openCourse(b.dataset.editCourse);
  if(b.dataset.addPurchase)openPurchase(b.dataset.addPurchase);
  if(b.dataset.purchase)openPurchase(b.dataset.course,b.dataset.purchase);
  if(b.dataset.deleteCourse && confirm('Delete this course and its purchases? Export a backup first if you need to retain them.')){data().courses=data().courses.filter(c=>c.id!==b.dataset.deleteCourse);save();render();}
});
$('confirm-stock').onclick=()=>{for(const it of data().items)it.stock={quantity:it.stock.quantity,confirmedOn:K.today(),needsReview:false};save();render();toast('Current stock confirmed for this plan. Recheck it before the next course.');};
$('print').onclick=()=>window.print();$('learn-item').onchange=renderLearning;
$('add-course').onclick=()=>openCourse();$('add-course-history').onclick=()=>openCourse();$('measured').onchange=updateInventory;$('log-rows').onchange=updateInventory;
$('course-form').onsubmit=e=>{
  e.preventDefault();try{
    const old=data().courses.find(c=>c.id===editingCourse),lines=[];
    if($('measured').checked)document.querySelectorAll('[data-log]').forEach(row=>{
      const get=k=>row.querySelector(`[data-field="${k}"]`),keys=['opening','bought','remaining','spoiled'];
      if(keys.every(k=>get(k).value==='')&&!get('shortage').checked)return;
      if(keys.some(k=>get(k).value===''))throw Error('Fill all four inventory quantities for each measured row. Enter 0 only when measured.');
      lines.push({item:row.dataset.log,...Object.fromEntries(keys.map(k=>[k,+get(k).value])),shortage:get('shortage').checked,unmet:get('shortage').checked&&get('unmet').value!==''?+get('unmet').value:null});
    });
    const c={id:old?.id||K.id(),name:$('course-name').value.trim(),startDate:$('course-start').value||null,date:$('course-date').value,candidates:+$('course-candidates').value,staff:+$('course-staff').value,diners:+$('course-candidates').value+(+$('course-staff').value),days:+$('course-days').value,daysConfirmed:$('days-confirmed').checked,status:$('course-status').value,purchaseCoverage:$('course-coverage').value,purchaseOnly:!$('measured').checked,synthetic:mode==='demo',lines:$('measured').checked?lines:old?.lines||[],purchases:old?.purchases||[]};
    datasets[mode]=K.saveCourse(data(),c);save();render();$('course-dialog').close();setTab('history');toast('Course saved. Estimates recalculated and affected stock flagged for rechecking.');
  }catch(error){showError('course-error',error);}
};
$('purchase-item').onchange=()=>{const it=data().items.find(it=>it.id===$('purchase-item').value);if(it&&!$('purchase-label').value)$('purchase-label').value=it.name;};
$('purchase-form').onsubmit=e=>{
  e.preventDefault();try{
    const p={id:editingPurchase||K.id(),item:$('purchase-item').value||null,label:$('purchase-label').value.trim(),quantity:$('purchase-quantity').value===''?null:+$('purchase-quantity').value,amount:$('purchase-amount').value===''?null:+$('purchase-amount').value,date:$('purchase-date').value||null,source:$('purchase-source').value.trim(),note:$('purchase-note').value.trim(),reviewed:$('purchase-reviewed').checked};
    const next=K.clone(data()),c=next.courses.find(c=>c.id===purchaseCourse);
    if(!p.label||!p.source)throw Error('Add a description and receipt source.');
    if(c.purchases.some(other=>other.id!==p.id&&JSON.stringify([other.item,other.date,other.quantity,other.amount,other.source])===JSON.stringify([p.item,p.date,p.quantity,p.amount,p.source])))throw Error('A matching purchase already exists in this course. Edit that record to avoid double counting.');
    c.purchases=editingPurchase?c.purchases.map(old=>old.id===p.id?p:old):[...c.purchases,p];
    K.validate(next);datasets[mode]=next;save();render();$('purchase-dialog').close();toast('Purchase saved. Reviewed quantities update provisional estimates.');
  }catch(error){showError('purchase-error',error);}
};
$('delete-purchase').onclick=()=>{if(!confirm('Delete this purchase line?'))return;const c=data().courses.find(c=>c.id===purchaseCourse);c.purchases=c.purchases.filter(p=>p.id!==editingPurchase);save();render();$('purchase-dialog').close();};
$('add-item').onclick=()=>{$('item-form').reset();$('item-pack').step='.001';$('item-error').hidden=true;$('item-dialog').showModal();};
$('item-unit').onchange=()=>{$('item-pack').value=$('item-unit').value==='kg'?.5:1;$('item-pack').step=$('item-unit').value==='kg'?'.001':'1';};
$('item-form').onsubmit=e=>{e.preventDefault();try{
  const name=$('item-name').value.trim(),unit=$('item-unit').value;
  if(data().items.some(it=>it.name.toLowerCase()===name.toLowerCase()&&it.unit===unit))throw Error('This ingredient and unit already exist.');
  const next=K.clone(data());next.items.push({id:K.id(),name,category:$('item-category').value,unit,base:null,pack:+$('item-pack').value,stock:{quantity:0,confirmedOn:null,needsReview:false}});K.validate(next);datasets[mode]=next;save();render();$('item-dialog').close();toast('Ingredient added. Add a reviewed purchase or a starting rate.');
}catch(error){showError('item-error',error);}};
$('load-seed').onclick=()=>{const result=K.addSeed(datasets.real,seed);datasets.real=result.data;save();render();toast(result.added?'September course added once.':'September course already exists. Your edits were kept.');};
$('backup').onclick=()=>{const blob=new Blob([JSON.stringify({version:2,dataset:mode,data:data()},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`course-kitchen-${mode}-backup.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('restore').onclick=()=>$('import-file').click();$('import-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{
  if(file.size>10e6)throw Error('Backup exceeds the 10 MB limit.');
  const value=JSON.parse(await file.text());if(![1,2].includes(value.version)||!['real','demo'].includes(value.dataset))throw Error('Choose a valid Course kitchen backup.');
  const incoming=value.version===1?K.migrateV1(value.data):K.validate(value.data);
  if(value.dataset==='real'&&incoming.courses.some(c=>c.synthetic))throw Error('Synthetic records belong in example history.');
  if(!confirm(`Replace the ${value.dataset==='real'?'kitchen':'example'} dataset with this backup? Export your current data first if needed.`))return;
  datasets[value.dataset]=incoming;mode=value.dataset;storageBlocked=false;$('storage-warning').hidden=true;syncInputs();save();render();toast('Backup imported. Other dataset kept.');
}catch(error){toast(error.message||'Could not read backup.');}finally{e.target.value='';}};
$('seed-notes').innerHTML=seed.notes.map(note=>`<li>${esc(note)}</li>`).join('');
load();syncInputs();render();setTab('plan');save();
