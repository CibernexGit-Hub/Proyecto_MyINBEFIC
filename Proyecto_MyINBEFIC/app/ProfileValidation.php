<?php
declare(strict_types=1);

function profileRules(): array
{
    $academicLevels = [
        'Parvularia', '1° grado', '2° grado', '3° grado', '4° grado', '5° grado', '6° grado',
        '7° grado', '8° grado', '9° grado', '1° año de bachillerato', '2° año de bachillerato',
        '3° año de bachillerato',
    ];
    $education = ['Bachillerato', 'Técnico', 'Profesorado', 'Licenciatura', 'Ingeniería', 'Maestría', 'Doctorado'];
    $shifts = ['Matutino', 'Vespertino', 'Nocturno', 'Tiempo completo'];
    $dui = ['label' => 'DUI', 'required' => true, 'maxLength' => 10, 'pattern' => '/^\d{8}-?\d$/u'];
    $institution = ['label' => 'Institución educativa', 'required' => true, 'maxLength' => 100, 'minLength' => 3];
    $code = ['label' => 'Código de infraestructura', 'required' => true, 'maxLength' => 12, 'pattern' => '/^[A-Za-z0-9-]{3,12}$/u'];
    $studies = ['label' => 'Último grado académico', 'required' => true, 'choices' => $education];
    $years = ['label' => 'Años de experiencia', 'required' => true, 'min' => 0, 'max' => 50];
    $turn = ['label' => 'Turno', 'required' => true, 'choices' => $shifts];
    $nivel = ['label' => 'Nivel que atiende', 'required' => true, 'choices' => ['Parvularia', 'Básica (1° a 9° grado)', 'Media (bachillerato)', 'Todos los niveles']];

    return [
        'common' => [
            'nombres' => ['label' => 'Nombres', 'required' => true, 'maxLength' => 60, 'pattern' => "/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]{2,60}$/u"],
            'apellidos' => ['label' => 'Apellidos', 'required' => true, 'maxLength' => 60, 'pattern' => "/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]{2,60}$/u"],
            'nacimiento' => ['label' => 'Fecha de nacimiento', 'required' => true, 'maxLength' => 10, 'pattern' => '/^\d{4}-\d{2}-\d{2}$/u'],
            'genero' => ['label' => 'Sexo', 'required' => true, 'choices' => ['Femenino', 'Masculino']],
            'telefono' => ['label' => 'Teléfono', 'required' => true, 'maxLength' => 15, 'pattern' => '/^[0-9+\-\s]{8,15}$/u'],
            'correo' => ['label' => 'Correo electrónico de contacto', 'required' => true, 'maxLength' => 254, 'pattern' => '/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u'],
        ],
        'roles' => [
            'directora' => [
                'dui' => $dui, 'institucion' => $institution, 'codigo' => $code,
                'nivel' => ['label' => 'Nivel que dirige', 'required' => true, 'choices' => ['Parvularia', 'Básica (1° a 9° grado)', 'Media (bachillerato)', 'Todos los niveles']],
                'estudios' => $studies, 'anios' => ['label' => 'Años en el cargo de dirección', 'required' => true, 'min' => 0, 'max' => 50],
            ],
            'subdirectora' => [
                'dui' => $dui, 'institucion' => $institution, 'codigo' => $code,
                'area' => ['label' => 'Área a cargo', 'required' => true, 'choices' => ['Académica', 'Administrativa', 'Disciplina', 'Pedagógica']],
                'turno' => $turn, 'estudios' => $studies, 'anios' => ['label' => 'Años en el cargo', 'required' => true, 'min' => 0, 'max' => 50],
            ],
            'docente' => [
                'dui' => $dui, 'institucion' => $institution, 'codigo' => $code,
                'especialidad' => ['label' => 'Especialidad o asignatura(s)', 'required' => true, 'maxLength' => 100, 'minLength' => 3],
                'nivel' => $nivel, 'turno' => $turn, 'estudios' => $studies,
                'anios' => ['label' => 'Años de experiencia', 'required' => true, 'min' => 0, 'max' => 50],
                'grado_guia' => ['label' => 'Grado como docente guía', 'required' => false, 'choices' => $academicLevels],
                'seccion_guia' => ['label' => 'Sección guía', 'required' => false, 'maxLength' => 3, 'pattern' => '/^[A-Za-z0-9]{1,3}$/u'],
            ],
            'estudiante' => [
                'nie' => ['label' => 'NIE', 'required' => true, 'maxLength' => 12, 'pattern' => '/^\d{5,12}$/u'],
                'institucion' => $institution, 'grado' => ['label' => 'Grado que cursa', 'required' => true, 'choices' => $academicLevels],
                'seccion' => ['label' => 'Sección', 'required' => true, 'maxLength' => 3, 'pattern' => '/^[A-Za-z0-9]{1,3}$/u'],
                'turno' => $turn,
                'resp_nombre' => ['label' => 'Nombre del responsable', 'required' => true, 'maxLength' => 60, 'pattern' => "/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]{2,60}$/u"],
                'parentesco' => ['label' => 'Parentesco', 'required' => true, 'choices' => ['Madre', 'Padre', 'Abuelo/a', 'Tío/a', 'Hermano/a', 'Otro']],
                'resp_tel' => ['label' => 'Teléfono del responsable', 'required' => true, 'maxLength' => 15, 'pattern' => '/^[0-9+\-\s]{8,15}$/u'],
                'resp_dui' => ['label' => 'DUI del responsable', 'required' => false, 'maxLength' => 10, 'pattern' => '/^\d{8}-?\d$/u'],
            ],
            'secretaria' => [
                'dui' => $dui, 'institucion' => $institution, 'codigo' => $code,
                'area' => ['label' => 'Área de trabajo', 'required' => true, 'choices' => ['Registro académico', 'Administración', 'Atención al público', 'Archivo y documentos']],
                'turno' => $turn, 'estudios' => $studies,
                'anios' => ['label' => 'Años de experiencia', 'required' => true, 'min' => 0, 'max' => 50],
            ],
        ],
    ];
}

