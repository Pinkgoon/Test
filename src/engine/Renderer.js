export class Renderer{
constructor(canvas){
this.cvs = canvas;
this.ctx = canvas.getContext('2d');
this.DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
this.resize = this.resize.bind(this);
window.addEventListener('resize', this.resize);
this.resize();
}
resize(){
const w = this.cvs.clientWidth|0, h = this.cvs.clientHeight|0;
this.cvs.width = (w*this.DPR)|0; this.cvs.height=(h*this.DPR)|0;
this.ctx.setTransform(this.DPR,0,0,this.DPR,0,0);
}
clear(){ this.ctx.clearRect(0,0,this.cvs.clientWidth,this.cvs.clientHeight); }
drawGrid(){
const ctx=this.ctx, grid=28; ctx.save(); ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=1;
ctx.beginPath();
for(let x=0;x<this.cvs.clientWidth;x+=grid){ ctx.moveTo(x,0); ctx.lineTo(x,this.cvs.clientHeight); }
for(let y=0;y<this.cvs.clientHeight;y+=grid){ ctx.moveTo(0,y); ctx.lineTo(this.cvs.clientWidth,y); }
ctx.stroke(); ctx.restore();
}
}