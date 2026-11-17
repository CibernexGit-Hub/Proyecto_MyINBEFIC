<?php
declare(strict_types=1);

final class AppConfig
{
    private static ?array $values = null;

    public static function get(string $name, ?string $default = null): ?string
    {
        $environmentValue = getenv($name);
        if ($environmentValue !== false) {
            return $environmentValue;
        }

        if (self::$values === null) {
            $envFile = dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env';
            self::$values = is_file($envFile)
                ? (parse_ini_file($envFile, false, INI_SCANNER_RAW) ?: [])
                : [];
        }

        $value = self::$values[$name] ?? $default;
        return $value === null ? null : (string) $value;
    }

    public static function required(string $name): string
    {
        $value = self::get($name);
        if ($value === null || trim($value) === '') {
            throw new RuntimeException("Falta configurar {$name} en el archivo .env.");
        }
        return $value;
    }

    public static function appOrigin(): string
    {
        return rtrim(self::get('APP_ORIGIN', 'http://localhost:3000') ?? '', '/');
    }

    public static function callbackUrl(): string
    {
        return self::get('GOOGLE_CALLBACK_URL', self::appOrigin() . '/auth/google/callback')
            ?? self::appOrigin() . '/auth/google/callback';
    }

    public static function isProduction(): bool
    {
        return strtolower(self::get('NODE_ENV', 'development') ?? 'development') === 'production';
    }

    public static function isSecureRequest(): bool
    {
        if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') {
            return true;
        }

        return self::get('TRUST_PROXY') === 'true'
            && strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
    }
}
