// PATANG_VERSION: 2.2.1
// LAST_MAJOR_CHANGE: Fix v2.2 frozen RAF regression; harden RAF/layout/assets/audio guards
"use strict";

const canvas=document.getElementById("gameCanvas");
const ctx=canvas.getContext("2d");
const sceneImage=new Image();
const layout={handX:0,handY:0,kiteMinX:0,kiteMaxX:0,kiteMinY:0,kiteMaxY:0,stringWidth:1,sceneX:0,sceneY:0,sceneW:0,sceneH:0,play:{},dheel:{},khench:{},pause:{}};
const prompts=[];
const player={x:0,y:0,vx:80,vy:0,rotation:0,direction:1};
const ai={x:0,y:0,vx:0,vy:0,rotation:0,state:"neutral",diveTime:0,nextDive:12,hit:false};
const ambient={rustle:null,rustleFilter:null,rustleGain:null,rustleLfo:null,rustleLfoGain:null,water:null,waterFilter:null,waterGain:null,waterLfo:null,waterLfoGain:null,bird:0,wash:0,splash:0,bellRing:0,horn:0,vendor:0,kids:0,temple:0};
let assetsReady=false,assetError=false,mode="home",paused=false,level=1,timer=58,tension=.25,zone="green",clock=0,last=performance.now(),audioCtx=null,levelCutTriggered=false;

// Return canvas width.
function W(){
  return canvas.width;
}

// Return canvas height.
function H(){
  return canvas.height;
}

// Clamp a value.
function clamp(v,a,b){
  return Math.max(a,Math.min(b,v));
}

// Hide all legacy DOM interaction.
function hideLegacyDom(){
  const ids=["startScreen","levelScreen","pauseModal","resultModal","hud","statusBar"];
  for(let i=0;i<ids.length;i+=1){
    const n=document.getElementById(ids[i]);
    if(n){n.classList.add("hidden");n.style.pointerEvents="none";}
  }
}

// Resize the canvas drawing buffer.
function resizeCanvas(){
  canvas.width=Math.max(1,innerWidth);
  canvas.height=Math.max(1,innerHeight);
  canvas.style.width=innerWidth+"px";
  canvas.style.height=innerHeight+"px";
  recomputeLayout();
}

// Poll resize every RAF frame.
function pollCanvasSize(){
  if(canvas.width!==innerWidth||canvas.height!==innerHeight){resizeCanvas();}
}

// Recompute anchors and hit zones.
function recomputeLayout(){
  if(canvas.width===0||canvas.height===0){return;}
  const sceneAspect=1536/864;
  const canvasAspect=canvas.width/canvas.height;
  layout.handX=canvas.width*.47;
  layout.handY=canvas.height*.60;
  layout.kiteMinX=canvas.width*.10;
  layout.kiteMaxX=canvas.width*.90;
  layout.kiteMinY=canvas.height*.16;
  layout.kiteMaxY=canvas.height*.52;
  if(canvasAspect<sceneAspect){
    layout.sceneH=canvas.height;
    layout.sceneW=canvas.height*sceneAspect;
    layout.sceneX=(canvas.width-layout.sceneW)/2;
    layout.sceneY=0;
  }else{
    layout.sceneW=canvas.width;
    layout.sceneH=canvas.width/sceneAspect;
    layout.sceneX=0;
    layout.sceneY=(canvas.height-layout.sceneH)/2;
  }
  layout.stringWidth=1/window.devicePixelRatio;
  layout.play={x:W()*.5-92,y:H()*.68-31,w:184,h:62};
  layout.dheel={x:W()*.06,y:H()*.88,w:140,h:70};
  layout.khench={x:W()*.56,y:H()*.88,w:140,h:70};
  layout.pause={x:W()-54,y:14,w:40,h:40};
  if(mode==="home"){resetPlayer();resetAI();}
}

