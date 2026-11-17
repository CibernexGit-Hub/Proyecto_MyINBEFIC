<?php
declare(strict_types=1);

final class ApiController
{
    public static function dispatch(string $method, string $path): never
    {
        if ($path === '/api/auth/me' && $method === 'GET') {
            AuthController::current();
        }
        if ($path === '/api/auth/logout' && $method === 'POST') {
            AuthController::logout();
        }
        if ($path === '/api/student/portal' && $method === 'GET') {
            self::studentPortal();
        }
        if ($path === '/api/teacher/students' && $method === 'GET') {
            self::teacherStudents();
        }
        if ($path === '/api/teacher/guide-assignment' && $method === 'PUT') {
            self::updateGuideAssignment();
        }
        if ($path === '/api/teacher/grades' && $method === 'POST') {
            self::saveGrade();
        }
        if ($path === '/api/announcements' && $method === 'GET') {
            self::listAnnouncements();
        }
        if ($path === '/api/announcements' && $method === 'POST') {
            self::saveAnnouncement();
        }
        if (preg_match('~^/api/announcements/(.+)$~u', $path, $matches) === 1 && $method === 'DELETE') {
            self::deleteAnnouncement($matches[1]);
        }
        if ($path === '/api/app-data' && $method === 'GET') {
            self::getAppData();
        }
        if ($path === '/api/app-data/import' && $method === 'POST') {
            self::importAppData();
        }
        if (preg_match('~^/api/app-data/([^/]+)$~u', $path, $matches) === 1 && $method === 'PUT') {
            self::saveAppData($matches[1]);
        }
        if (preg_match('~^/api/app-data/([^/]+)$~u', $path, $matches) === 1 && $method === 'DELETE') {
            self::deleteAppData($matches[1]);
        }
        jsonResponse(['error' => 'Ruta de API no encontrada.'], 404);
    }

    private static function studentPortal(): never
    {
        $user = requireSignedInUser();
        if ($user['role'] !== 'estudiante') {
            jsonResponse(['error' => 'Esta sección es exclusiva para estudiantes.'], 403);
        }
        $profile = $user['profile'];
        $grades = AcademicRepository::gradesForStudent((int) $user['id']);
        $teachers = UserRepository::listTeachers();
        $guide = null;
        foreach ($teachers as $teacher) {
            $teacherProfile = jsonValue($teacher['profile'], []);
            if (is_array($teacherProfile) && isTeacherGuideForStudent($teacherProfile, $profile)) {
                $guide = ['name' => $teacher['fullName']];
                break;
            }
        }
        jsonResponse([
            'student' => [
                'grade' => $profile['grado'] ?? '',
                'section' => $profile['seccion'] ?? '',
                'nie' => $profile['nie'] ?? '',
            ],
            'teacher' => $guide,
            'grades' => $grades,
        ]);
    }

    private static function teacherStudents(): never
    {
        $user = requireSignedInUser();
        if ($user['role'] !== 'docente') {
            jsonResponse(['error' => 'Esta lista es exclusiva para docentes.'], 403);
        }
        $teacherProfile = $user['profile'];
        if (empty($teacherProfile['grado_guia']) || empty($teacherProfile['seccion_guia'])) {
            jsonResponse(['guide' => null, 'students' => []]);
        }

        $students = [];
        foreach (UserRepository::listStudents() as $student) {
            $profile = jsonValue($student['profile'], []);
            if (!is_array($profile) || !isTeacherGuideForStudent($teacherProfile, $profile)) {
                continue;
            }
            $name = trim(($profile['nombres'] ?? '') . ' ' . ($profile['apellidos'] ?? ''));
            $students[] = [
                'id' => (int) $student['id'],
                'name' => $name !== '' ? $name : $student['fullName'],
                'nie' => $profile['nie'] ?? '',
                'grade' => $profile['grado'] ?? '',
                'section' => $profile['seccion'] ?? '',
            ];
        }
        jsonResponse([
            'guide' => ['grade' => $teacherProfile['grado_guia'], 'section' => $teacherProfile['seccion_guia']],
            'students' => $students,
            'grades' => AcademicRepository::gradesForTeacher((int) $user['id']),
        ]);
    }

