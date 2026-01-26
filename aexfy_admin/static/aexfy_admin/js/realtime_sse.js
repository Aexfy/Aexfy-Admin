// Actualizacion en tiempo real via SSE (Django).
(() => {
  const body = document.body;
  if (!body || body.dataset.realtimeEnabled !== "1") {
    return;
  }

  const lastKey = "aexfy_realtime_last_id";
  const lastId = window.localStorage.getItem(lastKey) || "";
  const url = new URL("/realtime/stream/", window.location.origin);
  if (lastId && /^[0-9]+$/.test(lastId)) {
    url.searchParams.set("since", lastId);
  }

  const source = new EventSource(url.toString());
  let recargaPendiente = null;

  const solicitarRecarga = () => {
    if (recargaPendiente) {
      return;
    }
    recargaPendiente = window.setTimeout(() => {
      window.location.reload();
    }, 300);
  };

  source.onmessage = (event) => {
    if (event.data) {
      try {
        const payload = JSON.parse(event.data);
        if (payload && payload.id) {
          window.localStorage.setItem(lastKey, String(payload.id));
        }
      } catch (error) {
        if (/^[0-9]+$/.test(event.data)) {
          window.localStorage.setItem(lastKey, event.data);
        }
      }
    }
    solicitarRecarga();
  };

  source.addEventListener("logout", () => {
    window.location.reload();
  });

  source.onerror = () => {
    if (source.readyState === EventSource.CLOSED) {
      window.setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  };
})();
