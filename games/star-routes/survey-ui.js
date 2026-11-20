/* 星图标记与行星档案采用相同的天体数据。 */
window.SurveyUI=(()=>{
  const colors={O:'#94b3ff',B:'#b2c8ff',A:'#dbe8ff',F:'#fff7df',G:'#f5d17f',K:'#efaa72',M:'#df7d69'};
  const planetColors={rocky:'#c69b79',gas:'#d8bf85',iceGiant:'#75beca',iceWorld:'#bdd8e6'};
  function appendStar(g,s,svg){
    const component=(x,y,r,color)=>{
      const id='light-'+color.slice(1);
      if(!document.getElementById(id)){
        const grad=svg('radialGradient',{id});
        for(const [offset,opacity] of [[0,.95],[.13,.85],[.28,.38],[.57,.1],[1,0]])
          grad.append(svg('stop',{offset,'stop-color':color,'stop-opacity':opacity}));
        document.getElementById('starfield').prepend(grad);
      }
      g.append(svg('circle',{cx:x,cy:y,r:r*4.1,fill:'url(#'+id+')'}),svg('circle',{cx:x,cy:y,r:r*.84,fill:color}),svg('circle',{cx:x,cy:y,r:r*.50,fill:'#fffbea'}));
    };
    const col=colors[s.components[0]?.[0]]||'#d6ebff';
    if(s.type==='binary'){
      g.append(svg('ellipse',{rx:17,ry:7,fill:'none',stroke:col,opacity:.45,transform:'rotate(-24)'}));
      component(-7,3,5,col);component(8,-3,3.8,colors[s.components[1][0]]);
    }else if(s.type==='whiteDwarf'){
      g.append(svg('circle',{r:9,fill:'none',stroke:'#beddf4','stroke-width':1,'stroke-dasharray':'2 4'}));component(0,0,3,'#e5faff');
    }else{
      const radius=s.type==='giant'?8.3:({O:7.2,B:6.7,A:6.1,F:5.6,G:5.1,K:4.6,M:4}[s.components[0]?.[0]]||5);
      component(0,0,radius,col);
      g.append(svg('path',{d:'M-12,0H12M0,-12V12',stroke:col,'stroke-width':.8,opacity:.55}));
    }
  }
  function register(r){
    const result=document.createElement('section');result.className='planet-register';
    const title=document.createElement('h4');title.textContent='行星普查';result.append(title);
    const number=window.SectorAtlas.count(r.planets);
    const summary=document.createElement('p');summary.className='survey-summary';
    summary.textContent=number+' 颗行星　·　'+(r.colonized?'已殖民':'未殖民');result.append(summary);
    const strip=document.createElement('div');strip.className='planet-strip';strip.setAttribute('aria-hidden','true');
    for(const [kind,n] of Object.entries(r.planets))for(let i=0;i<n;i++){
      const p=document.createElement('i');p.className=kind;p.style.setProperty('--planet',planetColors[kind]);strip.append(p);
    }
    result.append(strip);
    const text=document.createElement('p');text.className='survey-counts';
    text.textContent=Object.entries(window.SectorAtlas.categories).map(([k,label])=>label+' '+r.planets[k]).join('　');result.append(text);
    return result;
  }
  return {appendStar,register};
})();
