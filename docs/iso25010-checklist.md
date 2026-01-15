# Checklist ISO/IEC 25010

Adecuacion funcional
- [ ] Flujos criticos documentados e implementados
- [ ] Validacion de entradas y reglas de negocio
- [ ] Edge Functions retornan codigos de error consistentes
Evidencia: enlaces a SRS, pruebas

Eficiencia de desempeno
- [ ] Carga de estado p95 <= objetivo
- [ ] Cache habilitada y validada
- [ ] UI no bloquea en cargas de fondo
Evidencia: reporte de performance

Usabilidad
- [ ] Formularios muestran errores claros
- [ ] Etiquetas y acciones consistentes
- [ ] Accesibilidad basica (labels, foco)
Evidencia: notas de UX

Fiabilidad
- [ ] Sin errores de consola en flujos normales
- [x] Fallback a tabla cuando Edge falla 👍
- [ ] Retry/backoff para fallas transitorias
Evidencia: logs de pruebas

Seguridad
- [x] RBAC en UI y datos 👍
- [x] TLS y sin secretos en el cliente 👍
- [x] Auditoria de acciones criticas 👍
Evidencia: revision de seguridad

Mantenibilidad
- [x] JS modular y naming claro 👍
- [ ] Reglas de linting aplicadas
- [ ] Cobertura de pruebas en logica core
Evidencia: resultados CI

Portabilidad
- [x] Compatible con hosting estatico 👍
- [ ] Funciona en Chrome/Edge/Firefox
- [x] Sin dependencias especificas de plataforma 👍
Evidencia: matriz de navegadores
