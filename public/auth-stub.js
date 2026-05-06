/* AuraSci · client-side auth stub
 * ------------------------------------------------------------
 * Demo-only. Persists a flag in localStorage. Logged out:
 *  · Portfolio link hidden in the nav, replaced by a prominent
 *    rust-coloured "Login" button on the far right.
 *  · Clicking any dashboard-patron link opens the same login
 *    modal instead of navigating; on success it resumes the
 *    original destination.
 * Modal supports 4 demo sign-in methods: Google, Twitter, email,
 * Connect Wallet.
 */
(function () {
  const KEY = 'aurasci_auth';
  const isAuthed = () => localStorage.getItem(KEY) === '1';

  // ---------- styles (one-shot) ----------
  function ensureStyles() {
    if (document.getElementById('as-stub-styles')) return;
    const css = `
      /* === Nav baseline alignment fix === */
      .bnav .links,nav .links{align-items:baseline}

      /* === Nav login CTA === */
      .as-nav-login{appearance:none;-webkit-appearance:none;
        padding:7px 18px;border-radius:6px;background:#c2410c;color:#faf3e3;
        border:1px solid #c2410c;font-family:'Inter',sans-serif;font-size:13px;
        font-weight:600;letter-spacing:0.01em;cursor:pointer;
        transition:background .2s,border-color .2s,box-shadow .2s,transform .2s;
        display:inline-flex;align-items:center;gap:8px;
        margin-left:16px;text-decoration:none;vertical-align:baseline;
        position:relative;top:-1px}
      .as-nav-login:hover{background:#9a3412;border-color:#9a3412;
        box-shadow:0 6px 16px rgba(154,52,18,0.28);transform:translateY(-1px)}
      /* Portfolio state — outline style */
      .as-nav-cta[data-as-state="authed"]{
        background:transparent;color:#c2410c;border-color:rgba(194,65,12,0.4)}
      .as-nav-cta[data-as-state="authed"]:hover{
        background:rgba(254,215,170,0.30);border-color:#c2410c;
        box-shadow:0 4px 12px rgba(154,52,18,0.14);transform:translateY(-1px)}

      /* === Modal === */
      .as-modal-bd{position:fixed;inset:0;z-index:9000;background:rgba(42,26,16,0.55);
        backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;
        padding:20px;opacity:0;transition:opacity .2s ease;pointer-events:none}
      .as-modal-bd.on{opacity:1;pointer-events:auto}
      .as-modal{position:relative;width:100%;max-width:440px;background:#fdfcf8;
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
        letter-spacing:-0.01em;margin:0 0 8px}
      .as-modal h3 em{font-style:italic;color:#c2410c}
      .as-modal .sub{font-size:13px;color:#5a3d2a;margin:0 0 22px;line-height:1.55}

      /* OAuth grid */
      .as-oauth{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
      .as-oauth-btn{padding:11px 12px;border-radius:6px;background:#fdfcf8;
        border:1px solid rgba(58,36,24,0.20);color:#2a1a10;font-family:'Inter',sans-serif;
        font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;
        display:inline-flex;align-items:center;justify-content:center;gap:8px}
      .as-oauth-btn:hover{border-color:#c2410c;background:rgba(254,215,170,0.30);color:#c2410c}
      .as-oauth-btn svg{flex-shrink:0}

      .as-wallet-btn{width:100%;padding:11px 14px;border-radius:6px;background:#fdfcf8;
        border:1px solid rgba(58,36,24,0.22);color:#2a1a10;font-family:'Inter',sans-serif;
        font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;
        display:inline-flex;align-items:center;justify-content:center;gap:8px;
        margin-bottom:14px}
      .as-wallet-btn:hover{border-color:#c2410c;background:rgba(254,215,170,0.30);color:#c2410c}

      .as-divider{font-family:'JetBrains Mono',monospace;font-size:10px;
        color:rgba(58,36,24,0.45);text-align:center;margin:6px 0 14px;letter-spacing:.18em;
        text-transform:uppercase;display:flex;align-items:center;gap:10px}
      .as-divider::before,.as-divider::after{content:'';flex:1;height:1px;
        background:rgba(58,36,24,0.12)}

      .as-field{display:block;margin-bottom:12px}
      .as-field label{display:block;font-family:'JetBrains Mono',monospace;font-size:11px;
        font-weight:500;color:rgba(58,36,24,0.55);letter-spacing:.12em;
        text-transform:uppercase;margin-bottom:6px}
      .as-field input{width:100%;padding:12px 14px;border-radius:6px;
        border:1px solid rgba(58,36,24,0.18);background:#faf3e3;
        font-family:'Inter',sans-serif;font-size:14px;color:#2a1a10;outline:none;
        transition:border-color .2s,background .2s,box-shadow .2s;box-sizing:border-box}
      .as-field input:focus{border-color:#c2410c;background:#fffaee;
        box-shadow:0 0 0 3px rgba(194,65,12,0.10)}
      .as-btn-primary{width:100%;padding:12px 16px;background:#c2410c;color:#faf3e3;
        border:none;border-radius:6px;font-family:'Inter',sans-serif;font-size:14px;
        font-weight:600;letter-spacing:0;cursor:pointer;transition:background .2s,
        box-shadow .2s;display:inline-flex;align-items:center;justify-content:center;gap:8px}
      .as-btn-primary:hover{background:#9a3412;box-shadow:0 6px 16px rgba(154,52,18,0.30)}
      .as-close{position:absolute;top:14px;right:14px;width:28px;height:28px;
        border-radius:50%;background:transparent;border:none;color:rgba(58,36,24,0.55);
        cursor:pointer;display:flex;align-items:center;justify-content:center;
        transition:color .2s,background .2s}
      .as-close:hover{color:#c2410c;background:rgba(254,215,170,0.30)}
      .as-foot{margin-top:14px;font-family:'JetBrains Mono',monospace;font-size:10px;
        color:rgba(58,36,24,0.45);letter-spacing:.06em;text-align:center}
    `;
    const style = document.createElement('style');
    style.id = 'as-stub-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---------- modal ----------
  let modalEl = null;

  function ensureModal() {
    if (modalEl) return modalEl;
    ensureStyles();
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
        <div class="as-eyebrow">Sign in</div>
        <h3>Welcome to <em>AuraSci</em></h3>
        <p class="sub">Pick how you'd like to continue. We'll never post on your behalf.</p>

        <div class="as-oauth">
          <button class="as-oauth-btn" data-as="google">
            <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
              <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
              <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
            </svg>
            Google
          </button>
          <button class="as-oauth-btn" data-as="twitter">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            Twitter
          </button>
        </div>

        <button class="as-wallet-btn" data-as="wallet">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="6" width="20" height="14" rx="2"/>
            <path d="M16 14a2 2 0 1 1 0-4h6"/>
          </svg>
          Connect wallet
        </button>

        <div class="as-divider">or with email</div>

        <form class="as-form" novalidate>
          <div class="as-field">
            <label>Email</label>
            <input type="email" placeholder="patron@example.com" autocomplete="email" required />
          </div>
          <button type="submit" class="as-btn-primary">
            Continue
            <span style="font-family:'JetBrains Mono',monospace">↗</span>
          </button>
        </form>

        <div class="as-foot">Demo flow — any choice signs you in. State persists in localStorage.</div>
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
      doLogin('email', v || 'patron@aurasci.io');
    });
    wrap.querySelector('[data-as="google"]').addEventListener('click', function () {
      doLogin('google', 'patron@gmail.com');
    });
    wrap.querySelector('[data-as="twitter"]').addEventListener('click', function () {
      doLogin('twitter', '@patron_xyz');
    });
    wrap.querySelector('[data-as="wallet"]').addEventListener('click', function () {
      doLogin('wallet', '0xA1f2…91Be');
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

  function doLogin(method, handle) {
    localStorage.setItem(KEY, '1');
    if (method) localStorage.setItem('aurasci_auth_method', method);
    if (handle) localStorage.setItem('aurasci_handle', handle);
    closeModal();
    applyAuthState();
    const target = sessionStorage.getItem('aurasci_post_login');
    if (target) {
      sessionStorage.removeItem('aurasci_post_login');
      window.location.href = target;
    }
  }

  function doLogout() {
    localStorage.removeItem(KEY);
    localStorage.removeItem('aurasci_handle');
    localStorage.removeItem('aurasci_auth_method');
    applyAuthState();
  }

  // ---------- nav state ----------
  function applyAuthState() {
    ensureStyles();
    const authed = isAuthed();

    // Clean up legacy login twins
    document.querySelectorAll('.as-login-link').forEach(function (n) { n.remove(); });

    // Always hide the original Portfolio link — we show it at the far right instead
    document.querySelectorAll(
      '.bnav .links a[href="dashboard-patron.html"], nav .links a[href="dashboard-patron.html"]'
    ).forEach(function (a) { a.style.display = 'none'; });

    // Inject / update the far-right CTA in every nav links group
    document.querySelectorAll('.bnav .links, nav .links').forEach(function (linksGroup) {
      var cta = linksGroup.querySelector('.as-nav-cta');
      if (!cta) {
        cta = document.createElement('a');
        cta.className = 'as-nav-login as-nav-cta';
        linksGroup.appendChild(cta);
      }

      if (authed) {
        // Portfolio link — outline style
        cta.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><path d="M8 21h8M12 17v4"/></svg><span>Portfolio</span>';
        cta.href = 'dashboard-patron.html';
        cta.setAttribute('data-as-state', 'authed');
        cta.onclick = null;
      } else {
        // Login button — solid rust
        cta.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg><span>Login</span>';
        cta.href = 'javascript:void(0)';
        cta.setAttribute('data-as-state', 'anon');
        cta.onclick = function (e) { e.preventDefault(); openModal(); };
      }
    });
  }

  // ---------- intercept patron-route clicks while logged out ----------
  let interceptInstalled = false;
  function interceptPatronLinks() {
    if (interceptInstalled) return;
    interceptInstalled = true;
    document.addEventListener('click', function (e) {
      const a = e.target.closest('a[href$="dashboard-patron.html"], a[href*="dashboard-patron.html?"]');
      if (!a) return;
      if (isAuthed()) return;
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
