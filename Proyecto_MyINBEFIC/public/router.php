<?php
declare(strict_types=1);

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$assetRoot = realpath(__DIR__ . DIRECTORY_SEPARATOR . 'assets');
$decodedPath = is_string($path) ? rawurldecode($path) : '';
$candidate = realpath(__DIR__ . $decodedPath);
if (is_string($path) && str_starts_with($path, '/assets/') && $assetRoot !== false
    && $candidate !== false && str_starts_with($candidate, $assetRoot . DIRECTORY_SEPARATOR)
    && is_file($candidate)) {
    return false;
}

require __DIR__ . DIRECTORY_SEPARATOR . 'index.php';