// Handle scene load.
function sceneLoaded(){
  assetsReady=true;
  assetError=false;
  console.log('scene loaded, assetsReady = true');
}

// Handle scene error.
function sceneFailed(){
  assetsReady=false;
  assetError=true;
}

// Load the only image asset.
function loadScene(){
  sceneImage.onload=sceneLoaded;
  sceneImage.onerror=sceneFailed;
  sceneImage.src="public/assets/scene.png";
}

// Return level duration.
function levelDuration(n){
  return Math.max(20,60-n*2);
}

// Reset player to center sky.
function resetPlayer(){
  player.x=W()*.62;player.y=H()*.28;player.vx=80;player.vy=0;player.rotation=0;player.direction=1;
}

// Reset AI to neutral sky.
function resetAI(){
  ai.x=W()*.30;ai.y=H()*.22;ai.vx=-40;ai.vy=0;ai.rotation=0;ai.state="neutral";ai.diveTime=0;ai.hit=false;ai.nextDive=clock+10+Math.random()*5;
}

// Start gameplay.
function startGame(){
  if(!assetsReady){return;}
  mode="playing";paused=false;timer=levelDuration(level);tension=.25;zone="green";clock=0;levelCutTriggered=false;prompts.length=0;
  resetPlayer();resetAI();scheduleAmbient();startAmbience();
}

// Log every sound trigger.
function logSfx(name){
  console.log("SFX:",name,"ctx=",audioCtx?audioCtx.state:"null");
}

// Play a self-cleaning oscillator tone.
function tone(name,type,hz,duration,gainValue,endHz,delay){
  logSfx(name);
  if(!audioCtx||audioCtx.state!=="running"){return;}
  const start=audioCtx.currentTime+(delay||0);
  const o=audioCtx.createOscillator();
  const g=audioCtx.createGain();
  o.type=type;o.frequency.setValueAtTime(hz,start);
  if(endHz){o.frequency.exponentialRampToValueAtTime(endHz,start+duration);}
  g.gain.setValueAtTime(gainValue,start);g.gain.exponentialRampToValueAtTime(.0001,start+duration);
  o.connect(g);g.connect(audioCtx.destination);
  o.onended=function toneEnded(){o.disconnect();g.disconnect();};
  o.start(start);o.stop(start+duration);
}

// Create white or brown noise.
function noiseBuffer(seconds,brown){
  const length=Math.max(1,Math.floor(audioCtx.sampleRate*seconds));
  const b=audioCtx.createBuffer(1,length,audioCtx.sampleRate);
  const d=b.getChannelData(0);
  let prev=0;
  for(let i=0;i<length;i+=1){
    const white=Math.random()*2-1;
    prev=brown?(prev+.02*white)/1.02:white;
    d[i]=brown?prev*3.5:white;
  }
  return b;
}

// Play DHEEL whoosh.
function sfxDheel(){
  if(!audioCtx){return;}
  logSfx("dheel");
  if(!audioCtx||audioCtx.state!=="running"){return;}
  const now=audioCtx.currentTime,s=audioCtx.createBufferSource(),f=audioCtx.createBiquadFilter(),g=audioCtx.createGain();
  s.buffer=noiseBuffer(.09,false);f.type="bandpass";f.frequency.value=800;f.Q.value=.8;
  g.gain.setValueAtTime(.18,now);g.gain.exponentialRampToValueAtTime(.0001,now+.08);
  s.connect(f);f.connect(g);g.connect(audioCtx.destination);
  s.onended=function dheelEnded(){s.disconnect();f.disconnect();g.disconnect();};
  s.start(now);s.stop(now+.08);
}

// Play KHENCH pluck.
function sfxKhench(){
  if(!audioCtx){return;}
  tone("khench","triangle",220,.10,.18,null,0);
}

// Play KAT GAI snap.
function sfxKatGai(){
  if(!audioCtx){return;}
  tone("kat gai 400","square",400,.06,.16,null,0);
  tone("kat gai 600","square",600,.06,.16,null,.065);
}

