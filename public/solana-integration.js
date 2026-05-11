/* AuraSci × Solana — Phantom wallet + devnet USDC/SOL patronage
 * Adds a real, on-chain Solana flow to the demo:
 *   1. "Connect Wallet" button in nav (Phantom)
 *   2. Persistent wallet pill showing short address
 *   3. "Fund this research" button → real SOL transfer on devnet
 *   4. Activity feed entry with clickable Solana Explorer link
 *
 * No backend required. All transactions are on Solana devnet.
 */
(function () {
  'use strict';

  // ── Configuration ────────────────────────────────────────────────────
  const CONFIG = {
    cluster: 'devnet',
    rpcUrl: 'https://api.devnet.solana.com',
    // Demo "escrow" wallet — patronage goes here on devnet (a dummy address).
    // Replace with the program PDA once Anchor program is deployed.
    escrowWallet: 'AuRAsCiDemoEscrow11111111111111111111111111', // 32-byte base58, will fallback if invalid
    fallbackEscrow: '11111111111111111111111111111112', // System program (always valid, won't fail on devnet)
    // 1 SOL = 1e9 lamports. Demo patronage = 0.001 SOL ≈ $0.10
    demoPatronageLamports: 1_000_000,
    explorerBase: 'https://explorer.solana.com',
  };

  // ── Solana web3.js loader (from CDN) ────────────────────────────────
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

  // ── Phantom wallet detection ────────────────────────────────────────
  function getPhantom() {
    if ('phantom' in window) return window.phantom?.solana;
    if (window.solana?.isPhantom) return window.solana;
    return null;
  }

  // ── Wallet state ────────────────────────────────────────────────────
  let walletPubkey = null;

  function shortAddr(pk) {
    const s = pk.toString();
    return s.slice(0, 4) + '…' + s.slice(-4);
  }

  // ── UI: Connect button / wallet pill ────────────────────────────────
  function injectWalletButton() {
    if (document.querySelector('.aura-wallet-btn')) return; // already injected

    // Try multiple nav selectors (different pages use different structures)
    let navLinks = document.querySelector('.nav-links')
      || document.querySelector('nav .links')
      || document.querySelector('nav > .links')
      || document.querySelector('nav div.links')
      || document.querySelector('header nav');

    // If still nothing, attach as a floating button so the user always sees it
    let floating = false;
    if (!navLinks) {
      navLinks = document.createElement('div');
      navLinks.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9998;';
      document.body.appendChild(navLinks);
      floating = true;
    }

    const btn = document.createElement('button');
    btn.className = 'aura-wallet-btn';
    btn.style.cssText = `
      margin-left:14px;
      padding:8px 14px;
      border-radius:999px;
      border:1.5px solid #cc5d35;
      background:linear-gradient(135deg,#cc5d35,#a94521);
      color:#fff;
      font-family:'JetBrains Mono', ui-monospace, monospace;
      font-size:12px;
      font-weight:600;
      letter-spacing:0.02em;
      cursor:pointer;
      display:inline-flex;
      align-items:center;
      gap:6px;
      transition:transform 0.15s ease, box-shadow 0.15s ease;
    `;
    btn.onmouseenter = () => {
      btn.style.transform = 'translateY(-1px)';
      btn.style.boxShadow = '0 4px 16px rgba(204,93,53,0.35)';
    };
    btn.onmouseleave = () => {
      btn.style.transform = 'none';
      btn.style.boxShadow = 'none';
    };
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="18" cy="12" r="1.5" fill="currentColor"/></svg><span class="wbtn-text">Connect Wallet</span>';
    btn.onclick = handleConnectClick;
    navLinks.appendChild(btn);

    // Restore previous connection from localStorage
    const cached = localStorage.getItem('aurasci.wallet.addr');
    if (cached) {
      walletPubkey = cached;
      updateWalletButton();
    }
  }

  function updateWalletButton() {
    const btn = document.querySelector('.aura-wallet-btn');
    if (!btn) return;
    const text = btn.querySelector('.wbtn-text');
    if (walletPubkey) {
      text.textContent = shortAddr(walletPubkey);
      btn.title = 'Click to disconnect • ' + walletPubkey;
    } else {
      text.textContent = 'Connect Wallet';
      btn.title = 'Connect Phantom wallet on Solana devnet';
    }
  }

  async function handleConnectClick() {
    if (walletPubkey) {
      // Disconnect
      try {
        const phantom = getPhantom();
        if (phantom && phantom.disconnect) await phantom.disconnect();
      } catch (_) {}
      walletPubkey = null;
      localStorage.removeItem('aurasci.wallet.addr');
      updateWalletButton();
      logActivity('🔌 Wallet disconnected', null);
      return;
    }
    // Connect
    const phantom = getPhantom();
    if (!phantom) {
      const install = confirm(
        'Phantom wallet not detected.\n\nWould you like to install Phantom now?'
      );
      if (install) window.open('https://phantom.app/', '_blank');
      return;
    }
    try {
      const resp = await phantom.connect();
      walletPubkey = resp.publicKey.toString();
      localStorage.setItem('aurasci.wallet.addr', walletPubkey);
      updateWalletButton();
      logActivity('🟢 Wallet connected · ' + shortAddr(walletPubkey), null);
    } catch (err) {
      console.error('[AuraSci] Connect failed:', err);
      alert('Failed to connect wallet: ' + (err.message || err));
    }
  }

  // ── Patronage transaction (real Solana devnet) ──────────────────────
  async function sendPatronage(amountSol) {
    const phantom = getPhantom();
    if (!phantom) {
      alert('Please install Phantom wallet first.\n\nVisit phantom.app');
      return;
    }
    if (!walletPubkey) {
      const ok = confirm('You need to connect your Phantom wallet first.\n\nConnect now?');
      if (ok) await handleConnectClick();
      if (!walletPubkey) return;
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

      // Use a deterministic devnet "escrow" address. For demo, use a derived
      // address. Anchor PDA will replace this once program is deployed.
      let toPubkey;
      try {
        toPubkey = new web3.PublicKey(CONFIG.escrowWallet);
      } catch {
        // The "AuRAsCiDemoEscrow…" is illustrative; fallback to system program (valid base58)
        toPubkey = new web3.PublicKey(CONFIG.fallbackEscrow);
      }

      const lamports = Math.round(amountSol * web3.LAMPORTS_PER_SOL);

      const tx = new web3.Transaction().add(
        web3.SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports,
        })
      );
      tx.feePayer = fromPubkey;
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;

      // Show progress UI
      const progress = showProgress('Awaiting Phantom signature…');

      const signed = await phantom.signTransaction(tx);
      progress.update('Broadcasting to Solana devnet…');

      const sig = await connection.sendRawTransaction(signed.serialize());
      progress.update('Confirming on-chain… (this takes ~1s)');

      await connection.confirmTransaction(sig, 'confirmed');
      progress.close();

      const explorerUrl =
        CONFIG.explorerBase + '/tx/' + sig + '?cluster=' + CONFIG.cluster;
      logActivity(
        '💎 ' + shortAddr(walletPubkey) + ' patronized ' + amountSol + ' SOL on devnet',
        explorerUrl
      );
      showSuccessToast(explorerUrl, amountSol);
      return { signature: sig, explorerUrl };
    } catch (err) {
      console.error('[AuraSci] Patronage failed:', err);
      alert('Patronage failed: ' + (err.message || err));
    }
  }

  // ── Progress & success UI ──────────────────────────────────────────
  function showProgress(msg) {
    const wrap = document.createElement('div');
    wrap.className = 'aura-progress-overlay';
    wrap.style.cssText = `
      position:fixed;inset:0;background:rgba(20,15,10,0.65);
      display:flex;align-items:center;justify-content:center;z-index:99999;
      backdrop-filter:blur(6px);
    `;
    wrap.innerHTML = `
      <div style="background:#f5ede0;border-radius:12px;padding:32px 40px;font-family:'JetBrains Mono',monospace;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
        <div class="aura-spinner" style="width:32px;height:32px;border:3px solid #cc5d35;border-top-color:transparent;border-radius:50%;animation:auraspin 0.8s linear infinite;margin:0 auto 16px"></div>
        <div class="aura-progress-msg" style="color:#3a2418;font-size:14px;font-weight:500">${msg}</div>
        <div style="margin-top:8px;color:#a08070;font-size:11px">Devnet · ${CONFIG.cluster}</div>
      </div>
      <style>@keyframes auraspin { to { transform: rotate(360deg); } }</style>
    `;
    document.body.appendChild(wrap);
    return {
      update: (m) => {
        const el = wrap.querySelector('.aura-progress-msg');
        if (el) el.textContent = m;
      },
      close: () => wrap.remove(),
    };
  }

  function showSuccessToast(explorerUrl, amountSol) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position:fixed;bottom:32px;right:32px;
      background:linear-gradient(135deg,#1f8a4e,#0f6638);
      color:#fff;padding:18px 24px;border-radius:12px;
      font-family:'JetBrains Mono',monospace;font-size:13px;
      box-shadow:0 12px 40px rgba(31,138,78,0.4);
      z-index:99999;max-width:380px;
    `;
    toast.innerHTML = `
      <div style="font-weight:700;margin-bottom:4px">✓ Patronage confirmed on Solana</div>
      <div style="opacity:0.9;font-size:11px">${amountSol} SOL transferred · devnet</div>
      <a href="${explorerUrl}" target="_blank" style="color:#fff;text-decoration:underline;font-size:11px;display:inline-block;margin-top:8px">View on Solana Explorer ↗</a>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity 0.4s, transform 0.4s';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => toast.remove(), 400);
    }, 8000);
  }

  // ── Activity feed log (best-effort, sticks where it can) ──────────
  function logActivity(message, explorerUrl) {
    const feed = document.querySelector('.activity-feed, [data-activity-feed], .feed-list');
    if (!feed) {
      console.log('[AuraSci]', message, explorerUrl || '');
      return;
    }
    const row = document.createElement('div');
    row.className = 'feed-row';
    row.style.cssText = 'padding:8px 0;border-bottom:1px solid rgba(204,93,53,0.15);font-family:JetBrains Mono, monospace;font-size:11px;color:#3a2418';
    if (explorerUrl) {
      row.innerHTML = `${message} · <a href="${explorerUrl}" target="_blank" style="color:#cc5d35">view tx ↗</a>`;
    } else {
      row.textContent = message;
    }
    feed.insertBefore(row, feed.firstChild);
  }

  // ── Hook into existing "Fund this research" button ─────────────────
  function hookFundButton() {
    const fundButtons = document.querySelectorAll('.fund-cta, [data-fund-cta], button');
    fundButtons.forEach((btn) => {
      const txt = (btn.textContent || '').trim();
      if (!/^Fund this research/i.test(txt)) return;
      if (btn.dataset.auraHooked) return;
      btn.dataset.auraHooked = '1';

      // Override click handler
      btn.addEventListener(
        'click',
        async (e) => {
          e.preventDefault();
          e.stopPropagation();
          // Look for amount input
          const amtInput = document.querySelector(
            '.fund-amount-input, input[placeholder*="USDC"], input[type="text"][value]'
          );
          let usdc = 100;
          if (amtInput && amtInput.value) {
            const n = parseFloat(amtInput.value.replace(/[^0-9.]/g, ''));
            if (n > 0) usdc = n;
          }
          // Demo conversion: 1 USDC ≈ 1/$200 SOL (purely visual; devnet SOL is free)
          // For demo, always transfer a fixed small SOL amount regardless of input
          const solAmount = 0.001;
          await sendPatronage(solAmount);
        },
        true
      );

      // Add a small Solana hint badge under the button
      if (!btn.dataset.auraBadged) {
        const badge = document.createElement('div');
        badge.style.cssText =
          'margin-top:8px;font-family:JetBrains Mono, monospace;font-size:10px;color:#1f8a4e;text-align:center';
        badge.innerHTML =
          '⚡ Powered by Solana · devnet · ~0.001 SOL demo transfer';
        btn.insertAdjacentElement('afterend', badge);
        btn.dataset.auraBadged = '1';
      }
    });
  }

  // ── Boot ───────────────────────────────────────────────────────────
  function boot() {
    injectWalletButton();
    hookFundButton();
    // Listen for dynamic content changes
    const observer = new MutationObserver(() => {
      injectWalletButton();
      hookFundButton();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
