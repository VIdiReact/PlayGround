import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';

(() => {
'use strict';

const $=id=>document.getElementById(id);
const canvas=$('gameCanvas'),viewport=$('viewport');

const PARTS=[
{id:'frame',name:'Motorcycle frame',icon:'▱',slot:'FRAME'},
{id:'wheel1',name:'Front tire',icon:'◉',slot:'FRONT TIRE'},
{id:'wheel2',name:'Rear tire',icon:'◉',slot:'REAR TIRE'},
{id:'bars',name:'Handlebars',icon:'⌁',slot:'HANDLEBARS'},
{id:'engine',name:'Engine block',icon:'⚙',slot:'ENGINE'},
{id:'tank',name:'Oil tank',icon:'◒',slot:'OIL TANK'}
];
let state='assembly',health=100,fuel=100,bike=0,distance=0,ammo=6,kills=0,elapsed=0;
let shootCooldown=0,meleeCooldown=0,lootNearby=false,nextEnemyAt=7,nextLootAt=10,lastUI=0,muted=false;
const keys={},installed={},inventory={scrap:0,food:1,water:1,med:1,ammo:6,armor:0};

const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x9a927a);scene.fog=new THREE.Fog(0x9a927a,45,230);
const camera=new THREE.PerspectiveCamera(62,1,.1,600);camera.position.set(0,4.2,8.5);
scene.add(new THREE.HemisphereLight(0xd8d2ba,0x48463a,2.1));
const sun=new THREE.DirectionalLight(0xffe1ad,3.2);sun.position.set(-35,55,25);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
const mat=(color,roughness=.85)=>new THREE.MeshStandardMaterial({color,roughness});
const mats={soil:mat(0x77705a),road:mat(0x403f3b),stripe:mat(0xc8b57d),dark:mat(0x171b1b),rubber:mat(0x191c1b),metal:mat(0x99978a),rust:mat(0xb85d3e),frame:mat(0x383c37),leather:mat(0x30332e),skin:mat(0xb77b5d),helmet:mat(0x343b35),green:mat(0x66684e),wood:mat(0x665744),loot:mat(0xd6b85f),white:mat(0xd7d1bd)};
function mesh(geo,material,parent=scene){const o=new THREE.Mesh(geo,material);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
function box(parent,material,x,y,z,sx,sy,sz){const o=mesh(new THREE.BoxGeometry(sx,sy,sz),material,parent);o.position.set(x,y,z);return o}
function cylinder(parent,material,x,y,z,r1,r2,len,axis='y',segments=12){const o=mesh(new THREE.CylinderGeometry(r1,r2,len,segments),material,parent);o.position.set(x,y,z);if(axis==='x')o.rotation.z=Math.PI/2;if(axis==='z')o.rotation.x=Math.PI/2;return o}
function sphere(parent,material,x,y,z,sx,sy,sz){const o=mesh(new THREE.SphereGeometry(1,12,8),material,parent);o.position.set(x,y,z);o.scale.set(sx,sy,sz);return o}

const ground=mesh(new THREE.PlaneGeometry(1200,1200),mats.soil);ground.rotation.x=-Math.PI/2;ground.position.y=-.12;
const roadSegments=[],roadLength=90;
for(let i=0;i<9;i++){const g=new THREE.Group();scene.add(g);box(g,mats.road,0,-.015,-roadLength/2,13,.08,roadLength);for(let z=-roadLength+5;z<0;z+=12)box(g,mats.stripe,0,.04,z,.18,.025,5);g.position.z=-i*roadLength;roadSegments.push(g)}
const props=[];
function makeTree(x,z,seed){const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);cylinder(g,mats.wood,0,1.1,0,.22,.34,2.2);for(let j=0;j<3;j++){const crown=mesh(new THREE.ConeGeometry(1.25-j*.18,2.2,5),mat(seed%2?0x686b50:0x777054),g);crown.position.set((j-1)*.15,2.3+j*.72,0)}props.push({group:g,kind:'tree'})}
for(let i=0;i<56;i++)makeTree((i%2?1:-1)*(12+(i*17)%30),-20-i*13,i);
function makeRuin(x,z){const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);box(g,mats.wood,0,1.2,0,7,2.4,4);box(g,mats.soil,0,2.45,0,7.8,.3,4.7);box(g,mats.dark,-1.7,.8,-2.02,1.2,1.6,.1);box(g,mats.dark,1.7,.8,-2.02,1.1,1.1,.1);props.push({group:g,kind:'ruin'})}
makeRuin(25,-105);makeRuin(-30,-260);makeRuin(28,-430);

