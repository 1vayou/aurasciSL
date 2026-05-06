/* AuraSci · client-side auth stub
 * ------------------------------------------------------------
 * Demo-only. Persists a flag in localStorage. When logged out:
 *  · the "Portfolio" link in the top nav is hidden, replaced
 *    with a "Login" button that opens a sign-in modal
 *  · clicking any dashboard-patron link opens the same modal
 *    instead of navigating
 * After login the flag is set and Portfolio re-appears.
 */
(function () {
  const KEY = 'aurasci_auth';
  const isAuthed = () => localStorage.getItem(KEY) === '1';

  // ---------- modal ----------
  let modalEl = null;

  function ensureModal() {
    if (modalEl) return modalEl;
    const css = `
      .as-modal-bd{position:fixed;inset:0;z-index:9000;background:rgba(42,26,16,0.55);
        backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;
        padding:20px;opacity:0;transition:opacity .2s ease;pointer-events:none}
      .as-modal-bd.on{opacity:1;pointer-events:auto}
      .as-modal{position:relative;width:100%;max-width:420px;background:#fdfcf8;
        border:1px solid rgba(58,36,24,0.18);border-radius:8px;padding:32px 30px;
        box-shadow:0 32px 80px rgba(58,36,24,0.25);
        font-family:'Inter',sans-serif;color:#2a1a10;
        transform:translateY(8px);transition:transform .25s ease}
      .as-modal-bd.on .as-modal{transform:translateY(0)}
      .as-modal::before,.as-modal::after{content:'';position:absolute;width:14px;height:14px;
        border:1.5px solid #c2410c;pointer-events:none}
      .as-modal::before{top:-1px;left:-1px;border-right:none;border-bottom:none}
      .as-modal::after{bottom:-1px;right:-1px;border-left:none;border-top:none}
      .as-eyebrow{font-family:'JetBrains Mono',monospace;font-size:11px;color:#c2410c;
        letter-spacing:.18em;text-transform:uppercase;margin:0 0 10px;display:flex;
        align-items:center;gap:10px}
      .as-eyebrow::before{content:'';width:14px;height:1px;background:#c2410c}
      .as-modal h3{font-family:'Newsreader',serif;font-weight:500;font-size:24px;
        letter-spacing:-0.01em;margin:0 0 10px}
      .as-modal h3 em{font-style:italic;color:#c2410c}
      .as-modal p{font-size:13px;color:#5a3d2a;margin:0 0 18px;line-height:1.55}
      .as-field{display:block;margin-bottom:14px}
      .as-field label{display:block;font-family:'JetBrains Mono',monospace;font-size:11px;
        font-weight:500;color:rgba(58,36,24,0.55);letter-spacing:.12em;
        text-transform:uppercase;margin-bottom:6px}
      .as-field input{width:100%;padding:12px 14px;border-radius:6px;
        border:1px solid rgba(58,36,24,0.18);background:#faf3e3;
        font-family:'Inter',sans-serif;font-size:14px;color:#2a1a10;outline:none;
        transition:border-color .2s,background .2s,box-shadow .2s;box-sizing:border-box}
      .as-field input:focus{border-color:#c2410c;background:#fffaee;
        box-shadow:0 0 0 3px rgba(194,65,12,0.10)}
      .as-actions{display:flex;gap:10px;align-items:center;margin-top:18px}
      .as-btn-primary{flex:1;padding:12px 16px;background:#c2410c;color:#faf3e3;
        border:none;border-radius:6px;font-family:'Inter',sans-serif;font-size:14px;
        font-weight:600;letter-spacing:0;cursor:pointer;transition:background .2s,
        box-shadow .2s;display:inline-flex;align-items:center;justify-content:center;
        gap:8px}
      .as-btn-primary:hover{background:#9a3412;box-shadow:0 6px 16px rgba(154,52,18,0.30)}
      .as-divider{font-family:'JetBrains Mono',monospace;font-size:10px;
        color:rgba(58,36,24,0.45);text-align:center;margin:14px 0;letter-spacing:.18em;
        text-transform:uppercase;display:flex;align-items:center;gap:10px}
      .as-divider::before,.as-divider::after{content:'';flex:1;height:1px;
        background:rgba(58,36,24,0.12)}
      .as-btn-ghost{width:100%;padding:11px 14px;background:transparent;color:#3a2418;
        border:1px solid rgba(58,36,24,0.22);border-radius:6px;font-family:'Inter',sans-serif;
        font-size:13px;font-weight:500;cursor:pointer;transition:border-color .2s,color .2s;
        display:inline-flex;align-items:center;justify-content:center;gap:8px}
      .as-btn-ghost:hover{border-color:#c2410c;color:#c2410c}
      .as-close{position:absolute;top:14px;right:14px;width:28px;height:28px;
        border-radius:50%;background:transparent;border:none;color:rgba(58,36,24,0.55);
        cursor:pointer;display:flex;align-items:center;justify-content:center;
        transition:color .2s,background .2s}
      .as-close:hover{color:#c2410c;background:rgba(254,215,170,0.30)}
      .as-foot{margin-top:14px;font-family:'JetBrains Mono',monospace;font-size:10px;
        color:rgba(58,36,24,0.45);letter-spacing:.06em}
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.className = 'as-modal-bd';
    wrap.innerHTML = `
      <div class="as-modal" role="dialog" aria-modal="true">
        <button class="as-close" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <div class="as-eyebrow">Patron · sign in</div>
        <h3>Welcome to <em>AuraSci</em></h3>
        <p>Sign in with the email you backed research with. We'll send a one-time link to confirm — no password needed.</p>
        <form class="as-form" novalidate>
          <div class="as-field">
            <label>Email</label>
            <input type="email" placeholder="patron@example.com" autocomplete="email" required />
          </div>
          <div class="as-actions">
            <button type="submit" class="as-btn-primary">
              Continue
              <span style="font-family:'JetBrains Mono',monospace">↗</span>
            </button>
          </div>
        </form>
        <div class="as-divider">or</div>
        <button class="as-btn-ghost" type="button" data-as="wallet">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 14a2 2 0 1 1 0-4h6"/>
          </svg>
          Connect wallet
        </button>
        <div class="as-foot">Demo flow — any email works. State persists in localStorage.</div>
      </div>
    `;
    document.body.appendChild(wrap);

    wrap.addEventListener('click', function (e) {
      if (e.target === wrap) closeModal();
    });
    wrap.querySelector('.as-close').addEventListener('click', closeModal);
    wrap.querySelector('.as-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const v = wrap.querySelector('input[type="email"]').value.trim();
      doLogin(v || 'patron@aurasci.io');
    });
    wrap.querySelector('[data-as="wallet"]').addEventListener('click', function () {
      doLogin('wallet:0xA1f2…91Be');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && wrap.classList.contains('on')) closeModal();
    });
    modalEl = wrap;
    return wrap;
  }

  function openModal() {
    const w = ensureModal();
    requestAnimationFrame(function () { w.classList.add('on'); });
    setTimeout(function () {
      const i = w.querySelector('input[type="email"]');
      if (i) i.focus();
    }, 200);
  }
  function closeModal() {
    if (modalEl) modalEl.classList.remove('on');
  }

  function doLogin(handle) {
    localStorage.setItem(KEY, '1');
    if (handle) localStorage.setItem('aurasci_handle', handle);
    closeModal();
    applyAuthState();
    // If we're on the landing or any page where the patron CTA was clicked,
    // route to the portfolio. Otherwise just refresh the nav state.
    const target = sessionStorage.getItem('aurasci_post_login');
    if (target) {
      sessionStorage.removeItem('aurasci_post_login');
      window.location.href = target;
    }
  }

  function doLogout() {
    localStorage.removeItem(KEY);
    localStorage.removeItem('aurasci_handle');
    applyAuthState();
  }

  // ---------- nav state ----------
  function applyAuthState() {
    const authed = isAuthed();
    const portfolioLinks = document.querySelectorAll(
      '.bnav .links a[href="dashboard-patron.html"], nav .links a[href="dashboard-patron.html"]'
    );
    portfolioLinks.forEach(function (a) {
      a.style.display = authed ? '' : 'none';
      // Insert / find a Login twin right next to it
      let twin = a.parentNode.querySelector('.as-login-link');
      if (!twin) {
        twin = document.createElement('a');
        twin.className = 'as-login-link';
        twin.href = 'javascript:void(0)';
        twin.textContent = 'Login';
        // Carry the existing link styling so spacing/underline matches
        if (a.className) twin.className += ' ' + a.className;
        a.parentNode.insertBefore(twin, a);
        twin.addEventListener('click', function (e) {
          e.preventDefault();
          openModal();
        });
      }
      twin.style.display = authed ? 'none' : '';
    });
  }

  // ---------- intercept patron-route clicks while logged out ----------
  function interceptPatronLinks() {
    document.addEventListener('click', function (e) {
      const a = e.target.closest('a[href$="dashboard-patron.html"], a[href*="dashboard-patron.html?"]');
      if (!a) return;
      // skip if this is the nav anchor (already hidden when logged out)
      if (isAuthed()) return;
      // Otherwise pop the login modal and remember the intended destination
      e.preventDefault();
      sessionStorage.setItem('aurasci_post_login', a.getAttribute('href'));
      openModal();
    });
  }

  // ---------- expose ----------
  window.AuraSciAuth = {
    isAuthed: isAuthed,
    login: doLogin,
    logout: doLogout,
    open: openModal
  };

  function bootstrap() {
    applyAuthState();
    interceptPatronLinks();
    // Some pages (the bundled landing) swap the document at runtime.
    // Watch the body for childList changes and re-apply the nav state
    // until things stabilise.
    if ('MutationObserver' in window) {
      const obs = new MutationObserver(function () { applyAuthState(); });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { obs.disconnect(); }, 10000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
