// PATANG_VERSION: 2.5.0
// LAST_MAJOR_CHANGE: HTML audio playback replaces Web Audio entirely, debug line removed
"use strict";

const canvas=document.getElementById("gameCanvas");
const ctx=canvas.getContext("2d");
const sceneImage=new Image();
const layout={handX:0,handY:0,kiteMinX:0,kiteMaxX:0,kiteMinY:0,kiteMaxY:0,stringWidth:1,sceneX:0,sceneY:0,sceneW:0,sceneH:0,play:{},dheel:{},khench:{},pause:{}};
const prompts=[];
const reward={active:false,time:0,x:0,y:0,particles:[]};
const player={x:0,y:0,vx:80,vy:0,rotation:0,direction:1};
const ai={x:0,y:0,vx:0,vy:0,rotation:0,state:"neutral",diveTime:0,nextDive:12,hit:false};
const ambient={bird:0,crow:0};
let assetsReady=false,assetError=false,mode="home",paused=false,level=1,timer=58,tension=.25,zone="green",clock=0,last=performance.now(),levelCutTriggered=false,rewardTriggered=false;
let audioWater=null;
let audioSparrow=null;
let audioCrow=null;
let audioPluck=null;

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
  layout.handX=layout.sceneX+.53*layout.sceneW;
  layout.handY=layout.sceneY+.60*layout.sceneH;
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
  mode="playing";paused=false;timer=levelDuration(level);tension=.25;zone="green";clock=0;levelCutTriggered=false;rewardTriggered=false;reward.active=false;prompts.length=0;
  resetPlayer();resetAI();scheduleAmbient();startAmbience();
}

// Initialize HTML audio elements on the first user gesture.
function initAudio(){
  if(audioWater){return;}
  audioWater=new Audio("public/assets/water.mp3");
  audioWater.loop=true;
  audioWater.volume=.35;
  audioSparrow=new Audio("public/assets/sparrow.mp3");
  audioSparrow.volume=.55;
  audioCrow=new Audio("public/assets/crow.mp3");
  audioCrow.volume=.55;
  audioPluck=new Audio("public/assets/pluck.mp3");
  audioPluck.volume=.60;
  audioWater.play().catch(function ignoreWaterPlay(){});
}

// Play the shared pluck asset at a selected rate.
function playPluck(rate){
  if(!audioPluck){return;}
  audioPluck.currentTime=0;
  audioPluck.playbackRate=rate;
  audioPluck.play().catch(function ignorePluckPlay(){});
}

// Pause looping water.
function stopAmbience(){
  if(audioWater){audioWater.pause();}
}

// Resume looping water.
function startAmbience(){
  if(audioWater&&!paused){audioWater.play().catch(function ignoreWaterResume(){});}
}

// Schedule sparrows and crows from the RAF clock.
function scheduleAmbient(){
  ambient.bird=clock+3+Math.random()*4;
  ambient.crow=clock+8+Math.random()*12;
}

// Update HTML ambience from RAF time.
function updateAmbient(){
  if(clock>=ambient.bird){
    if(audioSparrow){audioSparrow.currentTime=0;audioSparrow.play().catch(function ignoreSparrowPlay(){});}
    ambient.bird=clock+3+Math.random()*4;
  }
  if(clock>=ambient.crow){
    if(audioCrow){audioCrow.currentTime=0;audioCrow.play().catch(function ignoreCrowPlay(){});}
    ambient.crow=clock+8+Math.random()*12;
  }
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
  player.vy=-180;tension=clamp(tension-.04,0,1);playPluck(1.25);prompt("DHEEL","#00BFFF",26,.8);
}

// Apply KHENCH tap.
function doKhench(){
  if(mode!=="playing"||paused){return;}
  player.vy=180;tension=clamp(tension-.06,0,1);playPluck(.85);prompt("KHENCH","#FF3B30",26,.8);
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
  initAudio();
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
  playPluck(1.6);
  prompt("KAT GAI!","#FF0000",38,1.5);
  startReward();
  tension=.25;
  zone="green";
}

// Start the KAT GAI reward animation and chime.
function startReward(){
  if(rewardTriggered){return;}
  rewardTriggered=true;
  reward.active=true;reward.time=0;reward.x=ai.x;reward.y=ai.y;reward.particles.length=0;
  for(let i=0;i<12;i+=1){const angle=i*Math.PI*2/12;reward.particles.push({vx:Math.cos(angle)*200,vy:Math.sin(angle)*200});}
}