const bikeRoot=new THREE.Group();scene.add(bikeRoot);const bikeModel=new THREE.Group();bikeRoot.add(bikeModel);
const rearWheel=new THREE.Group();rearWheel.position.set(0,.48,.9);bikeModel.add(rearWheel);const frontWheel=new THREE.Group();frontWheel.position.set(0,.48,-1.12);bikeModel.add(frontWheel);
for(const wheel of [rearWheel,frontWheel]){cylinder(wheel,mats.rubber,0,0,0,.47,.47,.23,'x',20);cylinder(wheel,mats.metal,0,0,0,.24,.24,.25,'x',12);for(let i=0;i<8;i++){const spoke=box(wheel,mats.metal,0,0,0,.035,.38,.025);spoke.rotation.x=i*Math.PI/4}}
cylinder(bikeModel,mats.rust,0,.67,.1,.1,.1,1.75,'x');box(bikeModel,mats.frame,0,.83,.05,.58,.48,.55);box(bikeModel,mats.metal,0,.76,.13,.64,.18,.5);sphere(bikeModel,mats.rust,0,1.13,-.25,.42,.3,.62);box(bikeModel,mats.leather,0,1.18,.38,.58,.16,.53);cylinder(bikeModel,mats.metal,0,1.03,-.94,.07,.07,.96,'z');cylinder(bikeModel,mats.metal,0,1.35,-1.2,.045,.045,.82,'x');
const rider=new THREE.Group();bikeModel.add(rider);rider.position.set(0,1.34,.12);box(rider,mats.leather,0,.28,.05,.62,.75,.38).rotation.x=-.24;sphere(rider,mats.skin,0,.9,-.08,.24,.27,.24);sphere(rider,mats.helmet,0,1.03,-.08,.3,.28,.3);box(rider,mats.white,0,.94,-.32,.3,.09,.04);
for(const s of [-1,1]){box(rider,mats.leather,s*.23,-.17,.35,.2,.56,.22).rotation.x=-.48;box(rider,mats.dark,s*.24,-.35,-.01,.22,.16,.42).rotation.x=-.2;box(rider,mats.leather,s*.35,.43,-.25,.16,.54,.16).rotation.z=s*.16}

const enemies=[],loot=[];
function makeEnemy(z,x){const g=new THREE.Group();scene.add(g);g.position.set(x,0,z);const skin=mat(0x85866a),cloth=mat(Math.random()<.25?0x76513d:0x626353);box(g,cloth,0,1.05,0,.68,.85,.38);sphere(g,skin,0,1.72,-.02,.29,.31,.27);for(const s of [-1,1]){box(g,cloth,s*.47,1.12,-.08,.2,.62,.2).rotation.z=s*.32;box(g,mat(0x34362e),s*.2,.35,.03,.22,.62,.24)}g.userData={hp:Math.random()<.2?3:2,phase:Math.random()*5,attack:0};enemies.push(g)}
function makeLoot(z,x){const g=new THREE.Group();scene.add(g);g.position.set(x,0,z);box(g,mats.wood,0,.38,0,.9,.72,.72);box(g,mats.loot,0,.78,0,.68,.08,.54);mesh(new THREE.OctahedronGeometry(.2),mats.loot,g).position.y=1.15;loot.push(g)}

function log(text){const el=document.createElement('div');el.className='log-line';el.textContent=text;const l=$('log');l.prepend(el);while(l.children.length>3)l.removeChild(l.lastChild)}
function toast(text){log(text)}
function showOverlay(html){$('cardContent').innerHTML=html;$('overlay').hidden=false}
function hideOverlay(){ $('overlay').hidden=true }

