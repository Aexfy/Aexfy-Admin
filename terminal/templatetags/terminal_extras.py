from django import template

register = template.Library()


# Devuelve un valor de diccionario por clave; usado en terminal/sql.html.
@register.filter
def get_item(diccionario, clave):
    if isinstance(diccionario, dict):
        return diccionario.get(clave, "")
    return ""
