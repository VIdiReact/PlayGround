// Midnight Signal: Jungle Tower — 3D-style open-world management RPG
const $=(q)=>document.querySelector(q);
const SAVE='midnight-signal-save';

const stations={
generator:{name:'Generator',type:'BALANCE LOAD',x:-.42,y:.25,done:false},
dish:{name:'Dishes & Mast',type:'ALIGN ANTENNA',x:.55,y:-.05,done:false},
relay:{name:'Relay Board',type:'SOLDER CIRCUIT',x:.2,y:.55,done:false},
radio:{name:'Radio Shack',type:'TUNE TRANSMISSION',x:-.05,y:-.46,done:false}
};

let state={night:1,completed:{},load:[42,28,18,12],dishAz:118,dishEl:31,relaySteps:[],radioDial:52,ending:null,muted:false,entries:[]};
let player={x:-.10,y:.12,a:0,walk:0,body:100,stamina:100};
let keys={};let cameraShake=0;let nearest=null;let toastTimer=0;
let rain=[];let fireflies=[];
let introVisible=false;
const nightBriefs=[
  {title:'Restore the carrier',text:'Stabilize four systems before the 01:00 weather window closes.',weather:'MONSOON · 24°'},
  {title:'Hold the eastern relay',text:'Repeat the station checks. Signal interference is rising beyond the ridge.',weather:'HIGH WIND · 22°'},
  {title:'Survive the final watch',text:'Complete one last service cycle and decide whether to answer the unknown voice.',weather:'SEVERED LINE · 19°'}
];

try{const saved=JSON.parse(localStorage.getItem(SAVE)||'null');if(saved)state={...state,...saved};}catch(e){}
Object.keys(stations).forEach(k=>stations[k].done=!!state.completed[k]);

for(let i=0;i<85;i++)rain.push({x:Math.random(),y:Math.random(),z:Math.random()});
for(let i=0;i<28;i++)fireflies.push({x:Math.random(),y:Math.random(),p:Math.random()*6});

function save(){localStorage.setItem(SAVE,JSON.stringify(state));}
function toast(s){const el=$('#toast');el.textContent=s;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2200);}

function worldPoint(wx,wy,c){
  const w=c.width,h=c.height;
  const scale=Math.min(w/1100,h/680)*1.28;
  const cx=w*.51,cy=h*.58;
  return {x:cx+(wx-wy)*220*scale,y:cy+(wx+wy)*105*scale};
}

