// PATANG_VERSION: 1.5.0
// LAST_MAJOR_CHANGE: Single scene background + two-button tap control + kite ownership clarity
"use strict";

const canvas=document.getElementById("gameCanvas");
const ctx=canvas.getContext("2d");
const startScreen=document.getElementById("startScreen");
const levelScreen=document.getElementById("levelScreen");
const levelGrid=document.getElementById("levelGrid");
const pauseModal=document.getElementById("pauseModal");
const resultModal=document.getElementById("resultModal");
const resultTitle=document.getElementById("resultTitle");
const resultDetail=document.getElementById("resultDetail");
const resultStars=document.getElementById("resultStars");
const SAVE_KEY="patang";
let save=loadSave(),currentLevel=1,mode="home",paused=false,lastTime=performance.now(),elapsed=0,score=0,tension=.2,crossed=false,crossTime=0,resultReason="",celebration=null;
let player={x:0,y:0,vy:0},ai={x:0,y:0,vy:0,state:"watch",decisionAt:0},wind={x:0,y:0,phase:0};
let audioCtx=null,windOsc=null,windGain=null,assetsReady=false,assetFailures=0;
const sceneImage=new Image();
const hitZones={dheel:{x:0,y:0,r:0},khench:{x:0,y:0,r:0},pause:{x:0,y:0,r:0}};

