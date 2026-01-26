import json
import time

from django.http import StreamingHttpResponse

from integraciones.supabase_client import get_supabase_service_client


def _obtener_ultimo_evento_id(cliente):
    try:
        respuesta = (
            cliente.schema("public")
            .table("realtime_events")
            .select("id")
            .order("id", desc=True)
            .limit(1)
            .execute()
        )
        if respuesta.data:
            return int(respuesta.data[0].get("id", 0))
    except Exception:
        return None
    return None


def realtime_stream_view(request):
    if not request.session.get("supabase_access_token"):
        return StreamingHttpResponse(status=401)

    cliente = get_supabase_service_client()
    since_param = request.GET.get("since", "")
    try:
        last_id = int(since_param)
    except (TypeError, ValueError):
        last_id = None

    def stream():
        nonlocal last_id
        ping_at = time.monotonic()
        yield "retry: 3000\n\n"

        while True:
            if not request.session.get("supabase_access_token"):
                yield "event: logout\ndata: {}\n\n"
                break

            ultimo_id = _obtener_ultimo_evento_id(cliente)
            if ultimo_id is not None:
                if last_id is None or ultimo_id > last_id:
                    last_id = ultimo_id
                    payload = json.dumps({"id": last_id})
                    yield f"data: {payload}\n\n"

            ahora = time.monotonic()
            if ahora - ping_at > 15:
                ping_at = ahora
                yield ": ping\n\n"

            time.sleep(2)

    response = StreamingHttpResponse(stream(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response