    private static function updateGuideAssignment(): never
    {
        requireMethod('PUT');
        requireOrigin();
        $user = requireSignedInUser();
        if ($user['role'] !== 'docente') {
            jsonResponse(['error' => 'Solo Docencia puede configurar su sección guía.'], 403);
        }
        $body = requestJson();
        $requestedGrade = safeString($body['grade'] ?? null, 60);
        $requestedSection = strtoupper(safeString($body['section'] ?? null, 3));
        $rules = profileRules()['roles']['docente']['grado_guia']['choices'];
        $grade = null;
        foreach ($rules as $choice) {
            if (normalizeAcademicValue($choice) === normalizeAcademicValue($requestedGrade)) {
                $grade = $choice;
                break;
            }
        }
        if ($grade === null || !preg_match('/^[A-Z0-9]{1,3}$/', $requestedSection)) {
            jsonResponse(['error' => 'Selecciona un grado válido y una sección de hasta tres caracteres.'], 400);
        }

        foreach (UserRepository::listTeachersExcept((int) $user['id']) as $teacher) {
            $profile = jsonValue($teacher['profile'], []);
            if (normalizeAcademicValue($profile['grado_guia'] ?? '') === normalizeAcademicValue($grade)
                && normalizeAcademicValue($profile['seccion_guia'] ?? '') === normalizeAcademicValue($requestedSection)) {
                jsonResponse(['error' => 'Otro docente ya tiene asignado ese grado y sección guía.'], 409);
            }
        }
        UserRepository::updateGuideAssignment((int) $user['id'], $grade, $requestedSection);
        jsonResponse(['guide' => ['grade' => $grade, 'section' => $requestedSection]]);
    }

    private static function saveGrade(): never
    {
        requireMethod('POST');
        requireOrigin();
        $user = requireSignedInUser();
        if ($user['role'] !== 'docente') {
            jsonResponse(['error' => 'Solo docentes pueden registrar calificaciones.'], 403);
        }
        $body = requestJson();
        $studentId = filter_var($body['studentId'] ?? null, FILTER_VALIDATE_INT);
        $subject = safeString($body['subject'] ?? null, 100);
        $period = safeString($body['period'] ?? null, 60);
        $scoreValue = $body['score'] ?? null;
        $score = is_numeric($scoreValue) ? (float) $scoreValue : NAN;
        $comment = safeString($body['comment'] ?? null, 500);
        if ($studentId === false || $studentId < 1 || $subject === '' || $period === ''
            || !is_finite($score) || $score < 0 || $score > 10) {
            jsonResponse(['error' => 'Revisa el estudiante, la asignatura, el período y la nota (0 a 10).'], 400);
        }
        if (!in_array($period, ['Primer periodo', 'Segundo periodo', 'Tercer periodo', 'Cuarto periodo'], true)) {
            jsonResponse(['error' => 'Selecciona un período académico válido.'], 400);
        }

        $student = UserRepository::findStudent($studentId);
        if (!$student) {
            jsonResponse(['error' => 'No se encontró el estudiante seleccionado.'], 404);
        }
        $studentProfile = jsonValue($student['profile'], []);
        if (!isTeacherGuideForStudent($user['profile'], $studentProfile)) {
            jsonResponse(['error' => 'Solo puedes calificar estudiantes de tu grado y sección guía.'], 403);
        }
        AcademicRepository::saveGrade($studentId, (int) $user['id'], $subject, $period, $score, $comment);
        jsonResponse(['saved' => true], 201);
    }

    private static function listAnnouncements(): never
    {
        requireSignedInUser();
        $announcements = array_map(static function (array $item): array {
            $item['payload'] = jsonValue($item['payload'], []);
            return $item;
        }, AnnouncementRepository::all());
        jsonResponse(['announcements' => $announcements]);
    }

