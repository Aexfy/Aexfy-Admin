import re

# Patron base del RUT; debe coincidir con la restriccion en DB_Aexfy.db para consistencia.
PATRON_RUT = re.compile(r"^[0-9]{1,2}(\.[0-9]{3}){2}-[0-9K]$")


# Normaliza texto para RUT quitando caracteres no validos; se usa en formularios y login.
def limpiar_rut(rut_crudo: str) -> str:
    # Solo permite digitos y K; asegura mayuscula para la comparacion.
    return re.sub(r"[^0-9kK]", "", rut_crudo or "").upper()


# Formatea el RUT al formato XX.XXX.XXX-X/K; devuelve None si es invalido.
def formatear_rut(rut_crudo: str) -> str | None:
    # Limpia la entrada del formulario para cumplir el formato exigido en reglas y BD.
    rut_limpio = limpiar_rut(rut_crudo)
    if len(rut_limpio) < 2:
        return None

    # Separa cuerpo y digito verificador.
    cuerpo = rut_limpio[:-1]
    dv = rut_limpio[-1]

    # Valida que el cuerpo sean solo digitos y DV valido.
    if not cuerpo.isdigit() or dv not in "0123456789K":
        return None

    # Aplica puntos cada 3 digitos desde la derecha.
    grupos = []
    while cuerpo:
        grupos.insert(0, cuerpo[-3:])
        cuerpo = cuerpo[:-3]

    rut_formateado = f"{'.'.join(grupos)}-{dv}"

    # Verifica que el formato final coincida con la regex de la BD.
    if not PATRON_RUT.match(rut_formateado):
        return None

    return rut_formateado
