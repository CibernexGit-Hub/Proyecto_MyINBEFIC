<?php
declare(strict_types=1);

final class AuthController
{
    public static function beginGoogleLogin(): never
    {
        self::redirectLoopbackAlias();
        startAppSession();
        registerRateLimit('google-oauth');
        if (($_GET['mode'] ?? '') === 'register') {
            redirectWithAuthError('Completa los datos del perfil antes de continuar con Google.');
        }

        $state = bin2hex(random_bytes(32));
        $nonce = bin2hex(random_bytes(32));
        $_SESSION['googleOAuth'] = ['state' => $state, 'nonce' => $nonce, 'mode' => 'login'];
        closeAppSession();
        self::redirectToGoogle($state, $nonce);
    }

    public static function beginGoogleRegistration(): never
    {
        requireMethod('POST');
        requireOrigin();
        registerRateLimit('google-oauth');
        $body = requestJson();
        $validation = validateGoogleRegistration(
            $body['role'] ?? null,
            $body['profile'] ?? null,
            $body['termsAccepted'] ?? null
        );
        if (is_string($validation)) {
            jsonResponse(['error' => $validation], 400);
        }

        startAppSession();
        $state = bin2hex(random_bytes(32));
        $nonce = bin2hex(random_bytes(32));
        $_SESSION['googleOAuth'] = [
            'state' => $state,
            'nonce' => $nonce,
            'mode' => 'register',
            'role' => $body['role'],
            'profile' => $validation['profile'],
        ];
        closeAppSession();
        jsonResponse(['authorizationUrl' => self::googleUrl($state, $nonce)]);
    }

    public static function googleCallback(): never
    {
        startAppSession();
        registerRateLimit('google-oauth');
        $intent = $_SESSION['googleOAuth'] ?? null;
        unset($_SESSION['googleOAuth']);

        if (isset($_GET['error'])) {
            redirectWithAuthError('Se canceló el inicio de sesión con Google.');
        }
        $returnedState = safeString($_GET['state'] ?? null, 200);
        if (!is_array($intent) || !isset($intent['state']) || $returnedState === ''
            || !hash_equals((string) $intent['state'], $returnedState)) {
            redirectWithAuthError('La verificación de Google venció. Intenta de nuevo.');
        }
        $code = safeString($_GET['code'] ?? null, 2048);
        if ($code === '') {
            redirectWithAuthError('Google no devolvió un código de acceso válido.');
        }

        try {
            $claims = self::exchangeAndVerifyCode($code, (string) $intent['nonce']);
            $user = self::resolveGoogleUser($claims, $intent);
            if (!session_regenerate_id(true)) {
                throw new RuntimeException('No se pudo iniciar una sesión segura. Intenta de nuevo.');
            }
            $_SESSION['userId'] = (int) $user['id'];
            closeAppSession();

            $screens = [
                'directora' => 'Pantalla de directora.html',
                'estudiante' => 'Pantalla de estudiante--ultima versión.html',
                'docente' => 'Pantalla de docente.html',
                'subdirectora' => 'Subdirectora  ultima versión.html',
                'secretaria' => 'sistemadesecretaria ultimaversion.html',
            ];
            $role = $user['role'];
            header('Location: /' . rawurlencode($screens[$role]) . '?cargo=' . rawurlencode($role), true, 302);
            exit;
        } catch (RuntimeException $error) {
            error_log('No se pudo completar el inicio de sesión con Google: ' . $error->getMessage());
            redirectWithAuthError($error->getMessage());
        } catch (Throwable $error) {
            error_log('Error al procesar el inicio de sesión con Google: ' . $error->getMessage());
            redirectWithAuthError('No se pudo verificar la cuenta. Intenta de nuevo.');
        }
    }

    public static function current(): never
    {
        $user = currentUser();
        if (!$user) {
            jsonResponse(['error' => 'Inicia sesión con Google.'], 401);
        }
        jsonResponse(['user' => $user]);
    }

