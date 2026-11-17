<?php
declare(strict_types=1);

function jsonResponse(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}

function emptyResponse(int $status = 204): never
{
    http_response_code($status);
    header('Cache-Control: no-store');
    exit;
}

function requestJson(): array
{
    $contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($contentLength > 10 * 1024 * 1024) {
        jsonResponse(['error' => 'La solicitud supera el tamaño permitido.'], 413);
    }

    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    if (strlen($raw) > 10 * 1024 * 1024) {
        jsonResponse(['error' => 'La solicitud supera el tamaño permitido.'], 413);
    }

    try {
        $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        jsonResponse(['error' => 'El cuerpo JSON no es válido.'], 400);
    }
    if (!is_array($decoded)) {
        jsonResponse(['error' => 'El cuerpo JSON no es válido.'], 400);
    }
    return $decoded;
}

function safeString(mixed $value, int $maxLength): string
{
    if (!is_string($value)) {
        return '';
    }
    return mb_substr(trim((string) $value), 0, $maxLength);
}

function jsonValue(mixed $value, mixed $fallback = null): mixed
{
    if (!is_string($value)) {
        return $value ?? $fallback;
    }
    try {
        return json_decode($value, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        throw new RuntimeException('La base de datos contiene un valor JSON no válido.', 0, $error);
    }
}

function originAllowed(): bool
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    return $origin !== '' && hash_equals(AppConfig::appOrigin(), rtrim($origin, '/'));
}

function requireOrigin(): void
{
    if (!originAllowed()) {
        jsonResponse(['error' => 'Origen no permitido.'], 403);
    }
}

function redirectWithAuthError(string $message): never
{
    $loginPath = '/' . rawurlencode('inicio de sesión ultima version.html');
    header('Location: ' . $loginPath . '?authError=' . rawurlencode($message), true, 302);
    exit;
}

function requestPath(): string
{
    $path = (string) (parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
    return rawurldecode($path);
}

function requireMethod(string $method): void
{
    if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== $method) {
        header('Allow: ' . $method);
        jsonResponse(['error' => 'Método no permitido.'], 405);
    }
}
