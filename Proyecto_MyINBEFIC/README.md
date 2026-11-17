# INBEFIC

Aplicación educativa con frontend HTML/CSS/JavaScript, backend PHP y base de datos MySQL/MariaDB. El backend PHP mantiene las APIs consumidas por los paneles e inicia sesión con Google.

## Estructura

- `app/`: configuración, conexión a datos, autenticación, validación, controladores y repositorios SQL.
- `public/`: raíz pública de la aplicación.
  - `pages/`: pantallas HTML por perfil.
  - `assets/css/`, `assets/js/`, `assets/images/`: estilos, scripts e imágenes.
- `database/schema.sql`: tablas de usuarios, sesiones, datos escolares, notas y avisos.
- `scripts/`: scripts auxiliares del proyecto.
- `docs/manual-programador.md` y `docs/Manual_del_Programador_INBEFIC.docx`: manual técnico adaptado a la aplicación.
- `docs/plan-operativo-contingencial.md` y `docs/Plan_Operativo_Contingencial_INBEFIC.docx`: plan con procedimientos y límites reales del despliegue actual.
- `docs/referencias/`: copias de los documentos originales recibidos, además de la presentación y reporte de referencia.
- `scripts/export-docs-docx.ps1`: regenera los DOCX a partir de sus fuentes Markdown.

Configura el hosting para que su raíz web sea `public/`. No publiques `.env`, `app/` ni el archivo SQL como contenido accesible desde la web.

## Requisitos

- PHP 8.1 o posterior.
- Extensiones PHP: `curl`, `mbstring`, `openssl`, `pdo_mysql` e `iconv`.
- MySQL 8 o MariaDB 10.6 o posterior.
- Un cliente OAuth de Google de tipo **Aplicación web**.

## Preparar el proyecto local

1. Inicia MySQL desde XAMPP.
2. En phpMyAdmin, crea la base `inbefic` con cotejamiento `utf8mb4_unicode_ci` e importa `database/schema.sql`.
3. Copia `.env.example` como `.env` y completa las credenciales de MySQL, Google y la sesión:

   ```powershell
   Copy-Item .env.example .env
   ```

4. En Google Cloud, registra el origen y la URI de retorno usados por la aplicación. Para el ejemplo local:

   - Origen autorizado: `http://localhost:3000`
   - URI de redireccionamiento: `http://localhost:3000/auth/google/callback`

5. Inicia el servidor PHP desde la carpeta del proyecto:

   ```powershell
   & 'C:\xampp\php\php.exe' -S localhost:3000 -t public public/router.php
   ```

   Abre `http://localhost:3000`. Se mostrará primero `Pantalla_base de todo`; tócala para continuar al inicio de sesión. No abras los HTML con `file://`.

En `.env`, configura `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, `APP_ORIGIN` y `GOOGLE_CALLBACK_URL`. Usa un secreto aleatorio privado de al menos 32 caracteres para `SESSION_SECRET`. No publiques `.env` ni las credenciales OAuth.

En producción, usa HTTPS y una contraseña de MySQL. `AUTHORIZED_STAFF_EMAILS` debe contener, separados por comas, los correos autorizados para registrar perfiles de personal escolar; en modo producción los perfiles de estudiante no requieren esa lista.

La conexión local se validó con PHP PDO a MariaDB 10.11.16 en la base `inbefic`; también se comprobó la lectura y escritura del manejador de sesiones PHP. El esquema actual incluye `app_php_sessions` y `auth_rate_limits`. Esta comprobación local no sustituye la configuración y prueba de la base del hosting.

## Datos y perfiles

- `app_users` guarda la identidad de Google, el perfil y el cargo.
- `app_php_sessions` persiste las sesiones PHP en MySQL; `app_sessions` se conserva para la versión Node.js anterior.
- `auth_rate_limits` registra límites de intentos de autenticación.
- `school_data` guarda los datos compartidos por los paneles existentes.
- `academic_grades` relaciona las calificaciones con estudiantes y docentes.
- `announcements` conserva los avisos generales publicados por Secretaría.

Los perfiles Estudiante solo consultan sus calificaciones y avisos. Docencia accede a estudiantes de su grado/sección guía y puede registrar notas. Dirección y Subdirección administran los datos compartidos; Secretaría consulta esos datos y administra avisos.

## API principal

- `GET /api/auth/me` y `POST /api/auth/logout`: sesión del usuario.
- `GET /api/student/portal`: perfil y calificaciones del estudiante.
- `GET /api/teacher/students`, `PUT /api/teacher/guide-assignment` y `POST /api/teacher/grades`: flujos de Docencia.
- `GET`, `POST` y `DELETE /api/announcements`: avisos generales.
- `GET /api/app-data`, `PUT`/`DELETE /api/app-data/:key` y `POST /api/app-data/import`: datos compartidos.

Las operaciones de escritura comprueban origen, sesión, rol y formato de los datos; las consultas SQL usan sentencias preparadas.

## Validación local

Para comprobar la sintaxis de todos los archivos PHP en Windows con XAMPP:

```powershell
Get-ChildItem app,public -Recurse -Filter *.php | ForEach-Object { & 'C:\xampp\php\php.exe' -l $_.FullName }
```

El servidor Node.js anterior permanece en `server.js` y conserva compatibilidad con las pantallas reorganizadas. Para probar o desplegar la versión solicitada en PHP y evaluarla con la rúbrica, usa el comando PHP indicado arriba y configura el hosting con `public/` como raíz web.