function drawWorld(){
  const c=$('#world'),ctx=c.getContext('2d');
  const dpr=Math.min(devicePixelRatio||1,2);const w=c.clientWidth,h=c.clientHeight;
  if(c.width!==w*dpr||c.height!==h*dpr){c.width=w*dpr;c.height=h*dpr;}
  ctx.setTransform(dpr,0,0,dpr,0,0);

  const horizon=h*.40;
  let sky=ctx.createLinearGradient(0,0,0,horizon+180);sky.addColorStop(0,'#081310');sky.addColorStop(.7,'#1b3226');sky.addColorStop(1,'#42604d');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);

  // distant jungle silhouettes
  ctx.fillStyle='#09130f';
  for(let i=-40;i<w+60;i+=31){const hh=90+((i*17)%70);ctx.beginPath();ctx.moveTo(i,horizon+30);ctx.lineTo(i+18,horizon-hh*.25);ctx.lineTo(i+36,horizon+30);ctx.fill();}
  ctx.fillStyle='#13271d';
  for(let i=-20;i<w+50;i+=23){const hh=55+((i*31)%45);ctx.beginPath();ctx.moveTo(i,horizon+40);ctx.lineTo(i+12,horizon-hh);ctx.lineTo(i+25,horizon+40);ctx.fill();}

  // moon and mist
  ctx.fillStyle='rgba(205,223,198,.12)';ctx.beginPath();ctx.arc(w*.78,h*.18,38,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(220,229,205,.8)';ctx.beginPath();ctx.arc(w*.78,h*.18,16,0,Math.PI*2);ctx.fill();

  // forest floor
  ctx.save();ctx.beginPath();ctx.moveTo(0,h*.37);ctx.lineTo(w,h*.37);ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.clip();
  const ground=ctx.createLinearGradient(0,h*.38,0,h);ground.addColorStop(0,'#2b4935');ground.addColorStop(.55,'#1b3325');ground.addColorStop(1,'#0d1b13');ctx.fillStyle=ground;ctx.fillRect(0,h*.37,w,h*.63);

  // isometric ground tiles
  const scale=Math.min(w/1100,h/680)*1.28;const cx=w*.51,cy=h*.58;
  ctx.strokeStyle='rgba(131,160,132,.08)';ctx.lineWidth=1;
  for(let i=-7;i<=7;i++){ctx.beginPath();let a=worldPoint(i,-5,c),b=worldPoint(i,5,c);ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();let d=worldPoint(-5,i,c),e=worldPoint(5,i,c);ctx.moveTo(d.x,d.y);ctx.lineTo(e.x,e.y);ctx.stroke();}

  // station pad
  ctx.fillStyle='rgba(23,31,25,.82)';ctx.beginPath();
  let p=worldPoint(-.78,-.75,c),q=worldPoint(.78,-.75,c),r=worldPoint(.78,.75,c),s=worldPoint(-.78,.75,c);
  ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.lineTo(r.x,r.y);ctx.lineTo(s.x,s.y);ctx.closePath();ctx.fill();

  // puddles and mud
  ctx.fillStyle='rgba(105,139,130,.12)';for(let i=0;i<7;i++){let x=(i*.19-.58),y=((i*37)%90)/100-.45,b=worldPoint(x,y,c);ctx.beginPath();ctx.ellipse(b.x,b.y,35*scale,10*scale,-.15,0,Math.PI*2);ctx.fill();}

  // draw sorted objects by depth
  const objects=[];
  objects.push({kind:'generator',depth:-.42+.25,x:-.42,y:.25});
  objects.push({kind:'dish',depth:.55-.05,x:.55,y:-.05});
  objects.push({kind:'relay',depth:.2+.55,x:.2,y:.55});
  objects.push({kind:'radio',depth:-.05-.46,x:-.05,y:-.46});
  objects.push({kind:'player',depth:player.x+player.y,x:player.x,y:player.y});
  objects.push({kind:'tower',depth:-.02,x:.02,y:-.18});
  objects.sort((a,b)=>a.depth-b.depth);
  objects.forEach(o=>{if(o.kind==='player')drawPlayer(ctx,worldPoint(o.x,o.y,c),scale);else if(o.kind==='tower')drawTower(ctx,worldPoint(o.x,o.y,c),scale);else drawStation(ctx,o.kind,worldPoint(o.x,o.y,c),scale,stations[o.kind].done);});

  // rain
  ctx.strokeStyle='rgba(190,220,204,.14)';ctx.lineWidth=1;
  rain.forEach(rn=>{let x=(rn.x*w+cameraShake)%w, y=(rn.y*h+(Date.now()/18*rn.z))%h;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-5,y+14);ctx.stroke();});
  // fireflies
  fireflies.forEach(f=>{let x=(f.x*w),y=h*.52+f.y*h*.35+Math.sin(Date.now()/700+f.p)*3;ctx.fillStyle=`rgba(205,232,145,${.25+.5*(.5+.5*Math.sin(Date.now()/800+f.p))})`;ctx.beginPath();ctx.arc(x,y,1.5,0,Math.PI*2);ctx.fill();});
  ctx.restore();

  drawMinimap();
}

