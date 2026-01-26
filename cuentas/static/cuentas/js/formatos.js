// Formateo automatico del RUT en el front; se usa desde cuentas/templates/cuentas/login.html
// y complementa la validacion server-side en cuentas/forms.py.

// Devuelve solo digitos y K; asegura mayuscula y elimina caracteres no validos.
function limpiarRut(valor) {
  return (valor || "").replace(/[^0-9kK]/g, "").toUpperCase();
}

// Formatea el RUT al formato XX.XXX.XXX-X/K de forma progresiva.
function formatearRutParcial(valor) {
  var rut = limpiarRut(valor);
  if (rut.length === 0) {
    return "";
  }

  // Si no hay digito verificador aun, solo formatea el cuerpo.
  if (rut.length === 1) {
    return rut;
  }

  var cuerpo = rut.slice(0, -1);
  var dv = rut.slice(-1);

  // Separa el cuerpo en grupos de 3 desde la derecha.
  var grupos = [];
  while (cuerpo.length > 3) {
    grupos.unshift(cuerpo.slice(-3));
    cuerpo = cuerpo.slice(0, -3);
  }
  if (cuerpo.length) {
    grupos.unshift(cuerpo);
  }

  return grupos.join(".") + "-" + dv;
}

// Aplica el formateo en inputs con data-formato="rut".
function activarFormateoRut() {
  var campos = document.querySelectorAll("input[data-formato='rut']");
  if (!campos.length) {
    return;
  }

  campos.forEach(function (campo) {
    // Formatea al escribir y al salir del campo para asegurar consistencia.
    var formatear = function () {
      campo.value = formatearRutParcial(campo.value);
    };

    campo.addEventListener("input", formatear);
    campo.addEventListener("blur", formatear);
  });
}

// Ejecuta al cargar el DOM para enlazar con el formulario de login.
document.addEventListener("DOMContentLoaded", activarFormateoRut);