function updateUI(){
const hp=Math.max(0,Math.round(health));$('healthNum').textContent=hp;$('healthBar').style.width=hp+'%';$('fuelNum').textContent=Math.round(fuel)+'%';$('fuelBar').style.width=Math.max(0,fuel)+'%';$('bikeNum').textContent=bike?Math.round(bike)+'%':'—';$('bikeBar').style.width=bike+'%';$('distanceLabel').textContent=String(Math.floor(distance)).padStart(3,'0');$('ammoCount').textContent=ammo;$('scrapCount').textContent=inventory.scrap;$('armorValue').textContent=inventory.armor+'%';$('armorDesc').textContent=inventory.armor?'Impact resistance · '+inventory.armor+'% protection':'No armor fitted';$('armorName').textContent=inventory.armor>=30?'Reinforced leathers':'Road leathers';$('armorLevel').textContent=inventory.armor>=45?'III':inventory.armor>=20?'II':'I';
const items=[['⚙','SCR',inventory.scrap,'good'],['🥫','FOOD',inventory.food,''],['◉','WATER',inventory.water,''],['✚','MED',inventory.med,'hot'],['▰','AMMO',ammo,''],['⛽','FUEL',Math.floor(fuel),'good'],['⛨','ARM',inventory.armor?1:0,'good'],['＋','—',0,'empty']];$('inventoryGrid').innerHTML=items.map(([ico,label,n,c])=>'<div class="item '+c+'"><span class="item-label">'+label+'</span>'+ico+'<span class="count">'+n+'</span></div>').join('');$('packCount').textContent=Math.min(12,6+inventory.scrap)+' / 12';$('loadCount').textContent=inventory.scrap>8?'HEAVY':inventory.scrap>4?'PACKED':'LIGHT';$('killsCount').textContent=kills+' THREATS CLEARED';$('regionLabel').textContent=distance<100?'THE OUTSKIRTS':distance<250?'DEADWOOD COUNTY':distance<400?'THE RUST BELT':'PACIFIC COAST';$('dayLabel').textContent='DAY '+String(1+Math.floor(distance/110)).padStart(2,'0');
const idx=distance<100?0:distance<250?1:distance<400?2:3;document.querySelectorAll('.milestone').forEach((m,i)=>m.classList.toggle('active',i===idx));$('milePercent').textContent=Math.floor(distance/5)+'%';
}

function assemblyCard(){const list=PARTS.map(p=>'<button class="part-slot '+(installed[p.id]?'installed':'missing')+'" data-part="'+p.id+'"><span class="slot-icon">'+p.icon+'</span><span class="slot-label">'+p.slot+'</span><span class="slot-state">'+(installed[p.id]?'✓ FITTED':'＋ FIT')+'</span></button>').join('');showOverlay('<div class="card-kicker">STOP 00 &nbsp; / &nbsp; THE GARAGE</div><h2>BUILD YOUR<br>WAY OUT.</h2><p>The coast is five hundred miles west. The dead own the roads. Fit every part to get your engine turning — then keep it turning.</p><div class="assembly-grid">'+list+'</div><div class="assembly-note">FRAME: <b>STANDARD</b> &nbsp; · &nbsp; FITTED '+Object.keys(installed).length+'/6</div><div class="assembly-actions"><button class="primary" id="rideBtn" '+(Object.keys(installed).length<6?'disabled style="opacity:.45;cursor:not-allowed"':'')+'>'+ (Object.keys(installed).length<6?'FIT ALL PARTS TO RIDE':'START THE ENGINE →')+'</button><small>Tap a slot to fit its part</small></div>');
document.querySelectorAll('[data-part]').forEach(b=>b.onclick=()=>{const id=b.dataset.part;if(installed[id])return;installed[id]=true;b.classList.remove('missing');b.classList.add('installed');b.querySelector('.slot-state').textContent='✓ FITTED';document.querySelector('.assembly-note').innerHTML='FRAME: <b>STANDARD</b> &nbsp; · &nbsp; FITTED '+Object.keys(installed).length+'/6';const btn=$('rideBtn');if(Object.keys(installed).length===6){btn.disabled=false;btn.style.opacity='1';btn.style.cursor='pointer';btn.textContent='START THE ENGINE →';toast('All systems fit. She runs.')}updateUI()});$('rideBtn').onclick=()=>{if(Object.keys(installed).length===6)startRide()}}
function startRide(){state='ride';bike=100;hideOverlay();$('sceneTitle').textContent='THE ROAD DOESN’T END';$('objective').innerHTML='<span>YOUR OBJECTIVE</span><b>Ride west. Search every stop. Stay alive.</b>';log('Engine catches. The road is yours.');updateUI()}
function gameEnd(win=false){state='end';const kicker=win?'MILE 500 &nbsp; / &nbsp; THE COAST':'YOUR RIDE ENDS HERE';const heading=win?'YOU MADE IT.':'THE ROAD TAKES ALL.';const story=win?'You crossed the dead country with '+health+' health, '+kills+' threats cleared, and a bike held together by stubbornness.':'You made it '+Math.floor(distance)+' miles. '+kills+" threats won't be following anyone now.";showOverlay('<div class="card-kicker">'+kicker+'</div><h2>'+heading+'</h2><p>'+story+'</p><button class="primary" id="restartBtn">RIDE AGAIN →</button>');$('restartBtn').onclick=()=>location.reload()}

