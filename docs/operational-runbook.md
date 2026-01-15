# Manual operativo

Monitoreo
- Revisar estado de Supabase Auth, logs de Edge Functions y salud de DB.
- Revisar audit log de acciones criticas.

Backups y recovery
- Backups diarios con retencion >= 30 dias.
- Prueba de restauracion trimestral.

Rotacion de llaves
- Rotar service role key cada 90 dias.
- Actualizar secrets en Supabase y redeploy de functions.

Respuesta a incidentes
- Identificar impacto y alcance.
- Deshabilitar usuarios comprometidos.
- Recopilar logs y evidencia.
- Post-incident report con acciones.

Chequeos operativos
- Verificar despliegue de GitHub Pages en cada release.
- Validar allow list de URLs para redirects de Auth.
- Verificar permisos de Edge Functions.
