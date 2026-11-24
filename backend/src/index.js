import { handleWebhook } from './routes/webhook.js';
import { handleAuthVerify, handleBillingPortal } from './routes/auth.js';
import { handleListDevices, handleRemoveDevice } from './routes/devices.js';

// Restrict CORS to the Chrome extension's own origin(s).
// EXTENSION_ID may be a comma-separated list (e.g. store ID + local dev ID).
function getCorsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const ids = (env.EXTENSION_ID || '').split(',').map(s => s.trim()).filter(Boolean);
  const allowed = ids.some(id => origin === `chrome-extension://${id}`);

  return {
    'Access-Control-Allow-Origin':  allowed ? origin : '',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

export default {
  async fetch(request, env) {
    const corsHeaders = getCorsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    let response;

    try {
      switch (url.pathname) {
        case '/webhook':
          response = await handleWebhook(request, env);
          break;

        case '/auth/verify':
          if (request.method !== 'POST') {
            response = new Response('Method not allowed', { status: 405 });
            break;
          }
          response = await handleAuthVerify(request, env);
          break;

        case '/devices':
          if (request.method !== 'GET') {
            response = new Response('Method not allowed', { status: 405 });
            break;
          }
          response = await handleListDevices(request, env);
          break;

        case '/devices/remove':
          if (request.method !== 'POST') {
            response = new Response('Method not allowed', { status: 405 });
            break;
          }
          response = await handleRemoveDevice(request, env);
          break;

        case '/billing/portal':
          if (request.method !== 'POST') {
            response = new Response('Method not allowed', { status: 405 });
            break;
          }
          response = await handleBillingPortal(request, env);
          break;

        default:
          response = new Response('Not found', { status: 404 });
      }
    } catch (err) {
      console.error(err);
      response = Response.json({ error: 'Internal server error' }, { status: 500 });
    }

    // Apply CORS headers to every response.
    Object.entries(corsHeaders).forEach(([k, v]) => {
      if (v) response.headers.set(k, v);
    });

    return response;
  },
};