function killEnemy(e){scene.remove(e);const i=enemies.indexOf(e);if(i>=0)enemies.splice(i,1);kills++;if(Math.random()<.7)inventory.scrap++;toast('Target dropped. Road stays clear—for now.');updateUI()}
function fire(){if(state!=='ride'||ammo<=0||shootCooldown>0)return;ammo--;shootCooldown=.38;updateUI();const target=enemies.filter(e=>e.position.z<2&&e.position.z>-42).sort((a,b)=>Math.abs(a.position.x-bikeRoot.position.x)-Math.abs(b.position.x-bikeRoot.position.x))[0];if(target){target.userData.hp--;if(target.userData.hp<=0)killEnemy(target)}}
function swing(){if(state!=='ride'||meleeCooldown>0)return;meleeCooldown=.65;const target=enemies.find(e=>e.position.z<3&&e.position.z>-4&&Math.abs(e.position.x-bikeRoot.position.x)<2.6);if(target){target.userData.hp--;if(target.userData.hp<=0)killEnemy(target);else toast('Wrench connects. Keep moving')}else toast('Wrench swing. Keep them close.')}
function consume(item){if(state!=='ride')return;if(item==='med'&&inventory.med){inventory.med--;health=Math.min(100,health+38);toast('First aid applied. +38 health')}else if(item==='food'&&inventory.food){inventory.food--;health=Math.min(100,health+16);toast('Ate a ration. +16 health')}else if(item==='water'&&inventory.water){inventory.water--;health=Math.min(100,health+10);toast('Water break. +10 health')}else toast('No '+item+' left in your pack.');updateUI()}
function scavenge(){if(state!=='ride')return;if(!lootNearby){toast('No safehouse close enough. Search the roadside stops ahead.');return}const target=loot[0];if(target){scene.remove(target);loot.shift()}lootNearby=false;const roll=Math.random();if(roll<.2){inventory.food++;toast('Found canned food. +1 ration')}else if(roll<.38){inventory.water++;toast('Found clean water. +1 bottle')}else if(roll<.53){inventory.med++;toast('First-aid kit recovered')}else if(roll<.7){const n=2+Math.floor(Math.random()*4);inventory.scrap+=n;toast('Useful parts in the wreck. +'+n+' scrap')}else if(roll<.83){ammo+=4;toast('Ammunition in the glovebox. +4 rounds')}else if(roll<.94){fuel=Math.min(100,fuel+20);toast('Salvaged fuel. +20%')}else{inventory.armor=Math.min(60,inventory.armor+15);toast('Found a reinforced riding vest. Armor +15%')}updateUI()}

