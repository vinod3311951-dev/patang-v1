// PATANG_VERSION: 3.1.0
// LAST_MAJOR_CHANGE: Fixed freeze after KAT GAI, correct cut/clear/fail sounds, removed whoosh entirely
"use strict";

const canvas=document.getElementById("gameCanvas");
const ctx=canvas.getContext("2d");
const sceneImage=new Image();
const layout={handX:0,handY:0,kiteMinX:0,kiteMaxX:0,playerMinY:0,playerMaxY:0,aiMinY:0,aiMaxY:0,sceneX:0,sceneY:0,sceneW:0,sceneH:0,play:{},dheel:{},khench:{},pause:{}};
const prompts=[];
const spark={active:false,time:0,x:0,y:0};
const looseString={active:false,time:0,owner:"",endX:0,endY:0};
const bumper={active:false,time:0,secondChime:false,confetti:[],stars:[]};
const outcome={active:false,type:"",time:0};
const player={x:0,y:0,vx:0,vy:0,rotation:0,direction:1,cut:false,cutTime:0,alpha:1};
const ai={x:0,y:0,vx:0,vy:0,rotation:0,direction:-1,state:"cruise",attackTime:0,nextAttack:6,cut:false,cutTime:0,alpha:1};
const ambient={bird:0,crow:0};
let assetsReady=false;
let assetError=false;
let mode="home";
let paused=false;
let gameState="playing";
let cutResult="";
let stateTimer=0;
let failReason="";
let level=1;
let timer=60;
let tension=.25;
let clock=0;
let last=performance.now();
let audioWater=null;
let audioSparrow=null;
let audioCrow=null;
let audioPluck=null;
let audioVoiceDheel=null;
let audioVoiceKhench=null;
let audioVoiceKatGai=null;
let audioVoiceManjaGaya=null;

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
    if(n){
      n.classList.add("hidden");
      n.style.pointerEvents="none";
    }
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
  if(canvas.width!==innerWidth||canvas.height!==innerHeight){
    resizeCanvas();
  }
}

// Recompute anchors, movement bounds, and hit zones.
function recomputeLayout(){
  if(canvas.width===0||canvas.height===0){
    return;
  }
  const sceneAspect=1536/864;
  const canvasAspect=canvas.width/canvas.height;
  layout.kiteMinX=canvas.width*.08;
  layout.kiteMaxX=canvas.width*.92;
  layout.playerMinY=canvas.height*.16;
  layout.playerMaxY=canvas.height*.52;
  layout.aiMinY=canvas.height*.12;
  layout.aiMaxY=canvas.height*.55;
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
  layout.play={x:W()*.5-92,y:H()*.68-31,w:184,h:62};
  layout.dheel={x:W()*.06,y:H()*.88,w:140,h:70};
  layout.khench={x:W()*.56,y:H()*.88,w:140,h:70};
  layout.pause={x:W()-54,y:14,w:40,h:40};
  if(mode==="home"){
    resetPlayer();
    resetAI();
  }
}

// Handle scene load.
function sceneLoaded(){
  assetsReady=true;
  assetError=false;
}

// Handle scene error.
function sceneFailed(){
  assetsReady=false;
  assetError=true;
}

// Load the scene image.
function loadScene(){
  sceneImage.onload=sceneLoaded;
  sceneImage.onerror=sceneFailed;
  sceneImage.src="public/assets/scene.png";
}

// Return the level time limit.
function levelDuration(n){
  return Math.max(30,60-(n-1)*3);
}

// Return AI sharpness for the current level.
function aiSharpness(){
  return clamp(.4+(level-1)*(.5/9),.4,.9);
}

// Reset the player kite.
function resetPlayer(){
  player.x=W()*.66;
  player.y=H()*.34;
  player.vx=72;
  player.vy=0;
  player.rotation=0;
  player.direction=1;
  player.cut=false;
  player.cutTime=0;
  player.alpha=1;
}

// Reset the AI kite.
function resetAI(){
  ai.x=W()*.28;
  ai.y=H()*.25;
  ai.vx=-58;
  ai.vy=0;
  ai.rotation=0;
  ai.direction=-1;
  ai.state="cruise";
  ai.attackTime=0;
  ai.nextAttack=clock+5+Math.random()*3;
  ai.cut=false;
  ai.cutTime=0;
  ai.alpha=1;
}

