/* 战役身份与命名资料。四个阵营均为架空未来设定；不影响舰种数值。 */
(function(root){
  'use strict';
  const factions={
    china:{id:'china',name:'中国',fullName:'中国',fleet:'昆仑战役舰队',code:'CN',mark:'中',color:'#e2bf79',motto:'山河为名，星海为疆。'},
    soviet:{id:'soviet',name:'苏联',fullName:'苏维埃联盟',fleet:'红星战役舰队',code:'SU',mark:'苏',color:'#de9386',motto:'穿越长夜，驶向黎明。'},
    european:{id:'european',name:'欧联',fullName:'欧洲联邦',fleet:'协和战役舰队',code:'EF',mark:'欧',color:'#b0afe2',motto:'群星之下，合众为一。'},
    american:{id:'american',name:'美国',fullName:'美国',fleet:'地平线战役舰队',code:'US',mark:'美',color:'#8bc8d7',motto:'越过边疆，抵达群星。'}
  };
  const atlas=typeof module!=='undefined'&&module.exports?require('./atlas.js'):root.SectorAtlas;
  const fleet=typeof module!=='undefined'&&module.exports?require('./fleet.js'):root.FleetData;
  // 舷号与舰名是两个独立字段，登记次序对应同型舰在战役编成中的位置。
  const registry={
    china:{scout:['796 天枢星'],frigate:['536 都江堰','537 江油'],destroyer:['172 成都','173 武汉'],cruiser:['121 四川'],battleship:['031 镇远'],tender:['908 抚仙湖']},
    soviet:{scout:['512 Меридиан'],frigate:['724 Дозорный','752 Бдительный'],destroyer:['438 Стойкий','416 Отважный'],cruiser:['116 Адмирал Макаров'],battleship:['063 Советская Белоруссия'],tender:['681 Березина']},
    european:{scout:['P214 Kestrel'],frigate:['F237 Flanders','F241 Zeeland'],destroyer:['D615 De Ruyter','D623 Forbin'],cruiser:['C121 Strasbourg'],battleship:['B014 Europa'],tender:['A438 Rhine']},
    american:{scout:['PC-1462 Petoskey'],frigate:['FF-82 Congress','FF-87 Chesapeake'],destroyer:['DD-1048 Johnston','DD-1053 O’Bannon'],cruiser:['CA-152 Astoria'],battleship:['BB-78 Montana'],tender:['AR-31 Vulcan']}
  };
  function registerFleet(c){
    const counts={};
    for(const u of c.units){
      const f=factionFor(c,u.side), key=u.side+'-'+u.kind;
      const i=counts[key]||0;counts[key]=i+1;
      if(u.kind==='station'||u.kind==='battery'){
        const site=c.regions.find(r=>r.id===u.startRegion);
        u.callsign=u.kind==='station'?'星区司令部':site.name+'平台';
        u.pennant='';
      }else{
        const entry=registry[f.id][u.kind]?.[i];
        if(!entry)continue; // 自定义编成可保留作者提供的额外舰名。
        const split=entry.indexOf(' ');
        u.pennant=entry.slice(0,split);u.callsign=entry.slice(split+1);
      }
      u.name=f.name+'·'+(u.pennant?u.pennant+' ':'')+u.callsign;u.faction=f.id;
    }
    c.fleetEdition=1;
  }
  function reinforce(c){
    const defenders=c.units.filter(u=>u.side===c.campaign.defender&&u.engine!=='fixed');
    const frigate=defenders.find(u=>u.kind==='frigate');
    if(defenders.length!==4||!frigate||new Set(defenders.map(u=>u.kind)).size!==4)return;
    const id=frigate.side+'-frigate-2';
    if(!c.units.some(u=>u.id===id))c.units.push({...JSON.parse(JSON.stringify(frigate)),id});
  }
  const ids=Object.keys(factions);
  const kindNames={destroyer:'驱逐舰',battleship:'战列舰',frigate:'护卫舰',scout:'侦察舰',cruiser:'巡洋舰',tender:'支援舰'};
  function validate(meta){
    if(!meta||!ids.includes(meta.playerFaction)||!ids.includes(meta.enemyFaction)||meta.playerFaction===meta.enemyFaction||!ids.includes(meta.nameSet)||!Number.isInteger(meta.seed)||meta.seed<0||meta.seed>4294967295)throw Error('战役必须选择两个不同阵营、有效命名集与随机种子。');
    if(!['encounter','siege'].includes(meta.mode||'encounter'))throw Error('未知战役模式。');
    if(meta.mode==='siege'&&!['player','enemy'].includes(meta.defender))throw Error('攻防战需要指定守方。');
    return meta;
  }
  function factionFor(config,side){return factions[config.campaign[side==='player'?'playerFaction':'enemyFaction']];}
  const siegeRounds=10;
  function siegeLayout(c){
    const sorted=[...c.regions].sort((a,b)=>a.center[0]-b.center[0]||a.id.localeCompare(b.id));
    const west=sorted[0].id,east=sorted.at(-1);
    if(east.star.type!=='main'||east.planets.rocky<1)throw Error('最东端司令部需要一颗正常主序星和至少一颗类地行星。');
    const nearby=[...new Set(c.connections.concat(c.hyperlanes).filter(e=>e.a===east.id||e.b===east.id).map(e=>e.a===east.id?e.b:e.a))];
    if(nearby.length<3)throw Error('司令部需要三个不同的邻接星系部署平台。');
    const perimeter=nearby.slice(0,3);
    return {west,east:east.id,perimeter};
  }
  function deployExisting(c,defender){
    const {west,east,perimeter}=siegeLayout(c);
    let battery=0;
    for(const u of c.units){
      if(u.side!==defender)u.startRegion=west;
      else if(u.kind==='battery')u.startRegion=perimeter[battery++];
      else u.startRegion=u.kind==='scout'?perimeter[0]:east;
    }
  }
  function configureSiege(c,defender){
    const {west,east,perimeter}=siegeLayout(c);
    const ships=c.units.filter(u=>!u.id.endsWith('-2'));
    c.units=[];
    for(const side of ['player','enemy']){
      const defending=side===defender;
      const kinds=defending?['frigate','cruiser','scout','tender','frigate']:['frigate','cruiser','scout','tender','destroyer','battleship','frigate','destroyer'];
      const counts={};
      for(const kind of kinds){
        const model=ships.find(u=>u.side===side&&u.kind===kind);
        const serial=counts[kind]=(counts[kind]||0)+1;
        c.units.push({...fleet.fit(kind),...model,kind,side,id:side+'-'+kind+(serial===1?'':'-'+serial),startRegion:defending?(kind==='scout'?perimeter[0]:east):west});
      }
    }
    function emplacement(id,kind,where,hp,attack,ap,armor){
      c.units.push({...fleet.fit(kind),id,kind,side:defender,startRegion:where,engine:'fixed',maxHp:hp,attack,maxAp:ap,armor,healAmount:0,maxHeals:0});
    }
    perimeter.forEach((where,i)=>emplacement('battery-'+(i+1),'battery',where,14,4,4,1));
    emplacement('sector-hq','station',east,22,3,4,0);
  }
  function create(base,{playerFaction='china',enemyFaction='soviet',seed=42,mode=base.campaign?.mode||'encounter',defender=base.campaign?.defender||'enemy'}={}){
    const nameSet=mode==='siege'&&defender==='enemy'?enemyFaction:playerFaction;
    const meta={playerFaction,enemyFaction,nameSet,seed,mode,...(mode==='siege'?{defender}:{})};validate(meta);
    const c=JSON.parse(JSON.stringify(base));c.version=6;c.campaign=meta;
    if(!base.atlasVersion||base.campaign.nameSet!==nameSet)atlas.populate(c);
    if(mode==='siege'){
      if(base.campaign.mode==='siege'&&base.campaign.defender===defender){reinforce(c);deployExisting(c,defender);}
      else configureSiege(c,defender);
    }
    if(!base.fleetEdition)for(const ship of c.units){
      if(ship.engine==='warp'&&ship.maxAp===5)ship.maxAp=6;
    }
    registerFleet(c);
    c.name='远星航路 · '+factions[meta.nameSet].name+'命名星区';return c;
  }
  function emblem(id){
    return '<img class="faction-emblem" src="flags/'+id+'.svg" alt="" />';
  }
  function resolveOpponent(player, choice, nextUint32){
    if(!ids.includes(player))throw Error('请选择有效的己方阵营。');
    const candidates=ids.filter(id=>id!==player);
    if(choice==='random'){
      const limit=Math.floor(4294967296/candidates.length)*candidates.length;
      let draw=nextUint32();
      while(draw>=limit)draw=nextUint32();
      return candidates[draw%candidates.length];
    }
    if(!candidates.includes(choice))throw Error('请选择不同的对手阵营。');
    return choice;
  }
  const API={registerFleet,reinforce,deploySiege:deployExisting,siegeRounds,factions,atlas,ids,kindNames,validate,factionFor,create,emblem,resolveOpponent};
  if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.Campaign=API;
})(typeof window!=='undefined'?window:globalThis);
