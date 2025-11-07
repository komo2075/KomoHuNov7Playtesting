// ====== 基本参数 ======
const SLEEP_AFTER_MS = 30000;   // 30s 无输入进入 sleep
const SHY_HOLD_MS    = 1200;    // shy 显示 1.2s
const HAPPY_HOLD_MS  = 1200;    // happy 显示 1.2s
const SOFT_TH   = 0.02;         // 轻环境声阈值
const LOUD_TH   = 0.12;         // 突然大声阈值

let mic, amp;
let videos = {};
let current = "live";
let lastInputAt = 0;
let shyUntil = 0;
let happyUntil = 0;
let allLoaded = false;
let started = false;

function preload(){}

function setup(){
  // 用 p5 只做音频输入和时序，画面用 <video>
  noCanvas();

  // 准备 4 个视频元素
  const stage = document.getElementById("stage");
  ["live","happy","sleep","shy"].forEach(name=>{
    const v = document.createElement("video");
    v.id = `vid-${name}`;
    v.src = `assets/${name}.mp4`;
    v.loop = true;
    v.muted = true;        // 为了移动端自动播放
    v.playsInline = true;  // iOS 原生内联
    v.preload = "auto";
    v.setAttribute("webkit-playsinline","true");
    v.setAttribute("x5-playsinline","true");
    v.addEventListener("canplaythrough", checkLoaded, { once:true });
    stage.appendChild(v);
    videos[name] = v;
  });

  // 初始只显示 live
  switchTo("live", {resetTime:false});
  document.getElementById("loading").style.display = "block";

  // 点击屏幕任意处触发 happy
  stage.addEventListener("pointerdown", ()=>{
    if(!started) return; // 等用户点击 start
    triggerHappy();
  });

  // Start 按钮：解锁音频权限 + 开始麦克风
  const startBtn = document.getElementById("startBtn");
  startBtn.addEventListener("click", async ()=>{
    if(started) return;
    started = true;
    // 解锁音频
    await userStartAudio().catch(()=>{});
    mic = new p5.AudioIn();
    mic.start(()=>{}, ()=>{});
    amp = new p5.Amplitude();
    amp.setInput(mic);

    // 开始播放所有视频以便缓存，并立即切回当前状态
    Object.values(videos).forEach(v=>{ v.play().catch(()=>{}); v.pause(); });
    switchTo("live");

    // UI
    startBtn.style.display = "none";
  });
}

function checkLoaded(){
  // 所有视频都到 canplaythrough 后，隐藏 loading 并尝试自动播放可见视频
  const ready = ["live","happy","sleep","shy"].every(n => videos[n].readyState >= 3);
  if(ready && !allLoaded){
    allLoaded = true;
    document.getElementById("loading").style.display = "none";
    // 尝试播放当前的视频
    videos[current].play().catch(()=>{});
  }
}

function draw(){
  if(!started || !amp) return;

  const now = millis();
  const level = amp.getLevel(); // 0..1

  // 有任何可感知输入就刷新
  if(level > SOFT_TH) lastInputAt = now;

  // 优先级：shy > happy > sleep > live
  if(level >= LOUD_TH){
    // 大声触发 shy
    shyUntil = now + SHY_HOLD_MS;
    switchTo("shy");
  }else if(now < shyUntil){
    switchTo("shy");
  }else if(now < happyUntil){
    switchTo("happy");
  }else if((now - lastInputAt) > SLEEP_AFTER_MS){
    switchTo("sleep");
  }else{
    switchTo("live");
  }

  // HUD
  document.getElementById("stateTxt").textContent = `state: ${current}`;
}

function triggerHappy(){
  const now = millis();
  happyUntil = now + HAPPY_HOLD_MS;
  lastInputAt = now;
  switchTo("happy");
}

function switchTo(name, opts = {resetTime:true}){
  if(current === name) return;
  // 显示 name，隐藏其他
  Object.entries(videos).forEach(([key, v])=>{
    if(key === name){
      v.style.display = "block";
      if(opts.resetTime) try{ v.currentTime = 0; }catch(e){}
      v.play().catch(()=>{});
    }else{
      v.style.display = "none";
      // 不 pause，保持缓存热身；也可选择 pause 降低资源
      v.pause();
    }
  });
  current = name;
}

// 兼容性：没有交互也能开始看到 live 的第一帧
window.addEventListener("load", ()=>{
  // 尝试静音自动播一遍加载缓存
  Object.values(videos).forEach(v=>{ v.play().catch(()=>{}); v.pause(); });
});

function windowResized(){}
