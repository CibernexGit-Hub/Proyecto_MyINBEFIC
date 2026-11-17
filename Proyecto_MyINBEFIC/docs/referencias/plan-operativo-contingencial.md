# Plan operativo y plan contingencial

## Control del documento

| Campo | Valor |
|---|---|
| Sistema | INBEFIC — aplicación web educativa |
| Stack | HTML5, CSS3, JavaScript, PHP, MySQL/MariaDB |
| Versión del documento | 1.0.0 |
| Fecha de emisión | 04/11/2026 |
| Próxima revisión recomendada | 04/02/2027 o después de un cambio importante |
| Responsable | Pendiente de designación institucional |
| Clasificación | Uso interno — contiene procedimientos, no credenciales |

Este plan adapta el formato entregado al estado real del proyecto. Los valores objetivo son propuestas para planificar, no un SLA, garantía de hosting ni compromiso contractual. Se verificaron localmente la conexión PDO, las tablas requeridas y la escritura/lectura/eliminación de una sesión PHP de prueba. No existe hosting de producción, monitoreo contratado, backup automatizado ni equipo de guardia confirmado.

## SECCIÓN 1 — PLAN OPERATIVO (PO)

### 1.1 Descripción del sistema

| Componente | Tecnología | Estado / función |
|---|---|---|
| Frontend | HTML, CSS, JavaScript | Pantallas para cinco perfiles |
| Backend | PHP 8.2.12 local | Enrutamiento, OAuth, APIs, validación y autorización |
| Persistencia | MariaDB 10.11.16 local | Usuarios, sesiones, datos, notas y avisos |
| Servidor | Apache/XAMPP o servidor PHP | XAMPP disponible para desarrollo; proveedor de producción pendiente |
| Identidad | Google OAuth | Integración implementada; credenciales de producción y callback por configurar |
| Versionamiento | Git | Repositorio del proyecto; CI/CD no configurado |
| Seguridad | PDO, sesiones, verificación de origen, HTTPS requerido en producción | CSP, WAF y monitoreo externo deben configurarse en el hosting |

### 1.2 Actividades operativas

| Frecuencia | Actividad | Responsable | Herramienta / evidencia |
|---|---|---|---|
| Cada día de uso | Comprobar login, paneles, avisos y notas con cuentas de prueba | Operador designado | Lista de verificación, URL del sistema |
| Cada día de uso | Revisar errores de PHP, Apache y MariaDB | Administrador técnico | Logs del proveedor; acceso restringido |
| Diario al publicar | Respaldar base y confirmar código de salida/tamaño | Administrador técnico | `mysqldump` y almacenamiento protegido |
| Semanal | Revisar actualizaciones, accesos, espacio y errores recurrentes | Mantenimiento | Panel del hosting, Git, `npm audit` para parte heredada |
| Antes de desplegar | Exportar BD y verificar la copia; probar versión en staging | Responsable de despliegue | `mysqldump`, copia cifrada, pruebas básicas |
| Mensual | Restaurar un respaldo en entorno aislado y documentar resultado | Administrador de base | MariaDB de prueba |
| Trimestral | Revisar usuarios, correos autorizados y permisos por perfil | Dirección + técnico | Lista de cuentas aprobada |
| Trimestral | Revisar este plan, contactos y procedimientos | Responsable institucional | Acta de revisión |

Las frecuencias de backup deben ajustarse a la capacidad real del proveedor y al volumen de uso. No se debe declarar un backup exitoso sin verificar archivo, cifrado, acceso y prueba de restauración.

### 1.3 Umbrales de monitoreo

Los umbrales son sugerencias iniciales; el hosting no ofrece estas métricas todavía.

| Métrica | Normal propuesto | Advertencia | Crítico / acción |
|---|---:|---:|---|
| Disponibilidad | ≥ 99.5 % mensual | 99.0–99.49 % | < 99.0 %: escalar al proveedor |
| Respuesta HTTP | < 500 ms | 500 ms–2 s | > 2 s sostenido: revisar logs y carga |
| Errores 5xx | < 0.1 % | 0.1–1 % | > 1 %: declarar incidente |
| Uso CPU | < 60 % | 60–80 % | > 80 % sostenido |
| Uso RAM | < 70 % | 70–85 % | > 85 % sostenido |
| Disco libre | > 30 % | 20–30 % | < 20 %: respaldar y liberar con autorización |
| Consulta SQL | < 100 ms | 100–500 ms | > 500 ms: medir antes de optimizar |

