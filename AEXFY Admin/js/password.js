// js/password.js

(function(N) {
  'use strict';

  if (!N) return;

  var password = N.password = {};
  var ui = {};

  function parseUrlParams() {
    var params = new URLSearchParams(window.location.search || '');
    var hash = window.location.hash ? window.location.hash.replace(/^#/, '') : '';
    var hashParams = new URLSearchParams(hash);
    return {
      error: params.get('error') || hashParams.get('error'),
      errorCode: params.get('error_code') || hashParams.get('error_code'),
      errorDescription: params.get('error_description') || hashParams.get('error_description'),
      code: params.get('code') || hashParams.get('code'),
      accessToken: hashParams.get('access_token') || params.get('access_token'),
      refreshToken: hashParams.get('refresh_token') || params.get('refresh_token'),
      type: params.get('type') || hashParams.get('type'),
      uid: params.get('uid') || hashParams.get('uid') || params.get('user_id') || hashParams.get('user_id')
    };
  }

  function clearUrl() {
    if (!window.history || !window.history.replaceState) return;
    var clean = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, clean);
  }

  function setStatus(message, isError) {
    if (!ui.status) return;
    ui.status.textContent = message || '';
    ui.status.style.color = isError ? '#c0392b' : '';
  }

  function getFriendlyError(code, description) {
    if (code === 'otp_expired') {
      return 'El enlace expiro. Solicita un nuevo email de invitacion o recuperacion.';
    }
    if (code === 'access_denied') {
      return 'El enlace ya fue usado o no es valido.';
    }
    if (description) {
      return String(description).replace(/\+/g, ' ');
    }
    return 'No hay sesion de recuperacion activa.';
  }

  async function ensureSession() {
    if (!window.supabaseClient) return null;
    var params = parseUrlParams();
    var expectedUserId = params.uid;

    if (params.error || params.errorCode) {
      setStatus(getFriendlyError(params.errorCode, params.errorDescription), true);
      if (ui.submit) ui.submit.disabled = true;
      return null;
    }

    try {
      if (params.code) {
        var exchange = await window.supabaseClient.auth.exchangeCodeForSession(params.code);
        if (exchange && exchange.error) throw exchange.error;
        clearUrl();
      } else if (params.accessToken && params.refreshToken) {
        var sessionResponse = await window.supabaseClient.auth.setSession({
          access_token: params.accessToken,
          refresh_token: params.refreshToken
        });
        if (sessionResponse && sessionResponse.error) throw sessionResponse.error;
        clearUrl();
      }
    } catch (_err) {
      setStatus('No fue posible validar el enlace. Solicita uno nuevo.', true);
      if (ui.submit) ui.submit.disabled = true;
      return null;
    }

    var response = await window.supabaseClient.auth.getSession();
    var session = response && response.data ? response.data.session : null;
    if (session && expectedUserId && session.user && session.user.id !== expectedUserId) {
      await window.supabaseClient.auth.signOut();
      setStatus('El enlace no corresponde a este usuario.', true);
      if (ui.submit) ui.submit.disabled = true;
      return null;
    }
    return session;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!window.supabaseClient) return;
    if (!ui.newPassword || !ui.confirmPassword) return;

    var newPassword = ui.newPassword.value.trim();
    var confirm = ui.confirmPassword.value.trim();

    if (newPassword.length < 8) {
      setStatus('La contrasena debe tener al menos 8 caracteres.', true);
      return;
    }

    if (newPassword !== confirm) {
      setStatus('Las contrasenas no coinciden.', true);
      return;
    }

    ui.submit.disabled = true;
    setStatus('Actualizando contrasena...');

    try {
      var result = await window.supabaseClient.auth.updateUser({ password: newPassword });
      if (result.error) throw result.error;
      setStatus('Contrasena actualizada. Inicia sesion nuevamente.');
      await window.supabaseClient.auth.signOut();
    } catch (err) {
      setStatus('No fue posible actualizar la contrasena.', true);
      ui.submit.disabled = false;
    }
  }

  password.init = function() {
    ui = {
      form: N.utils.$('#password-form'),
      newPassword: N.utils.$('#password-new'),
      confirmPassword: N.utils.$('#password-confirm'),
      status: N.utils.$('#password-status'),
      submit: N.utils.$('#password-submit')
    };

    if (!ui.form) return;

    ui.form.addEventListener('submit', handleSubmit);
    if (ui.submit) ui.submit.disabled = true;

    ensureSession().then(function(session) {
      if (!session) return;
      if (ui.submit) ui.submit.disabled = false;
      setStatus('Sesion activa para ' + (session.user && session.user.email ? session.user.email : 'usuario') + '.');
    });
  };
})(window.Aexfy);

