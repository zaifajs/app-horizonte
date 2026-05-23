/*  Sidebar collapse toggle — shared across all Horizonte CRM screens.
    Drop a single <script src="sidebar-collapse.js"></script> before </body>
    and the sidebar gains a 22px toggle pill, persisted in localStorage.   */
(function(){
  const KEY = 'horizonte.sidebar.collapsed';

  const aside = document.querySelector('aside[style*="width:232px"]');
  if (!aside) return;

  // 1) Inject CSS once
  const style = document.createElement('style');
  style.textContent = `
    .sb-toggle{
      position:absolute;top:18px;right:-11px;width:22px;height:22px;
      border-radius:50%;background:#131722;border:1px solid #212838;
      color:#9BA3B4;display:inline-flex;align-items:center;justify-content:center;
      cursor:pointer;z-index:20;
      transition:color .15s, border-color .15s, background .15s;
    }
    .sb-toggle:hover{color:#E6E9EF;border-color:#5C6478;background:#171C2A}
    .sb-toggle svg{transition:transform .2s}

    aside.sb-collapsed{width:64px !important; transition:width .15s ease}
    aside{transition:width .15s ease}
    aside.sb-collapsed .sb-toggle svg{transform:rotate(180deg)}

    aside.sb-collapsed .sb-hide{display:none !important}
    aside.sb-collapsed .nav-item{padding:9px 0; justify-content:center; gap:0}
    aside.sb-collapsed .nav-item.active::before{left:0; top:9px; bottom:9px}
    aside.sb-collapsed [class*="px-4"]{padding-left:14px;padding-right:14px}
    aside.sb-collapsed [class*="px-5"]{padding-left:14px;padding-right:14px}
    aside.sb-collapsed [class*="px-3"]{padding-left:8px;padding-right:8px}
    aside.sb-collapsed [class*="p-3"]{padding:10px 8px}

    /* Tighten the search button to icon-only */
    aside.sb-collapsed .nav-item > svg,
    aside.sb-collapsed button > svg{flex-shrink:0}
  `;
  document.head.appendChild(style);

  // 2) Inject toggle button — top-right edge of sidebar
  const btn = document.createElement('button');
  btn.className = 'sb-toggle';
  btn.setAttribute('aria-label', 'Toggle sidebar');
  btn.title = 'Toggle sidebar';
  btn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';
  aside.appendChild(btn);

  // 3) Mark elements that should disappear when collapsed.

  // 3a. Brand: hide the wordmark block (everything next to the lime square)
  aside.querySelectorAll(':scope > div:first-child .leading-tight').forEach(el => el.classList.add('sb-hide'));

  // 3b. Section labels (Workspace, Pinned, Today, Batches) — hide their wrapper
  aside.querySelectorAll('div').forEach(el => {
    const cls = el.getAttribute('class') || '';
    if (/tracking-\[\.18em\]/.test(cls) && /uppercase/.test(cls)) {
      if (el.closest('.nav-item') || el.closest('button')) return;
      const wrap = el.closest('[class*="px-4"], [class*="px-5"], [class*="px-3"]');
      (wrap || el).classList.add('sb-hide');
    }
  });

  // 3c. Nav items: hide everything except the first svg
  aside.querySelectorAll('.nav-item').forEach(item => {
    let svgSeen = false;
    [...item.childNodes].forEach(node => {
      if (node.nodeType === 1) {
        if (node.tagName.toLowerCase() === 'svg' && !svgSeen) { svgSeen = true; return; }
        if (node.classList) node.classList.add('sb-hide');
      } else if (node.nodeType === 3 && node.nodeValue.trim()) {
        const span = document.createElement('span');
        span.className = 'sb-hide';
        span.textContent = node.nodeValue;
        node.parentNode.replaceChild(span, node);
      }
    });
  });

  // 3d. Search button: keep first svg, hide the rest
  aside.querySelectorAll('button').forEach(b => {
    if (!b.querySelector('.kbd')) return;
    let svgSeen = false;
    [...b.children].forEach(c => {
      const tag = c.tagName.toLowerCase();
      if (tag === 'svg' && !svgSeen) { svgSeen = true; return; }
      c.classList.add('sb-hide');
    });
  });

  // 3e. System status block (.mt-auto with no button inside)
  aside.querySelectorAll('.mt-auto').forEach(el => {
    if (!el.matches('button') && !el.querySelector('button')) {
      el.classList.add('sb-hide');
    }
  });

  // 3f. User pill: keep just the avatar
  aside.querySelectorAll('button').forEach(b => {
    const avi = b.querySelector('.avi');
    if (!avi) return;
    [...b.children].forEach(c => {
      if (c === avi || c.contains(avi)) return;
      c.classList.add('sb-hide');
    });
  });

  // 4) Restore previous state
  function apply(collapsed) {
    aside.classList.toggle('sb-collapsed', collapsed);
  }
  apply(localStorage.getItem(KEY) === '1');

  btn.addEventListener('click', () => {
    const next = !aside.classList.contains('sb-collapsed');
    apply(next);
    try { localStorage.setItem(KEY, next ? '1' : '0'); } catch(e) {}
  });

  // 5) Keyboard shortcut: [ ] to toggle
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, [contenteditable]')) return;
    if (e.key === '[' || e.key === ']') {
      btn.click();
    }
  });
})();
