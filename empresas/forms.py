from django import forms

from personal.formatos import formatear_nombre, formatear_rut_staff, formatear_telefono


# Formulario de filtros para listar empresas.
class EmpresasFiltroForm(forms.Form):
    busqueda = forms.CharField(label="Buscar", required=False)
    estado = forms.ChoiceField(
        label="Estado",
        required=False,
        choices=[
            ("", "Todos"),
            ("activo", "Activo"),
            ("pendiente", "Pendiente"),
            ("bloqueado", "Bloqueado"),
            ("cancelado", "Cancelado"),
        ],
    )
    plan = forms.ChoiceField(
        label="Plan",
        required=False,
        choices=[
            ("", "Todos"),
            ("starter", "Starter"),
            ("pro", "Pro"),
            ("enterprise", "Enterprise"),
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


# Formulario para crear empresas y su usuario dueño.
class EmpresaCrearForm(forms.Form):
    rut = forms.CharField(label="RUT", max_length=12, required=True)
    razon_social = forms.CharField(label="Razon social", max_length=120, required=True)
    nombre_fantasia = forms.CharField(label="Nombre fantasia", max_length=120, required=False)
    giro = forms.CharField(label="Giro", max_length=120, required=False)
    segmento_id = forms.ChoiceField(label="Segmento", required=True)
    region_id = forms.ChoiceField(label="Region", required=True)
    ciudad = forms.CharField(label="Ciudad", max_length=80, required=False)
    comuna = forms.CharField(label="Comuna", max_length=80, required=False)
    direccion = forms.CharField(label="Direccion", max_length=180, required=False)
    telefono = forms.CharField(label="Telefono", max_length=20, required=False)
    email = forms.EmailField(label="Correo empresa", required=False)
    estado = forms.ChoiceField(
        label="Estado",
        required=True,
        choices=[
            ("activo", "Activo"),
            ("pendiente", "Pendiente"),
            ("bloqueado", "Bloqueado"),
            ("cancelado", "Cancelado"),
        ],
    )
    plan = forms.ChoiceField(
        label="Plan",
        required=True,
        choices=[
            ("starter", "Starter"),
            ("pro", "Pro"),
            ("enterprise", "Enterprise"),
        ],
    )
    owner_rut = forms.CharField(label="RUT dueño", max_length=12, required=True)
    owner_primer_nombre = forms.CharField(label="Primer nombre dueño", max_length=50, required=True)
    owner_segundo_nombre = forms.CharField(label="Segundo nombre dueño", max_length=50, required=False)
    owner_apellido_paterno = forms.CharField(label="Apellido paterno dueño", max_length=50, required=True)
    owner_apellido_materno = forms.CharField(label="Apellido materno dueño", max_length=50, required=False)
    owner_email = forms.EmailField(label="Correo dueño", required=True)
    owner_telefono = forms.CharField(label="Telefono dueño", max_length=20, required=True)
    zona = forms.ChoiceField(
        label="Zona",
        required=False,
        choices=[
            ("", "Automatica"),
            ("NG", "NG"),
            ("NC", "NC"),
            ("CT", "CT"),
            ("SR", "SR"),
            ("AU", "AU"),
        ],
    )

    def __init__(self, *args, **kwargs):
        # Recibe listas de segmentos y regiones para poblar los selects.
        segmentos = kwargs.pop("segmentos", [])
        regiones = kwargs.pop("regiones", [])
        super().__init__(*args, **kwargs)

        # Admite listas de dicts o tuplas segun la RPC disponible.
        segmentos_opciones = [("", "Selecciona...")]
        for segmento in segmentos:
            if isinstance(segmento, dict):
                segmentos_opciones.append((str(segmento.get("id")), segmento.get("nombre")))
            else:
                segmentos_opciones.append((str(segmento[0]), segmento[1]))

        regiones_opciones = [("", "Selecciona...")]
        for region in regiones:
            if isinstance(region, dict):
                regiones_opciones.append((str(region.get("id")), region.get("nombre")))
            else:
                regiones_opciones.append((str(region[0]), region[1]))

        self.fields["segmento_id"].choices = segmentos_opciones
        self.fields["region_id"].choices = regiones_opciones

        # Formato para RUT y telefono.
        self.fields["rut"].widget.attrs.update(
            {
                "data-formato": "rut",
                "placeholder": "11.111.111-1",
                "autocomplete": "off",
            }
        )
        self.fields["owner_rut"].widget.attrs.update(
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
        self.fields["owner_telefono"].widget.attrs.update(
            {
                "data-formato": "telefono",
                "placeholder": "9 1234 5678",
                "inputmode": "numeric",
                "autocomplete": "off",
            }
        )

        # Formato para nombres del duenio.
        for campo in [
            "owner_primer_nombre",
            "owner_segundo_nombre",
            "owner_apellido_paterno",
            "owner_apellido_materno",
        ]:
            self.fields[campo].widget.attrs.update(
                {
                    "data-formato": "nombre",
                    "autocomplete": "off",
                }
            )

    def clean_email(self):
        return (self.cleaned_data.get("email", "") or "").strip().lower()

    def clean_owner_email(self):
        return (self.cleaned_data.get("owner_email", "") or "").strip().lower()

    def clean_rut(self):
        rut_formateado = formatear_rut_staff(self.cleaned_data.get("rut", ""))
        if not rut_formateado:
            raise forms.ValidationError("RUT invalido. Usa el formato XX.XXX.XXX-X/K.")
        return rut_formateado

    def clean_owner_rut(self):
        rut_formateado = formatear_rut_staff(self.cleaned_data.get("owner_rut", ""))
        if not rut_formateado:
            raise forms.ValidationError("RUT dueño invalido. Usa el formato XX.XXX.XXX-X/K.")
        return rut_formateado

    def clean_owner_primer_nombre(self):
        return formatear_nombre(self.cleaned_data.get("owner_primer_nombre", ""))

    def clean_owner_segundo_nombre(self):
        valor = self.cleaned_data.get("owner_segundo_nombre", "")
        return formatear_nombre(valor) if valor else ""

    def clean_owner_apellido_paterno(self):
        return formatear_nombre(self.cleaned_data.get("owner_apellido_paterno", ""))

    def clean_owner_apellido_materno(self):
        valor = self.cleaned_data.get("owner_apellido_materno", "")
        return formatear_nombre(valor) if valor else ""

    def clean_telefono(self):
        valor = self.cleaned_data.get("telefono", "")
        if not valor:
            return ""
        formateado = formatear_telefono(valor)
        if not formateado:
            raise forms.ValidationError("Telefono invalido. Ingresa 9 1234 5678.")
        return formateado

    def clean_owner_telefono(self):
        formateado = formatear_telefono(self.cleaned_data.get("owner_telefono", ""))
        if not formateado:
            raise forms.ValidationError("Telefono dueño invalido. Ingresa 9 1234 5678.")
        return formateado


# Formulario para editar empresas existentes.
class EmpresaEditarForm(EmpresaCrearForm):
    company_code = forms.CharField(label="Codigo interno", required=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # En edicion, los datos del duenio no se modifican desde este formulario.
        for campo in [
            "owner_rut",
            "owner_primer_nombre",
            "owner_segundo_nombre",
            "owner_apellido_paterno",
            "owner_apellido_materno",
            "owner_email",
            "owner_telefono",
        ]:
            if campo in self.fields:
                self.fields[campo].required = False
        # El codigo interno se muestra pero no se edita.
        self.fields["company_code"].widget.attrs.update({"readonly": "readonly"})
