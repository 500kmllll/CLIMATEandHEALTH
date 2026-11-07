import {clamp,isNight} from './model.js';

const W=941,H=1672;
const riding=new Set(['street','residential','bridge','tunnel','flyover','shop']);
const RIDER_URL='assets/rider-mask.webp',RIDE_SPEED=87,WALK_SPEED=35;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const smooth=t=>t*t*(3-2*t);
const mix=(a,b,t)=>a+(b-a)*t;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const luminance=(r,g,b)=>r*.2126+g*.7152+b*.0722;
function surface(w=W,h=H){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}

// Asset 02 is intentionally skipped; the first increase uses the original 03.
export function visualHeatLevel(heat){return heat<=0?0:Math.min(5,1+Math.ceil(heat/2));}

function walkingLayers(image){
  const bg=surface(),g=bg.getContext('2d',{willReadFrequently:true});
  g.drawImage(image,0,0,W,H);
  const pixels=g.getImageData(0,0,W,H),src=new Uint8ClampedArray(pixels.data);
  const x0=437,y0=1245,x1=530,y1=1410,w=x1-x0,h=y1-y0;
  const sprite=surface(w,h),s=sprite.getContext('2d'),out=s.createImageData(w,h);
  const fill=new Uint8Array(W*H);
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    const p=(y*W+x)*4,r=src[p],gg=src[p+1],b=src[p+2],l=luminance(r,gg,b);
    const alpha=(r>149&&gg>145&&r>b)?clamp((l-137)/58,0,1):0;
    if(alpha<=.03)continue;
    for(let dy=-2;dy<=2;dy++)for(let dx=-3;dx<=3;dx++)fill[(y+dy)*W+x+dx]=1;
    if(y>=1353||(y>=1314&&(x<473||x>494)))continue;
    const i=((y-y0)*w+x-x0)*4;
    out.data[i]=r;out.data[i+1]=gg;out.data[i+2]=b;out.data[i+3]=Math.round(alpha*255);
  }
  s.putImageData(out,0,0);
  for(let y=y0-2;y<y1+2;y++){
    let x=x0-3;
    while(x<x1+3){
      if(!fill[y*W+x]){x++;continue;}
      const start=x;while(fill[y*W+x])x++;
      const end=x,left=(y*W+start-1)*4,right=(y*W+end)*4;
      for(let j=start;j<end;j++){
        const k=(y*W+j)*4,t=smooth((j-start+1)/(end-start+1));
        for(let c=0;c<3;c++)pixels.data[k+c]=mix(src[left+c],src[right+c],t);
      }
    }
  }
  g.putImageData(pixels,0,0);
  return {bg,sprite,x0,y0};
}
function track(ctx,image,height){
  // Reflect the complete plate at each edge. Both joins share identical pixels,
  // so the street stays aligned even as the repeat passes behind the rider.
  const loop=surface(W*2,height),g=loop.getContext('2d');
  g.drawImage(image,0,0,W,height);
  g.translate(W*2,0);g.scale(-1,1);g.drawImage(image,0,0,W,height);
  return ctx.createPattern(loop,'repeat-x');
}
function drawTrack(ctx,pattern,distance,y=0,height=H){
  pattern.setTransform(new DOMMatrix().translate(-(distance%(W*2)),y));
  ctx.fillStyle=pattern;ctx.fillRect(0,y,W,height);
}

let flyoverPillarLoop;
function drawFlyoverPillars(ctx,pattern,distance){
  if(!flyoverPillarLoop){
    const pillars=new Path2D();
    // Coordinates on the original 941 px plate, identical at every heat level.
    for(const [capL,shaftL,shaftR,capR] of [[91,100,126,134],[740,747,773,782]]){
      pillars.moveTo(capL,1047);pillars.lineTo(capR,1047);
      pillars.lineTo(capR,1062);pillars.lineTo(shaftR,1062);
      pillars.lineTo(shaftR,1491);pillars.lineTo(capR,1491);
      pillars.lineTo(capR,1506);pillars.lineTo(capL,1506);
      pillars.lineTo(capL,1491);pillars.lineTo(shaftL,1491);
      pillars.lineTo(shaftL,1062);pillars.lineTo(capL,1062);pillars.closePath();
    }
    flyoverPillarLoop=new Path2D(pillars);
    flyoverPillarLoop.addPath(pillars,new DOMMatrix().translate(W*2,0).scale(-1,1));
    flyoverPillarLoop.addPath(pillars,new DOMMatrix().translate(W*2,0));
  }
  // Match the reflected street loop exactly: distant columns stay behind the
  // rider, and the two near columns occlude both the rider and the rail.
  const shift=distance%(W*2);
  ctx.save();ctx.translate(-shift,0);ctx.clip(flyoverPillarLoop);ctx.translate(shift,0);
  drawTrack(ctx,pattern,distance);ctx.restore();
}

