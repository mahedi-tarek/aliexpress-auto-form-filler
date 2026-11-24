import { isLicensed } from './license.js';
import { parseAddress } from './parser.js';
import { fillForm } from './filler.js';

var BTN_ID      = 'aliexpress-addr-fill-btn';
var TOAST_ID    = 'aliexpress-addr-toast';
var OVERLAY_ID  = 'aliexpress-addr-paywall';
var PANEL_ID    = 'aliexpress-addr-panel';
var RETRY_ID    = 'aliexpress-addr-retry';

var DEFAULT_POSITION = 'top-right';
var POSITION_STYLES = {
  'top-left':     { top: '24px', bottom: '',     left: '24px', right: ''     },
  'top-right':    { top: '24px', bottom: '',     left: '',     right: '24px' },
  'bottom-left':  { top: '',     bottom: '24px', left: '24px', right: ''     },
  'bottom-right': { top: '',     bottom: '24px', left: '',     right: '24px' },
};

function applyButtonPosition(pos) {
  var btn = document.getElementById(BTN_ID);
  if (!btn) return;
  var s = POSITION_STYLES[pos] || POSITION_STYLES[DEFAULT_POSITION];
  btn.style.top    = s.top;
  btn.style.bottom = s.bottom;
  btn.style.left   = s.left;
  btn.style.right  = s.right;
}