// Play MANJA GAYA twang.
function sfxManja(){
  if(!audioCtx){return;}
  logSfx("manja gaya");
  if(!audioCtx||audioCtx.state!=="running"){return;}
  const now=audioCtx.currentTime,o=audioCtx.createOscillator(),v=audioCtx.createOscillator(),vg=audioCtx.createGain(),g=audioCtx.createGain();
  o.type="sine";o.frequency.value=180;v.type="sine";v.frequency.value=5;vg.gain.value=7;
  g.gain.setValueAtTime(.18,now);g.gain.exponentialRampToValueAtTime(.0001,now+.30);
  v.connect(vg);vg.connect(o.frequency);o.connect(g);g.connect(audioCtx.destination);
  o.onended=function manjaEnded(){o.disconnect();v.disconnect();vg.disconnect();g.disconnect();};
  o.start(now);v.start(now);o.stop(now+.30);v.stop(now+.30);
}

// Play yellow warning pulse.
function sfxYellow(){
  if(!audioCtx){return;}
  tone("yellow warning","sine",80,.15,.04,null,0);
}

// Play red danger pulse.
function sfxRed(){
  if(!audioCtx){return;}
  tone("red danger","sine",120,.12,.06,null,0);
}

// Play level-clear chime.
function sfxClear(){
  if(!audioCtx){return;}
  tone("level clear C5","sine",523,.20,.12,null,0);
  tone("level clear E5","sine",659,.20,.12,null,.21);
}

// Play level-fail descent.
function sfxFail(){
  if(!audioCtx){return;}
  tone("level fail G4","triangle",392,.20,.10,null,0);
  tone("level fail C4","triangle",261,.20,.10,null,.21);
}

// Play sparrow chirp.
function sfxBird(){
  if(!audioCtx){return;}
  tone("sparrow","sine",2500,.08,.04,3500,0);
}

// Play a filtered noise burst.
function noiseBurst(name,duration,gainValue,filterType,frequency){
  logSfx(name);
  if(!audioCtx||audioCtx.state!=="running"){return;}
  const now=audioCtx.currentTime;
  const source=audioCtx.createBufferSource();
  const filter=audioCtx.createBiquadFilter();
  const gain=audioCtx.createGain();
  source.buffer=noiseBuffer(duration,false);
  filter.type=filterType;
  filter.frequency.value=frequency;
  gain.gain.setValueAtTime(gainValue,now);
  gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  source.onended=function noiseBurstEnded(){source.disconnect();filter.disconnect();gain.disconnect();};
  source.start(now);
  source.stop(now+duration);
}

// Play dhobi-ghat washing slap.
function sfxWash(){
  if(!audioCtx){return;}
  noiseBurst("dhobi wash",.12,.025,"bandpass",700);
}

// Play dhobi-ghat splash.
function sfxSplash(){
  if(!audioCtx){return;}
  noiseBurst("water splash",.18,.02,"highpass",900);
}

// Play cow or bull neck bells.
function sfxNeckBell(){
  if(!audioCtx){return;}
  tone("neck bell 800","sine",800,.4,.03,null,0);
  tone("neck bell 1200","sine",1200,.4,.02,null,.01);
  tone("neck bell 1600","sine",1600,.4,.015,null,.02);
}

// Play distant car horn.
function sfxHorn(){
  if(!audioCtx){return;}
  tone("car horn 350","sine",350,.2,.02,null,0);
  tone("car horn 440","sine",440,.2,.02,null,.2);
}

