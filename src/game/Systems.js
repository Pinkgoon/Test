// src/game/Systems.js
// 공용 시스템: 충돌/이동/경험치 처리/넉백 등

export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function len(x,y){ return Math.hypot(x,y)||1; }

// ──────────────────────────────────────────────────────────────────────────
// 넉백 적용(즉시 속도 가산 방식)
export function applyKnockback(enemy, fromX, fromY, kb){
  if(!kb || kb<=0) return;
  const dx = enemy.x - fromX;
  const dy = enemy.y - fromY;
  const L = len(dx,dy);
  enemy.vx = (enemy.vx||0) + (dx/L) * kb;
  enemy.vy = (enemy.vy||0) + (dy/L) * kb;
}

// ──────────────────────────────────────────────────────────────────────────
// (옵션) 표준 발사 유틸 – 일부 무기에서 사용
export function tryShoot(state, player, dt){
  // 현재 프로젝트에선 각 무기 모듈이 직접 발사하는 구조.
  // 필요 시 공용 탄막 생성 로직을 여기에 추가 가능.
  return false;
}

// ──────────────────────────────────────────────────────────────────────────
// 총알 업데이트/충돌
export function updateBullets(state, cvs){
  const W=cvs.clientWidth, H=cvs.clientHeight;

  for(let i=state.bullets.length-1;i>=0;i--){
    const b = state.bullets[i];
    b.x += (b.vx||0) * state.dt;
    b.y += (b.vy||0) * state.dt;
    if(b.t!=null){
      b.t -= state.dt;
      if (b.t<=0){
        if (b.explodeOnEnd || b.explodeRadius!=null){
          state.explosions.push({ x:b.x, y:b.y, r:(b.explodeRadius||60), dmg:(b.explodeDmg ?? (b.dmg ?? 18)), t:0.22, did:false });
        }
        state.bullets.splice(i,1);
        continue;
      }
    }

    // 화면 밖 제거(약간 여유)
    if(b.x<-20||b.y<-20||b.x>W+20||b.y>H+20){ state.bullets.splice(i,1); continue; }

    // 적 충돌
    let pierced = 0;
    for(let j=state.enemies.length-1;j>=0;j--){
      const e = state.enemies[j];
      const rr = (b.r||4) + (e.r||12);
      const dx = b.x - e.x, dy = b.y - e.y;
      if (dx*dx + dy*dy <= rr*rr){
        // 피해
        const dmg = b.dmg ?? 5;
        e.hp -= dmg;

        // 상태이상(있다면)
        if (b.burn) { e._burn = { t: b.burn.dur, dps: (e._burn?.dps||0)+b.burn.dps }; }
        if (b.freeze && Math.random()<(b.freeze.chance||0)) { e._freeze = { t: b.freeze.dur, slowMul: b.freeze.slowMul }; }

        
        // 폭발(명중시)
        if (b.explodeOnHit || b.explodeRadius!=null){
          state.explosions.push({ x:b.x, y:b.y, r:(b.explodeRadius||60), dmg:(b.explodeDmg ?? (b.dmg ?? 18)), t:0.22, did:false });
          state.bullets.splice(i,1);
          break;
        }
// ★ 넉백: 기본 110 / 무기에서 b.kb 지정 가능
        const kb = b.kb ?? 110;
        applyKnockback(e, b.x - (b.vx||0)*0.01, b.y - (b.vy||0)*0.01, kb);

        // 피어스/소멸
        if (b.pierce!=null){
          b.pierce--;
          if (b.pierce < 0){ state.bullets.splice(i,1); break; }
          pierced++;
        } else {
          state.bullets.splice(i,1); break;
        }

        // 처치 처리
        if(e.hp<=0){
          state.enemies.splice(j,1);
          state.score += 25;
          state.dropFunc?.(e.x, e.y);
        }
      }
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 적 업데이트(추적 + 넉백 속도 감쇠 + 상태이상)
export function updateEnemies(state, player, cvs){
  const W=cvs.clientWidth, H=cvs.clientHeight;
  const dt = state.dt;

  for(let i=state.enemies.length-1;i>=0;i--){
    const e = state.enemies[i];

    // 상태이상 처리
    if (e._burn){ e._burn.t -= dt; e.hp -= e._burn.dps * dt; if(e._burn.t<=0) e._burn=null; }
    if (e._freeze){ e._freeze.t -= dt; if(e._freeze.t<=0) e._freeze=null; }

    // 사망 체크(연소 등으로)
    if (e.hp<=0){ state.enemies.splice(i,1); state.score+=25; state.dropFunc?.(e.x,e.y); continue; }

    // 넉백 속도(impulse) 감쇠
    e.vx = (e.vx||0); e.vy = (e.vy||0);
    const damping = 6.0; // 감쇠 계수(커질수록 빨리 멈춤)
    e.vx -= e.vx * damping * dt;
    e.vy -= e.vy * damping * dt;

    // 기본 추적 이동 (빙결/슬로우 반영)
    const slowMul = e._freeze ? (e._freeze.slowMul ?? 0.4) : 1.0;
    const baseSpd = (e.speed||60) * slowMul;
    const dx = player.x - e.x, dy = player.y - e.y; const L = Math.hypot(dx,dy)||1;
    const mvx = dx/L * baseSpd, mvy = dy/L * baseSpd;

    e.x += (mvx + e.vx) * dt;
    e.y += (mvy + e.vy) * dt;

    // 경계
    e.x = clamp(e.x, e.r, W - e.r);
    e.y = clamp(e.y, e.r, H - e.r);

    // 플레이어 충돌 데미지
    const rr = (e.r||12) + (player.r||12);
    const pdx = e.x - player.x, pdy = e.y - player.y;
    if (pdx*pdx + pdy*pdy <= rr*rr && player.iTime<=0){
      const dmg = e.touchDmg ?? 5;
      player.hp -= dmg;
      player.iTime = 0.6;
      if(player.hp<=0) state.gameOver = true;
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 드랍/경험치(보정: 미끄럼 감속 후 정지)
export function updateGems(state, player){
  const dt=state.dt;
  for(let i=state.gems.length-1;i>=0;i--){
    const g = state.gems[i];
    // 드랍 직후 관성 감쇠 → 멈춤
    g.vx = (g.vx||0); g.vy=(g.vy||0);
    const damp = 4.5; g.vx -= g.vx*damp*dt; g.vy -= g.vy*damp*dt;
    g.x += g.vx*dt; g.y += g.vy*dt;

    // 플레이어에 흡인
    const dx=player.x-g.x, dy=player.y-g.y, L=Math.hypot(dx,dy)||1;
    const pickR = 18 + (player.pickup||0);
    if(L<=pickR){
      if(g.kind==='xp'){
        player.xp += g.v ?? 1;
        if(player.xp >= player.nextXp){
          player.level++; player.xp -= player.nextXp;
          player.nextXp = state.xpFor(player.level);
          state.requestLevelup=true;
        }
      } else if (g.kind==='addon'){
        const ok = state.pickupAddonFunc?.(g.addonId);
        if(!ok){ // 가방 꽉차면 흡수 실패 → 튕겨나감
          g.vx = -dx/L * 120; g.vy = -dy/L * 120;
          continue;
        }
      }
      state.gems.splice(i,1);
      continue;
    }

    // 자력 범위에서 서서히 끌림
    const attractR = 140 + (player.pickup||0)*1.2;
    if(L<attractR){
      const sp = 220 * dt;
      g.x += dx/L * sp; g.y += dy/L * sp;
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 폭발 이펙트(표현 + 피해) — 넉백 0
export function updateExplosions(state){
  const dt=state.dt;
  for(let i=state.explosions.length-1;i>=0;i--){
    const ex = state.explosions[i];
    ex.t -= dt; if(ex.t<=0){ state.explosions.splice(i,1); continue; }
    if (ex.did) continue; // 1틱만 피해
    ex.did = true;

    for(let j=state.enemies.length-1;j>=0;j--){
      const e = state.enemies[j];
      const rr = (ex.r||60) + (e.r||12);
      const dx = ex.x - e.x, dy = ex.y - e.y;
      if (dx*dx + dy*dy <= rr*rr){
        e.hp -= (ex.dmg ?? 18);
        // ★ 폭발 넉백 = 0 (요구사항)
        // applyKnockback(e, ex.x, ex.y, 0);

        if (e.hp<=0){
          state.enemies.splice(j,1);
          state.score += 25;
          state.dropFunc?.(e.x, e.y);
        }
      }
    }
  }
}