// Reset transient combat effects.
function resetEffects(){
  prompts.length=0;
  spark.active=false;
  spark.time=0;
  looseString.active=false;
  looseString.time=0;
  bumper.active=false;
  bumper.time=0;
  bumper.secondChime=false;
  bumper.confetti.length=0;
  bumper.stars.length=0;
  outcome.active=false;
  outcome.type="";
  outcome.time=0;
}

// Start or retry the current level.
function startLevel(){
  timer=levelDuration(level);
  tension=.25;
  clock=0;
  resetEffects();
  resetPlayer();
  resetAI();
  scheduleAmbient();
  transitionState("playing");
  startAmbience();
}

// Start gameplay.
function startGame(){
  if(!assetsReady){
    return;
  }
  mode="playing";
  paused=false;
  startLevel();
}

// Initialize all HTML audio elements on the first user gesture.
function initAudio(){
  if(audioWater){
    return;
  }
  audioWater=new Audio("public/assets/water.mp3");
  audioWater.loop=true;
  audioWater.volume=.30;
  audioSparrow=new Audio("public/assets/sparrow.mp3");
  audioSparrow.volume=.45;
  audioCrow=new Audio("public/assets/crow.mp3");
  audioCrow.volume=.40;
  audioPluck=new Audio("public/assets/pluck.mp3");
  // Optional voice files intentionally disabled in shipping audio routing.
  audioVoiceDheel=null;
  audioVoiceDheel.volume=.7;
  audioVoiceKhench=null;
  audioVoiceKhench.volume=.7;
  audioVoiceKatGai=null;
  audioVoiceKatGai.volume=.7;
  audioVoiceManjaGaya=null;
  audioVoiceManjaGaya.volume=.7;
  audioWater.play().catch(function ignoreWaterPlay(){});
}

// Play the shared pluck asset.
function playPluck(rate,volume){
  if(!audioPluck){
    return;
  }
  audioPluck.currentTime=0;
  audioPluck.playbackRate=rate;
  audioPluck.volume=volume;
  audioPluck.play().catch(function ignorePluckPlay(){});
}

// Play a simultaneous pluck layer.
function playPluckLayer(rate,volume){
  if(!audioPluck){
    return;
  }
  const layer=audioPluck.cloneNode();
  layer.playbackRate=rate;
  layer.volume=volume;
  layer.play().catch(function ignorePluckLayer(){});
}

// Play an optional voice line safely.
function playVoice(audio){
  if(!audio){
    return;
  }
  audio.currentTime=0;
  audio.play().catch(function ignoreVoicePlay(){});
}

// Pause looping water.
function stopAmbience(){
  if(audioWater){
    audioWater.pause();
  }
}

// Resume looping water.
function startAmbience(){
  if(audioWater&&!paused&&gameState==="playing"){
    audioWater.play().catch(function ignoreWaterResume(){});
  }
}

// Schedule sparse bird ambience from the RAF clock.
function scheduleAmbient(){
  ambient.bird=clock+4+Math.random()*5;
  ambient.crow=clock+12+Math.random()*13;
}

// Update sparse bird ambience from RAF time.
function updateAmbient(){
  if(clock>=ambient.bird){
    if(audioSparrow){
      audioSparrow.currentTime=0;
      audioSparrow.play().catch(function ignoreSparrowPlay(){});
    }
    ambient.bird=clock+4+Math.random()*5;
  }
  if(clock>=ambient.crow){
    if(audioCrow){
      audioCrow.currentTime=0;
      audioCrow.play().catch(function ignoreCrowPlay(){});
    }
    ambient.crow=clock+12+Math.random()*13;
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
    if(prompts[i].timeLeft<=0){
      prompts.splice(i,1);
    }
  }
}

// Apply DHEEL input.
function doDheel(){
  if(mode!=="playing"||paused||outcome.active||bumper.active||player.cut||ai.cut){
    return;
  }
  player.vy=-220;
  tension=clamp(tension+.08,0,1);
  playPluck(1.30,.40);
  prompt("DHEEL","#00BFFF",26,.65);
}