### 1.4 Gestión de cambios

1. Registrar el cambio, propósito, archivos/BD afectados, riesgo y reversión.
2. Revisar código y esquema; proteger `.env` y respaldos.
3. Probar primero en staging con datos ficticios.
4. Obtener aprobación del responsable designado; para datos y permisos, aprobación institucional.
5. Desplegar en horario acordado, verificar login, permisos, notas, avisos y base.
6. Si falla: volver a la versión de código respaldada y restaurar BD solo con plan probado.
7. Registrar resultado, impacto y acciones correctivas.

## SECCIÓN 2 — ACUERDO DE NIVEL DE SERVICIO (SLA)

No existe contrato ni proveedor de producción, por lo tanto los indicadores siguientes son referencias de planificación únicamente. No se ofrecen penalizaciones ni tiempos de respuesta garantizados.

### 2.1 Metas tentativas de disponibilidad

| Entorno | Objetivo para evaluación | Estado actual |
|---|---:|---|
| Producción | ≥ 99.5 % mensual, sujeto a proveedor | No desplegado |
| Endpoints críticos | Medir login, sesión, `/api/auth/me` y acceso a BD | Solo probado localmente |
| Pruebas / staging | ≥ 95 % durante pruebas acordadas | No configurado |

### 2.2 Priorización y respuesta operativa recomendada

Los plazos son objetivos internos tentativos; confirmar guardias y contactos antes de adoptarlos.

| Prioridad | Ejemplo | Tiempo objetivo para reconocer | Próximo paso |
|---|---|---|---|
| P1 — Crítico | Servicio caído, pérdida de datos o acceso no autorizado | Iniciar atención de inmediato durante horario acordado | Aislar el riesgo, avisar a Dirección y proveedor |
| P2 — Alto | Login o función principal inutilizable para varios usuarios | Mismo día hábil | Workaround seguro y reparación prioritaria |
| P3 — Medio | Función secundaria afectada con alternativa temporal | 1 día hábil | Registrar, priorizar y comunicar |
| P4 — Bajo | Error visual o mejora | 3 días hábiles | Incluir en mantenimiento planificado |

### 2.3 Penalizaciones

No aplican porque no existe tarifa ni acuerdo contractual vigente. Si se contrata hosting, revisar su SLA y sustituir esta sección con términos aprobados por las partes.

## SECCIÓN 3 — PLAN CONTINGENCIAL (PCA)

### 3.1 Objetivos de recuperación propuestos

Metas iniciales que deben aprobarse según horario escolar, capacidad de hosting y frecuencia de backup. No están garantizadas ni probadas para producción.

| Indicador | Definición | Meta provisional | Estado |
|---|---|---:|---|
| RTO | Tiempo máximo deseado para restablecer servicio | 4 horas | Por aprobar y probar |
| RPO | Antigüedad máxima deseada de los datos recuperados | 24 horas hasta configurar backups horarios | No garantizado; no hay backup automático |
| MTTR P1/P2 | Tiempo promedio de reparación | < 1 día hábil | Por medir |
| MTBF | Tiempo entre fallos | Sin meta verificable aún | Requiere operación y monitoreo |

### 3.2 Matriz de riesgos

