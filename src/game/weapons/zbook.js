// src/game/weapons/zbook.js
import { calcMods } from '../Addons.js';
export default {
  id:'wpn_zbook',
  name:'좀비 소환서',
  desc:'좀비를 소환하여 적에게 돌진시키는 소환 무기',
  icon:'assets/weapons/wpn_zbook.png',
  maxLvl:5,
  tags:['무기','소환','원거리'],
  baseInterval:2.2,
  create(){ return { id:this.id, type:'zbook', lvl:1, cd:0, addons:[] }; },
  update(inst, api){
    const mods=calcMods(inst);
    inst.cd-=api.dt; if(inst.cd>0) return;
    inst.cd=Math.max(0.8,(this.baseInterval*Math.pow(0.94,inst.lvl-1)*mods.cdMul)/Math.max(0.1, api.player.attackSpeedMul));

    const zLife=6.0+0.4*(inst.lvl-1);
    const zSpd =150+6*(inst.lvl-1);
    const zDmg =api.player.dmg*(0.45+0.1*(inst.lvl-1))*mods.dmgMul;

    api.state.zombies.push({ x:api.player.x, y:api.player.y, r:10, life:zLife, speed:zSpd, dmg:zDmg, hitCd:0 });
  }
};
