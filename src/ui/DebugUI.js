// src/ui/DebugUI.js
// 오버레이 Debug UI — 최신 레지스트리 함수(allWeapons)로 무기 목록 읽기

import { PERK_DEFS } from '../game/Perks.js';
import { allWeapons } from '../game/weapons/index.js';
import { ADDON_DEFS } from '../game/Addons.js';

export class DebugUI {
  constructor(root, handlers){
    this.root = root;
    this.handlers = handlers || {};
    this._visible = false;

    this.el = document.createElement('div');
    Object.assign(this.el.style, {
      position:'fixed', inset:'0', background:'rgba(12,14,20,0.86)',
      zIndex: 9999, display:'none', color:'#fff', fontFamily:'ui-sans-serif,system-ui', backdropFilter:'blur(2px)'
    });

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      width:'min(1040px, 92vw)', height:'min(80vh, 720px)',
      margin:'8vh auto 0', background:'rgba(20,24,32,0.95)',
      border:'1px solid rgba(255,255,255,0.12)', borderRadius:'14px',
      boxShadow:'0 24px 48px rgba(0,0,0,.45)', display:'flex', flexDirection:'column', overflow:'hidden'
    });

    const header = document.createElement('div');
    Object.assign(header.style, {
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'12px 14px', borderBottom:'1px solid rgba(255,255,255,0.10)', background:'rgba(0,0,0,.2)'
    });
    const title = document.createElement('div'); title.textContent='Debug';
    Object.assign(title.style,{ fontWeight:'700', letterSpacing:'0.3px' });

    const right = document.createElement('div'); right.style.display='flex'; right.style.alignItems='center'; right.style.gap='8px';
    const tip = document.createElement('div'); tip.textContent='클릭=획득 · ESC=닫기'; Object.assign(tip.style,{ fontSize:'12px', opacity:.75 });
    const closeBtn = document.createElement('button'); closeBtn.textContent='닫기';
    Object.assign(closeBtn.style,{ padding:'6px 10px', borderRadius:'8px', background:'#2a2f3d', color:'#fff', border:'1px solid rgba(255,255,255,0.18)', cursor:'pointer' });
    closeBtn.onclick = ()=> this.handlers.onClose?.();
    header.appendChild(title); header.appendChild(right); right.appendChild(tip); right.appendChild(closeBtn);

    const tabs = document.createElement('div');
    Object.assign(tabs.style, { display:'flex', gap:'6px', padding:'10px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.02)' });
    const tabBtn = (label)=>{ const b=document.createElement('button'); b.textContent=label;
      Object.assign(b.style,{ padding:'6px 10px', borderRadius:'8px', background:'rgba(255,255,255,0.06)', color:'#fff', border:'1px solid rgba(255,255,255,0.12)', cursor:'pointer' });
      b.onactive=(yes)=>{ b.style.background = yes?'rgba(120,176,255,0.18)':'rgba(255,255,255,0.06)'; };
      return b;
    };
    const btnWeapons=tabBtn('Weapons'), btnPerks=tabBtn('Perks'), btnAddons=tabBtn('Addons');

    const body = document.createElement('div'); Object.assign(body.style,{ flex:'1 1 auto', overflow:'auto', padding:'12px' });

    panel.appendChild(header); panel.appendChild(tabs); panel.appendChild(body);
    tabs.appendChild(btnWeapons); tabs.appendChild(btnPerks); tabs.appendChild(btnAddons);
    this.el.appendChild(panel); this.root.appendChild(this.el);

    this._body=body; this._btns={btnWeapons,btnPerks,btnAddons};
    this._onKey=(e)=>{ if(e.key==='Escape'){ e.preventDefault(); this.handlers.onClose?.(); } };
    btnWeapons.onclick=()=>this._renderList('weapon');
    btnPerks.onclick=()=>this._renderList('perk');
    btnAddons.onclick=()=>this._renderList('addon');
  }

  show(){ if(this._visible) return; this._visible=true; this.el.style.display='block'; window.addEventListener('keydown', this._onKey, true); }
  hide(){ if(!this._visible) return; this._visible=false; this.el.style.display='none'; window.removeEventListener('keydown', this._onKey, true); }
  render(){ this._renderList('weapon'); }

  _renderList(kind){
    this._btns.btnWeapons.onactive(kind==='weapon');
    this._btns.btnPerks.onactive(kind==='perk');
    this._btns.btnAddons.onactive(kind==='addon');

    const list = kind==='weapon' ? allWeapons() : (kind==='perk' ? PERK_DEFS : ADDON_DEFS);
    this._body.innerHTML='';
    const grid=document.createElement('div'); Object.assign(grid.style,{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:'10px' });

    for(const d of list){
      const card=document.createElement('div');
      Object.assign(card.style,{ display:'flex', gap:'10px', alignItems:'center', padding:'10px', borderRadius:'10px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.10)', cursor:'pointer' });
      card.onmouseenter=()=> card.style.background='rgba(120,176,255,0.12)';
      card.onmouseleave=()=> card.style.background='rgba(255,255,255,0.04)';

      const img=document.createElement('img'); img.src=d.icon||''; Object.assign(img.style,{ width:'42px', height:'42px', objectFit:'contain', borderRadius:'8px', background:'rgba(255,255,255,0.06)' }); img.onerror=()=>{img.style.opacity=0.5;};
      const col=document.createElement('div'); col.style.flex='1';
      const name=document.createElement('div'); name.textContent=d.name||d.id; Object.assign(name.style,{ fontWeight:'700' });
      const desc=document.createElement('div'); desc.textContent=d.desc||d.stepDesc||''; Object.assign(desc.style,{ fontSize:'12px', opacity:.8, marginTop:'4px' });

      card.appendChild(img); card.appendChild(col); col.appendChild(name); col.appendChild(desc);

      card.onclick=()=>{
        if (kind==='weapon') this.handlers.onPickWeapon?.(d.id);
        else if (kind==='perk') this.handlers.onPickPerk?.(d.id);
        else this.handlers.onPickAddon?.(d.id);
      };
      grid.appendChild(card);
    }
    this._body.appendChild(grid);
  }
}
