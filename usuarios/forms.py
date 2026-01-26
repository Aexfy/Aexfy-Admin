from django import forms

from personal.formatos import formatear_nombre, formatear_rut_staff, formatear_telefono
from cuentas.permisos import puede_asignar_rol_staff
from usuarios.roles import obtener_roles_disponibles

# Formulario de filtros para listar usuarios.
class UsuariosFiltroForm(forms.Form):
    busqueda = forms.CharField(label="Buscar", required=False)
    estado = forms.ChoiceField(
        label="Estado",
        required=False,
        choices=[
            ("", "Todos"),
            ("activo", "Activo"),
            ("inactivo", "Inactivo"),
            ("suspendido", "Suspendido"),
        ],
    )
    tipo_usuario = forms.ChoiceField(
        label="Tipo",
        required=False,
        choices=[
            ("", "Todos"),
            ("staff_aexfy", "Staff AEXFY"),
            ("propietario_cliente", "Propietario cliente"),
            ("trabajador_cliente", "Trabajador cliente"),
        ],
    )
    zona = forms.ChoiceField(
        label="Zona",
        required=False,
        choices=[
            ("", "Todas"),
            ("NG", "NG"),
            ("NC", "NC"),
            ("CT", "CT"),
            ("SR", "SR"),
            ("AU", "AU"),
        ],
    )
    rol = forms.ChoiceField(label="Rol", required=False)

    def __init__(self, *args, roles_sesion=None, **kwargs):
        super().__init__(*args, **kwargs)
        include_owner = bool(roles_sesion and "AexfyOwner" in roles_sesion)
        # Filtra roles segun permisos del usuario en sesion (cuentas/permisos.py).
        roles_disponibles = obtener_roles_disponibles(include_owner=include_owner)
        if roles_sesion:
            roles_disponibles = [
                rol for rol in roles_disponibles if puede_asignar_rol_staff(roles_sesion, rol[0])
            ]
        self.fields["rol"].choices = [("", "Todos")] + roles_disponibles


# Formulario para crear usuarios (staff) desde el modulo de usuarios.
class UsuarioCrearForm(forms.Form):
    rut = forms.CharField(label="RUT", max_length=12, required=True)
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
        super().__init__(*args, **kwargs)
        include_owner = bool(roles_sesion and "AexfyOwner" in roles_sesion)
        # Filtra roles segun permisos del usuario en sesion (cuentas/permisos.py).
        roles_disponibles = obtener_roles_disponibles(include_owner=include_owner)
        if roles_sesion:
            roles_disponibles = [
                rol for rol in roles_disponibles if puede_asignar_rol_staff(roles_sesion, rol[0])
            ]
        self.fields["rol"].choices = roles_disponibles
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

    def clean_email(self):
        return (self.cleaned_data.get("email", "") or "").strip().lower()

    def clean_rut(self):
        rut_formateado = formatear_rut_staff(self.cleaned_data.get("rut", ""))
        if not rut_formateado:
            raise forms.ValidationError("RUT invalido. Usa el formato XX.XXX.XXX-X/K.")
        return rut_formateado

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

    def clean_telefono(self):
        formateado = formatear_telefono(self.cleaned_data.get("telefono", ""))
        if not formateado:
            raise forms.ValidationError("Telefono invalido. Ingresa 9 1234 5678.")
        return formateado

    def clean_telefono_emergencia(self):
        valor = self.cleaned_data.get("telefono_emergencia", "")
        if not valor:
            return ""
        formateado = formatear_telefono(valor)
        if not formateado:
            raise forms.ValidationError("Telefono de emergencia invalido. Ingresa 9 1234 5678.")
        return formateado


# Formulario para editar usuarios existentes.
class UsuarioEditarForm(forms.Form):
    rut = forms.CharField(label="RUT", max_length=12, required=True)
    email = forms.EmailField(label="Correo", required=True)
    primer_nombre = forms.CharField(label="Primer nombre", max_length=50, required=True)
    segundo_nombre = forms.CharField(label="Segundo nombre", max_length=50, required=False)
    apellido_paterno = forms.CharField(label="Apellido paterno", max_length=50, required=True)
    apellido_materno = forms.CharField(label="Apellido materno", max_length=50, required=False)
    telefono = forms.CharField(label="Numero", max_length=20, required=True)
    telefono_emergencia = forms.CharField(label="Numero de emergencia", max_length=20, required=False)
    estado = forms.ChoiceField(
        label="Estado",
        required=True,
        choices=[
            ("activo", "Activo"),
            ("inactivo", "Inactivo"),
            ("suspendido", "Suspendido"),
        ],
    )
    tipo_usuario = forms.ChoiceField(
        label="Tipo",
        required=True,
        choices=[
            ("staff_aexfy", "Staff AEXFY"),
            ("propietario_cliente", "Propietario cliente"),
            ("trabajador_cliente", "Trabajador cliente"),
        ],
    )
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
    rol = forms.ChoiceField(label="Rol", required=True)

    def __init__(self, *args, roles_sesion=None, **kwargs):
        super().__init__(*args, **kwargs)
        include_owner = bool(roles_sesion and "AexfyOwner" in roles_sesion)
        # Filtra roles segun permisos del usuario en sesion (cuentas/permisos.py).
        roles_disponibles = obtener_roles_disponibles(include_owner=include_owner)
        if roles_sesion:
            roles_disponibles = [
                rol for rol in roles_disponibles if puede_asignar_rol_staff(roles_sesion, rol[0])
            ]
        self.fields["rol"].choices = roles_disponibles
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
        self.fields["email"].widget.attrs.update({"readonly": "readonly"})
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

    def clean_email(self):
        return (self.cleaned_data.get("email", "") or "").strip().lower()

    def clean_rut(self):
        rut_formateado = formatear_rut_staff(self.cleaned_data.get("rut", ""))
        if not rut_formateado:
            raise forms.ValidationError("RUT invalido. Usa el formato XX.XXX.XXX-X/K.")
        return rut_formateado

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

    def clean_telefono(self):
        formateado = formatear_telefono(self.cleaned_data.get("telefono", ""))
        if not formateado:
            raise forms.ValidationError("Telefono invalido. Ingresa 9 1234 5678.")
        return formateado

    def clean_telefono_emergencia(self):
        valor = self.cleaned_data.get("telefono_emergencia", "")
        if not valor:
            return ""
        formateado = formatear_telefono(valor)
        if not formateado:
            raise forms.ValidationError("Telefono de emergencia invalido. Ingresa 9 1234 5678.")
        return formateado
