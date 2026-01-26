import os
import sys
from pathlib import Path

# Script de provisionamiento del usuario Owner en Supabase Auth.
# Usa settings.py y .env para cargar las llaves desde integraciones/supabase_client.py.

def configurar_django():
    # Agrega la raiz del proyecto al sys.path para importar aexfy_admin.
    raiz = Path(__file__).resolve().parent.parent
    if str(raiz) not in sys.path:
        sys.path.insert(0, str(raiz))
    # Define settings para que supabase_client lea SUPABASE_URL y SUPABASE_SERVICE_KEY.
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "aexfy_admin.settings")
    import django

    # Inicializa Django para que settings.py este disponible.
    django.setup()


def obtener_cliente_servicio():
    # Importa el cliente usando las credenciales de servicio del backend.
    from integraciones.supabase_client import get_supabase_service_client

    return get_supabase_service_client()


def buscar_usuario_por_email(cliente, email):
    # Busca usuarios existentes por email usando el Admin API.
    usuarios = cliente.auth.admin.list_users()
    if isinstance(usuarios, list):
        lista = usuarios
    else:
        # Algunas versiones retornan un objeto con atributo users.
        lista = getattr(usuarios, "users", [])

    for usuario in lista:
        if getattr(usuario, "email", None) == email:
            return usuario

    return None


def borrar_usuario_por_email(cliente, email):
    # Elimina el usuario si existe para evitar conflicto por email.
    usuario = buscar_usuario_por_email(cliente, email)
    if usuario:
        cliente.auth.admin.delete_user(usuario.id)
        return True

    return False


def crear_usuario_owner(cliente, email, password):
    # Crea el usuario en Auth via Admin API para que GoTrue lo reconozca.
    respuesta = cliente.auth.admin.create_user(
        {
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {
                "rut": "11.111.111-1",
                "full_name": "Aexfy Tech",
                "role": "AexfyOwner",
                "roles": ["AexfyOwner"],
            },
        }
    )

    # Algunas versiones retornan UserResponse con atributo user.
    usuario = getattr(respuesta, "user", None) or respuesta
    return usuario


def actualizar_usuario_owner(cliente, usuario_id, email, password):
    # Actualiza el usuario existente con metadata y password.
    respuesta = cliente.auth.admin.update_user_by_id(
        usuario_id,
        {
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {
                "rut": "11.111.111-1",
                "full_name": "Aexfy Tech",
                "role": "AexfyOwner",
                "roles": ["AexfyOwner"],
            },
        },
    )
    usuario = getattr(respuesta, "user", None) or respuesta
    return usuario


def main():
    # Datos del usuario Owner segun requerimientos del proyecto.
    email = "aexfytech@gmail.com"
    password = "a93]:y/#GAe1"

    configurar_django()
    cliente = obtener_cliente_servicio()

    # Busca usuario existente para decidir crear o actualizar.
    existente = buscar_usuario_por_email(cliente, email)
    if existente:
        usuario = actualizar_usuario_owner(cliente, existente.id, email, password)
        eliminado = False
        creado = False
    else:
        # Si no existe, intenta crear. Si falla, elimina y reintenta.
        creado = True
        eliminado = False
        try:
            usuario = crear_usuario_owner(cliente, email, password)
        except Exception as exc:
            # Ultimo recurso: elimina y reintenta una vez.
            eliminado = borrar_usuario_por_email(cliente, email)
            usuario = crear_usuario_owner(cliente, email, password)

    print("USUARIO_ID:", getattr(usuario, "id", "sin-id"))
    print("ELIMINADO_PREVIO:", eliminado)
    print("CREADO_NUEVO:", creado)
    print("\nEjecuta este SQL para sincronizar aexfy.usuarios:")
    print(
        """
update aexfy.usuarios
set auth_id = '%s',
    email = '%s',
    nombres = 'Aexfy',
    apellidos = 'Tech',
    rut = '11.111.111-1',
    tipo_usuario = 'staff_aexfy',
    estado = 'activo',
    metadatos = jsonb_build_object('role','AexfyOwner','roles',array['AexfyOwner']::text[],'full_name','Aexfy Tech'),
    actualizado_en = now()
where email = '%s';
"""
        % (usuario.id, email, email)
    )


if __name__ == "__main__":
    # Ejecuta el script de provisionamiento.
    main()
