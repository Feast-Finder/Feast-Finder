// db.js

const conf = {
  db:       process.env.POSTGRES_DB,
  user:     process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
};

const pgp = require('pg-promise')();
require('dotenv').config();
const connectionString =  `postgres://${conf.user}:${conf.password}@db:5432/${conf.db}`;
const db = pgp(connectionString);
module.exports = db;
