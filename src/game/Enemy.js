// src/game/Enemy.js
// 적 스폰: 각 적에 고유 uid를 부여

let NEXT_EID = 1;

export function spawnEnemy(state, cvs) {
  const margin = 24;
  const side = (Math.random() * 4) | 0;
  let x, y;
  if (side === 0) { // left
    x = -margin; y = Math.random() * cvs.clientHeight;
  } else if (side === 1) { // right
    x = cvs.clientWidth + margin; y = Math.random() * cvs.clientHeight;
  } else if (side === 2) { // top
    x = Math.random() * cvs.clientWidth; y = -margin;
  } else { // bottom
    x = Math.random() * cvs.clientWidth; y = cvs.clientHeight + margin;
  }

  const t = state.timeSurvived || 0;
  const wave = 1 + Math.floor(t / 30);

  // 체력/속도 곡선(완만)
  const baseHp = 32 + wave * 8 + t * 0.8;
  const hp = Math.round(baseHp);
  const speed = 82 + wave * 3;

  const e = {
    uid: NEXT_EID++,  // ★ 고유 식별자
    x, y,
    r: 12,
    hp, maxHp: hp,
    speed,
    dps: 12,
  };
  state.enemies.push(e);
}
