/* 在地图自身的 SVG 坐标中插值，拖动或缩放镜头时仍贴合航线。 */
window.Transit=(()=>{
  const NS='http://www.w3.org/2000/svg';
  function element(tag,attrs){
    const el=document.createElementNS(NS,tag);
    for(const [key,v] of Object.entries(attrs))el.setAttribute(key,v);
    return el;
  }
  function launch(layer,points,hull,color,drive){
    const track=element('path',{d:points.map(([x,y],i)=>(i?'L':'M')+x+' '+y).join(' '),class:'flight-track'});
    const marker=element('g',{class:'flight-ship'});
    marker.append(element('path',{d:'M-6,13 Q0,50 6,13 Z',fill:drive==='hyper'?'#93e8e1':'#f3cd84',opacity:'.88'}),
      element('path',{d:hull,fill:color,stroke:'#fff2c7','stroke-width':'1.4'}));
    layer.replaceChildren(track,marker);
    const length=track.getTotalLength(),duration=Math.min(1900,Math.max(460,310*(points.length-1)+length*.38));
    let frame,start,finished=false,resolve;
    const done=new Promise(ok=>{resolve=ok;});
    function paint(distance){
      const p=track.getPointAtLength(distance),next=track.getPointAtLength(Math.min(length,distance+1));
      const heading=Math.atan2(next.y-p.y,next.x-p.x)*180/Math.PI+90;
      marker.setAttribute('transform','translate('+p.x+' '+p.y+') rotate('+heading+') scale(.70)');
    }
    function stop(){
      if(finished)return;finished=true;cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange',onVisibility);
      layer.replaceChildren();resolve();
    }
    function onVisibility(){if(document.hidden)stop();}
    function tick(now){
      start??=now;const t=Math.min(1,(now-start)/duration);
      if(t>=1){stop();return;}
      paint(length*(t*t*(3-2*t)));frame=requestAnimationFrame(tick);
    }
    paint(0);
    if(!length||document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches)stop();
    else{document.addEventListener('visibilitychange',onVisibility);frame=requestAnimationFrame(tick);}
    return {done,stop};
  }
  return {launch};
})();
