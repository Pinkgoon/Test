export class Input{
constructor(joy){
this.keys={}; this.touch=false; this.x=0; this.y=0; this.joy=joy; this.knob=joy.querySelector('i'); this.joyStart=null;
window.addEventListener('keydown', e=>{ if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Space','w','a','s','d','W','A','S','D'].includes(e.key)) e.preventDefault(); this.keys[e.key]=true; }, {passive:false});
window.addEventListener('keyup', e=>{ this.keys[e.key]=false; });
const pos = e=>{ const r=this.joy.getBoundingClientRect(); const t=e.touches[0]; return {x:t.clientX-r.left, y:t.clientY-r.top} };
const setJoy=(dx,dy)=>{ const len=Math.hypot(dx,dy); const max=48; const nx=len?dx/len:0, ny=len?dy/len:0; const kx=nx*Math.min(max,len), ky=ny*Math.min(max,len); this.knob.style.transform=`translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`; this.x=nx; this.y=ny; this.touch=len>6; };
joy.addEventListener('touchstart', e=>{ e.preventDefault(); this.joyStart=pos(e); setJoy(0,0) }, {passive:false});
joy.addEventListener('touchmove', e=>{ e.preventDefault(); if(!this.joyStart) return; const p=pos(e); setJoy(p.x-this.joyStart.x, p.y-this.joyStart.y); }, {passive:false});
joy.addEventListener('touchend', e=>{ e.preventDefault(); this.joyStart=null; setJoy(0,0); this.touch=false; }, {passive:false});
}
getMove(){
let x=0,y=0; if(this.touch){ x+=this.x; y+=this.y; }
if(this.keys['ArrowLeft']||this.keys['a']||this.keys['A']) x-=1;
if(this.keys['ArrowRight']||this.keys['d']||this.keys['D']) x+=1;
if(this.keys['ArrowUp']||this.keys['w']||this.keys['W']) y-=1;
if(this.keys['ArrowDown']||this.keys['s']||this.keys['S']) y+=1;
const l=Math.hypot(x,y)||1; return {x:x/l, y:y/l};
}
}