function limb(ctx,hip,knee,ankle,colour,thigh=12,shin=8){
  ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=colour;
  ctx.lineWidth=thigh;ctx.beginPath();ctx.moveTo(...hip);ctx.lineTo(...knee);ctx.stroke();
  ctx.lineWidth=shin;ctx.beginPath();ctx.moveTo(...knee);ctx.lineTo(...ankle);ctx.stroke();
}
function walker(ctx,layer,distance){
  const stride=44,cycle=distance/stride+.14,bob=-.48*Math.sin(cycle*Math.PI*4)**2;
  const hipY=1349+bob,light='#f3e7cd',shadow='#d4c5a8';
  function leg(offset,colour,x){
    const p=(cycle+offset)%1,contact=.65,swing=clamp((p-contact)/(1-contact),0,1);
    const reach=stride*contact/2;
    const ankleX=x+(p<contact?reach-p*stride:mix(-reach,reach,smooth(swing)));
    const ankleY=1397-(p>contact?3.6*Math.sin(Math.PI*swing)**2:0);
    const dx=ankleX-x,dy=ankleY-hipY,d=Math.hypot(dx,dy);
    const bend=Math.sqrt(Math.max(0,24.8*24.8-(d/2)**2));
    const knee=[x+dx/2+dy/d*bend,hipY+dy/2-dx/d*bend];
    limb(ctx,[x,hipY],knee,[ankleX,ankleY],colour,13,8);
    ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(ankleX-1,ankleY+1);ctx.quadraticCurveTo(ankleX+5,ankleY+1,ankleX+10,ankleY+(p>contact?-1:1));ctx.stroke();
  }
  function arm(offset,colour,sx){
    const theta=.25*Math.sin((cycle+offset)*Math.PI*2)-.05,y=1306+bob;
    const elbow=[sx+20*Math.sin(theta),y+20*Math.cos(theta)];
    const hand=[elbow[0]+17*Math.sin(theta+.29),elbow[1]+17*Math.cos(theta+.29)];
    limb(ctx,[sx,y],elbow,hand,colour,7.2,5.3);
  }
  leg(.5,shadow,482);arm(0,shadow,478);
  leg(0,light,486);
  ctx.drawImage(layer.sprite,layer.x0,layer.y0+bob);
  arm(.5,light,485);
}

function air(ctx,t){
  // Mist starts at the physical louvre; air paths fan down toward the bed.
  for(let i=0;i<6;i++){
    const p=(t*.42+i/6)%1,x=222+i*23+p*(20+i*4),y=1107+p*104;
    const radius=7+p*20,alpha=.21*Math.sin(p*Math.PI);
    const mist=ctx.createRadialGradient(x,y,0,x,y,radius);
    mist.addColorStop(0,'rgba(245,250,255,'+alpha+')');mist.addColorStop(1,'rgba(245,250,255,0)');
    ctx.fillStyle=mist;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
  }
  ctx.lineCap='round';
  for(let i=0;i<4;i++){
    const phase=(t*.58+i*.17)%1,x=223+i*39,alpha=.54*Math.sin(Math.PI*phase);
    const yy=1107+phase*100,xx=x+phase*(16+i*6);
    ctx.strokeStyle='rgba(235,247,255,'+alpha+')';ctx.lineWidth=1.6;
    ctx.beginPath();ctx.moveTo(xx,yy);ctx.quadraticCurveTo(xx+3,yy+14,xx+10+i*2,yy+25);ctx.stroke();
  }
}

