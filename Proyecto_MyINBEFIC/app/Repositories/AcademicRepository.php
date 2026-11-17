<?php
declare(strict_types=1);

final class AcademicRepository
{
    public static function gradesForStudent(int $studentId): array
    {
        $statement = Database::connection()->prepare(
            'SELECT g.subject, g.period, g.score, g.comment, g.updated_at AS updatedAt,
                    u.full_name AS teacherName
               FROM academic_grades g
               JOIN app_users u ON u.id = g.teacher_user_id
              WHERE g.student_user_id = ?
              ORDER BY g.period, g.subject'
        );
        $statement->execute([$studentId]);
        return $statement->fetchAll();
    }

    public static function gradesForTeacher(int $teacherId): array
    {
        $statement = Database::connection()->prepare(
            'SELECT student_user_id AS studentId, subject, period, score, comment, updated_at AS updatedAt
               FROM academic_grades WHERE teacher_user_id = ? ORDER BY updated_at DESC, subject'
        );
        $statement->execute([$teacherId]);
        return $statement->fetchAll();
    }

    public static function saveGrade(
        int $studentId,
        int $teacherId,
        string $subject,
        string $period,
        float $score,
        string $comment
    ): void {
        $statement = Database::connection()->prepare(
            'INSERT INTO academic_grades (student_user_id, teacher_user_id, subject, period, score, comment)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE teacher_user_id = VALUES(teacher_user_id),
               score = VALUES(score), comment = VALUES(comment), updated_at = NOW()'
        );
        $statement->execute([$studentId, $teacherId, $subject, $period, $score, $comment]);
    }
}
