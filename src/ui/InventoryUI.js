// src/ui/InventoryUI.js
// 인벤토리 패널: 무기 카드(태그 칩/아이콘/이름·레벨/애드온 3슬롯/해제) + 가방(드래그)
// ★ 고유(unique) 애드온은 노란색 강조

import { getAddonById } from '../game/Addons.js';
import { getWeaponById } from '../game/Weapons.js';

export class InventoryUI {
  constructor(rootEl, handlers){
    this.root = rootEl;
    this.h = handlers || {};
    this._build();
  }

  _build(){
    this.wrap = document.createElement('div');
    this.wrap.className = 'inv-overlay';
    Object.assign(this.wrap.style,{
      position:'absolute', inset:0, display:'none', zIndex:20,
      background:'rgba(10,12,16,0.72)', backdropFilter:'blur(6px)'
    });

    const panel = document.createElement('div');
    Object.assign(panel.style,{
      position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)',
      width:'960px', maxWidth:'calc(100% - 40px)', height:'600px',
      background:'#131722', border:'1px solid rgba(255,255,255,0.12)',
      borderRadius:'16px', boxShadow:'0 30px 80px rgba(0,0,0,.45)', display:'grid',
      gridTemplateColumns:'1.1fr 0.9fr', gap:'0', overflow:'hidden'
    });

    this.left = document.createElement('div');
    Object.assign(this.left.style,{ padding:'18px 18px 12px 18px', overflow:'auto' });

    this.right = document.createElement('div');
    Object.assign(this.right.style,{ padding:'18px', borderLeft:'1px solid rgba(255,255,255,0.08)', display:'flex', flexDirection:'column' });

    const titleL = document.createElement('div');
    titleL.textContent = '장착 무기';
    Object.assign(titleL.style,{ fontWeight:700, color:'#cde3ff', marginBottom:'10px' });

    const titleR = document.createElement('div');
    titleR.textContent = '애드온 가방 (드래그하여 장착)';
    Object.assign(titleR.style,{ fontWeight:700, color:'#cde3ff', marginBottom:'10px' });

