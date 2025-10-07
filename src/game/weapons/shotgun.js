// src/game/weapons/shotgun.js
import { calcMods } from '../Addons.js';
const fan=(a,tri)=> tri?[a-0.20,a,a+0.20]:[a];

export default {
  id:'wpn_shotgun',
  name:'샷건',
  desc:'주기적으로 산탄 발사 (탄창 2 / 장전 3초)',
  icon:'assets/weapons/wpn_shotgun.png',
  maxLvl:5,
  tags:['무기','비관통','발사','원거리','탄창'],
  baseInterval:0.9,
  range:700,
  magCap:2,
  reloadTime:3.0,
  create(){ return { id:this.id, type:'shotgun', lvl:1, cd:0, addons:[], magCap:this.magCap, mag:this.magCap, reloadTime:this.reloadTime, reloadT:0, reloading:false }; },
  update(inst, api){
    const mods=calcMods(inst); const tri=!!mods.tri;

    if(inst.reloading){ inst.reloadT-=api.dt; if(inst.reloadT<=0){ inst.reloading=false; inst.mag=inst.magCap; } return; }

    inst.cd-=api.dt; if(inst.cd>0) return;
    if((inst.mag|0)<=0){ inst.reloading=true; inst.reloadT=inst.reloadTime; return; }

    const levelMul=Math.pow(0.92,inst.lvl-1);
    inst.cd=Math.max(0.12,(this.baseInterval*levelMul*mods.cdMul)/Math.max(0.1, api.player.attackSpeedMul));

    const t=api.findNearestEnemy(api.player.x,api.player.y); if(!t) return;
    const a0=Math.atan2(t.y-api.player.y,t.x-api.player.x);
    const pellets=6+(inst.lvl-1)+mods.proj;
    const spread=0.35; const sp=520;
    const dmg=api.player.dmg*(0.70*(1+0.10*(inst.lvl-1)))*mods.dmgMul;
    const pierce=((api.player.pierce||0)+(mods.pierce||0))|0;

    for(let k=0;k<pellets;k++){
      const tt=pellets===1?0:(k/(pellets-1)-0.5);
      const a=a0+tt*spread;
      for(const ang of fan(a,tri)){
        api.pushBullet({x:api.player.x,y:api.player.y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,r:4,dmg,life:((this.range||700)/(520)),pierce,color:'#ffcf9a',
          burn:mods.burn, freeze:mods.freeze});
      }
    }

    inst.mag=Math.max(0,(inst.mag|0)-1);
    if(inst.mag===0){ inst.reloading=true; inst.reloadT=inst.reloadTime; }
  }
};