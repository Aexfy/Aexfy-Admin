# Plan de pruebas - AEXFY Admin

Este documento se actualiza a medida que avanzamos. Marcar [x] cuando se complete.

## 0) Preparacion
- [x] Verificar variables .env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, etc.).
- [x] `py manage.py runserver` sin errores en consola.
- [x] Usuario admin activo (RUT 11.111.111-1) puede iniciar sesion.
- [x] Carga de estilos base (texturas, nav, botones, formularios).

## 1) Navegacion y layout
- [x] Navbar visible en las vistas principales (inicio, staff, usuarios, empresas, solicitudes, auditoria, reportes).
- [x] Boton "Cerrar sesion" fijo arriba a la derecha en todas las pantallas.
- [x] Formularios ordenados (alineacion, etiquetas, inputs, ayudas de formato).
- [X] Mensajes de exito/error consistentes y visibles.

## 2) Autenticacion y sesiones
- [x] Login con RUT + contrasena valida funciona.
- [x] Login con credenciales invalidas muestra error claro.
- [ ] Cierre de sesion invalida la sesion y redirige a login.
- [ ] Paginas protegidas redirigen si no hay sesion.

## 3) Roles, permisos y zonas
- [ ] Rol Admin ve todos los modulos y puede crear/editar.
- [ ] Rol Supervisor o inferior queda limitado por zona (zona bloqueada en formularios).
- [ ] No se puede asignar rol superior al rol del usuario actual.
- [ ] Acciones masivas requieren confirmacion.

## 4) Modulo Staff (crear)
- [ ] Validar RUT obligatorio y formato.
- [ ] Correo unico y valido (manejo de error Supabase).
- [ ] Telefono y telefono emergencia guardan formato "+56 9 1234 5678".
- [ ] Rol y zona se guardan correctamente.
- [ ] Invitacion por correo (si rate limit, mostrar enlace para activar).
- [ ] Se crea usuario en Auth + aexfy.usuarios.

## 5) Modulo Staff (editar)
- [ ] Cargar datos actuales correctamente.
- [ ] Guardar cambios de nombre/apellidos/estado/tipo/rol/zona.
- [ ] Respetar reglas de rol y zona.
- [ ] Generar nuevo enlace de invitacion si no recibio correo.

## 6) Modulo Usuarios (listado)
- [ ] Listado muestra datos correctos (RUT, nombres, email, estado, tipo, zona, rol).
- [ ] Busqueda por texto funciona (RUT, nombre, email).
- [ ] Filtros por estado/rol/tipo/zona funcionan.
- [ ] Paginacion funciona (si aplica).

## 7) Modulo Usuarios (acciones masivas)
- [ ] Seleccion multiple funciona.
- [ ] Accion masiva por estado.
- [ ] Accion masiva por rol (si esta permitido).
- [ ] Validacion de permisos antes de ejecutar.

## 8) Exportacion Usuarios (CSV/Excel)
- [ ] Exporta con separador `;` y BOM (abre bien en Excel).
- [ ] Columnas ordenadas: RUT, Nombres, Apellidos, Email, Telefono, Estado, Tipo, Zona, Roles.
- [ ] Respetar filtros actuales en la exportacion.

## 9) Modulo Empresas (crear + duenio)
- [ ] Crear empresa guarda datos y genera codigo por zona (NG/NC/CT/SR/AU).
- [ ] Crear duenio simultaneamente (Auth + aexfy.usuarios).
- [ ] Email vendedor se toma del usuario que crea (no editable).
- [ ] Restriccion por rol: Supervisor o inferior requiere autorizacion.
- [ ] Segmento/Region cargan con datos disponibles.

## 10) Modulo Empresas (editar y listado)
- [ ] Listado con filtros (estado/plan/zona/busqueda) funciona.
- [ ] Editar datos de empresa guarda correctamente.
- [ ] Acciones masivas aplican y validan permisos.

## 11) Modulo Solicitudes
- [ ] Listado con filtros (estado, tipo, fechas si aplica).
- [ ] Exportacion CSV con columnas ordenadas.
- [ ] Acciones permitidas segun rol/estado.

## 12) Modulo Auditoria
- [ ] Listado muestra acciones recientes.
- [ ] Filtro por rango fecha/hora (desde/hasta) funciona.
- [ ] Exportacion CSV respeta filtros.

## 13) Modulo Reportes
- [ ] Reportes cargan datos y no muestran "No hay datos" con registros reales.
- [ ] Barras/indicadores se dibujan correctamente.
- [ ] Acceso solo para roles permitidos.

## 14) UI/UX y accesibilidad
- [ ] Botones con color intuitivo (crear=verde, eliminar=rojo suave, etc.).
- [ ] Contraste suficiente en texto y fondos.
- [ ] Inputs con placeholder y estados (focus, error).
- [ ] Responsive basico en pantallas chicas.

## 15) Seguridad y consistencia
- [ ] No exponer datos sensibles en plantillas.
- [ ] Validaciones backend replican validaciones frontend.
- [ ] Errores de Supabase manejados con mensajes claros.

## 16) Pruebas masivas (al cierre de fase)
- [ ] Crear 20+ usuarios de staff con datos variados.
- [ ] Crear 10+ empresas por zona y plan.
- [ ] Ejecutar acciones masivas en usuarios y empresas.
- [ ] Exportar y validar CSV con 50+ registros.
- [ ] Auditoria registra todas las acciones anteriores.

## Registro de cambios
- 2026-01-23: Agregar filtros de auditoria por rango de fecha/hora.
