require('dotenv').config();

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const { OAuth2Client } = require('google-auth-library');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const mysql = require('mysql2/promise');

const ROOT = __dirname;
const PUBLIC_ROOT = path.join(ROOT, 'public');
const PAGE_ROOT = path.join(PUBLIC_ROOT, 'pages');
const PORT = Number(process.env.PORT || 3000);
const APP_ORIGIN = process.env.APP_ORIGIN || `http://localhost:${PORT}`;
const LOGIN_PAGE = 'inicio de sesión ultima version.html';
const LOGIN_PATH = `/${encodeURIComponent(LOGIN_PAGE)}`;
const ROLE_SCREENS = {
  directora: 'Pantalla de directora.html',
  estudiante: 'Pantalla de estudiante--ultima versión.html',
  docente: 'Pantalla de docente.html',
  subdirectora: 'Subdirectora  ultima versión.html',
  secretaria: 'sistemadesecretaria ultimaversion.html'
};
const VALID_ROLES = new Set(Object.keys(ROLE_SCREENS));
const PROTECTED_PAGES = new Map([
  ['Pantalla de directora.html', new Set(['directora'])],
  ['Pantalla de estudiante--ultima versión.html', new Set(['estudiante'])],
  ['Pantalla de docente.html', new Set(['docente'])],
  ['notasdocente.html', new Set(['docente'])],
  ['cuadro_notas_formal.html', new Set(['docente'])],
  ['Subdirectora  ultima versión.html', new Set(['subdirectora'])],
  ['sistemadesecretaria ultimaversion.html', new Set(['secretaria'])]
]);
const PUBLIC_PAGES = new Set([
  LOGIN_PAGE,
  'Inicio de dia a dia.html',
  'Pantalla_base de todo.html'
]);
const ASSET_DIRECTORIES = new Set(['assets/css', 'assets/images', 'assets/js']);
const SESSION_MAX_AGE = 12 * 60 * 60 * 1000;
const SHARED_DATA_PREFIXES = ['inbefic:', 'convivencia-', 'secretaria-', 'docente-', 'sec_', 'educa_', 'notas-docente', 'cuadro-notas-'];

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta configurar ${name} en el archivo .env.`);
  return value;
}

const sessionSecret = required('SESSION_SECRET');
const googleClientId = required('GOOGLE_CLIENT_ID');
const googleClientSecret = required('GOOGLE_CLIENT_SECRET');
const mysqlPassword = process.env.MYSQL_PASSWORD || '';
if (sessionSecret.length < 32 || sessionSecret.includes('replace-with')) {
  throw new Error('SESSION_SECRET debe ser un secreto aleatorio de al menos 32 caracteres.');
}
if (googleClientId.includes('replace-with') || googleClientSecret.includes('replace-with')) {
  throw new Error('Configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET con las credenciales de Google Cloud.');
}
if (mysqlPassword.includes('replace-with') || (process.env.NODE_ENV === 'production' && !mysqlPassword)) {
  throw new Error('Configura MYSQL_PASSWORD con una contraseña segura de MySQL.');
}

const mysqlOptions = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT || 3306),
  database: process.env.MYSQL_DATABASE || 'inbefic',
  user: process.env.MYSQL_USER || 'root',
  password: mysqlPassword,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};
const pool = mysql.createPool(mysqlOptions);
const sessionStore = new MySQLStore({
  ...mysqlOptions,
  clearExpired: true,
  checkExpirationInterval: 15 * 60 * 1000,
  expiration: SESSION_MAX_AGE,
  createDatabaseTable: false,
  schema: { tableName: 'app_sessions' }
});

const app = express();
const oauthClient = new OAuth2Client(
  googleClientId,
  googleClientSecret,
  process.env.GOOGLE_CALLBACK_URL || `${APP_ORIGIN}/auth/google/callback`
);
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10mb' }));
app.use(session({
  name: 'inbefic.sid',
  secret: sessionSecret,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE
  }
}));

async function query(sql, parameters = []) {
  const [result] = await pool.execute(sql, parameters);
  if (Array.isArray(result)) return { rows: result, rowCount: result.length };
  return { rows: [], rowCount: result.affectedRows, insertId: result.insertId };
}

function parseJsonValue(value, fallback) {
  if (typeof value !== 'string') return value == null ? fallback : value;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error('La base de datos contiene un valor JSON no válido.', { cause: error });
  }
}

function isSharedDataKey(key) {
  return typeof key === 'string' &&
    key.length <= 120 &&
    /^[A-Za-z0-9:_-]+$/.test(key) &&
    SHARED_DATA_PREFIXES.some(prefix => key.startsWith(prefix));
}

function canWriteSharedData(role, key) {
  if (role === 'directora' || role === 'subdirectora') return true;
  return role === 'docente' && (
    key.startsWith('inbefic:') ||
    key.startsWith('convivencia-') ||
    key.startsWith('docente-') ||
    key.startsWith('notas-docente')
  );
}

function normalizeAcademicValue(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function isTeacherGuideForStudent(teacherProfile, studentProfile) {
  return Boolean(
    teacherProfile.grado_guia &&
    teacherProfile.seccion_guia &&
    normalizeAcademicValue(teacherProfile.grado_guia) === normalizeAcademicValue(studentProfile.grado) &&
    normalizeAcademicValue(teacherProfile.seccion_guia) === normalizeAcademicValue(studentProfile.seccion)
  );
}

function requireOrigin(req, res, next) {
  if (req.get('Origin') !== new URL(APP_ORIGIN).origin) {
    return res.status(403).json({ error: 'Origen no permitido.' });
  }
  next();
}

const requireDataUser = asyncRoute(async (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Inicia sesión con Google.' });
  const result = await query('SELECT id, role FROM app_users WHERE id = ?', [req.session.userId]);
  const user = result.rows[0];
  if (!user || user.role === 'estudiante') {
    return res.status(user ? 403 : 401).json({ error: 'Este perfil no tiene acceso a los datos académicos.' });
  }
  req.appUser = user;
  next();
});

const requireSignedInUser = asyncRoute(async (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Inicia sesión con Google.' });
  const result = await query(
    'SELECT id, role, full_name AS fullName, profile FROM app_users WHERE id = ?',
    [req.session.userId]
  );
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: 'La cuenta ya no existe. Inicia sesión de nuevo.' });
  user.profile = parseJsonValue(user.profile, {});
  req.appUser = user;
  next();
});

function redirectWithError(res, message) {
  res.redirect(`${LOGIN_PATH}?authError=${encodeURIComponent(message)}`);
}

function safeString(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

const COMMON_PROFILE_FIELDS = {
  nombres: { label: 'Nombres', required: true, maxLength: 60, pattern: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]{2,60}$/ },
  apellidos: { label: 'Apellidos', required: true, maxLength: 60, pattern: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]{2,60}$/ },
  nacimiento: { label: 'Fecha de nacimiento', required: true, maxLength: 10, pattern: /^\d{4}-\d{2}-\d{2}$/ },
  genero: { label: 'Sexo', required: true, choices: ['Femenino', 'Masculino'] },
  telefono: { label: 'Teléfono', required: true, maxLength: 15, pattern: /^[0-9+\-\s]{8,15}$/ },
  correo: { label: 'Correo electrónico de contacto', required: true, maxLength: 254, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/ }
};
const ROLE_PROFILE_FIELDS = {
  directora: {
    dui: { label: 'DUI', required: true, maxLength: 10, pattern: /^\d{8}-?\d$/ },
    institucion: { label: 'Institución educativa', required: true, maxLength: 100, minLength: 3 },
    codigo: { label: 'Código de infraestructura', required: true, maxLength: 12, pattern: /^[A-Za-z0-9-]{3,12}$/ },
    nivel: { label: 'Nivel que dirige', required: true, choices: ['Parvularia', 'Básica (1° a 9° grado)', 'Media (bachillerato)', 'Todos los niveles'] },
    estudios: { label: 'Último grado académico', required: true, choices: ['Bachillerato', 'Técnico', 'Profesorado', 'Licenciatura', 'Ingeniería', 'Maestría', 'Doctorado'] },
    anios: { label: 'Años en el cargo de dirección', required: true, min: 0, max: 50 }
  },
  subdirectora: {
    dui: { label: 'DUI', required: true, maxLength: 10, pattern: /^\d{8}-?\d$/ },
    institucion: { label: 'Institución educativa', required: true, maxLength: 100, minLength: 3 },
    codigo: { label: 'Código de infraestructura', required: true, maxLength: 12, pattern: /^[A-Za-z0-9-]{3,12}$/ },
    area: { label: 'Área a cargo', required: true, choices: ['Académica', 'Administrativa', 'Disciplina', 'Pedagógica'] },
    turno: { label: 'Turno', required: true, choices: ['Matutino', 'Vespertino', 'Nocturno', 'Tiempo completo'] },
    estudios: { label: 'Último grado académico', required: true, choices: ['Bachillerato', 'Técnico', 'Profesorado', 'Licenciatura', 'Ingeniería', 'Maestría', 'Doctorado'] },
    anios: { label: 'Años en el cargo', required: true, min: 0, max: 50 }
  },
  docente: {
    dui: { label: 'DUI', required: true, maxLength: 10, pattern: /^\d{8}-?\d$/ },
    institucion: { label: 'Institución educativa', required: true, maxLength: 100, minLength: 3 },
    codigo: { label: 'Código de infraestructura', required: true, maxLength: 12, pattern: /^[A-Za-z0-9-]{3,12}$/ },
    especialidad: { label: 'Especialidad o asignatura(s)', required: true, maxLength: 100, minLength: 3 },
    nivel: { label: 'Nivel que atiende', required: true, choices: ['Parvularia', 'Básica (1° a 9° grado)', 'Media (bachillerato)', 'Todos los niveles'] },
    turno: { label: 'Turno', required: true, choices: ['Matutino', 'Vespertino', 'Nocturno', 'Tiempo completo'] },
    estudios: { label: 'Último grado académico', required: true, choices: ['Bachillerato', 'Técnico', 'Profesorado', 'Licenciatura', 'Ingeniería', 'Maestría', 'Doctorado'] },
    anios: { label: 'Años de experiencia', required: true, min: 0, max: 50 },
    grado_guia: { label: 'Grado como docente guía', required: false, choices: ['Parvularia', '1° grado', '2° grado', '3° grado', '4° grado', '5° grado', '6° grado', '7° grado', '8° grado', '9° grado', '1° año de bachillerato', '2° año de bachillerato', '3° año de bachillerato'] },
    seccion_guia: { label: 'Sección guía', required: false, maxLength: 3, pattern: /^[A-Za-z0-9]{1,3}$/ }
  },
  estudiante: {
    nie: { label: 'NIE', required: true, maxLength: 12, pattern: /^\d{5,12}$/ },
    institucion: { label: 'Institución educativa', required: true, maxLength: 100, minLength: 3 },
    grado: { label: 'Grado que cursa', required: true, choices: ['Parvularia', '1° grado', '2° grado', '3° grado', '4° grado', '5° grado', '6° grado', '7° grado', '8° grado', '9° grado', '1° año de bachillerato', '2° año de bachillerato', '3° año de bachillerato'] },
    seccion: { label: 'Sección', required: true, maxLength: 3, pattern: /^[A-Za-z0-9]{1,3}$/ },
    turno: { label: 'Turno', required: true, choices: ['Matutino', 'Vespertino', 'Nocturno', 'Tiempo completo'] },
    resp_nombre: { label: 'Nombre del responsable', required: true, maxLength: 60, pattern: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]{2,60}$/ },
    parentesco: { label: 'Parentesco', required: true, choices: ['Madre', 'Padre', 'Abuelo/a', 'Tío/a', 'Hermano/a', 'Otro'] },
    resp_tel: { label: 'Teléfono del responsable', required: true, maxLength: 15, pattern: /^[0-9+\-\s]{8,15}$/ },
    resp_dui: { label: 'DUI del responsable', required: false, maxLength: 10, pattern: /^\d{8}-?\d$/ }
  },
  secretaria: {
    dui: { label: 'DUI', required: true, maxLength: 10, pattern: /^\d{8}-?\d$/ },
    institucion: { label: 'Institución educativa', required: true, maxLength: 100, minLength: 3 },
    codigo: { label: 'Código de infraestructura', required: true, maxLength: 12, pattern: /^[A-Za-z0-9-]{3,12}$/ },
    area: { label: 'Área de trabajo', required: true, choices: ['Registro académico', 'Administración', 'Atención al público', 'Archivo y documentos'] },
    turno: { label: 'Turno', required: true, choices: ['Matutino', 'Vespertino', 'Nocturno', 'Tiempo completo'] },
    estudios: { label: 'Último grado académico', required: true, choices: ['Bachillerato', 'Técnico', 'Profesorado', 'Licenciatura', 'Ingeniería', 'Maestría', 'Doctorado'] },
    anios: { label: 'Años de experiencia', required: true, min: 0, max: 50 }
  }
};

function validateGoogleRegistration(role, profile, termsAccepted) {
  if (!VALID_ROLES.has(role) || !ROLE_PROFILE_FIELDS[role]) return 'Selecciona un cargo válido.';
  if (termsAccepted !== true) return 'Debes aceptar los términos y la política de privacidad.';
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return 'Completa los datos del registro.';
  if (profile.cargo !== role) return 'El cargo seleccionado no coincide con los datos del formulario.';

  const rules = { ...COMMON_PROFILE_FIELDS, ...ROLE_PROFILE_FIELDS[role], cargo: { required: true, choices: [role] } };
  if (Object.keys(profile).some(key => !Object.hasOwn(rules, key))) return 'El formulario contiene campos no válidos.';
  const normalized = {};
  for (const [field, rule] of Object.entries(rules)) {
    const raw = profile[field];
    if (typeof raw !== 'string') {
      if (rule.required) return `Completa el campo ${rule.label || 'obligatorio'}.`;
      continue;
    }
    const value = raw.trim();
    if (!value) {
      if (rule.required) return `Completa el campo ${rule.label || 'obligatorio'}.`;
      continue;
    }
    if (rule.maxLength && value.length > rule.maxLength) return `Revisa el campo ${rule.label}.`;
    if (rule.minLength && value.length < rule.minLength) return `Revisa el campo ${rule.label}.`;
    if (rule.pattern && !rule.pattern.test(value)) return `El formato de ${rule.label} no es válido.`;
    if (rule.choices && !rule.choices.includes(value)) return `Selecciona una opción válida para ${rule.label}.`;
    if (rule.min !== undefined) {
      const number = Number(value);
      if (!Number.isInteger(number) || number < rule.min || number > rule.max) return `Revisa el campo ${rule.label}.`;
    }
    normalized[field] = value;
  }

  const birth = normalized.nacimiento;
  const [year, month, day] = birth.split('-').map(Number);
  const birthDate = new Date(Date.UTC(year, month - 1, day));
  if (birthDate.getUTCFullYear() !== year || birthDate.getUTCMonth() !== month - 1 || birthDate.getUTCDate() !== day) {
    return 'La fecha de nacimiento no es válida.';
  }
  const now = new Date();
  let age = now.getUTCFullYear() - year;
  if (now.getUTCMonth() < month - 1 || (now.getUTCMonth() === month - 1 && now.getUTCDate() < day)) age--;
  if (age < 0 || age > 100) return 'Revisa la fecha de nacimiento.';
  if (role === 'estudiante' ? age < 3 || age > 30 : age < 18) {
    return role === 'estudiante'
      ? 'La edad de un estudiante debe estar entre 3 y 30 años.'
      : 'Debes ser mayor de edad para este cargo.';
  }
  delete normalized.cargo;
  return { profile: normalized };
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' }
});

app.get('/auth/google', oauthLimiter, (req, res, next) => {
  if (req.query.mode === 'register') {
    return redirectWithError(res, 'Completa los datos del perfil antes de continuar con Google.');
  }

  const state = crypto.randomBytes(32).toString('hex');
  const nonce = crypto.randomBytes(32).toString('hex');
  req.session.googleOAuth = { state, nonce, mode: 'login' };
  req.session.save(error => {
    if (error) return next(error);
    const url = oauthClient.generateAuthUrl({
      access_type: 'online',
      prompt: 'select_account',
      scope: ['openid', 'email', 'profile'],
      state,
      nonce
    });
    res.redirect(url);
  });
});

app.post('/auth/google/register', oauthLimiter, (req, res, next) => {
  const origin = req.get('Origin');
  if (!origin || origin !== new URL(APP_ORIGIN).origin) {
    return res.status(403).json({ error: 'Origen no permitido. Abre el formulario desde la aplicación.' });
  }
  const validation = validateGoogleRegistration(req.body.role, req.body.profile, req.body.termsAccepted);
  if (typeof validation === 'string') return res.status(400).json({ error: validation });

  const state = crypto.randomBytes(32).toString('hex');
  const nonce = crypto.randomBytes(32).toString('hex');
  req.session.googleOAuth = {
    state,
    nonce,
    mode: 'register',
    role: req.body.role,
    profile: validation.profile
  };
  req.session.save(error => {
    if (error) return next(error);
    const authorizationUrl = oauthClient.generateAuthUrl({
      access_type: 'online',
      prompt: 'select_account',
      scope: ['openid', 'email', 'profile'],
      state,
      nonce
    });
    res.set('Cache-Control', 'no-store');
    res.json({ authorizationUrl });
  });
});

app.get('/auth/google/callback', oauthLimiter, asyncRoute(async (req, res) => {
  const intent = req.session.googleOAuth;
  delete req.session.googleOAuth;

  if (req.query.error) return redirectWithError(res, 'Se canceló el inicio de sesión con Google.');
  const returnedState = safeString(req.query.state, 200);
  if (!intent || !returnedState || returnedState.length !== intent.state.length ||
      !crypto.timingSafeEqual(Buffer.from(returnedState), Buffer.from(intent.state))) {
    return redirectWithError(res, 'La verificación de Google venció. Intenta de nuevo.');
  }
  if (typeof req.query.code !== 'string' || req.query.code.length > 2048) {
    return redirectWithError(res, 'Google no devolvió un código de acceso válido.');
  }

  const { tokens } = await oauthClient.getToken(req.query.code);
  if (!tokens.id_token) return redirectWithError(res, 'Google no confirmó la identidad de esta cuenta.');
  const ticket = await oauthClient.verifyIdToken({
    idToken: tokens.id_token,
    audience: required('GOOGLE_CLIENT_ID')
  });
  const profile = ticket.getPayload();
  if (!profile || !profile.sub || !profile.email || profile.email_verified !== true ||
      !profile.nonce || profile.nonce !== intent.nonce) {
    return redirectWithError(res, 'No se pudo verificar el correo de Google.');
  }
  const registration = intent.mode === 'register'
    ? validateGoogleRegistration(intent.role, { ...intent.profile, cargo: intent.role }, true)
    : null;
  if (intent.mode === 'register' && typeof registration === 'string') {
    return redirectWithError(res, 'Los datos del registro ya no son válidos. Completa el formulario otra vez.');
  }

  const googleId = safeString(profile.sub, 255);
  const email = safeString(profile.email, 320).toLowerCase();
  const fullName = safeString(profile.name || profile.email, 200);
  const byGoogleId = await query(
    'SELECT id, google_sub, role, profile FROM app_users WHERE google_sub = ?',
    [googleId]
  );
  let user = byGoogleId.rows[0];
  if (user) user.profile = parseJsonValue(user.profile, {});
  if (!user) {
    const byEmail = await query(
      'SELECT id, google_sub, role, profile FROM app_users WHERE LOWER(email) = ?',
      [email]
    );
    user = byEmail.rows[0];
    if (user) user.profile = parseJsonValue(user.profile, {});
  }
  if (user && user.google_sub !== googleId) {
    return redirectWithError(res, 'Este correo ya está asociado a otra identidad de Google. Contacta a soporte.');
  }
  if (intent.mode === 'register') {
    if (!VALID_ROLES.has(intent.role)) return redirectWithError(res, 'El cargo seleccionado ya no es válido.');
    if (user) {
      if (user.role !== intent.role) {
        return redirectWithError(res, 'Esta cuenta ya tiene otro cargo. Inicia sesión para conservar el perfil existente.');
      }
      if (user.profile && Object.keys(user.profile).length) {
        return redirectWithError(res, 'Esta cuenta ya tiene un perfil completo. Inicia sesión con Google.');
      }
      const completed = await query(
        `UPDATE app_users
            SET email = ?, email_verified = TRUE, full_name = ?, profile = ?,
                terms_accepted_at = NOW(), updated_at = NOW()
          WHERE id = ? AND (profile IS NULL OR JSON_LENGTH(profile) = 0)`,
        [email, fullName, JSON.stringify(registration.profile), user.id]
      );
      if (!completed.rowCount) return redirectWithError(res, 'El perfil ya se completó. Inicia sesión con Google.');
      user = { id: user.id, role: user.role };
    } else {
      try {
        const result = await query(
          `INSERT INTO app_users (google_sub, email, email_verified, full_name, role, profile, terms_accepted_at)
           VALUES (?, ?, TRUE, ?, ?, ?, NOW())`,
          [googleId, email, fullName, intent.role, JSON.stringify(registration.profile)]
        );
        user = { id: result.insertId, role: intent.role };
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return redirectWithError(res, 'Esta cuenta ya tiene un perfil. Inicia sesión con Google.');
        throw error;
      }
    }
  } else if (!user) {
    return redirectWithError(res, 'No hay un perfil con este Google. Regístrate primero.');
  } else {
    await query(
      `UPDATE app_users SET email = ?, email_verified = TRUE, full_name = ?, updated_at = NOW()
        WHERE id = ?`,
      [email, fullName, user.id]
    );
  }

  req.session.regenerate(error => {
    if (error) {
      console.error('No se pudo regenerar la sesión después de Google OAuth.', error);
      return redirectWithError(res, 'No se pudo iniciar una sesión segura. Intenta de nuevo.');
    }
    req.session.userId = user.id;
    req.session.save(saveError => {
      if (saveError) {
        console.error('No se pudo guardar la sesión de usuario.', saveError);
        return redirectWithError(res, 'No se pudo guardar la sesión. Intenta de nuevo.');
      }
      const screen = ROLE_SCREENS[user.role];
      res.redirect(`/${encodeURIComponent(screen)}?cargo=${encodeURIComponent(user.role)}`);
    });
  });
}));

app.get('/api/auth/me', asyncRoute(async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Inicia sesión con Google.' });
  const result = await query(
    `SELECT id, email, full_name AS fullName, role, profile
       FROM app_users WHERE id = ?`,
    [req.session.userId]
  );
  if (!result.rowCount) {
    return req.session.destroy(error => {
      if (error) return res.status(500).json({ error: 'No se pudo cerrar la sesión inválida.' });
      res.clearCookie('inbefic.sid', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
      res.status(401).json({ error: 'El perfil ya no existe. Inicia sesión de nuevo.' });
    });
  }
  result.rows[0].profile = parseJsonValue(result.rows[0].profile, {});
  res.set('Cache-Control', 'no-store');
  res.json({ user: result.rows[0] });
}));

app.post('/api/auth/logout', (req, res) => {
  if (req.get('Origin') !== new URL(APP_ORIGIN).origin) return res.status(403).json({ error: 'Origen no permitido.' });
  req.session.destroy(error => {
    if (error) return res.status(500).json({ error: 'No se pudo cerrar la sesión.' });
    res.clearCookie('inbefic.sid', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    res.status(204).end();
  });
});

app.put('/api/teacher/guide-assignment', requireOrigin, requireSignedInUser, asyncRoute(async (req, res) => {
  if (req.appUser.role !== 'docente') {
    return res.status(403).json({ error: 'Solo Docencia puede configurar su sección guía.' });
  }
  const requestedGrade = safeString(req.body && req.body.grade, 60);
  const grade = ROLE_PROFILE_FIELDS.docente.grado_guia.choices.find(
    choice => normalizeAcademicValue(choice) === normalizeAcademicValue(requestedGrade)
  );
  const section = safeString(req.body && req.body.section, 3).toUpperCase();
  if (!grade || !/^[A-Z0-9]{1,3}$/.test(section)) {
    return res.status(400).json({ error: 'Selecciona un grado válido y una sección de hasta tres caracteres.' });
  }
  const teachers = await query(
    `SELECT id, profile FROM app_users
      WHERE role = 'docente' AND id <> ?`,
    [req.appUser.id]
  );
  const assigned = teachers.rows
    .map(teacher => parseJsonValue(teacher.profile, {}))
    .some(profile =>
      normalizeAcademicValue(profile.grado_guia) === normalizeAcademicValue(grade) &&
      normalizeAcademicValue(profile.seccion_guia) === normalizeAcademicValue(section)
    );
  if (assigned) {
    return res.status(409).json({ error: 'Otro docente ya tiene asignado ese grado y sección guía.' });
  }
  await query(
    `UPDATE app_users
        SET profile = JSON_SET(profile, '$.grado_guia', ?, '$.seccion_guia', ?),
            updated_at = NOW()
      WHERE id = ? AND role = 'docente'`,
    [grade, section, req.appUser.id]
  );
  res.json({ guide: { grade, section } });
}));

app.get('/api/student/portal', requireSignedInUser, asyncRoute(async (req, res) => {
  if (req.appUser.role !== 'estudiante') {
    return res.status(403).json({ error: 'Esta sección es exclusiva para estudiantes.' });
  }
  const studentProfile = req.appUser.profile;
  const [gradeResult, teacherResult] = await Promise.all([
    query(
      `SELECT g.subject, g.period, g.score, g.comment, g.updated_at AS updatedAt,
              u.full_name AS teacherName
         FROM academic_grades g
         JOIN app_users u ON u.id = g.teacher_user_id
        WHERE g.student_user_id = ?
        ORDER BY g.period, g.subject`,
      [req.appUser.id]
    ),
    query(`SELECT id, full_name AS fullName, profile
             FROM app_users
            WHERE role = 'docente'`)
  ]);
  const guide = teacherResult.rows
    .map(teacher => ({ ...teacher, profile: parseJsonValue(teacher.profile, {}) }))
    .find(teacher => isTeacherGuideForStudent(teacher.profile, studentProfile));
  res.set('Cache-Control', 'no-store');
  res.json({
    student: {
      grade: studentProfile.grado || '',
      section: studentProfile.seccion || '',
      nie: studentProfile.nie || ''
    },
    teacher: guide ? { name: guide.fullName } : null,
    grades: gradeResult.rows
  });
}));

app.get('/api/teacher/students', requireSignedInUser, asyncRoute(async (req, res) => {
  if (req.appUser.role !== 'docente') {
    return res.status(403).json({ error: 'Esta lista es exclusiva para docentes.' });
  }
  const teacherProfile = req.appUser.profile;
  if (!teacherProfile.grado_guia || !teacherProfile.seccion_guia) {
    return res.json({ guide: null, students: [] });
  }
  const result = await query(
    `SELECT id, full_name AS fullName, profile
       FROM app_users
      WHERE role = 'estudiante'
      ORDER BY full_name`
  );
  const students = result.rows
    .map(student => ({ ...student, profile: parseJsonValue(student.profile, {}) }))
    .filter(student => isTeacherGuideForStudent(teacherProfile, student.profile))
    .map(student => ({
      id: student.id,
      name: `${student.profile.nombres || ''} ${student.profile.apellidos || ''}`.trim() || student.fullName,
      nie: student.profile.nie || '',
      grade: student.profile.grado || '',
      section: student.profile.seccion || ''
    }));
  const gradeResult = await query(
    `SELECT student_user_id AS studentId, subject, period, score, comment, updated_at AS updatedAt
       FROM academic_grades
      WHERE teacher_user_id = ?
      ORDER BY updated_at DESC, subject`,
    [req.appUser.id]
  );
  res.set('Cache-Control', 'no-store');
  res.json({
    guide: { grade: teacherProfile.grado_guia, section: teacherProfile.seccion_guia },
    students,
    grades: gradeResult.rows
  });
}));

app.post('/api/teacher/grades', requireOrigin, requireSignedInUser, asyncRoute(async (req, res) => {
  if (req.appUser.role !== 'docente') {
    return res.status(403).json({ error: 'Solo docentes pueden registrar calificaciones.' });
  }
  const studentId = Number(req.body && req.body.studentId);
  const subject = safeString(req.body && req.body.subject, 100);
  const period = safeString(req.body && req.body.period, 60);
  const score = Number(req.body && req.body.score);
  const comment = safeString(req.body && req.body.comment, 500);
  if (!Number.isSafeInteger(studentId) || studentId < 1 ||
      !subject || !period || !Number.isFinite(score) || score < 0 || score > 10) {
    return res.status(400).json({ error: 'Revisa el estudiante, la asignatura, el período y la nota (0 a 10).' });
  }
  if (!['Primer periodo', 'Segundo periodo', 'Tercer periodo', 'Cuarto periodo'].includes(period)) {
    return res.status(400).json({ error: 'Selecciona un período académico válido.' });
  }
  const studentResult = await query(
    `SELECT id, profile FROM app_users
      WHERE id = ? AND role = 'estudiante'`,
    [studentId]
  );
  const student = studentResult.rows[0];
  if (!student) return res.status(404).json({ error: 'No se encontró el estudiante seleccionado.' });
  student.profile = parseJsonValue(student.profile, {});
  if (!isTeacherGuideForStudent(req.appUser.profile, student.profile)) {
    return res.status(403).json({ error: 'Solo puedes calificar estudiantes de tu grado y sección guía.' });
  }
  await query(
    `INSERT INTO academic_grades (student_user_id, teacher_user_id, subject, period, score, comment)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE teacher_user_id = VALUES(teacher_user_id),
       score = VALUES(score), comment = VALUES(comment), updated_at = NOW()`,
    [studentId, req.appUser.id, subject, period, score, comment]
  );
  res.status(201).json({ saved: true });
}));

app.get('/api/announcements', requireSignedInUser, asyncRoute(async (req, res) => {
  const result = await query(
    `SELECT a.id, a.source_id AS sourceId, a.title, a.body, a.payload, a.created_at AS createdAt,
            a.created_by AS authorId, u.full_name AS author
       FROM announcements a
       JOIN app_users u ON u.id = a.created_by
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT 100`
  );
  res.set('Cache-Control', 'no-store');
  res.json({
    announcements: result.rows.map(item => ({
      ...item,
      payload: parseJsonValue(item.payload, {})
    }))
  });
}));

app.post('/api/announcements', requireOrigin, requireSignedInUser, asyncRoute(async (req, res) => {
  if (req.appUser.role !== 'secretaria') {
    return res.status(403).json({ error: 'Solo Secretaría puede publicar avisos generales.' });
  }
  const notice = req.body && req.body.notice;
  if (!notice || typeof notice !== 'object' || Array.isArray(notice)) {
    return res.status(400).json({ error: 'El aviso enviado no es válido.' });
  }
  const title = safeString(notice.nombre || notice.title, 180);
  const body = safeString(notice.comentario || notice.body, 4000);
  const sourceId = notice.id === undefined || notice.id === null
    ? null
    : safeString(String(notice.id), 120);
  if (!title || !body) {
    return res.status(400).json({ error: 'El aviso debe incluir título y contenido.' });
  }
  const serialized = JSON.stringify(notice);
  if (Buffer.byteLength(serialized, 'utf8') > 5 * 1024 * 1024) {
    return res.status(413).json({ error: 'El aviso y sus imágenes superan el tamaño permitido.' });
  }
  const result = await query(
    `INSERT INTO announcements (source_id, created_by, title, body, payload)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE title = VALUES(title), body = VALUES(body), payload = VALUES(payload)`,
    [sourceId, req.appUser.id, title, body, serialized]
  );
  const saved = sourceId
    ? await query(
      `SELECT id, title, body, created_at AS createdAt
         FROM announcements WHERE created_by = ? AND source_id = ?`,
      [req.appUser.id, sourceId]
    )
    : await query(
      `SELECT id, title, body, created_at AS createdAt
         FROM announcements WHERE id = ?`,
      [result.insertId]
    );
  res.status(201).json({ announcement: saved.rows[0] });
}));

app.delete('/api/announcements/:sourceId', requireOrigin, requireSignedInUser, asyncRoute(async (req, res) => {
  if (req.appUser.role !== 'secretaria') {
    return res.status(403).json({ error: 'Solo Secretaría puede retirar avisos.' });
  }
  const sourceId = safeString(req.params.sourceId, 120);
  if (!sourceId) return res.status(400).json({ error: 'El identificador del aviso no es válido.' });
  await query('DELETE FROM announcements WHERE created_by = ? AND source_id = ?', [req.appUser.id, sourceId]);
  res.status(204).end();
}));

app.get('/api/app-data', requireDataUser, asyncRoute(async (req, res) => {
  const result = await query('SELECT data_key, data_value FROM school_data ORDER BY data_key');
  const data = Object.fromEntries(result.rows.map(row => [row.data_key, parseJsonValue(row.data_value, null)]));
  res.set('Cache-Control', 'no-store');
  res.json({ data, isEmpty: result.rows.length === 0, role: req.appUser.role });
}));

app.post('/api/app-data/import', requireOrigin, requireDataUser, asyncRoute(async (req, res) => {
  if (req.appUser.role !== 'directora') {
    return res.status(403).json({ error: 'Solo la Directora puede importar datos locales.' });
  }
  const entries = req.body && req.body.data;
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return res.status(400).json({ error: 'El formato de datos iniciales no es válido.' });
  }
  const rows = Object.entries(entries);
  if (rows.length > 200) return res.status(413).json({ error: 'Hay demasiados registros para importar.' });
  for (const [key, value] of rows) {
    if (!isSharedDataKey(key)) return res.status(400).json({ error: `La clave ${key} no se puede importar.` });
    if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 2 * 1024 * 1024) {
      return res.status(413).json({ error: `El registro ${key} supera el tamaño permitido.` });
    }
  }

  const connection = await pool.getConnection();
  let imported = 0;
  let skipped = 0;
  try {
    await connection.beginTransaction();
    for (const [key, value] of rows) {
      const [result] = await connection.execute(
        `INSERT INTO school_data (data_key, data_value, updated_by) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE data_key = VALUES(data_key)`,
        [key, JSON.stringify(value), req.appUser.id]
      );
      if (result.affectedRows === 1) imported++;
      else skipped++;
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  res.status(201).json({ imported, skipped });
}));

app.put('/api/app-data/:key', requireOrigin, requireDataUser, asyncRoute(async (req, res) => {
  const key = req.params.key;
  if (!isSharedDataKey(key)) return res.status(400).json({ error: 'La clave de datos no es válida.' });
  if (req.appUser.role === 'secretaria') {
    return res.status(403).json({ error: 'El perfil de Secretaría solo puede consultar datos.' });
  }
  if (!canWriteSharedData(req.appUser.role, key)) {
    return res.status(403).json({ error: 'Este cargo no puede modificar este tipo de dato.' });
  }
  const serialized = JSON.stringify(req.body && req.body.value);
  if (serialized === undefined || Buffer.byteLength(serialized, 'utf8') > 2 * 1024 * 1024) {
    return res.status(413).json({ error: 'El dato no es válido o supera el tamaño permitido.' });
  }
  await query(
    `INSERT INTO school_data (data_key, data_value, updated_by)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE data_value = VALUES(data_value), updated_by = VALUES(updated_by)`,
    [key, serialized, req.appUser.id]
  );
  res.status(204).end();
}));

app.delete('/api/app-data/:key', requireOrigin, requireDataUser, asyncRoute(async (req, res) => {
  const key = req.params.key;
  if (!isSharedDataKey(key)) return res.status(400).json({ error: 'La clave de datos no es válida.' });
  if (!canWriteSharedData(req.appUser.role, key)) {
    return res.status(403).json({ error: 'Este cargo no puede eliminar este tipo de dato.' });
  }
  await query('DELETE FROM school_data WHERE data_key = ?', [key]);
  res.status(204).end();
}));

app.get('/', (req, res) => res.redirect(`/${encodeURIComponent('Pantalla_base de todo.html')}`));

app.get(/.*/, (req, res, next) => {
  let requested;
  try {
    requested = decodeURIComponent(req.path.slice(1));
  } catch {
    return res.status(400).send('La ruta no es válida.');
  }
  const isAssetRequest = requested.startsWith('assets/');
  if (!requested || requested.includes('\\') || (requested.includes('/') && !isAssetRequest)) return next();

  const protectedRoles = PROTECTED_PAGES.get(requested);
  if (protectedRoles) {
    if (!req.session.userId) return res.redirect(LOGIN_PATH);
    return asyncRoute(async (request, response) => {
      const result = await query('SELECT role FROM app_users WHERE id = ?', [request.session.userId]);
      const role = result.rows[0] && result.rows[0].role;
      if (!role) return response.redirect(LOGIN_PATH);
      if (!protectedRoles.has(role)) {
        return response.redirect(`/${encodeURIComponent(ROLE_SCREENS[role])}?cargo=${encodeURIComponent(role)}`);
      }
      if (request.query.cargo !== role) {
        return response.redirect(`/${encodeURIComponent(requested)}?cargo=${encodeURIComponent(role)}`);
      }
      const page = await fs.promises.readFile(path.join(PAGE_ROOT, requested), 'utf8');
      const hasSyncScript = /<script[^>]+src=["'][^"']*backend-sync\.js["']/i.test(page);
      const scripts = [
        hasSyncScript ? '' : '<script src="/assets/js/backend-sync.js" defer></script>',
        '<script src="/assets/js/announcements-sync.js" defer></script>',
        role === 'docente' && requested === ROLE_SCREENS.docente ? '<script src="/assets/js/teacher-grades.js" defer></script>' : '',
        role === 'estudiante' && requested === ROLE_SCREENS.estudiante ? '<script src="/assets/js/student-portal.js" defer></script>' : ''
      ].join('');
      const syncBootstrap = `<style>html.inbefic-sync-loading body{visibility:hidden!important}</style><script>document.documentElement.classList.add('inbefic-sync-loading')</script>${scripts}`;
      response.type('html').send(page.replace(/<head([^>]*)>/i, `<head$1>${syncBootstrap}`));
    })(req, res, next);
  }

  if (PUBLIC_PAGES.has(requested)) return res.sendFile(path.join(PAGE_ROOT, requested));
  const assetDirectory = path.posix.dirname(requested);
  if (ASSET_DIRECTORIES.has(assetDirectory)) {
    const assetPath = path.resolve(PUBLIC_ROOT, requested);
    if (!assetPath.startsWith(`${PUBLIC_ROOT}${path.sep}`)) return next();
    if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) return res.sendFile(assetPath);
  }
  next();
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta de API no encontrada.' }));
app.use((req, res) => res.status(404).send('Página no encontrada.'));
app.use((error, req, res, next) => {
  console.error('Error de servidor.', error);
  if (res.headersSent) return next(error);
  res.status(500).json({ error: 'Ocurrió un error interno. Intenta de nuevo.' });
});

const server = app.listen(PORT, () => {
  console.log(`INBEFIC disponible en ${APP_ORIGIN}`);
});

function stop() {
  server.close(() => {
    Promise.all([pool.end(), sessionStore.close()]).finally(() => process.exit(0));
  });
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