// Play muffled vendor call.
function sfxVendor(){
  if(!audioCtx){return;}
  logSfx("vendor call");
  if(!audioCtx||audioCtx.state!=="running"){return;}
  const now=audioCtx.currentTime;
  const oscillator=audioCtx.createOscillator();
  const filter=audioCtx.createBiquadFilter();
  const gain=audioCtx.createGain();
  oscillator.type="sine";
  oscillator.frequency.value=200;
  filter.type="lowpass";
  filter.frequency.value=350;
  gain.gain.setValueAtTime(.015,now);
  gain.gain.exponentialRampToValueAtTime(.0001,now+.9);
  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  oscillator.onended=function vendorEnded(){oscillator.disconnect();filter.disconnect();gain.disconnect();};
  oscillator.start(now);
  oscillator.stop(now+.9);
}

// Play kids shouting.
function sfxKids(){
  if(!audioCtx){return;}
  tone("kids 300","triangle",300,.2,.02,null,0);
  tone("kids 500","triangle",500,.2,.02,null,0);
}

// Play temple bell.
function sfxTempleBell(){
  if(!audioCtx){return;}
  tone("temple bell","sine",528,2,.015,null,0);
}

// Start continuous rustling trees and flowing water.
function startAmbience(){
  if(!audioCtx||audioCtx.state!=="running"||ambient.rustle||paused||mode!=="playing"){return;}
  const now=audioCtx.currentTime;
  const rustle=audioCtx.createBufferSource();
  const rustleFilter=audioCtx.createBiquadFilter();
  const rustleGain=audioCtx.createGain();
  const rustleLfo=audioCtx.createOscillator();
  const rustleLfoGain=audioCtx.createGain();
  rustle.buffer=noiseBuffer(3,true);
  rustle.loop=true;
  rustleFilter.type="lowpass";
  rustleFilter.frequency.value=500;
  rustleGain.gain.value=.03;
  rustleLfo.frequency.value=.12;
  rustleLfoGain.gain.value=.01;
  rustle.connect(rustleFilter);
  rustleFilter.connect(rustleGain);
  rustleGain.connect(audioCtx.destination);
  rustleLfo.connect(rustleLfoGain);
  rustleLfoGain.connect(rustleGain.gain);
  rustle.start(now);
  rustleLfo.start(now);
  ambient.rustle=rustle;
  ambient.rustleFilter=rustleFilter;
  ambient.rustleGain=rustleGain;
  ambient.rustleLfo=rustleLfo;
  ambient.rustleLfoGain=rustleLfoGain;

  const water=audioCtx.createBufferSource();
  const waterFilter=audioCtx.createBiquadFilter();
  const waterGain=audioCtx.createGain();
  const waterLfo=audioCtx.createOscillator();
  const waterLfoGain=audioCtx.createGain();
  water.buffer=noiseBuffer(3,false);
  water.loop=true;
  waterFilter.type="highpass";
  waterFilter.frequency.value=1000;
  waterGain.gain.value=.02;
  waterLfo.frequency.value=.08;
  waterLfoGain.gain.value=.006;
  water.connect(waterFilter);
  waterFilter.connect(waterGain);
  waterGain.connect(audioCtx.destination);
  waterLfo.connect(waterLfoGain);
  waterLfoGain.connect(waterGain.gain);
  water.start(now);
  waterLfo.start(now);
  ambient.water=water;
  ambient.waterFilter=waterFilter;
  ambient.waterGain=waterGain;
  ambient.waterLfo=waterLfo;
  ambient.waterLfoGain=waterLfoGain;
}

// Stop continuous village ambience.
function stopAmbience(){
  const sources=["rustle","rustleLfo","water","waterLfo"];
  for(let i=0;i<sources.length;i+=1){
    const node=ambient[sources[i]];
    if(node){try{node.stop();}catch(error){}node.disconnect();ambient[sources[i]]=null;}
  }
  const nodes=["rustleFilter","rustleGain","rustleLfoGain","waterFilter","waterGain","waterLfoGain"];
  for(let i=0;i<nodes.length;i+=1){
    const node=ambient[nodes[i]];
    if(node){node.disconnect();ambient[nodes[i]]=null;}
  }
}

