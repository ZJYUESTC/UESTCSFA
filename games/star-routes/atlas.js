/* 每一行是一处固定天体，同一份本土星图在遭遇战和攻防战中可以复认。 */
(function(root){
  'use strict';
  const languages=['china','american','european','soviet'];
  const entries=[
    ['辰浦','Dawson’s Landing','Alderhaven','Дальний'],
    ['天琴座α','Alpha Lyrae','Alpha Lyrae','α Лиры'],
    ['宇川','Red Bluff','The Low March','Северный'],
    null,
    ['云津','North Fork','Three Rivers','Маяк'],
    ['天鹰座α','Alpha Aquilae','Alpha Aquilae','α Орла'],
    ['宁宇','Ellis Crossing','Kepler’s Rest','Рассвет'],
    ['临汉','Beacon Hill','Raven Sound','Береговой'],
    ['角宿一','Spica','Alpha Virginis','Спика'],
    ['望辰埠','Cottonwood','Rivermouth','Искра'],
    null,
    ['毕宿五','Aldebaran','Alpha Tauri','Альдебаран'],
    ['天汀','Port Ellis','Linden Vale','Звёздный'],
    ['辰溪','Linden Creek','Eastmark','Светлогорье'],
    ['望津','Harker’s Ferry','Iron Sound','Ладожский'],
    null,
    ['云垣','Mason Ridge','Westhaven','Мирный'],
    ['宇宁','Longview','Saint Anselm','Восход'],
    ['星渡','West Branch','Westgate','Западный'],
    ['霄城','Flint Ridge','Silver Strand','Сосновый Бор'],
    ['宵川','Mercer’s Mill','Port Albion','Новая Ладога'],
    null,
    ['天衡','Clearwater','Bellhaven','Полуденный'],
    ['河汉口','Grand Junction','Estuary Reach','Устье'],
    ['辰湾','Aspen Flats','Northmark','Рубеж'],
    ['双津','Twin Harbors','The Twin Ports','Две Гавани'],
    ['凌川','Dry Creek','Amber Coast','Прибрежный'],
    ['宁汉','East Haven','Greyhaven','Ясный'],
    null,
    ['映河','Copper Mesa','Port Arden','Медногорск'],
    null,
    ['河浦','Blackwater','Three Bridges','Высокий Берег'],
    ['云渚','Hale’s Crossing','Stonehaven','Речной'],
    ['星阜','Eagle Pass','Eastmere','Каменск'],
    null,
    ['天梁','Cold Spring','South March','Южный'],
    null,
    ['承霄','Northfield','Port Selene','Тихий'],
    null,
    ['天垣','Ash Hollow','White Cliffs','Белые Скалы'],
    ['两仪津','Twin Falls','The Two Sisters','Две Сестры'],
    ['青穹','Rimrock','Ravensbridge','Высокий'],
    ['承宇','Sutter’s Bend','Port Ceres','Североморье'],
    ['星堤','Cedar Point','Tidewater','Дозорный'],
    ['天浦','Port Mercer','Port Meridian','Заречье'],
    ['栖云','Larkspur','New Carinthia','Луговой'],
    null,
    ['鸣津','Three Forks','Ironbridge','Новый Берег'],
    ['宸关','Stone Bluff','Far March','Дальнее'],
    null,
    ['云汀','Red Basin','Longstrand','Красная Падь'],
    ['天澜','Wellspring','Low Harbor','Родник'],
    null,
    ['航川','Pine Landing','Starhaven','Восточный']
  ];
  const noPlanets=new Set([4,11,16,31,35,39,47,53]);
  const oneGiant=new Set([2,6,9,12,22,29,37,50]);
  const binary=new Set([9,26,41]);
  const dwarfs=new Set([29,47]);
  const letters=['K3 V','M2 V','G4 V','F5 V','K7 V','M1 V','G8 V','M4 V','K2 V','F8 V','B8 V','A8 V'];
  const surveyPrefix={china:'天测',american:'FSS',european:'EAS',soviet:'ЗК'};
  const categories={rocky:'类地行星',gas:'类木行星',iceGiant:'冰巨行星',iceWorld:'冰质行星'};
  const typeLabels={main:'主序星',binary:'双星',whiteDwarf:'白矮星',giant:'红巨星',pulsar:'脉冲星',blackhole:'黑洞'};
  const code={blackhole:'BH',pulsar:'PSR',whiteDwarf:'WD',binary:'DS',giant:'RG',main:'MS'};
  function starFor(r,n,home){
    if(r.kind==='blackhole'||r.kind==='pulsar')return {type:r.kind,components:[]};
    if(dwarfs.has(n))return {type:'whiteDwarf',components:[n===29?'DA':'DB']};
    if(binary.has(n))return {type:'binary',components:n===9?['B1.5 IV–V','B3 V']:n===26?['K2 V','M3 V']:['F6 V','K7 V']};
    if(n===12)return {type:'giant',components:['K5 III']};
    const spectrum=({2:'A0 V',6:'A7 V',37:'O9 V',45:'G2 V'})[n]||letters[(n*7+languages.indexOf(home)*3)%letters.length];
    return {type:'main',components:[spectrum]};
  }
  function planetsFor(n,home){
    if(noPlanets.has(n))return {rocky:0,gas:0,iceGiant:0,iceWorld:0};
    if(oneGiant.has(n))return {rocky:0,gas:1,iceGiant:0,iceWorld:0};
    const index=n+(n===45?0:languages.indexOf(home)*5);
    return {rocky:1+(index*5)%4,gas:(index*7)%3,iceGiant:(index*3)%2,iceWorld:(index*5+1)%3};
  }
  function count(p){return Object.keys(categories).reduce((sum,k)=>sum+p[k],0);}
  function numberOf(r,i){const m=/^s(\d{2})$/.exec(r.id);return m?Number(m[1]):i+1;}
  function nameFor(r,n,i,home){
    const natural=entries[n-1]?.[languages.indexOf(home)];
    const prefix=surveyPrefix[home];
    if(r.kind==='star'&&natural)return natural;
    return prefix+' '+code[r.star.type]+'-'+String(i+1).padStart(3,'0');
  }
  function reclassify(r,i,home){
    r.star=starFor(r,numberOf(r,i),home);
    r.name=nameFor(r,numberOf(r,i),i,home);
  }
  function populate(c){
    c.regions.forEach((r,i)=>{
      const n=numberOf(r,i);
      r.star=starFor(r,n,c.campaign.nameSet);
      r.planets=planetsFor(n,c.campaign.nameSet);
      r.colonized=r.planets.rocky>0;
      r.name=nameFor(r,n,i,c.campaign.nameSet);
    });
    c.atlasVersion=1;
  }
  function label(star){return typeLabels[star.type]+(star.components.length?' · '+star.components.join(' + '):'');}
  function check(r){
    const s=r.star,p=r.planets,integer=x=>Number.isInteger(x)&&x>=0&&x<=50;
    if(!s||!Object.hasOwn(typeLabels,s.type)||!Array.isArray(s.components)||
       s.components.length!==({binary:2,pulsar:0,blackhole:0}[s.type]??1)||
       !s.components.every(x=>typeof x==='string'&&/^[OBAFGKMD][A-Z0-9 .IV–-]{0,14}$/.test(x))||
       (s.type==='main'&&!/^[OBAFGKM][0-9](?:\.[0-9])? V$/.test(s.components[0]))||
       (s.type==='whiteDwarf'&&!/^D[A-Z]+$/.test(s.components[0]))||
       (r.kind==='star'?['blackhole','pulsar'].includes(s.type):s.type!==r.kind)||
       !p||!Object.keys(categories).every(k=>integer(p[k]))||typeof r.colonized!=='boolean'||
       (r.colonized&&(count(p)===0||(count(p)===1&&p.gas===1))))throw Error('星系 '+r.id+' 的天体与行星档案不相符。');
  }
  const api={reclassify,populate,categories,check,count,label};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SectorAtlas=api;
})(typeof window!=='undefined'?window:globalThis);
