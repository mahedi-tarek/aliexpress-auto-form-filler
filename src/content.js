import { isLicensed } from './license.js';
import { parseAddress } from './parser.js';
import { fillForm } from './filler.js';

var BTN_ID      = 'aliexpress-addr-fill-btn';
var TOAST_ID    = 'aliexpress-addr-toast';
var OVERLAY_ID  = 'aliexpress-addr-paywall';
var PANEL_ID    = 'aliexpress-addr-panel';
// TODO: Replace with your actual landing page / signup URL
var PAYMENT_LINK = 'https://YOUR_LANDING_PAGE_URL';

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

function formIsPresent() {
  return !!(
    document.querySelector('input[placeholder^="First name"]') ||
    document.querySelector('input[placeholder*="House number"]') ||
    document.querySelector('input[placeholder^="Postcode"]')
  );
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

  chrome.storage.local.get('authStatus', function(data) {
    var status = data.authStatus;
    var icon, title, body, btnLabel;

    if (status && status.reason === 'trial') {
      var daysLeft = status.trialDaysLeft != null ? status.trialDaysLeft : 0;
      var endDate = formatDate(new Date(Date.now() + daysLeft * 86400000));
      icon = '&#9203;';
      title = daysLeft === 1 ? '1 day left in your trial' : daysLeft + ' days left in your trial';
      body = 'Your free trial ends on <strong>' + endDate + '</strong>.<br>Subscribe now to keep filling addresses after your trial.';
      btnLabel = 'Subscribe — $9.99/mo';
    } else if (status && status.reason === 'trial_expired') {
      icon = '&#128274;';
      title = 'Your free trial has ended';
      body = 'Subscribe to continue autofilling addresses on AliExpress.';
      btnLabel = 'Subscribe — $9.99/mo';
    } else if (status && (status.reason === 'cancelled' || status.reason === 'payment_failed')) {
      icon = '&#128274;';
      title = 'Access paused';
      body = status.reason === 'payment_failed'
        ? 'Your last payment failed. Update your card to restore access.'
        : 'Your subscription was cancelled. Resubscribe to continue.';
      btnLabel = 'Resubscribe — $9.99/mo';
    } else {
      icon = '&#128274;';
      title = 'Activate Address Filler';
      body = 'Sign up for a <strong>free 7-day trial</strong> to start autofilling addresses.<br><span style="font-size:11px;color:#aaa;">Then $9.99/month — cancel anytime.</span>';
      btnLabel = 'Start Free Trial';
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
      window.open(PAYMENT_LINK, '_blank');
    });
    overlay.querySelector('.close').addEventListener('click', function () {
      overlay.remove();
    });
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

    var allIssues = (result.warnings || []).concat(
      result.missing.map(function (m) { return 'missing: ' + m; })
    );
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
    var text = textarea.value;
    closePanel();
    applyFill(text);
  });
}

async function handleFill() {
  var licensed = await isLicensed();
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
  if (!formIsPresent()) return;

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

injectButton();

var debounceTimer;
var observer = new MutationObserver(function () {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(function () {
    if (!document.getElementById(BTN_ID)) injectButton();
  }, 600);
});
observer.observe(document.body, { childList: true, subtree: true });

chrome.storage.onChanged.addListener(function(changes, area) {
  if (area === 'local' && changes.buttonPosition) {
    applyButtonPosition(changes.buttonPosition.newValue || DEFAULT_POSITION);
  }
});
