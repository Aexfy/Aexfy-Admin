// Formateo automatico para RUT, nombres y telefono en el modulo de personal.
// Se conecta con personal/forms.py y personal/templates/personal/crear_staff.html.

function limpiarRut(valor) {
  return (valor || "").replace(/[^0-9kK]/g, "").toUpperCase();
}

function formatearRutParcial(valor) {
  var rut = limpiarRut(valor);
  if (rut.length === 0) {
    return "";
  }
  if (rut.length === 1) {
    return rut;
  }

  var cuerpo = rut.slice(0, -1);
  var dv = rut.slice(-1);
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

function limpiarTelefono(valor) {
  return (valor || "").replace(/\D/g, "");
}

function formatearTelefonoParcial(valor) {
  var digitos = limpiarTelefono(valor);
  if (digitos.startsWith("56")) {
    digitos = digitos.slice(2);
  }
  if (digitos.length === 0) {
    return "";
  }
  if (digitos.length <= 1) {
    return digitos;
  }

  var parte1 = digitos.slice(0, 1);
  var parte2 = digitos.slice(1, 5);
  var parte3 = digitos.slice(5, 9);

  var resultado = parte1;
  if (parte2) {
    resultado += " " + parte2;
  }
  if (parte3) {
    resultado += " " + parte3;
  }
  return resultado;
}

function limpiarNombre(valor) {
  return (valor || "").trim().replace(/\s+/g, " ");
}

function capitalizarNombre(valor) {
  var limpio = limpiarNombre(valor);
  if (!limpio) {
    return "";
  }
  return limpio
    .split(" ")
    .map(function (parte) {
      return parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase();
    })
    .join(" ");
}

function activarFormato() {
  var rutCampos = document.querySelectorAll("input[data-formato='rut']");
  rutCampos.forEach(function (campo) {
    var formatear = function () {
      campo.value = formatearRutParcial(campo.value);
    };
    campo.addEventListener("input", formatear);
    campo.addEventListener("blur", formatear);
  });

  var telCampos = document.querySelectorAll("input[data-formato='telefono']");
  telCampos.forEach(function (campo) {
    var formatear = function () {
      campo.value = formatearTelefonoParcial(campo.value);
    };
    campo.addEventListener("input", formatear);
    campo.addEventListener("blur", formatear);
  });

  var nombreCampos = document.querySelectorAll("input[data-formato='nombre']");
  nombreCampos.forEach(function (campo) {
    var formatear = function () {
      campo.value = capitalizarNombre(campo.value);
    };
    campo.addEventListener("blur", formatear);
  });
}

document.addEventListener("DOMContentLoaded", activarFormato);
