// src/game/weapons/chain.js
import { calcMods } from '../Addons.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist2=(ax,ay,bx,by)=>{ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; };

export default {
  id:'wpn_chain',
  name:'번개사슬',
  desc:'가장 가까운 적부터 사거리 내 연쇄 타격',
  icon:'assets/weapons/wpn_chain.png',
  maxLvl:5,
  tags:['무기','비관통','원거리'],
  baseInterval:1.05,
  create(){ return { id:this.id, type:'chain', lvl:1, cd:0, addons:[] }; },
  update(inst, api){
    const mods=calcMods(inst);
    inst.cd-=api.dt; if(inst.cd>0) return;
    inst.cd=Math.max(0.16,(this.baseInterval*Math.pow(0.96,inst.lvl-1)*mods.cdMul)/Math.max(0.1, api.player.attackSpeedMul));

    const startIdx=api.findNearestIdx(api.player.x,api.player.y);
    if(startIdx<0) return;

    const chainByLvl=[3,4,4,5,5];
    const hops=chainByLvl[clamp(inst.lvl-1,0,4)];
    const range=220+30*(inst.lvl-1);
    const dmg=api.player.dmg*(0.85+0.08*(inst.lvl-1))*mods.dmgMul;

    const used=new Set(); let curIdx=startIdx;
    const segs=[]; let fromX=api.player.x, fromY=api.player.y;
    for(let h=0; h<hops; h++){
      if(curIdx<0) break;
      const e=api.state.enemies[curIdx];
      used.add(curIdx);

      e.hp-=dmg;
      if(e.hp<=0){ api.state.enemies.splice(curIdx,1); api.state.score+=25; api.dropGem(e.x,e.y); }

      segs.push({ x1:fromX, y1:fromY, x2:e.x, y2:e.y });
      fromX=e.x; fromY=e.y;

      let best=-1,bestD=1e15;
      for(let i=0;i<api.state.enemies.length;i++){
        if(used.has(i)) continue;
        const d2=dist2(fromX,fromY, api.state.enemies[i].x, api.state.enemies[i].y);
        if(d2<bestD && d2<=range*range){ bestD=d2; best=i; }
      }
      curIdx=best;
    }

    if(segs.length){ api.state.arcs.push({ segs, t:0.10, color:'#a6d2ff' }); }
  }
};