    public static function logout(): never
    {
        requireMethod('POST');
        requireOrigin();
        startAppSession();
        $_SESSION = [];
        if (!session_destroy()) {
            jsonResponse(['error' => 'No se pudo cerrar la sesión.'], 500);
        }
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => '/',
            'secure' => AppConfig::isProduction() || AppConfig::isSecureRequest(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        emptyResponse();
    }

    private static function googleUrl(string $state, string $nonce): string
    {
        $clientId = AppConfig::required('GOOGLE_CLIENT_ID');
        $clientSecret = AppConfig::required('GOOGLE_CLIENT_SECRET');
        if (str_contains($clientId, 'replace-with') || str_contains($clientSecret, 'replace-with')) {
            throw new RuntimeException('Configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET con las credenciales de Google Cloud.');
        }

        return 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
            'client_id' => $clientId,
            'redirect_uri' => AppConfig::callbackUrl(),
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'access_type' => 'online',
            'prompt' => 'select_account',
            'state' => $state,
            'nonce' => $nonce,
        ], '', '&', PHP_QUERY_RFC3986);
    }

    private static function redirectLoopbackAlias(): void
    {
        if (AppConfig::isProduction() || strtolower((string) parse_url(AppConfig::appOrigin(), PHP_URL_HOST)) !== 'localhost') {
            return;
        }

        $port = parse_url(AppConfig::appOrigin(), PHP_URL_PORT);
        $loopbackHost = '127.0.0.1' . ($port === null ? '' : ':' . $port);
        if (strtolower((string) ($_SERVER['HTTP_HOST'] ?? '')) !== $loopbackHost) {
            return;
        }

        $mode = safeString($_GET['mode'] ?? null, 20);
        $query = $mode === '' ? '' : '?mode=' . rawurlencode($mode);
        header('Location: ' . AppConfig::appOrigin() . '/auth/google' . $query, true, 302);
        exit;
    }

    private static function redirectToGoogle(string $state, string $nonce): never
    {
        header('Location: ' . self::googleUrl($state, $nonce), true, 302);
        exit;
    }

    private static function exchangeAndVerifyCode(string $code, string $nonce): array
    {
        $clientId = AppConfig::required('GOOGLE_CLIENT_ID');
        $clientSecret = AppConfig::required('GOOGLE_CLIENT_SECRET');
        $response = self::googleRequest('https://oauth2.googleapis.com/token', [
            'code' => $code,
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'redirect_uri' => AppConfig::callbackUrl(),
            'grant_type' => 'authorization_code',
        ]);
        $idToken = $response['id_token'] ?? null;
        if (!is_string($idToken) || $idToken === '') {
            throw new RuntimeException('Google no confirmó la identidad de esta cuenta.');
        }

        $claims = self::googleRequest(
            'https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode($idToken),
            null
        );
        $issuerValid = in_array($claims['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true);
        $expiry = filter_var($claims['exp'] ?? null, FILTER_VALIDATE_INT);
        $verified = ($claims['email_verified'] ?? false) === true
            || ($claims['email_verified'] ?? '') === 'true';
        if (!$issuerValid || ($claims['aud'] ?? '') !== $clientId
            || $expiry === false || $expiry <= time()
            || !$verified || empty($claims['sub'])
            || !isset($claims['nonce']) || !hash_equals($nonce, (string) $claims['nonce'])
            || empty($claims['email'])) {
            throw new RuntimeException('No se pudo verificar el correo de Google.');
        }
        return $claims;
    }

    private static function googleRequest(string $url, ?array $form): array
    {
        $curl = curl_init($url);
        if ($curl === false) {
            throw new RuntimeException('No se pudo conectar con Google.');
        }
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        if ($form !== null) {
            curl_setopt_array($curl, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => http_build_query($form, '', '&', PHP_QUERY_RFC3986),
                CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
            ]);
        }

        $body = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        $curlError = curl_error($curl);
        curl_close($curl);
        if (!is_string($body) || $status < 200 || $status >= 300) {
            error_log('Solicitud de OAuth a Google falló. HTTP ' . $status . ($curlError ? ': ' . $curlError : ''));
            throw new RuntimeException('No se pudo verificar la cuenta con Google. Intenta de nuevo.');
        }
        try {
            $decoded = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $error) {
            throw new RuntimeException('Google devolvió una respuesta no válida.', 0, $error);
        }
        if (!is_array($decoded)) {
            throw new RuntimeException('Google devolvió una respuesta no válida.');
        }
        return $decoded;
    }

    private static function resolveGoogleUser(array $claims, array $intent): array
    {
        $googleId = safeString($claims['sub'] ?? null, 255);
        $email = mb_strtolower(safeString($claims['email'] ?? null, 320));
        $fullName = safeString($claims['name'] ?? $email, 200);
        if ($googleId === '' || $email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('Google devolvió una identidad no válida.');
        }

        if (($intent['mode'] ?? '') === 'register' && ($intent['role'] ?? '') !== 'estudiante'
            && AppConfig::isProduction()) {
            $allowlist = array_filter(array_map(
                static fn(string $allowedEmail): string => mb_strtolower(trim($allowedEmail)),
                explode(',', AppConfig::get('AUTHORIZED_STAFF_EMAILS', '') ?? '')
            ));
            if (!in_array($email, $allowlist, true)) {
                throw new RuntimeException('Este correo no está autorizado para registrar un perfil de personal escolar.');
            }
        }

        $user = UserRepository::findByGoogleId($googleId);
        if (!$user) {
            $user = UserRepository::findByEmail($email);
        }
        if ($user && $user['google_sub'] !== $googleId) {
            throw new RuntimeException('Este correo ya está asociado a otra identidad de Google. Contacta a soporte.');
        }

        if (($intent['mode'] ?? '') === 'register') {
            $role = $intent['role'] ?? '';
            if (!in_array($role, VALID_ROLES, true)) {
                throw new RuntimeException('El cargo seleccionado ya no es válido.');
            }
            if ($user) {
                if ($user['role'] !== $role) {
                    throw new RuntimeException('Esta cuenta ya tiene otro cargo. Inicia sesión para conservar el perfil existente.');
                }
                $profile = jsonValue($user['profile'], []);
                if (is_array($profile) && count($profile) > 0) {
                    throw new RuntimeException('Esta cuenta ya tiene un perfil completo. Inicia sesión con Google.');
                }
                $profileJson = json_encode($intent['profile'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
                if (!UserRepository::completeEmptyProfile((int) $user['id'], $email, $fullName, $profileJson)) {
                    throw new RuntimeException('El perfil ya se completó. Inicia sesión con Google.');
                }
            } else {
                try {
                    $user = [
                        'id' => UserRepository::create(
                            $googleId,
                            $email,
                            $fullName,
                            $role,
                            json_encode($intent['profile'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)
                        ),
                        'role' => $role,
                    ];
                } catch (PDOException $error) {
                    if (($error->errorInfo[1] ?? null) === 1062) {
                        throw new RuntimeException('Esta cuenta ya tiene un perfil. Inicia sesión con Google.', 0, $error);
                    }
                    throw $error;
                }
            }
        } elseif (!$user) {
            throw new RuntimeException('No hay un perfil con este Google. Regístrate primero.');
        } else {
            UserRepository::updateGoogleIdentity((int) $user['id'], $email, $fullName);
        }

        return ['id' => (int) $user['id'], 'role' => $user['role'] ?? $intent['role']];
    }
}
