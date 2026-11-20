/* 星图版 v6：两张航行图。connections 是曲速邻接；hyperlanes 是稀疏超空间航道。
 * 本文件不访问 DOM。它可以在浏览器与 Node.js 中运行。
 */
(function (root) {
  'use strict';
  const Campaign=typeof module!=='undefined'&&module.exports?require('./campaign.js'):root.Campaign;
  const F=typeof module!=='undefined'&&module.exports?require('./fleet.js'):root.FleetData;
  const sideName=(c,side)=>Campaign.factionFor(c,side).name;
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
  const isFixed = kind=>kind==='station'||kind==='battery';
  const mounts=sp=>sp.guns;
  const gunName=type=>({laser:'激光炮',kinetic:'动能炮',repair:'维修队'})[type];
  function magazine(sp){return Object.fromEntries(mounts(sp).map(g=>[g.id,g.capacity]));}
  function equipped(c,s,id,slot){
    const guns=mounts(spec(c,unit(s,id)));
    return slot===undefined?guns[0]:guns.find(g=>g.id===slot);
  }
  function aimOptions(c,u){
    if(u.unstable)return [0];
    const terrain=region(c,u.regionId).kind;
    const costs=terrain==='blackhole'?[0,2]:terrain==='pulsar'?[0,1]:[0,1,2];
    return costs.filter(n=>n<=u.mp);
  }
  function shotProfile(c,target,gun,attacker,aim=0){
    const armor=gun.type==='laser'?0:armorValue(c,target);
    const bonus=attacker&&region(c,attacker.regionId).kind==='blackhole'?Math.floor(aim/2):aim;
    const threshold=gun.attack+bonus-(attacker?.unstable?2:0)-target.evasion;
    const damage=Math.max(0,gun.damage-armor-region(c,target.regionId).defense-Number(target.guard));
    return {threshold,faces:Math.max(0,Math.min(6,threshold-1)),damage,armor};
  }
  function evadeGain(c,u,spend){return Math.floor(spend/(region(c,u.regionId).kind==='blackhole'?2:1));}
  function defenseError(c,s,id,action,spend){
    const err=gate(s,id);if(err)return err;
    const u=unit(s,id),sp=spec(c,u);
    if(action==='guard')return sp.kind==='scout'?'侦察舰使用规避。':u.ap<1?'戒备需要行动力。':null;
    if(u.unstable||u.evaded)return '离轨失稳或本回合已规避。';
    const minimum=sp.kind==='scout'?Math.floor(sp.maxMp/2):1;
    return integer(spend,minimum,u.mp)&&evadeGain(c,u,spend)>0?null:'可用机动点不足。';
  }
  function repairAmount(sp){return Math.max(8,Math.ceil(sp.maxHp*0.6));}
  function selfRepair(c,s,u){
    const max=spec(c,u).maxHp;
    const assisted=occupants(s,u.regionId).some(x=>x.id!==u.id&&x.side===u.side&&spec(c,x).kind==='tender');
    const cap=Math.floor(max*(assisted?0.8:0.5));
    return {assisted,cap,gain:Math.max(0,Math.min(cap-u.hp,Math.ceil(max*(assisted?0.2:0.15))))};
  }
  function projectError(c,s,id,type){
    const err=gate(s,id);if(err)return err;
    const u=unit(s,id),sp=spec(c,u);
    if(isFixed(sp.kind)||u.acted)return '需要机动舰本回合尚未行动。';
    if(type==='resupply')return sp.kind==='tender'&&u.healsLeft<sp.maxHeals?null:'仅未满载的支援舰可收集补给。';
    return u.hp*2<sp.maxHp&&selfRepair(c,s,u).gain>0?null:'仅在船体低于 50% 时可启动自修复。';
  }
  function retreatChance(c,u){return Math.max(0,spec(c,u).retreat-(region(c,u.regionId).kind==='blackhole'?25:0));}
  function roll(s,faces){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return Math.floor(s.seed/4294967296*faces)+1;}
  function escapeRoute(c,s,u){
    const distance=new Map([[u.regionId,0]]),parent=new Map(),queue=[u.regionId];
    for(let i=0;i<queue.length;i++){
      const id=queue[i],d=distance.get(id);if(d===4)continue;
      for(const edge of neighbors(c,id))if(!distance.has(edge.id)){distance.set(edge.id,d+1);parent.set(edge.id,id);queue.push(edge.id);}
    }
    const safe=[...distance].filter(([id,d])=>d>=2&&!occupants(s,id).some(x=>x.side!==u.side));
    const range=roll(s,3)+1,primary=safe.filter(([,d])=>d===range);
    const pool=primary.length?primary:safe;
    if(!pool.length)return null;
    const path=[pool[roll(s,pool.length)-1][0]];
    while(parent.has(path[0]))path.unshift(parent.get(path[0]));
    return path;
  }
  function headquarters(c){return c.units.find(u=>u.kind==='station');}
  function outcome(c,s){
    if(c.campaign.mode==='siege'){
      const defender=c.campaign.defender,attacker=defender==='player'?'enemy':'player';
      if(unit(s,headquarters(c).id).hp<=0)return attacker;
      if(s.round>Campaign.siegeRounds||!s.units.some(u=>u.side===attacker&&u.hp>0))return defender;
      return null;
    }
    const alive=s.units.filter(u=>u.hp>0);
    if(c.campaign.mode!=='siege'&&alive.some(u=>u.side==='player')&&alive.some(u=>u.side==='enemy')&&alive.every(u=>spec(c,u).kind==='tender'))return 'draw';
    return ['player','enemy'].find(side=>!s.units.some(u=>u.side!==side&&u.hp>0))||null;
  }
  function validateConfig(raw,{existingBattle=false}={}) {
    if(!raw||raw.version!==6||!Array.isArray(raw.regions)||raw.regions.length<3||raw.regions.length>200||!Array.isArray(raw.units)||raw.units.length<2||raw.units.length>20)throw Error('需要 v6 星图、3–200 个星系及 2–20 艘星舰。');
    const c=clone(raw),m=c.map;c.version=6;Campaign.validate(c.campaign);
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
    if(!Array.isArray(c.hyperlanes)||c.hyperlanes.length>1200)throw Error('hyperlanes 必须是超空间航道数组，可以为空或只覆盖部分星系。');
    const laneIds=new Set();
    for(const e of c.hyperlanes){
      const k=[e.a,e.b].sort().join('|');
      if(!ids.has(e.a)||!ids.has(e.b)||e.a===e.b||laneIds.has(k)||!integer(e.cost,1,3))throw Error('超空间航道端点或费用无效；不能重复，费用 1–3。');
      laneIds.add(k);
      if(!edges.has(k)){
        c.connections.push({a:e.a,b:e.b,extraCost:0,via:[]});edges.add(k);
      }
    }
    const reached=new Set([c.regions[0].id]),q=[c.regions[0].id];
    while(q.length)for(const x of neighbors(c,q.shift()))if(!reached.has(x.id)){reached.add(x.id);q.push(x.id);}
    if(reached.size!==ids.size)throw Error('地图存在孤立星系，请补全连接后再导入。');
    const unitIds=new Set();
    for(const u of c.units){
      u.kind??="frigate";u.armor??=0;u.healAmount??=0;u.maxHeals??=u.healAmount>0?3:0;
      if(!Object.keys(F.hulls).includes(u.kind)||!integer(u.armor,0,3)||!integer(u.healAmount,0,8)||!integer(u.maxHeals,0,9))throw Error("舰种无效；护甲为 0–3，维修量为 0–8，维修物资次数为 0–9。 ");
      if(!raw.fleetEdition&&u.engine==='warp'&&u.maxAp===5)u.maxAp=6;
      if(raw.ruleset!==9){
        const fit=F.fit(u.kind);
        Object.assign(u,{maxMp:fit.maxMp,thruster:fit.thruster,retreat:fit.retreat,guns:fit.guns,maxHeals:fit.maxHeals,healAmount:0});
        if(u.kind==='tender')Object.assign(u,{maxHp:16,armor:2});
      }
      if(!integer(u.maxMp,0,12)||!integer(u.retreat,0,100))throw Error('机动或撤退参数无效。');
      if(isFixed(u.kind)&&(u.engine!=='fixed'||c.campaign.mode!=='siege'||u.side!==c.campaign.defender))throw Error('固定设施必须属于攻防战守方且没有引擎。');
      if(!isFixed(u.kind)&&!["warp","hyper"].includes(u.engine))throw Error("每艘星舰必须装备 warp 曲速或 hyper 超空间引擎。");
      if(!validId(u.id)||unitIds.has(u.id)||!validName(u.name)||!['player','enemy'].includes(u.side)||!ids.has(u.startRegion)||!integer(u.maxHp,4,50)||!integer(u.attack,2,8)||!integer(u.maxAp,2,12))throw Error('星舰配置无效：舰体 4–50、攻击 2–8、行动点 2–12。');
      if(!Array.isArray(u.guns)||!u.guns.length||u.guns.length>8||
         new Set(u.guns.map(g=>g.id)).size!==u.guns.length||
         u.guns.some(g=>!validId(g.id)||!Object.hasOwn(F.weapons,g.model)||F.weapons[g.model][0]!==g.type||
           (g.type==='repair')!==(u.kind==='tender')||!integer(g.attack,0,7)||!integer(g.damage,0,12)||!integer(g.capacity,1,8)))throw Error('设备挂载参数无效。');
      u.faction=Campaign.factionFor(c,u.side).id;
      u.thruster=F.hulls[u.kind][7];
      for(const g of u.guns)g.label=F.weapons[g.model][1];
      unitIds.add(u.id);
      if(isFixed(u.kind))continue;
      const routes=u.engine==='warp'?c.connections:c.hyperlanes;

      if(routes.some(e=>Math.max(stepCost(c,e.a,e,u.engine),stepCost(c,e.b,e,u.engine))>u.maxAp))throw Error('本舰行动力不足以完成所属引擎网络的单次跳跃。');
    }
    if(!['player','enemy'].every(side=>c.units.some(u=>u.side===side)))throw Error('地图必须包含己方与敌方。');
    if(c.campaign.mode==='siege'&&c.units.filter(u=>u.kind==='station').length!==1)throw Error('攻防战需要一座守方司令部。');
    const home=c.campaign.mode==='siege'&&c.campaign.defender==='enemy'?c.campaign.enemyFaction:c.campaign.playerFaction;
    if(!c.atlasVersion){
      c.campaign.nameSet=home;
      Campaign.atlas.populate(c);
      if(c.campaign.mode==='siege')Campaign.deploySiege(c,c.campaign.defender);
    }
    if(c.atlasVersion!==1||c.campaign.nameSet!==home)throw Error('星图归属须与本土一方一致。');
    c.regions.forEach(Campaign.atlas.check);
    if(c.campaign.mode==='siege'){
      const station=headquarters(c),site=region(c,station.startRegion),xs=c.regions.map(r=>r.center[0]);
      const platforms=c.units.filter(u=>u.kind==='battery');
      if(site.center[0]!==Math.max(...xs)||site.star.type!=='main'||site.planets.rocky<1||
         platforms.length!==3||new Set(platforms.map(u=>u.startRegion)).size!==3||
         platforms.some(u=>!adjacent(c,site.id,u.startRegion))||
         c.units.some(u=>u.side!==station.side&&region(c,u.startRegion).center[0]!==Math.min(...xs)))
        throw Error('攻防部署无效：攻方须在最西端，司令部须在最东端有类地行星的单主序星系，三座平台须分别驻扎邻接星系。');
    }
    if(!c.fleetEdition){
      if(!existingBattle&&c.campaign.mode==='siege')Campaign.reinforce(c);
      if(c.units.every(u=>u.id==='sector-hq'||/^(player|enemy)-(frigate|scout|tender|cruiser|destroyer|battleship)(-2)?$|^battery-[123]$/.test(u.id)))Campaign.registerFleet(c);
      c.fleetEdition=1;
    }
    c.ruleset=9;return c;
  }
  function initialState(c,seed=42){c=validateConfig(c);return {control:openingControl(c,c.units),pendingClaims:openingClaims(c.units),version:6,round:1,activeSide:'player',winner:null,seed:seed>>>0,units:c.units.map(u=>({id:u.id,side:u.side,regionId:u.startRegion,hp:u.maxHp,ap:u.maxAp,mp:u.maxMp,unstable:false,acted:false,job:null,retreatUsed:false,fp:magazine(u),evasion:0,evaded:false,guard:false,healUsed:false,healsLeft:u.maxHeals??(u.healAmount>0?3:0)}))};}
  function gate(s,id){const u=unit(s,id);return s.winner?'对局已结束。':!u||u.hp<=0?'星舰无法行动。':u.side!==s.activeSide?'当前不是该星舰的回合。':u.job?'正在执行整回合作业。':null;}
  function occupants(s,id){return s.units.filter(u=>u.hp>0&&u.regionId===id);}
  function targets(s,id){const u=unit(s,id);return u?occupants(s,u.regionId).filter(t=>t.side!==u.side):[];}
  function openingClaims(units){
    const contested=new Set(),seen=new Map();
    for(const u of units){
      if(u.hp===0)continue;
      const id=u.regionId||u.startRegion;
      if(seen.has(id)&&seen.get(id)!==u.side)contested.add(id);
      seen.set(id,u.side);
    }
    return [...contested];
  }
  function openingControl(c,units){
    const home=c.campaign.mode==='siege'?c.campaign.defender:'player';
    const owners=Object.fromEntries(c.regions.map(r=>[r.id,r.colonized?home:null]));
    const mixed=new Set(openingClaims(units));
    for(const u of units){
      const id=u.regionId||u.startRegion;
      if(u.hp!==0&&!mixed.has(id))owners[id]=u.side;
    }
    return owners;
  }
  function claimQuietSystem(s,id){
    const units=occupants(s,id);
    if(units.length&&units.every(u=>u.side===units[0].side))s.control[id]=units[0].side;
    if(new Set(units.map(u=>u.side)).size<2)s.pendingClaims=s.pendingClaims.filter(key=>key!==id);
  }
  function controlStrength(c,units){
    let ships=0,hull=0,fire=0;
    for(const u of units){
      const sp=spec(c,u);
      if(!isFixed(sp.kind))ships++;
      hull+=u.hp;
      for(const g of mounts(sp))if(g.type!=='repair')fire+=u.fp[g.id];
    }
    const hullBonus=Math.ceil(hull/10),fireBonus=Math.ceil(fire/5);
    return {ships,hull,fire,hullBonus,fireBonus,modifier:ships+hullBonus+fireBonus};
  }
  function resolveClaims(c,s){
    const reports=[];
    for(const id of s.pendingClaims){
      const forces=occupants(s,id),previous=s.control[id],scores={};
      if(!['player','enemy'].every(side=>forces.some(u=>u.side===side)))continue;
      for(const side of ['player','enemy']){
        const value=controlStrength(c,forces.filter(u=>u.side===side));
        value.die=roll(s,6);value.total=value.die+value.modifier;scores[side]=value;
      }
      const delta=scores.player.total-scores.enemy.total,tie=delta===0;
      const owner=tie?previous:delta>0?'player':'enemy';
      s.control[id]=owner;reports.push({id,previous,owner,tie,scores});
    }
    s.pendingClaims=[];
    return reports;
  }
  const driveName = drive=>drive==='fixed'?'固定驻防':drive==='hyper'?'超空间':'曲速';
  const laneCache=new WeakMap();
  function laneIndex(c){
    if(!laneCache.has(c)){
      const index=new Map();for(const e of c.hyperlanes){index.set(e.a+'|'+e.b,e);index.set(e.b+'|'+e.a,e);}
      laneCache.set(c,index);
    }
    return laneCache.get(c);
  }
  function movementNeighbors(c,id,drive){
    const list=neighbors(c,id);if(drive!=='hyper')return list;
    const lanes=laneIndex(c);return list.map(n=>({id:n.id,edge:lanes.get(id+'|'+n.id)||{...n.edge,cost:2,offlane:true}}));
  }
  function stepCost(c,to,e,drive){
    if(drive==='hyper')return e.cost;
    return laneIndex(c).has(e.a+'|'+e.b)?2:region(c,to).moveCost+(e.extraCost||0);
  }
  const armorValue=(c,u)=>region(c,u.regionId).kind==='pulsar'?0:(spec(c,u).armor||0);
  // Dijkstra 在本舰所属的航行图上搜索。曲速图包含航道两端的普通连接。
  // driveOverride 只用于界面的假设比较；执行移动始终读取配置里的实际引擎。
  // 距离在地图上看起来近，不代表行动点成本小。
  function paths(c,s,unitId,driveOverride){
    const u=unit(s,unitId);if(!u||u.hp<=0||isFixed(spec(c,u).kind))return new Map();const drive=driveOverride||spec(c,u).engine;
    if(!['warp','hyper'].includes(drive))return new Map();
    const out=new Map([[u.regionId,{cost:0,path:[u.regionId],engine:drive,off:0}]]),done=new Set();
    while(true){
      let current=null,best=Infinity;
      for(const [id,v]of out)if(!done.has(id)&&v.cost<best){current=id;best=v.cost;}
      if(current===null)break;done.add(current);
      for(const n of movementNeighbors(c,current,drive)){
        if(done.has(n.id))continue;
        const cost=best+stepCost(c,n.id,n.edge,drive);
        const off=out.get(current).off+Number(!!n.edge.offlane);
        if(!out.has(n.id)||cost<out.get(n.id).cost||(cost===out.get(n.id).cost&&off<out.get(n.id).off))out.set(n.id,{cost,off,path:[...out.get(current).path,n.id],engine:drive});
      }
    }
    return out;
  }
  function inEnemyControl(s,u){
    const owner=s.control[u.regionId];
    return owner!=null&&owner!==u.side;
  }
  // cost 是航段的最低启动费用，spent 是本指令实际扣除的 AP。
  function flightPlan(c,s,id,to,route){
    const u=unit(s,id);
    if(!u)return null;
    route=route||paths(c,s,id).get(to);if(!route)return null;
    const leaving=route.path.length>1&&inEnemyControl(s,u);
    let path=route.path,cost=route.cost,off=route.off;
    if(leaving){
      const hops=movementNeighbors(c,u.regionId,route.engine);
      const hop=hops.find(n=>n.id===to)||hops.find(n=>n.id===path[1]);
      path=[u.regionId,hop.id];
      cost=stepCost(c,hop.id,hop.edge,route.engine);off=Number(!!hop.edge.offlane);
    }
    const contactAt=path.findIndex((r,i)=>i>0&&occupants(s,r).some(t=>t.side!==u.side));
    const contact=contactAt>=0;
    if(contact&&contactAt<path.length-1){
      path=path.slice(0,contactAt+1);cost=0;off=0;
      for(let i=1;i<path.length;i++){
        const edge=movementNeighbors(c,path[i-1],route.engine).find(n=>n.id===path[i]).edge;
        cost+=stepCost(c,path[i],edge,route.engine);off+=Number(!!edge.offlane);
      }
    }
    const spent=leaving||contact?Math.max(u.ap,cost):cost;
    return {path,cost,spent,off,engine:route.engine,contact,leaving,to:path.at(-1)};
  }
  function moveError(c,s,id,to){
    const err=gate(s,id);if(err)return err;const u=unit(s,id);
    if(isFixed(spec(c,u).kind))return '固定设施无法移动。';
    if(!region(c,to))return '目标星系不存在。';
    if(to===u.regionId)return '星舰已经在这里。';
    const route=flightPlan(c,s,id,to);
    if(!route)return spec(c,u).engine==='hyper'?'本舰仅能走超空间航道：目标未接入同一航道网。':'当前没有连通的曲速路径。';
    if(route.leaving&&route.cost>u.ap)return `脱离的首跳至少需要 ${route.cost} AP，本舰剩余 ${u.ap} AP。`;
    if(route.cost>u.ap)return `整条路线需要 ${route.cost} 行动点，目前只有 ${u.ap} 点。可先移动到途中星系。`;
    return null;
  }
  function attackError(c,s,id,targetId,type,aim=0){
    const err=gate(s,id);if(err)return err;const u=unit(s,id),t=unit(s,targetId);
    if(!t||t.hp<=0||t.side===u.side)return '请选择存活的敌方星舰。';
    if(u.regionId!==t.regionId)return '普通舰炮只能攻击本星系内的敌舰。';
    const gun=equipped(c,s,id,type);
    if(!gun||gun.type==='repair')return '该设备无法攻击。';
    if(!aimOptions(c,u).includes(aim))return '瞄准投入超出当前机动或地形限制。';
    return u.fp[gun.id]<1?'这门舰炮本回合火力点已用尽。':null;
  }
  // 维修也走相同的规则入口。每艘星舰单独记录本回合是否已维修。
  function healError(c,s,id,targetId){
    const err=gate(s,id);if(err)return err;const u=unit(s,id),t=unit(s,targetId);
    if(spec(c,u).kind!=='tender')return '这艘星舰没有维修能力。';
    if(u.healsLeft<1)return '请先花一整回合收集补给。';
    if(u.fp[spec(c,u).guns[0].id]<1)return '这艘星舰本回合已经维修过。';
    if(!t||t.hp<=0||t.side!==u.side)return '只能维修存活的友舰或自己。';
    if(t.regionId!==u.regionId)return '维修目标必须是本星系内的友舰或自己。';
    if(t.hp>=spec(c,t).maxHp)return '目标舰体已满，无需维修。';
    if(isFixed(spec(c,t).kind))return '维修队只接收舰船。';return null;
  }
  function transition(c,s,a){
    let err=null,route=null,escapePath=null;
    if(a.type==='move'){err=moveError(c,s,a.unitId,a.to);if(!err)route=flightPlan(c,s,a.unitId,a.to);}
    else if(a.type==='attack')err=attackError(c,s,a.unitId,a.targetId,a.weapon,a.aim);
    else if(a.type==='heal')err=healError(c,s,a.unitId,a.targetId);
    else if(a.type==='guard'||a.type==='evade')err=defenseError(c,s,a.unitId,a.type,a.spend);
    else if(['selfRepair','resupply'].includes(a.type))err=projectError(c,s,a.unitId,a.type);
    else if(a.type==='endTurn')err=s.winner?'对局已结束。':null;
    else err='未知行动。';
    if(err)return{ok:false,state:s,action:a.type,message:err,check:err,changes:[]};
    const n=clone(s),changes=[];let message='',check='',dice=null,contests=[];
    function change(u,key,value){const before=u[key];u[key]=value;if(before!==value)changes.push({path:`units.${u.id}.${key}`,before,after:value});}
    if(a.unitId)change(unit(n,a.unitId),'acted',true);
    if(a.type==='move'){
      const u=unit(n,a.unitId),origin=u.regionId;
      for(const id of route.path.slice(1)){
        if(occupants(n,id).some(other=>other.side!==u.side)){
          if(!n.pendingClaims.includes(id))n.pendingClaims.push(id);
        }else n.control[id]=u.side;
      }
      change(u,'regionId',route.to);claimQuietSystem(n,origin);change(u,'ap',u.ap-route.spent);change(u,'guard',false);
      if(route.off){change(u,'unstable',true);change(u,'evasion',0);}
      check=`${driveName(route.engine)}引擎 · ${route.path.length-1} 段航路有效 · 允许多舰共同驻留 · 行动点足够`;
      message=`${spec(c,u).name}：${route.path.map(id=>region(c,id).name).join(' → ')}，航行消耗 ${route.spent} AP。${route.leaving?'脱离敌控星系，只能跃迁一段，本舰剩余移动力耗尽。':''}${route.contact?'接敌停航，本舰 AP 归零，可继续开火。回合末争夺控制权。':''}`;
    }else if(a.type==='attack'){
      const u=unit(n,a.unitId),t=unit(n,a.targetId),terrain=region(c,t.regionId),oldSeed=n.seed;
      n.seed=(Math.imul(n.seed,1664525)+1013904223)>>>0;dice=Math.floor(n.seed/4294967296*6)+1;
      const gun=equipped(c,s,a.unitId,a.weapon),profile=shotProfile(c,t,gun,u,a.aim||0),hit=dice<profile.threshold;
      change(u,'mp',u.mp-(a.aim||0));const before=u.fp[gun.id];u.fp[gun.id]--;
      changes.push({path:'units.'+u.id+'.fp.'+gun.id,before,after:before-1},{path:'seed',before:oldSeed,after:n.seed});
      change(t,'hp',Math.max(0,t.hp-(hit?profile.damage:0)));
      if(t.evasion>0)change(t,'evasion',t.evasion-1);
      let retreat='';
      if(t.hp===0){
        change(t,'job',null);change(t,'ap',0);change(t,'mp',0);change(t,'guard',false);change(t,'evasion',0);
        if(!isFixed(spec(c,t).kind)&&!t.retreatUsed){
          change(t,'retreatUsed',true);const chance=retreatChance(c,t),draw=roll(n,100);
          escapePath=draw<=chance?escapeRoute(c,n,t):null;
          if(escapePath){const dest=escapePath.at(-1);change(t,'hp',1);change(t,'regionId',dest);retreat=' 紧急跃迁成功，残余 1 HP，撤至'+region(c,dest).name+'。';}
          else retreat=' 紧急跃迁失败，舰船损失。';
        }
        claimQuietSystem(n,terrain.id);
        if(t.regionId!==terrain.id)claimQuietSystem(n,t.regionId);
      }
      check=`命中条件为 D6 < ${profile.threshold}。命中后减去装甲 ${profile.armor}、环境 ${terrain.defense}、戒备 ${Number(t.guard||unit(s,t.id).guard)}。`;
      message=`${spec(c,u).name}向${spec(c,t).name}发射${gunName(gun.type)}，掷出 ${dice}，门槛 ${profile.threshold}：${hit?'命中，造成 '+profile.damage+' 伤害':'未命中'}。`+retreat;
    }else if(a.type==='evade'){
      const u=unit(n,a.unitId);
      change(u,'mp',u.mp-a.spend);change(u,'evasion',evadeGain(c,u,a.spend));change(u,'evaded',true);
      check='每回合一次，投入亚光速机动点。';
      message=`${spec(c,u).name}投入 ${a.spend} MP，获得 ${u.evasion} 点闪避。`;
    }else if(a.type==='heal'){
      const u=unit(n,a.unitId),t=unit(n,a.targetId),amount=Math.min(repairAmount(spec(c,t)),spec(c,t).maxHp-t.hp);
      change(u,'fp',{...u.fp,[spec(c,u).guns[0].id]:0});change(u,'healUsed',true);change(u,'healsLeft',u.healsLeft-1);change(t,'hp',t.hp+amount);
      check='同阵营且存活 · 同一星系 · 每回合一次 · 消耗 1 维修队出动次数和 1 补给';
      message=`${spec(c,u).name}为${spec(c,t).name}恢复 ${amount} 舰体，当前 ${t.hp}/${spec(c,t).maxHp}，剩余 ${u.healsLeft} 份维修物资。`;
    }else if(a.type==='selfRepair'||a.type==='resupply'){
      const u=unit(n,a.unitId);change(u,'job',a.type);change(u,'ap',0);change(u,'mp',0);
      change(u,'fp',Object.fromEntries(Object.keys(u.fp).map(k=>[k,0])));
      message=spec(c,u).name+'开始'+(a.type==='resupply'?'收集补给':'自修复')+'，下次己方回合开始时结算。';check='本舰本回合尚未行动';
    }else if(a.type==='guard'){
      const u=unit(n,a.unitId);change(u,'guard',true);change(u,'ap',0);check='消耗剩余行动点';message=`${spec(c,u).name}防御中，直到下一次己方回合开始，每次受到的伤害减少 1。`;
    }else{
      contests=resolveClaims(c,n);
      n.activeSide=s.activeSide==='player'?'enemy':'player';changes.push({path:'activeSide',before:s.activeSide,after:n.activeSide});
      if(n.activeSide==='player'){n.round++;changes.push({path:'round',before:s.round,after:n.round});}
      for(const u of n.units.filter(x=>x.hp>0&&x.side===n.activeSide)){
        if(u.job==='selfRepair')change(u,'hp',u.hp+selfRepair(c,n,u).gain);
        if(u.job==='resupply')change(u,'healsLeft',spec(c,u).maxHeals);
        change(u,'job',null);change(u,'acted',false);change(u,'unstable',false);change(u,'mp',spec(c,u).maxMp);
        change(u,'ap',spec(c,u).maxAp);change(u,'fp',magazine(spec(c,u)));change(u,'evasion',0);change(u,'evaded',false);change(u,'guard',false);change(u,'healUsed',false);}
      check='结束本方行动 · 恢复下一方行动点';message=`第 ${n.round} 回合，${sideName(c,n.activeSide)}开始行动。`;
    }
    for(const id of Object.keys(n.control)){
      if(s.control[id]!==n.control[id])changes.push({path:'control.'+id,before:s.control[id],after:n.control[id]});
    }
    if(contests.length)message+=' 已结算 '+contests.length+' 处星系争夺。';
    n.winner=outcome(c,n);
    if(n.winner){
      changes.push({path:'winner',before:null,after:n.winner});
      message+=(c.campaign.mode==='siege'?(unit(n,headquarters(c).id).hp===0?' 司令部失守。':n.round>Campaign.siegeRounds?' 守备期限届满，司令部守住了星区。':' 进攻舰队全灭。'):' 对局结束。');
    }
    return{ok:true,state:n,action:a.type,message,check,changes,dice,route,escapePath,contests};
  }
  function teamAction(c,s,side=s.activeSide){
    if(s.winner||s.activeSide!==side)return null;
    const allies=s.units.filter(u=>u.side===side&&u.hp>0),enemies=s.units.filter(u=>u.side!==side&&u.hp>0);
    const hq=c.campaign.mode==='siege'?headquarters(c):null;
    // 先寻找合法的维修，避免支援舰在受伤队友行动前就用光行动点。
    for(const medic of allies){
      const wounded=allies.filter(t=>!healError(c,s,medic.id,t.id)).sort((a,b)=>(spec(c,b).maxHp-b.hp)-(spec(c,a).maxHp-a.hp));
      if(wounded.length)return{type:'heal',unitId:medic.id,targetId:wounded[0].id};
    }
    for(const u of allies){
      if(u.healsLeft===0&&!projectError(c,s,u.id,'resupply'))return {type:'resupply',unitId:u.id};
      if(!targets(s,u.id).length&&!projectError(c,s,u.id,'selfRepair'))return {type:'selfRepair',unitId:u.id};
    }
    // 优先处理已有攻击机会，再移动；所有星舰调用同一 transition，不额外获得行动点。
    for(const ai of allies){
      const targetsHere=targets(s,ai.id).sort((a,b)=>Number(b.id===hq?.id)-Number(a.id===hq?.id)||a.hp-b.hp);
      for(const target of targetsHere){
        const guns=mounts(spec(c,ai)).filter(g=>g.type!=='repair'&&ai.fp[g.id]>0);
        const score=g=>{const p=shotProfile(c,target,g,ai);return p.faces*p.damage;};
        guns.sort((a,b)=>score(b)-score(a));
        if(guns.length)return {type:'attack',unitId:ai.id,targetId:target.id,weapon:guns[0].id,aim:aimOptions(c,ai).filter(n=>n===0||shotProfile(c,target,guns[0],ai,n).faces>shotProfile(c,target,guns[0],ai,n===2&&region(c,ai.regionId).kind==='blackhole'?0:n-1).faces).at(-1)};
      }
    }
    for(const ai of allies.filter(u=>u.ap>0)){
      const routes=paths(c,s,ai.id);let best=null;
      let objectives=enemies;
      if(hq){
        // 进攻方前 3 轮集结快舰，让曲速主力先行接近目标。
        if(side!==hq.side&&spec(c,ai).engine==='hyper'&&s.round<=3)continue;
        if(side!==hq.side){
          objectives=[unit(s,hq.id)];
        }else{
          // 保卫司令部的守军前出拦截最近的来舰，敌人接近时回援。
          const perimeter=new Set([hq.startRegion,...neighbors(c,hq.startRegion).map(n=>n.id)]);
          const close=enemies.filter(t=>perimeter.has(t.regionId));
          if(close.length)objectives=close;
        }
      }
      if(spec(c,ai).kind==='tender'){
        objectives=allies.filter(t=>t.id!==ai.id&&!isFixed(spec(c,t).kind));
        objectives.sort((a,b)=>a.hp/spec(c,a).maxHp-b.hp/spec(c,b).maxHp);
        if(objectives.length)objectives=[objectives[0]];
      }
      for(const target of objectives){
        const r=routes.get(target.regionId);if(r&&(!best||r.cost<best.cost))best=r;
      }
      if(best&&best.path.length>1){
        let to=null;
        for(const id of best.path.slice(1)){if(routes.get(id).cost<=ai.ap)to=id;else break;}
        if(to){
          const plan=flightPlan(c,s,ai.id,to,routes.get(to));
          if(plan.cost<=ai.ap)return{type:'move',unitId:ai.id,to:plan.to};
        }
      }
    }
    for(const u of allies){
      const evade={type:'evade',unitId:u.id,spend:u.mp};
      if(!defenseError(c,s,u.id,'evade',u.mp))return evade;
      const action={type:'guard',unitId:u.id};
      if(!defenseError(c,s,u.id,action.type,action.spend))return action;
    }
    return {type:'endTurn'};
  }
  function aiAction(c,s){return teamAction(c,s,'enemy');}
  function validateSave(payload){
    if(!payload||payload.format!=='star-routes-save-v6')throw Error('这不是远星航路 v6 存档。');
    const config=validateConfig(payload.config,{existingBattle:true}),s=clone(payload.state);
    if(!s||s.version!==6||!integer(s.round,1,1000000)||!['player','enemy'].includes(s.activeSide)||![null,'player','enemy','draw'].includes(s.winner)||!integer(s.seed,0,4294967295)||!Array.isArray(s.units)||s.units.length!==config.units.length)throw Error('局面格式无效。');
    for(const sp of config.units){
      const us=s.units.filter(u=>u.id===sp.id);if(us.length!==1)throw Error('存档星舰缺失或重复。');const u=us[0];
      if(!u.fp||mounts(sp).some(g=>!integer(u.fp[g.id],0,g.capacity))||!integer(u.mp,0,sp.maxMp)||!integer(u.evasion,0,sp.maxMp)||
        !['acted','evaded','unstable','retreatUsed'].every(key=>typeof u[key]==='boolean')||![null,'resupply','selfRepair'].includes(u.job))throw Error('舰船状态无效。');
      if((isFixed(sp.kind)&&u.regionId!==sp.startRegion)||u.side!==sp.side||!region(config,u.regionId)||!integer(u.hp,0,sp.maxHp)||!integer(u.ap,0,sp.maxAp)||typeof u.guard!=='boolean'||typeof u.healUsed!=='boolean'||!integer(u.healsLeft,0,sp.maxHeals))throw Error('星舰状态不合法。');
    }
    if(s.control===undefined){s.control=openingControl(config,s.units);s.pendingClaims=openingClaims(s.units);}
    if(!s.control||typeof s.control!=='object'||Object.keys(s.control).length!==config.regions.length||
       !config.regions.every(r=>[null,'player','enemy'].includes(s.control[r.id]))||
       !Array.isArray(s.pendingClaims)||new Set(s.pendingClaims).size!==s.pendingClaims.length||
       s.pendingClaims.some(id=>!region(config,id)||new Set(occupants(s,id).map(u=>u.side)).size!==2))throw Error('星区控制权或待争夺星系无效。');
    if(s.winner!==outcome(config,s))throw Error('胜负状态不一致。');
    return{config,state:s};
  }
  const API={inEnemyControl,controlStrength,aimOptions,evadeGain,repairAmount,selfRepair,projectError,retreatChance,mounts,gunName,shotProfile,defenseError,flightPlan,headquarters,isFixed,clone,validateConfig,initialState,unit,region,spec,link,neighbors,adjacent,occupants,targets,sideName,movementNeighbors,stepCost,driveName,armorValue,paths,moveError,attackError,healError,transition,teamAction,aiAction,validateSave};
  if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.GameEngine=API;
})(typeof window!=='undefined'?window:globalThis);
