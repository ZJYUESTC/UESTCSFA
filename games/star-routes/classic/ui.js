/* UI 层：地图显示、鼠标操作、存档与数据导入。规则仍全部交给 engine.js。 */
(() => {
  'use strict';
  const E=window.GameEngine,$=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
  const DEFAULT=E.validateConfig(window.STAR_MAP),SAVE_KEY='star-routes-save-v4';
  let config=E.clone(DEFAULT),state=E.initialState(config),selected=config.units.find(u=>u.side==='blue').id;
  let focus=null,targetId=null,history=[],inspected=0,busy=false,generation=0,view=null,drag=null,lastError='',hideVictory=false,toastTimer;
  let routeCache=new Map(),healTargetId=null;
  const ROLES={frigate:{label:'护卫舰',mark:'护',tip:'均衡火力，适合抢占航道节点。'},scout:{label:'侦察舰',mark:'侦',tip:'行动力充足，可从外围绕行。'},cruiser:{label:'巡洋舰',mark:'巡',tip:'厚重舰体与装甲，适合正面接敌。'},tender:{label:'支援舰',mark:'援',tip:'维修自己或战术邻接星系内的友舰。'}};
  const role=sp=>ROLES[sp.kind]||ROLES.frigate;
  const typeName=r=>({star:'恒星系',blackhole:'黑洞',pulsar:'脉冲星'})[r.kind];
  const hazard=r=>r.kind==='blackhole'?`引力井：曲速进入 ${r.moveCost} AP；环境减伤 ${r.defense}。超空费用按航道计算。`:r.kind==='pulsar'?'电磁干扰：驻留舰装甲失效；舰体不会自动受损。':`稳定星系：曲速进入 ${r.moveCost} AP。`;
  const living=side=>state.units.filter(u=>u.side===side&&u.hp>0);
  function nextUnit(){const list=living('blue').filter(u=>u.ap>0);if(!list.length){toast('本回合没有剩余行动力，请结束回合。');return;}const i=list.findIndex(u=>u.id===selected);chooseUnit(list[(i+1)%list.length].id);}
  function activeTarget(u){const targets=living('red');return targets.find(t=>t.id===targetId)||targets.find(t=>!E.attackError(config,state,u.id,t.id))||targets[0];}

  const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>v===null?'null':typeof v==='string'?`"${esc(v)}"`:String(v);
  function svg(tag,attrs={},text){const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(text!==undefined)n.textContent=text;return n;}
  function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
  function record(r){history.unshift({...r,round:state.round});history=history.slice(0,100);inspected=0;}
  const actions={move:'跃迁',attack:'开火',guard:'戒备',heal:'维修',endTurn:'结束回合',start:'读取地图',select:'选择星系',save:'保存进度',load:'读取进度'};
  function defaultView(){const v=config.map.viewBox;return Array.isArray(v)&&v.length===4&&v.every(Number.isFinite)&&v[2]>0&&v[3]>0?[...v]:[0,0,config.map.width,config.map.height];}
  function setView(){
    const cx=Math.max(0,Math.min(config.map.width,view[0]+view[2]/2)),cy=Math.max(0,Math.min(config.map.height,view[1]+view[3]/2));
    view[0]=cx-view[2]/2;view[1]=cy-view[3]/2;$('map-svg').setAttribute('viewBox',view.join(' '));$('zoom-label').textContent=Math.round(defaultView()[2]/view[2]*100)+'%';
  }
  function resetView(){view=defaultView();setView();}
  function zoom(factor,anchor){
    const base=defaultView(),newWidth=Math.max(base[2]*.2,Math.min(base[2]*1.2,view[2]*factor)),scale=newWidth/view[2];
    const p=anchor||[view[0]+view[2]/2,view[1]+view[3]/2];view=[p[0]-(p[0]-view[0])*scale,p[1]-(p[1]-view[1])*scale,newWidth,view[3]*scale];setView();
  }
  function focusOnUnit(){const u=E.unit(state,selected)||state.units.find(x=>x.side==='blue'&&x.hp>0);if(!u)return;const p=E.region(config,u.regionId).center;const base=defaultView(),w=Math.min(view[2],base[2]/1.5),h=w*base[3]/base[2];view=[p[0]-w/2,p[1]-h/2,w,h];setView();}
  function connectionPoints(a,b){return[E.region(config,a).center,E.region(config,b).center];}
  function pathPoints(path){const points=[];for(let i=1;i<path.length;i++)points.push(...connectionPoints(path[i-1],path[i]).slice(i===1?0:1));return points;}
  function pathD(points){return points.map((p,i)=>(i?'L':'M')+p.join(',')).join(' ');}
  function buildMap(){
    for(const id of ['starfield','area-layer','edge-layer','hyper-layer','label-layer','units-layer'])$(id).replaceChildren();
    let seed=1927;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<440;i++)$('starfield').append(svg('circle',{cx:rng()*config.map.width,cy:rng()*config.map.height,r:.4+rng()*1.1,fill:i%4===0?'#90b8c5':'#d3dfec',opacity:.12+rng()*.5}));
    for(const e of config.connections)$('edge-layer').append(svg('path',{d:pathD(connectionPoints(e.a,e.b)),class:'warp-edge'}));
    for(const e of config.hyperlanes)$('hyper-layer').append(svg('path',{d:pathD(connectionPoints(e.a,e.b)),class:'hyper-edge'}));
    config.regions.forEach(r=>{
      const g=svg('g',{id:'area-'+r.id,class:'system '+r.kind,transform:`translate(${r.center})`,'data-region':r.id,tabindex:0,role:'button','aria-label':`星系 ${r.name}，${typeName(r)}`});
      g.append(svg('circle',{r:32,class:'hit-zone'}),svg('circle',{r:24,class:'system-ring'}));
      if(r.kind==='blackhole')g.append(svg('ellipse',{rx:21,ry:10,class:'accretion',transform:'rotate(-25)'}),svg('circle',{r:10,class:'black-core'}));
      else if(r.kind==='pulsar')g.append(svg('path',{d:'M-8,-30L8,30M-23,6L23,-6',class:'pulsar-beam'}),svg('circle',{r:13,class:'pulsar-halo'}),svg('circle',{r:6,fill:'#d6ffff'}));
      else{const col={gold:'#ffdb91',blue:'#a3d3ff',white:'#e8e8ee',orange:'#ffa681'}[r.color]||'#ffdb91';g.append(svg('circle',{r:15,fill:col,opacity:.12}),svg('circle',{r:8,fill:col,opacity:.35}),svg('circle',{r:4.7,fill:col}),svg('path',{d:'M-13,0H13M0,-13V13',stroke:col,'stroke-width':1,opacity:.7}));}
      g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseRegion(r.id);}});$('area-layer').append(g);
      const label=svg('g',{id:'label-'+r.id,class:'system-label',transform:`translate(${r.center})`,'pointer-events':'none'});
      label.append(svg('text',{y:39,'text-anchor':'middle'},r.name));if(r.kind!=='star')label.append(svg('text',{y:54,'text-anchor':'middle',class:'object-code'},r.kind==='blackhole'?'BLACK HOLE':'PULSAR'));$('label-layer').append(label);
    });
    const shapes={frigate:'M0,-24L13,5L23,17L6,14L0,22L-6,14L-23,17L-13,5Z',scout:'M0,-26L19,18L0,10L-19,18Z',cruiser:'M0,-26L13,-9L22,-6L22,19L9,13L0,25L-9,13L-22,19L-22,-6L-13,-9Z',tender:'M-7,-23H7L12,-8H23V15H12L8,24H-8L-12,15H-23V-8H-12Z'};
    for(const sp of config.units){
      const g=svg('g',{id:'token-'+sp.id,class:'unit-token','data-unit':sp.id,tabindex:0,role:'button'});
      g.append(svg('circle',{r:34,class:'unit-ring'}),svg('path',{d:shapes[sp.kind],class:'ship-hull',fill:sp.side==='blue'?'#5ccee0':'#ec866d'}),svg('text',{class:'unit-title',y:5},role(sp).mark),svg('text',{class:'unit-count',y:40}),svg('circle',{cx:24,cy:-22,r:4,class:'engine-light '+sp.engine}),svg('text',{class:'guard-icon',x:-30,y:-22},'◇'));
      g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseUnit(sp.id);}});$('units-layer').append(g);
    }
    $('team-stat').textContent=`${config.units.filter(u=>u.side==='blue').length} : ${config.units.filter(u=>u.side==='red').length}`;$('region-count').textContent=config.regions.length;$('edge-count').textContent=config.hyperlanes.length;
    $('network-count').textContent=`${new Set(config.hyperlanes.flatMap(e=>[e.a,e.b])).size} / ${config.regions.length} 节点接入超空网`;resetView();
  }
  function chooseUnit(id){
    const u=E.unit(state,id);if(!u||u.hp<=0)return;
    if(u.side==='blue'){selected=id;focus=u.regionId;targetId=null;healTargetId=null;lastError='';}
    else{targetId=id;focus=u.regionId;lastError='';}
    render();syncRegionInputs();
  }
  function chooseRegion(id){
    if(!E.region(config,id))return;const friendly=E.occupant(state,id);if(friendly?.side==='blue'){chooseUnit(friendly.id);return;}focus=id;lastError='';const occupant=E.occupant(state,id);targetId=occupant?.side==='red'?occupant.id:null;
    render();syncRegionInputs();
  }
  function act(action,ai=false){
    if(busy&&!ai)return null;
    const side=state.activeSide,result=E.transition(config,state,action);state=result.state;lastError=result.ok?'':result.message;
    record({...result,state:undefined,side,input:`${ai?'电脑':'玩家'}发出“${actions[action.type]}”指令。`});
    if(result.ok&&action.type==='move'&&!ai)focus=action.to;
    if(result.ok&&action.type==='heal')toast(result.message);
    if(state.winner)busy=false;render();syncRegionInputs();return result;
  }
  function startAI(){
    const token=++generation;busy=true;render();
    function step(){
      if(token!==generation)return;
      if(state.winner||state.activeSide!=='red'){busy=false;render();return;}
      const action=E.aiAction(config,state);if(!action){busy=false;render();return;}
      const result=act(action,true);if(!result.ok){busy=false;toast(result.message);render();return;}
      if(state.winner||state.activeSide==='blue'){busy=false;render();return;}setTimeout(step,240);
    }setTimeout(step,350);
  }
  function newGame(c=config,message='载入弥光星域：星系、两种航行图与星舰配置由数据生成。'){
    try{const valid=E.validateConfig(c);generation++;busy=false;config=valid;state=E.initialState(config);selected=config.units.find(u=>u.side==='blue').id;focus=null;targetId=null;lastError='';hideVictory=false;healTargetId=null;history=[];
      record({ok:true,action:'start',side:'blue',input:'读取默认或导入的地图 JSON。',check:`${config.regions.length} 个星系 · ${config.connections.length} 段曲速邻接 · ${config.hyperlanes.length} 条超空航道 · ${config.units.length} 艘星舰`,message,changes:[{path:'round',before:null,after:1}]});
      buildMap();render();syncRegionInputs();
    }catch(e){toast('未应用：'+e.message);}
  }
  function renderMap(){
    const u=E.unit(state,selected);routeCache=u?E.paths(config,state,selected):new Map();
    $('edge-layer').style.display=$('show-edges').checked?'':'none';$('hyper-layer').style.display=$('show-hyper').checked?'':'none';
    for(const r of config.regions){const path=routeCache.get(r.id),canReach=u&&u.hp>0&&!busy&&!state.winner&&state.activeSide==='blue'&&path&&path.cost>0&&path.cost<=u.ap;
      $('area-'+r.id).setAttribute('class','system '+r.kind+(canReach?' reachable':'')+(u?.regionId===r.id?' current':'')+(focus===r.id?' focused':''));
      $('label-'+r.id).style.display=($('show-labels').checked||focus===r.id||u?.regionId===r.id)?'':'none';
    }
    $('route-layer').replaceChildren();const route=focus?routeCache.get(focus):null;
    if(route&&route.path.length>1)$('route-layer').append(svg('path',{d:pathD(pathPoints(route.path)),class:'route-line '+route.engine+(route.cost>u.ap?' unaffordable':'')}));
    for(const x of state.units){const g=$('token-'+x.id),p=E.region(config,x.regionId).center;g.setAttribute('transform',`translate(${p[0]+31},${p[1]-29})`);g.style.display=x.hp>0?'':'none';g.setAttribute('class','unit-token'+(x.id===selected?' selected':'')+(x.id===targetId?' targeted':'')+(x.ap===0?' spent':''));g.setAttribute('aria-label',`${E.spec(config,x).name}，${E.driveName(E.spec(config,x).engine)}引擎，${E.region(config,x.regionId).name}，舰体 ${x.hp}，行动力 ${x.ap}`);g.querySelector('.unit-count').textContent=`${x.hp} · ${x.ap}AP`;g.querySelector('.guard-icon').style.display=x.guard?'':'none';}
  }
  function rosterHTML(side){return state.units.filter(x=>x.side===side).map(x=>{const sp=E.spec(config,x);return `<button class="roster-unit ${x.id===selected?'chosen':''} ${x.id===targetId?'enemy-chosen':''} ${x.hp<=0?'fallen':''}" ${x.hp<=0?'disabled':''} data-${side==='blue'?'select-unit':'target'}="${esc(x.id)}" aria-pressed="${x.id===(side==='blue'?selected:targetId)}" aria-label="${side==='blue'?'选择':'目标'}${esc(sp.name)}"><span class="role-badge ${esc(sp.kind)}">${role(sp).mark}</span><span class="roster-copy"><b>${esc(sp.name.replace('蓝方','').replace('红方',''))}</b><em class="drive-badge ${sp.engine}">${E.driveName(sp.engine)}</em><small>${x.hp>0?`${x.hp}/${sp.maxHp} HP · ${x.ap}/${sp.maxAp} AP`:'已撤出'}</small><span class="hp-track"><i style="width:${x.hp/sp.maxHp*100}%"></i></span></span></button>`;}).join('');}
  function renderUnit(){
    let u=E.unit(state,selected);if(!u||u.hp<=0){u=living('blue').find(x=>x.ap>0)||living('blue')[0]||state.units.find(x=>x.side==='blue');if(selected!==u?.id){focus=u?.regionId;targetId=null;healTargetId=null;}selected=u?.id;}
    if(!u)return;const sp=E.spec(config,u),ready=living('blue').filter(x=>x.ap>0).length;
    $('squad-roster').innerHTML=rosterHTML('blue');$('squad-count').textContent=`${living('blue').length}/${state.units.filter(x=>x.side==='blue').length} 存活 · ${ready} 艘有行动力`;
    $('next-unit').disabled=Boolean(busy||state.winner||!ready);
    $('unit-card').innerHTML=`<div class="unit-top"><span class="unit-icon ${esc(sp.kind)}">${role(sp).mark}</span><div><b>${esc(sp.name.replace('蓝方','').replace('红方',''))}</b><small>${esc(E.region(config,u.regionId).name)} · ${u.hp<=0?'已撤出':u.guard?'防御中':u.ap===0?'行动力用尽':'已选中'}</small></div></div><div class="unit-values"><div><span>舰体 HP</span><b>${u.hp}<small> / ${sp.maxHp}</small></b></div><div><span>行动力 AP</span><b>${u.ap}<small> / ${sp.maxAp}</small></b></div><div><span>攻击 / 护甲</span><b>${sp.attack}<small> / ${E.armorValue(config,u)}</small></b></div></div><div class="drive-banner ${sp.engine}"><span>${E.driveName(sp.engine)}引擎</span><small>${sp.engine==='hyper'?'仅限青色航道 · 默认每段 1 AP':'普通邻接 · 标准 3 AP / 黑洞 4 AP'}</small></div><p class="role-description">${role(sp).tip}${E.region(config,u.regionId).kind==='pulsar'?' 当前脉冲星使装甲失效。':''}${sp.armor?' 基础装甲 '+sp.armor+'（脉冲星内无效）。':''}</p>`;
    const t=activeTarget(u),err=t?E.attackError(config,state,selected,t.id):'没有存活敌舰。';
    $('attack-btn').disabled=Boolean(busy||state.winner||err);$('attack-btn').title=err||'攻击已选定的敌舰';
    $('attack-target').textContent=t?`攻击目标：${E.spec(config,t).name} · ${E.region(config,t.regionId).name}`:'敌方已全部撤出';
    $('attack-hint').textContent=err||'可以攻击 · 消耗 2 行动力';
    $('guard-btn').disabled=Boolean(busy||state.winner||u.ap<1||u.hp<=0);$('end-btn').disabled=Boolean(busy||state.winner);$('end-btn').innerHTML=busy?'红方舰队行动中…':`结束全队回合 <span>→</span>`;
    $('turn-hint').textContent=busy?'红方正在逐舰行动。':state.winner?'对局结束。':ready?`还有 ${ready} 艘星舰有行动力；可切换操作，也可直接结束。`:'本方行动力已用尽，可以结束回合。';
    $('save-btn').disabled=busy;$('load-btn').disabled=busy;
    $('enemy-count').textContent=`红方阵容 · ${living('red').length}/${state.units.filter(x=>x.side==='red').length} 存活`;
    $('opponent').innerHTML=rosterHTML('red');
    $('edit-engine').value=sp.engine;$('edit-ship-label').textContent=sp.name;
    $('heal-panel').hidden=!(sp.healAmount>0);
    if(sp.healAmount>0){
      const allies=living('blue'),valid=allies.filter(x=>!E.healError(config,state,u.id,x.id));
      if(!allies.some(x=>x.id===healTargetId))healTargetId=valid[0]?.id||u.id;
      $('heal-target').innerHTML=allies.map(x=>`<option value="${esc(x.id)}">${esc(E.spec(config,x).name)} · ${x.hp}/${E.spec(config,x).maxHp}${x.id===u.id?'（自身）':''}</option>`).join('');$('heal-target').value=healTargetId;
      const healingError=E.healError(config,state,u.id,healTargetId);
      $('heal-btn').disabled=Boolean(busy||state.winner||healingError);$('heal-btn').textContent=`维修 +${sp.healAmount} · 2 行动力`;
      $('heal-supply').textContent=`维修物资 ${u.healsLeft}/${sp.maxHeals} · 本回合${u.healUsed?'已使用':'未使用'}`;
      $('heal-hint').textContent=healingError||'自身或相邻连通星系 · 每艘支援舰每回合一次';
    }
  }
  function renderDestination(){
    const u=E.unit(state,selected),sp=E.spec(config,u),r=focus?E.region(config,focus):null;let err='',route=r?routeCache.get(r.id):null;
    if(!r){$('destination').innerHTML='<p class="empty-text">点击一个星系，预览本舰航路与引擎差异。</p>';$('move-btn').textContent='选择目的星系';$('move-btn').disabled=true;}
    else{
      err=E.moveError(config,state,selected,r.id);
      const compare=['warp','hyper'].map(d=>{const x=E.paths(config,state,selected,d).get(r.id);return `<div class="${d}"><span>${E.driveName(d)}</span><b>${x?x.cost+' AP':'不可达'}</b></div>`;}).join('');
      $('destination').innerHTML=`<div class="destination-title"><strong>${esc(r.name)}</strong><span class="terrain-tag ${r.kind}">${typeName(r)}</span></div><p class="destination-meta">${hazard(r)}</p>${route&&route.path.length>1?`<div class="route-steps">${route.path.map(id=>esc(E.region(config,id).name)).join(' → ')}</div><div class="route-cost ${route.cost>u.ap?'expensive':''}">${E.driveName(sp.engine)}跃迁 <b>${route.cost} AP</b><small> / 当前 ${u.ap} AP</small></div>`:`<p class="route-steps">${esc(r.id===u.regionId?'当前位置。':err||'查看星系。')}</p>`}<div class="engine-comparison">${compare}</div><div class="compare-note">同一位置与占位下的两引擎比较；本舰仅执行${E.driveName(sp.engine)}航行。</div>`;
      $('move-btn').disabled=Boolean(err||busy||state.winner);$('move-btn').textContent=r.id===u.regionId?'本舰已在这里':!route?'本舰引擎无法到达':route.cost>u.ap?'本回合行动力不足':`${E.driveName(sp.engine)}跃迁 · ${route.cost} AP`;
    }
    let hint=!r?`${sp.name} · ${E.driveName(sp.engine)}引擎。选择目的星系查看航路。`:r.id===u.regionId?`当前位于${r.name}。${hazard(r)}`:err||`${E.driveName(sp.engine)}航路：${route.path.length-1} 次跳跃，消耗 ${route.cost} AP。`;
    if(busy)hint='红方舰队正在按各自的引擎、行动力与战术射程行动。';if(state.winner)hint='对局结束。仍可浏览星图与配置。';
    $('route-status').textContent=lastError||hint;$('route-status').classList.toggle('error',Boolean(lastError||(!busy&&!state.winner&&err&&r?.id!==u.regionId)));
  }
  function detailRegion(){return E.region(config,focus||E.unit(state,selected)?.regionId||config.regions[0].id);}
  function syncRegionInputs(){const r=detailRegion();if(r){$('edit-cost').value=r.moveCost;$('edit-defense').value=r.defense;$('edit-type').value=r.kind;}}
  function renderRegion(){
    const r=detailRegion();if(!r)return;const warp=E.neighbors(config,r.id),hyper=E.movementNeighbors(config,r.id,'hyper');
    const links=(list,drive)=>list.length?list.map(n=>`<button data-region-jump="${esc(n.id)}">${esc(E.region(config,n.id).name)} <small>${E.stepCost(config,n.id,n.edge,drive)} AP</small></button>`).join(''):'<span class="muted">未接入超空间航道，仅曲速舰可以到访。</span>';
    $('region-detail').innerHTML=`<div class="region-heading"><span>${esc(r.id.toUpperCase())}</span><h3>${esc(r.name)}</h3><em class="terrain-tag ${r.kind}">${typeName(r)}</em></div><p class="panel-intro">${hazard(r)}</p><div class="region-meta"><div>曲速邻接<b>${warp.length}</b></div><div>超空航道<b>${hyper.length}</b></div></div><div class="caption warp-text">曲速邻接 · 也决定战术射程</div><div class="neighbors">${links(warp,'warp')}</div><div class="caption hyper-text">超空间航道 · 双向通行</div><div class="neighbors">${links(hyper,'hyper')}</div>`;$('region-json').textContent=JSON.stringify(r,null,2);
  }
  function renderLog(){
    const r=history[inspected]||history[0];if(!r)return;
    $('pipeline').innerHTML=`<div class="pipeline-step"><span>1</span><div><b>接收指令</b><p>${esc(r.input||actions[r.action]||'查看数据')}</p></div></div><div class="pipeline-step"><span>2</span><div><b>检查规则</b><p>${esc(r.check||'')}</p></div></div><div class="pipeline-step"><span>3</span><div><b>修改状态</b>${r.changes?.length?'<div class="diff">'+r.changes.map(d=>`${esc(d.path)}<br>${fmt(d.before)} → ${fmt(d.after)}`).join('<br>')+'</div>':'<p>游戏状态没有改变。</p>'}</div></div><div class="pipeline-step"><span>4</span><div><b>更新画面</b><p>${esc(r.message)}</p></div></div>`;
    $('history').innerHTML=history.map((h,i)=>`<button class="log-item ${h.side==='red'?'red':''} ${i===inspected?'active':''}" data-record="${i}">R${h.round} · ${esc(h.message)}</button>`).join('');$('state-json').textContent=JSON.stringify(state,null,2);
  }
  function render(){
    renderUnit();renderMap();renderDestination();renderRegion();renderLog();
    $('turn-label').textContent=`第 ${state.round} 回合 · ${state.winner?(state.winner==='blue'?'蓝方获胜':'红方获胜'):state.activeSide==='blue'?'蓝方行动':'红方行动'}`;
    $('phase-label').textContent=busy?'电脑决策中':state.winner?'已结束':`${living('blue').length} 对 ${living('red').length}`;document.querySelector('.map-header').classList.toggle('busy',busy);
    $('victory').hidden=!state.winner||hideVictory;
    if(state.winner){$('victory-title').textContent=state.winner==='blue'?'蓝方获胜':'红方获胜';$('victory-text').textContent=`本局进行了 ${state.round} 回合。可以重新开始，也可以继续查看地图与运行记录。`;}
  }
  function showTab(name){document.querySelectorAll('[data-tab]').forEach(b=>{const on=b.dataset.tab===name;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on));$('panel-'+b.dataset.tab).hidden=!on;});}
  function download(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);}
  // 鼠标位置通过 SVG 坐标变换映射到星图坐标，缩放后点击仍然准确。
  const mapSvg=$('map-svg');
  mapSvg.addEventListener('pointerdown',e=>{if(e.button!==0)return;const matrix=mapSvg.getScreenCTM().inverse(),p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix);drag={id:e.pointerId,x:e.clientX,y:e.clientY,p,matrix,view:[...view],moved:false,target:e.target};mapSvg.setPointerCapture(e.pointerId);});
  mapSvg.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>5)drag.moved=true;if(drag.moved){const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(drag.matrix);view=[drag.view[0]-(p.x-drag.p.x),drag.view[1]-(p.y-drag.p.y),drag.view[2],drag.view[3]];mapSvg.classList.add('dragging');setView();}});
  mapSvg.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.id)return;const d=drag;drag=null;mapSvg.classList.remove('dragging');if(mapSvg.hasPointerCapture(e.pointerId))mapSvg.releasePointerCapture(e.pointerId);if(!d.moved){const t=d.target.closest('[data-unit]')||d.target.closest('[data-region]');if(t?.dataset.unit)chooseUnit(t.dataset.unit);else if(t?.dataset.region)chooseRegion(t.dataset.region);}});
  mapSvg.addEventListener('pointercancel',()=>{drag=null;mapSvg.classList.remove('dragging');});
  mapSvg.addEventListener('wheel',e=>{e.preventDefault();const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(mapSvg.getScreenCTM().inverse());zoom(e.deltaY>0?1.16:1/1.16,[p.x,p.y]);},{passive:false});
  $('zoom-in').onclick=()=>zoom(1/1.25);$('zoom-out').onclick=()=>zoom(1.25);$('zoom-reset').onclick=resetView;$('focus-unit').onclick=focusOnUnit;
  for(const id of ['show-hyper','show-edges','show-labels'])$(id).onchange=renderMap;
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
  $('squad-roster').onclick=e=>{const b=e.target.closest('[data-select-unit]');if(b)chooseUnit(b.dataset.selectUnit);};
  $('opponent').onclick=e=>{const b=e.target.closest('[data-target]');if(b)chooseUnit(b.dataset.target);};
  $('region-detail').onclick=e=>{const b=e.target.closest('[data-region-jump]');if(b)chooseRegion(b.dataset.regionJump);};
  $('move-btn').onclick=()=>{if(focus)act({type:'move',unitId:selected,to:focus});};
  $('attack-btn').onclick=()=>{const t=activeTarget(E.unit(state,selected));if(t)act({type:'attack',unitId:selected,targetId:t.id});};
  $('next-unit').onclick=nextUnit;
  $('heal-target').onchange=e=>{healTargetId=e.target.value;renderUnit();};
  $('heal-btn').onclick=()=>act({type:'heal',unitId:selected,targetId:healTargetId});
  $('guard-btn').onclick=()=>act({type:'guard',unitId:selected});
  $('end-btn').onclick=()=>{const r=act({type:'endTurn'});if(r?.ok&&state.activeSide==='red')startAI();};
  $('reset-btn').onclick=()=>{if(confirm('重新开始当前地图？尚未保存的对局进度会丢失。'))newGame();};
  $('new-game-victory').onclick=()=>newGame();$('continue-map').onclick=()=>{hideVictory=true;render();};
  $('save-btn').onclick=()=>{try{localStorage.setItem(SAVE_KEY,JSON.stringify({format:SAVE_KEY,config,state}));toast('已保存到当前浏览器。');record({ok:true,side:'blue',action:'save',input:'点击保存进度。',check:'保存配置、局面及骰子状态',message:'已保存两套航行网络、引擎配置和舰队状态。',changes:[]});renderLog();}catch(e){toast('浏览器未允许本地存储，保存失败。');}};
  $('load-btn').onclick=()=>{try{const raw=localStorage.getItem(SAVE_KEY);if(!raw){toast('还没有弥光星图版的存档。');return;}const loaded=E.validateSave(JSON.parse(raw));generation++;busy=false;config=loaded.config;state=loaded.state;selected=state.units.find(u=>u.side==='blue'&&u.hp>0)?.id||config.units.find(u=>u.side==='blue').id;focus=null;targetId=null;lastError='';hideVictory=false;healTargetId=null;history=[];record({ok:true,side:state.activeSide,action:'load',input:'读取浏览器存档。',check:'配置与局面校验通过',message:'已恢复存档中的地图数据与星舰状态。',changes:[]});buildMap();render();syncRegionInputs();toast('进度已恢复。');if(state.activeSide==='red'&&!state.winner)startAI();}catch(e){toast('无法读取：'+e.message);}};
  $('history').onclick=e=>{const b=e.target.closest('[data-record]');if(b){inspected=Number(b.dataset.record);renderLog();}};
  $('apply-region').onclick=()=>{try{const c=E.clone(config),r=E.region(c,detailRegion().id);r.kind=$('edit-type').value;r.terrain=typeName(r);r.moveCost=Number($('edit-cost').value);r.defense=Number($('edit-defense').value);E.validateConfig(c);const id=r.id;newGame(c,'使用修改后的星系成本与防御，开始新的一局。');focus=id;render();syncRegionInputs();toast('参数已应用，对局已重新开始。');}catch(e){toast(e.message);}};
  $('edit-type').onchange=()=>{const k=$('edit-type').value;$('edit-cost').value=k==='blackhole'?4:3;$('edit-defense').value=k==='blackhole'?1:0;};
  $('apply-engine').onclick=()=>{try{const c=E.clone(config),sp=c.units.find(u=>u.id===selected);sp.engine=$('edit-engine').value;E.validateConfig(c);newGame(c,'更换星舰引擎后重新开局。');toast('引擎已更换并重新开局。');}catch(e){toast(e.message);}};
  $('export-map').onclick=()=>download('map.json',config);
  $('import-map').onclick=()=>$('map-file').click();
  $('map-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>2*1024*1024)throw Error('JSON 超过 2 MB，请缩小地图文件。');const c=E.validateConfig(JSON.parse(await f.text()));newGame(c,'导入自定义地图数据，重建星系、连接与开局。');toast(`已导入 ${c.regions.length} 个星系、${c.units.length} 艘星舰，开始新的一局。`);}catch(err){toast('地图未导入：'+err.message);}finally{e.target.value='';}};
  $('restore-map').onclick=()=>{if(confirm('恢复默认弥光星图并重新开局？'))newGame(DEFAULT);};
  $('help-open').onclick=()=>$('help').showModal();$('help-close').onclick=()=>$('help').close();$('help-done').onclick=()=>$('help').close();
  newGame();
})();
