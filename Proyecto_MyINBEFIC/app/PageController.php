<?php
declare(strict_types=1);

final class PageController
{
    private const START_PAGE = 'Pantalla_base de todo.html';

    private const ROLE_SCREENS = [
        'directora' => 'Pantalla de directora.html',
        'estudiante' => 'Pantalla de estudiante--ultima versión.html',
        'docente' => 'Pantalla de docente.html',
        'subdirectora' => 'Subdirectora  ultima versión.html',
        'secretaria' => 'sistemadesecretaria ultimaversion.html',
    ];

    private const PROTECTED_PAGES = [
        'Pantalla de directora.html' => ['directora'],
        'Pantalla de estudiante--ultima versión.html' => ['estudiante'],
        'Pantalla de docente.html' => ['docente'],
        'notasdocente.html' => ['docente'],
        'cuadro_notas_formal.html' => ['docente'],
        'Subdirectora  ultima versión.html' => ['subdirectora'],
        'sistemadesecretaria ultimaversion.html' => ['secretaria'],
    ];

    private const PUBLIC_PAGES = [
        'inicio de sesión ultima version.html',
        'Inicio de dia a dia.html',
        'Pantalla_base de todo.html',
    ];

    public static function dispatch(string $path): never
    {
        if ($path === '/') {
            self::redirectToStartPage();
        }

        $requested = ltrim($path, '/');
        if ($requested === '' || str_contains($requested, '/') || str_contains($requested, '\\')) {
            self::notFound();
        }

        if (isset(self::PROTECTED_PAGES[$requested])) {
            self::protectedPage($requested);
        }
        if (in_array($requested, self::PUBLIC_PAGES, true)) {
            self::sendPage($requested);
        }
        self::notFound();
    }

    private static function protectedPage(string $requested): never
    {
        $user = currentUser();
        if (!$user) {
            self::redirectToLogin();
        }
        if (!in_array($user['role'], self::PROTECTED_PAGES[$requested], true)) {
            self::redirectToRoleScreen($user['role']);
        }
        if (($_GET['cargo'] ?? null) !== $user['role']) {
            header('Location: /' . rawurlencode($requested) . '?cargo=' . rawurlencode($user['role']), true, 302);
            exit;
        }

        self::sendPage($requested, $user['role']);
    }

    private static function sendPage(string $filename, ?string $role = null): never
    {
        $file = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR
            . 'pages' . DIRECTORY_SEPARATOR . $filename;
        if (!is_file($file)) {
            self::notFound();
        }
        $content = file_get_contents($file);
        if ($content === false) {
            throw new RuntimeException('No se pudo cargar la pantalla solicitada.');
        }
        if ($role !== null) {
            $hasSyncScript = preg_match('~<script[^>]+src=["\'][^"\']*backend-sync\.js["\']~i', $content) === 1;
            $scripts = ($hasSyncScript ? '' : '<script src="/assets/js/backend-sync.js" defer></script>')
                . '<script src="/assets/js/announcements-sync.js" defer></script>';
            if ($role === 'docente' && $filename === self::ROLE_SCREENS['docente']) {
                $scripts .= '<script src="/assets/js/teacher-grades.js" defer></script>';
            }
            if ($role === 'estudiante' && $filename === self::ROLE_SCREENS['estudiante']) {
                $scripts .= '<script src="/assets/js/student-portal.js" defer></script>';
            }
            $bootstrap = '<style>html.inbefic-sync-loading body{visibility:hidden!important}</style>'
                . '<script>document.documentElement.classList.add("inbefic-sync-loading")</script>'
                . $scripts;
            $content = preg_replace('~<head([^>]*)>~i', '<head$1>' . $bootstrap, $content, 1) ?? $content;
        }

        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-store');
        echo $content;
        exit;
    }

    private static function redirectToLogin(): never
    {
        header('Location: /' . rawurlencode(self::PUBLIC_PAGES[0]), true, 302);
        exit;
    }

    private static function redirectToStartPage(): never
    {
        header('Location: /' . rawurlencode(self::START_PAGE), true, 302);
        exit;
    }

    private static function redirectToRoleScreen(string $role): never
    {
        if (!isset(self::ROLE_SCREENS[$role])) {
            self::redirectToLogin();
        }
        header(
            'Location: /' . rawurlencode(self::ROLE_SCREENS[$role]) . '?cargo=' . rawurlencode($role),
            true,
            302
        );
        exit;
    }

    private static function notFound(): never
    {
        http_response_code(404);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Página no encontrada.';
        exit;
    }
}
