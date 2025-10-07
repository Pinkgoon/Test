// src/game/weapons/missile.js
import { calcMods } from '../Addons.js';
export default {
  id:'wpn_missile',
  name:'미사일 런쳐',
  desc:'직선 비행 후 폭발 (탄창 1 / 장전 2초)',
  icon:'assets/weapons/wpn_missile.png',
  maxLvl:5,
  tags:['무기','비관통','발사','원거리','탄창'],
  baseInterval:0.85,
  range:1200,
  magCap:1,
  reloadTime:2.0,
  create(){ return { id:this.id, type:'missile', lvl:1, cd:0, addons:[], magCap:this.magCap, mag:this.magCap, reloadTime:this.reloadTime, reloadT:0, reloading:false }; },
  update(inst, api){
    const mods=calcMods(inst);

    if(inst.reloading){ inst.reloadT-=api.dt; if(inst.reloadT<=0){ inst.reloading=false; inst.mag=inst.magCap; } return; }

    inst.cd-=api.dt; if(inst.cd>0) return;

    if((inst.mag|0)<=0){ inst.reloading=true; inst.reloadT=inst.reloadTime; return; }

    inst.cd=Math.max(0.22,(this.baseInterval*Math.pow(0.96,inst.lvl-1)*mods.cdMul)/Math.max(0.1, api.player.attackSpeedMul));

    const t=api.findNearestEnemy(api.player.x,api.player.y); if(!t) return;
    const a=Math.atan2(t.y-api.player.y,t.x-api.player.x);
    const sp=420; const dmg=api.player.dmg*(0.80+0.10*(inst.lvl-1))*mods.dmgMul;
    const rad=60+8*(inst.lvl-1);

    api.pushBullet({ x:api.player.x, y:api.player.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, r:5, dmg,  pierce:0,
      color:'#ffb3b3', explodeOnHit:true, explodeOnEnd:true, explodeRadius:rad, explodeDmg:dmg*1.6 , t:((this.range||1200)/(420))});

    inst.mag=Math.max(0,(inst.mag|0)-1);
    if(inst.mag===0){ inst.reloading=true; inst.reloadT=inst.reloadTime; }
  }
};
