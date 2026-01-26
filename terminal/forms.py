from django import forms


# Formulario simple para ejecutar SQL desde la terminal interna.
class TerminalSQLForm(forms.Form):
    sql = forms.CharField(
        label="Script SQL",
        widget=forms.Textarea(
            attrs={
                "rows": 10,
                "placeholder": "Escribe tu script SQL...",
                "autocomplete": "off",
            }
        ),
        required=True,
    )