export class SceneEngine{
  constructor(canvas,manifest){
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.manifest=manifest;
    this.images=new Map();this.layers=new Map();this.current=null;this.change=null;this.seq=0;this.active=true;this.raf=0;this.heat=0;
    this.frame=this.frame.bind(this);
    new ResizeObserver(()=>this.resize()).observe(canvas);
    this.resize();this.request();
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)this.request();});
  }
  resize(){
    const {width,height}=this.canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);
    if(!width||!height)return;
    this.canvas.width=Math.round(width*d);this.canvas.height=Math.round(height*d);
  }
  request(){if(!this.raf&&this.active&&!document.hidden)this.raf=requestAnimationFrame(this.frame);}
  setActive(active){
    this.active=active;
    if(!active&&this.raf){cancelAnimationFrame(this.raf);this.raf=0;}
    if(active){this.resize();this.request();}
  }
  source(key,heat,motion='ride'){
    const urls=this.manifest[key],url=urls[urls.length===1?0:visualHeatLevel(heat)];
    return motion==='ride'&&riding.has(key)?url.replace(/-(\d+)\.webp$/,'-road-$1.webp'):url;
  }
  image(url){
    if(!this.images.has(url)){
      const promise=new Promise((resolve,reject)=>{const im=new Image();im.decoding='async';im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Could not load '+url));im.src=url;});
      this.images.set(url,promise);
      promise.catch(()=>{if(this.images.get(url)===promise)this.images.delete(url);});
      if(this.images.size>10)this.images.delete(this.images.keys().next().value);
    }
    return this.images.get(url);
  }
  prime(key,heat){this.image(this.source(key,heat)).catch(()=>{});}
  async show(key,heat,motion,instant=false){
    const ride=motion==='ride'&&riding.has(key),walk=key==='walk'&&!reduced;
    const seq=++this.seq,url=this.source(key,heat,motion),old=this.current;
    if(old?.key===key&&old.url===url&&!instant){this.heat=heat;old.motion=motion;return;}
    const [img,rider,rails]=await Promise.all([
      this.image(url),ride?this.image(RIDER_URL):null,
      ride&&key==='flyover'?this.image(url.replace('-road-','-rail-')):null
    ]);
    if(seq!==this.seq)return;
    let layers=null;
    if(ride||walk){
      if(!this.layers.has(url)){
        const layer=walk?walkingLayers(img):{};
        layer.track=track(this.ctx,layer.bg??img,H);
        if(rails)layer.railTrack=track(this.ctx,rails,rails.naturalHeight);
        this.layers.set(url,layer);
        if(this.layers.size>3)this.layers.delete(this.layers.keys().next().value);
      }
      layers=this.layers.get(url);
    }
    const now=performance.now(),scene={key,img,rider,rails,url,heat,motion,layers,start:old?.key===key&&!instant?old.start:now};
    this.current=scene;this.heat=heat;
    if(!old||instant){this.change=null;this.canvas.dataset.scene=key;this.request();return;}
    const dusk=isNight(key)!==isNight(old.key);
    const duration=reduced?40:dusk?960:key===old.key?580:660;
    this.change={old,scene,start:now,duration,dusk};this.request();
    await pause(duration+24);
  }
  render(scene,now,alpha=1){
    const ctx=this.ctx,c=this.canvas,key=scene.key;
    const t=Math.max(0,(now-scene.start)/1000);
    const ride=scene.motion==='ride'&&scene.rider&&scene.layers;
    const walk=key==='walk'&&scene.layers;
    const scale=Math.max(c.width/W,c.height/H);
    const travel=reduced?0:t*(walk?WALK_SPEED:RIDE_SPEED);
    ctx.save();ctx.globalAlpha=alpha;
    // Keep the far-left television inside narrow phone crops.
    ctx.translate(key==='home'?0:(c.width-W*scale)/2,(c.height-H*scale)/2);ctx.scale(scale,scale);
    if(ride){
      drawTrack(ctx,scene.layers.track,travel);
      const ground=key==='flyover'?1459:1456;
      ctx.fillStyle='rgba(50,30,14,.19)';ctx.beginPath();ctx.ellipse(469,ground+1,123,4,0,0,Math.PI*2);ctx.fill();
      ctx.drawImage(scene.rider,336,ground-192);
      if(scene.layers.railTrack)drawTrack(ctx,scene.layers.railTrack,travel,1389,scene.rails.naturalHeight);
      if(key==='flyover')drawFlyoverPillars(ctx,scene.layers.track,travel);
    }else if(walk){
      drawTrack(ctx,scene.layers.track,travel);walker(ctx,scene.layers,travel);
    }else{
      ctx.drawImage(scene.img,0,0,W,H);
      if(!reduced&&key==='drink'){
        // The original rider, helmet visor and bottle stay together in the source image.
        const sheen=(.5+.5*Math.sin(t*4))*Math.max(0,Math.sin(t*2));
        ctx.strokeStyle='rgba(225,255,255,'+sheen*.7+')';ctx.lineWidth=1;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(477,1280);ctx.lineTo(490,1280);ctx.stroke();
      }
      if(!reduced&&key==='home'){
        ctx.fillStyle='rgba(159,208,255,'+(.026+.018*Math.sin(t*3.1))+')';
        ctx.beginPath();ctx.moveTo(97,1329);ctx.lineTo(481,1240);ctx.lineTo(758,1233);ctx.lineTo(758,1429);ctx.lineTo(98,1414);ctx.closePath();ctx.fill();
      }
      if(!reduced&&(key==='bed'||key==='bedHot')){
        ctx.save();ctx.beginPath();ctx.rect(367,1333,295,55);ctx.clip();
        ctx.drawImage(scene.img,0,.95*Math.sin(t*1.25),W,H);ctx.restore();
      }
      if(!reduced&&scene.motion==='cool')air(ctx,t);
    }
    ctx.restore();
  }
  frame(now){
    this.raf=0;if(!this.active||document.hidden)return;
    if(this.current){
      const {ctx,canvas:c}=this;ctx.setTransform(1,0,0,1,0,0);
      ctx.fillStyle='#090b12';ctx.fillRect(0,0,c.width,c.height);
      if(!this.change){this.render(this.current,now);}
      else{
        const {old,scene,start,duration,dusk}=this.change,p=clamp((now-start)/duration,0,1);
        if(dusk){
          this.render(p<.5?old:scene,now);
          ctx.fillStyle='rgba(3,6,12,'+smooth(1-Math.abs(2*p-1))+')';ctx.fillRect(0,0,c.width,c.height);
        }else{
          this.render(old,now);this.render(scene,now,smooth(p));
        }
        if(p===1){this.change=null;c.dataset.scene=scene.key;}
      }
    }
    this.request();
  }
}
