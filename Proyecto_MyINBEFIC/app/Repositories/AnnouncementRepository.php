<?php
declare(strict_types=1);

final class AnnouncementRepository
{
    public static function all(): array
    {
        $statement = Database::connection()->query(
            'SELECT a.id, a.source_id AS sourceId, a.title, a.body, a.payload, a.created_at AS createdAt,
                    a.created_by AS authorId, u.full_name AS author
               FROM announcements a
               JOIN app_users u ON u.id = a.created_by
              ORDER BY a.created_at DESC, a.id DESC
              LIMIT 100'
        );
        return $statement->fetchAll();
    }

    public static function save(
        ?string $sourceId,
        int $authorId,
        string $title,
        string $body,
        string $payload
    ): ?array {
        $database = Database::connection();
        $statement = $database->prepare(
            'INSERT INTO announcements (source_id, created_by, title, body, payload)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE title = VALUES(title), body = VALUES(body), payload = VALUES(payload)'
        );
        $statement->execute([$sourceId, $authorId, $title, $body, $payload]);
        if ($sourceId !== null) {
            $statement = $database->prepare(
                'SELECT id, title, body, created_at AS createdAt FROM announcements WHERE created_by = ? AND source_id = ?'
            );
            $statement->execute([$authorId, $sourceId]);
        } else {
            $statement = $database->prepare(
                'SELECT id, title, body, created_at AS createdAt FROM announcements WHERE id = ?'
            );
            $statement->execute([(int) $database->lastInsertId()]);
        }
        $announcement = $statement->fetch();
        return $announcement ?: null;
    }

    public static function deleteBySourceId(int $authorId, string $sourceId): void
    {
        $statement = Database::connection()->prepare(
            'DELETE FROM announcements WHERE created_by = ? AND source_id = ?'
        );
        $statement->execute([$authorId, $sourceId]);
    }
}
