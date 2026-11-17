<?php
declare(strict_types=1);

ini_set('display_errors', '0');
require_once dirname(__DIR__) . '/app/bootstrap.php';

try {
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $path = requestPath();

    if ($path === '/auth/google' && $method === 'GET') {
        AuthController::beginGoogleLogin();
    }
    if ($path === '/auth/google/register' && $method === 'POST') {
        AuthController::beginGoogleRegistration();
    }
    if ($path === '/auth/google/callback' && $method === 'GET') {
        AuthController::googleCallback();
    }
    if (str_starts_with($path, '/api/')) {
        ApiController::dispatch($method, $path);
    }
    if (str_starts_with($path, '/assets/')) {
        http_response_code(404);
        exit;
    }
    PageController::dispatch($path);
} catch (Throwable $error) {
    error_log('Error de aplicación: ' . $error->getMessage());
    if (str_starts_with(requestPath(), '/api/')) {
        jsonResponse(['error' => 'Ocurrió un error interno. Intenta de nuevo.'], 500);
    }
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Ocurrió un error interno. Intenta de nuevo.';
}