// Schedule all village ambience from the RAF clock.
function scheduleAmbient(){
  ambient.bird=clock+1.5+Math.random()*2.5;
  ambient.wash=clock+1;
  ambient.splash=clock+2;
  ambient.bellRing=clock+4+Math.random()*4;
  ambient.horn=clock+20+Math.random()*20;
  ambient.vendor=clock+30+Math.random()*30;
  ambient.kids=clock+10+Math.random()*15;
  ambient.temple=clock+60+Math.random()*60;
}

// Update all intermittent village ambience from RAF time.
function updateAmbient(){
  if(!audioCtx){return;}
  if(clock>=ambient.bird){sfxBird();ambient.bird=clock+1.5+Math.random()*2.5;}
  if(clock>=ambient.wash){sfxWash();ambient.wash=clock+1;}
  if(clock>=ambient.splash){sfxSplash();ambient.splash=clock+2;}
  if(clock>=ambient.bellRing){sfxNeckBell();ambient.bellRing=clock+4+Math.random()*4;}
  if(clock>=ambient.horn){sfxHorn();ambient.horn=clock+20+Math.random()*20;}
  if(clock>=ambient.vendor){sfxVendor();ambient.vendor=clock+30+Math.random()*30;}
  if(clock>=ambient.kids){sfxKids();ambient.kids=clock+10+Math.random()*15;}
  if(clock>=ambient.temple){sfxTempleBell();ambient.temple=clock+60+Math.random()*60;}
}

// Queue a canvas prompt.
function prompt(text,color,size,duration){
  prompts.push({text:text,color:color,fontSize:size,timeLeft:duration,duration:duration});
}

// Update prompt timers.
function updatePrompts(dt){
  for(let i=prompts.length-1;i>=0;i-=1){
    prompts[i].timeLeft-=dt;
    if(prompts[i].timeLeft<=0){prompts.splice(i,1);}
  }
}

// Apply DHEEL tap.
function doDheel(){
  if(mode!=="playing"||paused){return;}
  player.vy=-180;tension=clamp(tension-.04,0,1);sfxDheel();prompt("DHEEL","#00BFFF",26,.8);
}

// Apply KHENCH tap.
function doKhench(){
  if(mode!=="playing"||paused){return;}
  player.vy=180;tension=clamp(tension-.06,0,1);sfxKhench();prompt("KHENCH","#FF3B30",26,.8);
}

// Toggle pause and ambient.
function togglePause(){
  if(mode!=="playing"){return;}
  paused=!paused;
  if(paused){stopAmbience();}else{startAmbience();scheduleAmbient();}
}

// Convert pointer to canvas pixels.
function pointerPoint(e){
  const r=canvas.getBoundingClientRect();
  return{x:(e.clientX-r.left)*(canvas.width/r.width),y:(e.clientY-r.top)*(canvas.height/r.height)};
}

// Test rectangle hit.
function hit(p,z){
  const pad=(z===layout.dheel||z===layout.khench)?6:0;
  return p.x>=z.x-pad&&p.x<=z.x+z.w+pad&&p.y>=z.y-pad&&p.y<=z.y+z.h+pad;
}

// Handle the sole pointer interaction.
function handlePointerDown(e){
  if(!audioCtx){
    const AudioConstructor=window.AudioContext||window.webkitAudioContext;
    if(AudioConstructor){audioCtx=new AudioConstructor();}
  }
  if(audioCtx&&audioCtx.state==="suspended"){audioCtx.resume();}
  console.log("AUDIO: ctx state = "+(audioCtx?audioCtx.state:"unavailable"));
  e.preventDefault();
  const p=pointerPoint(e);
  if(mode==="home"&&hit(p,layout.play)){startGame();return;}
  if(mode!=="playing"){return;}
  if(hit(p,layout.pause)){togglePause();return;}
  if(!paused&&hit(p,layout.dheel)){doDheel();return;}
  if(!paused&&hit(p,layout.khench)){doKhench();}
}

