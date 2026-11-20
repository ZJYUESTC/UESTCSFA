/* 用户在原界面发令。箭头只负责定位；规则层确认行动后才翻页。 */
window.FlightSchool=function(hooks){
  const $=id=>document.getElementById(id),panel=$('lesson-guide'),arrow=$('lesson-arrow');
  let key=null,index=0,target=null,frame=null,suspended=false,feedback='';
  const course=()=>key&&window.Academy.library[key],step=()=>course()?.steps[index];
  const active=()=>key!==null;
  function clearTarget(){
    if(target){target.removeAttribute('data-guided');target.removeAttribute('data-expect');target=null;}
    arrow.hidden=true;
    document.querySelector('.lesson-dialog-tip')?.remove();
  }
  function position(){
    frame=null;
    if(!target||!target.isConnected||suspended||arrow.hidden)return;
    const b=target.getBoundingClientRect(),side=b.left>80?'left':'right';
    arrow.style.left=(side==='left'?b.left-36:b.right+4)+'px';
    arrow.style.top=Math.max(3,Math.min(innerHeight-27,b.top+b.height/2-12))+'px';
    arrow.classList.toggle('reverse',side==='right');
    panel.classList.remove('guide-at-top');
    const box=panel.getBoundingClientRect();
    if(b.bottom>box.top-10&&b.right>box.left&&b.left<box.right)panel.classList.add('guide-at-top');
  }
  function schedule(){if(frame==null&&active())frame=requestAnimationFrame(position);}
  function mark(){
    clearTarget();const instruction=step();
    if(!instruction||suspended)return;
    target=document.querySelector(instruction.target);if(!target)return;
    target.dataset.guided='true';
    if(target.tagName==='SELECT')target.dataset.expect=instruction.value;
    const dialog=target.closest('dialog[open]');
    (dialog||document.body).append(arrow);
    if(dialog){
      const tip=document.createElement('p');tip.className='lesson-dialog-tip';tip.textContent=instruction.text;
      if(dialog.id==='deck')dialog.querySelector('.deck-head').after(tip);
      else target.parentNode.insertBefore(tip,target);
    }
    if(target.closest('.inspector,.fleet-outliner'))target.scrollIntoView({block:'nearest',inline:'nearest'});
    arrow.hidden=false;position();
  }
  function show(){
    const c=course();if(!c)return;
    const current=step();
    if(!current&&suspended){clearTarget();$('lesson-heading').textContent='正在结算演习';$('lesson-instruction').textContent='等待本回合作业结算。';return;}
    panel.hidden=false;panel.classList.remove('guide-at-top');panel.classList.toggle('lesson-complete',!current);
    $('lesson-count').textContent=current?(index+1)+' / '+c.steps.length:'演习完成';
    $('lesson-name').textContent=c.name;$('lesson-heading').textContent=current?current.title:'演习完成';
    $('lesson-instruction').textContent=current?current.text:c.summary;
    $('lesson-feedback').textContent=feedback;
    $('lesson-next').hidden=!!current;$('lesson-next').textContent=key==='routes'?'进入双锚试炮':'返回主菜单';
    $('lesson-retry').hidden=!!current;
    if(!current){clearTarget();return;}
    if(!suspended)hooks.prepare(current);
    mark();
  }
  function signal(event,value,message){
    const current=step();if(!current||current.event!==event||current.value!==value)return;
    feedback=message||'';index++;show();
  }
  function start(id){key=id;index=0;suspended=false;feedback='';document.body.classList.add('in-lesson');show();}
  function stop(){clearTarget();document.body.append(arrow);panel.hidden=true;key=null;suspended=false;feedback='';document.body.classList.remove('in-lesson');}
  function pause(v){
    if(!active())return;suspended=v;
    if(v){clearTarget();return;}
    show();
  }
  function allowed(e){
    if(!active())return true;
    if(e.target.closest('#lesson-exit,#lesson-next,#lesson-retry,[data-music-toggle]'))return true;
    const current=step();
    if(suspended||!current)return false;
    if(e.target.closest(current.target))return true;
    // 星系上方的编队徽标也可作为该星系的入口。
    return current.event==='star'&&e.target.closest('[data-fleet-region]')?.dataset.fleetRegion===current.value;
  }
  function filter(e){
    if(!active())return;
    if(e.type==='keydown'&&e.key==='Tab')return;
    if(e.type==='keydown'&&e.key==='Escape'&&e.target.closest('dialog[open]'))return;
    if(!allowed(e)){e.preventDefault();e.stopImmediatePropagation();return;}
    const current=step();
    if(!current||current.event!=='control'||!e.target.closest(current.target))return;
    const el=e.target.closest(current.target);
    if((el.tagName==='SELECT'&&e.type==='change')||(el.tagName!=='SELECT'&&e.type==='click')){
      setTimeout(()=>{if(step()===current&&(el.tagName!=='SELECT'||el.value===current.value))signal('control',current.value);else if(step()===current)mark();});
    }
  }
  for(const name of ['click','keydown','change'])document.addEventListener(name,filter,true);
  // 原地图在 pointerup 时下达选择，独立于普通按钮的 click。
  $('map-svg').addEventListener('pointerdown',e=>{if(active()&&!allowed(e)){e.stopImmediatePropagation();e.preventDefault();}},true);
  window.addEventListener('resize',schedule);document.addEventListener('scroll',schedule,true);
  $('lesson-exit').onclick=()=>hooks.exit();
  $('lesson-retry').onclick=()=>hooks.launch(key);
  $('lesson-next').onclick=()=>key==='routes'?hooks.launch('gunnery'):hooks.exit();
  return {active,step,start,stop,signal,pause,mark};
};
