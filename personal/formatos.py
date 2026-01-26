import re

from cuentas.formatos import formatear_rut

# Patron para telefono en formato guardado: +56 9 1234 5678
PATRON_TELEFONO = re.compile(r"^\+56 9 \d{4} \d{4}$")

# Normaliza espacios y capitaliza cada palabra; se usa en formularios de personal.
def formatear_nombre(texto: str) -> str:
    # Elimina espacios duplicados y aplica mayuscula inicial por palabra.
    partes = [p for p in (texto or "").strip().split(" ") if p]
    return " ".join(p[:1].upper() + p[1:].lower() for p in partes)


# Formatea telefono chileno; entrada esperada: 9 1234 5678 (solo digitos).
def formatear_telefono(telefono_crudo: str) -> str | None:
    # Quita todo lo que no sea digito.
    digitos = re.sub(r"\D", "", telefono_crudo or "")

    # Si viene con 56 al inicio, lo elimina para normalizar.
    if digitos.startswith("56"):
        digitos = digitos[2:]

    # Debe tener 9 digitos y comenzar con 9.
    if len(digitos) != 9 or not digitos.startswith("9"):
        return None

    # Construye el formato final que se guarda en BD.
    formateado = f"+56 {digitos[0]} {digitos[1:5]} {digitos[5:9]}"
    if not PATRON_TELEFONO.match(formateado):
        return None

    return formateado


# Valida y formatea RUT reutilizando la regla oficial del sistema.
def formatear_rut_staff(rut_crudo: str) -> str | None:
    # Reusa la funcion de cuentas para mantener consistencia con login.
    return formatear_rut(rut_crudo)