function loadSave(){try{const p=JSON.parse(localStorage.getItem(SAVE_KEY)||"{}");return{muted:!!p.muted,stars:p.stars||{},highScore:Number(p.highScore)||0};}catch(e){return{muted:false,stars:{},highScore:0};}}
function saveGame(){localStorage.setItem(SAVE_KEY,JSON.stringify(save));}
function W(){return canvas.width;}
function H(){return canvas.height;}
function resizeCanvas(){canvas.width=Math.max(1,innerWidth);canvas.height=Math.max(1,innerHeight);canvas.style.width=innerWidth+"px";canvas.style.height=innerHeight+"px";layout();}
function pollCanvasSize(){if(canvas.width!==innerWidth||canvas.height!==innerHeight)resizeCanvas();}
function layout(){if(mode!=="playing")resetPositions();const y=H()-72;hitZones.dheel.x=70;hitZones.dheel.y=y;hitZones.dheel.r=45;hitZones.khench.x=165;hitZones.khench.y=y;hitZones.khench.r=45;hitZones.pause.x=W()-30;hitZones.pause.y=34;hitZones.pause.r=24;}
function loadAssets(){sceneImage.onload=()=>{assetsReady=true;assetFailures=0;};sceneImage.onerror=()=>{assetsReady=false;assetFailures=1;};sceneImage.src="public/assets/scene.png";}
function resetPositions(){player.x=W()*.34;player.y=H()*.34;player.vy=0;ai.x=W()*.70;ai.y=H()*.30;ai.vy=0;}
function buildLevelGrid(){levelGrid.innerHTML="";for(let n=1;n<=100;n++){const b=document.createElement("button");b.className="level-tile";b.textContent=n;b.addEventListener("click",()=>startGame(n));levelGrid.appendChild(b);}}
function hidePanels(){startScreen.classList.add("hidden");levelScreen.classList.add("hidden");pauseModal.classList.add("hidden");resultModal.classList.add("hidden");document.getElementById("hud")?.classList.add("hidden");document.getElementById("statusBar")?.classList.add("hidden");}
function startGame(n){if(!assetsReady)return;unlockAudio();currentLevel=Math.max(1,Math.min(100,n));mode="playing";paused=false;elapsed=0;score=0;tension=.2;crossed=false;crossTime=0;celebration=null;resetPositions();layout();hidePanels();}
function goHome(){mode="home";paused=false;hidePanels();startScreen.classList.remove("hidden");}
function showLevels(){mode="levels";hidePanels();buildLevelGrid();levelScreen.classList.remove("hidden");}
function togglePause(force){if(mode!=="playing")return;paused=typeof force==="boolean"?force:!paused;pauseModal.classList.toggle("hidden",!paused);}
function unlockAudio(){if(save.muted)return;if(!audioCtx){audioCtx=new(window.AudioContext||window.webkitAudioContext)();createWindHum();}if(audioCtx.state==="suspended")audioCtx.resume();}
function createWindHum(){if(!audioCtx||windOsc)return;windOsc=audioCtx.createOscillator();windGain=audioCtx.createGain();windOsc.type="sine";windOsc.frequency.value=110;windGain.gain.value=.012;windOsc.connect(windGain);windGain.connect(audioCtx.destination);windOsc.start();}
function tone(from,to,duration,gain){if(save.muted||!audioCtx)return;const now=audioCtx.currentTime,o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type="triangle";o.frequency.setValueAtTime(from,now);o.frequency.exponentialRampToValueAtTime(to,now+duration);g.gain.setValueAtTime(gain,now);g.gain.exponentialRampToValueAtTime(.0001,now+duration);o.connect(g);g.connect(audioCtx.destination);o.start(now);o.stop(now+duration+.02);}
function soundDheel(){tone(420,760,.11,.045);}
function soundKhench(){tone(620,260,.13,.05);}
function soundKatGai(){tone(850,1450,.18,.07);}
function soundManjaGaya(){tone(520,120,.32,.065);}
function doDheel(){if(mode!=="playing"||paused||celebration)return;player.vy-=165;tension=Math.max(.05,tension-.12);soundDheel();if(crossed&&elapsed-crossTime<.8&&tension>.25)triggerWin();}
function doKhench(){if(mode!=="playing"||paused||celebration)return;player.vy+=165;tension=Math.min(1.15,tension+.16);soundKhench();if(tension>1.05)triggerLoss("snap");}
function canvasTouchPoint(touch){const r=canvas.getBoundingClientRect();return{x:(touch.clientX-r.left)*(canvas.width/r.width),y:(touch.clientY-r.top)*(canvas.height/r.height)};}
function hit(z,x,y){const dx=x-z.x,dy=y-z.y;return dx*dx+dy*dy<=z.r*z.r;}
function onTouchStart(e){unlockAudio();const p=canvasTouchPoint(e.changedTouches[0]);if(hit(hitZones.pause,p.x,p.y)){togglePause();e.preventDefault();return;}if(hit(hitZones.dheel,p.x,p.y)){doDheel();e.preventDefault();return;}if(hit(hitZones.khench,p.x,p.y)){doKhench();e.preventDefault();}}
function onPointerDown(e){if(e.pointerType==="touch")return;unlockAudio();const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*(canvas.width/r.width),y=(e.clientY-r.top)*(canvas.height/r.height);if(hit(hitZones.pause,x,y))togglePause();else if(hit(hitZones.dheel,x,y))doDheel();else if(hit(hitZones.khench,x,y))doKhench();}
function update(dt){if(paused||mode!=="playing")return;if(celebration){celebration.t+=dt;if(celebration.t>=celebration.duration)finishResult(!celebration.loss);return;}elapsed+=dt;if(elapsed>=45){triggerLoss("timer");return;}wind.phase+=dt;wind.x=Math.sin(wind.phase)*22;wind.y=Math.cos(wind.phase*.7)*8;player.vy+=wind.y*dt;player.vy*=Math.pow(.2,dt);player.y=clamp(player.y+player.vy*dt,H()*.12,H()*.62);ai.y=clamp(H()*.30+Math.sin(elapsed*.8)*H()*.10,H()*.12,H()*.58);updateCrossing();}
function updateCrossing(){const a={x:W()*.42,y:H()*.58},b=player,c={x:W()*.80,y:H()*.60},d=ai;const now=segmentsCross(a,b,c,d);if(now&&!crossed)crossTime=elapsed;crossed=now;}
function segmentsCross(a,b,c,d){const den=(a.x-b.x)*(c.y-d.y)-(a.y-b.y)*(c.x-d.x);if(Math.abs(den)<.001)return false;const t=((a.x-c.x)*(c.y-d.y)-(a.y-c.y)*(c.x-d.x))/den,u=-((a.x-b.x)*(a.y-c.y)-(a.y-b.y)*(a.x-c.x))/den;return t>0&&t<1&&u>0&&u<1;}
function triggerWin(){if(celebration)return;score=Math.round(1000+currentLevel*90+(45-elapsed)*40);soundKatGai();celebration={t:0,duration:.8,loss:false};}
function triggerLoss(reason){if(celebration)return;resultReason=reason;if(reason==="snap")soundManjaGaya();else soundKatGai();celebration={t:0,duration:.7,loss:true};}
function finishResult(win){mode="result";const stars=win?Math.max(1,Math.min(3,Math.ceil(score/1800))):0;if(win){save.stars[String(currentLevel)]=Math.max(save.stars[String(currentLevel)]||0,stars);save.highScore=Math.max(save.highScore,score);saveGame();}resultTitle.textContent=win?"WOH KAATA!":"Round Over";resultDetail.textContent=win?"Score "+score:(resultReason==="snap"?"Manja gaya.":"Kat gai.");resultStars.textContent="★".repeat(stars)+"☆".repeat(3-stars);resultModal.classList.remove("hidden");}
function drawFallback(){ctx.fillStyle="#c9784a";ctx.fillRect(0,0,W(),H());ctx.fillStyle="#fff2d2";ctx.font="700 16px system-ui";ctx.textAlign="center";ctx.fillText(assetFailures?"Scene unavailable":"Loading scene…",W()/2,H()/2);}
function drawScene(){if(!assetsReady){drawFallback();return;}const iw=sceneImage.naturalWidth,ih=sceneImage.naturalHeight,s=Math.min(W()/iw,H()/ih),dw=iw*s,dh=ih*s,dx=(W()-dw)/2,dy=(H()-dh)/2;ctx.fillStyle="#6f3f39";ctx.fillRect(0,0,W(),H());ctx.drawImage(sceneImage,dx,dy,dw,dh);}
function drawKite(x,y,size,playerOwned){ctx.save();ctx.translate(x,y);if(playerOwned){ctx.shadowColor="#ff2b9d";ctx.shadowBlur=14;}ctx.beginPath();ctx.moveTo(0,-size);ctx.lineTo(size*.72,0);ctx.lineTo(0,size);ctx.lineTo(-size*.72,0);ctx.closePath();ctx.fillStyle=playerOwned?"#ff2b9d":"#6b36a8";ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle=playerOwned?"#fff0fa":"#55c978";ctx.lineWidth=playerOwned?3:2;ctx.stroke();ctx.beginPath();ctx.moveTo(0,-size);ctx.lineTo(0,size);ctx.moveTo(-size*.72,0);ctx.lineTo(size*.72,0);ctx.stroke();ctx.restore();}
function drawDuel(){const anchor={x:W()*.42,y:H()*.58};ctx.strokeStyle="#f6e4c7";ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(anchor.x,anchor.y);ctx.lineTo(player.x,player.y);ctx.stroke();const size=Math.max(25,Math.min(48,W()*.065));drawKite(player.x,player.y,size,true);drawKite(ai.x,ai.y,size*.9,false);}
function pill(x,y,w,h,text){ctx.fillStyle="#172044dd";ctx.beginPath();ctx.roundRect(x,y,w,h,h/2);ctx.fill();ctx.fillStyle="#fff2d2";ctx.font="700 13px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(text,x+w/2,y+h/2);}
function diamond(cx,cy,size,fill,arrow,label){ctx.save();ctx.translate(cx,cy);ctx.rotate(Math.PI/4);ctx.fillStyle=fill;ctx.fillRect(-size/2,-size/2,size,size);ctx.rotate(-Math.PI/4);ctx.fillStyle="#fff";ctx.font="900 18px system-ui";ctx.textAlign="center";ctx.fillText(arrow,0,-3);ctx.font="800 9px system-ui";ctx.fillText(label,0,13);ctx.restore();}
function drawHUD(){pill(12,16,82,36,"L"+currentLevel);pill(W()/2-55,16,110,36,"WIND "+(wind.x>=0?"→":"←"));pill(W()-150,16,104,36,"00:"+String(Math.ceil(Math.max(0,45-elapsed))).padStart(2,"0"));ctx.fillStyle="#172044dd";ctx.beginPath();ctx.arc(hitZones.pause.x,hitZones.pause.y,20,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff";ctx.font="800 15px system-ui";ctx.textAlign="center";ctx.fillText("Ⅱ",hitZones.pause.x,hitZones.pause.y+5);diamond(hitZones.dheel.x,hitZones.dheel.y,58,"#2879d8","↑","DHEEL");diamond(hitZones.khench.x,hitZones.khench.y,58,"#d94444","↓","KHENCH");}
function draw(){ctx.clearRect(0,0,W(),H());drawScene();if(!assetsReady)return;if(mode==="playing"||mode==="result")drawDuel();if(mode==="playing")drawHUD();}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function loop(now){pollCanvasSize();const dt=Math.min(.033,(now-lastTime)/1000||0);lastTime=now;update(dt);draw();requestAnimationFrame(loop);}
function bind(){document.getElementById("playButton").addEventListener("click",()=>startGame(currentLevel));document.getElementById("levelsButton").addEventListener("click",showLevels);document.getElementById("levelBackButton").addEventListener("click",goHome);document.getElementById("resumeButton").addEventListener("click",()=>togglePause(false));document.getElementById("homeButton").addEventListener("click",goHome);document.getElementById("retryButton").addEventListener("click",()=>startGame(currentLevel));document.getElementById("resultLevelsButton").addEventListener("click",showLevels);canvas.addEventListener("touchstart",onTouchStart,{passive:false});canvas.addEventListener("pointerdown",onPointerDown);document.addEventListener("visibilitychange",()=>{if(document.hidden&&mode==="playing")togglePause(true);});}
function init(){resizeCanvas();loadAssets();buildLevelGrid();bind();resetPositions();requestAnimationFrame(loop);}
init();
