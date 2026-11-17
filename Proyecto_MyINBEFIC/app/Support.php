<?php
declare(strict_types=1);

const VALID_ROLES = ['directora', 'subdirectora', 'docente', 'estudiante', 'secretaria'];
const SESSION_MAX_AGE = 43200;
const SHARED_DATA_PREFIXES = [
    'inbefic:', 'convivencia-', 'secretaria-', 'docente-', 'sec_', 'educa_', 'notas-docente', 'cuadro-notas-',
];

function startAppSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $secret = AppConfig::required('SESSION_SECRET');
    if (strlen($secret) < 32 || str_contains($secret, 'replace-with')) {
        throw new RuntimeException('SESSION_SECRET debe ser un secreto aleatorio de al menos 32 caracteres.');
    }

    $https = AppConfig::isSecureRequest();
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_trans_sid', '0');
    session_name('inbefic_php_sid');
    session_set_cookie_params([
        'lifetime' => SESSION_MAX_AGE,
        'path' => '/',
        'secure' => AppConfig::isProduction() || $https,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_set_save_handler(new DatabaseSessionHandler(Database::connection()), true);
    if (!session_start()) {
        throw new RuntimeException('No se pudo iniciar una sesión segura.');
    }
}

function closeAppSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE && !session_write_close()) {
        throw new RuntimeException('No se pudo guardar la sesión. Intenta de nuevo.');
    }
}

function registerRateLimit(string $action, int $limit = 20): void
{
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $secret = AppConfig::required('SESSION_SECRET');
    $key = hash_hmac('sha256', $action . ':' . $ip, $secret);
    if (RateLimitRepository::increment($key) > $limit) {
        jsonResponse(['error' => 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'], 429);
    }
}

function currentUser(): ?array
{
    startAppSession();
    if (!isset($_SESSION['userId']) || !is_numeric($_SESSION['userId'])) {
        return null;
    }
    $user = UserRepository::findSessionUser((int) $_SESSION['userId']);
    if (!$user) {
        $_SESSION = [];
        if (!session_destroy()) {
            throw new RuntimeException('No se pudo cerrar la sesión inválida.');
        }
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => '/',
            'secure' => AppConfig::isProduction() || AppConfig::isSecureRequest(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        return null;
    }
    $user['profile'] = jsonValue($user['profile'], []);
    return $user;
}

function requireSignedInUser(): array
{
    $user = currentUser();
    if (!$user) {
        jsonResponse(['error' => 'Inicia sesión con Google.'], 401);
    }
    return $user;
}

function requireDataUser(): array
{
    $user = requireSignedInUser();
    if ($user['role'] === 'estudiante') {
        jsonResponse(['error' => 'Este perfil no tiene acceso a los datos académicos.'], 403);
    }
    return $user;
}

function isSharedDataKey(mixed $key): bool
{
    if (!is_string($key) || strlen($key) > 120 || !preg_match('/^[A-Za-z0-9:_-]+$/', $key)) {
        return false;
    }
    foreach (SHARED_DATA_PREFIXES as $prefix) {
        if (str_starts_with($key, $prefix)) {
            return true;
        }
    }
    return false;
}

function canWriteSharedData(string $role, string $key): bool
{
    if (in_array($role, ['directora', 'subdirectora'], true)) {
        return true;
    }
    return $role === 'docente' && (
        str_starts_with($key, 'inbefic:')
        || str_starts_with($key, 'convivencia-')
        || str_starts_with($key, 'docente-')
        || str_starts_with($key, 'notas-docente')
    );
}

function normalizeAcademicValue(mixed $value): string
{
    $value = str_replace(['°', 'º'], '', (string) ($value ?? ''));
    $normalized = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
    return preg_replace('/[^a-z0-9]/', '', strtolower($normalized === false ? '' : $normalized)) ?? '';
}

function isTeacherGuideForStudent(array $teacherProfile, array $studentProfile): bool
{
    return !empty($teacherProfile['grado_guia'])
        && !empty($teacherProfile['seccion_guia'])
        && normalizeAcademicValue($teacherProfile['grado_guia']) === normalizeAcademicValue($studentProfile['grado'] ?? '')
        && normalizeAcademicValue($teacherProfile['seccion_guia']) === normalizeAcademicValue($studentProfile['seccion'] ?? '');
}