function drawTower(ctx,p,s){
  ctx.fillStyle='rgba(5,9,7,.4)';ctx.beginPath();ctx.ellipse(p.x,p.y+43*s,55*s,15*s,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#62735f';ctx.lineWidth=5*s;
  ctx.beginPath();ctx.moveTo(p.x-34*s,p.y+50*s);ctx.lineTo(p.x,p.y-150*s);ctx.lineTo(p.x+34*s,p.y+50*s);ctx.stroke();
  ctx.lineWidth=2*s;for(let y=-120;y<45;y+=24){ctx.beginPath();ctx.moveTo(p.x-12*s-y*.18*s,p.y+y*s);ctx.lineTo(p.x+12*s-y*.18*s,p.y+y*s);ctx.stroke();}
  ctx.strokeStyle='#a5b990';ctx.lineWidth=1*s;ctx.beginPath();ctx.moveTo(p.x,p.y-150*s);ctx.lineTo(p.x,p.y-205*s);ctx.stroke();
}

function drawStation(ctx,kind,p,s,done){
  ctx.save();ctx.translate(p.x,p.y);
  ctx.fillStyle='rgba(5,8,6,.45)';ctx.beginPath();ctx.ellipse(0,18*s,38*s,11*s,0,0,Math.PI*2);ctx.fill();
  if(kind==='generator'){ctx.fillStyle='#26352d';ctx.fillRect(-30*s,-27*s,60*s,45*s);ctx.fillStyle=done?'#86a765':'#765d43';ctx.fillRect(-23*s,-20*s,46*s,29*s);ctx.fillStyle='#111713';ctx.fillRect(-14*s,-11*s,28*s,14*s);ctx.fillStyle='#b5ca9b';ctx.fillRect(-10*s,-7*s,4*s,4*s);ctx.fillRect(6*s,-7*s,4*s,4*s);}
  if(kind==='dish'){ctx.fillStyle='#5a685f';ctx.fillRect(-3*s,-65*s,6*s,83*s);ctx.fillStyle=done?'#a5c187':'#89958c';ctx.beginPath();ctx.ellipse(-8*s,-70*s,34*s,12*s,-.38,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#b9c8a8';ctx.lineWidth=2*s;ctx.beginPath();ctx.moveTo(-8*s,-70*s);ctx.lineTo(18*s,-52*s);ctx.stroke();}
  if(kind==='relay'){ctx.fillStyle='#25362a';ctx.fillRect(-38*s,-28*s,76*s,48*s);ctx.fillStyle=done?'#78965d':'#394b3f';ctx.fillRect(-30*s,-21*s,60*s,29*s);ctx.strokeStyle='#9aaa8c';ctx.lineWidth=1*s;for(let i=-20;i<25;i+=12){ctx.beginPath();ctx.moveTo(i*s,-16*s);ctx.lineTo(i*s,3*s);ctx.stroke();}}
  if(kind==='radio'){ctx.fillStyle='#202c25';ctx.fillRect(-32*s,-35*s,64*s,48*s);ctx.fillStyle=done?'#809d66':'#4b594d';ctx.fillRect(-25*s,-28*s,50*s,24*s);ctx.fillStyle='#d1b36f';ctx.fillRect(-18*s,-21*s,28*s,3*s);}
  if(!done){ctx.fillStyle='rgba(190,222,149,.85)';ctx.beginPath();ctx.arc(0,-52*s,3*s,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(190,222,149,.55)';ctx.beginPath();ctx.arc(0,-52*s,8*s+Math.sin(Date.now()/300)*2*s,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
}

function drawPlayer(ctx,p,s){
  ctx.save();ctx.translate(p.x,p.y);
  ctx.fillStyle='rgba(4,7,5,.55)';ctx.beginPath();ctx.ellipse(0,25*s,18*s,7*s,0,0,Math.PI*2);ctx.fill();
  const leg=player.walk?Math.sin(player.walk)*4*s:0;
  ctx.fillStyle='#171e19';ctx.fillRect(-9*s,8*s+leg,7*s,17*s);ctx.fillRect(2*s,8*s-leg,7*s,17*s);
  ctx.fillStyle='#70846a';ctx.beginPath();ctx.moveTo(-13*s,-4*s);ctx.lineTo(-9*s,13*s);ctx.lineTo(10*s,13*s);ctx.lineTo(14*s,-4*s);ctx.closePath();ctx.fill();
  ctx.fillStyle='#26372d';ctx.fillRect(-5*s,-7*s,10*s,16*s);ctx.fillStyle='#b09a79';ctx.beginPath();ctx.arc(0,-16*s,7*s,0,Math.PI*2);ctx.fill();ctx.fillStyle='#263229';ctx.beginPath();ctx.arc(0,-20*s,8*s,Math.PI,Math.PI*2);ctx.fill();
  ctx.fillStyle='#9cc17d';ctx.fillRect(-17*s,-2*s,5*s,10*s);ctx.fillRect(12*s,-2*s,5*s,10*s);
  ctx.restore();
}

function update(dt){
  let dx=(keys.ArrowRight||keys.d?1:0)-(keys.ArrowLeft||keys.a?1:0)+ (window.touchDX||0);
  let dy=(keys.ArrowDown||keys.s?1:0)-(keys.ArrowUp||keys.w?1:0)+(window.touchDY||0);
  const mag=Math.hypot(dx,dy);
  if(mag){
    dx/=mag;dy/=mag;
    const sprint=(keys.Shift||keys.shift)&&player.stamina>4;
    const speed=(sprint?.62:.43);
    if(sprint){player.stamina=Math.max(0,player.stamina-dt*15);}else{player.stamina=Math.min(100,player.stamina+dt*9);}
    player.x=Math.max(-.82,Math.min(.82,player.x+dx*speed*dt));
    player.y=Math.max(-.68,Math.min(.68,player.y+dy*speed*dt));
    player.a=Math.atan2(dy,dx);player.walk+=dt*(sprint?13:9);
  }else{player.stamina=Math.min(100,player.stamina+dt*12);}
  nearest=null;let nd=1;
  Object.entries(stations).forEach(([k,s])=>{if(s.done)return;let d=Math.hypot(player.x-s.x,player.y-s.y);if(d<.19&&d<nd){nearest=k;nd=d;}});
  const el=$('#interaction');el.classList.toggle('visible',!!nearest);
  if(nearest){$('#interactionName').textContent=stations[nearest].name;$('#interactionType').textContent=stations[nearest].type;}
}

function frame(t){update(Math.min(.033,(t-(frame.last||t))/1000));frame.last=t;drawWorld();requestAnimationFrame(frame);}requestAnimationFrame(frame);

function completedCount(){return Object.values(stations).filter(s=>s.done).length;}

function addJournal(title,text){
  state.entries.unshift({title,text});
  state.entries=state.entries.slice(0,12);
  save();
}

function showNightBrief(){
  const brief=nightBriefs[Math.max(0,Math.min(2,state.night-1))];
  modal(brief.title,'NIGHT '+String(state.night).padStart(2,'0')+' BRIEFING',`<div class="radio-copy"><p>${brief.text}</p><p><strong>Weather:</strong> ${brief.weather}</p></div>`,'<button class="primary-action" id="beginNight">BEGIN WATCH</button>');
  $('#beginNight').onclick=closeModal;
}
function updateHUD(){
  $('#nightLabel').textContent=`NIGHT ${String(state.night).padStart(2,'0')}`;
  const count=completedCount();
  const serviceCount=Object.keys(stations).filter(k=>k!=='radio').filter(k=>stations[k].done).length;
  $('#objectiveCount').textContent=`${serviceCount} / 3`;
  $('#objectiveBar').style.width=`${serviceCount*(100/3)}%`;
  $('#bodyValue').textContent=Math.round(player.body);
  $('#bodyBar').style.width=player.body+'%';
  $('#powerValue').textContent=state.night===1?'72':state.night===2?'64':'58';
  $('#powerBar').style.width=$('#powerValue').textContent+'%';
  const brief=nightBriefs[state.night-1];
  $('#objectiveText').textContent=serviceCount===3?'The station is stable. Tune the radio carrier, then make the night’s choice.':brief.text;
  $('#objectiveTitle').textContent=serviceCount===3?'Listen to the carrier':brief.title;
  $('#weatherText').textContent=brief.weather;
  $('#signalText').textContent=stations.radio.done?'CARRIER LOCKED':'NO CARRIER';
}

function openJob(kind){
  if($('#modalBackdrop').classList.contains('hidden')===false)return;
  if(kind==='generator')openGenerator();if(kind==='dish')openDish();if(kind==='relay')openRelay();if(kind==='radio')openRadio();
}

function modal(title,kicker,body,foot=''){
  $('#jobModal').innerHTML=`<header class="job-head"><div><small>${kicker}</small><h2>${title}</h2></div><button id="closeModal">CLOSE ×</button></header><div class="job-body">${body}</div><div class="job-foot">${foot}</div>`;
  $('#modalBackdrop').classList.remove('hidden');$('#closeModal').onclick=closeModal;
}
function closeModal(){ $('#modalBackdrop').classList.add('hidden'); }
function complete(kind,msg){
  stations[kind].done=true;state.completed[kind]=true;
  addJournal(msg,`Night ${state.night}: ${stations[kind].name} returned to a working state.`);
  updateHUD();closeModal();toast(msg);
}

function openGenerator(){
  const names=['Core pump','Comms rack','Workshop','Flood lamps'];
  modal('Load distribution','GENERATOR 220V',`<div class="load-grid">${names.map((n,i)=>`<label>${n}<output id="gOut${i}">${state.load[i]}%</output><input type="range" min="0" max="100" value="${state.load[i]}" data-i="${i}"></label>`).join('')}</div><div class="job-meter"><div><i id="gMeter"></i></div><p id="gStatus">Balance total load below 90%.</p></div>`,'<button class="primary-action" id="gApply">STABILIZE LOAD</button>');
  document.querySelectorAll('.load-grid input').forEach(inp=>inp.oninput=()=>{state.load[+inp.dataset.i]=+inp.value;$('#gOut'+inp.dataset.i).textContent=inp.value+'%';updateGen();});
  function updateGen(){let sum=state.load.reduce((a,b)=>a+b,0),meter=$('#gMeter');meter.style.width=Math.min(100,sum)+'%';meter.style.background=sum>100?'#e58070':sum>=78&&sum<=92?'#b8dc91':'#ddb96d';$('#gStatus').textContent=sum>=78&&sum<=92?`Stable load: ${sum}%`:`Current load: ${sum}% — target 78–92%`;}
  updateGen();$('#gApply').onclick=()=>{let sum=state.load.reduce((a,b)=>a+b,0);if(sum>=78&&sum<=92)complete('generator','Generator synchronized');else toast('Load is outside the safe operating band');};
}

function openDish(){modal('Directional alignment','MAST CONTROL','<div class="dish-grid"><div><label>AZIMUTH <output id="azOut">118°</output><input id="az" type="range" min="90" max="150" value="118"></label><label>ELEVATION <output id="elOut">31°</output><input id="el" type="range" min="20" max="42" value="31"></label></div><div class="scope"><canvas id="scope" width="260" height="180"></canvas></div></div>','<button class="primary-action" id="dishApply">LOCK AZ/EL</button>');
  function draw(){let az=+$('#az').value,el=+$('#el').value;$('#azOut').textContent=az+'°';$('#elOut').textContent=el+'°';state.dishAz=az;state.dishEl=el;let c=$('#scope'),x=c.getContext('2d');x.clearRect(0,0,260,180);x.strokeStyle='rgba(184,220,145,.18)';for(let i=0;i<260;i+=26){x.beginPath();x.moveTo(i,0);x.lineTo(i,180);x.stroke()}for(let i=0;i<180;i+=26){x.beginPath();x.moveTo(0,i);x.lineTo(260,i);x.stroke()}let px=(az-90)/60*260,py=(42-el)/22*180,peak=1-Math.hypot(px-130,py-85)/170;x.fillStyle=`rgba(184,220,145,${.12+Math.max(0,peak)*.5})`;x.beginPath();x.arc(px,py,18,0,Math.PI*2);x.fill();x.strokeStyle='#b8dc91';x.beginPath();x.moveTo(130,90);x.lineTo(px,py);x.stroke();}
  $('#az').oninput=$('#el').oninput=draw;draw();$('#dishApply').onclick=()=>{if(Math.abs(state.dishAz-132)<=3&&Math.abs(state.dishEl-34)<=2)complete('dish','Antenna locked on the relay vector');else toast('No carrier peak — sweep toward 132° / 34°')};
}

function openRelay(){
  const seq=[5,2,7,4,1,8];let pos=0;
  modal('Relay board','SPARE CIRCUIT K-19','<div class="relay-grid"><div class="relay-board">'+Array.from({length:8},(_,i)=>`<button class="relay-pad" data-pad="${i+1}">${String(i+1).padStart(2,'0')}</button>`).join('')+'</div><div class="relay-info"><strong>ORDER<br><span id="relayOrder">05</span></strong>Heat the pads in sequence.<br><small id="relayStatus">Awaiting first joint</small></div></div>','<button class="secondary-action" id="relayReset">RESET JOINTS</button>');
  function reset(){pos=0;document.querySelectorAll('.relay-pad').forEach(b=>b.className='relay-pad');$('#relayOrder').textContent=String(seq[0]).padStart(2,'0');$('#relayStatus').textContent='Awaiting first joint';}
  document.querySelectorAll('.relay-pad').forEach(b=>b.onclick=()=>{let n=+b.dataset.pad;if(n===seq[pos]){b.classList.add('done');pos++;if(pos===seq.length){complete('relay','Relay circuit continuity restored');}else{$('#relayOrder').textContent=String(seq[pos]).padStart(2,'0');$('#relayStatus').textContent=`Joint ${pos}/${seq.length} complete`;}}else{b.classList.add('wrong');setTimeout(()=>b.classList.remove('wrong'),220);$('#relayStatus').textContent='Open circuit — wrong pad';}});$('#relayReset').onclick=reset;
}

function openRadio(){
  const serviceComplete=Object.keys(stations).filter(k=>k!=='radio').every(k=>stations[k].done);
  modal('Long-range receiver','RADIO 45-B','<div class="radio-grid"><div class="radio-screen"><div class="radio-frequency"><span id="freqNum">5.2</span> <small>MHz</small></div><canvas id="radioCanvas" width="300" height="70"></canvas></div><div class="radio-copy"><strong id="voiceText">The carrier is weak.</strong><p id="radioHint">Service the three equipment stations first.</p><input id="radioDial" type="range" min="38" max="68" value="52" style="width:100%;accent-color:#b8dc91" '+(serviceComplete?'':'disabled')+'><div class="choice-list hidden" id="radioChoices"><button data-choice="reply">Reply: “Jungle Tower, we hear you.”</button><button data-choice="ignore">Remain silent and record the signal.</button></div></div></div>','<button class="secondary-action" id="closeRadio">LEAVE RECEIVER</button>');
  $('#closeRadio').onclick=closeModal;
  function drawRadio(){let v=+$('#radioDial').value;$('#freqNum').textContent=(v/10).toFixed(1);let c=$('#radioCanvas'),x=c.getContext('2d');x.clearRect(0,0,300,70);x.strokeStyle='rgba(184,220,145,.2)';for(let i=0;i<300;i+=25){x.beginPath();x.moveTo(i,0);x.lineTo(i,70);x.stroke()}x.beginPath();let target=state.night===1?52:state.night===2?61:44;for(let i=0;i<300;i++){let f=i/300*30+38,noise=.5*Math.exp(-Math.pow(f-target,2)/2)+.08*Math.random();let y=50-Math.abs(noise*28)*Math.sin(i*.12+Date.now()/120);if(i===0)x.moveTo(i,y);else x.lineTo(i,y);}x.strokeStyle='#b8dc91';x.stroke();if(serviceComplete&&Math.abs(v-target)<=1){$('#voiceText').textContent=state.night===1?'“Tower Seven… keep the light alive.”':state.night===2?'“The canopy moved before the landslide.”':'“Do not answer on the third call.”';$('#radioChoices').classList.remove('hidden');$('#radioHint').textContent='Voice lock established.';if(!stations.radio.done){complete('radio','Carrier signal resolved');}}else if(!serviceComplete){$('#voiceText').textContent='The carrier is weak.';$('#radioHint').textContent='Service generator, mast and relay before tuning.';}else{$('#voiceText').textContent='The carrier is weak.';$('#radioHint').textContent='Move across the band until the voice resolves.';$('#radioChoices').classList.add('hidden');}}
  $('#radioDial').oninput=drawRadio;drawRadio();
  document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{if(serviceComplete&&stations.radio.done){state.ending=b.dataset.choice;save();closeModal();showEnding();}else toast('Tune the carrier after all equipment is restored');});
}

function showEnding(){
  const choice=state.ending;
  modal(choice==='reply'?'Signal held':'Watch remains','NIGHT '+String(state.night).padStart(2,'0')+' COMPLETE',`<div class="radio-copy"><p>${choice==='reply'?'You answer through the wet night. The distant voice repeats your call sign—then the tower light above you begins to blink in recognition.':'You leave the carrier intact and save every syllable. At dawn, the recorder resolves a map hidden beneath the interference.'}</p><p>The jungle stays, and the station stays awake.</p></div>`,'<button class="primary-action" id="nextNight">'+(state.night<3?'CONTINUE TO NEXT NIGHT':'SAVE FINAL RECORD')+'</button>');
  $('#nextNight').onclick=()=>{if(state.night<3){state.night++;Object.keys(stations).forEach(k=>{stations[k].done=false;state.completed[k]=false});state.ending=null;player.body=100;player.stamina=100;save();updateHUD();closeModal();showNightBrief();toast(`Night ${state.night} watch started`);}else{addJournal('Final watch recorded','The final transmission has been preserved on this device.');closeModal();toast('Final record saved to this device');}};
}

window.addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if(e.key==='e'||e.key==='E')if(nearest)openJob(nearest);});window.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);

$('#mapButton').onclick=()=>{$('#journalEntries').innerHTML=state.entries.length?state.entries.map(x=>`<div class="journal-entry"><strong>${x.title}</strong>${x.text}</div>`).join(''):`<div class="journal-entry"><strong>NIGHT ${state.night}</strong>Generator 220V · Antenna mast · Relay K-19 · Radio 45-B</div>`;$('#journalBackdrop').classList.remove('hidden');};
$('#closeJournal').onclick=()=>$('#journalBackdrop').classList.add('hidden');
$('#restartButton').onclick=()=>{localStorage.removeItem(SAVE);location.reload();};
$('#soundButton').onclick=()=>{state.muted=!state.muted;save();$('#soundButton').textContent=state.muted?'SOUND OFF':'SOUND ON';toast(state.muted?'Ambience muted':'Ambience enabled');};

function drawMinimap(){const c=$('#minimap'),x=c.getContext('2d'),w=c.width,h=c.height;x.clearRect(0,0,w,h);x.fillStyle='#132219';x.fillRect(0,0,w,h);x.strokeStyle='rgba(169,198,155,.12)';for(let i=0;i<150;i+=18){x.beginPath();x.moveTo(i,0);x.lineTo(i,150);x.stroke();x.beginPath();x.moveTo(0,i);x.lineTo(150,i);x.stroke();}Object.entries(stations).forEach(([k,s])=>{let px=75+s.x*58,py=75+s.y*58;x.fillStyle=s.done?'#60785e':'#ddb96d';x.beginPath();x.arc(px,py,3,0,Math.PI*2);x.fill();});let px=75+player.x*58,py=75+player.y*58;x.fillStyle='#bfe69a';x.beginPath();x.moveTo(px,py-5);x.lineTo(px+4,py+4);x.lineTo(px-4,py+4);x.closePath();x.fill();}

const joy=$('#joystick'),knob=$('#joystickKnob');let active=false;function joyMove(e){if(!active)return;let r=joy.getBoundingClientRect(),p=e.touches?e.touches[0]:e,dx=p.clientX-(r.left+r.width/2),dy=p.clientY-(r.top+r.height/2),m=Math.hypot(dx,dy),lim=34;if(m>lim){dx=dx/m*lim;dy=dy/m*lim}knob.style.transform=`translate(${dx}px,${dy}px)`;window.touchDX=dx/lim;window.touchDY=dy/lim;}joy.addEventListener('touchstart',e=>{active=true;joyMove(e)},{passive:false});joy.addEventListener('touchmove',e=>{e.preventDefault();joyMove(e)},{passive:false});function endJoy(){active=false;window.touchDX=0;window.touchDY=0;knob.style.transform='';}joy.addEventListener('touchend',endJoy);$('#mobileAction').onclick=()=>{if(nearest)openJob(nearest)};

setInterval(()=>{let mins=(48+Math.floor((Date.now()/60000)%12))%60;$('#clock').textContent=`23:${String(mins).padStart(2,'0')}`;},1000);
updateHUD();
