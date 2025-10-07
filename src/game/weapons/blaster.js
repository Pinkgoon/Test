// src/game/weapons/blaster.js
import { calcMods } from '../Addons.js';
const fan=(a,tri)=> tri?[a-0.20,a,a+0.20]:[a];

export default {
  id:'wpn_blaster',
  name:'블래스터',
  desc:'기본 자동 조준 사격',
  icon:'assets/weapons/wpn_blaster.png',
  maxLvl:5,
  tags:['무기','비관통','발사','원거리'],
  baseInterval:0.45,
  range:900,
  create(){ return { id:this.id, type:'blaster', lvl:1, cd:0, addons:[] }; },
  update(inst, api){
    const mods=calcMods(inst); const tri=!!mods.tri;
    inst.cd-=api.dt; if(inst.cd>0) return;
    inst.cd=Math.max(0.06,(this.baseInterval*mods.cdMul)/Math.max(0.1, api.player.attackSpeedMul));

    const t=api.findNearestEnemy(api.player.x,api.player.y); if(!t) return;
    const a0=Math.atan2(t.y-api.player.y,t.x-api.player.x);
    const shots=(api.player.projectiles||1)+mods.proj;
    const spread=Math.min(0.18,0.08+0.02*(shots-1));
    const sp=api.player.bulletSpd||520;
    const dmg=api.player.dmg*Math.pow(1.0,inst.lvl-1)*mods.dmgMul;
    const pierce=((api.player.pierce||0)+(mods.pierce||0))|0;

    for(let i=0;i<shots;i++){
      const t=shots===1?0:(i/(shots-1)-0.5);
      const a=a0+t*spread;
      for(const ang of fan(a,tri)){
        api.pushBullet({x:api.player.x,y:api.player.y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,r:4,dmg,life:((this.range||900)/(api.player.bulletSpd||520)),pierce,color:'#cfe8ff',
          burn:mods.burn, freeze:mods.freeze});
      }
    }
  }
};