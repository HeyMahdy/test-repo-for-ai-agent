const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("Missing DATABASE_URL environment variable");
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes("render.com")
    ? { rejectUnauthorized: false }
    : false,
});

const queryDB = (text, params = []) => pool.query(text, params);

module.exports = { pool, queryDB };
