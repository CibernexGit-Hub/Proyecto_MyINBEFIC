# Manual del programador

## Datos del documento

| Campo | Valor |
|---|---|
| Aplicación | INBEFIC — Sistema de gestión educativa |
| Versión del documento | 1.0 |
| Fecha de elaboración | 04/11/2026 |
| Equipo | Equipo de desarrollo INBEFIC |
| Curso / asignatura | Pendiente de completar por la institución |
| Estado | Guía técnica de la versión PHP |

### Control de versiones

| Versión | Fecha | Autor | Descripción |
|---|---|---|---|
| 1.0 | 04/11/2026 | Equipo INBEFIC | Adaptación del formato entregado a la arquitectura y código disponibles. |

## 1. Introducción

INBEFIC es una aplicación web educativa con paneles para Dirección, Subdirección, Docencia, Estudiantes y Secretaría. El navegador presenta las pantallas HTML, estilos CSS e interacción JavaScript. Un backend PHP sirve las páginas, valida solicitudes, controla sesiones y permisos, y accede a MySQL/MariaDB mediante PDO.

El documento está dirigido a desarrolladores y personal técnico que deban instalar, revisar o mantener el sistema. Describe el código presente; no implica que exista un hosting contratado ni un proceso de operación de producción.

## 2. Objetivo del manual

Orientar la instalación, configuración, comprensión y mantenimiento de la versión PHP. Los datos de acceso, secretos de sesión y credenciales de Google deben mantenerse fuera del código y no deben incluirse en respaldos públicos ni en este documento.

## 3. Arquitectura del sistema

Arquitectura cliente-servidor, monolítica y organizada por responsabilidades:

```text
Navegador (HTML / CSS / JavaScript)
        | HTTPS en producción; JSON y cookies de sesión
        v
public/index.php -> app/Http.php -> app/*Controller.php
                                      |             |
                                      v             v
                             app/Support.php   app/Repositories/*
                                      |             |
                                      +------ PDO --+
                                                  v
                                         MySQL / MariaDB
```

- Presentación: pantallas por perfil y recursos estáticos bajo `public/`.
- Enrutamiento y lógica: `public/index.php`, `PageController`, `ApiController`, `AuthController`, validadores y funciones de autorización.
- Acceso a datos: `Database`, manejador de sesiones y repositorios que encapsulan SQL.
- Autenticación: OAuth 2.0 / OpenID Connect con Google; el backend verifica estado, nonce, audiencia, emisor, expiración y correo verificado.

## 4. Tecnologías y herramientas

| Categoría | Tecnología | Versión / estado |
|---|---|---|
| Marcado | HTML5 | Pantallas del proyecto |
| Estilos | CSS3 | Hojas locales; Bootstrap 5.3.8 se carga desde CDN |
| Cliente | JavaScript | Scripts del proyecto; Node.js se conserva para compatibilidad |
| Servidor | PHP | PHP 8.2.12 comprobado localmente; requiere `curl`, `mbstring`, `openssl`, `pdo_mysql` e `iconv` |
| Persistencia | MariaDB / MySQL | MariaDB 10.11.16 comprobado localmente |
| Acceso SQL | PDO | Consultas preparadas y excepciones |
| Servidor web | Apache o servidor PHP | XAMPP disponible localmente; hosting aún no seleccionado |
| Versionado | Git | Repositorio local |
| OAuth | Google Identity | Requiere credenciales OAuth propias |

## 5. Estructura del proyecto

```text
/
├── app/
│   ├── Repositories/       Consultas preparadas y persistencia por entidad
│   ├── ApiController.php   Endpoints REST
│   ├── AuthController.php  OAuth de Google, sesión y cierre de sesión
│   ├── Config.php          Lectura de variables de entorno
│   ├── Database.php        Conexión PDO
│   ├── DatabaseSessionHandler.php  Sesiones PHP en MariaDB
│   ├── Http.php            Respuestas, JSON y controles HTTP
│   ├── PageController.php  Vistas públicas y protegidas por cargo
│   ├── ProfileValidation.php Validación de perfiles
│   ├── Support.php         Sesiones, permisos y funciones comunes
│   └── bootstrap.php       Carga e inicialización común
├── database/schema.sql     Esquema MySQL/MariaDB
├── docs/                   Manual, plan operativo y referencias
├── legacy/archivos-vacios/ Archivos vacíos conservados fuera de la aplicación
├── public/
│   ├── assets/css/          Hojas de estilo
│   ├── assets/images/       Imágenes
│   ├── assets/js/           JavaScript de sincronización y paneles
│   ├── pages/               Pantallas HTML
│   ├── .htaccess            Reescritura para Apache
│   ├── index.php            Punto de entrada PHP
│   └── router.php           Enrutador de desarrollo PHP
├── scripts/                 Herramientas de administración heredadas
├── .env.example             Nombres de variables requeridas
├── README.md                Instalación y configuración
├── package.json             Dependencias del backend Node.js heredado
└── server.js                Backend Node.js conservado para compatibilidad
```