    this.weaponsGrid = document.createElement('div');
    Object.assign(this.weaponsGrid.style,{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' });

    this.addonBag = document.createElement('div');
    Object.assign(this.addonBag.style,{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:'10px', flex:'1 1 auto', overflow:'auto' });

    const close = document.createElement('button');
    close.textContent = '닫기 (Esc)';
    Object.assign(close.style,{ marginTop:'12px', alignSelf:'flex-end', background:'#202736', color:'#fff', border:'1px solid rgba(255,255,255,0.16)', padding:'8px 12px', borderRadius:'10px', cursor:'pointer' });
    close.onclick = ()=>this.h.onClose?.();

    this.left.append(titleL, this.weaponsGrid);
    this.right.append(titleR, this.addonBag, close);
    panel.append(this.left, this.right);
    this.wrap.appendChild(panel);
    this.root.appendChild(this.wrap);

    const style = document.createElement('style');
    style.textContent = `
    .chip{ display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; border:1px solid rgba(255,255,255,.16); margin-right:6px; color:#eaf1ff; background:rgba(255,255,255,.06); }
    .tag-w{ background:rgba(136,190,255,.14); border-color:rgba(136,190,255,.35); }
    .tag-np{ background:rgba(255,170,136,.14); border-color:rgba(255,170,136,.35); }
    .tag-p{ background:rgba(153,255,165,.12); border-color:rgba(153,255,165,.35); }
    .tag-summon{ background:rgba(240,196,255,.12); border-color:rgba(240,196,255,.35); }
    .slot{ width:48px;height:48px;border-radius:10px;border:1px dashed rgba(255,255,255,.25); display:flex;align-items:center;justify-content:center; background:rgba(255,255,255,.04); position:relative; }
    .slot.err{ border-color:#ff6b6b; box-shadow:0 0 0 2px rgba(255,107,107,.35) inset; }
    .slot img{ width:100%; height:100%; object-fit:contain; border-radius:10px; }
    .slot.unique{ border:1px solid rgba(255,214,74,.9); box-shadow:0 0 0 2px rgba(255,214,74,.25) inset; }
    .adn{ width:60px;height:60px;border:1px solid rgba(255,255,255,.16);border-radius:12px;background:rgba(255,255,255,.04);display:flex;align-items:center;justify-content:center;cursor:grab; position:relative; }
    .adn.unique{ border-color: rgba(255,214,74,.9); box-shadow:0 0 0 2px rgba(255,214,74,.25) inset; background: rgba(255,214,74,.08); }
    .adn img{ width:100%;height:100%;object-fit:contain;border-radius:12px; }
    .card{ border:1px solid rgba(255,255,255,.12); border-radius:14px; padding:12px; background:rgba(255,255,255,.03);}
    .card h4{ margin:0; font-size:14px; color:#fff; }
    .muted{ color:#9fb2c8; font-size:12px; }
    .unlink{ background:#2a2f3d; color:#fff; border:1px solid rgba(255,255,255,.16); border-radius:10px; padding:6px 8px; cursor:pointer; }
    `;
    document.head.appendChild(style);
  }

  show(){ this.wrap.style.display = 'block'; }
  hide(){ this.wrap.style.display = 'none'; }

  tagChip(t){
    const span = document.createElement('span'); span.className='chip';
    span.textContent = t;
    if (t==='무기') span.classList.add('tag-w');
    else if (t==='비관통') span.classList.add('tag-np');
    else if (t==='관통') span.classList.add('tag-p');
    else if (t==='소환') span.classList.add('tag-summon');
    return span;
  }

  _weaponCard(wInst){
    const wdef = getWeaponById(wInst.id) || {};
    const card = document.createElement('div'); card.className='card';

    const tags = document.createElement('div');
    for(const t of (wdef.tags||[])) tags.appendChild(this.tagChip(t));

    const head = document.createElement('div');
    Object.assign(head.style,{ display:'grid', gridTemplateColumns:'64px 1fr auto', gap:'12px', alignItems:'center', margin:'8px 0 10px 0' });

    const icon = document.createElement('img');
    Object.assign(icon.style,{ width:'64px', height:'64px', objectFit:'contain', borderRadius:'12px', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.12)' });
    icon.src = wdef.icon || '';

    const name = document.createElement('div');
    name.innerHTML = `<h4>${wdef.name||wInst.id}</h4><div class="muted">${wdef.desc||''}</div>`;

    const lvl = document.createElement('div'); lvl.className='chip'; lvl.textContent=`Lv.${wInst.lvl||1}`;

    const slots = document.createElement('div');
    Object.assign(slots.style,{ display:'flex', gap:'8px', marginTop:'4px' });

    const makeSlot = (idx)=>{
      const s = document.createElement('div'); s.className='slot'; s.dataset.idx = String(idx);
      const filled = wInst.addons?.[idx];
      if (filled) {
        const adef = getAddonById(filled.id);
        const img = document.createElement('img'); img.src = adef?.icon || ''; s.appendChild(img);
        s.title = `${adef?.name||filled.id}\n${adef?.desc||''}`;
        if (adef?.unique) s.classList.add('unique'); // ★ 고유 슬롯 강조
        s.onclick = ()=>this.h.onRemoveAddon?.({weaponId:wInst.id, slot:idx});
      }
      s.ondragover = (e)=>{ e.preventDefault(); };
      s.ondragenter = (e)=>{ e.preventDefault(); s.classList.remove('err'); };
      s.ondrop = (e)=>{
        e.preventDefault();
        const aid = e.dataTransfer.getData('text/addon-id');
        if (!aid) return;
        this.h.onDropAddon?.({weaponId:wInst.id, addonId:aid});
      };
      return s;
    };

    for (let i=0;i<3;i++) slots.appendChild(makeSlot(i));

    const un = document.createElement('button'); un.className='unlink'; un.textContent='해제';
    un.onclick = ()=>this.h.onUnequipWeapon?.(wInst.id);

    card.append(tags, head, slots, un);
    head.append(icon, name, lvl);
    return card;
  }

  _addonCell(a){
    const def = getAddonById(a.id) || {};
    const cell = document.createElement('div'); cell.className='adn'; if (def.unique) cell.classList.add('unique'); // ★ 고유 강조
    cell.draggable=true;
    const img = document.createElement('img'); img.src = def.icon || ''; cell.appendChild(img);
    cell.title = `${def.name||a.id}\n${def.desc||''}\n[태그] ${def.tags?.join(', ')||'-'}${def.unique?' · 고유':''}`;
    cell.ondragstart = (e)=>{ e.dataTransfer.setData('text/addon-id', a.id); };
    return cell;
  }

  render(inv){
    this.weaponsGrid.innerHTML='';
    for (const w of inv.equipped.weapons) this.weaponsGrid.appendChild(this._weaponCard(w));
    this.addonBag.innerHTML='';
    for (const a of inv.bag.addons) this.addonBag.appendChild(this._addonCell(a));
  }
}