// Decay vertical velocity toward zero.
function decayVy(dt){
  const d=120*dt;
  if(player.vy>0){player.vy=Math.max(0,player.vy-d);}
  else if(player.vy<0){player.vy=Math.min(0,player.vy+d);}
}

// Update player physics.
function updatePlayer(dt){
  if(player.x<=layout.kiteMinX){player.direction=1;}
  else if(player.x>=layout.kiteMaxX){player.direction=-1;}
  const magnitude=60+20*Math.abs(Math.sin(clock*.62));
  const target=player.direction*magnitude;
  player.vx+=(target-player.vx)*(1-Math.exp(-dt*3.5));
  decayVy(dt);
  player.x=clamp(player.x+player.vx*dt,layout.kiteMinX,layout.kiteMaxX);
  player.y=clamp(player.y+player.vy*dt,layout.kiteMinY,layout.kiteMaxY);
  player.rotation=Math.atan2(player.vy,player.vx);
}

// Begin AI dive.
function beginDive(){
  ai.state="dive";ai.diveTime=0;ai.hit=false;
}

// Update AI state and physics.
function updateAI(dt){
  if(ai.state==="neutral"&&clock>=ai.nextDive){beginDive();}
  if(ai.state==="dive"){
    ai.diveTime+=dt;
    const dx=player.x-ai.x,dy=player.y-ai.y,d=Math.max(1,Math.hypot(dx,dy));
    ai.vx=dx/d*180;ai.vy=dy/d*180;
    if(d<50&&!ai.hit){tension=clamp(tension+.30,0,1);ai.hit=true;}
    if(ai.diveTime>=1.2){ai.state="return";}
  }else{
    const nx=W()*.30,ny=H()*.22,dx=nx-ai.x,dy=ny-ai.y,d=Math.max(1,Math.hypot(dx,dy));
    ai.vx=50*Math.sin(clock*.42+1.4)+(dx/d)*35;
    ai.vy=30*Math.sin(clock*.70)+(dy/d)*25;
    if(ai.state==="return"&&d<28){ai.state="neutral";ai.nextDive=clock+10+Math.random()*5;}
  }
  ai.x=clamp(ai.x+ai.vx*dt,layout.kiteMinX,layout.kiteMaxX);
  ai.y=clamp(ai.y+ai.vy*dt,layout.kiteMinY,layout.kiteMaxY);
  ai.rotation=Math.atan2(ai.vy,ai.vx);
}

// Fire KAT GAI at most once in the current level.
function cutKite(){
  if(levelCutTriggered){tension=1;return;}
  levelCutTriggered=true;
  sfxKatGai();
  prompt("KAT GAI!","#FF0000",38,1.2);
  tension=.25;
  zone="green";
}

// Update danger tension.
function updateTension(dt){
  const y=player.y/H();
  tension+=.015*dt;
  if(y<.15){tension+=.35*dt;}
  else if(y>.40){tension+=.30*dt;}
  else{tension-=.20*dt;}
  tension=clamp(tension,0,1);
  const next=tension>=.85?"red":tension>=.65?"yellow":"green";
  if(next!==zone){
    if(next==="yellow"){sfxYellow();prompt("SAVADHAN","#FFD700",26,.8);}
    if(next==="red"){sfxRed();prompt("KHATRA","#FF4500",26,.8);}
    zone=next;
  }
  if(tension>=1){cutKite();}
}

// Clear and advance level.
function clearLevel(){
  sfxClear();
  prompt("LEVEL CLEAR","#00FF00",38,1.2);
  level+=1;
  timer=levelDuration(level);
  tension=.25;
  zone="green";
  levelCutTriggered=false;
  resetPlayer();
  resetAI();
}

// Update game state.
function update(dt){
  updatePrompts(dt);
  if(mode!=="playing"||paused){return;}
  clock+=dt;timer-=dt;
  updatePlayer(dt);updateAI(dt);updateTension(dt);updateAmbient();
  if(timer<=0){clearLevel();}
}

