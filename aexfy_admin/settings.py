from pathlib import Path
import os

# BASE_DIR se comparte con settings.py, manage.py y cualquier app para rutas base.
BASE_DIR = Path(__file__).resolve().parent.parent

# Carga variables desde .env para que settings.py y supabase_client.py compartan credenciales.
ENV_PATH = BASE_DIR / ".env"
if ENV_PATH.exists():
    try:
        from dotenv import load_dotenv

        # load_dotenv permite que settings.py lea las llaves usadas por integraciones/supabase_client.py.
        load_dotenv(ENV_PATH)
    except Exception:
        # Si python-dotenv no esta instalado, se omite y se usan variables del entorno.
        pass

# Clave secreta de Django usada por sesiones, hashes y middlewares configurados abajo.
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "insecure-dev-key")

# Modo debug para desarrollo; influye en urls.py y manejo de errores.
DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"

# Hosts permitidos; afecta seguridad del servidor y los requests entrantes.
ALLOWED_HOSTS = [h for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h]

# Apps instaladas; incluye integraciones para conectar con Supabase.
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "integraciones",
    "cuentas",
    "personal",
    "usuarios",
    "empresas",
    "solicitudes",
    "auditoria",
    "reportes",
    "terminal",
]

# Middlewares base; trabajan junto a urls.py y las vistas que se agreguen luego.
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# Enlace principal de rutas; urls.py define endpoints del proyecto.
ROOT_URLCONF = "aexfy_admin.urls"

# Plantillas; se usaran en vistas de futuras apps y en el admin de Django.
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        # Incluye templates globales como aexfy_admin/templates/base.html.
        "DIRS": [BASE_DIR / "aexfy_admin" / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "cuentas.context_processors.permisos_nav",
            ],
        },
    }
]

# WSGI para despliegue tradicional; wsgi.py importa esta configuracion.
WSGI_APPLICATION = "aexfy_admin.wsgi.application"

# Base de datos local para Django; DB_Aexfy.db es el script del modelo ER principal.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "django_local.sqlite3",
    }
}

# Validadores de contrasenas; trabajan con auth y formularios futuros.
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Configuracion regional usada por formularios y plantillas.
LANGUAGE_CODE = "es-cl"
TIME_ZONE = "America/Santiago"
USE_I18N = True
USE_TZ = True

# Archivos estaticos para front y admin; se usaran en templates.
STATIC_URL = "static/"
# Carpeta de estaticos globales para base.css y otros estilos compartidos.
STATICFILES_DIRS = [BASE_DIR / "aexfy_admin" / "static"]

# Campo por defecto para modelos; aplica a apps futuras.
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Variables de Supabase compartidas con integraciones/supabase_client.py.
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
# URL de redireccion para invitaciones; apunta a la vista de activacion de contrasena.
SUPABASE_INVITE_REDIRECT_URL = os.environ.get("SUPABASE_INVITE_REDIRECT_URL", "")
