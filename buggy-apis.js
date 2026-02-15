const express = require("express");
const mysql = require("mysql2/promise");

const app = express();
app.use(express.json());

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "password",
  database: "demo_db",
  connectionLimit: 5,
});

// 1) GET /users
// Intentional bug: wrong offset formula (page * limit instead of (page - 1) * limit)
// API symptom: usually still 200 OK, but returns the wrong page of data (no error message).
app.get("/users", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const offset = page * limit; // BUG: should be (page - 1) * limit

    const sql = "SELECT id, name, email FROM users LIMIT ? OFFSET ?";
    const [rows] = await pool.execute(sql, [limit, offset]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2) GET /users/:id
// Intentional bug: reads req.params.userId even though route param is :id
// API symptom: commonly 404 { message: "User not found" } because userId becomes undefined.
app.get("/users/:id", async (req, res) => {
  try {
    const userId = req.params.userId; // BUG: should be req.params.id
    const sql = "SELECT id, name, email FROM users WHERE id = ?";
    const [rows] = await pool.execute(sql, [userId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3) POST /users
// Intentional bug: swaps name and email positions in VALUES binding
// API symptom: often 201 with incorrect DB values; may also return 500 { error: "Data too long for column ..." } on strict schemas.
app.post("/users", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const sql = "INSERT INTO users (name, email, password) VALUES (?, ?, ?)";
    const [result] = await pool.execute(sql, [email, name, password]); // BUG: name/email swapped

    res.status(201).json({
      id: result.insertId,
      name,
      email,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4) PUT /users/:id
// Intentional bug: updates using email in WHERE clause while binding id
// API symptom: commonly 404 { message: "User not found" } even when id exists.
app.put("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email } = req.body;
    const sql = "UPDATE users SET name = ?, email = ? WHERE email = ?"; // BUG: should be WHERE id = ?
    const [result] = await pool.execute(sql, [name, email, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5) DELETE /users/:id
// Intentional bug: missing await before execute
// API symptom: may incorrectly return 200 { message: "User deleted" } before DB completes; failures may surface outside this try/catch.
app.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const sql = "DELETE FROM users WHERE id = ?";
    const result = pool.execute(sql, [id]); // BUG: should await this call

    if (!result) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6) GET /orders/user/:userId
// Intentional bug: SQL injection risk by string interpolation
// API symptom: malformed input can trigger 500 { error: "You have an error in your SQL syntax; ..." }.
app.get("/orders/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const sql = `SELECT id, user_id, total_amount, status FROM orders WHERE user_id = ${userId}`; // BUG: unsafe SQL
    const [rows] = await pool.query(sql);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Buggy API server running on http://localhost:${PORT}`);
});