La raíz pública del hosting debe apuntar a `public/`; el directorio `app/`, `.env` y `database/` no deben quedar servidos como archivos web.

## 6. Modelo de datos

El esquema está en `database/schema.sql`. Se comprobó una conexión local con MariaDB 10.11.16 en la base `inbefic`.

| Tabla | Propósito |
|---|---|
| `app_users` | Identidad Google, correo, rol y perfil JSON |
| `app_sessions` | Sesiones del backend Node.js anterior |
| `app_php_sessions` | Sesiones PHP persistidas, expiración de 12 horas |
| `auth_rate_limits` | Ventanas y conteos de intentos de OAuth |
| `school_data` | Datos compartidos de paneles, JSON por clave |
| `academic_grades` | Calificaciones asociadas con estudiante, docente, asignatura y período |
| `announcements` | Avisos generales publicados por Secretaría |

Relaciones: las calificaciones referencian cuentas de estudiante y docente; los datos compartidos identifican opcionalmente al usuario que realizó la última actualización; los avisos pertenecen a la cuenta que los publicó. Las claves foráneas y restricciones están declaradas en el SQL.

## 7. Instalación y configuración

1. Instalar PHP 8.1 o posterior y habilitar `curl`, `mbstring`, `openssl`, `pdo_mysql` e `iconv`.
2. Crear la base `inbefic` con cotejamiento `utf8mb4_unicode_ci`; importar `database/schema.sql` en phpMyAdmin.
3. Copiar `.env.example` a `.env` y completar credenciales de base, Google y sesión.
4. En Google Cloud configurar el origen del sitio y la URI de retorno `${APP_ORIGIN}/auth/google/callback`.
5. En desarrollo con XAMPP, ejecutar desde la raíz:

   ```powershell
   & 'C:\xampp\php\php.exe' -S 127.0.0.1:3000 -t public public/router.php
   ```

6. Abrir `http://localhost:3000`; no abrir las pantallas con `file://`.

Variables principales: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, `APP_ORIGIN`, `GOOGLE_CALLBACK_URL`, `AUTHORIZED_STAFF_EMAILS` y, detrás de proxy HTTPS, `TRUST_PROXY`.

En producción configure un `SESSION_SECRET` aleatorio de al menos 32 caracteres, contraseña de base de datos, HTTPS, `APP_ORIGIN` y callback exactos. `AUTHORIZED_STAFF_EMAILS` es la lista separada por comas de personal autorizado para registrarse en producción. No publique el `.env`.

## 8. Páginas, APIs y comunicación

### 8.1 Rutas principales

| Ruta | Método | Acceso | Acción / salida |
|---|---|---|---|
| `/auth/google` | GET | Público, limitado por IP | Inicia OAuth |
| `/auth/google/register` | POST JSON | Público, origen permitido y límite de intentos | Valida el perfil e inicia OAuth |
| `/auth/google/callback` | GET | Estado OAuth vigente | Verifica Google, registra/inicia sesión y redirige por cargo |
| `/api/auth/me` | GET | Sesión | Devuelve usuario y perfil |
| `/api/auth/logout` | POST | Sesión y origen permitido | Cierra sesión |
| `/api/student/portal` | GET | Estudiante | Devuelve notas, grado/sección y docente guía |
| `/api/teacher/students` | GET | Docente | Lista estudiantes de su grado/sección y sus notas |
| `/api/teacher/guide-assignment` | PUT JSON | Docente y origen permitido | Actualiza sección guía si no está ocupada |
| `/api/teacher/grades` | POST JSON | Docente y origen permitido | Registra o actualiza una calificación |
| `/api/announcements` | GET | Usuario autenticado | Lista avisos |
| `/api/announcements` | POST JSON | Secretaría y origen permitido | Publica aviso |
| `/api/announcements/:sourceId` | DELETE | Secretaría y origen permitido | Retira aviso propio |
| `/api/app-data` | GET | Personal autenticado; no Estudiante | Consulta datos compartidos |
| `/api/app-data/import` | POST JSON | Dirección y origen permitido | Importa claves que aún no existen |
| `/api/app-data/:key` | PUT/DELETE | Permiso según rol y clave | Actualiza o elimina datos permitidos |

Los clientes usan `fetch` con JSON, cookies del mismo origen y rutas relativas. Las respuestas API tienen códigos HTTP explícitos; el servidor no confía en la validación del navegador.

### 8.2 Errores

Las APIs devuelven JSON con `error` para solicitudes inválidas, no autenticadas, sin permisos, no encontradas o fallidas. El registro del servidor recibe el detalle interno; las respuestas al navegador no exponen SQL ni secretos. La base no fue sometida a pruebas destructivas.

### 8.3 Conexión a datos

