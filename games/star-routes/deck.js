/* 各舱定位采用对应美术原图的归一化坐标。读数全部来自当前局面。 */
window.ShipDeck=(()=>{
  const E=window.GameEngine,F=window.FleetData,C=window.Campaign;
  const $=id=>document.getElementById(id);
  const stations={
    scout:[[74,51],[53,51],[14,51],[31,51]],tender:[[87,50],[48,51],[15,45],[26,50]],
    frigate:[[84,50],[56,50],[15,50],[29,50]],destroyer:[[84,50],[43,50],[12,39],[26,50]],
    cruiser:[[90,52],[56,50],[12,50],[27,51]],battleship:[[91,51],[48,50],[12,51],[26,52]]
  };
  let current=null,room=0,sceneKey='';
  function close(){if($('deck').open)$('deck').close();}
  function open(c,s,id){
    const u=E.unit(s,id);if(!u||E.isFixed(E.spec(c,u).kind))return;
    current=id;room=0;sceneKey='';render(c,s);if(!$('deck').open)$('deck').showModal();
  }
  function render(c,s){
    if(!current)return;
    const u=E.unit(s,current);if(!u){close();return;}
    const sp=E.spec(c,u),f=C.factionFor(c,u.side),kind=sp.kind,tender=kind==='tender';
    const rooms=['舰桥',tender?'维修作业区':'火控室','轮机舱','超光速引擎舱'];
    $('deck-title').textContent=sp.name;
    $('deck-class').textContent=f.fleet+'　/　'+F.hulls[kind][0]+'　/　'+E.region(c,u.regionId).name;
    $('deck').style.setProperty('--livery',f.color);
    const select=$('deck-vessel');
    if(sceneKey!==s.units.map(v=>v.id).join('|')){
      select.replaceChildren();
      for(const side of ['player','enemy']){
        const group=document.createElement('optgroup');group.label=C.factionFor(c,side).name+(side==='player'?' · 己方':' · 对手');
        for(const v of s.units.filter(v=>v.side===side&&!E.isFixed(E.spec(c,v).kind))){
          const o=new Option([E.spec(c,v).pennant,E.spec(c,v).callsign].filter(Boolean).join(' ')+' · '+F.hulls[E.spec(c,v).kind][0],v.id);group.append(o);
        }
        select.append(group);
      }
      sceneKey=s.units.map(v=>v.id).join('|');
    }
    select.value=current;select.onchange=()=>{current=select.value;room=0;render(c,s);};
    const img=$('deck-art');img.src='hulls/'+kind+'.webp';img.alt=F.hulls[kind][0]+'舰体俯视剖面，舰艏向右';
    const pins=$('deck-pins');pins.replaceChildren();
    rooms.forEach((label,i)=>{
      const b=document.createElement('button'),[x,y]=stations[kind][i];
      b.className='deck-pin '+(i===room?'active':'');b.style.left=x+'%';b.style.top=y+'%';
      b.setAttribute('aria-label',label);b.setAttribute('aria-pressed',String(i===room));
      const text=document.createElement('span');text.textContent=label;b.append(text);
      b.onclick=()=>{room=i;render(c,s);pins.children[i].focus({preventScroll:true});};pins.append(b);
    });
    const title=$('room-title'),lines=$('room-data'),note=$('room-note');title.textContent=rooms[room];lines.replaceChildren();
    function line(label,value){
      const term=document.createElement('dt'),detail=document.createElement('dd');term.textContent=label;detail.textContent=value;lines.append(term,detail);
    }
    if(room===0){
      line('船体完整度',u.hp+' / '+sp.maxHp+' HP');line('有效装甲',E.armorValue(c,u)+' / '+sp.armor);
      line('紧急跃迁',u.retreatUsed?'机会已用尽':E.retreatChance(c,u)+'% · 剩余一次');
      note.textContent=u.hp<=0?'舰体损失':u.job==='resupply'?'补给收集中':u.job==='selfRepair'?'损管人员正在抢修舰体':'舰桥汇总外壳完整度与损害管制报告。';
    }else if(room===1){
      for(const [i,g] of sp.guns.entries()){
        line(tender?'维修队':String(i+1).padStart(2,'0')+' 炮位',F.equipment({...sp,faction:f.id},g.model)+' · '+g.label);
        line(tender?'可用出动次数':'武器状态',tender?u.fp[g.id]+' / '+g.capacity:u.fp[g.id]+' / '+g.capacity+' FP　·　攻 '+g.attack+'　伤 '+g.damage);
      }
      if(tender)line('维修补给',u.healsLeft+' / '+sp.maxHeals);
      note.textContent=tender?'每次出动修复目标最大船体的 60%，至少 8 HP。重新收集补给需一整个回合。':'每门舰炮独立计次。命中先比较骰点与修正攻击力，再结算护甲和环境减伤。';
    }else if(room===2){
      line('亚光速引擎',F.equipment({...sp,faction:f.id},sp.thruster));line('剩余机动',u.mp+' / '+sp.maxMp+' MP');line('有效闪避',u.evasion);
      note.textContent='机动点供单发瞄准与机动规避共用。每次遭到射击后，剩余闪避减一。';
    }else{
      line('超光速引擎',F.equipment({...sp,faction:f.id},sp.engine)+' · '+E.driveName(sp.engine));line('跃迁行动力',u.ap+' / '+sp.maxAp+' AP');
      line('引擎状态',u.unstable?'离轨失稳':'稳定');
      note.textContent=sp.engine==='hyper'?'沿航道每段 1 AP，离轨每段 2 AP。离轨后瞄准及规避锁定，开火门槛降低 2。':'沿曲速邻接跃迁，费用取决于目的地地形。所有超空间航道的两端也可曲速直达。';
    }
    $('deck-flag').src='flags/'+f.id+'.svg';
  }
  $('deck-close').onclick=close;$('deck').addEventListener('close',()=>{current=null;});
  return {open,render,close};
})();