// Apply KHENCH input.
function doKhench(){
  if(mode!=="playing"||paused||outcome.active||bumper.active||player.cut||ai.cut){
    return;
  }
  player.vy=220;
  tension=clamp(tension-.06,0,1);
  playPluck(.80,.40);
  prompt("KHENCH","#FF3B30",26,.65);
}

// Toggle pause and ambient.
function togglePause(){
  if(mode!=="playing"||outcome.active||bumper.active){
    return;
  }
  paused=!paused;
  if(paused){
    stopAmbience();
  }else{
    startAmbience();
    scheduleAmbient();
  }
}

// Convert pointer coordinates to canvas pixels.
function pointerPoint(e){
  const r=canvas.getBoundingClientRect();
  return{x:(e.clientX-r.left)*(canvas.width/r.width),y:(e.clientY-r.top)*(canvas.height/r.height)};
}

// Test a rectangular hit zone.
function hit(p,z){
  const pad=(z===layout.dheel||z===layout.khench)?6:0;
  return p.x>=z.x-pad&&p.x<=z.x+z.w+pad&&p.y>=z.y-pad&&p.y<=z.y+z.h+pad;
}

// Handle the sole pointer interaction.
function handlePointerDown(e){
  initAudio();
  e.preventDefault();
  const p=pointerPoint(e);
  if(mode==="home"&&hit(p,layout.play)){
    startGame();
    return;
  }
  if(mode!=="playing"){
    return;
  }
  if(hit(p,layout.pause)){
    togglePause();
    return;
  }
  if(!paused&&hit(p,layout.dheel)){
    doDheel();
    return;
  }
  if(!paused&&hit(p,layout.khench)){
    doKhench();
  }
}

// Ease player vertical velocity toward zero.
function decayPlayerVy(dt){
  const d=150*dt;
  if(player.vy>0){
    player.vy=Math.max(0,player.vy-d);
  }else if(player.vy<0){
    player.vy=Math.min(0,player.vy+d);
  }
}

// Update tethered player movement.
function updatePlayer(dt){
  if(player.cut){
    updateCutKite(player,dt);
    return;
  }
  if(player.x<=layout.kiteMinX){
    player.direction=1;
  }else if(player.x>=layout.kiteMaxX){
    player.direction=-1;
  }
  const target=player.direction*(72+24*Math.sin(clock*.55));
  player.vx+=(target-player.vx)*(1-Math.exp(-dt*3));
  decayPlayerVy(dt);
  player.x=clamp(player.x+player.vx*dt,layout.kiteMinX,layout.kiteMaxX);
  player.y=clamp(player.y+player.vy*dt,layout.playerMinY,layout.playerMaxY);
  player.rotation=Math.atan2(player.vy,player.vx)*.45;
}

// Begin an AI attack run.
function beginAttack(){
  ai.state="attack";
  ai.attackTime=0;
}

// Update AI cruise and attack behavior.
function updateAI(dt){
  if(ai.cut){
    updateCutKite(ai,dt);
    return;
  }
  if(ai.state==="cruise"&&clock>=ai.nextAttack){
    beginAttack();
  }
  if(ai.state==="attack"){
    ai.attackTime+=dt;
    const dx=player.x-ai.x;
    const dy=player.y-ai.y;
    const d=Math.max(1,Math.hypot(dx,dy));
    const speed=Math.max(150,Math.min(230,d/3.2));
    ai.vx=dx/d*speed;
    ai.vy=dy/d*speed;
    if(ai.attackTime>=4){
      ai.state="cruise";
      ai.nextAttack=clock+5+Math.random()*3;
    }
  }else{
    if(ai.x<=layout.kiteMinX){
      ai.direction=1;
    }else if(ai.x>=layout.kiteMaxX){
      ai.direction=-1;
    }
    ai.vx=ai.direction*(58+18*Math.sin(clock*.71+1.2));
    const targetY=H()*(.30+.10*Math.sin(clock*.43+level));
    ai.vy+=(clamp(targetY,layout.aiMinY,layout.aiMaxY)-ai.y)*dt*2.2;
    ai.vy=clamp(ai.vy,-75,75);
  }
  ai.x=clamp(ai.x+ai.vx*dt,layout.kiteMinX,layout.kiteMaxX);
  ai.y=clamp(ai.y+ai.vy*dt,layout.aiMinY,layout.aiMaxY);
  ai.rotation=Math.atan2(ai.vy,ai.vx)*.45;
}

