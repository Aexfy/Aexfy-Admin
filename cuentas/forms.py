from django import forms

from cuentas.formatos import formatear_rut

# Formulario de login; formatea RUT segun reglas y valida credenciales en la vista.
class LoginForm(forms.Form):
    # RUT se usa como identificador visual; se formatea antes de consultar Supabase.
    rut = forms.CharField(
        label="RUT",
        max_length=12,
        required=True,
        help_text="Formato: XX.XXX.XXX-X/K",
    )
    # Password se mantiene como campo seguro; se envia a Supabase Auth.
    password = forms.CharField(
        label="Contrasena",
        widget=forms.PasswordInput,
        required=True,
    )

    def __init__(self, *args, **kwargs):
        # Configura atributos HTML para coordinar con cuentas/templates/cuentas/login.html.
        super().__init__(*args, **kwargs)
        # data-formato conecta con cuentas/static/cuentas/js/formatos.js para formateo automatico.
        self.fields["rut"].widget.attrs.update(
            {
                "data-formato": "rut",
                "inputmode": "text",
                "autocomplete": "username",
                "placeholder": "11.111.111-1",
            }
        )
        # Indica el autocomplete de la contrasena para navegadores.
        self.fields["password"].widget.attrs.update({"autocomplete": "current-password"})

    # Limpia y formatea el RUT para que coincida con el registro en aexfy.usuarios.
    def clean_rut(self):
        # Usa formatear_rut para asegurar consistencia con DB_Aexfy.db.
        rut_formateado = formatear_rut(self.cleaned_data.get("rut", ""))
        if not rut_formateado:
            raise forms.ValidationError("RUT invalido. Usa el formato XX.XXX.XXX-X/K.")
        return rut_formateado
