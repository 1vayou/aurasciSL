/* AuraSci × Solana — Unified wallet auth flow
 *
 * Design principle: ONE button at top-right.
 *   - Not connected → "Login" (original behavior: opens sign-in modal)
 *   - Connected     → wallet address pill (click to disconnect)
 *
 * The sign-in modal's "Connect wallet" option is wired to real Phantom.
 *
 * Devnet only. ~0.001 SOL demo patronage for "Fund this research".
 */
(function () {
  'use strict';

  // ── Config ───────────────────────────────────────────────────────────
  const CONFIG = {
    cluster: 'devnet',
    rpcUrl: 'https://api.devnet.solana.com',
    // System program address — always valid base58, accepts transfers on devnet
    escrowAddress: '11111111111111111111111111111112',
    demoPatronageSol: 0.001,
    programId: '2J766XS6NbvebT1sdsMgLtLPf5cL1dmHr5ko5LwJ2SiE', // AuraSci Anchor program on devnet
    explorerBase: 'https://explorer.solana.com',
    storageKey: 'aurasci.wallet.addr',
  };

  // ── State ────────────────────────────────────────────────────────────
  let walletPubkey = localStorage.getItem(CONFIG.storageKey) || null;

  // ── Util ─────────────────────────────────────────────────────────────
  function shortAddr(pk) {
    const s = pk.toString();
    return s.slice(0, 4) + '…' + s.slice(-4);
  }

  function getPhantom() {
    if ('phantom' in window) return window.phantom?.solana;
    if (window.solana?.isPhantom) return window.solana;
    return null;
  }

  function loadSolanaWeb3() {
    if (window.solanaWeb3) return Promise.resolve(window.solanaWeb3);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/@solana/web3.js@1.95.4/lib/index.iife.min.js';
      s.onload = () => resolve(window.solanaWeb3);
      s.onerror = () => reject(new Error('Failed to load @solana/web3.js'));
      document.head.appendChild(s);
    });
  }

  // ── Clean up any old injected buttons from previous deploys ─────────
  function purgeOldInjections() {
    document.querySelectorAll('.aura-wallet-btn').forEach((el) => el.remove());
  }

  // ── Find the original "Login" button on the page ─────────────────────
  function findLoginButton() {
    // Common patterns across this app's HTML files
    const candidates = Array.from(
      document.querySelectorAll('button, a, .login, .nav-cta')
    );
    return candidates.find((el) => {
      if (el.dataset.auraIsLogin === '1') return true;
      const t = (el.textContent || '').trim();
      return /^Login$/i.test(t) || /^Sign\s*in$/i.test(t);
    });
  }

  // ── Render Login button state ────────────────────────────────────────
  function renderAuthButton() {
    const btn = findLoginButton();
    if (!btn) return; // nothing to render against

    btn.dataset.auraIsLogin = '1'; // remember it so we can find it again

    if (walletPubkey) {
      // Connected — show wallet address pill
      btn.textContent = shortAddr(walletPubkey);
      btn.title = 'Click to disconnect • ' + walletPubkey;
      btn.style.fontFamily = "'JetBrains Mono', ui-monospace, monospace";
      btn.dataset.auraConnected = '1';
    } else {
      // Not connected — show original Login text
      if (btn.dataset.auraConnected === '1') {
        btn.textContent = 'Login';
        btn.title = '';
        btn.style.fontFamily = '';
        delete btn.dataset.auraConnected;
      }
    }

    // Hook click — only once
    if (!btn.dataset.auraClickHooked) {
      btn.dataset.auraClickHooked = '1';
      btn.addEventListener(
        'click',
        function (e) {
          if (walletPubkey) {
            // Connected → disconnect on click
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            disconnectWallet();
          }
          // Not connected → let the original modal open (auth-stub.js handles it)
          // We hook the modal's "Connect wallet" via hookModalWalletOption below
        },
        true // capture phase so we intercept BEFORE auth-stub.js
      );
    }
  }

  // ── Hook the modal's "Connect wallet" option to trigger real Phantom ─
  // Uses document-level capture so we ALWAYS run before auth-stub.js,
  // regardless of when the modal/button is inserted into the DOM.
  let walletCaptureInstalled = false;
  function hookModalWalletOption() {
    if (walletCaptureInstalled) return;
    walletCaptureInstalled = true;

    document.addEventListener(
      'click',
      async function (e) {
        // Find the closest clickable that matches the "Connect wallet" button
        const el = e.target.closest(
          'button, a, [role="button"], [data-as="wallet"], .as-oauth-btn'
        );
        if (!el) return;

        // Skip our own re-purposed Login button (it has its own handler)
        if (el.dataset.auraIsLogin === '1') return;

        const txt = (el.textContent || '').trim();
        const isWalletBtn =
          /^Connect wallet$/i.test(txt) ||
          el.dataset.as === 'wallet' ||
          el.dataset.action === 'connect-wallet';
        if (!isWalletBtn) return;

        // INTERCEPT: prevent auth-stub.js mock-login from running
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        await connectWallet();
        if (walletPubkey) {
          // Close the modal (try multiple common close patterns)
          const modal = el.closest(
            '.modal, .as-modal, .as-wrap, [role="dialog"], [class*="modal" i], [class*="overlay" i]'
          );
          if (modal) {
            const closeBtn = modal.querySelector(
              '.close, [aria-label="Close"], [data-close], button[aria-label*="close" i], .as-close'
            );
            if (closeBtn) closeBtn.click();
            else modal.remove();
          }
          // Also dismiss any backdrop / overlay
          document
            .querySelectorAll(
              '.modal-backdrop, .overlay, .as-backdrop, .backdrop'
            )
            .forEach((b) => b.remove());
          renderAuthButton();
        }
      },
      true // CAPTURE phase — fires before any listener attached to the button
    );
  }

  // ── Wallet connect / disconnect ──────────────────────────────────────
  async function connectWallet() {
    const phantom = getPhantom();
    if (!phantom) {
      const install = confirm(
        'Phantom wallet not detected.\n\n' +
          'AuraSci uses Phantom for Solana sign-in on devnet.\n\n' +
          'Install Phantom now?'
      );
      if (install) window.open('https://phantom.app/', '_blank');
      return;
    }
    try {
      const resp = await phantom.connect();
      walletPubkey = resp.publicKey.toString();
      localStorage.setItem(CONFIG.storageKey, walletPubkey);
      renderAuthButton();
      logActivity('🟢 Wallet connected · ' + shortAddr(walletPubkey), null);
      return walletPubkey;
    } catch (err) {
      console.error('[AuraSci] connect failed:', err);
      alert('Failed to connect wallet: ' + (err.message || err));
    }
  }

  async function disconnectWallet() {
    try {
      const phantom = getPhantom();
      if (phantom?.disconnect) await phantom.disconnect();
    } catch (_) {}
    walletPubkey = null;
    localStorage.removeItem(CONFIG.storageKey);
    renderAuthButton();
    logActivity('🔌 Wallet disconnected', null);
  }

  // ── Real Solana devnet patronage on "Fund this research" ─────────────
  async function sendPatronage(amountSol) {
    if (!walletPubkey) {
      const ok = confirm(
        'You need to connect your Phantom wallet first.\n\n' +
          'Click OK to open the sign-in dialog.'
      );
      if (ok) {
        const loginBtn = findLoginButton();
        if (loginBtn && !walletPubkey) loginBtn.click();
      }
      return;
    }
    const phantom = getPhantom();
    if (!phantom) {
      alert('Phantom wallet not detected. Install at phantom.app');
      return;
    }

    let web3;
    try {
      web3 = await loadSolanaWeb3();
    } catch (e) {
      alert('Failed to load Solana SDK: ' + e.message);
      return;
    }

    try {
      const connection = new web3.Connection(CONFIG.rpcUrl, 'confirmed');
      const fromPubkey = new web3.PublicKey(walletPubkey);
      const toPubkey = new web3.PublicKey(CONFIG.escrowAddress);
      const lamports = Math.round(amountSol * web3.LAMPORTS_PER_SOL);

      const tx = new web3.Transaction().add(
        web3.SystemProgram.transfer({ fromPubkey, toPubkey, lamports })
      );
      tx.feePayer = fromPubkey;
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;

      const progress = showProgress('Awaiting Phantom signature…');

      const signed = await phantom.signTransaction(tx);
      progress.update('Broadcasting to Solana devnet…');

      const sig = await connection.sendRawTransaction(signed.serialize());
      progress.update('Confirming on-chain…');

      await connection.confirmTransaction(sig, 'confirmed');
      progress.close();

      const explorerUrl =
        CONFIG.explorerBase + '/tx/' + sig + '?cluster=' + CONFIG.cluster;
      logActivity(
        '💎 ' + shortAddr(walletPubkey) + ' patronized ' + amountSol + ' SOL',
        explorerUrl
      );
      showSuccessToast(explorerUrl, amountSol);
      return { signature: sig, explorerUrl };
    } catch (err) {
      console.error('[AuraSci] Patronage failed:', err);
      alert('Patronage failed: ' + (err.message || err));
    }
  }

  // ── UI: progress overlay + success toast ─────────────────────────────
  function showProgress(msg) {
    const wrap = document.createElement('div');
    wrap.className = 'aura-progress-overlay';
    wrap.style.cssText =
      'position:fixed;inset:0;background:rgba(20,15,10,0.65);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(6px);';
    wrap.innerHTML =
      '<div style="background:#f5ede0;border-radius:12px;padding:32px 40px;font-family:\'JetBrains Mono\',monospace;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3)">' +
      '<div style="width:32px;height:32px;border:3px solid #cc5d35;border-top-color:transparent;border-radius:50%;animation:auraspin 0.8s linear infinite;margin:0 auto 16px"></div>' +
      '<div class="aura-progress-msg" style="color:#3a2418;font-size:14px;font-weight:500">' +
      msg +
      '</div>' +
      '<div style="margin-top:8px;color:#a08070;font-size:11px">Devnet · Solana</div></div>' +
      '<style>@keyframes auraspin { to { transform: rotate(360deg); } }</style>';
    document.body.appendChild(wrap);
    return {
      update: function (m) {
        const el = wrap.querySelector('.aura-progress-msg');
        if (el) el.textContent = m;
      },
      close: function () {
        wrap.remove();
      },
    };
  }

  function showSuccessToast(explorerUrl, amountSol) {
    const toast = document.createElement('div');
    toast.style.cssText =
      'position:fixed;bottom:32px;right:32px;background:linear-gradient(135deg,#1f8a4e,#0f6638);color:#fff;padding:18px 24px;border-radius:12px;font-family:\'JetBrains Mono\',monospace;font-size:13px;box-shadow:0 12px 40px rgba(31,138,78,0.4);z-index:99999;max-width:380px;';
    toast.innerHTML =
      '<div style="font-weight:700;margin-bottom:4px">✓ Patronage confirmed on Solana</div>' +
      '<div style="opacity:0.9;font-size:11px">' +
      amountSol +
      ' SOL transferred · devnet</div>' +
      '<a href="' +
      explorerUrl +
      '" target="_blank" style="color:#fff;text-decoration:underline;font-size:11px;display:inline-block;margin-top:8px">View on Solana Explorer ↗</a>';
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.style.transition = 'opacity 0.4s, transform 0.4s';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(function () {
        toast.remove();
      }, 400);
    }, 8000);
  }

  function logActivity(message, explorerUrl) {
    const feed = document.querySelector(
      '.activity-feed, [data-activity-feed], .feed-list'
    );
    if (!feed) {
      console.log('[AuraSci]', message, explorerUrl || '');
      return;
    }
    const row = document.createElement('div');
    row.className = 'feed-row';
    row.style.cssText =
      'padding:8px 0;border-bottom:1px solid rgba(204,93,53,0.15);font-family:JetBrains Mono, monospace;font-size:11px;color:#3a2418';
    if (explorerUrl) {
      row.innerHTML =
        message +
        ' · <a href="' +
        explorerUrl +
        '" target="_blank" style="color:#cc5d35">view tx ↗</a>';
    } else {
      row.textContent = message;
    }
    feed.insertBefore(row, feed.firstChild);
  }

  // ── Hook the "Fund this research" button ─────────────────────────────
  function hookFundButton() {
    document.querySelectorAll('button, .fund-cta').forEach((btn) => {
      if (btn.dataset.auraFundHooked) return;
      const txt = (btn.textContent || '').trim();
      if (!/Fund this research/i.test(txt)) return;
      btn.dataset.auraFundHooked = '1';
      btn.addEventListener(
        'click',
        function (e) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          sendPatronage(CONFIG.demoPatronageSol);
        },
        true
      );

      // Inline hint badge so user knows it's a real Solana action
      if (!btn.dataset.auraFundBadged) {
        const badge = document.createElement('div');
        badge.style.cssText =
          'margin-top:8px;font-family:JetBrains Mono, monospace;font-size:10px;color:#1f8a4e;text-align:center';
        badge.innerHTML =
          '⚡ Real Solana devnet · ' +
          CONFIG.demoPatronageSol +
          ' SOL demo transfer';
        btn.insertAdjacentElement('afterend', badge);
        btn.dataset.auraFundBadged = '1';
      }
    });
  }

  // ── Onboarding: make GitHub / ORCID cards click-to-connect (mock demo) ─
  let onboardingHooked = false;
  function hookOnboardingOAuth() {
    if (onboardingHooked) return;
    onboardingHooked = true;

    document.addEventListener(
      'click',
      function (e) {
        const btn = e.target.closest('[data-connect="github"], [data-connect="orcid"]');
        if (!btn) return;
        e.preventDefault();

        const kind = btn.dataset.connect;
        const label = btn.querySelector('.b, .oauth-meta .b, [class="b"]');
        const okMark = btn.querySelector('.ok');

        if (btn.dataset.auraConnected === '1') {
          // Toggle disconnect
          btn.dataset.auraConnected = '';
          btn.style.borderColor = '';
          btn.style.background = '';
          if (label) label.textContent = 'click to connect (demo)';
          if (okMark) okMark.style.opacity = '';
          // Hide handle line
          const handle = document.getElementById('conn-handle');
          if (handle) handle.style.display = 'none';
        } else {
          // Mark connected
          btn.dataset.auraConnected = '1';
          btn.style.borderColor = '#1f8a4e';
          btn.style.background = 'rgba(31,138,78,0.06)';
          if (label) {
            const handleText =
              kind === 'github'
                ? '@your_lab · connected (demo)'
                : 'ORCID 0000-0002-1825-0097 · connected (demo)';
            label.textContent = handleText;
          }
          if (okMark) okMark.style.opacity = '1';
          // Show the green "Connected · @handle · ORCID …" line
          const handle = document.getElementById('conn-handle');
          if (handle) {
            handle.style.display = 'flex';
            handle.style.color = '#1f8a4e';
            handle.textContent =
              kind === 'github'
                ? '✓ Connected · @your_lab (demo) — reviewed by AuraSci Council within 48 h'
                : '✓ Connected · ORCID 0000-0002-1825-0097 (demo) — reviewed by AuraSci Council within 48 h';
          }
        }
      },
      true
    );
  }

  // ── Boot ─────────────────────────────────────────────────────────────
  function boot() {
    purgeOldInjections(); // remove any old .aura-wallet-btn from previous deploys
    renderAuthButton(); // render Login or wallet address
    hookModalWalletOption(); // wire modal's "Connect wallet" to real Phantom (capture)
    hookFundButton(); // wire "Fund this research" to devnet transfer
    hookOnboardingOAuth(); // GitHub/ORCID cards become click-to-connect demo

    // Re-run on DOM changes (modal opening, etc.)
    const observer = new MutationObserver(function () {
      purgeOldInjections();
      renderAuthButton();
      hookFundButton();
      // hookModalWalletOption + hookOnboardingOAuth are document-level capture,
      // installed once — they don't need re-running.
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