// Draw warm fallback.
function drawFallback(){
  ctx.fillStyle="#C88A4A";ctx.fillRect(0,0,W(),H());
  ctx.fillStyle="#fff";ctx.font="700 16px Arial";ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.fillText(assetError?"Scene unavailable":"Loading scene…",W()/2,H()/2);
}

// Draw scene with cover fit.
function drawScene(){
  ctx.fillStyle="#C88A4A";
  ctx.fillRect(0,0,W(),H());
  if(!assetsReady){drawFallback();return;}
  ctx.drawImage(sceneImage,layout.sceneX,layout.sceneY,layout.sceneW,layout.sceneH);
}

// Draw dark hairline string.
function drawString(){
  ctx.save();ctx.lineWidth=layout.stringWidth;ctx.strokeStyle="rgba(30, 15, 5, 0.85)";ctx.shadowBlur=0;
  ctx.beginPath();ctx.moveTo(layout.handX,layout.handY);ctx.lineTo(player.x,player.y);ctx.stroke();ctx.restore();
}

// Draw shared diamond kite.
function drawKite(x,y,size,rotation,fillColor,outlineColor,glow){
  ctx.save();ctx.translate(x,y);ctx.rotate(rotation);
  if(glow){
    const g=ctx.createRadialGradient(0,0,size*.25,0,0,size+20);
    g.addColorStop(0,"rgba(255,20,147,.32)");g.addColorStop(1,"rgba(255,20,147,0)");
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,size+20,0,Math.PI*2);ctx.fill();
  }
  ctx.beginPath();ctx.moveTo(0,-size);ctx.lineTo(size*.72,0);ctx.lineTo(0,size);ctx.lineTo(-size*.72,0);ctx.closePath();
  ctx.fillStyle=fillColor;ctx.fill();ctx.strokeStyle=outlineColor;ctx.lineWidth=glow?3:2;ctx.stroke();ctx.restore();
}

// Draw AI dive ghost copies.
function drawAIGhosts(size){
  if(ai.state!=="dive"){return;}
  const speed=Math.max(1,Math.hypot(ai.vx,ai.vy)),ux=ai.vx/speed,uy=ai.vy/speed;
  ctx.save();ctx.globalAlpha=.5;drawKite(ai.x-ux*28,ai.y-uy*28,size,ai.rotation,"#7B2FBE","#4CAF50",false);
  ctx.globalAlpha=.8;drawKite(ai.x-ux*14,ai.y-uy*14,size,ai.rotation,"#7B2FBE","#4CAF50",false);ctx.restore();
}

// Draw AI kite.
function drawAI(){
  const size=W()*.055;drawAIGhosts(size);drawKite(ai.x,ai.y,size,ai.rotation,"#7B2FBE","#4CAF50",false);
}

// Draw player kite.
function drawPlayer(){
  drawKite(player.x,player.y,W()*.07,player.rotation,"#FF1493","#FFFFFF",true);
}

// Draw HUD pill.
function pill(x,y,w,text){
  ctx.fillStyle="#1a2340";ctx.beginPath();ctx.roundRect(x,y,w,40,20);ctx.fill();
  ctx.fillStyle="#fff";ctx.font="700 15px Arial";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(text,x+w/2,y+20);
}

// Format timer.
function formatTime(seconds){
  const n=Math.max(0,Math.ceil(seconds)),m=Math.floor(n/60),s=n%60;
  return String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
}

// Draw top HUD row.
function drawHUD(){
  pill(12,12,72,"L"+level);pill(W()/2-50,12,100,formatTime(timer));
  ctx.fillStyle="#1a2340";ctx.beginPath();ctx.roundRect(layout.pause.x,layout.pause.y,40,40,12);ctx.fill();
  ctx.fillStyle="#fff";ctx.fillRect(layout.pause.x+12,layout.pause.y+10,5,20);ctx.fillRect(layout.pause.x+23,layout.pause.y+10,5,20);
}