function validateGoogleRegistration(mixed $role, mixed $profile, mixed $termsAccepted): array|string
{
    if (!is_string($role) || !in_array($role, VALID_ROLES, true)) {
        return 'Selecciona un cargo válido.';
    }
    if ($termsAccepted !== true) {
        return 'Debes aceptar los términos y la política de privacidad.';
    }
    if (!is_array($profile) || isset($profile[0])) {
        return 'Completa los datos del registro.';
    }
    if (($profile['cargo'] ?? null) !== $role) {
        return 'El cargo seleccionado no coincide con los datos del formulario.';
    }

    $allRules = profileRules();
    $rules = $allRules['common'] + $allRules['roles'][$role] + [
        'cargo' => ['required' => true, 'choices' => [$role]],
    ];
    if (array_diff(array_keys($profile), array_keys($rules))) {
        return 'El formulario contiene campos no válidos.';
    }

    $normalized = [];
    foreach ($rules as $field => $rule) {
        $raw = $profile[$field] ?? null;
        if (!is_string($raw)) {
            if ($rule['required']) {
                return 'Completa el campo ' . ($rule['label'] ?? 'obligatorio') . '.';
            }
            continue;
        }
        $value = trim($raw);
        if ($value === '') {
            if ($rule['required']) {
                return 'Completa el campo ' . ($rule['label'] ?? 'obligatorio') . '.';
            }
            continue;
        }
        if (isset($rule['maxLength']) && mb_strlen($value) > $rule['maxLength']) {
            return 'Revisa el campo ' . $rule['label'] . '.';
        }
        if (isset($rule['minLength']) && mb_strlen($value) < $rule['minLength']) {
            return 'Revisa el campo ' . $rule['label'] . '.';
        }
        if (isset($rule['pattern']) && preg_match($rule['pattern'], $value) !== 1) {
            return 'El formato de ' . $rule['label'] . ' no es válido.';
        }
        if (isset($rule['choices']) && !in_array($value, $rule['choices'], true)) {
            return 'Selecciona una opción válida para ' . $rule['label'] . '.';
        }
        if (isset($rule['min'])) {
            $number = filter_var($value, FILTER_VALIDATE_INT);
            if ($number === false || $number < $rule['min'] || $number > $rule['max']) {
                return 'Revisa el campo ' . $rule['label'] . '.';
            }
        }
        $normalized[$field] = $value;
    }

    $birth = DateTimeImmutable::createFromFormat('!Y-m-d', $normalized['nacimiento'] ?? '');
    $dateErrors = DateTimeImmutable::getLastErrors();
    if (!$birth || ($dateErrors !== false && ($dateErrors['warning_count'] || $dateErrors['error_count']))
        || $birth->format('Y-m-d') !== ($normalized['nacimiento'] ?? '')) {
        return 'La fecha de nacimiento no es válida.';
    }
    $today = new DateTimeImmutable('today', new DateTimeZone('UTC'));
    $age = $birth->diff($today)->y;
    if ($birth > $today || $age > 100) {
        return 'Revisa la fecha de nacimiento.';
    }
    if ($role === 'estudiante' ? ($age < 3 || $age > 30) : $age < 18) {
        return $role === 'estudiante'
            ? 'La edad de un estudiante debe estar entre 3 y 30 años.'
            : 'Debes ser mayor de edad para este cargo.';
    }

    unset($normalized['cargo']);
    return ['profile' => $normalized];
}
