import {newDay,question,choose,account,resultScene,schedule,observations,isNight,clamp,sceneTimes} from './model.js';
import {SceneEngine} from './scene.js';
const $=s=>document.querySelector(s),game=$('#game'),deck=$('#decision'),upper=$('#upper'),lower=$('#lower'),ending=$('#ending');
const manifest=await fetch('assets.json').then(r=>r.json());
const engine=new SceneEngine($('#scene'),manifest);
let state=newDay(),busy=true,gesture=null,run=0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

const intro=$('#intro'),startButton=$('#start');
const timeTrack=$('#game-time-track');
const timeLabels=sceneTimes.map((value,i)=>{
  const item=document.createElement('li'),label=document.createElement('time');
  label.dateTime=value;
  label.textContent=value;
  if(i>=8)label.setAttribute('aria-label','Next day, '+value);
  item.append(label);
  timeTrack.append(item);
  return item;
});
function showTime(index,instant=false){
  timeTrack.classList.toggle('instant',instant);
  timeTrack.style.transform='translateX('+((1-index)*100/3)+'%)';
  timeLabels.forEach((item,i)=>{
    const current=i===index,visible=Math.abs(i-index)<=1;
    item.classList.toggle('current',current);
    item.classList.toggle('visible',visible);
    item.classList.toggle('linked',visible&&i<index+1&&i<timeLabels.length-1);
    item.setAttribute('aria-hidden',String(!visible));
    if(current)item.firstElementChild.setAttribute('aria-current','time');
    else item.firstElementChild.removeAttribute('aria-current');
  });
  if(instant){void timeTrack.offsetWidth;timeTrack.classList.remove('instant');}
}
showTime(0,true);
function theme(scene){
  game.classList.toggle('night',isNight(scene));
  document.querySelector('meta[name="theme-color"]').content=isNight(scene)?'#122e53':'#f7dcb4';
}
function questionMotion(){
  return state.index<6?'ride':state.index===8&&state.ac?'cool':state.index>=7&&state.index<9?'sleep':'rest';
}
function preloadOutcomes(){
  for(const choice of [0,1]){
    const after={...state,choices:[...state.choices]};
    choose(after,choice);
    const result=resultScene(state.index,choice,after),next=question(after);
    engine.prime(result.scene,after.H);
    if(next)engine.prime(next.scene,after.H);
    if(result.detour)engine.prime('street',after.H);
  }
}
function showQuestion(){
  const q=question(state);if(!q)return;
  theme(q.scene);
  $('#question').textContent=q.text;
  upper.querySelector('span').textContent=q.up;lower.querySelector('span').textContent=q.down;
  for(const b of [upper,lower]){b.disabled=false;b.classList.remove('active','muted');}
  deck.style.transform='';deck.style.transition='';deck.classList.remove('resolving','entering');
  deck.hidden=false;void deck.offsetWidth;deck.classList.add('entering');
  busy=false;preloadOutcomes();
}
async function select(choice){
  if(busy)return;
  busy=true;const token=run,index=state.index;
  upper.disabled=lower.disabled=true;upper.classList.toggle('active',choice===0);lower.classList.toggle('active',choice===1);upper.classList.toggle('muted',choice===1);lower.classList.toggle('muted',choice===0);
  deck.style.transition='transform .3s cubic-bezier(.16,1,.3,1),opacity .28s';deck.style.transform=`translateY(${choice===0?-26:26}px)`;
  choose(state,choice);const result=resultScene(index,choice,state);
  await sleep(reduce?0:140);deck.classList.add('resolving');
  await sleep(reduce?0:235);deck.hidden=true;
  if(result.detour){
    await engine.show('street',state.H,'ride');
    await sleep(700);
    if(token!==run)return;
  }
  theme(result.scene);
  await engine.show(result.scene,state.H,result.motion);
  await sleep(result.overtime?5000:result.detour?1800:2750);
  if(token!==run)return;
  if(state.index===10){await showEnding();return;}
  const next=question(state);
  theme(next.scene);
  showTime(state.index);
  await engine.show(next.scene,state.H,questionMotion());
  if(token===run)showQuestion();
}