// Update an untethered cut kite.
function updateCutKite(kite,dt){
  kite.cutTime+=dt;
  kite.vy+=400*dt;
  kite.x+=kite.vx*dt;
  kite.y+=kite.vy*dt;
  kite.rotation+=8*dt;
  kite.alpha=clamp(1-kite.cutTime/1.5,0,1);
}

// Update string sharpness from altitude.
function updateTension(dt){
  const y=player.y/H();
  if(y<.25){
    tension+=.4*dt;
  }else if(y>.35){
    tension-=.3*dt;
  }
  tension=clamp(tension,0,1);
}

// Return orientation of three points.
function orientation(ax,ay,bx,by,cx,cy){
  return(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
}

// Return the intersection point of two finite segments or null.
function segmentIntersection(a,b,c,d){
  const rX=b.x-a.x;
  const rY=b.y-a.y;
  const sX=d.x-c.x;
  const sY=d.y-c.y;
  const denom=rX*sY-rY*sX;
  if(Math.abs(denom)<.000001){
    return null;
  }
  const qpx=c.x-a.x;
  const qpy=c.y-a.y;
  const t=(qpx*sY-qpy*sX)/denom;
  const u=(qpx*rY-qpy*rX)/denom;
  if(t<0||t>1||u<0||u>1){
    return null;
  }
  return{x:a.x+t*rX,y:a.y+t*rY};
}

// Check the two live strings for contact.
function checkStringCombat(){
  if(player.cut||ai.cut||outcome.active||bumper.active){
    return;
  }
  const playerOrigin={x:layout.handX,y:layout.handY};
  const playerEnd={x:player.x,y:player.y};
  const aiOrigin={x:W(),y:H()};
  const aiEnd={x:ai.x,y:ai.y};
  const point=segmentIntersection(playerOrigin,playerEnd,aiOrigin,aiEnd);
  if(!point){
    return;
  }
  spark.active=true;
  spark.time=0;
  spark.x=point.x;
  spark.y=point.y;
  playPluck(1.00,.55);
  playPluckLayer(1.40,.55);
  const enemy=aiSharpness();
  if(tension>enemy){
    cutAI();
  }else if(tension<enemy){
    cutPlayer();
  }else if(Math.random()<.5){
    cutAI();
  }else{
    cutPlayer();
  }
}

// Mark the AI kite as cut and start the win sequence.
function cutAI(){
  if(ai.cut||player.cut){
    return;
  }
  ai.cut=true;
  ai.cutTime=0;
  ai.vx*=.35;
  ai.vy=20;
  looseString.active=true;
  looseString.time=0;
  looseString.owner="ai";
  looseString.endX=ai.x;
  looseString.endY=ai.y;
  beginKatching("ai");
}

// Mark the player kite as cut and start the fail sequence.
function cutPlayer(){
  if(player.cut||ai.cut){
    return;
  }
  player.cut=true;
  player.cutTime=0;
  player.vx*=.35;
  player.vy=20;
  looseString.active=true;
  looseString.time=0;
  looseString.owner="player";
  looseString.endX=player.x;
  looseString.endY=player.y;
  beginKatching("player");
}

// Transition between explicit game states.
function transitionState(nextState){
  const oldState=gameState;
  if(oldState===nextState){return;}
  gameState=nextState;
  console.log("State:",oldState,"->",nextState);
  if(nextState==="playing"){startAmbience();scheduleAmbient();}else{stopAmbience();}
}

// Start the KAT GAI hold.
function beginKatching(result){
  cutResult=result;
  stateTimer=1.5;
  prompt("KAT GAI!","#FF2020",52,1.5);
  playPluck(1.60,.60);
  transitionState("katching");
}

// Start explicit level clear.
function beginLevelClear(){
  stateTimer=2;
  startBumper();
  transitionState("levelClear");
}

// Start explicit level fail.
function beginLevelFail(reason){
  failReason=reason;
  stateTimer=1.5;
  outcome.active=true;
  outcome.type=reason;
  outcome.time=2;
  playPluck(.55,.50);
  transitionState("levelFail");
}

// Update explicit RAF state timers.
function updateStateMachine(dt){
  if(gameState==="katching"){
    stateTimer-=dt;
    updateSpark(dt);
    updateLooseString(dt);
    if(ai.cut){updateAI(dt);}
    if(player.cut){updatePlayer(dt);}
    if(stateTimer<=0){if(cutResult==="ai"){beginLevelClear();}else{beginLevelFail("cut");}}
    return;
  }
  if(gameState==="levelClear"){
    stateTimer-=dt;
    updateBumper(dt);
    if(stateTimer<=0){bumper.active=false;level+=1;startLevel();}
    return;
  }
  if(gameState==="levelFail"){
    stateTimer-=dt;
    outcome.time+=dt;
    if(stateTimer<=0){outcome.active=false;startLevel();}
  }
}

// Start the level-clear celebration bumper.
function startBumper(){
  bumper.active=true;
  bumper.time=0;
  bumper.secondChime=false;
  bumper.confetti.length=0;
  bumper.stars.length=0;
  const colors=["#F44336","#FFD700","#4CAF50","#2196F3","#FF9800","#FF00FF"];
  for(let i=0;i<24;i+=1){
    bumper.confetti.push({x:Math.random()*W(),y:-Math.random()*H()*.35,vx:(Math.random()-.5)*70,vy:170+Math.random()*180,rot:Math.random()*Math.PI*2,spin:(Math.random()>.5?1:-1)*(3+Math.random()*4),color:colors[i%colors.length]});
  }
  for(let i=0;i<8;i+=1){
    bumper.stars.push({angle:i*Math.PI/4});
  }
  playPluck(1.60,.60);
}

// Update the level-clear celebration.
function updateBumper(dt){
  if(!bumper.active){
    return;
  }
  bumper.time+=dt;
  for(let i=0;i<bumper.confetti.length;i+=1){
    const p=bumper.confetti[i];
    p.x+=p.vx*dt;
    p.y+=p.vy*dt;
    p.rot+=p.spin*dt;
  }
  if(!bumper.secondChime&&bumper.time>=.5){
    bumper.secondChime=true;
    playPluck(1.90,.60);
  }

}

// Start a level-fail sequence.
function startFail(type){
  if(outcome.active||bumper.active){
    return;
  }
  outcome.active=true;
  outcome.type=type;
  outcome.time=0;
}

// Update the level-fail sequence.
function updateFail(dt){
  if(!outcome.active){
    return;
  }
  outcome.time+=dt;
  if(outcome.time>=2.5){
    startLevel();
  }
}

// Update the crossing spark.
function updateSpark(dt){
  if(!spark.active){
    return;
  }
  spark.time+=dt;
  if(spark.time>=.2){
    spark.active=false;
  }
}

// Update the snapped loose string.
function updateLooseString(dt){
  if(!looseString.active){
    return;
  }
  looseString.time+=dt;
  if(looseString.time>=1){
    looseString.active=false;
  }
}

// Update active gameplay.
function update(dt){
  updatePrompts(dt);
  if(mode!=="playing"||paused){return;}
  if(gameState!=="playing"){updateStateMachine(dt);return;}
  clock+=dt;
  timer=Math.max(0,timer-dt);
  updatePlayer(dt);
  updateAI(dt);
  updateTension(dt);
  updateAmbient();
  updateSpark(dt);
  updateLooseString(dt);
  checkStringCombat();
  if(timer<=0&&!player.cut&&!ai.cut){
    prompt("TIME OUT","#FF2020",52,1.5);
    beginLevelFail("timeout");
  }
}

// Draw warm fallback.
function drawFallback(){
  ctx.fillStyle="#C88A4A";
  ctx.fillRect(0,0,W(),H());
  ctx.fillStyle="#fff";
  ctx.font="700 16px Arial";
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.fillText(assetError?"Scene unavailable":"Loading scene…",W()/2,H()/2);
}

// Draw scene with cover fit.
function drawScene(){
  ctx.fillStyle="#C88A4A";
  ctx.fillRect(0,0,W(),H());
  if(!assetsReady){
    drawFallback();
    return;
  }
  ctx.drawImage(sceneImage,layout.sceneX,layout.sceneY,layout.sceneW,layout.sceneH);
}

// Draw the player string overlay and actual black combat string.
function drawPlayerString(){
  if(player.cut){
    return;
  }
  ctx.save();
  ctx.lineWidth=2;
  ctx.strokeStyle="rgba(255, 250, 235, 0.95)";
  ctx.beginPath();
  ctx.moveTo(layout.handX,layout.handY);
  ctx.lineTo(player.x,player.y);
  ctx.stroke();
  ctx.lineWidth=1;
  ctx.strokeStyle="rgba(0, 0, 0, 0.92)";
  ctx.beginPath();
  ctx.moveTo(layout.handX,layout.handY);
  ctx.lineTo(player.x,player.y);
  ctx.stroke();
  ctx.restore();
}

// Draw the AI combat string from the bottom-right origin.
function drawAIString(){
  if(ai.cut){
    return;
  }
  ctx.save();
  ctx.lineWidth=1;
  ctx.strokeStyle="rgba(0, 0, 0, 0.82)";
  ctx.beginPath();
  ctx.moveTo(W(),H());
  ctx.lineTo(ai.x,ai.y);
  ctx.stroke();
  ctx.restore();
}

// Draw a snapped string hanging from its origin.
function drawLooseString(){
  if(!looseString.active){
    return;
  }
  const fade=clamp(1-looseString.time,0,1);
  const origin=looseString.owner==="player"?{x:layout.handX,y:layout.handY}:{x:W(),y:H()};
  const sag=45+looseString.time*80;
  ctx.save();
  ctx.globalAlpha=fade;
  ctx.strokeStyle="rgba(0,0,0,.8)";
  ctx.lineWidth=1;
  ctx.beginPath();
  ctx.moveTo(origin.x,origin.y);
  ctx.quadraticCurveTo((origin.x+looseString.endX)/2,(origin.y+looseString.endY)/2+sag,looseString.endX,looseString.endY+sag*.45);
  ctx.stroke();
  ctx.restore();
}

// Draw a shared diamond kite.
function drawKite(x,y,size,rotation,fillColor,outlineColor,alpha){
  ctx.save();
  ctx.globalAlpha=alpha;
  ctx.translate(x,y);
  ctx.rotate(rotation);
  ctx.beginPath();
  ctx.moveTo(0,-size);
  ctx.lineTo(size*.72,0);
  ctx.lineTo(0,size);
  ctx.lineTo(-size*.72,0);
  ctx.closePath();
  ctx.fillStyle=fillColor;
  ctx.fill();
  ctx.strokeStyle=outlineColor;
  ctx.lineWidth=2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0,-size);
  ctx.lineTo(0,size);
  ctx.moveTo(-size*.72,0);
  ctx.lineTo(size*.72,0);
  ctx.lineWidth=1;
  ctx.stroke();
  ctx.restore();
}

