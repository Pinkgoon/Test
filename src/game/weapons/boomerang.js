// src/game/weapons/boomerang.js
import { calcMods } from '../Addons.js';
export default {
  id:'wpn_boomerang',
  name:'부메랑',
  desc:'되돌아오는 투척체',
  icon:'assets/weapons/wpn_boomerang.png',
  maxLvl:5,
  tags:['무기','관통','발사','원거리'],
  baseInterval:1.2,
  range:600,
  create(){ return { id:this.id, type:'boomerang', lvl:1, cd:0, addons:[] }; },
  update(inst, api){
    const mods=calcMods(inst); const tri=!!mods.tri;
    inst.cd-=api.dt; if(inst.cd>0) return;
    inst.cd=Math.max(0.18,(this.baseInterval*Math.pow(0.92,inst.lvl-1)*mods.cdMul)/Math.max(0.1, api.player.attackSpeedMul));

    const t=api.findNearestEnemy(api.player.x,api.player.y); if(!t) return;
    const a0=Math.atan2(t.y-api.player.y,t.x-api.player.x);
    const sp=340+15*(inst.lvl-1);
    const dmg=Math.max(10, api.player.dmg*(1.10*(1+0.12*(inst.lvl-1)))*mods.dmgMul);

    const fans = tri ? [a0-0.20, a0, a0+0.20] : [a0];
    for(const ang of fans){
      api.state.booms.push({ x:api.player.x, y:api.player.y, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp,
        r:8, dmg, life:((this.range||600)/(340+15*(inst.lvl-1))), returning:false, lvl:inst.lvl, burn:mods.burn, freeze:mods.freeze, color:'#9be7ff' });
    }
  }
};