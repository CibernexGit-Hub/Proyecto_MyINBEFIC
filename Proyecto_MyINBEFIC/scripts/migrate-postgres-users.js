require('dotenv').config();

const { Pool } = require('pg');
const mysql = require('mysql2/promise');

function required(name) {
  const value = process.env[name];
  if (!value || value.includes('replace-with')) throw new Error(`Configura ${name} antes de migrar las cuentas.`);
  return value;
}

async function main() {
  const mysqlPassword = process.env.MYSQL_PASSWORD || '';
  if (mysqlPassword.includes('replace-with') || (process.env.NODE_ENV === 'production' && !mysqlPassword)) {
    throw new Error('Configura MYSQL_PASSWORD antes de migrar las cuentas.');
  }
  const source = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || 'inbefic',
    user: process.env.PGUSER || 'postgres',
    password: required('PGPASSWORD'),
    ssl: process.env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
      : false
  });
  const target = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    database: process.env.MYSQL_DATABASE || 'inbefic',
    user: process.env.MYSQL_USER || 'root',
    password: mysqlPassword,
    waitForConnections: true,
    connectionLimit: 2
  });

  try {
    const { rows } = await source.query(
      `SELECT google_sub, email, email_verified, full_name, profile, terms_accepted_at,
              role, created_at, updated_at
         FROM app_users
        ORDER BY id`
    );
    const connection = await target.getConnection();
    let imported = 0;
    let skipped = 0;
    try {
      await connection.beginTransaction();
      for (const user of rows) {
        const [matches] = await connection.execute(
          'SELECT google_sub FROM app_users WHERE google_sub = ? OR LOWER(email) = LOWER(?) LIMIT 1',
          [user.google_sub, user.email]
        );
        if (matches.length) {
          if (matches[0].google_sub !== user.google_sub) {
            throw new Error(`El correo ${user.email} ya pertenece a otra cuenta en MySQL.`);
          }
          skipped++;
          continue;
        }
        await connection.execute(
          `INSERT INTO app_users
            (google_sub, email, email_verified, full_name, profile, terms_accepted_at, role, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            user.google_sub,
            user.email,
            user.email_verified,
            user.full_name,
            JSON.stringify(user.profile || {}),
            user.terms_accepted_at,
            user.role,
            user.created_at,
            user.updated_at
          ]
        );
        imported++;
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    console.log(`Migración de cuentas completada: ${imported} importadas, ${skipped} ya existentes.`);
    console.log('Las sesiones no se migran; cada persona debe volver a iniciar sesión con Google.');
  } finally {
    await Promise.all([source.end(), target.end()]);
  }
}

main().catch(error => {
  console.error('No se pudieron migrar las cuentas desde PostgreSQL.', error);
  process.exitCode = 1;
});
