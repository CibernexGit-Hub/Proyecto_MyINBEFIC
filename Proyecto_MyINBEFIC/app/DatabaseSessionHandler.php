<?php
declare(strict_types=1);

final class DatabaseSessionHandler implements SessionHandlerInterface, SessionUpdateTimestampHandlerInterface
{
    public function __construct(private PDO $database)
    {
    }

    public function open(string $path, string $name): bool
    {
        return true;
    }

    public function close(): bool
    {
        return true;
    }

    public function read(string $id): string|false
    {
        $statement = $this->database->prepare(
            'SELECT data FROM app_php_sessions WHERE session_id = ? AND expires > ?'
        );
        $statement->execute([$id, time()]);
        $data = $statement->fetchColumn();
        return $data === false ? '' : (string) $data;
    }

    public function validateId(string $id): bool
    {
        $statement = $this->database->prepare(
            'SELECT 1 FROM app_php_sessions WHERE session_id = ? AND expires > ?'
        );
        $statement->execute([$id, time()]);
        return $statement->fetchColumn() !== false;
    }

    public function updateTimestamp(string $id, string $data): bool
    {
        return $this->write($id, $data);
    }

    public function write(string $id, string $data): bool
    {
        $expires = time() + 12 * 60 * 60;
        $statement = $this->database->prepare(
            'INSERT INTO app_php_sessions (session_id, expires, data) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE expires = VALUES(expires), data = VALUES(data)'
        );
        return $statement->execute([$id, $expires, $data]);
    }

    public function destroy(string $id): bool
    {
        $statement = $this->database->prepare('DELETE FROM app_php_sessions WHERE session_id = ?');
        return $statement->execute([$id]);
    }

    public function gc(int $max_lifetime): int|false
    {
        $statement = $this->database->prepare('DELETE FROM app_php_sessions WHERE expires <= ?');
        $statement->execute([time()]);
        return $statement->rowCount();
    }
}
