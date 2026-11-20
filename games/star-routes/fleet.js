/* 艇型、舰炮挂载和各阵营的装备目录。每门炮有独立的射击次数。 */
(function(root){
  'use strict';
  const weapons={
    lightLaser:['laser','轻型激光炮',4,2,1],mediumLaser:['laser','中型激光炮',5,3,1],
    rapid:['kinetic','速射动能炮',4,4,2],mediumKinetic:['kinetic','中型动能炮',5,5,1],
    heavy:['kinetic','重型动能炮',6,7,1],crew:['repair','舰载维修队',0,0,1],
    batteryGun:['kinetic','平台动能炮',5,5,5],stationGun:['laser','站防激光炮',5,3,2]
  };
  const hulls={
    scout:['侦察舰',8,0,4,7,'warp',75,'agile',['lightLaser']],
    tender:['支援舰',16,2,2,5,'hyper',50,'aux',['crew']],
    frigate:['护卫舰',12,1,2,5,'hyper',50,'standard',['rapid']],
    destroyer:['驱逐舰',13,0,3,6,'hyper',60,'boost',['mediumLaser','mediumLaser']],
    cruiser:['巡洋舰',18,2,2,6,'warp',40,'standard',['mediumKinetic','mediumKinetic','mediumLaser']],
    battleship:['战列舰',28,3,1,4,'warp',25,'heavyDrive',['heavy','heavy','mediumLaser']],
    battery:['防御平台',14,1,0,4,'fixed',0,null,['batteryGun']],
    station:['司令部空间站',22,0,0,4,'fixed',0,null,['stationGun']]
  };
  const keys=['lightLaser','mediumLaser','rapid','mediumKinetic','heavy','crew','batteryGun','stationGun','agile','aux','standard','boost','heavyDrive','warp','hyper'];
  const lexicon={
    china:'流萤 长虹 飞廉 横江 撼岳 补天 镇关 明台 云雀 灵枢 行舟 逐日 负山 折桂 鹊桥',
    soviet:'火花 极光 雨燕 乌拉尔 雷鸣 黎明工班 堡垒 红炬 海燕 工蜂 伏尔加 疾风 破冰船 地平线 曙光门',
    european:'烛芯 赫利俄斯 雨燕矛 罗兰 杜兰达尔 阿斯克勒庇俄斯工班 守望者 灯塔 蜻蜓 渡船 莱茵 西风神 阿特拉斯 阿里阿德涅 彩虹桥',
    american:'火狐 日冕 响尾蛇 铁砧 雷神 水星勤务队 哨兵 北极光 隼翼 骡马 驿骑 彗尾 巨杉 开拓者 金门'
  };
  const names=Object.fromEntries(Object.entries(lexicon).map(([f,v])=>[f,Object.fromEntries(v.split(' ').map((name,i)=>[keys[i],name]))]));
  function fit(kind){
    const [label,maxHp,armor,maxMp,maxAp,engine,retreat,thruster,models]=hulls[kind];
    const guns=models.map((model,i)=>{
      const [type,label,attack,damage,capacity]=weapons[model];
      return {id:'mount'+(i+1),model,type,label,attack,damage,capacity};
    });
    return {kind,maxHp,armor,maxMp,maxAp,engine,retreat,thruster,guns,maxHeals:kind==='tender'?4:0,healAmount:0,attack:Math.max(2,...guns.map(g=>g.attack))};
  }
  function equipment(sp,key){return names[sp.faction]?.[key]||key;}
  const api={fit,hulls,weapons,equipment,names};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FleetData=api;
})(typeof window!=='undefined'?window:globalThis);