    private static function saveAnnouncement(): never
    {
        requireMethod('POST');
        requireOrigin();
        $user = requireSignedInUser();
        if ($user['role'] !== 'secretaria') {
            jsonResponse(['error' => 'Solo Secretaría puede publicar avisos generales.'], 403);
        }
        $body = requestJson();
        $notice = $body['notice'] ?? null;
        if (!is_array($notice) || ($notice !== [] && array_is_list($notice))) {
            jsonResponse(['error' => 'El aviso enviado no es válido.'], 400);
        }
        $title = safeString($notice['nombre'] ?? $notice['title'] ?? null, 180);
        $content = safeString($notice['comentario'] ?? $notice['body'] ?? null, 4000);
        $sourceId = array_key_exists('id', $notice) && $notice['id'] !== null
            ? safeString((string) $notice['id'], 120)
            : null;
        if ($title === '' || $content === '') {
            jsonResponse(['error' => 'El aviso debe incluir título y contenido.'], 400);
        }
        $serialized = json_encode($notice, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        if (strlen($serialized) > 5 * 1024 * 1024) {
            jsonResponse(['error' => 'El aviso y sus imágenes superan el tamaño permitido.'], 413);
        }
        $saved = AnnouncementRepository::save($sourceId, (int) $user['id'], $title, $content, $serialized);
        if ($saved === null) {
            throw new RuntimeException('No se pudo recuperar el aviso guardado.');
        }
        jsonResponse(['announcement' => $saved], 201);
    }

    private static function deleteAnnouncement(string $sourceId): never
    {
        requireMethod('DELETE');
        requireOrigin();
        $user = requireSignedInUser();
        if ($user['role'] !== 'secretaria') {
            jsonResponse(['error' => 'Solo Secretaría puede retirar avisos.'], 403);
        }
        $sourceId = safeString($sourceId, 120);
        if ($sourceId === '') {
            jsonResponse(['error' => 'El identificador del aviso no es válido.'], 400);
        }
        AnnouncementRepository::deleteBySourceId((int) $user['id'], $sourceId);
        emptyResponse();
    }

    private static function getAppData(): never
    {
        $user = requireDataUser();
        $data = [];
        foreach (SchoolDataRepository::all() as $row) {
            $data[$row['data_key']] = jsonValue($row['data_value']);
        }
        jsonResponse(['data' => $data, 'isEmpty' => $data === [], 'role' => $user['role']]);
    }

    private static function importAppData(): never
    {
        requireMethod('POST');
        requireOrigin();
        $user = requireDataUser();
        if ($user['role'] !== 'directora') {
            jsonResponse(['error' => 'Solo la Directora puede importar datos locales.'], 403);
        }
        $body = requestJson();
        $entries = $body['data'] ?? null;
        if (!is_array($entries) || ($entries !== [] && array_is_list($entries))) {
            jsonResponse(['error' => 'El formato de datos iniciales no es válido.'], 400);
        }
        if (count($entries) > 200) {
            jsonResponse(['error' => 'Hay demasiados registros para importar.'], 413);
        }
        $serializedEntries = [];
        foreach ($entries as $key => $value) {
            if (!isSharedDataKey((string) $key)) {
                jsonResponse(['error' => 'La clave ' . $key . ' no se puede importar.'], 400);
            }
            $serialized = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
            if (strlen($serialized) > 2 * 1024 * 1024) {
                jsonResponse(['error' => 'El registro ' . $key . ' supera el tamaño permitido.'], 413);
            }
            $serializedEntries[] = [(string) $key, $serialized];
        }

        jsonResponse(SchoolDataRepository::importMissing($serializedEntries, (int) $user['id']), 201);
    }

    private static function saveAppData(string $key): never
    {
        requireMethod('PUT');
        requireOrigin();
        $user = requireDataUser();
        if (!isSharedDataKey($key)) {
            jsonResponse(['error' => 'La clave de datos no es válida.'], 400);
        }
        if ($user['role'] === 'secretaria') {
            jsonResponse(['error' => 'El perfil de Secretaría solo puede consultar datos.'], 403);
        }
        if (!canWriteSharedData($user['role'], $key)) {
            jsonResponse(['error' => 'Este cargo no puede modificar este tipo de dato.'], 403);
        }
        $body = requestJson();
        if (!array_key_exists('value', $body)) {
            jsonResponse(['error' => 'El dato no es válido o supera el tamaño permitido.'], 413);
        }
        $serialized = json_encode($body['value'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        if (strlen($serialized) > 2 * 1024 * 1024) {
            jsonResponse(['error' => 'El dato no es válido o supera el tamaño permitido.'], 413);
        }
        SchoolDataRepository::save($key, $serialized, (int) $user['id']);
        emptyResponse();
    }

    private static function deleteAppData(string $key): never
    {
        requireMethod('DELETE');
        requireOrigin();
        $user = requireDataUser();
        if (!isSharedDataKey($key)) {
            jsonResponse(['error' => 'La clave de datos no es válida.'], 400);
        }
        if (!canWriteSharedData($user['role'], $key)) {
            jsonResponse(['error' => 'Este cargo no puede eliminar este tipo de dato.'], 403);
        }
        SchoolDataRepository::delete($key);
        emptyResponse();
    }
}
