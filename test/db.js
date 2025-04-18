// db.js

const conf = {
  db: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: 'db' 
};

const pgp = require('pg-promise')();
const connectionString = `postgres://${conf.user}:${conf.password}@${conf.host}:5432/${conf.db}`;
const db = pgp(connectionString);
module.exports = db;
