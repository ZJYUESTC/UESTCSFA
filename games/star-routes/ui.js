/* UI 层：地图显示、鼠标操作、存档与数据导入。规则仍全部交给 engine.js。 */
(() => {
  'use strict';
  const E=window.GameEngine,$=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
  const A=window.FleetArt,C=window.Campaign;
  const shortName=sp=>sp.callsign||sp.name;
  const DEFAULT=E.validateConfig(window.STAR_MAP);
  let config=E.clone(DEFAULT),state=null,selected=config.units.find(u=>u.side==='player').id;
  let focus=null,targetId=null,history=[],inspected=0,busy=false,generation=0,view=null,drag=null,lastError='',hideVictory=false,toastTimer;
  let gameActive=false,menuPlayer='china',menuEnemy='random',menuDefender='enemy';
  let routeCache=new Map(),healTargetId=null;
  const F=window.FleetData;
  let flight=null,trainingId=null,menuBeforeTraining=null;
  const coach=window.FlightSchool({prepare:prepareLessonStep,exit:exitLesson,launch:startLesson});
  const ROLES={destroyer:{label:'驱逐舰',mark:'驱'},battleship:{label:'战列舰',mark:'战'},station:{label:'司令部空间站',mark:'站',tip:'守方的战役目标。'},battery:{label:'固定防御平台',mark:'台',tip:'负责本星系炮火防御。'},frigate:{label:'护卫舰',mark:'护',tip:'均衡火力，适合抢占航道节点。'},scout:{label:'侦察舰',mark:'侦',tip:'行动力充足，可从外围绕行。'},cruiser:{label:'巡洋舰',mark:'巡',tip:'厚重舰体与装甲，适合正面接敌。'},tender:{label:'支援舰',mark:'援',tip:'维修自己或本星系内的友舰。'}};
  const shapes={destroyer:'M0,-26L9,-6L17,-19L14,17L4,22L0,12L-4,22L-14,17L-17,-19L-9,-6Z',battleship:'M0,-29L18,-15L24,10L19,23L7,20L0,26L-7,20L-19,23L-24,10L-18,-15Z',station:'M0,-27L24,-14V14L0,27L-24,14V-14Z',battery:'M-20,-20H20V20H-20Z',frigate:'M0,-24L13,5L23,17L6,14L0,22L-6,14L-23,17L-13,5Z',scout:'M0,-26L19,18L0,10L-19,18Z',cruiser:'M0,-26L13,-9L22,-6L22,19L9,13L0,25L-9,13L-22,19L-22,-6L-13,-9Z',tender:'M-7,-23H7L12,-8H23V15H12L8,24H-8L-12,15H-23V-8H-12Z'};
  const role=sp=>ROLES[sp.kind]||ROLES.frigate;
  const typeName=r=>C.atlas.label(r.star);
  const ownerName=side=>side?C.factionFor(config,side).name:'中立';
  const hazard=r=>r.kind==='blackhole'?`引力井：曲速离开航道进入需 ${r.moveCost} AP；环境减伤 ${r.defense}。瞄准或闪避每点需 2 MP，撤退率降低 25 个百分点。`:r.kind==='pulsar'?'脉冲星：有效装甲为零，单发瞄准最多 +1。':`曲速沿航道 2 AP，普通航路进入需 ${r.moveCost} AP。`;
  const living=side=>state.units.filter(u=>u.side===side&&u.hp>0);
  const canAct=u=>!u.job&&(u.ap>0||(!u.unstable&&!u.evaded&&u.mp>0)||
    (Object.values(u.fp).some(n=>n>0)&&(E.spec(config,u).kind==='tender'?
      E.occupants(state,u.regionId).some(t=>!E.healError(config,state,u.id,t.id)):E.targets(state,u.id).length>0)));
  function nextUnit(){const list=living('player').filter(canAct);if(!list.length){toast('本回合没有可执行指令的单位，请结束回合。');return;}const i=list.findIndex(u=>u.id===selected);chooseUnit(list[(i+1)%list.length].id);}
  function activeTarget(u){const choices=u?E.targets(state,u.id):[];return choices.find(t=>t.id===targetId)||choices[0];}

  const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>v===null?'null':typeof v==='string'?`"${esc(v)}"`:String(v);
  function svg(tag,attrs={},text){const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(text!==undefined)n.textContent=text;return n;}
  function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
  function record(r){history.unshift({...r,round:state.round});history=history.slice(0,100);inspected=0;}
  const actions={move:'跃迁',attack:'开火',selfRepair:'自修复',resupply:'补给',guard:'戒备',evade:'机动规避',heal:'维修',endTurn:'结束回合',start:'读取地图',select:'选择星系',save:'保存进度',load:'读取进度'};
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
  function focusOnUnit(){const u=E.unit(state,selected)||state.units.find(x=>x.side==='player'&&x.hp>0);if(!u)return;const p=E.region(config,u.regionId).center;const base=defaultView(),w=Math.min(view[2],base[2]/1.5),h=w*base[3]/base[2];view=[p[0]-w/2,p[1]-h/2,w,h];setView();}
  function connectionPoints(a,b){
    const edge=E.link(config,a,b),via=edge?.via||[];
    return [E.region(config,a).center,...(edge?.a===a?via:[...via].reverse()),E.region(config,b).center];
  }
  function pathPoints(path){const points=[];for(let i=1;i<path.length;i++)points.push(...connectionPoints(path[i-1],path[i]).slice(i===1?0:1));return points;}
  function pathD(points){return points.map((p,i)=>(i?'L':'M')+p.join(',')).join(' ');}
  function buildMap(){
    for(const id of ['starfield','area-layer','edge-layer','hyper-layer','label-layer','units-layer'])$(id).replaceChildren();
    let seed=1927;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<440;i++)$('starfield').append(svg('circle',{cx:rng()*config.map.width,cy:rng()*config.map.height,r:.4+rng()*1.1,fill:i%4===0?'#90b8c5':'#d3dfec',opacity:.12+rng()*.5}));
    const geography=$('chart-geography');geography.replaceChildren();
    if(config.regions.length===54){
      const names={china:['长垣暗云','参商星协'],american:['Cinder Veil','Meridian Association'],european:['The Ash Rift','Orison Association'],soviet:['Пепельная Завеса','Группа Ориона']}[config.campaign.nameSet];
      for(const [i,[x,y]] of [[.20,.19],[.70,.81]].entries()){
        geography.append(svg('text',{x:x*config.map.width,y:y*config.map.height,'text-anchor':'middle'},names[i]));
      }
    }
    for(const e of config.connections)$('edge-layer').append(svg('path',{d:pathD(connectionPoints(e.a,e.b)),class:'warp-edge','data-a':e.a,'data-b':e.b}));
    for(const e of config.hyperlanes)$('hyper-layer').append(svg('path',{d:pathD(connectionPoints(e.a,e.b)),class:'hyper-edge'}));
    config.regions.forEach(r=>{
      const g=svg('g',{id:'area-'+r.id,class:'system '+r.kind,transform:`translate(${r.center})`,'data-region':r.id,tabindex:0,role:'button','aria-label':`星系 ${r.name}，${typeName(r)}`});
      g.append(svg('title',{},r.name+' · '+typeName(r)+' · '+C.atlas.count(r.planets)+' 颗行星'));
      g.append(svg('circle',{r:32,class:'hit-zone'}),svg('circle',{r:24,class:'system-ring'}));
      if(r.kind==='blackhole')g.append(svg('ellipse',{rx:21,ry:10,class:'accretion',transform:'rotate(-25)'}),svg('circle',{r:10,class:'black-core'}));
      else if(r.kind==='pulsar')g.append(svg('path',{d:'M-8,-30L8,30M-23,6L23,-6',class:'pulsar-beam'}),svg('circle',{r:13,class:'pulsar-halo'}),svg('circle',{r:6,fill:'#d6ffff'}));
      else window.SurveyUI.appendStar(g,r.star,svg);
      g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseRegion(r.id);}});$('area-layer').append(g);
      const label=svg('g',{id:'label-'+r.id,class:'system-label',transform:`translate(${r.center})`,'pointer-events':'none'});
      if(r.id===E.headquarters(config)?.startRegion){
        g.append(svg('circle',{r:30,class:'hq-ring'}));
        label.append(svg('text',{y:-49,'text-anchor':'middle',class:'hq-label'},'✧ 司令部'));
      }
      label.append(svg('text',{y:32,'text-anchor':'middle',class:r.name.length>10?'long-name':''},r.name));$('label-layer').append(label);
    });
    resetView();
  }
  function chooseUnit(id){
    if(flight)return;
    const u=E.unit(state,id);if(!u||u.hp<=0)return;
    if(coach.active()&&(coach.step()?.event!=='ship'||coach.step().value!==id))return;
    showTab('play');focus=u.regionId;lastError='';
    if(u.side==='player'){selected=id;targetId=null;healTargetId=null;setOrder(E.spec(config,u).kind==='tender'?'repair':E.targets(state,u.id).length||E.isFixed(E.spec(config,u).kind)?'fire':'nav');}
    else{targetId=u.regionId===E.unit(state,selected)?.regionId?id:null;}
    render();syncRegionInputs();coach.signal('ship',id);
  }
  function chooseRegion(id){
    if(flight)return;
    if(!E.region(config,id))return;
    if(coach.active()&&(coach.step()?.event!=='star'||coach.step().value!==id))return;
    focus=id;lastError='';showTab($('panel-map').hidden?'play':'map');
    // 点击星系不会自动切换到驻留友舰，否则无法给另一艘船下达集结命令。
    if(!$('panel-play').hidden)setOrder('nav');render();syncRegionInputs();coach.signal('star',id);
  }
  function showControlReport(round,side,reports){
    const dialog=$('control-report');
    $('control-round').textContent='第 '+round+' 回合　／　'+ownerName(side)+' 行动结束';
    const labels=['D6 掷骰','在场舰数','现存舰体','剩余攻击火力','合计'];
    const values=score=>[String(score.die),'+'+score.ships,score.hull+' → +'+score.hullBonus,score.fire+' → +'+score.fireBonus,String(score.total)];
    $('control-results').innerHTML=reports.map(report=>{
      const a=values(report.scores.player),b=values(report.scores.enemy);
      const result=report.tie?'同点 · '+ownerName(report.owner)+(report.owner?'继续控制':''):(report.owner===report.previous?'守住星系':'取得控制权');
      return '<article><header><h3>'+esc(E.region(config,report.id).name)+'</h3><strong>'+esc(report.tie?result:ownerName(report.owner)+' · '+result)+'</strong></header>'+
        '<table><thead><tr><th scope="col">判定项目</th><th scope="col">'+esc(ownerName('player'))+'</th><th scope="col">'+esc(ownerName('enemy'))+'</th></tr></thead><tbody>'+
        labels.map((label,i)=>'<tr><th scope="row">'+label+'</th><td>'+a[i]+'</td><td>'+b[i]+'</td></tr>').join('')+'</tbody></table></article>';
    }).join('');
    $('control-continue').textContent=state.winner?'查看战果':state.activeSide==='enemy'?'继续 · 对手行动':'继续 · 舰队指挥';
    dialog.showModal();dialog.scrollTop=0;
  }
  $('control-continue').onclick=()=>$('control-report').close();
  $('control-report').addEventListener('close',()=>{
    coach.signal('report',undefined);
    if(gameActive&&!state.winner&&state.activeSide==='enemy'&&!busy)startAI();
  });
  function act(action,ai=false){
    if(!gameActive||flight||(busy&&!ai))return null;
    if(!ai&&coach.active()&&(coach.step()?.event!=='action'||coach.step()?.value!==action.type))return null;
    const side=state.activeSide,result=E.transition(config,state,action);
    const travelPath=result.route?.path||result.escapePath;
    if(result.ok&&travelPath?.length>1){
      const movingId=result.escapePath?action.targetId:action.unitId;
      const sp=config.units.find(u=>u.id===movingId),token=generation;
      window.FleetMusic.update(state,action.type);
      const animation=window.Transit.launch($('flight-layer'),pathPoints(travelPath),shapes[sp.kind],C.factionFor(config,sp.side).color,sp.engine);
      flight={id:sp.id,animation};coach.pause(true);render();
      result.arrival=animation.done.then(()=>{
        if(token!==generation||!gameActive)return;
        flight=null;commitAction(action,ai,side,result);
        if(!busy)coach.pause(false);
      });
    }else commitAction(action,ai,side,result);
    return result;
  }
  function commitAction(action,ai,side,result){
    state=result.state;lastError=result.ok?'':result.message;
    if(result.ok)window.FleetMusic.update(state,action.type);
    record({...result,arrival:undefined,state:undefined,side,input:`${ai?'电脑':'玩家'}发出“${actions[action.type]}”指令。`});
    if(result.ok&&action.type==='move'&&!ai){
      focus=E.unit(state,action.unitId).regionId;
      if(E.targets(state,action.unitId).length)setOrder(E.spec(config,E.unit(state,action.unitId)).kind==='tender'?'repair':'fire');
    }
    if(result.ok&&(action.type==='heal'||action.type==='attack'||action.type==='evade'||result.route?.contact||result.route?.leaving))toast(result.message);
    if(state.winner)busy=false;render();syncRegionInputs();
    if(result.contests?.length)showControlReport(result.state.round-(side==='enemy'?1:0),side,result.contests);
    if(result.ok&&!ai){
      const report=result.route?'抵达'+E.region(config,result.route.to).name+' · 剩余 '+E.unit(state,action.unitId).ap+' AP':action.type==='endTurn'?'':result.message;
      if(coach.active()&&action.type==='endTurn'&&!result.contests?.length)coach.pause(true);
      coach.signal('action',action.type,report);
    }
  }
  function startAI(){
    const token=++generation;busy=true;coach.pause(true);render();
    function step(){
      if(token!==generation||!gameActive)return;
      if(state.winner||state.activeSide!=='enemy'){busy=false;render();return;}
      const action=trainingId?{type:'endTurn'}:E.aiAction(config,state);if(!action){busy=false;render();return;}
      const result=act(action,true);if(!result.ok){busy=false;toast(result.message);render();return;}
      if(state.winner||state.activeSide==='player'){busy=false;render();coach.pause(false);return;}
      if(result.arrival)result.arrival.then(()=>{if(token===generation)setTimeout(step,100);});
      else setTimeout(step,240);
    }setTimeout(step,350);
  }
  function newGame(c=config,message='战役开始，星舰可在同一星系集结与交战。'){
    try{const valid=E.validateConfig(c);generation++;cancelFlight();busy=false;config=valid;state=E.initialState(config,config.campaign.seed);if(trainingId)window.Academy.prepareState(trainingId,state);selected=config.units.find(u=>u.side==='player').id;focus=null;targetId=null;lastError='';hideVictory=false;healTargetId=null;history=[];
      record({ok:true,action:'start',side:'player',input:'读取默认或导入的地图 JSON。',check:`${config.regions.length} 个星系 · ${config.connections.length} 段曲速邻接 · ${config.hyperlanes.length} 条超空航道 · ${config.units.length} 个单位`,message,changes:[{path:'round',before:null,after:1}]});
      window.FleetMusic.reset();window.FleetMusic.update(state);
      applyCampaign();setOrder('nav');buildMap();render();syncRegionInputs();document.body.classList.add('inspector-hidden');
    }catch(e){toast('未应用：'+e.message);}
  }
  function renderMap(){
    const u=E.unit(state,selected);routeCache=u?E.paths(config,state,selected):new Map();
    const allEdges=$('show-edges').checked;
    const plans=new Map();
    if(u)for(const [id,path] of routeCache)plans.set(id,E.flightPlan(config,state,selected,id,path));
    const reachable=new Set([...plans].filter(([id,p])=>p.to===id&&p.cost<=u.ap).map(([id])=>id));
    for(const line of $('edge-layer').children){
      const local=reachable.has(line.dataset.a)&&reachable.has(line.dataset.b);
      line.style.display=allEdges||local?'':'none';line.classList.toggle('local',local);
    }
    $('hyper-layer').style.display=$('show-hyper').checked?'':'none';
    const controls=$('control-layer');controls.replaceChildren();
    for(const r of config.regions){const canReach=u&&r.id!==u.regionId&&!busy&&!state.winner&&state.activeSide==='player'&&reachable.has(r.id);
      $('area-'+r.id).setAttribute('class','system '+r.kind+(canReach?' reachable':'')+(u?.regionId===r.id?' current':'')+(focus===r.id?' focused':''));
      const owner=state.control[r.id],disputed=state.pendingClaims.includes(r.id);
      if(owner||disputed){
        const marker=svg('g',{transform:'translate('+r.center+')',class:'control-mark'});
        if(owner)marker.append(svg('path',{d:owner==='player'?'M15,9V-5L28,-3L20,2H16':'M21,-4L27,2L21,8L15,2Z',stroke:C.factionFor(config,owner).color,fill:owner==='player'?C.factionFor(config,owner).color:'none'}));
        if(disputed)marker.append(svg('path',{d:'M-28,-5l12,12m0,-12l-12,12',class:'dispute-mark'}));
        controls.append(marker);
      }
      $('area-'+r.id).setAttribute('aria-label','星系 '+r.name+'，'+typeName(r)+'，'+ownerName(owner)+(owner?'控制':'')+(disputed?'，待争夺':''));
      $('label-'+r.id).classList.toggle('occupied',E.occupants(state,r.id).length>0);
      $('label-'+r.id).style.display=($('show-labels').checked||focus===r.id||u?.regionId===r.id)?'':'none';
    }
    $('route-layer').replaceChildren();const raw=routeCache.get(focus),route=raw?E.flightPlan(config,state,selected,focus,raw):null;
    if(route&&route.path.length>1)$('route-layer').append(svg('path',{d:pathD(pathPoints(route.path)),class:'route-line '+route.engine+(route.cost>u.ap?' unaffordable':'')}));
    if(route&&route.path.length>1)for(let i=1;i<route.path.length;i++){const a=E.region(config,route.path[i-1]).center,b=E.region(config,route.path[i]).center,edge=E.movementNeighbors(config,route.path[i-1],route.engine).find(n=>n.id===route.path[i]).edge;$('route-layer').append(svg('text',{x:(a[0]+b[0])/2+10,y:(a[1]+b[1])/2-10,class:'route-cost-label'},E.stepCost(config,route.path[i],edge,route.engine)+' AP'));}
    $('units-layer').replaceChildren();

    for(const r of config.regions)for(const side of ['player','enemy']){
      const ships=E.occupants(state,r.id).filter(x=>x.side===side&&x.id!==flight?.id);if(!ships.length)continue;
      const f=C.factionFor(config,side),rep=ships.find(x=>x.id===selected)||ships[0],chosen=ships.some(x=>x.id===selected),targeted=ships.some(x=>x.id===targetId);
      const p=r.center,g=svg('g',{id:`fleet-${r.id}-${side}`,class:'unit-token'+(chosen?' selected':'')+(targeted?' targeted':'')+(ships.every(x=>!canAct(x))?' spent':''),transform:`translate(${p[0]+(side==='player'?-24:25)},${p[1]-24})`,'data-fleet-region':r.id,'data-fleet-side':side,tabindex:0,role:'button','aria-label':`${r.name}，${side==='player'?'己方':'敌方'}${f.name}舰队，${ships.length} 艘星舰`});
      const many=ships.length>1;
      const badge=svg('path',{d:many?'M-23,-15H28L34,-9V13H-17L-23,7Z':'M-19,-15H11L18,-8V13H-13L-19,7Z',class:'fleet-tag',stroke:f.color});
      g.append(svg('circle',{r:30,class:'hit-zone'}),badge,svg('path',{d:shapes[E.spec(config,rep).kind],class:'ship-hull',fill:f.color,transform:'translate('+(many?-8:0)+',-1) scale(.42)'}));
      if(many)g.append(svg('text',{x:15,y:6,class:'fleet-count'},ships.length));
      if(ships.some(x=>x.guard))g.append(svg('text',{class:'guard-icon',x:-30,y:-22},'◇'));
      g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectFleet(r.id,side);}});$('units-layer').append(g);
    }
  }
  function fleetCount(side){
    const units=living(side),mobile=units.filter(u=>!E.isFixed(E.spec(config,u).kind)).length;
    return mobile+' 艘舰船'+(units.length>mobile?' · '+(units.length-mobile)+' 座设施':'');
  }
  function rosterHTML(side){return state.units.filter(x=>x.side===side).map(x=>{const sp=E.spec(config,x);return `<button class="roster-unit ${x.id===selected?'chosen':''} ${x.id===targetId?'enemy-chosen':''} ${x.hp<=0?'fallen':''}" ${x.hp<=0?'disabled':''} data-${side==='player'?'select-unit':'target'}="${esc(x.id)}" aria-pressed="${x.id===(side==='player'?selected:targetId)}" aria-label="${side==='player'?'选择':'查看'}${esc(sp.name)}">${A.ship(sp.kind,false)}<span class="roster-copy"><b>${esc(shortName(sp))}</b><small><i class="pennant">${esc(sp.pennant||"")}</i>${role(sp).label}<span>${x.hp>0?x.ap+' AP · '+Object.values(x.fp).reduce((a,b)=>a+b,0)+' FP':'已损失'}</span></small><span class="hp-track"><i style="width:${x.hp/sp.maxHp*100}%"></i></span></span></button>`;}).join('');}
  function selectFleet(id,side){if(coach.active()&&coach.step()?.event==='star'){chooseRegion(id);return;}const ships=E.occupants(state,id).filter(x=>x.side===side);if(side==='player'&&ships.length)chooseUnit(ships.find(x=>x.id===selected)?.id||ships[0].id);else chooseRegion(id);}
  function renderTraffic(){
    const r=detailRegion(),ships=E.occupants(state,r.id);$('traffic-region').textContent=r.name+' · 驻防单位';$('traffic-count').textContent=ships.length+' 个单位';
    $('local-ships').innerHTML=ships.length?['player','enemy'].map(side=>{const f=C.factionFor(config,side),list=ships.filter(x=>x.side===side);return list.length?`<div class="traffic-side ${side}"><h3>${esc(f.name)} · ${side==='player'?'己方':'敌方'} ${list.length}</h3>${list.map(x=>{const sp=E.spec(config,x);return `<button data-traffic-unit="${esc(x.id)}" class="${x.id===selected||x.id===targetId?'chosen':''}" aria-label="驻舰：${esc(sp.name)}"><span>${esc(shortName(sp))}<small>${role(sp).label}</small></span><b>${x.hp}/${sp.maxHp}</b></button>`;}).join('')}</div>`:'';}).join(''):'<p class="empty-text">暂无驻舰，可下达航行指令。</p>';
  }
  function renderUnit(){
    let u=E.unit(state,selected);if(!u||u.hp<=0){u=living('player').find(canAct)||living('player')[0]||state.units.find(x=>x.side==='player');if(selected!==u?.id){focus=u?.regionId;targetId=null;healTargetId=null;}selected=u?.id;}
    if(!u)return;const sp=E.spec(config,u),ready=living('player').filter(canAct).length,where=E.region(config,u.regionId),armor=E.armorValue(config,u);
    $('recall-name').textContent=[sp.pennant,shortName(sp)].filter(Boolean).join('  ')+'　·　'+where.name;
    $('squad-roster').innerHTML=rosterHTML('player');$('squad-count').textContent=`${fleetCount('player')}`;
    $('next-unit').disabled=Boolean(busy||state.winner||!ready);
    $('unit-card').innerHTML=`<div class="ship-title"><small>${esc(sp.pennant||C.factionFor(config,u.side).code)}　/　${role(sp).label}</small><h2>${esc(shortName(sp))}</h2><span class="ship-condition">${u.hp<=0?'已损失':!E.isFixed(sp.kind)&&E.inEnemyControl(state,u)?'交战中 · 脱离将耗尽移动力':u.evasion?'闪避 '+u.evasion:u.guard?'戒备中':u.ap===0?'剩余 0 AP':'等待指令'}</span></div><div class="portrait-well">${E.isFixed(sp.kind)?A.ship(sp.kind):'<img class="deck-thumb" alt="" src="hulls/'+sp.kind+'.webp">'}<span class="ship-registry">${esc(C.factionFor(config,u.side).code+' / '+sp.kind.toUpperCase())}</span></div><div class="vital-row"><span>舰体完整度</span><strong>${u.hp}<small> / ${sp.maxHp}</small></strong></div><div class="hull-meter"><i style="width:${u.hp/sp.maxHp*100}%"></i></div><div class="vital-row ap-row"><button class="info-word" data-tip="行动力由每艘舰单独计算。航行按路线扣除 AP，开火消耗所选炮的 FP。己方回合开始时恢复。">行动力 <sup>?</sup></button><span class="ap-dots">${Array.from({length:sp.maxAp},(_,i)=>`<i class="${i<u.ap?'filled':''}"></i>`).join('')}</span><strong>${u.ap}<small> / ${sp.maxAp}</small></strong></div><div class="equipment-row"><button class="info-word" data-tip="各炮独立计算火力点，每次射击消耗所选炮 1 FP，己方回合开始时补满。">${A.icon('attack')}火力点 <b>${Object.values(u.fp).reduce((a,b)=>a+b,0)} FP</b></button><button class="info-word" data-tip="基础装甲 ${sp.armor}。${where.kind==='pulsar'?'当前位于脉冲星，装甲已失效。':'抵减动能伤害；激光忽略装甲。'}">${A.icon('shield')}装甲 <b>${armor}</b></button></div><div class="drive-row ${sp.engine}"><span class="drive-seal">${A.icon(sp.engine)}</span><div><b>${E.driveName(sp.engine)}引擎</b><small>${sp.engine==='hyper'?'航道内 1 AP · 离轨 2 AP':'航道 2 AP · 普通航路 3 AP 起'}</small></div><button class="info-word drive-help" data-tip="${sp.engine==='hyper'?'沿航道每段 1 AP，离轨每段 2 AP 并失稳。':'沿超空间航道固定每段 2 AP。普通航路进入恒星或脉冲星默认 3 AP，黑洞 4 AP。'}接敌即停航，回合末争夺控制权。">?</button></div>${where.kind==='pulsar'?'<p class="hazard-notice">脉冲星干扰：本舰装甲失效</p>':''}`;
    if(!E.isFixed(sp.kind)){
      const btn=document.createElement('button');btn.id='deck-open';btn.textContent='展开舰内平面图　↗';btn.onclick=()=>window.ShipDeck.open(config,state,u.id);
      $('unit-card').append(btn);
    }
    const choices=E.targets(state,selected),t=activeTarget(u);targetId=t?.id||null;
    const guns=E.mounts(sp),tender=sp.kind==='tender',picker=$('weapon-select');
    const oldGun=picker.dataset.unit===u.id?picker.value:null;
    picker.innerHTML=guns.map((g,i)=>`<option value="${g.id}">${i+1} · ${esc(F.equipment(sp,g.model))} · ${g.label} · 攻 ${g.attack} / 伤 ${g.damage} · ${u.fp[g.id]}/${g.capacity} FP</option>`).join('');
    picker.dataset.unit=u.id;picker.value=guns.some(g=>g.id===oldGun)?oldGun:(guns.find(g=>u.fp[g.id]>0)||guns[0]).id;
    const gun=guns.find(g=>g.id===picker.value);
    const aim=$('aim'),oldAim=Number(aim.value),options=E.aimOptions(config,u);
    aim.innerHTML=options.map(n=>`<option value="${n}">${n} MP</option>`).join('');
    aim.value=String(options.includes(oldAim)?oldAim:0);$('aim-pick').hidden=tender;
    for(const el of ['attack-target','attack-options','attack-btn','attack-hint'])$(el).hidden=tender;
    picker.closest('label').hidden=tender;
    const err=t?E.attackError(config,state,selected,t.id,gun.id,Number(aim.value)):'本星系没有存活敌舰。';
    document.body.classList.toggle('has-contact',choices.length>0);
    $('attack-options').innerHTML=choices.map(x=>{const xp=E.spec(config,x);return `<button data-fire-target="${esc(x.id)}" aria-pressed="${x.id===targetId}" aria-label="开火目标：${esc(xp.name)}"><span>${esc(shortName(xp))}<small>${role(xp).label}</small></span><b>${x.hp}/${xp.maxHp}</b></button>`;}).join('');
    $('attack-btn').disabled=Boolean(busy||state.winner||err);$('attack-btn').title=err||`向${shortName(E.spec(config,t))}开火`;$('attack-btn').innerHTML=A.icon('attack')+'开火 · 1 FP';
    $('attack-target').textContent=t?`${where.name} · 目标：${shortName(E.spec(config,t))}`:`${where.name} · 本星系交战`;
    $('attack-options').setAttribute('aria-label',`${where.name}，选择本星系开火目标`);
    if(t){
      const shot=E.shotProfile(config,t,gun,u,Number(aim.value));
      $('attack-hint').textContent=err||`D6 < ${shot.threshold} · 命中 ${shot.faces}/6 · 命中伤害 ${shot.damage}`;
    }else $('attack-hint').textContent='进入敌方驻防星系后，可用舰炮火力点开火。';
    const spend=$('evade-spend'),min=sp.kind==='scout'?Math.floor(sp.maxMp/2):1,old=Number(spend.value);
    const costs=Array.from({length:u.mp+1},(_,i)=>i).filter(n=>n>=min&&E.evadeGain(config,u,n)>0);
    spend.innerHTML=costs.map(n=>`<option value="${n}">${n} MP → ${E.evadeGain(config,u,n)} 闪避</option>`).join('')||'<option value="0">无可用机动</option>';
    if(costs.includes(old))spend.value=String(old);
    $('evade-pick').hidden=$('evade-btn').hidden=E.isFixed(sp.kind);$('guard-btn').hidden=sp.kind==='scout';
    const ev=E.defenseError(config,state,selected,'evade',Number(spend.value));
    $('evade-btn').disabled=spend.disabled=!!(busy||ev);$('evade-btn').title=ev||'投入机动点';
    $('guard-btn').disabled=!!(busy||E.defenseError(config,state,selected,'guard'));
    const info=E.selfRepair(config,state,u);
    $('self-repair').hidden=E.isFixed(sp.kind);$('resupply').hidden=!tender;
    for(const [id,type] of [['self-repair','selfRepair'],['resupply','resupply']]){
      const reason=E.projectError(config,state,selected,type);$(id).disabled=!!(busy||reason);$(id).title=reason||'在下一己方回合开始时完成';
    }
    $('work-info').textContent=u.job?(u.job==='resupply'?'收集补给中':'自修复中'):E.isFixed(sp.kind)?'固定设施':`机动 ${u.mp}/${sp.maxMp} MP · 闪避 ${u.evasion}${u.unstable?' · 离轨失稳':''} · ${u.retreatUsed?'撤退机会已用':'紧急跃迁 '+E.retreatChance(config,u)+'%'}`+(u.hp*2<sp.maxHp?` · 本次自修复 +${info.gain} HP`:'');
    $('end-btn').disabled=Boolean(flight||busy||state.winner);$('end-btn').innerHTML=busy?E.sideName(config,'enemy')+'行动中<span>◌</span>':'结束回合 <span>›</span>';
    $('turn-hint').textContent=busy?E.sideName(config,'enemy')+'舰队正在行动…':state.winner?'本次远征已结束':ready?'':'本方已无可执行指令';
    $('enemy-count').textContent=`${E.sideName(config,'enemy')} · 对手　${fleetCount('enemy')}`;$('opponent').innerHTML=rosterHTML('enemy');
    $('edit-engine').closest('details').hidden=E.isFixed(sp.kind);
    if(E.isFixed(sp.kind))$('unit-card').querySelector('.drive-row').innerHTML='<span class="drive-seal">'+A.icon('shield')+'</span><div><b>固定驻防</b><small>本星系开火 · 可戒备</small></div>';
    $('edit-engine').value=sp.engine;$('edit-ship-label').textContent=sp.name;$('ship-location').textContent=where.name+'星系';
    $('heal-panel').hidden=!tender;
    if(tender){const allies=living('player').filter(x=>x.regionId===u.regionId&&!E.isFixed(E.spec(config,x).kind)),valid=allies.filter(x=>!E.healError(config,state,u.id,x.id));if(!allies.some(x=>x.id===healTargetId))healTargetId=valid[0]?.id||u.id;
      $('heal-target').innerHTML=allies.map(x=>`<option value="${esc(x.id)}">${esc(shortName(E.spec(config,x)))} · ${x.hp}/${E.spec(config,x).maxHp}${x.id===u.id?'（自身）':''}</option>`).join('');$('heal-target').value=healTargetId;
      const err=E.healError(config,state,u.id,healTargetId);$('heal-btn').disabled=Boolean(busy||state.winner||err);$('heal-btn').textContent=`派出维修队 · 1 补给`;$('heal-supply').textContent=`维修队 ${u.fp[sp.guns[0].id]}/1 · 补给 ${u.healsLeft}/${sp.maxHeals}`;$('heal-hint').textContent=err||'预计恢复 '+Math.min(E.repairAmount(E.spec(config,E.unit(state,healTargetId))),E.spec(config,E.unit(state,healTargetId)).maxHp-E.unit(state,healTargetId).hp)+' HP';}
  }
  function renderDestination(){
    const u=E.unit(state,selected),sp=E.spec(config,u),r=focus?E.region(config,focus):null;const raw=r&&routeCache.get(r.id),route=raw&&E.flightPlan(config,state,selected,r.id,raw);let err='';
    if(E.isFixed(sp.kind)){
      $('destination').textContent='驻防星系 · '+E.region(config,u.regionId).name;
      $('move-btn').disabled=true;$('move-btn').textContent='固定设施无法移动';
      $('route-status').textContent='选择同星系的敌方目标开火，或进入戒备。';return;
    }
    if(!r||r.id===u.regionId){$('destination').innerHTML='<div class="section-heading">航行计划</div><p class="empty-text"><button data-destination-info>查看当前星系资料 ›</button></p>';$('move-btn').textContent='选择目的星系';$('move-btn').disabled=true;}
    else{err=E.moveError(config,state,selected,r.id);
      const compare=['warp','hyper'].map(d=>{
        const raw=E.paths(config,state,selected,d).get(r.id);
        const plan=raw&&E.flightPlan(config,state,selected,r.id,raw);
        return '<div><span>'+E.driveName(d)+'</span><b>'+(plan?esc(E.region(config,plan.to).name)+' · '+plan.spent+' AP':'不可达')+'</b></div>';
      }).join('');
      const stop=route&&(route.contact?'接敌停航 · 回合末争夺':route.leaving?'首跳 '+route.cost+' AP · 脱离后 0 AP':'到达后剩余 '+(u.ap-route.spent)+' AP');
      $('destination').innerHTML=`<div class="section-heading">航行计划 <button data-destination-info title="查看目的星系资料">星系资料 ›</button></div><div class="destination-heading"><b>${esc(route?E.region(config,route.to).name:r.name)}</b><span>${typeName(route?E.region(config,route.to):r)}</span></div>${route?`<div class="route-steps">${route.path.map(id=>esc(E.region(config,id).name)).join(' › ')}</div><div class="route-estimate"><span>${route.path.length-1} 次跃迁</span><strong>${route.spent}<small> AP</small></strong><span class="${route.cost>u.ap?'insufficient':''}">${route.cost<=u.ap?stop:'当前仅 '+u.ap+' AP'}</span></div>`:`<p class="blocked-route">${esc(err)}</p>`}<details class="comparison"><summary>比较两种引擎</summary><div>${compare}</div><p>假设从相同位置出发；本舰执行${E.driveName(sp.engine)}航行。</p></details>`;
      $('move-btn').disabled=Boolean(err||busy||state.winner);$('move-btn').textContent=!route?'航路不可达':route.cost>u.ap?'行动力不足':`${route.contact?'接敌停航 · '+E.region(config,route.to).name:route.leaving?'脱离至'+E.region(config,route.to).name:'确认'+E.driveName(sp.engine)+'跃迁'} · ${route.spent} AP`;
    }
    let hint=!r||r.id===u.regionId?`${shortName(sp)} · ${E.driveName(sp.engine)}引擎`:err||`前往${E.region(config,route.to).name}${route.off?' · 离轨失稳':''}${route.leaving?' · 脱离敌控区，仅移动一段':''}${route.contact?' · 接敌后 AP 归零，回合末争夺':''} · ${route.path.length-1} 次跃迁 · 消耗 ${route.spent} AP`;
    if(busy)hint=E.sideName(config,'enemy')+'正在行动';if(state.winner)hint=E.sideName(config,state.winner)+'取得胜利';$('route-status').textContent=lastError||hint;$('route-status').classList.toggle('error',Boolean(lastError||(!busy&&!state.winner&&err)));
  }
  function detailRegion(){return E.region(config,focus||E.unit(state,selected)?.regionId||config.regions[0].id);}
  function syncRegionInputs(){const r=detailRegion();if(r){$('edit-cost').value=r.moveCost;$('edit-defense').value=r.defense;$('edit-type').value=r.kind;}}
  function renderRegion(){
    const r=detailRegion();if(!r)return;const warp=E.movementNeighbors(config,r.id,'warp'),hyper=E.movementNeighbors(config,r.id,'hyper').filter(n=>!n.edge.offlane);
    const links=(list,drive)=>list.length?list.map(n=>`<button data-region-jump="${esc(n.id)}">${esc(E.region(config,n.id).name)} <small>${E.stepCost(config,n.id,n.edge,drive)} AP</small></button>`).join(''):'<span class="muted">未接入超空间航道，超空间舰可离轨到访。</span>';
    $('region-detail').innerHTML=`<div class="region-heading"><span>${esc(r.id.toUpperCase())}</span><h3>${esc(r.name)}</h3><em class="terrain-tag ${r.kind}">${typeName(r)}</em></div><p class="sector-owner">${ownerName(state.control[r.id])}${state.control[r.id]?"控制":""}${state.pendingClaims.includes(r.id)?"　·　待争夺":""}</p><p class="panel-intro">${hazard(r)}</p><div class="region-meta"><div>曲速邻接<b>${warp.length}</b></div><div>超空航道<b>${hyper.length}</b></div></div><div class="caption warp-text">曲速邻接 · 用于航行</div><div class="neighbors">${links(warp,'warp')}</div><div class="caption hyper-text">超空间航道 · 双向通行</div><div class="neighbors">${links(hyper,'hyper')}</div>`;const detail=$('region-detail');detail.querySelector('.panel-intro').before(window.SurveyUI.register(r));$('region-json').textContent=JSON.stringify(r,null,2);
  }
  function renderLog(){
    const r=history[inspected]||history[0];if(!r)return;
    $('pipeline').innerHTML=`<div class="pipeline-step"><span>1</span><div><b>接收指令</b><p>${esc(r.input||actions[r.action]||'查看数据')}</p></div></div><div class="pipeline-step"><span>2</span><div><b>检查规则</b><p>${esc(r.check||'')}</p></div></div><div class="pipeline-step"><span>3</span><div><b>修改状态</b>${r.changes?.length?'<div class="diff">'+r.changes.map(d=>`${esc(d.path)}<br>${fmt(d.before)} → ${fmt(d.after)}`).join('<br>')+'</div>':'<p>游戏状态没有改变。</p>'}</div></div><div class="pipeline-step"><span>4</span><div><b>更新画面</b><p>${esc(r.message)}</p></div></div>`;
    $('history').innerHTML=history.map((h,i)=>`<button class="log-item ${h.side==='enemy'?'enemy':''} ${i===inspected?'active':''}" data-record="${i}">R${h.round} · ${esc(h.message)}</button>`).join('');$('state-json').textContent=JSON.stringify(state,null,2);
  }
  function render(){
    renderUnit();renderMap();renderDestination();renderRegion();renderTraffic();renderLog();
    if(flight)for(const id of ['move-btn','attack-btn','guard-btn','evade-btn','heal-btn','resupply','self-repair'])$(id).disabled=true;
    if($('deck').open)window.ShipDeck.render(config,state);
    const hq=E.headquarters(config);
    $('hq-status').hidden=!hq;
    if(hq){
      const hp=E.unit(state,hq.id).hp;
      $('hq-status').textContent=(hq.side==='player'?'守住':'夺取')+' '+E.region(config,hq.startRegion).name+' · 司令部 '+hp+'/'+hq.maxHp+' · '+Math.min(state.round,C.siegeRounds)+'/'+C.siegeRounds+' 回合';
    }
    $('turn-label').textContent=`第 ${hq?Math.min(state.round,C.siegeRounds):state.round} 回合 · ${E.sideName(config,state.winner||state.activeSide)}${state.winner?'获胜':'行动'}`;
    $('phase-label').textContent=busy?'电脑决策中':state.winner?'已结束':'';document.querySelector('.command-bar').classList.toggle('busy',busy);
    $('victory').hidden=!state.winner||hideVictory;
    if(state.winner==='draw'){$('victory-title').textContent='停战';$('victory-text').textContent='双方仅存无武装支援舰。';$('turn-label').textContent='战役结束 · 停战';$('route-status').textContent='双方停战';}
    else if(state.winner){$('victory-title').textContent=E.sideName(config,state.winner)+'获胜';$('victory-text').textContent=`${hq?(state.winner!==hq.side?'司令部失守。':state.round>C.siegeRounds?'守备期限届满，司令部仍在运转。':'进攻舰队全灭，司令部守住了星区。'): '对方舰队已全灭。'}战役历时 ${hq?Math.min(state.round,C.siegeRounds):state.round} 回合。`;}
  }
  function setOrder(key){
    for(const b of document.querySelectorAll('[data-order]'))b.setAttribute('aria-pressed',String(b.dataset.order===key));
    for(const panel of document.querySelectorAll('[data-order-page]'))panel.hidden=panel.dataset.orderPage!==key;
  }
  document.querySelectorAll('[data-order]').forEach(b=>b.onclick=()=>setOrder(b.dataset.order));
  $('command-recall').onclick=()=>chooseUnit(selected);
  $('map-return').onclick=()=>showTab('play');
  function setRosterFold(folded){
    document.body.classList.toggle('roster-folded',folded);
    $('fleet-fold').setAttribute('aria-expanded',String(!folded));
    $('fleet-fold').setAttribute('aria-label',folded?'展开舰队列表':'收起舰队列表');
  }
  setRosterFold(window.matchMedia('(max-width: 680px)').matches);
  $('fleet-fold').onclick=()=>setRosterFold(!document.body.classList.contains('roster-folded'));
  function showTab(name){document.body.classList.remove('inspector-hidden','map-only');$('hide-ui').setAttribute('aria-pressed','false');$('hide-ui').lastChild.textContent='全景星图';document.querySelectorAll('[data-tab]').forEach(b=>{const on=b.dataset.tab===name;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on));$('panel-'+b.dataset.tab).hidden=!on;});$('inspector-title').textContent={play:'星舰档案',map:'星系档案',log:'远征记录'}[name];}
  function paintIcons(){document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=A.icon(el.dataset.icon));}
  function tooltip(el){if(!el?.dataset.tip)return;const t=$('context-tooltip');t.textContent=el.dataset.tip;t.hidden=false;const b=el.getBoundingClientRect(),w=Math.min(280,window.innerWidth-28);t.style.width=w+'px';t.style.left=Math.max(12,Math.min(b.left,window.innerWidth-w-12))+'px';t.style.top=Math.max(12,Math.min(b.bottom+9,window.innerHeight-t.offsetHeight-12))+'px';}
  function hideTooltip(){$('context-tooltip').hidden=true;}

  function download(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);}
  // 鼠标位置通过 SVG 坐标变换映射到星图坐标，缩放后点击仍然准确。
  const mapSvg=$('map-svg');
  mapSvg.addEventListener('pointerdown',e=>{if(e.button!==0)return;const matrix=mapSvg.getScreenCTM().inverse(),p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix);drag={id:e.pointerId,x:e.clientX,y:e.clientY,p,matrix,view:[...view],moved:false,target:e.target};mapSvg.setPointerCapture(e.pointerId);});
  mapSvg.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>5)drag.moved=true;if(drag.moved){const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(drag.matrix);view=[drag.view[0]-(p.x-drag.p.x),drag.view[1]-(p.y-drag.p.y),drag.view[2],drag.view[3]];mapSvg.classList.add('dragging');setView();}});
  mapSvg.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.id)return;const d=drag;drag=null;mapSvg.classList.remove('dragging');if(mapSvg.hasPointerCapture(e.pointerId))mapSvg.releasePointerCapture(e.pointerId);if(!d.moved){const t=d.target.closest('[data-fleet-region]')||d.target.closest('[data-region]');if(t?.dataset.fleetRegion)selectFleet(t.dataset.fleetRegion,t.dataset.fleetSide);else if(t?.dataset.region)chooseRegion(t.dataset.region);}});
  mapSvg.addEventListener('pointercancel',()=>{drag=null;mapSvg.classList.remove('dragging');});
  mapSvg.addEventListener('wheel',e=>{e.preventDefault();const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(mapSvg.getScreenCTM().inverse());zoom(e.deltaY>0?1.16:1/1.16,[p.x,p.y]);},{passive:false});
  $('hq-status').onclick=()=>{
    const hq=E.headquarters(config);if(!hq)return;
    chooseRegion(hq.startRegion);const [x,y]=E.region(config,hq.startRegion).center;
    view[0]=x-view[2]/2;view[1]=y-view[3]/2;setView();
  };
  $('zoom-in').onclick=()=>zoom(1/1.25);$('zoom-out').onclick=()=>zoom(1.25);$('zoom-reset').onclick=resetView;$('focus-unit').onclick=focusOnUnit;
  for(const id of ['show-hyper','show-edges','show-labels'])$(id).onchange=renderMap;
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
  $('squad-roster').onclick=e=>{const b=e.target.closest('[data-select-unit]');if(b)chooseUnit(b.dataset.selectUnit);};
  $('opponent').onclick=e=>{const b=e.target.closest('[data-target]');if(!b)return;chooseUnit(b.dataset.target);
    const sp=E.spec(config,E.unit(state,b.dataset.target));
    if(!E.isFixed(sp.kind))window.ShipDeck.open(config,state,b.dataset.target);
  };
  $('region-detail').onclick=e=>{const b=e.target.closest('[data-region-jump]');if(b)chooseRegion(b.dataset.regionJump);};
  $('move-btn').onclick=()=>{if(focus)act({type:'move',unitId:selected,to:focus});};
  $('weapon-select').onchange=renderUnit;
  $('attack-btn').onclick=()=>{const t=activeTarget(E.unit(state,selected));if(t)act({type:'attack',unitId:selected,targetId:t.id,weapon:$('weapon-select').value,aim:Number($('aim').value)});};
  $('next-unit').onclick=nextUnit;
  $('heal-target').onchange=e=>{healTargetId=e.target.value;renderUnit();};
  $('heal-btn').onclick=()=>act({type:'heal',unitId:selected,targetId:healTargetId});
  $('aim').onchange=renderUnit;
  $('evade-btn').onclick=()=>act({type:'evade',unitId:selected,spend:Number($('evade-spend').value)});
  $('guard-btn').onclick=()=>act({type:'guard',unitId:selected});
  $('self-repair').onclick=()=>act({type:'selfRepair',unitId:selected});
  $('resupply').onclick=()=>act({type:'resupply',unitId:selected});
  $('end-btn').onclick=()=>{const r=act({type:'endTurn'});if(r?.ok&&state.activeSide==='enemy'&&!$('control-report').open)startAI();};
  $('reset-btn').onclick=()=>{$('settings').close();restartCampaign();};
  $('new-game-victory').onclick=restartCampaign;$('continue-map').onclick=()=>{hideVictory=true;render();};
  $('main-menu-open').onclick=()=>{$('settings').close();$('leave-dialog').showModal();};
  $('leave-cancel').onclick=()=>$('leave-dialog').close();
  $('leave-confirm').onclick=()=>{$('leave-dialog').close();showMainMenu();};
  $('attack-options').onclick=e=>{const b=e.target.closest('[data-fire-target]');if(b){targetId=b.dataset.fireTarget;lastError='';render();}};
  $('local-ships').onclick=e=>{const b=e.target.closest('[data-traffic-unit]');if(b)chooseUnit(b.dataset.trafficUnit);};
  $('history').onclick=e=>{const b=e.target.closest('[data-record]');if(b){inspected=Number(b.dataset.record);renderLog();$('pipeline').closest('details').open=true;}};
  $('apply-region').onclick=()=>{try{const c=E.clone(config),r=E.region(c,detailRegion().id);const next=$('edit-type').value;if(r.kind!==next){r.kind=next;C.atlas.reclassify(r,c.regions.indexOf(r),c.campaign.nameSet);}r.terrain=({star:'恒星系',pulsar:'脉冲星',blackhole:'黑洞'})[r.kind];r.moveCost=Number($('edit-cost').value);r.defense=Number($('edit-defense').value);E.validateConfig(c);const id=r.id;newGame(c,'使用修改后的星系成本与防御，开始新的一局。');focus=id;render();syncRegionInputs();toast('参数已应用，对局已重新开始。');}catch(e){toast(e.message);}};
  $('edit-type').onchange=()=>{const k=$('edit-type').value;$('edit-cost').value=k==='blackhole'?4:3;$('edit-defense').value=k==='blackhole'?1:0;};
  $('apply-engine').onclick=()=>{try{const c=E.clone(config),sp=c.units.find(u=>u.id===selected);sp.engine=$('edit-engine').value;if(sp.engine==='warp'&&sp.maxAp===5)sp.maxAp=6;E.validateConfig(c);newGame(c,'更换星舰引擎后重新开局。');toast('引擎已更换并重新开局。');}catch(e){toast(e.message);}};
  $('export-map').onclick=()=>download('map.json',config);
  $('import-map').onclick=()=>$('map-file').click();
  $('map-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>2*1024*1024)throw Error('JSON 超过 2 MB，请缩小地图文件。');const c=E.validateConfig(JSON.parse(await f.text()));newGame(c,'导入自定义地图数据，重建星系、连接与开局。');toast(`已导入 ${c.regions.length} 个星系、${c.units.length} 个单位，开始新的一局。`);}catch(err){toast('地图未导入：'+err.message);}finally{e.target.value='';}};
  $('restore-map').onclick=()=>{if(confirm('恢复默认地图并重新开局？'))startCampaign(DEFAULT);};
  $('help-open').onclick=()=>$('help').showModal();$('help-close').onclick=()=>$('help').close();$('help-done').onclick=()=>$('help').close();
  $('inspector-close').onclick=()=>document.body.classList.add('inspector-hidden');
  $('settings-open').onclick=()=>$('settings').showModal();
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
  $('hide-ui').onclick=()=>{if($('settings').open)$('settings').close();const on=document.body.classList.toggle('map-only');$('hide-ui').setAttribute('aria-pressed',String(on));$('hide-ui').lastChild.textContent=on?' 返回指挥':'全景星图';};
  $('destination').onclick=e=>{if(e.target.closest('[data-destination-info]'))showTab('map');};
  document.addEventListener('pointerover',e=>{const el=e.target.closest('[data-tip]');if(el)tooltip(el);});
  document.addEventListener('pointerout',e=>{if(e.target.closest('[data-tip]'))hideTooltip();});
  document.addEventListener('focusin',e=>tooltip(e.target.closest('[data-tip]')));
  document.addEventListener('focusout',hideTooltip);
  document.addEventListener('click',e=>{const el=e.target.closest('[data-tip]');if(el)tooltip(el);else hideTooltip();});
  document.querySelector('.inspector').addEventListener('scroll',hideTooltip);
  document.addEventListener('keydown',e=>{if(!gameActive||trainingId||e.target.closest('input,select,textarea')||document.querySelector('dialog[open]'))return;const k=e.key.toLowerCase();if(k==='f')showTab('play');else if(k==='i')showTab('map');else if(k==='l')showTab('log');else if(k==='h')$('help').showModal();else if(e.key==='Escape'){if(document.body.classList.contains('map-only'))showTab('play');hideTooltip();document.body.classList.add('inspector-hidden');}});
  function randomSeed(){const a=new Uint32Array(1);if(window.crypto?.getRandomValues)window.crypto.getRandomValues(a);else a[0]=Math.floor(Math.random()*4294967296);return a[0];}
  function applyCampaign(){
    const own=C.factionFor(config,'player'),enemy=C.factionFor(config,'enemy');
    menuPlayer=own.id;if(menuEnemy!=='random')menuEnemy=enemy.id;document.documentElement.style.setProperty('--friend',own.color);document.documentElement.style.setProperty('--opponent',enemy.color);
    $('player-fleet-label').textContent=own.fleet;$('player-faction-name').textContent=own.name+' · 己方';
    document.querySelector('.fleet-crest').innerHTML=C.emblem(own.id);
    $('mode-choice').value=config.campaign.mode||'encounter';
    if(config.campaign.defender)menuDefender=config.campaign.defender;

    $('faction-key').innerHTML=`<span style="color:${own.color}"><i class="key-flag"></i>${own.name}控制</span><span style="color:${enemy.color}"><i class="key-diamond"></i>${enemy.name}控制</span><span class="key-dispute">⚔ 待争夺</span>`;
  }
  function updateBrief(){
    const siege=$('mode-choice').value==='siege';
    $('role-picker').hidden=!siege;
    for(const btn of $('role-picker').querySelectorAll('button'))btn.setAttribute('aria-pressed',String(btn.dataset.defender===menuDefender));
    const home=siege&&menuDefender==='enemy'?menuEnemy:menuPlayer;
    $('chart-home').textContent=home==='random'?'待确定对手后使用其本土星图':C.factions[home].name+'本土星图';
    const goal=menuDefender==='player'?'你指挥守备部队。':'你指挥进攻舰队。';
    $('operation-brief').textContent=siege?goal+'攻方 8 艘从最西端入场。守方 5 艘（含 2 艘护卫舰），最东端设司令部，3 座平台分守相邻星系。第 10 回合结束前击毁司令部即攻方胜，否则守方胜。':'敌舰已进入你的本土星区。双方各 6 艘舰，歼灭敌方舰队即可获胜。';
  }
  $('mode-choice').onchange=updateBrief;$('role-picker').onclick=e=>{const btn=e.target.closest('[data-defender]');if(btn){menuDefender=btn.dataset.defender;updateBrief();}};
  function renderMenu(){
    updateBrief();
    for(const side of ['player','enemy']){
      const chosen=side==='player'?menuPlayer:menuEnemy;
      $(side+'-options').innerHTML=C.ids.map(id=>{const f=C.factions[id],unavailable=side==='enemy'&&id===menuPlayer;return `<button class="faction-choice" data-faction="${id}" style="--faction:${f.color}" aria-pressed="${id===chosen}" aria-label="${side==='player'?'己方':'对手'}阵营：${f.fullName}" ${unavailable?'disabled':''}>${C.emblem(id)}<span><b>${f.name}</b><small>${unavailable?'己方已选':f.fleet}</small></span><i>${id===chosen?'◆':'◇'}</i></button>`;}).join('');
    }
    const randomButton=document.createElement('button');
    randomButton.className='faction-choice random-choice';
    randomButton.dataset.faction='random';
    randomButton.setAttribute('aria-pressed',String(menuEnemy==='random'));
    randomButton.setAttribute('aria-label','随机对手');
    randomButton.innerHTML='<span class="dice" aria-hidden="true">⚄</span><span><b>随机对手</b><small>从其余三个阵营抽取</small></span>';
    $('enemy-options').prepend(randomButton);
    const f=C.factions[menuPlayer],enemy=C.factions[menuEnemy];
    $('menu-feature').innerHTML=`<div class="featured-emblem" style="color:${f.color}">${C.emblem(f.id)}</div><div><span>${f.fullName}</span><h2>${f.fleet}</h2></div>`;
    $('matchup').textContent=f.name+'  对阵  '+(enemy?enemy.name:'随机对手');
    $('start-game').disabled=menuPlayer===menuEnemy;
  }
  function cancelFlight(){
    flight?.animation.stop();flight=null;
  }
  function prepareLessonStep(step){
    if(step.event==='ship'){
      setRosterFold(false);document.body.classList.add('inspector-hidden');
    }else if(step.event==='star'){
      resetView();
      if(matchMedia('(max-width:680px)').matches){setRosterFold(true);document.body.classList.add('inspector-hidden');}
    }else if(step.page){
      showTab('play');setOrder(step.page);
    }
  }
  function exitLesson(){
    for(const d of document.querySelectorAll('dialog[open]'))d.close();
    const old=menuBeforeTraining;
    trainingId=null;menuBeforeTraining=null;coach.stop();showMainMenu();
    if(old){
      menuPlayer=old.player;menuEnemy=old.enemy;menuDefender=old.defender;
      $('mode-choice').value=old.mode;setRosterFold(old.folded);
      for(const [id,value] of old.lenses)$(id).checked=value;
      renderMenu();
    }
  }
  function startLesson(key){
    const lesson=window.Academy.library[key];
    if(!menuBeforeTraining)menuBeforeTraining={player:menuPlayer,enemy:menuEnemy,defender:menuDefender,mode:$('mode-choice').value,
      folded:document.body.classList.contains('roster-folded'),lenses:['show-edges','show-hyper','show-labels'].map(id=>[id,$(id).checked])};
    coach.stop();trainingId=key;if($('school-menu').open)$('school-menu').close();
    const practice=window.Academy.configuration(DEFAULT,key);
    $('aim').value='0';delete $('weapon-select').dataset.unit;
    gameActive=true;document.body.classList.remove('in-menu','map-only');$('main-menu').hidden=true;$('game-shell').hidden=false;$('game-shell').inert=false;
    $('show-edges').checked=true;$('show-labels').checked=true;$('show-hyper').checked=true;
    showTab('play');newGame(practice,'开始'+lesson.name+'演习。');
    $('player-fleet-label').textContent=lesson.name+'演习';coach.start(key);
  }
  $('school-open').onclick=()=>$('school-menu').showModal();
  $('school-menu').onclick=e=>{const b=e.target.closest('[data-lesson]');if(b)startLesson(b.dataset.lesson);};
  $('deck').addEventListener('close',()=>coach.signal('control','back'));
  function startCampaign(base=DEFAULT){
    const enemyFaction=C.resolveOpponent(menuPlayer,menuEnemy,randomSeed);
    const candidate=C.create(base,{playerFaction:menuPlayer,enemyFaction,seed:randomSeed(),mode:$('mode-choice').value,defender:menuDefender});
    try{E.validateConfig(candidate);}catch(e){toast(e.message);return;}
    gameActive=true;document.body.classList.remove('in-menu');$('main-menu').hidden=true;$('game-shell').hidden=false;$('game-shell').inert=false;
    showTab('play');const announcement=C.factions[candidate.campaign.nameSet].name+'本土星图 · '+C.factions[menuPlayer].name+' 对阵 '+C.factions[enemyFaction].name;newGame(candidate,announcement);toast(announcement);$('show-edges').checked=false;renderMap();$('end-btn').focus();
  }
  function restartCampaign(){startCampaign(config);}
  function showMainMenu(){window.FleetMusic.reset();generation++;cancelFlight();busy=false;gameActive=false;hideTooltip();$('toast').hidden=true;$('game-shell').hidden=true;$('game-shell').inert=true;$('main-menu').hidden=false;document.body.classList.add('in-menu');renderMenu();$('start-game').focus();}
  $('player-options').onclick=e=>{const b=e.target.closest('[data-faction]');if(b){const previous=menuPlayer;menuPlayer=b.dataset.faction;if(menuPlayer===menuEnemy)menuEnemy=previous;renderMenu();}};
  $('enemy-options').onclick=e=>{const b=e.target.closest('[data-faction]');if(b&&!b.disabled){menuEnemy=b.dataset.faction;renderMenu();}};
  $('start-game').onclick=()=>startCampaign();
  paintIcons();renderMenu();
})();
