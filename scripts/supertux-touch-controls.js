// Touch keyboard bridge for the UNMODIFIED original SuperTux Emscripten/SDL
// binary. Synthesizes only keyboard input; no game rules or assets are replaced.
(function () {
  'use strict';
  const touchDevice = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
    navigator.maxTouchPoints > 0;
  if (!touchDevice) return;

  function mount() {
    const game = document.getElementById('canvas');
    if (!game || document.getElementById('naqla-supertux-controls')) return;
    const style = document.createElement('style');
    style.textContent = [
      '#naqla-supertux-controls{position:fixed;inset:0;z-index:20;pointer-events:none;',
      'font:600 13px/1 system-ui,sans-serif;user-select:none;-webkit-user-select:none}',
      '#naqla-supertux-controls .touch-group{position:absolute;bottom:max(14px,env(safe-area-inset-bottom));',
      'display:flex;gap:8px;pointer-events:auto;align-items:end}',
      '#naqla-supertux-controls .directions{left:max(14px,env(safe-area-inset-left))}',
      '#naqla-supertux-controls .actions{right:max(14px,env(safe-area-inset-right))}',
      '#naqla-supertux-controls button{min-width:52px;min-height:52px;border-radius:16px;',
      'border:1px solid #c7d9ffff;background:#121e30d9;color:#fff;font:700 17px system-ui;',
      'touch-action:none;-webkit-tap-highlight-color:transparent;box-shadow:0 3px 12px #0009}',
      '#naqla-supertux-controls button[data-down=true]{background:#4875c2}',
      '#naqla-supertux-controls .aux{position:absolute;right:12px;top:12px;pointer-events:auto;',
      'display:flex;gap:8px}',
      '#naqla-supertux-controls .aux button{min-height:36px;min-width:54px;font-size:12px}',
      '#naqla-supertux-controls[data-collapsed=true] .touch-group{display:none}',
      '@media(pointer:fine){#naqla-supertux-controls{display:none}}'
    ].join('');
    const wrapper = document.createElement('div');
    wrapper.id = 'naqla-supertux-controls';
    wrapper.setAttribute('aria-label', 'SuperTux mobile controls');
    const active = new Map();
    function send(type, code, key, keyCode) {
      // SDL/Emscripten listens for keyboard events on the document/window;
      // Emscripten's legacy translation may also require keyCode.
      const event = new KeyboardEvent(type, {
        bubbles:true, cancelable:true, composed:true, code, key
      });
      Object.defineProperty(event, 'keyCode', { get: () => keyCode });
      Object.defineProperty(event, 'which', { get: () => keyCode });
      game.focus({ preventScroll: true });
      game.dispatchEvent(event);
    }
    function release(button) {
      const item = active.get(button);
      if (!item) return;
      active.delete(button);
      send('keyup', item.code, item.key, item.num);
      button.dataset.down = 'false';
    }
    const dirs = document.createElement('div');
    dirs.className='touch-group directions';
    const actions = document.createElement('div');
    actions.className='touch-group actions';
    const keys = [
      ['left','◀','ArrowLeft','ArrowLeft',37,'Move left',dirs],
      ['right','▶','ArrowRight','ArrowRight',39,'Move right',dirs],
      ['up','△','ArrowUp','ArrowUp',38,'Move / menu up',dirs],
      ['down','▽','ArrowDown','ArrowDown',40,'Crouch / menu down',dirs],
      ['jump','▲','Space',' ',32,'Jump',actions],
      // Match SuperTux ORIGINAL src/control/keyboard_config.cpp defaults:
      // ACTION=SDL_SCANCODE_LCTRL, ITEM=SDL_SCANCODE_LSHIFT.
      ['action','Run','ControlLeft','Control',17,'Run / action',actions],
      ['item','Item','ShiftLeft','Shift',16,'Use item',actions]
    ];
    for (const [id, label, code, key, num, description, target] of keys) {
      const button = document.createElement('button');
      button.type='button';
      button.id='naqla-supertux-'+id;
      button.textContent=label;
      button.setAttribute('aria-label',description);
      button.addEventListener('pointerdown', event => {
        event.preventDefault();
        if (active.has(button)) return;
        try { button.setPointerCapture(event.pointerId); } catch (_) {}
        active.set(button,{code,key,num});
        send('keydown',code,key,num);
        button.dataset.down='true';
      });
      for (const type of ['pointerup','pointercancel','lostpointercapture']) {
        button.addEventListener(type,()=>release(button));
      }
      target.appendChild(button);
    }
    const auxiliary = document.createElement('div');
    auxiliary.className='aux';
    const menu = document.createElement('button');
    menu.type='button';
    menu.id='naqla-supertux-enter';
    menu.textContent='OK';
    menu.setAttribute('aria-label','Select menu item');
    const pause = document.createElement('button');
    pause.type='button';
    pause.id='naqla-supertux-escape';
    pause.textContent='Pause';
    pause.setAttribute('aria-label','Pause game');
    for (const [button,code,key,num] of [
      [menu,'Enter','Enter',13], [pause,'Escape','Escape',27]
    ]) {
      button.addEventListener('pointerdown', event => {
        event.preventDefault();
        if (active.has(button)) return;
        try { button.setPointerCapture(event.pointerId); } catch (_) {}
        active.set(button,{code,key,num});
        send('keydown',code,key,num);
        button.dataset.down='true';
      });
      for (const type of ['pointerup','pointercancel','lostpointercapture']) {
        button.addEventListener(type,()=>release(button));
      }
      auxiliary.appendChild(button);
    }
    const toggle = document.createElement('button');
    toggle.type='button';
    toggle.id='naqla-supertux-toggle';
    toggle.textContent='Hide';
    toggle.setAttribute('aria-label','Show or hide game controls');
    toggle.addEventListener('click',()=>{
      for(const b of [...active.keys()])release(b);
      wrapper.dataset.collapsed = wrapper.dataset.collapsed === 'true' ? 'false' : 'true';
      toggle.textContent = wrapper.dataset.collapsed === 'true' ? 'Controls' : 'Hide';
    });
    auxiliary.appendChild(toggle);
    wrapper.append(dirs,actions,auxiliary);
    document.head.appendChild(style);
    document.body.appendChild(wrapper);
    window.addEventListener('blur',()=>{for(const b of [...active.keys()])release(b)});
    document.addEventListener('visibilitychange',()=>{
      if (document.hidden) for(const b of [...active.keys()])release(b);
    });
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
})();