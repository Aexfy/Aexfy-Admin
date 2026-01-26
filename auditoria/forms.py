from django import forms


# Filtros simples para la vista de auditoria.
class AuditoriaFiltroForm(forms.Form):
    busqueda = forms.CharField(required=False, label="Buscar")
    severidad = forms.ChoiceField(
        required=False,
        choices=(
            ("", "Todas"),
            ("baja", "Baja"),
            ("media", "Media"),
            ("alta", "Alta"),
            ("critica", "Critica"),
        ),
        label="Severidad",
    )
    fecha_desde = forms.DateTimeField(
        required=False,
        label="Desde",
        input_formats=["%Y-%m-%dT%H:%M"],
        widget=forms.DateTimeInput(attrs={"type": "datetime-local"}),
    )
    fecha_hasta = forms.DateTimeField(
        required=False,
        label="Hasta",
        input_formats=["%Y-%m-%dT%H:%M"],
        widget=forms.DateTimeInput(attrs={"type": "datetime-local"}),
    )
