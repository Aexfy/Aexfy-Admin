from django import forms


# Filtros simples para solicitudes.
class SolicitudesFiltroForm(forms.Form):
    estado = forms.ChoiceField(
        required=False,
        choices=(
            ("", "Todos"),
            ("pendiente", "Pendiente"),
            ("aprobado", "Aprobado"),
            ("rechazado", "Rechazado"),
        ),
        label="Estado",
    )
    tipo = forms.ChoiceField(
        required=False,
        choices=(
            ("", "Todos"),
            ("company", "Empresa"),
            ("staff", "Staff"),
        ),
        label="Tipo",
    )


# Formulario simple para aprobar o rechazar solicitudes.
class SolicitudDecisionForm(forms.Form):
    decision_note = forms.CharField(required=False, label="Nota de decision")
