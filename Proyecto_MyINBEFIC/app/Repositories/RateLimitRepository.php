<?php
declare(strict_types=1);

final class RateLimitRepository
{
    public static function increment(string $bucket): int
    {
        $database = Database::connection();
        $statement = $database->prepare(
            'INSERT INTO auth_rate_limits (bucket, window_started_at, attempts)
             VALUES (?, UNIX_TIMESTAMP(), 1)
             ON DUPLICATE KEY UPDATE
               attempts = IF(window_started_at + 900 < UNIX_TIMESTAMP(), 1, attempts + 1),
               window_started_at = IF(window_started_at + 900 < UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), window_started_at)'
        );
        $statement->execute([$bucket]);
        $statement = $database->prepare('SELECT attempts FROM auth_rate_limits WHERE bucket = ?');
        $statement->execute([$bucket]);
        $attempts = (int) $statement->fetchColumn();
        $database->exec('DELETE FROM auth_rate_limits WHERE window_started_at < UNIX_TIMESTAMP() - 86400');
        return $attempts;
    }
}