// Update the RAF-driven reward animation.
function updateReward(dt){
  if(!reward.active){return;}
  reward.time+=dt;
  if(reward.time>=1.5){reward.active=false;resetAI();}
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
    if(next==="yellow"){prompt("SAVADHAN","#FFD700",26,.8);}
    if(next==="red"){prompt("KHATRA","#FF4500",26,.8);}
    zone=next;
  }
  if(tension>=1){cutKite();}
}

// Clear and advance level.
function clearLevel(){
  prompt("LEVEL CLEAR","#00FF00",38,1.2);
  level+=1;
  timer=levelDuration(level);
  tension=.25;
  zone="green";
  levelCutTriggered=false;
  rewardTriggered=false;
  reward.active=false;
  resetPlayer();
  resetAI();
}

// Update game state.
function update(dt){
  updatePrompts(dt);
  if(mode!=="playing"||paused){return;}
  clock+=dt;timer-=dt;
  updatePlayer(dt);updateAI(dt);updateTension(dt);updateAmbient();updateReward(dt);
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
  ctx.save();ctx.lineWidth=1/window.devicePixelRatio;ctx.strokeStyle="rgba(255, 245, 220, 0.9)";ctx.shadowBlur=0;
  ctx.beginPath();ctx.moveTo(layout.handX,layout.handY);ctx.lineTo(player.x,player.y);ctx.stroke();ctx.restore();
}

// Draw AI kite string toward an off-screen flyer.
function drawAIString(){
  ctx.save();ctx.lineWidth=1/window.devicePixelRatio;ctx.strokeStyle="rgba(0, 0, 0, 0.85)";ctx.shadowBlur=0;
  ctx.beginPath();ctx.moveTo(ai.x,ai.y);ctx.lineTo(canvas.width*1.0,canvas.height*1.0);ctx.stroke();ctx.restore();
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
  const size=W()*.055;
  drawAIGhosts(size);
  const wobble=reward.active&&reward.time<.5?(Math.random()-.5)*.22:0;
  drawKite(ai.x,ai.y,size,ai.rotation+wobble,"#7B2FBE","#4CAF50",false);
}

// Draw player kite.
function drawPlayer(){
  const size=W()*.07;
  if(zone==="red"){
    const pulse=(Math.sin(clock*Math.PI*4)+1)/2;
    const radius=15+10*pulse;
    ctx.save();ctx.fillStyle="rgba(255,0,0,.18)";ctx.beginPath();ctx.arc(player.x,player.y,size+radius,0,Math.PI*2);ctx.fill();ctx.restore();
    drawKite(player.x,player.y,size,player.rotation,"#FF1493","#FF0000",true);
    return;
  }
  drawKite(player.x,player.y,size,player.rotation,"#FF1493","#FFFFFF",true);
}

// Draw reward sparkles and fading KAT GAI overlay.
function drawReward(){
  if(!reward.active){return;}
  const alpha=clamp(1-reward.time/1.5,0,1);
  ctx.save();
  ctx.globalAlpha=alpha;ctx.fillStyle="#FFD700";
  for(let i=0;i<reward.particles.length;i+=1){const p=reward.particles[i];ctx.beginPath();ctx.arc(reward.x+p.vx*reward.time,reward.y+p.vy*reward.time,5,0,Math.PI*2);ctx.fill();}
  ctx.font="900 38px 'Arial Black',sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.lineWidth=4;ctx.strokeStyle="#000";ctx.shadowColor="#000";ctx.shadowBlur=8;
  ctx.strokeText("KAT GAI!",W()*.5,H()*.20);ctx.fillStyle="#FF0000";ctx.fillText("KAT GAI!",W()*.5,H()*.20);ctx.restore();
}

// Draw HUD pill.
function pill(x,y,w,text){
  ctx.fillStyle="#1a2340";ctx.beginPath();ctx.roundRect(x,y,w,40,20);ctx.fill();
  ctx.fillStyle="#fff";ctx.font="700 20px Arial";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(text,x+w/2,y+20);
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
  ctx.fillStyle="#fff";ctx.fillRect(layout.pause.x+13,layout.pause.y+11,4,18);ctx.fillRect(layout.pause.x+23,layout.pause.y+11,4,18);
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
  drawAIString();
  drawAI();
  drawPlayer();
  drawReward();
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
