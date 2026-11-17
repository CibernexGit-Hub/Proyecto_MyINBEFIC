require('dotenv').config();

const fs = require('node:fs/promises');
const path = require('node:path');
const mysql = require('mysql2/promise');

async function main() {
  const password = process.env.MYSQL_PASSWORD || '';
  if (password.includes('replace-with') || (process.env.NODE_ENV === 'production' && !password)) {
    throw new Error('Configura MYSQL_PASSWORD antes de inicializar MySQL.');
  }
  const database = process.env.MYSQL_DATABASE || 'inbefic';
  if (!/^[A-Za-z0-9_]+$/.test(database)) {
    throw new Error('MYSQL_DATABASE solo puede contener letras, números y guiones bajos.');
  }

  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password,
    multipleStatements: true
  });

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE \`${database}\``);
    const schema = await fs.readFile(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
    await connection.query(schema);
    console.log('Esquema MySQL creado o actualizado correctamente.');
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error('No se pudo inicializar el esquema MySQL.', error);
  process.exitCode = 1;
});
