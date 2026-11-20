/* 本地循环原声。三个场景共用一个播放器，游戏逻辑无需等待音频。 */
window.FleetMusic=(()=>{
  'use strict';
  const titles={chart:'星图探索',transit:'航道跃迁',battle:'舰队交战'};
  const audio=document.getElementById('score-player');
  const buttons=document.querySelectorAll('[data-music-toggle]');
  const preference='star-routes.music.enabled';
  let enabled=true;
  try{enabled=localStorage.getItem(preference)!=='off';}catch{}
  let activated=false,blocked=false,contact=false;
  let transitUntil=0,battleUntil=0,timer=0,frame=0,playRequest=0;
  let desired='chart',loaded=null;
  const resumeAt={};
  const level=.48;
  audio.volume=0;
  const audible=()=>enabled&&activated&&!blocked&&!document.hidden;

  function updateButtons(){
    const on=enabled&&activated&&!blocked;
    for(const button of buttons){
      button.setAttribute('aria-pressed',String(on));
      button.setAttribute('aria-label',on?'静音背景音乐':'播放背景音乐');
      button.title=on?titles[desired]+' · 点击静音':'播放背景音乐';
      button.querySelector('.music-muted').hidden=on;
    }
  }
  function pause(){
    ++playRequest;cancelAnimationFrame(frame);
    audio.pause();audio.volume=0;
  }
  function fade(to,duration,after){
    cancelAnimationFrame(frame);
    const from=audio.volume,start=performance.now();
    function advance(now){
      const t=Math.min(1,(now-start)/duration);
      audio.volume=Math.max(0,Math.min(1,from+(to-from)*t));
      if(t<1)frame=requestAnimationFrame(advance);
      else if(after)after();
    }
    frame=requestAnimationFrame(advance);
  }
  function playDesired(){
    if(!audible())return;
    if(loaded!==desired){
      if(loaded&&audio.readyState>=1)resumeAt[loaded]=audio.currentTime;
      audio.pause();loaded=desired;
      audio.src='music/'+loaded+'.ogg';
      // 设置初始播放位置，浏览器会在文件就绪后跳到这一处。
      audio.currentTime=resumeAt[loaded]||0;
    }
    const request=++playRequest;
    audio.play().then(()=>{
      if(request===playRequest&&audible())fade(level,560);
    }).catch(error=>{
      if(request!==playRequest||error.name==='AbortError')return;
      blocked=true;pause();updateButtons();
    });
  }
  function select(next){
    if(next===desired)return;
    desired=next;updateButtons();
    if(!audible())return;
    ++playRequest;
    if(audio.paused||audio.volume===0){cancelAnimationFrame(frame);playDesired();}
    else fade(0,400,playDesired);
  }
  function settle(){
    clearTimeout(timer);
    const now=Date.now();
    const inBattle=contact||now<battleUntil;
    select(inBattle?'battle':now<transitUntil?'transit':'chart');
    if(contact)return;
    const expires=inBattle?battleUntil:transitUntil;
    if(expires>now)timer=setTimeout(settle,expires-now+1);
  }
  function update(state,cue){
    if(!state||state.winner){reset();return;}
    const friendly=new Set(state.units.filter(u=>u.hp>0&&u.side==='player').map(u=>u.regionId));
    contact=state.units.some(u=>u.hp>0&&u.side==='enemy'&&friendly.has(u.regionId));
    if(cue==='move')transitUntil=Date.now()+24000;
    if(cue==='attack')battleUntil=Date.now()+14000;
    settle();
  }
  function reset(){
    transitUntil=0;battleUntil=0;contact=false;settle();
  }
  function activate(){
    activated=true;blocked=false;updateButtons();playDesired();
  }
  function onGesture(event){
    if(event.target.closest?.('[data-music-toggle]')||!enabled||(activated&&!blocked))return;
    if(event.type==='keydown'&&(event.repeat||!['Enter',' '].includes(event.key)))return;
    activate();
  }
  for(const button of buttons)button.addEventListener('click',()=>{
    enabled=!(enabled&&activated&&!blocked);
    try{localStorage.setItem(preference,enabled?'on':'off');}catch{}
    if(enabled)activate();else{pause();updateButtons();}
  });
  document.addEventListener('click',onGesture,true);
  document.addEventListener('keydown',onGesture,true);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)pause();else{settle();if(audible())playDesired();}
  });
  window.addEventListener('pagehide',pause);
  window.addEventListener('pageshow',()=>{if(audible())playDesired();});
  updateButtons();
  return {reset,update};
})();