function showToast(msg, isError) {
  var toast = document.getElementById(TOAST_ID);
  if (!toast) {
    toast = document.createElement('div');
    toast.id = TOAST_ID;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = 'aliexpress-addr-toast' + (isError ? ' error' : '');
  toast.style.opacity = '1';
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(function () { toast.style.opacity = '0'; }, 3500);
}

function formatDate(date) {
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function showPaywall() {
  if (document.getElementById(OVERLAY_ID)) return;

  chrome.storage.local.get(['authStatus', 'accessToken'], function(data) {
    var status = data.authStatus;
    var signedIn = !!data.accessToken;
    var icon = '&#128274;', title, body, btnLabel, action = 'checkout';

    if (!signedIn) {
      title = 'Activate Address Filler';
      body = 'Click the <strong>Address Filler</strong> icon in your Chrome toolbar to create a free account and start your <strong>7-day free trial</strong>.<br><span style="font-size:11px;color:#aaa;">Plans from $9.99/month — cancel anytime.</span>';
      btnLabel = 'Open Address Filler';
      action = 'popup';
    } else if (status && (status.reason === 'trial_expired' || status.reason === 'trial_used' || status.reason === 'trial_unavailable')) {
      title = status.reason === 'trial_used' ? 'Free trial already used' : 'Your free trial has ended';
      body = status.reason === 'trial_used'
        ? 'A free trial was already used on this computer. Subscribe to keep autofilling addresses.'
        : 'Subscribe to continue autofilling addresses on AliExpress.';
      btnLabel = 'See plans';
    } else if (status && (status.reason === 'cancelled' || status.reason === 'payment_failed')) {
      title = 'Access paused';
      body = status.reason === 'payment_failed'
        ? 'Your last payment failed. Update your card to restore access.'
        : 'Your subscription was cancelled. Resubscribe to continue.';
      btnLabel = 'See plans';
    } else if (status && status.reason === 'device_limit') {
      title = 'Device limit reached';
      body = 'Your plan is already active on another computer. Open the extension to manage your devices.';
      btnLabel = 'Open Address Filler';
      action = 'popup';
    } else {
      title = 'Couldn\'t confirm your access';
      body = 'Open the extension to check your account status, then try again.';
      btnLabel = 'Open Address Filler';
      action = 'popup';
    }

    var overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.innerHTML =
      '<div class="aliexpress-addr-paywall-box">' +
        '<div class="aliexpress-addr-paywall-icon">' + icon + '</div>' +
        '<h3>' + title + '</h3>' +
        '<p>' + body + '</p>' +
        '<button class="aliexpress-addr-paywall-btn subscribe">' + btnLabel + '</button>' +
        '<button class="aliexpress-addr-paywall-btn close">Close</button>' +
      '</div>';

    document.body.appendChild(overlay);

    overlay.querySelector('.subscribe').addEventListener('click', function () {
      chrome.runtime.sendMessage({ type: action === 'popup' ? 'OPEN_POPUP' : 'OPEN_CHECKOUT' }).catch(function () {});
      showToast('Click the Address Filler icon in your toolbar (puzzle-piece menu if it is hidden).');
      overlay.remove();
    });
    overlay.querySelector('.close').addEventListener('click', function () {
      overlay.remove();
    });
  });
}

// Shows a small panel that lets the user retry failed dropdown fields
// without re-pasting the full address. fillForm is idempotent on text fields.
function closeRetryPanel() {
  var panel = document.getElementById(RETRY_ID);
  if (panel) panel.remove();
}

function showRetryPanel(addr, failedDropdowns) {
  closeRetryPanel();

  var panel = document.createElement('div');
  panel.id = RETRY_ID;
  // Sits at the bottom-right so it never overlaps the editor panel, which the
  // user keeps open near the Paste & Fill button.
  panel.style.bottom = '24px';
  panel.style.right  = '24px';
  panel.style.top    = 'auto';
  panel.style.left   = 'auto';
  panel.innerHTML =
    '<div class="aliexpress-addr-panel-header">' +
      '<span>&#9888;&#65039; Dropdown retry</span>' +
      '<button class="aliexpress-addr-panel-close" title="Close">&#10005;</button>' +
    '</div>' +
    '<p class="aliexpress-addr-panel-hint" style="padding:8px 14px;color:#b91c1c;">' +
      'Could not set: ' + failedDropdowns.join(', ') +
    '</p>' +
    '<p class="aliexpress-addr-panel-hint">Open the dropdown manually or click Retry.</p>' +
    '<div class="aliexpress-addr-panel-footer">' +
      '<button class="aliexpress-addr-panel-btn cancel">Dismiss</button>' +
      '<button class="aliexpress-addr-panel-btn apply">Retry &#8635;</button>' +
    '</div>';

  document.body.appendChild(panel);

  panel.querySelector('.aliexpress-addr-panel-close').addEventListener('click', closeRetryPanel);
  panel.querySelector('.aliexpress-addr-panel-btn.cancel').addEventListener('click', closeRetryPanel);
  panel.querySelector('.aliexpress-addr-panel-btn.apply').addEventListener('click', async function () {
    closeRetryPanel();
    var btn = document.getElementById(BTN_ID);
    if (btn) { btn.textContent = '⏳ Retrying...'; btn.disabled = true; }
    try {
      var result = await fillForm(addr);
      var stillFailed = result.missing.filter(function(m) { return m.indexOf('dropdown') !== -1; });
      if (stillFailed.length === 0) {
        showToast('All fields filled successfully!');
      } else {
        showToast('Still missing: ' + stillFailed.join(', '), true);
      }
    } catch (e) {
      showToast('Retry failed: ' + e.message, true);
    } finally {
      if (btn) { btn.textContent = '📋 Paste & Fill'; btn.disabled = false; }
    }
  });
}

async function applyFill(text) {
  if (!text || !text.trim()) {
    showToast('Address text is empty.', true);
    return;
  }

  var addr = parseAddress(text);

  if (addr.warnings && addr.warnings.length && !addr.firstName && !addr.street) {
    showToast('Could not parse address.', true);
    return;
  }

  var btn = document.getElementById(BTN_ID);
  if (btn) { btn.textContent = '⏳ Filling...'; btn.disabled = true; }

  try {
    var result = await fillForm(addr);

    var dropdownFailed = result.missing.filter(function(m) { return m.indexOf('dropdown') !== -1; });
    var otherMissing   = result.missing.filter(function(m) { return m.indexOf('dropdown') === -1; });
    var allIssues      = (result.warnings || []).concat(otherMissing.map(function(m) { return 'missing: ' + m; }));

    if (dropdownFailed.length > 0) {
      // Text fields are done — show a retry panel specifically for dropdowns.
      if (btn) { btn.textContent = '📋 Paste & Fill'; btn.disabled = false; }
      showRetryPanel(addr, dropdownFailed);
      if (allIssues.length) showToast('Text fields filled. Dropdown(s) need retry.', false);
      return;
    }

    if (allIssues.length) {
      showToast('Filled! Issues: ' + allIssues.join('; '), false);
    } else {
      showToast('Address filled successfully!');
    }
  } catch (e) {
    showToast('Error during fill: ' + e.message, true);
  } finally {
    if (btn) { btn.textContent = '📋 Paste & Fill'; btn.disabled = false; }
  }
}

function closePanel() {
  var panel = document.getElementById(PANEL_ID);
  if (panel) panel.remove();
}

function showPanel(clipboardText) {
  closePanel();

  var panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.innerHTML =
    '<div class="aliexpress-addr-panel-header">' +
      '<span>&#9998;&#65039; Edit before filling</span>' +
      '<button class="aliexpress-addr-panel-close" title="Close">&#10005;</button>' +
    '</div>' +
    '<textarea class="aliexpress-addr-panel-textarea" rows="7" spellcheck="false"></textarea>' +
    '<p class="aliexpress-addr-panel-hint">Edit if needed, then click Fill Form</p>' +
    '<div class="aliexpress-addr-panel-footer">' +
      '<button class="aliexpress-addr-panel-btn cancel">Cancel</button>' +
      '<button class="aliexpress-addr-panel-btn apply">Fill Form &#8594;</button>' +
    '</div>';

  document.body.appendChild(panel);

  var PANEL_OFFSET = 12;
  var btn = document.getElementById(BTN_ID);
  if (btn) {
    var rect = btn.getBoundingClientRect();
    var isTop   = rect.top < window.innerHeight / 2;
    var isRight = rect.right > window.innerWidth / 2;
    panel.style.top    = isTop  ? (rect.bottom + PANEL_OFFSET) + 'px' : '';
    panel.style.bottom = !isTop ? (window.innerHeight - rect.top + PANEL_OFFSET) + 'px' : '';
    panel.style.right  = isRight  ? (window.innerWidth - rect.right) + 'px' : '';
    panel.style.left   = !isRight ? rect.left + 'px' : '';
  } else {
    panel.style.top   = '90px';
    panel.style.right = '24px';
  }

  var textarea = panel.querySelector('.aliexpress-addr-panel-textarea');
  textarea.value = clipboardText;
  textarea.focus();
  textarea.setSelectionRange(0, 0);

  panel.querySelector('.aliexpress-addr-panel-close').addEventListener('click', closePanel);
  panel.querySelector('.aliexpress-addr-panel-btn.cancel').addEventListener('click', closePanel);
  panel.querySelector('.aliexpress-addr-panel-btn.apply').addEventListener('click', function () {
    // Keep the editor open after filling so the user can tweak and re-fill.
    // The ✕ button (top-right) and Cancel both close it via closePanel().
    var text = textarea.value;
    applyFill(text);
  });
}

async function handleFill() {
  var licensed = await isLicensed();
  if (!licensed) {
    // Status may just be stale (e.g. right after paying) — refresh once.
    try { await chrome.runtime.sendMessage({ type: 'REVALIDATE' }); } catch (e) {}
    licensed = await isLicensed();
  }
  if (!licensed) {
    showPaywall();
    return;
  }

  var text;
  try {
    text = await navigator.clipboard.readText();
  } catch (e) {
    showToast('Clipboard read failed — please allow clipboard access.', true);
    return;
  }

  if (!text || !text.trim()) {
    showToast('Clipboard is empty. Copy an address first.', true);
    return;
  }

  showPanel(text);
}

function injectButton() {
  if (document.getElementById(BTN_ID)) return;
  if (!document.body) return; // body not parsed yet — bootstrap below will retry

  var btn = document.createElement('button');
  btn.id = BTN_ID;
  btn.textContent = '📋 Paste & Fill';
  btn.title = 'Click to preview and fill this form from your clipboard';
  btn.addEventListener('click', handleFill);
  document.body.appendChild(btn);

  chrome.storage.local.get('buttonPosition', function(data) {
    applyButtonPosition(data.buttonPosition || DEFAULT_POSITION);
  });
}

// Inject the button as early as possible — before AliExpress's address form
// renders — so it's ready the moment the user lands on the page. If <body>
// isn't parsed yet, wait for it.
if (document.body) {
  injectButton();
} else {
  document.addEventListener('DOMContentLoaded', injectButton, { once: true });
}

// AliExpress is a single-page app: route changes can wipe the button out of the
// DOM. Re-inject it if it disappears. A short debounce is enough since we no
// longer wait for the form to appear.
var debounceTimer;
var observer = new MutationObserver(function () {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(function () {
    if (!document.getElementById(BTN_ID)) injectButton();
  }, 200);
});
if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true });
} else {
  document.addEventListener('DOMContentLoaded', function () {
    observer.observe(document.body, { childList: true, subtree: true });
  }, { once: true });
}

chrome.storage.onChanged.addListener(function(changes, area) {
  if (area === 'local' && changes.buttonPosition) {
    applyButtonPosition(changes.buttonPosition.newValue || DEFAULT_POSITION);
  }
});
