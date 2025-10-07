// src/engine/Assets.js
// - 스킨(p: player, e: enemy) 로딩/저장
// - 기본 스킨 없음 → assets/skins/player.png, assets/skins/enemy.png 자동 로드
// - HUD 프리뷰(pPrev, ePrev)와 슬라이더(pSize, eSize) 상태 동기화

export class Assets {
  constructor(hud) {
    this.hud = hud || null;
    this.p = null;     // HTMLImageElement for player
    this.e = null;     // HTMLImageElement for enemy
    this.pSize = 1;
    this.eSize = 1;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Public API
  loadSaved() {
    // sizes
    const ps = Number(localStorage.getItem('skin_pSize'));
    const es = Number(localStorage.getItem('skin_eSize'));
    if (!Number.isNaN(ps) && ps > 0) this.pSize = ps;
    if (!Number.isNaN(es) && es > 0) this.eSize = es;
    if (this.hud) {
      if (this.hud.pSize) this.hud.pSize.value = String(this.pSize);
      if (this.hud.eSize) this.hud.eSize.value = String(this.eSize);
    }

    // images (dataURL만 저장)
    const p64 = localStorage.getItem('skin_player');
    const e64 = localStorage.getItem('skin_enemy');

    const loads = [];
    if (p64) loads.push(this.#loadImage(p64).then(img => { this.p = img; this.#setPreview('p', p64); }).catch(()=>{}));
    if (e64) loads.push(this.#loadImage(e64).then(img => { this.e = img; this.#setPreview('e', e64); }).catch(()=>{}));
    return Promise.all(loads);
  }

  async loadDefaultsIfEmpty() {
    const tasks = [];
    if (!this.p) {
      tasks.push(this.#loadImage('assets/skins/player.png').then(img => {
        this.p = img; this.#setPreview('p', 'assets/skins/player.png');
      }).catch(()=>{}));
    }
    if (!this.e) {
      tasks.push(this.#loadImage('assets/skins/enemy.png').then(img => {
        this.e = img; this.#setPreview('e', 'assets/skins/enemy.png');
      }).catch(()=>{}));
    }
    await Promise.all(tasks);
  }

  save() {
    try {
      if (this.p && typeof this.p.src === 'string' && this.p.src.startsWith('data:')) {
        localStorage.setItem('skin_player', this.p.src);
      } else {
        localStorage.removeItem('skin_player');
      }
      if (this.e && typeof this.e.src === 'string' && this.e.src.startsWith('data:')) {
        localStorage.setItem('skin_enemy', this.e.src);
      } else {
        localStorage.removeItem('skin_enemy');
      }
      localStorage.setItem('skin_pSize', String(this.pSize || 1));
      localStorage.setItem('skin_eSize', String(this.eSize || 1));
    } catch (_) {}
  }

  // ────────────────────────────────────────────────────────────────────────
  // Helpers
  #setPreview(kind, src) {
    if (!this.hud) return;
    if (kind === 'p' && this.hud.pPrev) this.hud.pPrev.src = src;
    if (kind === 'e' && this.hud.ePrev) this.hud.ePrev.src = src;
  }

  #loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
}
