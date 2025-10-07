// src/game/weapons/grenade.js
import { calcMods } from '../Addons.js';
export default {
  id:'wpn_grenade',
  name:'수류탄',
  desc:'던져서 터뜨린다 (범위 피해)',
  icon:'assets/weapons/wpn_grenade.png',
  maxLvl:5,
  tags:['무기','비관통','발사','원거리'],
  baseInterval:1.25,
  range:850,
  create(){ return { id:this.id, type:'grenade', lvl:1, cd:0, addons:[] }; },
  update(inst, api){
    const mods=calcMods(inst);
    inst.cd-=api.dt; if(inst.cd>0) return;
    inst.cd=Math.max(0.28,(this.baseInterval*Math.pow(0.95,inst.lvl-1)*mods.cdMul)/Math.max(0.1, api.player.attackSpeedMul));

    const t=api.findNearestEnemy(api.player.x,api.player.y); if(!t) return;
    const a=Math.atan2(t.y-api.player.y,t.x-api.player.x);
    const sp=300; const travel=(((this.range||850)/(300)));
    const rad=70+8*(inst.lvl-1);
    const dmg=api.player.dmg*(1.20+0.12*(inst.lvl-1))*mods.dmgMul;

    api.state.grenades.push({ x:api.player.x, y:api.player.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, t:travel, r:6,
      explodeRadius:rad, explodeDmg:dmg });
  }
};