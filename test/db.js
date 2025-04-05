// db.js
const pgp = require('pg-promise')();
require('dotenv').config();
const connectionString =  'postgres://postgres:pwd@db:5432/Feast_Finder_DB';
const db = pgp(connectionString);
module.exports = db;