game.addEventListener('pointerdown',e=>{
  if(busy||e.button>0)return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY,start:performance.now(),dy:0};game.setPointerCapture(e.pointerId);deck.classList.remove('entering');deck.style.transition='none';
});
game.addEventListener('pointermove',e=>{
  if(!gesture||gesture.id!==e.pointerId||busy)return;
  const dy=e.clientY-gesture.y;gesture.dy=dy;const y=clamp(dy,-150,150);
  deck.style.transform=`translateY(${y*.43}px) scale(${1-Math.min(Math.abs(y),150)*.00012})`;
  upper.classList.toggle('active',dy<-13);lower.classList.toggle('active',dy>13);upper.classList.toggle('muted',dy>20);lower.classList.toggle('muted',dy<-20);
});
game.addEventListener('pointerup',e=>{
  if(!gesture||gesture.id!==e.pointerId)return;
  const g=gesture;gesture=null;if(busy)return;
  const velocity=g.dy/Math.max(1,performance.now()-g.start);
  if(Math.abs(g.dy)>58||(Math.abs(g.dy)>23&&Math.abs(velocity)>.38)){select(g.dy<0?0:1);return;}
  deck.style.transition='transform .5s cubic-bezier(.16,1,.3,1)';deck.style.transform='';upper.classList.remove('active','muted');lower.classList.remove('active','muted');
  if(Math.abs(g.dy)<12){const el=document.elementFromPoint(e.clientX,e.clientY)?.closest('.option');if(el)select(el===upper?0:1);}
});
game.addEventListener('pointercancel',()=>{gesture=null;deck.style.transform='';upper.classList.remove('active','muted');lower.classList.remove('active','muted');});
// Native click is needed for keyboard activation; pointer taps are handled above.
upper.addEventListener('click',e=>{if(e.detail===0)select(0);});lower.addEventListener('click',e=>{if(e.detail===0)select(1);});
document.addEventListener('keydown',e=>{if(!busy&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();select(e.key==='ArrowUp'?0:1);}});

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colours=['#a8b8a5','#ffbb69','#c1aedc'];
function arc(start,end,r){const a=(start/1440)*Math.PI*2-Math.PI/2,b=(end/1440)*Math.PI*2-Math.PI/2;const p=t=>[160+r*Math.cos(t),160+r*Math.sin(t)];const x=p(a),y=p(b);return `M${x[0].toFixed(3)} ${x[1].toFixed(3)} A${r} ${r} 0 ${end-start>720?1:0} 1 ${y[0].toFixed(3)} ${y[1].toFixed(3)}`;}
function runs(a){let start=0,last=a[0],out=[];for(let i=1;i<=a.length;i++)if(i===a.length||a[i]!==last){out.push([start,i,last]);start=i;last=a[i];}return out;}
function clockSVG(s){
  const {planned,actual,awake,lost}=schedule(s);
  let svg=`<svg class="clock" viewBox="0 0 320 320" role="img" aria-label="24-hour planned and actual schedules from 07:00 to 07:00"><defs><pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><path d="M0 0V5" stroke="#fff3dd" stroke-width="1.2"/></pattern></defs>`;
  for(let h=0;h<24;h++){let a=h/24*Math.PI*2-Math.PI/2;svg+=`<path d="M${160+133*Math.cos(a)} ${160+133*Math.sin(a)}L${160+(h%6===0?140:136)*Math.cos(a)} ${160+(h%6===0?140:136)*Math.sin(a)}" stroke="#fff1de" opacity="${h%6===0?.6:.2}" stroke-width="1"/>`;}
  for(const [a,b,c]of runs(planned))svg+=`<path d="${arc(a,b-.2,122)}" fill="none" stroke="${colours[c]}" stroke-width="13" opacity=".56"/>`;
  for(const [a,b,c]of runs(actual))svg+=`<path d="${arc(a,b-.2,98)}" fill="none" stroke="${colours[c]}" stroke-width="17"/>`;
  for(const [a,b,c]of runs(lost))if(c)svg+=`<path d="${arc(a,b,111)}" fill="none" stroke="${colours[planned[a]]}" stroke-width="2" stroke-dasharray="2.5 3"/>`;
  for(const [a,b,c]of runs(awake))if(c)svg+=`<path d="${arc(a,b,98)}" fill="none" stroke="url(#hatch)" stroke-width="17"/>`;
  svg+='<text x="160" y="11" text-anchor="middle">07:00</text><text x="309" y="163" text-anchor="end">13:00</text><text x="160" y="315" text-anchor="middle">19:00</text><text x="9" y="163">01:00</text><text class="center-big" x="160" y="154" text-anchor="middle">24 h</text><text class="center-small" x="160" y="177" text-anchor="middle">The same day</text><text class="center-small" x="160" y="192" text-anchor="middle">Less room to live</text></svg>';
  return svg;
}
const duration=m=>`${Math.floor(m/60)} h ${m%60} min`;
function renderEnding(){
  const a=account(state),obs=observations(state),change=a.change>0?`${a.change} minutes more than planned.`:a.change<0?`${-a.change} minutes less than planned.`:'As long as planned.';
  return `<section class="report"><h2>A day has passed.<span>What has the heat left behind?</span></h2>
  <aside class="report-contact" aria-labelledby="contact-title"><h3 id="contact-title">Contact us</h3><p>Have feedback, suggestions, or an interest in the game? We’d love to hear from you.</p><a href="mailto:zzhang9798@gmail.com">zzhang9798@gmail.com <span aria-hidden="true">↗</span></a></aside>
  <a class="explore-hint" href="#heat-research">Scroll down to explore <span aria-hidden="true">↓</span></a>
  <div class="clock-wrap">${clockSVG(state)}</div><div class="ring-legend"><span><i style="background:${colours[1]}"></i>Work & daily tasks</span><span><i style="background:${colours[0]}"></i>Free time & rest</span><span><i style="background:${colours[2]}"></i>Sleep</span></div><p class="ring-explainer">Outer: planned · Inner: actual<br>Dashed: planned activities not carried out · Hatched: time awake</p>
  <div class="metrics"><article class="metric"><div class="number">${a.orders}<small>/ 32</small></div><div><p class="label">Orders completed</p><p class="detail">${a.missing} fewer orders than planned.</p></div></article>
  <article class="metric"><p class="label">Change in working time</p><div class="number">${a.change>0?'+':a.change<0?'−':''}${Math.abs(a.change)}<small>min</small></div><p class="detail">${a.W} minutes worked.<br>${change}</p></article>
  <article class="metric"><p class="label">Free time lost</p><div class="number">${a.freeLost}<small>min</small></div><p class="detail">Taken up by overtime.</p></article>
  <article class="metric"><p class="label">Additional water<br>and cooling costs</p><div class="number">${a.cost}<small>CNY</small></div><p class="detail">Water + nighttime air conditioning.</p></article>
  <article class="metric"><p class="label">Sleep lost</p><div class="number">${a.sleepLost}<small>min</small></div><p class="detail">Actual sleep:<br>${duration(a.sleep)}.</p></article></div>
  ${obs.length?`<div class="report-observations">${obs.map(x=>`<p>${esc(x)}</p>`).join('')}</div>`:''}
  <div class="morning-plan"><h3>Plans for the following morning</h3><p>${state.morningRest?'Rest for three hours first.':'Keep the usual morning delivery schedule.'}</p><p>${state.morningRest?'12 fewer delivery opportunities scheduled.':`3 hours of delivery opportunities retained.<br>${a.morningOrders} projected completed orders.`}</p></div></section>
  <div class="research-flow"><section class="research one" id="heat-research" tabindex="-1"><div class="orb" aria-hidden="true"></div><h2>Heat limits the time<br>available during the day.</h2><p class="big">40.1</p><div class="unit">billion hours</div><p class="copy">In 2024, heat stress caused an estimated 40.1 billion hours of potential labour loss in China.</p><div class="secondary"><p class="big">2.52</p><div class="unit">hours a day</div><p class="copy">In 2024, an average of 2.52 hours per day in China exceeded the caution threshold for outdoor activity. Work, grocery shopping and walks all depend on suitable conditions.</p></div><p class="source">Source: Indicators 1.1.2 and 1.1.3, pp. e1069–e1070.</p></section>
  <section class="research two"><div class="orb" aria-hidden="true"></div><h2>The night may not restore<br>what the day takes.</h2><p class="big">≈23</p><div class="unit">hours per person per year</div><p class="copy">The report estimates that hot nights caused around 1,383 minutes of sleep loss per person in 2024.</p><div class="secondary"><p class="big">20.4<small style="font-size:.45em">%</small></p><p class="copy">Deep sleep loss in 2024 was 20.4% higher than in 1986–2005.</p></div><p class="source">Source: Indicator 1.1.4, p. e1070.</p></section>
  <section class="research three"><div class="orb" aria-hidden="true"></div><h2>Everyday discomfort is linked<br>to more serious health risks.</h2><p class="big">20,100</p><div class="unit">premature deaths</div><p class="copy">The report estimates that around 20,100 premature deaths in China in 2024 were associated with heatwave exposure.</p><p class="copy">Health risks deserve particular attention when heat persists through both day and night.</p><p class="source">Source: Indicators 1.1.1 and 1.1.5, pp. e1069–e1070.</p></section>
  <section class="research four"><h2>Public support<br>can change this day.</h2><p class="copy">People are adjusting. Public support can give them more options.</p><ul class="support"><li><strong>Shade and drinking water</strong> reduce detours and heat exposure.</li><li><strong>Accessible cooling spaces</strong> provide places to pause between deliveries, take part in community activities and rest.</li><li><strong>Heat protections and cooling support</strong> reduce the personal cost of resting, shifting work hours and using air conditioning.</li></ul><p class="copy">The report estimates that air conditioning prevented around <strong>51,000</strong> heat-related deaths in 2023.</p><p class="source">Source: Indicator 2.2.2 and the sections on adaptation measures, pp. e1073 and e1077.</p><form class="feedback" id="feedback" aria-labelledby="feedback-title">
    <h3 id="feedback-title">Share your feedback</h3>
    <label for="feedback-message">What would you like us to know?</label>
    <textarea id="feedback-message" name="message" rows="4" maxlength="1200" required placeholder="Leave a comment…" aria-describedby="feedback-note"></textarea>
    <input type="text" name="website" class="feedback-trap" tabindex="-1" autocomplete="off" aria-hidden="true">
    <p id="feedback-note">Anonymous. We save your comment, the time, and the link you used to get here.</p>
    <button type="submit">Send feedback <span aria-hidden="true">↗</span></button>
    <p class="feedback-status" role="status"></p>
  </form><button class="retry" id="retry">Try again</button></section>
  </div><section class="disclaimer"><p>Time, orders, costs, physical strain, heat sensation and sleep parameters in this playthrough are game scenario settings, not predictions of an individual’s health. Research figures are population-level estimates for China.</p><p>Potential labour loss does not mean actual absence from work. Hours above an outdoor activity caution threshold do not mean the amount of activity time an individual actually loses. Annual sleep loss is not the loss on a single night. Do not directly assign the report’s numerical health benefits to specific support measures.</p><p>Research basis: The 2025 China report of the Lancet Countdown on health and climate change.<br><a href="https://doi.org/10.1016/S2468-2667(25)00230-0" target="_blank" rel="noopener">DOI: 10.1016/S2468-2667(25)00230-0</a></p></section>`;
}
function feedbackId(){
  if(crypto.randomUUID)return crypto.randomUUID();
  const b=crypto.getRandomValues(new Uint8Array(16));
  b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
  const h=Array.from(b,n=>n.toString(16).padStart(2,'0')).join('');
  return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');
}
function wireFeedback(form){
  const endpoint=$('meta[name="feedback-endpoint"]')?.content.trim();
  if(!endpoint){
    const contact=document.createElement('div');
    contact.className='feedback feedback-offline';
    contact.setAttribute('aria-labelledby','feedback-title');
    contact.innerHTML='<h3 id="feedback-title">Share your feedback</h3><p><a href="mailto:zzhang9798@gmail.com">Email us your feedback</a></p>';
    form.replaceWith(contact);
    return;
  }
  const field=form.elements.namedItem('message');
  const button=form.querySelector('button');
  const status=form.querySelector('[role="status"]');
  let id=feedbackId();
  field.addEventListener('input',()=>{
    field.setCustomValidity('');
    status.textContent='';
    id=feedbackId();
  });
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(button.disabled)return;
    const message=field.value.trim();
    if(!message){
      field.setCustomValidity('Please enter a comment.');
      field.reportValidity();
      return;
    }
    const source=new URLSearchParams(location.search).get('src')?.slice(0,40)??'';
    button.disabled=true;field.readOnly=true;
    status.textContent='Sending…';
    try{
      const response=await fetch(endpoint,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({id,message,source,website:form.elements.namedItem('website').value}),
        signal:AbortSignal.timeout(12000)
      });
      if(response.status!==201||!(await response.json()).ok)throw new Error('Feedback not saved');
      form.reset();id=feedbackId();
      status.textContent='Thanks for sharing your feedback.';
    }catch{
      status.textContent='Your message wasn’t sent. Please try again.';
    }finally{
      button.disabled=false;field.readOnly=false;
    }
  });
}
async function showEnding(){
  busy=true;deck.hidden=true;ending.innerHTML=renderEnding();ending.hidden=false;ending.scrollTop=0;
  ending.animate([{opacity:0,transform:'translateY(20px)'},{opacity:1,transform:'translateY(0)'}],{duration:reduce?1:850,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'});
  game.hidden=true;engine.setActive(false);
  $('#retry').addEventListener('click',restart);
  $('.explore-hint').addEventListener('click',e=>{
    e.preventDefault();
    const target=$('#heat-research');
    target.focus({preventScroll:true});
    target.scrollIntoView({behavior:reduce?'instant':'smooth',block:'start'});
  });
  wireFeedback($('#feedback'));
}
async function restart(){
  run++;state=newDay();busy=true;gesture=null;
  showTime(0,true);
  await engine.show('residential',0,'rest',true);
  ending.hidden=true;game.hidden=false;deck.hidden=true;
  intro.classList.remove('leaving');intro.hidden=false;startButton.disabled=false;
  theme('residential');
  engine.setActive(true);
  startButton.focus({preventScroll:true});
}
startButton.addEventListener('click',async()=>{
  if(startButton.disabled)return;
  startButton.disabled=true;intro.classList.add('leaving');
  await engine.show('residential',0,'ride',true);
  await sleep(reduce?0:450);
  intro.hidden=true;showQuestion();
});
await engine.show('residential',0,'rest',true);