// Draw the AI kite.
function drawAI(){
  if(ai.alpha<=0){
    return;
  }
  drawKite(ai.x,ai.y,Math.max(22,W()*.055),ai.rotation,"#7B2FBE","#4CAF50",ai.alpha);
}

// Draw the player kite.
function drawPlayer(){
  if(player.alpha<=0){
    return;
  }
  const size=Math.max(24,W()*.065);
  ctx.save();
  ctx.globalAlpha=player.alpha;
  const glow=12+10*tension;
  ctx.fillStyle="rgba(255,20,147,.18)";
  ctx.beginPath();
  ctx.arc(player.x,player.y,size+glow,0,Math.PI*2);
  ctx.fill();
  ctx.restore();
  drawKite(player.x,player.y,size,player.rotation,"#FF1493","#FFFFFF",player.alpha);
}

// Draw the 200ms string-contact spark.
function drawSpark(){
  if(!spark.active){
    return;
  }
  const a=clamp(1-spark.time/.2,0,1);
  const r=8+spark.time*90;
  ctx.save();
  ctx.globalAlpha=a;
  ctx.strokeStyle="#FFFFFF";
  ctx.fillStyle="#FFFFFF";
  ctx.lineWidth=3;
  ctx.shadowColor="#FFFFFF";
  ctx.shadowBlur=18;
  ctx.beginPath();
  ctx.arc(spark.x,spark.y,5,0,Math.PI*2);
  ctx.fill();
  for(let i=0;i<8;i+=1){
    const angle=i*Math.PI/4;
    ctx.beginPath();
    ctx.moveTo(spark.x+Math.cos(angle)*5,spark.y+Math.sin(angle)*5);
    ctx.lineTo(spark.x+Math.cos(angle)*r,spark.y+Math.sin(angle)*r);
    ctx.stroke();
  }
  ctx.restore();
}

