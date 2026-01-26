from django import forms

from personal.formatos import formatear_nombre, formatear_rut_staff, formatear_telefono
from cuentas.permisos import puede_asignar_rol_staff
from personal.services import obtener_roles_disponibles

# Formulario para crear usuarios de staff; valida y formatea campos antes de guardar.
class CrearStaffForm(forms.Form):
    rut = forms.CharField(
        label="RUT",
        max_length=12,
        required=True,
        help_text="Formato: XX.XXX.XXX-X/K",
    )
    email = forms.EmailField(label="Correo", required=True)
    primer_nombre = forms.CharField(label="Primer nombre", max_length=50, required=True)
    segundo_nombre = forms.CharField(label="Segundo nombre", max_length=50, required=False)
    apellido_paterno = forms.CharField(label="Apellido paterno", max_length=50, required=True)
    apellido_materno = forms.CharField(label="Apellido materno", max_length=50, required=False)
    telefono = forms.CharField(label="Numero", max_length=20, required=True)
    telefono_emergencia = forms.CharField(label="Numero de emergencia", max_length=20, required=False)
    rol = forms.ChoiceField(label="Rol", required=True)
    zona = forms.ChoiceField(
        label="Zona",
        required=True,
        choices=[
            ("NG", "NG"),
            ("NC", "NC"),
            ("CT", "CT"),
            ("SR", "SR"),
            ("AU", "AU"),
        ],
    )

    def __init__(self, *args, roles_sesion=None, **kwargs):
        # Configura atributos HTML y opciones de rol desde roles.txt.
        super().__init__(*args, **kwargs)
        include_owner = bool(roles_sesion and "AexfyOwner" in roles_sesion)
        # Filtra roles segun permisos del usuario en sesion (cuentas/permisos.py).
        roles_disponibles = obtener_roles_disponibles(include_owner=include_owner)
        if roles_sesion:
            roles_disponibles = [
                rol for rol in roles_disponibles if puede_asignar_rol_staff(roles_sesion, rol[0])
            ]
        self.fields["rol"].choices = roles_disponibles
        # data-formato conecta con personal/static/personal/js/formatos.js.
        self.fields["rut"].widget.attrs.update(
            {
                "data-formato": "rut",
                "placeholder": "11.111.111-1",
                "autocomplete": "off",
            }
        )
        self.fields["telefono"].widget.attrs.update(
            {
                "data-formato": "telefono",
                "placeholder": "9 1234 5678",
                "inputmode": "numeric",
                "autocomplete": "off",
            }
        )
        self.fields["telefono_emergencia"].widget.attrs.update(
            {
                "data-formato": "telefono",
                "placeholder": "9 1234 5678",
                "inputmode": "numeric",
                "autocomplete": "off",
            }
        )
        # data-formato para nombres y apellidos.
        for campo in [
            "primer_nombre",
            "segundo_nombre",
            "apellido_paterno",
            "apellido_materno",
        ]:
            self.fields[campo].widget.attrs.update(
                {
                    "data-formato": "nombre",
                    "autocomplete": "off",
                }
            )

    # Limpia y normaliza correo.
    def clean_email(self):
        return (self.cleaned_data.get("email", "") or "").strip().lower()

    # Formatea y valida RUT segun la regla del sistema.
    def clean_rut(self):
        rut_formateado = formatear_rut_staff(self.cleaned_data.get("rut", ""))
        if not rut_formateado:
            raise forms.ValidationError("RUT invalido. Usa el formato XX.XXX.XXX-X/K.")
        return rut_formateado

    # Formatea nombres y apellidos para cumplir regla de mayus/minus.
    def clean_primer_nombre(self):
        return formatear_nombre(self.cleaned_data.get("primer_nombre", ""))

    def clean_segundo_nombre(self):
        valor = self.cleaned_data.get("segundo_nombre", "")
        return formatear_nombre(valor) if valor else ""

    def clean_apellido_paterno(self):
        return formatear_nombre(self.cleaned_data.get("apellido_paterno", ""))

    def clean_apellido_materno(self):
        valor = self.cleaned_data.get("apellido_materno", "")
        return formatear_nombre(valor) if valor else ""

    # Formatea telefono principal al formato +56 9 1234 5678.
    def clean_telefono(self):
        formateado = formatear_telefono(self.cleaned_data.get("telefono", ""))
        if not formateado:
            raise forms.ValidationError("Telefono invalido. Ingresa 9 1234 5678.")
        return formateado

    # Formatea telefono de emergencia si se ingresa.
    def clean_telefono_emergencia(self):
        valor = self.cleaned_data.get("telefono_emergencia", "")
        if not valor:
            return ""
        formateado = formatear_telefono(valor)
        if not formateado:
            raise forms.ValidationError("Telefono de emergencia invalido. Ingresa 9 1234 5678.")
        return formateado