| Escenario | Probabilidad | Impacto | Respuesta viable con el entorno actual |
|---|---|---|---|
| Servidor web inaccesible | Media | Alto | Revisar estado, logs y proveedor; mantener copia de código y aviso a usuarios |
| MySQL detenido | Media | Alto | Confirmar servicio/puerto y credenciales; reiniciar solo por administrador |
| Corrupción o pérdida de base | Baja–media | Crítico | Detener escrituras; preservar evidencia; restaurar copia verificada y conciliar cambios |
| OAuth de Google falla | Media | Alto | Revisar callback, origen, HTTPS, credenciales y logs sin copiar secretos |
| Error de despliegue | Media | Alto | Revertir artefactos de aplicación respaldados; no restaurar BD salvo incompatibilidad confirmada |
| Pérdida o filtración de credenciales | Baja | Crítico | Revocar/rotar secretos, invalidar sesiones y revisar registros de acceso |
| Ataque o acceso indebido | Media | Crítico | Restringir acceso, conservar logs, avisar responsable de privacidad y proveedor |
| Proveedor gratuito suspende/restringe servicio | Media | Alto | Exportar datos con antelación y migrar a proveedor compatible; comprobar límites y persistencia |
| Disco lleno o recursos saturados | Media | Medio–alto | Obtener métricas del proveedor; ampliar plan o reducir datos temporales tras respaldo |

No hay configuración actual de failover, WAF, CDN, región alterna ni repositorio espejo confirmado.

### 3.3 Procedimientos de respuesta

#### P1-A — Aplicación no disponible

1. Registrar hora, URL, mensaje y perfiles afectados; verificar desde otra conexión.
2. Confirmar estado de hosting, Apache/PHP y MySQL. No copiar datos personales a chats o reportes públicos.
3. Revisar logs protegidos y errores recientes; distinguir DNS/TLS, servidor, aplicación y base de datos.
4. Si el hosting está caído, abrir incidencia con proveedor y comunicar a la institución por un canal alterno.
5. Corregir configuración o desplegar versión de código previamente probada. Evitar cambios directos sin copia.
6. Verificar login y APIs críticas; monitorear estabilidad y documentar causa e impacto.

#### P1-B — Sospecha de brecha o datos expuestos

1. Avisar inmediatamente al responsable institucional y administrador técnico.
2. Restringir el componente o cuentas afectadas sin borrar logs ni evidencia.
3. Rotar secretos OAuth/DB/sesión desde los paneles oficiales; invalidar sesiones comprometidas.
4. Determinar período, cuentas y datos posiblemente expuestos con acceso limitado.
5. Corregir la causa, probar en entorno aislado y restaurar acceso gradualmente.
6. Notificar a afectados y autoridades cuando corresponda según la legislación aplicable. Consultar asesoría institucional; no asumir plazos legales universales.
7. Registrar cronología, decisiones, impacto y acciones preventivas.

#### P2-A — Cambio o despliegue fallido

1. Detener nuevos despliegues y preservar logs.
2. Volver a artefactos de aplicación conocidos y probados.
3. Revisar si el cambio modificó esquema o datos; no revertir SQL automáticamente.
4. Ejecutar pruebas de página, sesión, notas, avisos y permisos con cuentas de prueba.
5. Reabrir el cambio en staging y documentar las condiciones para reintentar.

#### P2-B — Base de datos local sin conexión

1. Confirmar que MySQL/MariaDB esté iniciado en XAMPP y atendiendo el puerto configurado.
2. Validar host, puerto, base, usuario y contraseña en `.env` sin compartir sus valores.
3. Probar desde phpMyAdmin o el cliente MySQL, y luego desde PDO.
4. Si el proceso rechaza conexiones, guardar el error y logs; no reinstalar ni borrar el directorio de datos.
5. Tras recuperar la conexión, comprobar tablas y datos con consultas de solo lectura y validar las funciones.

### 3.4 Respaldo y recuperación

Aplicar como objetivo una estrategia 3-2-1: tres copias, dos medios y una fuera del sitio, cifradas y con acceso restringido. Actualmente la tarea automática y almacenamiento offsite **no están configurados**.

| Elemento | Frecuencia objetivo | Retención inicial | Verificación |
|---|---|---|---|
| Base de datos | Diario; evaluar cada hora si el uso lo requiere | 7 diarios y 4 semanales | Restaurar mensualmente en entorno aislado |
| Código | En cada versión aprobada | Según política Git y copia fuera del proveedor | Clonar y desplegar una versión guardada |
| Configuración | Antes de cada cambio | Versiones sin secretos; secreto en gestor seguro | Revisar que no contenga `.env` |
| Datos exportados | Antes de migración o cambio mayor | Según política de datos de la escuela | Conteos y consultas de muestra |

