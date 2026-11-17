<?php
declare(strict_types=1);

require_once __DIR__ . '/Config.php';
require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/DatabaseSessionHandler.php';
require_once __DIR__ . '/Repositories/UserRepository.php';
require_once __DIR__ . '/Repositories/AcademicRepository.php';
require_once __DIR__ . '/Repositories/AnnouncementRepository.php';
require_once __DIR__ . '/Repositories/SchoolDataRepository.php';
require_once __DIR__ . '/Repositories/RateLimitRepository.php';
require_once __DIR__ . '/Http.php';
require_once __DIR__ . '/Support.php';
require_once __DIR__ . '/ProfileValidation.php';
require_once __DIR__ . '/AuthController.php';
require_once __DIR__ . '/ApiController.php';
require_once __DIR__ . '/PageController.php';

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
header('X-XSS-Protection: 0');
header_remove('X-Powered-By');
if (AppConfig::isProduction() && AppConfig::isSecureRequest()) {
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
}
