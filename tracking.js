/* Meta Pixel for autoformfiller.xyz with a simple consent banner.
 *
 * The pixel loads on every page but stays in "revoked" consent mode (no
 * cookies, no tracking) until the visitor clicks Accept. The choice is
 * remembered in localStorage.
 *
 * Events:
 *  - PageView             every page (after consent)
 *  - Lead + AddToChrome   click on any Chrome Web Store link
 *  - Subscribe            success.html (after a Stripe payment)
 */
(function () {
  var PIXEL_ID = '1737813931026619';
  var KEY = 'af_consent';

  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
  document,'script','https://connect.facebook.net/en_US/fbevents.js');

  var choice = null;
  try { choice = localStorage.getItem(KEY); } catch (e) {}

  fbq('consent', choice === 'granted' ? 'grant' : 'revoke');
  fbq('init', PIXEL_ID);
  fbq('track', 'PageView');

  // Conversion events on this page.
  if (/success\.html$/.test(location.pathname)) fbq('track', 'Subscribe');
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="chromewebstore.google.com"]');
    if (!a) return;
    fbq('track', 'Lead', { content_name: 'Add to Chrome' });
    fbq('trackCustom', 'AddToChrome');
  }, true);

  if (choice) return;

  // Consent banner
  var bar = document.createElement('div');
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Cookie consent');
  bar.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;max-width:620px;margin:0 auto;background:#1e1e1e;color:#f0f0f0;border:1px solid #2a2a2a;border-radius:12px;padding:14px 16px;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex;gap:12px;align-items:center;flex-wrap:wrap;box-shadow:0 10px 30px rgba(0,0,0,.5)';
  bar.innerHTML = '<span style="flex:1;min-width:220px">We use cookies (Meta Pixel) to measure our ads. See our <a href="/privacy.html" style="color:#ff8080">privacy policy</a>.</span>' +
    '<button data-c="denied" style="background:transparent;color:#bbb;border:1px solid #444;border-radius:8px;padding:8px 14px;font:inherit;cursor:pointer">Decline</button>' +
    '<button data-c="granted" style="background:#e43a3a;color:#fff;border:0;border-radius:8px;padding:8px 16px;font:inherit;font-weight:600;cursor:pointer">Accept</button>';
  bar.addEventListener('click', function (e) {
    var c = e.target.getAttribute && e.target.getAttribute('data-c');
    if (!c) return;
    try { localStorage.setItem(KEY, c); } catch (err) {}
    if (c === 'granted') { fbq('consent', 'grant'); fbq('track', 'PageView'); }
    bar.remove();
  });
  function show() { document.body.appendChild(bar); }
  if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
})();
