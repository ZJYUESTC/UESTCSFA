/* 演习只编排起始态与指令顺序；航行、掷骰、损管和控制权均由正式规则结算。 */
(function(root){
  'use strict';
  const P='player-frigate',C='player-cruiser',S='player-scout',T='player-tender';
  const B='enemy-battleship',F='enemy-frigate';
  const ship=(id,title,text)=>({event:'ship',value:id,target:'[data-select-unit="'+id+'"]',title,text});
  const star=(id,title,text)=>({event:'star',value:id,target:'#area-'+id,title,text});
  const order=(id,button,title,text,page)=>({event:'action',value:id,target:'#'+button,title,text,page});
  const move=(title,text)=>order('move','move-btn',title,text,'nav');
  const turn=(title,text)=>order('endTurn','end-btn',title,text);
  const control=(target,value,title,text,page)=>({event:'control',target,value,title,text,page});
  const routes={
    name:'穿越潮门',description:'把领航舰送至前哨，再将接敌的护卫舰撤回。',seed:3,
    regions:[
      ['s13','白沙港',185,370],['s14','潮门',435,285],['s15','北桥',715,360],
      ['s18','望辰哨',955,215],['s23','静湾',820,535]
    ],
    edges:[['s13','s14'],['s14','s15',1],['s15','s18',1],['s14','s23'],['s23','s18']],
    units:[[C,'s13'],[P,'s13'],[B,'s18'],['enemy-cruiser','s18']],
    steps:[
      ship(C,'选定领航舰','在右侧名册点巡洋舰“四川”。它的曲速引擎每回合有 6 AP。所有靶舰均保持静默。'),
      star('s14','标定第一航点','点潮门。这里由对方控制，但没有驻舰。白沙港至潮门是普通航路。'),
      move('执行曲速跃迁','确认跃迁，观察舰标和潮门的控制旗。接管空防星系只花这段普通航路的 3 AP。'),
      star('s15','切入航道','点北桥。潮门与北桥之间的青色实线是超空间航道，曲速舰也能借道。'),
      move('沿航道航行','这一段只需 2 AP。抵达北桥后，四川舰本回合还剩 1 AP。'),
      ship(P,'接手护卫舰','选择仍在白沙港的“都江堰”。超空间舰沿航道只需 1 AP，也可以离轨。'),
      star('s14','标定离轨跃迁','点潮门。同一条普通航路，超空间舰只需 2 AP，但会失稳至下一己方回合。'),
      move('脱离航道','确认离轨。本回合瞄准和规避被锁定，既有闪避清零，射击的命中门槛减 2。'),
      star('s18','规划穿越北桥','点望辰哨。路线经过北桥，两段青色航道各需 1 AP，前哨有两艘靶舰。'),
      move('驶入接触区','确认航线。到达有敌舰的星系会用尽剩余 AP，舰炮 FP 仍可用。沿途无敌舰的星系可直接接管。'),
      turn('结算前哨争夺','点结束回合。双方各掷 D6，加舰数、每 10 点船体和每 5 点剩余攻击 FP 的修正，两项分别向上取整。'),
      {event:'report',target:'#control-continue',title:'核对控制权',text:'对照双方合计与归属，再点继续。靶舰只参与控制权判定，对方行动阶段会直接结束。'},
      star('s15','从敌控前哨脱离','选择北桥。新回合移动力已恢复，敌方仍控制望辰哨，脱离只能抵达相邻星系。'),
      move('撤回北桥','确认脱离。首跳航费 1 AP，脱离会耗尽本舰全部 5 AP，抵达后不能继续跳跃。')
    ],
    summary:'四川舰已接通北桥航线，都江堰舰已从敌控前哨撤回。'
  };
  const gunnery={
    name:'双锚试炮',description:'对装甲靶舰试射，随后完成规避、损管与补给。',seed:1,
    regions:[['s14','双锚靶场',340,275],['s11','织梭脉冲星',710,220],['s04','沉井黑洞',840,490],['s13','青屿船坞',380,510]],
    edges:[['s13','s11',1],['s13','s14'],['s14','s11'],['s11','s04'],['s13','s04']],
    units:[[C,'s14'],[S,'s04'],[P,'s11'],[T,'s13'],[F,'s14'],[B,'s14']],
    steps:[
      ship(C,'接管试炮舰','点巡洋舰“四川”。靶场内有两个目标，普通舰炮只能向同星系敌舰开火。'),
      control('[data-fire-target="'+B+'"]',B,'点名装甲目标','在开火列表选择战列舰。它有 3 点装甲，适合比较两种武器。','fire'),
      control('#aim','1','投入瞄准','在“本发瞄准”选 1 MP。D6 严格小于修正后的攻击力才命中；等于门槛也会打空。','fire'),
      order('attack','attack-btn','试射动能炮','用已装填的第一门动能炮开火。它的伤害是 5，命中后先扣靶舰的 3 点装甲。','fire'),
      control('#weapon-select','mount3','切换激光炮','选择第三门炮“长虹”。该炮伤害为 3，命中时可穿透装甲。每门炮单独计算 FP。','fire'),
      order('attack','attack-btn','对同一目标复射','点击开火，比较两次射击的掷骰与实际伤害。开火消耗本炮的 FP，移动力单独计算。','fire'),
      order('guard','guard-btn','建立戒备','四川舰仍有移动力。戒备将剩余 AP 用尽，至下一己方回合前，每次受击再减 1 点伤害。','fire'),
      ship(S,'检查黑洞内的侦察舰','选择“天枢星”。沉井的引力干扰会削弱瞄准与规避，紧急跃迁成功率还会降低 25 个百分点。'),
      order('evade','evade-btn','执行机动规避','默认投入 2 MP，达到侦察舰最低投入。在黑洞中这换来 1 点闪避，使对方命中门槛减 1；每受射一次闪避减 1。','fire'),
      control('#deck-open','bridge','查阅紧急跃迁','打开舰内平面图。舰桥显示此地紧急跃迁成功率。濒毁时每舰每局判定一次，成功保留 1 HP，通常撤出 2–4 跳。'),
      control('#deck-close','back','返回星图','核对舰桥的紧急跃迁概率后，返回星图。'),
      ship(P,'接手受损护卫舰','都江堰舰在织梭脉冲星，开场仅有 4/12 船体。脉冲星中装甲失效，本发瞄准最多 +1。'),
      control('[data-order="repair"]','repair','打开损管指令','选择“损管”。低于半血且本回合尚未行动，可以独立自修复。'),
      order('selfRepair','self-repair','下令自修复','确认整回合作业。独修恢复最大船体的 15%，封顶 50%。若同系有友方支援舰，则为 20%，封顶 80%。','repair'),
      turn('等待损管完成','结束回合。到下个己方回合开始，这艘护卫舰会从 4/12 恢复到 6/12。'),
      ship(T,'调动维修舰','选择“抚仙湖”。它装有舰载维修队，能修复同系友舰或自身。'),
      star('s11','会合于织梭','点织梭脉冲星。青屿船坞到这里有一段超空间航道。'),
      move('维修舰入场','确认跃迁，与都江堰舰会合。支援舰必须与维修目标在同一个星系。'),
      control('[data-order="repair"]','repair','调出维修队','打开“损管”，查看维修队本回合的可用次数和剩余补给。'),
      control('#heal-target',P,'指派维修目标','在“维修目标”选择都江堰舰。它刚完成独立自修复，当前船体为 6/12。','repair'),
      order('heal','heal-btn','派出维修队','派出维修队。按目标最大船体的 60% 恢复，至少 8 点，最多修满；消耗 1 补给和维修队的一次出动。','repair'),
      turn('准备补给','维修队本回合已经出动。结束回合，等抚仙湖舰能够用一整个回合收集补给。'),
      order('resupply','resupply','回收补给','下令整回合补给。这段时间不能移动、规避或出动维修队。','repair'),
      turn('验收维修与补给','结束回合，查验都江堰舰船体和维修舰补给。')
    ],
    summary:'装甲试射与损管演习完成。都江堰舰船体 12/12，抚仙湖舰补给 4/4。'
  };
  const library={routes,gunnery};
  function configuration(base,key){
    const template=library[key],copy=JSON.parse(JSON.stringify(base));
    copy.name=template.name;copy.campaign={...copy.campaign,mode:'encounter',seed:template.seed};
    copy.map={width:1200,height:800,viewBox:[0,0,1200,800]};
    copy.regions=template.regions.map(([id,name,x,y])=>({...copy.regions.find(r=>r.id===id),name,center:[x,y]}));
    copy.connections=template.edges.map(([a,b])=>({a,b,via:[],extraCost:0}));
    copy.hyperlanes=template.edges.filter(e=>e[2]).map(([a,b,cost])=>({a,b,cost}));
    copy.units=template.units.map(([id,startRegion])=>({...copy.units.find(u=>u.id===id),startRegion}));
    return copy;
  }
  function prepareState(key,state){
    if(key==='routes'){state.control.s14='enemy';state.control.s15=null;}
    if(key==='gunnery'){
      state.units.find(u=>u.id===P).hp=4;
      // 试炮场的常驻靶舰在开场前就已系泊，本回合没有接敌跃迁。
      state.pendingClaims=[];
    }
  }
  const api={library,configuration,prepareState};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Academy=api;
})(typeof window!=='undefined'?window:globalThis);