// Draw one HUD pill.
function pill(x,y,w,text){
  ctx.fillStyle="#1a2340";
  ctx.beginPath();
  ctx.roundRect(x,y,w,40,20);
  ctx.fill();
  ctx.fillStyle="#fff";
  ctx.font="700 20px Arial";
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.fillText(text,x+w/2,y+20);
}

// Format the timer.
function formatTime(seconds){
  const n=Math.max(0,Math.ceil(seconds));
  const m=Math.floor(n/60);
  const s=n%60;
  return String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
}

// Draw top HUD.
function drawHUD(){
  pill(12,12,72,"L"+level);
  pill(W()/2-50,12,100,formatTime(timer));
  ctx.fillStyle="#1a2340";
  ctx.beginPath();
  ctx.roundRect(layout.pause.x,layout.pause.y,40,40,12);
  ctx.fill();
  ctx.fillStyle="#fff";
  ctx.fillRect(layout.pause.x+13,layout.pause.y+11,4,18);
  ctx.fillRect(layout.pause.x+23,layout.pause.y+11,4,18);
}

// Draw the string-sharpness meter.
function drawTensionBar(){
  const x=16;
  const y=66;
  const w=Math.min(210,W()*.52);
  ctx.fillStyle="rgba(26,35,64,.88)";
  ctx.beginPath();
  ctx.roundRect(x,y,w,28,14);
  ctx.fill();
  ctx.fillStyle="#fff";
  ctx.font="700 12px Arial";
  ctx.textAlign="left";
  ctx.textBaseline="middle";
  ctx.fillText("MANJA",x+10,y+14);
  const bx=x+64;
  const bw=w-76;
  ctx.fillStyle="rgba(255,255,255,.25)";
  ctx.fillRect(bx,y+9,bw,10);
  ctx.fillStyle="#FFD700";
  ctx.fillRect(bx,y+9,bw*tension,10);
}