function update(dt){elapsed+=dt;shootCooldown=Math.max(0,shootCooldown-dt);meleeCooldown=Math.max(0,meleeCooldown-dt);const riding=state==='ride';const throttle=keys.w||keys.arrowup?1:keys.s||keys.arrowdown?-0.3:.72;const steer=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0);const roadSpeed=riding?Math.max(3,throttle>0?13*throttle:4):0;
if(riding){bikeRoot.position.x=THREE.MathUtils.clamp(bikeRoot.position.x+steer*dt*7,-10,10);bikeRoot.rotation.z=THREE.MathUtils.damp(bikeRoot.rotation.z,-steer*.16,5,dt);rearWheel.rotation.x-=roadSpeed*dt*1.6;frontWheel.rotation.x-=roadSpeed*dt*1.6;distance+=roadSpeed*dt*.105;fuel=Math.max(0,fuel-roadSpeed*dt*.014);bike=Math.max(0,bike-roadSpeed*dt*.00065);if(distance>=500){distance=500;updateUI();gameEnd(true);return}if(distance>=nextEnemyAt&&enemies.length<6){makeEnemy(-70-Math.random()*35,(Math.random()-.5)*12);nextEnemyAt=distance+8+Math.random()*10}if(distance>=nextLootAt){makeLoot(-85-Math.random()*20,(Math.random()<.5?-1:1)*(9+Math.random()*9));nextLootAt=distance+18+Math.random()*10}}
const scroll=roadSpeed*dt;for(const g of roadSegments){g.position.z+=scroll;if(g.position.z>roadLength)g.position.z-=roadSegments.length*roadLength}for(const p of props){p.group.position.z+=scroll;if(p.group.position.z>32){p.group.position.z-=760;p.group.position.x=(p.group.position.x<0?-1:1)*(13+Math.random()*31)}}
lootNearby=false;for(const l of [...loot]){l.position.z+=scroll;l.rotation.y+=dt*.6;if(l.position.z>15){scene.remove(l);loot.splice(loot.indexOf(l),1);continue}if(Math.abs(l.position.z)<7&&Math.abs(l.position.x-bikeRoot.position.x)<15)lootNearby=true}
for(const e of [...enemies]){e.position.z+=scroll+dt*(2+distance*.002);e.position.x+=Math.sin(elapsed*1.4+e.userData.phase)*dt*.35;if(e.position.z>14){scene.remove(e);enemies.splice(enemies.indexOf(e),1);continue}if(Math.abs(e.position.z)<2.5&&Math.abs(e.position.x-bikeRoot.position.x)<1.9){e.userData.attack-=dt;if(e.userData.attack<=0){e.userData.attack=1.35;health=Math.max(0,health-(e.userData.hp>=3?10:6)*(1-inventory.armor/130));bike=Math.max(0,bike-1);toast('The dead grab at your jacket.');updateUI();if(health<=0){gameEnd();return}}}}
if(lootNearby)$('objective').innerHTML='<span>NEARBY STOP · PRESS E</span><b>Search the roadside stash.</b>';else if(riding&&$('objective').textContent.includes('NEARBY'))$('objective').innerHTML='<span>YOUR OBJECTIVE</span><b>Ride west. Search every stop. Stay alive.</b>';
const desired=new THREE.Vector3(bikeRoot.position.x*.56,4,8.8);camera.position.lerp(desired,1-Math.exp(-dt*3.2));camera.lookAt(bikeRoot.position.x*.55,1.05,-14)}

function resize(){const r=viewport.getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix()}new ResizeObserver(resize).observe(viewport);resize();
function frame(now){const dt=Math.min(.05,(now-(frame.last||now))/1000);frame.last=now;update(dt);renderer.render(scene,camera);if(state==='ride'&&elapsed-lastUI>.5){lastUI=elapsed;updateUI()}requestAnimationFrame(frame)}requestAnimationFrame(frame);
window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();keys[k]=true;if(k==='e')scavenge();if(k===' ')swing();if(k==='f'||k==='j')fire();if(k==='1')consume('food');if(k==='2')consume('water');if(k==='3')consume('med')});window.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);canvas.addEventListener('pointerdown',e=>{if(e.button===0)fire()});$('soundBtn').onclick=()=>{muted=!muted;$('soundBtn').textContent='SOUND '+(muted?'OFF':'ON')};

document.querySelectorAll('.mobile-controls button').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();const a=b.dataset.action;if(a==='fire')fire();else if(a==='melee')swing();else if(a==='search')scavenge();else if(a==='item')consume(inventory.med?'med':inventory.food?'food':'water')}));
const joystick=$('joystick'),stick=$('stick');let joyPointer=null;function moveStick(e){const r=joystick.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),lim=r.width*.31,len=Math.hypot(dx,dy)||1,m=Math.min(lim,len);stick.style.transform='translate('+dx/len*m+'px,'+dy/len*m+'px)';keys.a=dx<-12;keys.d=dx>12;keys.w=dy<-18;keys.s=dy>22}joystick.addEventListener('pointerdown',e=>{e.preventDefault();joyPointer=e.pointerId;joystick.setPointerCapture(joyPointer);moveStick(e)});joystick.addEventListener('pointermove',e=>{if(e.pointerId===joyPointer)moveStick(e)});function endJoy(){joyPointer=null;keys.a=keys.d=keys.w=keys.s=false;stick.style.transform=''}joystick.addEventListener('pointerup',endJoy);joystick.addEventListener('pointercancel',endJoy);
$('inventoryGrid').addEventListener('click',e=>{const item=e.target.closest('.item');if(!item)return;const label=item.querySelector('.item-label')?.textContent;if(label==='FOOD')consume('food');if(label==='WATER')consume('water');if(label==='MED')consume('med')});$('objective').addEventListener('click',()=>{if(state==='ride'&&lootNearby)scavenge()});
assemblyCard();updateUI();log('Six parts. One working road bike.');log('Fit the pieces, then ride into the open world.');
})();
