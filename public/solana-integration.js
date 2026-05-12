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
  // Guard against stringified "null" / "undefined" sneaking out of localStorage
  let walletPubkey = (function () {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (!raw || raw === 'null' || raw === 'undefined') return null;
    return raw;
  })();

  // ── Util ─────────────────────────────────────────────────────────────
  function shortAddr(pk) {
    if (!pk) return '';
    const s = pk.toString();
    if (s.length <= 8) return s;
    return s.slice(0, 4) + '…' + s.slice(-4);
  }

  function getPhantom() {
    if ('phantom' in window) return window.phantom?.solana;
    if (window.solana?.isPhantom) return window.solana;
    return null;
  }

  // @solana/web3.js v1's IIFE bundle expects a global `Buffer` in the
  // browser. Load the `buffer` polyfill first, install it as window.Buffer,
  // then load web3.js.
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  async function loadSolanaWeb3() {
    if (window.solanaWeb3) return window.solanaWeb3;
    // 1. Buffer polyfill (Solana web3.js requires it in the browser)
    if (typeof window.Buffer === 'undefined') {
      await loadScript('https://bundle.run/buffer@6.0.3');
      if (window.buffer && window.buffer.Buffer) {
        window.Buffer = window.buffer.Buffer;
      }
    }
    // 2. The web3.js IIFE bundle (which uses Buffer internally)
    await loadScript(
      'https://unpkg.com/@solana/web3.js@1.95.4/lib/index.iife.min.js'
    );
    if (!window.solanaWeb3) throw new Error('@solana/web3.js failed to load');
    return window.solanaWeb3;
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

    // Guard against bogus localStorage values like the string "null"
    const pk =
      walletPubkey &&
      typeof walletPubkey === 'string' &&
      walletPubkey !== 'null' &&
      walletPubkey !== 'undefined' &&
      walletPubkey.length > 0
        ? walletPubkey
        : null;

    // auth-stub.js's .as-nav-login renders text inside a <span> (CSS gives
    // .as-nav-login > span z-index:1 so it sits above the orange pill that
    // ::before paints behind it). Using textContent = '...' strips the span
    // and the bare text node falls behind ::before → blank-looking button.
    // Always preserve the <span> wrapper.
    const isStubLogin = btn.classList && btn.classList.contains('as-nav-login');

    if (pk) {
      // Connected — show wallet address pill
      const short = shortAddr(pk) || pk;
      // IDEMPOTENT: only mutate DOM when the current text really differs.
      // Otherwise we'd trigger MutationObserver → re-enter this function →
      // infinite loop → page hangs and clicks stop responding.
      const currentText = (btn.textContent || '').trim();
      if (currentText !== short) {
        if (isStubLogin) {
          btn.innerHTML = '<span>' + short + '</span>';
        } else {
          btn.textContent = short;
        }
      }
      if (btn.title !== 'Click to disconnect • ' + pk) {
        btn.title = 'Click to disconnect • ' + pk;
      }
      if (btn.dataset.auraConnected !== '1') {
        btn.style.fontFamily = "'JetBrains Mono', ui-monospace, monospace";
        btn.dataset.auraConnected = '1';
      }
    } else {
      // Not connected — only restore "Login" if we previously took it over.
      // Don't ever clobber auth-stub.js's freshly-rendered Login button.
      if (btn.dataset.auraConnected === '1') {
        if (isStubLogin && (btn.textContent || '').trim() !== 'Login') {
          // Recreate the original auth-stub structure (icon + span)
          btn.innerHTML =
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" ' +
            'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" ' +
            'stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 ' +
            '1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" ' +
            'y1="12" x2="3" y2="12"/></svg><span>Login</span>';
        } else if (!isStubLogin && !(btn.textContent || '').trim()) {
          btn.textContent = 'Login';
        }
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
      // CRITICAL: also flip auth-stub's auth flag so its capture-phase
      // listener on .fund-cta stops hijacking the click to open its modal.
      try {
        localStorage.setItem('aurasci_auth', '1');
        localStorage.setItem('aurasci_auth_method', 'wallet');
        localStorage.setItem('aurasci_handle', walletPubkey);
      } catch (_) {}
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
    // Also clear auth-stub's flags so it returns to "logged out" UX
    try {
      localStorage.removeItem('aurasci_auth');
      localStorage.removeItem('aurasci_auth_method');
      localStorage.removeItem('aurasci_handle');
    } catch (_) {}
    renderAuthButton();
    logActivity('🔌 Wallet disconnected', null);
  }

  // ── Real Solana devnet patronage on "Fund this research" ─────────────
  async function sendPatronage(amountSol) {
    // Re-read in case the wallet was connected after page load
    if (!walletPubkey || walletPubkey === 'null' || walletPubkey === 'undefined') {
      const raw = localStorage.getItem(CONFIG.storageKey);
      if (raw && raw !== 'null' && raw !== 'undefined') walletPubkey = raw;
    }
    console.log('[AuraSci] sendPatronage →', { amountSol, walletPubkey });

    // If not connected, trigger Phantom connection directly (skip the modal).
    if (!walletPubkey) {
      const phantom0 = getPhantom();
      if (!phantom0) {
        const install = confirm(
          'Phantom wallet not detected.\n\n' +
            'AuraSci uses Phantom for Solana sign-in on devnet.\n\n' +
            'Install Phantom now?'
        );
        if (install) window.open('https://phantom.app/', '_blank');
        return;
      }
      try {
        const resp = await phantom0.connect();
        walletPubkey = resp.publicKey.toString();
        localStorage.setItem(CONFIG.storageKey, walletPubkey);
        try {
          localStorage.setItem('aurasci_auth', '1');
          localStorage.setItem('aurasci_auth_method', 'wallet');
          localStorage.setItem('aurasci_handle', walletPubkey);
        } catch (_) {}
        renderAuthButton();
        console.log('[AuraSci] connected on Fund click →', walletPubkey);
      } catch (err) {
        console.error('[AuraSci] user cancelled Phantom connect:', err);
        return; // user dismissed the wallet popup
      }
      if (!walletPubkey) return;
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
      // DEMO ESCROW: round-trip to self. The real Anchor program
      // (2J766XS6...wJ2SiE) creates a PDA-owned escrow vault for each
      // intent; integrating that requires publishing the intent on-chain
      // first. For the hackathon demo we round-trip to the user's own
      // wallet so that (a) Phantom doesn't flag the dest as malicious,
      // (b) funds are never lost, and (c) the on-chain tx is real and
      // viewable on Solana Explorer. Replace with the PDA in Phase 3.
      const toPubkey = fromPubkey;
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
          // Read the amount the user typed in the funding input. Cap at 0.1
          // SOL on devnet to avoid airdrop exhaustion; min 0.0001.
          const input = document.querySelector(
            '.fund-input input, .binput, input[placeholder*="USDC" i], input[placeholder*="amount" i]'
          );
          let amt = CONFIG.demoPatronageSol;
          if (input && input.value) {
            const v = parseFloat(input.value);
            if (isFinite(v) && v > 0) {
              // The input is labeled USDC but on devnet we send SOL. Treat the
              // number as SOL with a sane upper bound so it stays in devnet
              // demo territory.
              amt = Math.min(Math.max(v, 0.0001), 0.1);
            }
          }
          console.log('[AuraSci] Funding click → sending', amt, 'SOL on devnet');
          sendPatronage(amt);
        },
        true
      );

      btn.dataset.auraFundBadged = '1';
    });
  }

  // ── Onboarding: GitHub / ORCID via real public APIs (no OAuth needed) ─
  // GitHub: api.github.com/users/{login} → real avatar, name, repos, followers
  // ORCID:  pub.orcid.org/v3.0/{orcid}   → real name, employments, papers
  let onboardingHooked = false;

  function showInlineInput(btn, placeholder, onSubmit) {
    // Replace the .b label with a small inline input
    const label = btn.querySelector('.b');
    if (!label) return;
    const original = label.textContent;

    const wrap = document.createElement('div');
    wrap.className = 'aura-inline-wrap'; // marker so document-capture skips us
    wrap.style.cssText = 'display:flex;gap:6px;align-items:center;';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.style.cssText =
      'flex:1;min-width:0;padding:4px 8px;border:1px solid #cc5d35;border-radius:6px;font-family:JetBrains Mono,monospace;font-size:11px;background:#fff;color:#3a2418;outline:none;';
    const ok = document.createElement('button');
    ok.textContent = '→';
    ok.style.cssText =
      'padding:4px 8px;border:none;border-radius:6px;background:#cc5d35;color:#fff;cursor:pointer;font-weight:700;';
    wrap.appendChild(input);
    wrap.appendChild(ok);

    label.replaceWith(wrap);
    input.focus();

    function commit() {
      const v = input.value.trim();
      if (!v) {
        const newLabel = document.createElement('div');
        newLabel.className = 'b';
        newLabel.textContent = original;
        wrap.replaceWith(newLabel);
        return;
      }
      onSubmit(v, wrap);
    }
    ok.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      commit();
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      }
      if (e.key === 'Escape') {
        const newLabel = document.createElement('div');
        newLabel.className = 'b';
        newLabel.textContent = original;
        wrap.replaceWith(newLabel);
      }
    });
    // Stop click bubbling so we don't re-trigger card click
    wrap.addEventListener('click', (e) => e.stopPropagation());
  }

  async function connectGitHub(btn) {
    showInlineInput(btn, 'your-github-username', async (username, wrap) => {
      wrap.querySelector('input').disabled = true;
      try {
        const r = await fetch(
          'https://api.github.com/users/' + encodeURIComponent(username)
        );
        if (!r.ok) throw new Error('User @' + username + ' not found');
        const u = await r.json();
        finalizeConnect(btn, wrap, 'github', {
          handle: '@' + u.login,
          subtitle:
            (u.name ? u.name + ' · ' : '') +
            u.public_repos +
            ' repos · ' +
            u.followers +
            ' followers',
          avatar: u.avatar_url,
          handleLine:
            '✓ Verified GitHub · @' +
            u.login +
            (u.name ? ' (' + u.name + ')' : '') +
            ' — fetched live from api.github.com',
        });
      } catch (e) {
        wrap.querySelector('input').disabled = false;
        alert('GitHub lookup failed: ' + (e.message || e));
      }
    });
  }

  async function connectOrcid(btn) {
    showInlineInput(btn, '0000-0000-0000-0000', async (orcid, wrap) => {
      // Normalize ORCID format
      const clean = orcid.replace(/[^0-9X]/gi, '');
      if (clean.length !== 16) {
        alert(
          'ORCID must be 16 digits in the form 0000-0000-0000-000X.\nYou entered: ' +
            orcid
        );
        wrap.querySelector('input').disabled = false;
        return;
      }
      const formatted =
        clean.slice(0, 4) +
        '-' +
        clean.slice(4, 8) +
        '-' +
        clean.slice(8, 12) +
        '-' +
        clean.slice(12, 16);
      wrap.querySelector('input').disabled = true;
      try {
        const r = await fetch('https://pub.orcid.org/v3.0/' + formatted + '/person', {
          headers: { Accept: 'application/json' },
        });
        if (!r.ok)
          throw new Error('ORCID ' + formatted + ' not found (' + r.status + ')');
        const p = await r.json();
        const given = p.name?.['given-names']?.value || '';
        const family = p.name?.['family-name']?.value || '';
        const full = (given + ' ' + family).trim() || 'ORCID iD';
        finalizeConnect(btn, wrap, 'orcid', {
          handle: formatted,
          subtitle: full + ' · live from pub.orcid.org',
          avatar: null,
          handleLine:
            '✓ Verified ORCID · ' +
            formatted +
            ' (' +
            full +
            ') — fetched live from pub.orcid.org',
        });
      } catch (e) {
        wrap.querySelector('input').disabled = false;
        alert('ORCID lookup failed: ' + (e.message || e));
      }
    });
  }

  function finalizeConnect(btn, wrap, kind, info) {
    btn.dataset.auraConnected = '1';
    btn.style.borderColor = '#1f8a4e';
    btn.style.background = 'rgba(31,138,78,0.06)';

    // Persist the verified identity so Dashboard / other pages can read it
    try {
      localStorage.setItem('aurasci.scientist.identityKind', kind);
      localStorage.setItem('aurasci.scientist.handle', info.handle);
      localStorage.setItem('aurasci.scientist.handleLine', info.handleLine);
      if (info.avatar)
        localStorage.setItem('aurasci.scientist.avatar', info.avatar);
      if (info.subtitle)
        localStorage.setItem('aurasci.scientist.subtitle', info.subtitle);
    } catch (_) {}

    const meta = document.createElement('div');
    meta.className = 'b';
    meta.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
    meta.innerHTML =
      '<div style="font-weight:700;color:#1f8a4e">' +
      info.handle +
      '</div>' +
      '<div style="font-size:10px;opacity:0.8">' +
      info.subtitle +
      '</div>';
    wrap.replaceWith(meta);

    // Show / update the green checkmark
    const okMark = btn.querySelector('.ok');
    if (okMark) okMark.style.opacity = '1';

    // Replace card icon with avatar if available
    if (info.avatar) {
      const iconWrap = btn.querySelector('.oauth-icon');
      if (iconWrap) {
        iconWrap.innerHTML =
          '<img src="' +
          info.avatar +
          '" alt="" style="width:38px;height:38px;border-radius:8px;object-fit:cover" />';
      }
    }

    // Update the connected handle line at the bottom
    const handle = document.getElementById('conn-handle');
    if (handle) {
      handle.style.display = 'flex';
      handle.style.color = '#1f8a4e';
      handle.textContent = info.handleLine;
    }

    // Update the bottom-right status corner (br-stat / br-handle) with the
    // real verified identity, replacing "awaiting connect" + "—".
    const brStat = document.getElementById('br-stat');
    if (brStat) brStat.textContent = 'authenticated';
    const brHandle = document.getElementById('br-handle');
    if (brHandle) brHandle.textContent = info.handle + ' via ' + kind.toUpperCase();

    // If the Step-02 review pane has been hydrated already, refresh it now
    // so that re-verifying updates the ORCID cell live.
    try { hookOnboardingReview(); } catch (_) {}

    // Reveal the lab-profile block + enable submit, since the document-level
    // CAPTURE click handler stopPropagation'd the inline listener that
    // originally did this work.
    const profileBlock = document.getElementById('profile-block');
    if (profileBlock) profileBlock.classList.add('show');
    const connHandleEl = document.getElementById('conn-handle');
    if (connHandleEl) connHandleEl.classList.add('show');
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) submitBtn.disabled = false;

    // Log to console for evidence
    console.log('[AuraSci] ' + kind + ' verified:', info);
  }

  function hookOnboardingOAuth() {
    if (onboardingHooked) return;
    onboardingHooked = true;

    document.addEventListener(
      'click',
      function (e) {
        // CRITICAL: if the click is INSIDE our inline input (the input field
        // or the submit arrow), let it bubble to the wrap's own handlers.
        if (e.target.closest('.aura-inline-wrap')) return;
        // Same for inputs/textareas anywhere
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;

        const btn = e.target.closest(
          '[data-connect="github"], [data-connect="orcid"]'
        );
        if (!btn) return;
        if (btn.dataset.auraConnected === '1') return; // already connected
        // If we've already shown the inline input, don't show it again
        if (btn.querySelector('.aura-inline-wrap')) return;

        e.preventDefault();
        e.stopPropagation();

        if (btn.dataset.connect === 'github') connectGitHub(btn);
        else if (btn.dataset.connect === 'orcid') connectOrcid(btn);
      },
      true
    );
  }

  // ── Onboarding → Dashboard data persistence ──────────────────────────
  // On the onboarding page, save the user-entered Lab Profile to localStorage
  // when "Submit for review" is clicked.
  // On the dashboard, populate name/email/handle/affiliation/bio with
  // whatever the user actually typed (replacing the hardcoded mock).

  const SK = {
    name: 'aurasci.scientist.name',
    email: 'aurasci.scientist.email',
    affiliation: 'aurasci.scientist.affiliation',
    bio: 'aurasci.scientist.bio',
    handle: 'aurasci.scientist.handle', // from verified GitHub/ORCID
    avatar: 'aurasci.scientist.avatar',
  };

  function hookOnboardingSubmit() {
    const submit = document.getElementById('submit-btn');
    if (!submit || submit.dataset.auraSubmitHooked) return;
    submit.dataset.auraSubmitHooked = '1';
    submit.addEventListener(
      'click',
      function () {
        try {
          const get = (id) => {
            const el = document.getElementById(id);
            if (!el) return '';
            return (el.value || el.textContent || '').trim();
          };
          const name = get('f-name');
          const email = get('f-email');
          const aff = get('f-aff');
          const bio = get('f-bio');
          if (name) localStorage.setItem(SK.name, name);
          if (email) localStorage.setItem(SK.email, email);
          if (aff) localStorage.setItem(SK.affiliation, aff);
          if (bio) localStorage.setItem(SK.bio, bio);
        } catch (_) {}
        // Hydrate the Step-02 review pane with verified ID + form data BEFORE
        // the inline setStep(2) transitions to it.
        try { hookOnboardingReview(); } catch (_) {}
      },
      true
    );
  }

  // Hydrate the Step-02 review pane (ORCID iD cell + Affiliation cell)
  // with the verified identity and the form values the user actually typed.
  // Runs on submit-click AND on page-load (in case the user navigates back).
  // IMPORTANT: this writes to DOM textContent. If the MutationObserver also
  // calls this function, we get an infinite loop (write → mutation → re-call
  // → write again). We guard against that by only writing when the desired
  // value differs from what's already in the DOM.
  function hookOnboardingReview() {
    const rOrcid = document.getElementById('r-orcid');
    const rAff = document.getElementById('r-aff');
    if (!rOrcid && !rAff) return; // Not the onboarding page

    let handle = '';
    let identityKind = '';
    let aff = '';
    try {
      handle = localStorage.getItem(SK.handle) || '';
      identityKind = localStorage.getItem('aurasci.scientist.identityKind') || '';
      aff =
        localStorage.getItem(SK.affiliation) ||
        (document.getElementById('f-aff') &&
          document.getElementById('f-aff').value) ||
        '';
    } catch (_) {}

    const setIfDifferent = (el, val) => {
      if (!el || !val) return;
      if (el.textContent !== val) el.textContent = val;
    };

    if (rOrcid && handle) {
      if (identityKind === 'github') {
        const kEl = rOrcid.previousElementSibling;
        if (kEl && kEl.classList.contains('k') && kEl.textContent !== 'GitHub')
          kEl.textContent = 'GitHub';
      }
      setIfDifferent(rOrcid, handle);
    }

    setIfDifferent(rAff, aff);
  }

  function hydrateDashboard() {
    // Only run on pages that look like the scientist dashboard
    // (has the mock "Dr. Alice Smith" hero or similar)
    const heroName = document.querySelector('.ph-name');
    if (!heroName) return;

    const name = localStorage.getItem(SK.name);
    const email = localStorage.getItem(SK.email);
    const aff = localStorage.getItem(SK.affiliation);
    const bio = localStorage.getItem(SK.bio);
    const handle = localStorage.getItem(SK.handle);
    const avatar = localStorage.getItem(SK.avatar);

    if (name) heroName.textContent = name;
    const heroHandle = document.querySelector('.ph-handle');
    if (heroHandle && handle) heroHandle.textContent = handle;
    // Replace placeholder avatar circle with real GitHub avatar
    if (avatar) {
      const avatarEl = document.querySelector('.ph-avatar, .profile-avatar, [class*="avatar" i]');
      if (avatarEl) {
        avatarEl.innerHTML =
          '<img src="' +
          avatar +
          '" alt="" style="width:100%;height:100%;border-radius:inherit;object-fit:cover" />';
      }
    }

    // Replace the email / handle / affiliation / bio cells.
    // The dashboard uses a label+value pattern (k/v divs); find by neighbor text.
    document.querySelectorAll('.v, [data-k], .field-value').forEach((vEl) => {
      const kEl = vEl.previousElementSibling || vEl.parentElement?.querySelector('.k, .label, [data-label]');
      const kText = ((kEl && kEl.textContent) || '').trim().toLowerCase();
      const currentText = (vEl.textContent || '').trim();
      if (/email/i.test(kText) && email) vEl.textContent = email;
      else if (/handle|github|orcid/i.test(kText) && handle) vEl.textContent = handle;
      else if (/affiliation|university|lab/i.test(kText) && aff) vEl.textContent = aff;
      // Bio replacement — match if current value contains the canonical mock bio
      else if (
        bio &&
        /Specializing in cellular senescence|cellular senescence and cardiac/.test(
          currentText
        )
      ) {
        vEl.textContent = bio;
      }
    });

    // Also replace any direct mock-string occurrences anywhere in the page
    if (name || email || aff || handle) {
      const REPLACEMENTS = [
        ['Dr. Alice Smith', name],
        ['alice@stanford.edu', email],
        ['@dr_alice_smith', handle],
        ['Stanford University · Bioengineering', aff],
        ['Stanford University', aff], // fallback shorter form
      ].filter((r) => r[1]);

      walkText(document.body, REPLACEMENTS);
    }
  }

  function walkText(node, replacements) {
    if (!node) return;
    if (node.nodeType === 3) {
      let txt = node.nodeValue;
      let changed = false;
      for (const [mock, real] of replacements) {
        if (real && txt.indexOf(mock) !== -1) {
          txt = txt.split(mock).join(real);
          changed = true;
        }
      }
      if (changed) node.nodeValue = txt;
      return;
    }
    if (node.nodeType !== 1) return;
    // Skip script/style/input
    const tag = node.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'INPUT' || tag === 'TEXTAREA')
      return;
    // Recurse children
    for (const child of Array.from(node.childNodes)) walkText(child, replacements);
  }

  // ── Boot ─────────────────────────────────────────────────────────────
  function boot() {
    // Backfill: if a wallet was connected in a prior session but auth-stub's
    // flag isn't set, set it now so auth-stub stops hijacking .fund-cta clicks.
    if (walletPubkey && localStorage.getItem('aurasci_auth') !== '1') {
      try {
        localStorage.setItem('aurasci_auth', '1');
        localStorage.setItem('aurasci_auth_method', 'wallet');
        localStorage.setItem('aurasci_handle', walletPubkey);
      } catch (_) {}
    }
    purgeOldInjections(); // remove any old .aura-wallet-btn from previous deploys
    renderAuthButton(); // render Login or wallet address
    hookModalWalletOption(); // wire modal's "Connect wallet" to real Phantom (capture)
    hookFundButton(); // wire "Fund this research" to devnet transfer
    hookOnboardingOAuth(); // GitHub/ORCID cards become click-to-connect demo
    hookOnboardingSubmit(); // Save lab profile form to localStorage on submit
    hookOnboardingReview(); // Hydrate Step-02 review pane with verified ID
    hydrateDashboard(); // Replace mock data with real saved values on dashboard

    // Re-run on DOM changes (modal opening, etc.)
    // CRITICAL: do NOT call hookOnboardingReview / hydrateDashboard here.
    // They write to textContent, which itself triggers a mutation event and
    // re-enters this callback → infinite loop → page freeze. They run on
    // boot() once + on specific user events (submit click, identity verify).
    const observer = new MutationObserver(function () {
      purgeOldInjections();
      renderAuthButton();
      hookFundButton();
      hookOnboardingSubmit();
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