// Draw queued prompts.
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

// Draw one rounded control.
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

// Draw a five-point star path.
function starPath(x,y,outer,inner,rotation){
  ctx.beginPath();
  for(let i=0;i<10;i+=1){
    const radius=i%2===0?outer:inner;
    const angle=rotation-Math.PI/2+i*Math.PI/5;
    const px=x+Math.cos(angle)*radius;
    const py=y+Math.sin(angle)*radius;
    if(i===0){
      ctx.moveTo(px,py);
    }else{
      ctx.lineTo(px,py);
    }
  }
  ctx.closePath();
}

// Draw the level-clear bumper.
function drawBumper(){
  if(!bumper.active){
    return;
  }
  ctx.save();
  ctx.fillStyle="rgba(26,35,64,.85)";
  ctx.fillRect(0,0,W(),H());
  for(let i=0;i<bumper.confetti.length;i+=1){
    const p=bumper.confetti[i];
    ctx.save();
    ctx.translate(p.x,p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle=p.color;
    ctx.fillRect(-4,-4,8,8);
    ctx.restore();
  }
  const starPhase=clamp(bumper.time/.7,0,1);
  const starFade=clamp(1-(bumper.time-.7)/1.0,0,1);
  const radius=60*starPhase;
  ctx.fillStyle="#FFD700";
  ctx.globalAlpha=starFade;
  for(let i=0;i<bumper.stars.length;i+=1){
    const s=bumper.stars[i];
    const sx=W()*.5+Math.cos(s.angle)*radius*2.2;
    const sy=H()*.44+Math.sin(s.angle)*radius*1.35;
    starPath(sx,sy,Math.max(3,radius*.28),Math.max(1.5,radius*.13),bumper.time*4);
    ctx.fill();
  }
  ctx.globalAlpha=1;
  const titleSize=Math.min(64,Math.max(42,W()*.14));
  ctx.font="900 "+titleSize+"px 'Arial Black',Arial";
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.lineWidth=6;
  ctx.strokeStyle="#000";
  ctx.shadowColor="#000";
  ctx.shadowBlur=12;
  ctx.strokeText("LEVEL CLEAR",W()*.5,H()*.43);
  ctx.fillStyle="#FFD700";
  ctx.fillText("LEVEL CLEAR",W()*.5,H()*.43);
  ctx.shadowBlur=0;
  ctx.font="700 28px Arial";
  ctx.fillStyle="#fff";
  ctx.fillText("L "+level+" COMPLETE",W()*.5,H()*.53);
  ctx.restore();
}

// Draw the level-fail sequence.
function drawFail(){
  if(!outcome.active){
    return;
  }
  ctx.save();
  ctx.fillStyle="rgba(0,0,0,.34)";
  ctx.fillRect(0,0,W(),H());
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  if(gameState==="katching"){
    ctx.font="900 52px 'Arial Black',Arial";
    ctx.lineWidth=5;
    ctx.strokeStyle="#000";
    ctx.strokeText(outcome.type==="timeout"?"TIME OUT":"KAT GAI!",W()*.5,H()*.43);
    ctx.fillStyle="#FF2020";
    ctx.fillText(outcome.type==="timeout"?"TIME OUT":"KAT GAI!",W()*.5,H()*.43);
  }else{
    ctx.font="900 52px 'Arial Black',Arial";
    ctx.lineWidth=6;
    ctx.strokeStyle="#fff";
    ctx.strokeText("LEVEL FAIL",W()*.5,H()*.46);
    ctx.fillStyle="#8B0000";
    ctx.fillText("LEVEL FAIL",W()*.5,H()*.46);
  }
  ctx.restore();
}

// Draw canvas home.
function drawHome(){
  ctx.fillStyle="rgba(26,35,64,.72)";
  ctx.fillRect(0,0,W(),H());
  ctx.fillStyle="#fff";
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.font="900 52px 'Arial Black',Arial";
  ctx.fillText("PATANG",W()*.5,H()*.38);
  ctx.fillStyle=assetsReady?"#FFC107":"#777";
  ctx.beginPath();
  ctx.roundRect(layout.play.x,layout.play.y,layout.play.w,layout.play.h,20);
  ctx.fill();
  ctx.fillStyle="#1a2340";
  ctx.font="900 20px Arial";
  ctx.fillText(assetsReady?"PLAY":"LOADING…",W()*.5,layout.play.y+layout.play.h/2);
}

// Render the game frame.
function drawFrame(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawScene();
  if(mode==="home"){
    drawHome();
    return;
  }
  drawPlayerString();
  drawAIString();
  drawLooseString();
  drawAI();
  drawPlayer();
  drawSpark();
  drawHUD();
  drawTensionBar();
  drawPrompts();
  if(gameState==="playing"){
    drawControls();
  }
  drawBumper();
  drawFail();
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
    console.error("RAF tick error:",err);
  }
  requestAnimationFrame(gameLoop);
}

// Pause when the page is hidden.
function visibilityChanged(){
  if(document.hidden&&mode==="playing"&&!paused){
    paused=true;
    stopAmbience();
  }
}

// Bind pointer and visibility input.
function bindEvents(){
  canvas.addEventListener("pointerdown",handlePointerDown,{passive:false});
  document.addEventListener("visibilitychange",visibilityChanged);
}

// Initialize the game.
function init(){
  hideLegacyDom();
  resizeCanvas();
  loadScene();
  bindEvents();
  requestAnimationFrame(gameLoop);
}

init();