// Draw danger bar.
function drawDangerBar(){
  const y=H()*.115;
  ctx.fillStyle="#4CAF50";ctx.fillRect(0,y,W()*.65,10);
  ctx.fillStyle="#FFC107";ctx.fillRect(W()*.65,y,W()*.20,10);
  ctx.fillStyle="#F44336";ctx.fillRect(W()*.85,y,W()*.15,10);
  ctx.fillStyle="#fff";ctx.fillRect(clamp(tension*W()-1.5,0,W()-3),y-3,3,16);
}

// Draw high-contrast prompts.
function drawPrompts(){
  for(let i=0;i<prompts.length;i+=1){
    const p=prompts[i];
    const alpha=clamp(p.timeLeft/Math.min(.25,p.duration),0,1);
    ctx.save();
    ctx.globalAlpha=alpha;
    ctx.font="900 "+p.fontSize+"px 'Arial Black',sans-serif";
    ctx.textAlign="center";
    ctx.textBaseline="middle";
    ctx.lineWidth=4;
    ctx.strokeStyle="#000";
    ctx.shadowColor="#000";
    ctx.shadowBlur=8;
    ctx.strokeText(p.text,W()*.5,H()*.20);
    ctx.fillStyle=p.color;
    ctx.fillText(p.text,W()*.5,H()*.20);
    ctx.restore();
  }
}

// Draw one rounded rectangular control.
function control(rect,fill,arrow,label){
  ctx.save();
  ctx.fillStyle=fill;
  ctx.strokeStyle="#fff";
  ctx.lineWidth=2;
  ctx.beginPath();
  ctx.roundRect(rect.x,rect.y,rect.w,rect.h,8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle="#fff";
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.font="700 22px Arial";
  ctx.fillText(arrow+" "+label,rect.x+rect.w/2,rect.y+rect.h/2);
  ctx.restore();
}

// Draw bottom controls.
function drawControls(){
  control(layout.dheel,"#2196F3","↑","DHEEL");
  control(layout.khench,"#E53935","↓","KHENCH");
}

// Draw canvas home.
function drawHome(){
  ctx.fillStyle="rgba(26,35,64,.72)";ctx.fillRect(0,0,W(),H());ctx.fillStyle="#fff";ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.font="900 52px 'Arial Black',Arial";ctx.fillText("PATANG",W()*.5,H()*.38);
  ctx.fillStyle=assetsReady?"#FFC107":"#777";ctx.beginPath();ctx.roundRect(layout.play.x,layout.play.y,layout.play.w,layout.play.h,20);ctx.fill();
  ctx.fillStyle="#1a2340";ctx.font="900 20px Arial";ctx.fillText(assetsReady?"PLAY":"LOADING…",W()*.5,layout.play.y+layout.play.h/2);
}

// Render exact mandated stack.
function drawFrame(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawScene();
  if(mode==="home"){drawHome();return;}
  drawString();
  drawAI();
  drawPlayer();
  drawHUD();
  drawDangerBar();
  drawPrompts();
  drawControls();
}

// Main RAF loop.
function gameLoop(now){
  try{
    pollCanvasSize();
    const dt=Math.min(.033,(now-last)/1000||0);
    last=now;
    update(dt);
    drawFrame();
  }catch(err){
    console.error('RAF tick error:',err);
  }
  requestAnimationFrame(gameLoop);
}

// Pause when page is hidden.
function visibilityChanged(){
  if(document.hidden&&mode==="playing"&&!paused){paused=true;stopAmbience();}
}

// Bind canvas pointer input.
function bindEvents(){
  canvas.addEventListener("pointerdown",handlePointerDown,{passive:false});
  document.addEventListener("visibilitychange",visibilityChanged);
}

// Initialize rebuilt game.
function init(){
  hideLegacyDom();resizeCanvas();loadScene();bindEvents();requestAnimationFrame(gameLoop);
}

init();
