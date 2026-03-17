// NKVault Extension — Content Script
// Detects login forms, offers autofill, syncs auth, and autosaves credentials.

(function () {
  'use strict';

  const BADGE_CLASS = 'nkvault-autofill-badge';
  const DROPDOWN_CLASS = 'nkvault-dropdown';
  const SAVE_BANNER_CLASS = 'nkvault-save-banner';
  const NKVAULT_ORIGINS = ['http://localhost:5173', 'https://nkvault.app', 'https://www.nkvault.app'];

  // Track forms we've already offered to save for (avoid duplicate prompts)
  const savedForms = new Set<string>();

  // ---- Auth Sync ----
  // Listen for auth messages from NKVault web app
  window.addEventListener('message', (event) => {
    if (!NKVAULT_ORIGINS.includes(event.origin)) return;

    if (event.data?.type === 'NKVAULT_AUTH_SYNC') {
      chrome.runtime.sendMessage({
        type: 'SAVE_AUTH',
        token: event.data.token,
        refreshToken: event.data.refreshToken,
        user: event.data.user,
      });
    }

    if (event.data?.type === 'NKVAULT_VAULT_KEY_SYNC') {
      chrome.runtime.sendMessage({
        type: 'SET_VAULT_KEY',
        keyBase64: event.data.keyBase64,
      });
    }

    if (event.data?.type === 'NKVAULT_VAULT_LOCKED') {
      chrome.runtime.sendMessage({
        type: 'LOCK_VAULT',
      });
    }
  });

  // ---- Listen for autofill commands from popup ----
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'NKVAULT_AUTOFILL') {
      const passwordFields = document.querySelectorAll('input[type="password"]') as NodeListOf<HTMLInputElement>;
      let filled = false;

      passwordFields.forEach((passwordField) => {
        const form = passwordField.closest('form');
        let usernameField: HTMLInputElement | null = null;

        if (form) {
          const inputs = form.querySelectorAll('input[type="text"], input[type="email"]') as NodeListOf<HTMLInputElement>;
          for (const inp of inputs) {
            const attrs = [inp.name, inp.id, inp.autocomplete, inp.placeholder].join(' ').toLowerCase();
            if (/user|email|login|name|account/.test(attrs)) {
              usernameField = inp;
              break;
            }
          }
          if (!usernameField && inputs.length > 0) {
            usernameField = inputs[0];
          }
        }

        if (message.username && usernameField) {
          setInputValue(usernameField, message.username);
        }
        if (message.password) {
          setInputValue(passwordField, message.password);
        }
        filled = true;
      });

      sendResponse({ success: filled });
    }
    return false;
  });

  // ---- Login Form Detection + Signup Auto-Fill ----
  const autoFilledForms = new Set<HTMLFormElement>();

  function detectLoginFields() {
    const passwordFields = document.querySelectorAll('input[type="password"]');

    passwordFields.forEach((passwordField) => {
      const el = passwordField as HTMLInputElement;
      if (el.dataset.nkvaultDetected) return;
      el.dataset.nkvaultDetected = 'true';

      const form = el.closest('form');
      let usernameField: HTMLInputElement | null = null;

      if (form) {
        const inputs = form.querySelectorAll('input[type="text"], input[type="email"]');
        for (const input of inputs) {
          const inp = input as HTMLInputElement;
          const attrs = [inp.name, inp.id, inp.autocomplete, inp.placeholder].join(' ').toLowerCase();
          if (/user|email|login|name|account/.test(attrs)) {
            usernameField = inp;
            break;
          }
        }
        if (!usernameField && inputs.length > 0) {
          usernameField = inputs[0] as HTMLInputElement;
        }

        // Attach autosave listener to the form
        attachAutosaveListener(form, el, usernameField);

        // Check if this is a signup form and auto-fill it
        if (isSignupForm(form) && !autoFilledForms.has(form)) {
          autoFilledForms.add(form);
          autoFillSignupForm(form);
        }
      }

      attachBadge(el, usernameField);
    });
  }

  // ---- Signup Form Detection ----
  function isSignupForm(form: HTMLFormElement): boolean {
    // Skip NKVault's own pages
    if (NKVAULT_ORIGINS.some(o => window.location.href.startsWith(o))) return false;

    const passwordFields = form.querySelectorAll('input[type="password"]');
    const allInputs = form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"])');

    // Strong signal: 2+ password fields (password + confirm)
    if (passwordFields.length >= 2) return true;

    // Check form-level signals
    const formAttrs = [
      form.action, form.id, form.className,
      form.getAttribute('name') || '',
      form.getAttribute('data-testid') || '',
    ].join(' ').toLowerCase();
    if (/sign.?up|register|create.?account|join|enroll|onboard/i.test(formAttrs)) return true;

    // Check page-level signals
    const pageText = document.title.toLowerCase() + ' ' + window.location.href.toLowerCase();
    if (/sign.?up|register|create.?account|join/i.test(pageText)) {
      // Must have at least 3 visible inputs (name, email, password) to avoid false positives
      if (allInputs.length >= 3) return true;
    }

    // Check for registration-related input fields
    let signupSignals = 0;
    allInputs.forEach((input) => {
      const inp = input as HTMLInputElement;
      const attrs = [inp.name, inp.id, inp.autocomplete, inp.placeholder, inp.type].join(' ').toLowerCase();
      if (/first.?name|given.?name|fname/.test(attrs)) signupSignals++;
      if (/last.?name|family.?name|surname|lname/.test(attrs)) signupSignals++;
      if (/confirm.?pass|re.?enter.?pass|repeat.?pass|pass.?confirm/.test(attrs)) signupSignals++;
      if (/^(new.?password|create.?password)/.test(attrs)) signupSignals++;
    });

    // 2+ registration signals = signup form
    return signupSignals >= 2;
  }

  // ---- Auto-Fill Signup Forms ----
  async function autoFillSignupForm(form: HTMLFormElement) {
    // Request identity data and a generated password from the background
    chrome.runtime.sendMessage({ type: 'GET_SIGNUP_DATA' }, (response) => {
      if (!response || !response.identity) {
        // No identity data — just generate a password and fill password fields
        fillPasswordFields(form, response?.generatedPassword || '');
        return;
      }

      const identity = response.identity;
      const generatedPassword = response.generatedPassword || '';
      const allInputs = form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])') as NodeListOf<HTMLInputElement>;

      let filledFields: string[] = [];

      allInputs.forEach((input) => {
        const attrs = [input.name, input.id, input.autocomplete, input.placeholder, input.type, input.getAttribute('aria-label') || ''].join(' ').toLowerCase();

        // First name
        if (/first.?name|given.?name|fname|vorname/.test(attrs) && identity.firstName) {
          setInputValue(input, identity.firstName);
          filledFields.push('first name');
          return;
        }

        // Last name
        if (/last.?name|family.?name|surname|lname|nachname/.test(attrs) && identity.lastName) {
          setInputValue(input, identity.lastName);
          filledFields.push('last name');
          return;
        }

        // Full name (if no separate first/last)
        if (/^(name|full.?name|display.?name)$/i.test(input.name || '') || /^(name|full.?name)$/i.test(input.id || '')) {
          if (identity.firstName || identity.lastName) {
            const fullName = [identity.firstName, identity.lastName].filter(Boolean).join(' ');
            setInputValue(input, fullName);
            filledFields.push('name');
            return;
          }
        }

        // Email
        if ((input.type === 'email' || /email|e.?mail|correo/.test(attrs)) && identity.email) {
          setInputValue(input, identity.email);
          filledFields.push('email');
          return;
        }

        // Phone
        if ((input.type === 'tel' || /phone|mobile|tel|cell|número/.test(attrs)) && identity.phone) {
          setInputValue(input, identity.phone);
          filledFields.push('phone');
          return;
        }

        // Username (use email or derive from name)
        if (/^(username|user.?name|login|handle|screen.?name|nick)/.test(attrs)) {
          const username = identity.email || (identity.firstName || '').toLowerCase() + (identity.lastName || '').toLowerCase().charAt(0);
          if (username) {
            setInputValue(input, username);
            filledFields.push('username');
            return;
          }
        }

        // Address
        if (/address|street|addr|dirección/.test(attrs) && identity.address && !/email/.test(attrs)) {
          setInputValue(input, identity.address);
          filledFields.push('address');
          return;
        }
      });

      // Fill password fields
      if (generatedPassword) {
        const pwFilled = fillPasswordFields(form, generatedPassword);
        if (pwFilled) filledFields.push('password');
      }

      // Show notification
      if (filledFields.length > 0) {
        showAutoFillNotification(filledFields, generatedPassword);
      }
    });
  }

  function fillPasswordFields(form: HTMLFormElement, password: string): boolean {
    if (!password) return false;

    const passwordFields = form.querySelectorAll('input[type="password"]') as NodeListOf<HTMLInputElement>;
    let filled = false;

    passwordFields.forEach((field) => {
      setInputValue(field, password);
      filled = true;
    });

    return filled;
  }

  function showAutoFillNotification(fields: string[], generatedPassword: string) {
    injectStyles();

    // Remove any existing notification
    document.querySelectorAll('.nkvault-autofill-notification').forEach(el => el.remove());

    const notification = document.createElement('div');
    notification.className = 'nkvault-autofill-notification';
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 320px;
      background: #1a1a1a;
      border: 1px solid rgba(184, 255, 0, 0.2);
      border-radius: 14px;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5), 0 0 30px rgba(184, 255, 0, 0.06);
      z-index: 2147483647;
      font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
      padding: 14px 16px;
      animation: nkvault-slideDown 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      color: #f0f0f0;
    `;

    const fieldList = fields.map(f => `<span style="color: #B8FF00; font-weight: 500;">${f}</span>`).join(', ');

    notification.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 10px;">
        <div style="width: 34px; height: 34px; border-radius: 9px; background: linear-gradient(135deg, rgba(0, 214, 143, 0.15), rgba(0, 214, 143, 0.05)); border: 1px solid rgba(0, 214, 143, 0.2); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00D68F" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 12px; font-weight: 600; color: #00D68F; margin-bottom: 3px;">NKVault Auto-Filled</div>
          <div style="font-size: 11px; color: #999; line-height: 1.5;">
            Filled ${fieldList}
            ${generatedPassword ? `<br><span style="color: #888;">🔑 Strong password generated</span>` : ''}
          </div>
        </div>
        <button onclick="this.closest('.nkvault-autofill-notification').remove()" style="width: 22px; height: 22px; border: none; background: rgba(255,255,255,0.06); border-radius: 6px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #666; flex-shrink: 0;">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      ${generatedPassword ? `
      <div style="margin-top: 10px; display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.06);">
        <div style="flex: 1; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 11px; color: #B8FF00; word-break: break-all; line-height: 1.4;">${escapeHtml(generatedPassword)}</div>
        <button id="nkvault-copy-generated" style="padding: 4px 8px; border: none; border-radius: 6px; background: rgba(184, 255, 0, 0.1); color: #B8FF00; font-size: 10px; font-weight: 600; cursor: pointer; white-space: nowrap; font-family: inherit; transition: all 0.15s;">Copy</button>
      </div>
      ` : ''}
      <div style="margin-top: 8px; font-size: 10px; color: #555; text-align: center;">Will auto-save on form submit</div>
    `;

    document.body.appendChild(notification);

    // Copy button handler
    const copyBtn = notification.querySelector('#nkvault-copy-generated');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(generatedPassword);
          (copyBtn as HTMLElement).textContent = '✓';
          (copyBtn as HTMLElement).style.color = '#00D68F';
          setTimeout(() => {
            (copyBtn as HTMLElement).textContent = 'Copy';
            (copyBtn as HTMLElement).style.color = '#B8FF00';
          }, 2000);
        } catch {}
      });
    }

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      if (document.body.contains(notification)) {
        notification.style.animation = 'nkvault-slideUp 0.2s ease forwards';
        setTimeout(() => notification.remove(), 200);
      }
    }, 10000);
  }

  // ---- Autosave: Detect form submissions ----
  function attachAutosaveListener(
    form: HTMLFormElement,
    passwordField: HTMLInputElement,
    usernameField: HTMLInputElement | null
  ) {
    if (form.dataset.nkvaultAutosave) return;
    form.dataset.nkvaultAutosave = 'true';

    // Listen for form submission
    form.addEventListener('submit', () => {
      captureAndOfferSave(passwordField, usernameField);
    }, { capture: true });

    // Also listen for Enter key on password field (some forms don't fire submit)
    passwordField.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        // Small delay to let the form actually submit
        setTimeout(() => {
          captureAndOfferSave(passwordField, usernameField);
        }, 100);
      }
    });

    // Listen for button clicks within the form that might submit
    form.querySelectorAll('button[type="submit"], input[type="submit"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        setTimeout(() => {
          captureAndOfferSave(passwordField, usernameField);
        }, 100);
      }, { capture: true });
    });
  }

  function captureAndOfferSave(
    passwordField: HTMLInputElement,
    usernameField: HTMLInputElement | null
  ) {
    const password = passwordField.value;
    const username = usernameField?.value || '';
    const url = window.location.href;
    const domain = normalizeUrlSimple(url);

    // Don't save empty credentials
    if (!password || password.length < 3) return;

    // Don't prompt again for the same credentials on this page
    const key = `${domain}:${username}:${password.substring(0, 8)}`;
    if (savedForms.has(key)) return;
    savedForms.add(key);

    // Skip NKVault's own login page
    if (NKVAULT_ORIGINS.some(o => url.startsWith(o))) return;

    // Check if we already have these credentials saved
    chrome.runtime.sendMessage(
      { type: 'GET_CREDENTIALS_FOR_URL', url },
      (response) => {
        if (response?.credentials) {
          // Check if exact match already exists
          const alreadySaved = response.credentials.some(
            (cred: any) => cred.username === username && cred.password === password
          );
          if (alreadySaved) return;

          // Check if same username exists (potential password update)
          const existingUser = response.credentials.find(
            (cred: any) => cred.username === username
          );

          if (existingUser) {
            showSaveBanner(domain, username, password, url, 'update', existingUser.id);
          } else {
            showSaveBanner(domain, username, password, url, 'new');
          }
        } else {
          // No existing credentials — offer to save as new
          showSaveBanner(domain, username, password, url, 'new');
        }
      }
    );
  }

  function showSaveBanner(
    domain: string,
    username: string,
    password: string,
    url: string,
    mode: 'new' | 'update',
    existingItemId?: string
  ) {
    // Remove any existing banner
    document.querySelectorAll(`.${SAVE_BANNER_CLASS}`).forEach(el => el.remove());

    // Inject styles if not present
    injectStyles();

    const banner = document.createElement('div');
    banner.className = SAVE_BANNER_CLASS;
    banner.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      width: 340px;
      background: #1a1a1a;
      border: 1px solid rgba(184, 255, 0, 0.2);
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05), 0 0 40px rgba(184, 255, 0, 0.06);
      z-index: 2147483647;
      font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
      padding: 16px;
      animation: nkvault-slideDown 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      color: #f0f0f0;
    `;

    const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    const isUpdate = mode === 'update';
    const displayUsername = username ? escapeHtml(username) : '<span style="color:#666;">No username</span>';

    banner.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px;">
        <div style="width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, rgba(184, 255, 0, 0.12), rgba(184, 255, 0, 0.04)); border: 1px solid rgba(184, 255, 0, 0.15); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B8FF00" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            <circle cx="12" cy="16.5" r="1.5" fill="#B8FF00" stroke="none"/>
          </svg>
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 13px; font-weight: 600; color: #f0f0f0; margin-bottom: 2px;">
            ${isUpdate ? 'Update password?' : 'Save to NKVault?'}
          </div>
          <div style="font-size: 11px; color: #888;">
            ${isUpdate ? 'Password changed for' : 'New login detected on'} <span style="color: #B8FF00; font-weight: 500;">${escapeHtml(domain)}</span>
          </div>
        </div>
        <button id="nkvault-dismiss" style="width: 24px; height: 24px; border: none; background: rgba(255,255,255,0.06); border-radius: 6px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #666; flex-shrink: 0; transition: all 0.15s;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 10px; border: 1px solid rgba(255,255,255,0.06); margin-bottom: 14px;">
        <img src="${favicon}" alt="" style="width: 20px; height: 20px; border-radius: 4px; background: #333;" onerror="this.style.display='none'"/>
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 12px; font-weight: 500; color: #ccc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${displayUsername}</div>
          <div style="font-size: 11px; color: #555; font-family: 'SF Mono', monospace; letter-spacing: 2px;">••••••••</div>
        </div>
      </div>

      <div style="display: flex; gap: 8px;">
        <button id="nkvault-save" style="flex: 1; padding: 10px; border: none; border-radius: 10px; background: #B8FF00; color: #0A0A0A; font-family: inherit; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s; text-transform: uppercase; letter-spacing: 0.5px;">
          ${isUpdate ? 'Update' : 'Save'}
        </button>
        <button id="nkvault-never" style="flex: 0.7; padding: 10px; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; background: transparent; color: #888; font-family: inherit; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s;">
          Never
        </button>
      </div>
    `;

    document.body.appendChild(banner);

    // ---- Button Handlers ----

    // Dismiss (X button)
    const dismissBtn = banner.querySelector('#nkvault-dismiss');
    dismissBtn?.addEventListener('mouseenter', () => {
      (dismissBtn as HTMLElement).style.background = 'rgba(255,255,255,0.1)';
      (dismissBtn as HTMLElement).style.color = '#ccc';
    });
    dismissBtn?.addEventListener('mouseleave', () => {
      (dismissBtn as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
      (dismissBtn as HTMLElement).style.color = '#666';
    });
    dismissBtn?.addEventListener('click', () => {
      closeBanner(banner);
    });

    // Save button
    const saveBtn = banner.querySelector('#nkvault-save');
    saveBtn?.addEventListener('mouseenter', () => {
      (saveBtn as HTMLElement).style.background = '#9FE600';
      (saveBtn as HTMLElement).style.boxShadow = '0 4px 16px rgba(184, 255, 0, 0.3)';
      (saveBtn as HTMLElement).style.transform = 'translateY(-1px)';
    });
    saveBtn?.addEventListener('mouseleave', () => {
      (saveBtn as HTMLElement).style.background = '#B8FF00';
      (saveBtn as HTMLElement).style.boxShadow = 'none';
      (saveBtn as HTMLElement).style.transform = 'none';
    });
    saveBtn?.addEventListener('click', () => {
      // Send save request to background
      chrome.runtime.sendMessage({
        type: isUpdate ? 'UPDATE_CREDENTIAL' : 'SAVE_CREDENTIAL',
        credential: {
          title: domain,
          username,
          password,
          url,
        },
        itemId: existingItemId,
      }, (response) => {
        if (response?.success) {
          showSaveSuccess(banner);
        } else {
          showSaveError(banner, response?.error || 'Failed to save');
        }
      });
    });

    // Never button
    const neverBtn = banner.querySelector('#nkvault-never');
    neverBtn?.addEventListener('mouseenter', () => {
      (neverBtn as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
      (neverBtn as HTMLElement).style.color = '#ccc';
    });
    neverBtn?.addEventListener('mouseleave', () => {
      (neverBtn as HTMLElement).style.background = 'transparent';
      (neverBtn as HTMLElement).style.color = '#888';
    });
    neverBtn?.addEventListener('click', () => {
      // Store this domain in "never save" list
      chrome.runtime.sendMessage({
        type: 'NEVER_SAVE_FOR_DOMAIN',
        domain,
      });
      closeBanner(banner);
    });

    // Auto-dismiss after 30 seconds
    setTimeout(() => {
      if (document.body.contains(banner)) closeBanner(banner);
    }, 30000);
  }

  function showSaveSuccess(banner: HTMLElement) {
    banner.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; padding: 4px 0;">
        <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(0, 214, 143, 0.12); display: flex; align-items: center; justify-content: center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00D68F" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div>
          <div style="font-size: 13px; font-weight: 600; color: #00D68F;">Saved to NKVault</div>
          <div style="font-size: 11px; color: #666;">Encrypted & synced to your vault</div>
        </div>
      </div>
    `;
    setTimeout(() => closeBanner(banner), 2000);
  }

  function showSaveError(banner: HTMLElement, error: string) {
    banner.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; padding: 4px 0;">
        <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(255, 77, 77, 0.12); display: flex; align-items: center; justify-content: center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF4D4D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </div>
        <div>
          <div style="font-size: 13px; font-weight: 600; color: #FF4D4D;">Save failed</div>
          <div style="font-size: 11px; color: #666;">${escapeHtml(error)}</div>
        </div>
      </div>
    `;
    setTimeout(() => closeBanner(banner), 3000);
  }

  function closeBanner(banner: HTMLElement) {
    banner.style.animation = 'nkvault-slideUp 0.2s ease forwards';
    setTimeout(() => banner.remove(), 200);
  }

  function attachBadge(passwordField: HTMLInputElement, usernameField: HTMLInputElement | null) {
    const badge = document.createElement('div');
    badge.className = BADGE_CLASS;
    badge.title = 'Fill with NKVault';
    badge.style.cssText = `
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      border-radius: 6px;
      z-index: 2147483647;
      transition: all 0.15s ease;
      background: linear-gradient(135deg, #B8FF00 0%, #9FE600 100%);
      box-shadow: 0 2px 8px rgba(184, 255, 0, 0.3);
    `;

    // NKVault lock icon (SVG)
    badge.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;

    badge.addEventListener('mouseenter', () => {
      badge.style.transform = 'translateY(-50%) scale(1.1)';
      badge.style.boxShadow = '0 4px 12px rgba(184, 255, 0, 0.5)';
    });

    badge.addEventListener('mouseleave', () => {
      badge.style.transform = 'translateY(-50%) scale(1)';
      badge.style.boxShadow = '0 2px 8px rgba(184, 255, 0, 0.3)';
    });

    badge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showCredentialDropdown(badge, passwordField, usernameField);
    });

    // Position wrapper
    const wrapper = passwordField.parentElement;
    if (wrapper) {
      const computedPos = getComputedStyle(wrapper).position;
      if (computedPos === 'static') wrapper.style.position = 'relative';
      wrapper.appendChild(badge);
    }
  }

  function showCredentialDropdown(
    badge: HTMLElement,
    passwordField: HTMLInputElement,
    usernameField: HTMLInputElement | null
  ) {
    // Remove existing dropdown
    document.querySelectorAll(`.${DROPDOWN_CLASS}`).forEach(el => el.remove());

    const dropdown = document.createElement('div');
    dropdown.className = DROPDOWN_CLASS;
    dropdown.style.cssText = `
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      width: 280px;
      max-height: 300px;
      overflow-y: auto;
      background: #1a1a1a;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
      z-index: 2147483647;
      font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
      padding: 8px;
      animation: nkvault-fadeIn 0.15s ease;
    `;

    // Inject styles if not present
    injectStyles();

    // Loading state
    dropdown.innerHTML = `
      <div style="padding: 16px; text-align: center; color: #888; font-size: 12px;">
        <div style="margin-bottom: 8px;">🔐</div>
        Loading credentials...
      </div>
    `;

    badge.parentElement?.appendChild(dropdown);

    // Request credentials from background
    chrome.runtime.sendMessage(
      { type: 'GET_CREDENTIALS_FOR_URL', url: window.location.href },
      (response) => {
        if (!response || !response.credentials || response.credentials.length === 0) {
          dropdown.innerHTML = `
            <div style="padding: 16px; text-align: center; color: #888; font-size: 12px;">
              <div style="margin-bottom: 8px; font-size: 16px;">🔒</div>
              <div style="font-weight: 500; color: #ccc; margin-bottom: 4px;">No credentials found</div>
              <div>Save logins in the NKVault app first</div>
            </div>
          `;
          return;
        }

        dropdown.innerHTML = `
          <div style="padding: 4px 8px 8px; font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
            NKVault · ${response.credentials.length} match${response.credentials.length > 1 ? 'es' : ''}
          </div>
        `;

        response.credentials.forEach((cred: any) => {
          const row = document.createElement('div');
          row.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px;
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.1s;
          `;

          const favicon = `https://www.google.com/s2/favicons?domain=${normalizeUrlSimple(cred.url)}&sz=32`;

          row.innerHTML = `
            <img src="${favicon}" alt="" style="width: 24px; height: 24px; border-radius: 4px; background: #333;" onerror="this.style.display='none'"/>
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 13px; font-weight: 500; color: #f0f0f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(cred.title)}</div>
              <div style="font-size: 11px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(cred.username)}</div>
            </div>
            <div style="color: #B8FF00; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; flex-shrink: 0;">Fill</div>
          `;

          row.addEventListener('mouseenter', () => {
            row.style.background = 'rgba(255, 255, 255, 0.06)';
          });
          row.addEventListener('mouseleave', () => {
            row.style.background = 'transparent';
          });

          row.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Fill fields
            if (usernameField) {
              setInputValue(usernameField, cred.username);
            }
            setInputValue(passwordField, cred.password);

            // Remove dropdown
            dropdown.remove();

            // Flash badge green
            badge.style.background = 'linear-gradient(135deg, #00D68F 0%, #00B377 100%)';
            setTimeout(() => {
              badge.style.background = 'linear-gradient(135deg, #B8FF00 0%, #9FE600 100%)';
            }, 1500);
          });

          dropdown.appendChild(row);
        });
      }
    );

    // Close on click outside
    const closeHandler = (e: MouseEvent) => {
      if (!dropdown.contains(e.target as Node) && e.target !== badge) {
        dropdown.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 50);
  }

  // ---- Helpers ----

  function setInputValue(input: HTMLInputElement, value: string) {
    // Set value natively and dispatch events for React/Vue/Angular compatibility
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype, 'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, value);
    } else {
      input.value = value;
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  }

  function normalizeUrlSimple(url: string): string {
    try {
      return new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    } catch {
      return url;
    }
  }

  function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function injectStyles() {
    if (document.querySelector('#nkvault-styles')) return;
    const style = document.createElement('style');
    style.id = 'nkvault-styles';
    style.textContent = `
      @keyframes nkvault-fadeIn {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes nkvault-slideDown {
        from { opacity: 0; transform: translateY(-12px) scale(0.97); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes nkvault-slideUp {
        from { opacity: 1; transform: translateY(0) scale(1); }
        to { opacity: 0; transform: translateY(-12px) scale(0.97); }
      }
    `;
    document.head.appendChild(style);
  }

  // ---- Run ----
  detectLoginFields();

  const observer = new MutationObserver(() => {
    detectLoginFields();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log('[NKVault] Content script loaded');
})();

