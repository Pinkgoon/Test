// src/game/weapons/missile.js
// 직선 미사일 — 사거리/피격 시 폭발 + 슬롯별 배출(발사 때마다)
import { calcMods } from '../Addons.js';

export default {
  id: 'wpn_missile',
  name: '미사일 런쳐',
  desc: '일직선으로 날아가 충돌/수명 종료 시 폭발',
  icon: 'assets/weapons/wpn_missile.png',
  maxLvl: 5,
  tags: ['무기','발사','원거리','폭발','탄창'],

  baseInterval: 0.9,
  baseRange: 700,
  magCap: 1,
  reloadTime: 2.0,

  create(){
    return {
      id:this.id, type:'missile', lvl:1, cd:0, addons:[],
      mag:this.magCap, magCap:this.magCap,
      reloading:false, reloadT:0, reloadTime:this.reloadTime,
    };
  },

  update(inst, api){
    const { player, dt, pushBullet, findNearestEnemy, state, ejectMag } = api;
    const mods = calcMods(inst);
    const levelMul = Math.pow(0.98, inst.lvl-1);
    const interval = (this.baseInterval * levelMul * (mods.cdMul||1)) / Math.max(0.1, player.attackSpeedMul);

    if (inst.reloading){
      inst.reloadT -= dt;
      if (inst.reloadT <= 0){ inst.reloading=false; inst.mag=inst.magCap; }
      return;
    }

    inst.cd -= dt; if (inst.cd>0) return;
    if (inst.mag<=0){ inst.reloading=true; inst.reloadT=inst.reloadTime; return; }

    const t = findNearestEnemy(player.x, player.y);
    const dir = t ? Math.atan2(t.y - player.y, t.x - player.x) : 0;

    const spd = 520;
    const baseDmg = player.dmg * (1.2 + 0.12*(inst.lvl-1)) * (mods.dmgMul||1);
    const exR = 88 + 6*(inst.lvl-1);
    const exD = baseDmg * 1.25;

    const makeExplosion = (x,y)=>{
      state.explosions.push({ x, y, r: exR, dmg: exD, t:0.22, did:false });
    };

    pushBullet({
      x: player.x, y: player.y,
      vx: Math.cos(dir)*spd, vy: Math.sin(dir)*spd,
      r: 5,
      dmg: baseDmg,
      color: '#ffd5a6',
      pierce: 0,
      kb: 0,
      maxDist: this.baseRange,
      onHit: (_e, _state, b)=>{ makeExplosion(b.x, b.y); },
      onExpire: (_state, b)=>{ makeExplosion(b.x, b.y); },
    });

    // ★ 슬롯별 배출
    const consumedIdx = Math.max(0, (inst.mag|0) - 1);
    ejectMag(this, player, consumedIdx, inst);

    inst.mag -= 1;
    inst.cd = interval;

    if (inst.mag<=0){ inst.reloading=true; inst.reloadT=inst.reloadTime; }
  }
};
