<?php
declare(strict_types=1);

final class SchoolDataRepository
{
    public static function all(): array
    {
        $statement = Database::connection()->query(
            'SELECT data_key, data_value FROM school_data ORDER BY data_key'
        );
        return $statement->fetchAll();
    }

    public static function importMissing(array $entries, int $userId): array
    {
        $database = Database::connection();
        $database->beginTransaction();
        try {
            $statement = $database->prepare(
                'INSERT IGNORE INTO school_data (data_key, data_value, updated_by) VALUES (?, ?, ?)'
            );
            $imported = 0;
            $skipped = 0;
            foreach ($entries as [$key, $serialized]) {
                $statement->execute([$key, $serialized, $userId]);
                if ($statement->rowCount() === 1) {
                    $imported++;
                } else {
                    $skipped++;
                }
            }
            $database->commit();
            return ['imported' => $imported, 'skipped' => $skipped];
        } catch (Throwable $error) {
            $database->rollBack();
            throw $error;
        }
    }

    public static function save(string $key, string $serialized, int $userId): void
    {
        $statement = Database::connection()->prepare(
            'INSERT INTO school_data (data_key, data_value, updated_by)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE data_value = VALUES(data_value), updated_by = VALUES(updated_by)'
        );
        $statement->execute([$key, $serialized, $userId]);
    }

    public static function delete(string $key): void
    {
        $statement = Database::connection()->prepare('DELETE FROM school_data WHERE data_key = ?');
        $statement->execute([$key]);
    }
}