Ejemplo de exportación manual desde XAMPP; usar una ruta protegida y cifrar el archivo antes de copiarlo fuera del equipo:

```powershell
& 'C:\xampp\mysql\bin\mysqldump.exe' --host=localhost --port=3306 --user=root inbefic --result-file='C:\ruta-segura\inbefic.sql'
```

El comando no incluye contraseña en el historial; en producción debe usarse un usuario de backup con privilegios mínimos y el mecanismo seguro de secretos del proveedor. No subir volcados a Git, correo personal o almacenamiento público. Antes de restaurar, confirmar base destino, autorización y copia de seguridad previa.

## SECCIÓN 4 — ROLES Y RESPONSABILIDADES

Los nombres, teléfonos y turnos de guardia están pendientes de designación; completar antes del despliegue escolar.

| Rol | Responsabilidad | Contacto |
|---|---|---|
| Responsable institucional | Autoriza cambios, accesos, avisos y comunicaciones | Pendiente |
| Administrador técnico | Hosting, PHP, logs, despliegues y restauración | Pendiente |
| Responsable de base | Usuarios, permisos, integridad, copias y recuperación | Pendiente |
| Desarrollo backend | APIs PHP, autenticación, permisos y correcciones | Equipo INBEFIC; contacto pendiente |
| Desarrollo frontend | Pantallas, accesibilidad y errores de interfaz | Equipo INBEFIC; contacto pendiente |
| Privacidad / seguridad | Evaluación de incidentes y notificaciones aplicables | Pendiente |
| Verificación funcional | Pruebas posteriores a cambios y recuperación | Pendiente |

### 4.1 Escalación

1. Operador o docente reporta el incidente al responsable técnico designado.
2. Si afecta varios perfiles, datos personales o continúa 30 minutos, informar al responsable institucional.
3. Si no se recupera en el objetivo acordado, escalar al proveedor de hosting y base.
4. Ante posible exposición de datos, contactar de inmediato al responsable de privacidad/dirección y seguir sus instrucciones.

## SECCIÓN 5 — REVISIÓN Y MEJORA

### 5.1 Eventos de revisión

| Evento | Acción | Responsable |
|---|---|---|
| Incidente crítico | Informe de causa, impacto y tareas preventivas | Responsable técnico + institucional |
| Cambio importante de arquitectura | Revisar procedimientos, accesos y respaldos | Equipo técnico |
| Trimestral | Revisar contactos, cuentas, proveedores y este plan | Institución |
| Anual | Simular restauración de base y despliegue de recuperación | Responsable técnico |
| Cambio normativo | Revisar tratamiento y notificación de datos personales | Institución / asesoría |

### 5.2 Indicadores

| Indicador | Medición | Meta propuesta | Frecuencia |
|---|---|---|---|
| Disponibilidad | Tiempo operativo / tiempo acordado | ≥ 99.5 %, sujeto al proveedor | Mensual tras despliegue |
| Éxito de backups | Copias verificadas / copias programadas | 100 % | Semanal |
| Restauración probada | Restauraciones correctas / pruebas ejecutadas | 100 % | Mensual |
| Incidentes P1 dentro de RTO | P1 recuperados dentro del objetivo / total P1 | ≥ 95 % | Trimestral |
| Tiempo de detección | Hora de aviso menos hora estimada de inicio | Establecer línea base | Por incidente |

No publicar resultados de disponibilidad ni prometer metas hasta contar con registros y servicio de producción medido.

### 5.3 Control de versiones y aprobación

| Versión | Fecha | Cambio | Autor | Aprobación |
|---|---|---|---|---|
| 1.0.0 | 04/11/2026 | Adaptación al proyecto INBEFIC y al estado local verificado | Equipo INBEFIC | Pendiente |

### Firmas de aprobación

| Rol | Nombre | Firma | Fecha |
|---|---|---|---|
| Responsable institucional | Pendiente | ____________________ | __________ |
| Responsable técnico | Pendiente | ____________________ | __________ |
| Representante de la institución | Pendiente | ____________________ | __________ |
