# OwnerCliente - Guia de datos y fuentes

Esta guia documenta **de donde obtener datos** para la futura interfaz del portal **OwnerCliente** (dueno de empresa).

## 1) Identidad del OwnerCliente (usuario logeado)
**Tabla:** `aexfy.usuarios`
- Clave: `id` (UUID interno)
- Auth: `auth_id` (UUID de Supabase Auth en `auth.users`)
- Tipo: `tipo_usuario = 'propietario_cliente'`
- Vinculo empresa: `cliente_id` (FK a `aexfy.clientes`)
- Datos personales: `email`, `rut`, `nombres`, `apellidos`, `telefono`, `estado`
- Metadatos: `metadatos` (contiene `role`, `roles`, `full_name`, `invite_link` si aplica)

**Regla de aislamiento:** todo lo que vea el OwnerCliente debe filtrarse por `cliente_id` de su sesion.

**Login recomendado:**
- Usar Supabase Auth con `email` y password.
- Al autenticar, obtener `aexfy.usuarios` por `auth_id` o `email` y validar `tipo_usuario`.
- Si `tipo_usuario != 'staff_aexfy'`, redirigir al portal OwnerCliente (no a Admin).

---

## 2) Datos de la empresa
**Tabla:** `aexfy.clientes`
Campos principales:
- Identidad: `id`, `rut`, `company_code`
- Razon social / nombre fantasia: `razon_social`, `nombre_fantasia`
- Giro: `giro`
- Segmento: `segmento_id` (FK `aexfy.segmentos_industriales`)
- Region: `region_id` (FK `aexfy.regiones_chile`) y campos de texto `region`, `ciudad`, `comuna`
- Direccion: `direccion`
- Contacto: `telefono`, `email`, `email_tributario`
- Estado / plan: `estado`, `plan`
- Asignaciones: `owner_email`, `seller_email`
- Zona: `zona` (NG/NC/CT/SR/AU)

**Filtro:** `where id = usuario.cliente_id`

---

## 3) Configuracion del portal Owner
**Tabla:** `aexfy.configuraciones_owner`
- `cliente_id` (PK, FK a `aexfy.clientes`)
- `url_portal` (para el dominio propio del cliente)
- `marca` (JSON con colores, logo, etc.)
- `configuracion_seguridad` (JSON)
- `sucursal_predeterminada`

---

## 4) Sucursales del cliente
**Tabla:** `aexfy.sucursales`
- `cliente_id` (FK)
- Datos: `nombre`, `ubicacion`, `region_id`, `ciudad`, `comuna`, `direccion`, `telefono`, `estado`

**Filtro:** `where cliente_id = usuario.cliente_id`

---

## 5) Usuarios del cliente (propietarios y trabajadores)
**Tabla:** `aexfy.usuarios`
- `tipo_usuario` in (`'propietario_cliente'`, `'trabajador_cliente'`)
- Vinculo empresa: `cliente_id`

**Filtro:** `where cliente_id = usuario.cliente_id`

**Roles de cliente**
- `aexfy.roles` (alcance = 'cliente')
- `aexfy.asignaciones_roles_usuarios` vincula `usuarios` con `roles`

---

## 6) Tickets / Soporte
**Tabla:** `aexfy.tickets_soporte`
- Vinculo empresa: `cliente_id`
- Vinculo sucursal: `sucursal_id`
- `creado_por` y `asignado_a` (FK `aexfy.usuarios`)
- `estado`, `prioridad`, `resumen`, `detalles`, `resolucion`

**Filtro:** `where cliente_id = usuario.cliente_id`

---

## 7) Solicitudes (flujo interno)
**Tabla:** `aexfy.solicitudes`
- `enviado_por`, `cliente_objetivo`, `sucursal_objetivo`
- `estado`, `prioridad`, `descripcion`, `metadatos`

**Filtro:** `where cliente_objetivo = usuario.cliente_id`

> Nota: existe tambien `aexfy.requests` (flujo admin/servicio). Para portal cliente, usar `aexfy.solicitudes`.

---

## 8) Controles y cumplimiento
**Tablas:**
- `aexfy.controles_cumplimiento` (catalogo)
- `aexfy.controles_ejecutados` (por cliente)
- `aexfy.evidencias_cumplimiento` (archivos / evidencias)

**Filtro:** `controles_ejecutados.cliente_id = usuario.cliente_id`

---

## 9) Auditoria (solo si se expone)
**Tabla:** `aexfy.eventos_auditoria`
- `actor_id`, `accion`, `tabla_objetivo`, `id_objetivo`, `metadatos`

**Filtro recomendado:** solo eventos del cliente (`metadatos` puede incluir `cliente_id` si se desea).

---

## 10) Creacion de empresa + Owner (referencia tecnica)
**RPC existente:** `public.crear_empresa_con_owner_admin(...)`
- Inserta la empresa en `aexfy.clientes`
- Inserta el Owner en `aexfy.usuarios` con `tipo_usuario = 'propietario_cliente'`
- Asigna rol de cliente en `aexfy.roles` y `aexfy.asignaciones_roles_usuarios`

Esto sirve como referencia de **campos obligatorios** para el OwnerCliente.

---

## 11) Reglas de validacion
**Tabla:** `aexfy.reglas_validacion`
- Ej: `usuarios.email`, `usuarios.telefono`, `clientes.rut`.

---

## 12) Recomendacion de endpoints futuros (portal cliente)
- **/owner/inicio**: resumen empresa + usuario
- **/owner/empresa**: datos empresa
- **/owner/sucursales**: CRUD sucursales
- **/owner/usuarios**: CRUD usuarios cliente
- **/owner/tickets**: listado + detalle
- **/owner/solicitudes**: crear/seguimiento
- **/owner/cumplimiento**: controles y evidencias

---

## Checklist rapido para integracion
- [ ] Validar `tipo_usuario` y redirigir si intenta entrar a Admin.
- [ ] Derivar `cliente_id` desde `aexfy.usuarios`.
- [ ] Filtrar todo por `cliente_id`.
- [ ] Usar `configuraciones_owner` para branding y url.
