<?php
declare(strict_types=1);

final class UserRepository
{
    public static function findByGoogleId(string $googleId): ?array
    {
        $statement = Database::connection()->prepare(
            'SELECT id, google_sub, role, profile FROM app_users WHERE google_sub = ?'
        );
        $statement->execute([$googleId]);
        $user = $statement->fetch();
        return $user ?: null;
    }

    public static function findByEmail(string $email): ?array
    {
        $statement = Database::connection()->prepare(
            'SELECT id, google_sub, role, profile FROM app_users WHERE LOWER(email) = ?'
        );
        $statement->execute([$email]);
        $user = $statement->fetch();
        return $user ?: null;
    }

    public static function findSessionUser(int $userId): ?array
    {
        $statement = Database::connection()->prepare(
            'SELECT id, email, full_name AS fullName, role, profile FROM app_users WHERE id = ?'
        );
        $statement->execute([$userId]);
        $user = $statement->fetch();
        return $user ?: null;
    }

    public static function completeEmptyProfile(
        int $userId,
        string $email,
        string $fullName,
        string $profileJson
    ): bool {
        $statement = Database::connection()->prepare(
            'UPDATE app_users
                SET email = ?, email_verified = TRUE, full_name = ?, profile = ?,
                    terms_accepted_at = NOW(), updated_at = NOW()
              WHERE id = ? AND (profile IS NULL OR JSON_LENGTH(profile) = 0)'
        );
        $statement->execute([$email, $fullName, $profileJson, $userId]);
        return $statement->rowCount() === 1;
    }

    public static function create(
        string $googleId,
        string $email,
        string $fullName,
        string $role,
        string $profileJson
    ): int {
        $statement = Database::connection()->prepare(
            'INSERT INTO app_users (google_sub, email, email_verified, full_name, role, profile, terms_accepted_at)
             VALUES (?, ?, TRUE, ?, ?, ?, NOW())'
        );
        $statement->execute([$googleId, $email, $fullName, $role, $profileJson]);
        return (int) Database::connection()->lastInsertId();
    }

    public static function updateGoogleIdentity(int $userId, string $email, string $fullName): void
    {
        $statement = Database::connection()->prepare(
            'UPDATE app_users SET email = ?, email_verified = TRUE, full_name = ?, updated_at = NOW()
              WHERE id = ?'
        );
        $statement->execute([$email, $fullName, $userId]);
    }

    public static function findStudent(int $studentId): ?array
    {
        $statement = Database::connection()->prepare(
            "SELECT id, profile FROM app_users WHERE id = ? AND role = 'estudiante'"
        );
        $statement->execute([$studentId]);
        $student = $statement->fetch();
        return $student ?: null;
    }

    public static function listTeachersExcept(int $userId): array
    {
        $statement = Database::connection()->prepare(
            "SELECT id, profile FROM app_users WHERE role = 'docente' AND id <> ?"
        );
        $statement->execute([$userId]);
        return $statement->fetchAll();
    }

    public static function listTeachers(): array
    {
        $statement = Database::connection()->query(
            "SELECT id, full_name AS fullName, profile FROM app_users WHERE role = 'docente'"
        );
        return $statement->fetchAll();
    }

    public static function listStudents(): array
    {
        $statement = Database::connection()->query(
            "SELECT id, full_name AS fullName, profile FROM app_users WHERE role = 'estudiante' ORDER BY full_name"
        );
        return $statement->fetchAll();
    }

    public static function updateGuideAssignment(int $teacherId, string $grade, string $section): void
    {
        $statement = Database::connection()->prepare(
            "UPDATE app_users
                SET profile = JSON_SET(profile, '$.grado_guia', ?, '$.seccion_guia', ?), updated_at = NOW()
              WHERE id = ? AND role = 'docente'"
        );
        $statement->execute([$grade, $section, $teacherId]);
    }
}
