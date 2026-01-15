// js/supabase.js
// Supabase client setup. Exposes window.supabaseClient.

(function() {
  'use strict';

  var debug = window.AEXFY_CONFIG && window.AEXFY_CONFIG.DEBUG_LOGS;
  function logDebug(message) {
    if (!debug) return;
    console.warn(message);
  }

  if (!window.supabase) {
    logDebug('Supabase CDN not loaded. Check the <script> tag for @supabase/supabase-js v2.');
    return;
  }

  var cfg = window.AEXFY_CONFIG || window.Aexfy_CONFIG || {};
  var supabaseUrl = cfg.SUPABASE_URL || window.SUPABASE_URL;
  var supabaseKey = cfg.SUPABASE_ANON_KEY ||
    cfg.SUPABASE_PUBLISHABLE_KEY ||
    window.SUPABASE_ANON_KEY ||
    window.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey || /YOUR-/.test(supabaseUrl) || /YOUR-/.test(supabaseKey)) {
    logDebug('Missing Supabase config. Set SUPABASE_URL and SUPABASE_ANON_KEY in js/config.js.');
    return;
  }

  function looksLikeServiceRole(key) {
    if (!key || typeof key !== 'string') return false;
    var parts = key.split('.');
    if (parts.length < 2) return false;
    try {
      var payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      var decoded = atob(payload);
      return decoded.indexOf('service_role') >= 0;
    } catch (_err) {
      return false;
    }
  }

  if (looksLikeServiceRole(supabaseKey)) {
    logDebug('Supabase key invalida: no uses service_role en el cliente.');
    return;
  }

  window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
})();

