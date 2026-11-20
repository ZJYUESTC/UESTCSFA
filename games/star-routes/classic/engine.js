/* 星图版 v4：两张航行图。connections 是曲速邻接；hyperlanes 是稀疏超空间航道。
 * 本文件不访问 DOM。它可以在浏览器与 Node.js 中运行。
 */
(function (root) {
  'use strict';
  const clone = x => JSON.parse(JSON.stringify(x));
  const unit = (s,id) => s.units.find(u=>u.id===id);
  const region = (c,id) => c.regions.find(r=>r.id===id);
  const spec = (c,u) => c.units.find(x=>x.id===u.id);
  const link = (c,a,b) => c.connections.find(e=>(e.a===a&&e.b===b)||(e.b===a&&e.a===b));
  const neighbors = (c,id) => c.connections.filter(e=>e.a===id||e.b===id).map(e=>({id:e.a===id?e.b:e.a,edge:e}));
  const adjacent = (c,a,b) => Boolean(link(c,a,b));
  const integer = (v,a,b) => Number.isInteger(v)&&v>=a&&v<=b;
  const validId = s => typeof s==='string'&&/^[a-zA-Z0-9_-]{1,32}$/.test(s);
  const validName = s => typeof s==='string'&&s.trim().length>0&&s.length<=32;
  function validateConfig(raw) {
    if(!raw||raw.version!==4||!Array.isArray(raw.regions)||raw.regions.length<3||raw.regions.length>200||!Array.isArray(raw.units)||raw.units.length<2||raw.units.length>20)throw Error('需要 v4 星图、3–200 个星系及 2–20 艘星舰。');
    const c=clone(raw),m=c.map;c.version=4;
    if(!m||!integer(m.width,200,10000)||!integer(m.height,200,10000))throw Error('底图宽高必须为 200–10000 的整数。');
    const point=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=0&&p[0]<=m.width&&p[1]>=0&&p[1]<=m.height;
    const ids=new Set();
    for(const r of c.regions){
      if(!validId(r.id)||ids.has(r.id)||!validName(r.name)||!point(r.center)||!["star","blackhole","pulsar"].includes(r.kind)||!integer(r.moveCost,1,6)||!integer(r.defense,0,3))throw Error('星系 ID、名称、类型、坐标或属性无效；移动成本 1–6，防御 0–3。');
      if(typeof r.terrain!=='string'||r.terrain.length>16)throw Error('地形名称过长或格式不正确。');ids.add(r.id);
    }
    if(!Array.isArray(c.connections)||c.connections.length>1200)throw Error('connections 必须是连接数组。');
    const edges=new Set();
    for(const e of c.connections){
      const key=[e.a,e.b].sort().join('|');
      if(!ids.has(e.a)||!ids.has(e.b)||e.a===e.b||edges.has(key)||!integer(e.extraCost??0,0,3)||!Array.isArray(e.via)||e.via.length>30||!e.via.every(point))throw Error('连接必须引用不同且存在的星系，不能重复；via 为路线坐标数组。');
      e.extraCost??=0;edges.add(key);
    }
    const reached=new Set([c.regions[0].id]),q=[c.regions[0].id];
    while(q.length)for(const x of neighbors(c,q.shift()))if(!reached.has(x.id)){reached.add(x.id);q.push(x.id);}
    if(reached.size!==ids.size)throw Error('地图存在孤立星系，请补全连接后再导入。');
    if(!Array.isArray(c.hyperlanes)||c.hyperlanes.length>1200)throw Error('hyperlanes 必须是超空间航道数组，可以为空或只覆盖部分星系。');
    const laneIds=new Set();
    for(const e of c.hyperlanes){
      const k=[e.a,e.b].sort().join('|');
      if(!ids.has(e.a)||!ids.has(e.b)||e.a===e.b||laneIds.has(k)||!integer(e.cost,1,3))throw Error('超空间航道端点或费用无效；不能重复，费用 1–3。');
      laneIds.add(k);
    }
    const unitIds=new Set(),starts=new Set();
    for(const u of c.units){
      u.kind??="frigate";u.armor??=0;u.healAmount??=0;u.maxHeals??=u.healAmount>0?3:0;
      if(!["frigate","scout","cruiser","tender"].includes(u.kind)||!integer(u.armor,0,3)||!integer(u.healAmount,0,8)||!integer(u.maxHeals,0,9))throw Error("舰种无效；护甲为 0–3，维修量为 0–8，维修物资次数为 0–9。 ");
      if(!["warp","hyper"].includes(u.engine))throw Error("每艘星舰必须装备 warp 曲速或 hyper 超空间引擎。");
      if(!validId(u.id)||unitIds.has(u.id)||!validName(u.name)||!['blue','red'].includes(u.side)||!ids.has(u.startRegion)||starts.has(u.startRegion)||!integer(u.maxHp,4,50)||!integer(u.attack,2,8)||!integer(u.maxAp,2,12))throw Error('星舰配置无效：开局位置不可重叠，舰体 4–50、攻击 2–8、行动点 2–12。');
      unitIds.add(u.id);starts.add(u.startRegion);
      const routes=u.engine==='warp'?c.connections:c.hyperlanes;
      if(u.engine==='hyper'&&!routes.some(e=>e.a===u.startRegion||e.b===u.startRegion))throw Error('超空间舰的开局星系需要接入至少一条航道。');
      if(routes.some(e=>(u.engine==='hyper'?e.cost:Math.max(region(c,e.a).moveCost,region(c,e.b).moveCost)+e.extraCost)>u.maxAp))throw Error('本舰行动力不足以完成所属引擎网络的单次跳跃。');
    }
    if(!['blue','red'].every(side=>c.units.some(u=>u.side===side)))throw Error('地图必须包含蓝、红双方。');
    return c;
  }
  function initialState(c,seed=42){validateConfig(c);return {version:4,round:1,activeSide:'blue',winner:null,seed:seed>>>0,units:c.units.map(u=>({id:u.id,side:u.side,regionId:u.startRegion,hp:u.maxHp,ap:u.maxAp,guard:false,healUsed:false,healsLeft:u.maxHeals??(u.healAmount>0?3:0)}))};}
  function gate(s,id){const u=unit(s,id);return s.winner?'对局已结束。':!u||u.hp<=0?'星舰无法行动。':u.side!==s.activeSide?'当前不是该星舰的回合。':null;}
  function occupant(s,id){return s.units.find(u=>u.hp>0&&u.regionId===id);}
  const driveName = drive=>drive==='hyper'?'超空间':'曲速';
  const movementNeighbors=(c,id,drive)=> (drive==='hyper'?c.hyperlanes:c.connections).filter(e=>e.a===id||e.b===id).map(e=>({id:e.a===id?e.b:e.a,edge:e}));
  const stepCost=(c,to,e,drive)=>drive==='hyper'?e.cost:region(c,to).moveCost+e.extraCost;
  const armorValue=(c,u)=>region(c,u.regionId).kind==='pulsar'?0:(spec(c,u).armor||0);
  // Dijkstra 在本舰所属的航行图上搜索。两种引擎不会混用边。
  // driveOverride 只用于界面的假设比较；执行移动始终读取配置里的实际引擎。
  // 距离在地图上看起来近，不代表行动点成本小。
  function paths(c,s,unitId,driveOverride){
    const u=unit(s,unitId);if(!u||u.hp<=0)return new Map();const drive=driveOverride||spec(c,u).engine;
    if(!['warp','hyper'].includes(drive))return new Map();
    const blocked=new Set(s.units.filter(x=>x.id!==unitId&&x.hp>0).map(x=>x.regionId));
    const out=new Map([[u.regionId,{cost:0,path:[u.regionId],engine:drive}]]),done=new Set();
    while(true){
      let current=null,best=Infinity;
      for(const [id,v]of out)if(!done.has(id)&&v.cost<best){current=id;best=v.cost;}
      if(current===null)break;done.add(current);
      for(const n of movementNeighbors(c,current,drive)){
        if(blocked.has(n.id)||done.has(n.id))continue;
        const cost=best+stepCost(c,n.id,n.edge,drive);
        if(!out.has(n.id)||cost<out.get(n.id).cost)out.set(n.id,{cost,path:[...out.get(current).path,n.id],engine:drive});
      }
    }
    return out;
  }
  function moveError(c,s,id,to){
    const err=gate(s,id);if(err)return err;const u=unit(s,id);
    if(!region(c,to))return '目标星系不存在。';
    if(to===u.regionId)return '星舰已经在这里。';
    if(occupant(s,to))return occupant(s,to).side===u.side?'友舰占据该星系；请先移动友舰或选择其他目的地。':'敌舰占据该星系；移至相邻星系后可以攻击。';
    const route=paths(c,s,id).get(to);
    if(!route)return spec(c,u).engine==='hyper'?'本舰仅能走超空间航道：目标未接入同一航道网，或航道被星舰阻挡。':'当前没有未被星舰阻挡的曲速路径。';
    if(route.cost>u.ap)return `整条路线需要 ${route.cost} 行动点，目前只有 ${u.ap} 点。可先移动到途中星系。`;
    return null;
  }
  function attackError(c,s,id,targetId){
    const err=gate(s,id);if(err)return err;const u=unit(s,id),t=unit(s,targetId);
    if(!t||t.hp<=0||t.side===u.side)return '请选择存活的敌方星舰。';
    if(!adjacent(c,u.regionId,t.regionId))return '敌舰不在战术邻接星系；超空间远程连接不会延长炮火射程。';
    if(u.ap<2)return '攻击需要 2 行动点。';return null;
  }
  // 维修也走相同的规则入口。每艘星舰单独记录本回合是否已维修。
  function healError(c,s,id,targetId){
    const err=gate(s,id);if(err)return err;const u=unit(s,id),t=unit(s,targetId);
    if(!(spec(c,u).healAmount>0))return '这艘星舰没有维修能力。';
    if(u.healsLeft<1)return '维修物资已用完，本局无法继续维修。';
    if(u.healUsed)return '这艘星舰本回合已经维修过。';
    if(!t||t.hp<=0||t.side!==u.side)return '只能维修存活的友舰或自己。';
    if(t.id!==u.id&&!adjacent(c,u.regionId,t.regionId))return '维修目标必须是自己或相邻连通星系的友舰。';
    if(t.hp>=spec(c,t).maxHp)return '目标舰体已满，无需维修。';
    if(u.ap<2)return '维修需要 2 行动点。';return null;
  }
  function transition(c,s,a){
    let err=null,route=null;
    if(a.type==='move'){err=moveError(c,s,a.unitId,a.to);if(!err)route=paths(c,s,a.unitId).get(a.to);}
    else if(a.type==='attack')err=attackError(c,s,a.unitId,a.targetId);
    else if(a.type==='heal')err=healError(c,s,a.unitId,a.targetId);
    else if(a.type==='guard'){err=gate(s,a.unitId);if(!err&&unit(s,a.unitId).ap<1)err='防御至少需要 1 行动点。';}
    else if(a.type==='endTurn')err=s.winner?'对局已结束。':null;
    else err='未知行动。';
    if(err)return{ok:false,state:s,action:a.type,message:err,check:err,changes:[]};
    const n=clone(s),changes=[];let message='',check='',dice=null;
    function change(u,key,value){const before=u[key];u[key]=value;if(before!==value)changes.push({path:`units.${u.id}.${key}`,before,after:value});}
    if(a.type==='move'){
      const u=unit(n,a.unitId);change(u,'regionId',a.to);change(u,'ap',u.ap-route.cost);change(u,'guard',false);
      check=`${driveName(route.engine)}引擎 · ${route.path.length-1} 段航路有效 · 路线未被占据 · 行动点足够`;
      message=`${spec(c,u).name}：${route.path.map(id=>region(c,id).name).join(' → ')}，消耗 ${route.cost} 行动点。`;
    }else if(a.type==='attack'){
      const u=unit(n,a.unitId),t=unit(n,a.targetId),terrain=region(c,t.regionId),oldSeed=n.seed;
      n.seed=(Math.imul(n.seed,1664525)+1013904223)>>>0;dice=Math.floor(n.seed/4294967296*6)+1;
      const bonus=dice>=5?1:0,defense=terrain.defense+armorValue(c,t)+(t.guard?1:0),damage=Math.max(1,spec(c,u).attack+bonus-defense);
      change(u,'ap',u.ap-2);change(u,'guard',false);change(t,'hp',Math.max(0,t.hp-damage));changes.push({path:'seed',before:oldSeed,after:n.seed});
      if(t.hp===0){change(t,'ap',0);change(t,'guard',false);}
      check=`星系连通 · 本次总减伤 ${defense}（地形、护甲、防御姿态） · 攻击消耗 2 行动点`;message=`${spec(c,u).name}掷出 ${dice}，伤害 max(1, ${spec(c,u).attack}+${bonus}−${defense})=${damage}；${spec(c,t).name}舰体剩余 ${t.hp}。`;
      if(!n.units.some(x=>x.side!==u.side&&x.hp>0)){n.winner=u.side;changes.push({path:'winner',before:null,after:u.side});message+=' 对局结束。';}
    }else if(a.type==='heal'){
      const u=unit(n,a.unitId),t=unit(n,a.targetId),amount=Math.min(spec(c,u).healAmount,spec(c,t).maxHp-t.hp);
      change(u,'ap',u.ap-2);change(u,'guard',false);change(u,'healUsed',true);change(u,'healsLeft',u.healsLeft-1);change(t,'hp',t.hp+amount);
      check='同阵营且存活 · 自身或相邻连通星系 · 每回合一次 · 消耗 2 行动点';
      message=`${spec(c,u).name}为${spec(c,t).name}恢复 ${amount} 舰体，当前 ${t.hp}/${spec(c,t).maxHp}，剩余 ${u.healsLeft} 份维修物资。`;
    }else if(a.type==='guard'){
      const u=unit(n,a.unitId);change(u,'guard',true);change(u,'ap',0);check='消耗剩余行动点';message=`${spec(c,u).name}防御中，直到下一次己方回合开始，每次受到的伤害减少 1。`;
    }else{
      n.activeSide=s.activeSide==='blue'?'red':'blue';changes.push({path:'activeSide',before:s.activeSide,after:n.activeSide});
      if(n.activeSide==='blue'){n.round++;changes.push({path:'round',before:s.round,after:n.round});}
      for(const u of n.units.filter(x=>x.hp>0&&x.side===n.activeSide)){change(u,'ap',spec(c,u).maxAp);change(u,'guard',false);change(u,'healUsed',false);}
      check='结束本方行动 · 恢复下一方行动点';message=`第 ${n.round} 回合，${n.activeSide==='blue'?'蓝方':'红方'}开始行动。`;
    }
    return{ok:true,state:n,action:a.type,message,check,changes,dice,route};
  }
  function teamAction(c,s,side=s.activeSide){
    if(s.winner||s.activeSide!==side)return null;
    const allies=s.units.filter(u=>u.side===side&&u.hp>0),enemies=s.units.filter(u=>u.side!==side&&u.hp>0);
    // 先寻找合法的维修，避免支援舰在受伤队友行动前就用光行动点。
    for(const medic of allies){
      const wounded=allies.filter(t=>!healError(c,s,medic.id,t.id)).sort((a,b)=>(spec(c,b).maxHp-b.hp)-(spec(c,a).maxHp-a.hp));
      if(wounded.length)return{type:'heal',unitId:medic.id,targetId:wounded[0].id};
    }
    // 优先处理已有攻击机会，再移动；所有星舰调用同一 transition，不额外获得行动点。
    for(const ai of allies.filter(u=>u.ap>0)){
      const targets=enemies.filter(t=>!attackError(c,s,ai.id,t.id)).sort((a,b)=>a.hp-b.hp);
      if(targets.length)return{type:'attack',unitId:ai.id,targetId:targets[0].id};
    }
    for(const ai of allies.filter(u=>u.ap>0)){
      const routes=paths(c,s,ai.id);let best=null;
      for(const target of enemies)for(const near of neighbors(c,target.regionId)){
        const r=routes.get(near.id);if(r&&(!best||r.cost<best.cost))best=r;
      }
      if(best&&best.path.length>1){
        let to=null;
        for(const id of best.path.slice(1)){if(routes.get(id).cost<=ai.ap)to=id;else break;}
        if(to)return{type:'move',unitId:ai.id,to};
      }
    }
    const waiting=allies.find(u=>u.ap>0);
    return waiting?{type:'guard',unitId:waiting.id}:{type:'endTurn'};
  }
  function aiAction(c,s){return teamAction(c,s,'red');}
  function validateSave(payload){
    if(!payload||payload.format!=='star-routes-save-v4')throw Error('这不是远星航路 v4 存档。');
    const config=validateConfig(payload.config),s=clone(payload.state);
    if(!s||s.version!==4||!integer(s.round,1,1000000)||!['blue','red'].includes(s.activeSide)||![null,'blue','red'].includes(s.winner)||!integer(s.seed,0,4294967295)||!Array.isArray(s.units)||s.units.length!==config.units.length)throw Error('局面格式无效。');
    const occupied=new Set();
    for(const sp of config.units){
      const us=s.units.filter(u=>u.id===sp.id);if(us.length!==1)throw Error('存档星舰缺失或重复。');const u=us[0];
      if(u.side!==sp.side||!region(config,u.regionId)||!integer(u.hp,0,sp.maxHp)||!integer(u.ap,0,sp.maxAp)||typeof u.guard!=='boolean'||typeof u.healUsed!=='boolean'||!integer(u.healsLeft,0,sp.maxHeals))throw Error('星舰状态不合法。');
      if(u.hp>0){if(occupied.has(u.regionId))throw Error('星舰不能重叠。');occupied.add(u.regionId);}
    }
    const alive=['blue','red'].filter(side=>s.units.some(u=>u.side===side&&u.hp>0));
    if((s.winner&&(alive.length!==1||alive[0]!==s.winner))||(!s.winner&&alive.length!==2))throw Error('胜负状态不一致。');
    return{config,state:s};
  }
  const API={clone,validateConfig,initialState,unit,region,spec,link,neighbors,adjacent,occupant,movementNeighbors,stepCost,driveName,armorValue,paths,moveError,attackError,healError,transition,teamAction,aiAction,validateSave};
  if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.GameEngine=API;
})(typeof window!=='undefined'?window:globalThis);
