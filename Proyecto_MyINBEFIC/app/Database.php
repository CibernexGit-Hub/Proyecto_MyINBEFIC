<?php
declare(strict_types=1);

final class Database
{
    private static ?PDO $connection = null;

    public static function connection(): PDO
    {
        if (self::$connection instanceof PDO) {
            return self::$connection;
        }

        $host = AppConfig::get('MYSQL_HOST', 'localhost') ?? 'localhost';
        $port = AppConfig::get('MYSQL_PORT', '3306') ?? '3306';
        $database = AppConfig::get('MYSQL_DATABASE', 'inbefic') ?? 'inbefic';
        $user = AppConfig::get('MYSQL_USER', 'root') ?? 'root';
        $password = AppConfig::get('MYSQL_PASSWORD', '') ?? '';

        if (!preg_match('/^[A-Za-z0-9_]+$/', $database)) {
            throw new RuntimeException('MYSQL_DATABASE solo puede contener letras, números y guiones bajos.');
        }
        if (!ctype_digit($port) || (int) $port < 1 || (int) $port > 65535) {
            throw new RuntimeException('MYSQL_PORT no es válido.');
        }
        if (str_contains($password, 'replace-with')
            || (AppConfig::isProduction() && $password === '')) {
            throw new RuntimeException('Configura MYSQL_PASSWORD con una contraseña segura de MySQL.');
        }

        $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $database);
        self::$connection = new PDO($dsn, $user, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        return self::$connection;
    }
}
