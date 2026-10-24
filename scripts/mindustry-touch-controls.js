// NAQLA offline touch controls for the *original* Mindustry/Arc TeaVM engine.
// These synthesize the same DOM key events that TeavmInput already consumes.
// They do not modify the original game rules, content or AI.
(function () {
  'use strict';
  const coarse = window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  if (!coarse) return;
  function mount() {
    if (document.querySelector('#naqla-mindustry-touch') || !document.body) return;
    const style = document.createElement('style');
    style.textContent = `
      #naqla-mindustry-touch { position:fixed; bottom:12px; left:12px; z-index:12;
        font:600 12px/1.1 system-ui,sans-serif; color:#fff; user-select:none;
        -webkit-user-select:none; touch-action:none }
      #naqla-mindustry-touch button { touch-action:none; user-select:none;
        -webkit-user-select:none; -webkit-tap-highlight-color:transparent;
        background:#152436d9; color:white; border:1px solid #8cacd9bb;
        border-radius:12px; min-width:40px; min-height:40px;
        box-shadow:0 2px 8px #0008; cursor:pointer; font:inherit }
      #naqla-touch-toggle { padding:0 12px; }
      #naqla-touch-pad { display:grid; gap:3px; grid-template-columns:repeat(3,40px);
        grid-template-rows:repeat(3,40px); margin-bottom:7px }
      #naqla-touch-pad[hidden] { display:none; }
      #naqla-touch-pad button { font-size:19px; }
      #naqla-touch-pad button:active,#naqla-touch-pad button[data-down=true]{
        background:#466bb9; border-color:#c0d8ff }
      #naqla-touch-pad .up { grid-column:2; grid-row:1 }
      #naqla-touch-pad .left { grid-column:1; grid-row:2 }
      #naqla-touch-pad .down { grid-column:2; grid-row:3 }
      #naqla-touch-pad .right { grid-column:3; grid-row:2 }
      @media(pointer:fine) { #naqla-mindustry-touch { display:none } }
    `;
    const overlay = document.createElement('div');
    overlay.id = 'naqla-mindustry-touch';
    overlay.setAttribute('aria-label','Mindustry touch movement controls');
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = 'naqla-touch-toggle';
    toggle.textContent = 'Controls';
    toggle.setAttribute('aria-expanded','false');
    const pad = document.createElement('div');
    pad.id = 'naqla-touch-pad';
    pad.hidden = true;
    const keyMap = [
      ['up','▲','KeyW','w','Move up'],
      ['left','◀','KeyA','a','Move left'],
      ['down','▼','KeyS','s','Move down'],
      ['right','▶','KeyD','d','Move right']
    ];
    const held = new Map();
    function keyEvent(type, code, key) {
      window.dispatchEvent(new KeyboardEvent(type,{
        code,key,bubbles:true,cancelable:true,composed:true
      }));
    }
    function release(button) {
      const entry = held.get(button);
      if (!entry) return;
      held.delete(button);
      keyEvent('keyup',entry.code,entry.key);
      button.dataset.down = 'false';
    }
    function releaseAll() { for (const button of [...held.keys()]) release(button); }
    for (const [dir,glyph,code,key,label] of keyMap) {
      const button = document.createElement('button');
      button.type='button';
      button.className=dir;
      button.id='naqla-touch-' + dir;
      button.textContent=glyph;
      button.setAttribute('aria-label',label);
      button.addEventListener('pointerdown',e=>{
        e.preventDefault();
        if (held.has(button)) return;
        try { button.setPointerCapture(e.pointerId); } catch (_) {}
        held.set(button,{code,key});
        keyEvent('keydown',code,key);
        button.dataset.down='true';
      });
      for (const type of ['pointerup','pointercancel','lostpointercapture']) {
        button.addEventListener(type,()=>release(button));
      }
      pad.appendChild(button);
    }
    toggle.addEventListener('click',()=>{
      if (!pad.hidden) releaseAll();
      pad.hidden=!pad.hidden;
      toggle.setAttribute('aria-expanded',String(!pad.hidden));
    });
    window.addEventListener('blur',releaseAll);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseAll()});
    overlay.append(pad,toggle);
    document.head.appendChild(style);
    document.body.appendChild(overlay);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
})();