`app/Database.php` centraliza PDO y lee credenciales del entorno. `PDO::ATTR_EMULATE_PREPARES` está desactivado; las consultas de los repositorios usan parámetros. Las sesiones PHP usan `app_php_sessions`. La conexión local y el esquema fueron comprobados; la base de producción todavía no existe.

## 9. Estándares de código

- PHP con `declare(strict_types=1)`, clases por responsabilidad y funciones con tipos.
- Nombres de clases en PascalCase; métodos y funciones en camelCase; SQL legible y parametrizado.
- JavaScript existente conserva sus convenciones actuales.
- No se ha configurado formatter PHP ni política obligatoria de commits.
- No guardar credenciales, datos reales de estudiantes ni volcados de base en Git.

## 10. Módulos principales

| Módulo | Responsabilidad | Archivos |
|---|---|---|
| Autenticación | OAuth, validación de identidad, sesión y rate limit | `AuthController.php`, `DatabaseSessionHandler.php`, `RateLimitRepository.php` |
| Perfiles | Validación de campos, edad, rol y autorización de personal | `ProfileValidation.php`, `UserRepository.php` |
| Notas | Docente guía, calificaciones y portal de estudiante | `ApiController.php`, `AcademicRepository.php`, `teacher-grades.js`, `student-portal.js` |
| Avisos | Publicación por Secretaría y consulta de usuarios | `ApiController.php`, `AnnouncementRepository.php`, `announcements-sync.js` |
| Datos escolares | Sincronización, importación y permisos de escritura | `ApiController.php`, `SchoolDataRepository.php`, `backend-sync.js` |
| Interfaz | Vistas, recursos compartidos y control de página por cargo | `PageController.php`, `public/pages/`, `public/assets/` |

## 11. Seguridad y privacidad

- Google OAuth valida `state`, `nonce`, audiencia, emisor, expiración y correo verificado.
- Cookies de sesión `HttpOnly`, `SameSite=Lax`; en producción se marcan `Secure`; se regeneran al iniciar sesión.
- Acceso a vistas y datos comprobado en el servidor por rol; operaciones de escritura exigen origen permitido.
- PDO con consultas preparadas; validación y límites de tamaño en JSON y campos.
- Cabeceras de seguridad; el alojamiento debe añadir CSP apropiada, HTTPS, copias cifradas y logs protegidos.
- En producción, el registro de personal usa `AUTHORIZED_STAFF_EMAILS`. La institución debe definir cómo verificar y autorizar cuentas de estudiantes antes de usar información real.
- Tratar perfiles, NIE, notas y asistencia como datos personales sensibles. Limitar acceso, retención y uso conforme a las normas aplicables.

## 12. Pruebas

Comprobaciones ejecutadas localmente: `php -l` en todos los PHP; carga del bootstrap; validación de perfiles; rutas HTTP de página, API y recursos; sesión sin usuario devuelve 401; conexión PDO; lectura y escritura del manejador de sesiones en MariaDB; y existencia de todas las tablas requeridas. También se revisaron las referencias locales y la compatibilidad básica del backend Node heredado.

No hay suite PHPUnit, cobertura automatizada, pruebas de navegador completas ni OAuth real configurado. Tras modificar el sistema, repetir:

```powershell
Get-ChildItem app,public -Recurse -Filter *.php | ForEach-Object { & 'C:\xampp\php\php.exe' -l $_.FullName }
npm.cmd run db:init
```

Después probar, con cuentas de prueba, los cinco perfiles y los flujos de notas, avisos, permisos y datos compartidos. No usar cuentas o registros reales para pruebas.

## 13. Despliegue

No se ha elegido hosting. El proveedor debe admitir PHP 8.1+, PDO MySQL, cURL, sesiones, HTTPS y reglas de reescritura; configurar `public/` como document root y permitir escrituras solo donde sean necesarias. Crear/importar el esquema, variables privadas y callback OAuth HTTPS. Primero desplegar en staging y validar rutas, permisos, sesión y OAuth antes de uso escolar.

No existe actualmente pipeline CI/CD ni base alojada. Node.js y su `server.js` permanecen por compatibilidad; el modo PHP indicado en README es el destinado a evaluación PHP.

## 14. Mantenimiento y control de versiones

Usar ramas de trabajo y cambios pequeños revisables. Antes de desplegar: respaldo verificado, pruebas en staging, revisión de cambios SQL, ventana de mantenimiento y plan de reversión. No ejecutar rollback de esquema sin un respaldo probado. Registrar incidencias y cambios con fecha, responsable e impacto.

## 15. Anexos

- Esquema: `database/schema.sql`.
- Instalación: `README.md`.
- Plan operativo y contingencial: `docs/plan-operativo-contingencial.md`.
- Referencias originales recibidas: `docs/referencias/`.
- Glosario: OAuth = autorización delegada; PDO = interfaz de acceso a datos PHP; RTO = objetivo de tiempo de recuperación; RPO = objetivo de punto de recuperación; SLA = acuerdo de nivel de servicio.
