// src/game/weapons/laser.js
import { calcMods } from '../Addons.js';
const dist2=(ax,ay,bx,by)=>{ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; };
function farthest(enemies, x, y){ let idx=-1, best=-1; for(let i=0;i<enemies.length;i++){ const e=enemies[i]; const d2=dist2(x,y,e.x,e.y); if(d2>best){best=d2; idx=i;} } return idx; }

export default {
  id:'wpn_laser',
  name:'레이저',
  desc:'가장 먼 적을 관통하는 직선 레이저',
  icon:'assets/weapons/wpn_laser.png',
  maxLvl:5,
  tags:['무기','관통','발사','원거리'],
  baseInterval:1.0,
  create(){ return { id:this.id, type:'laser', lvl:1, cd:0, addons:[] }; },
  update(inst, api){
    const mods=calcMods(inst);
    inst.cd-=api.dt; if(inst.cd>0) return;
    inst.cd=Math.max(0.15,(this.baseInterval*Math.pow(0.95,inst.lvl-1)*mods.cdMul)/Math.max(0.1, api.player.attackSpeedMul));

    const fi=farthest(api.state.enemies, api.player.x, api.player.y); if(fi<0) return;
    const eT=api.state.enemies[fi];
    const x1=api.player.x, y1=api.player.y, x2=eT.x, y2=eT.y;
    const ux=(x2-x1), uy=(y2-y1); const len=Math.hypot(ux,uy)||1; const vx=ux/len, vy=uy/len;
    const halfW=6;
    const dmg=api.player.dmg*(1.10+0.05*(inst.lvl-1))*mods.dmgMul;

    for(let i=api.state.enemies.length-1;i>=0;i--){
      const e=api.state.enemies[i];
      const dx=e.x-x1, dy=e.y-y1; const proj=dx*vx+dy*vy;
      if(proj<0||proj>len+12) continue;
      const px=x1+vx*proj, py=y1+vy*proj;
      const d2=dist2(px,py,e.x,e.y);
      if(d2 <= (e.r+halfW)*(e.r+halfW)){
        e.hp-=dmg;
        if(e.hp<=0){ api.state.enemies.splice(i,1); api.state.score+=25; api.dropGem(e.x,e.y); }
      }
    }
    api.state.beams.push({ x1, y1, x2, y2, t:0.08, w:halfW*2, color:'#9ff0ff' });
  }
};
