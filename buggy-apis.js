const express = require("express");
const { queryDB } = require("./db");

const app = express();
app.use(express.json());

const isUUID = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

app.get("/users", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    if (
      !Number.isFinite(page) ||
      !Number.isFinite(limit) ||
      page < 1 ||
      limit < 1
    ) {
      return res
        .status(400)
        .json({ error: "Pagination values must be positive numbers" });
    }
    const offset = (page - 1) * limit;

    const usersResult = await queryDB(
      "SELECT id, email, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2",
      [limit, offset]
    );
    const countResult = await queryDB("SELECT COUNT(*)::int AS total_users FROM users");
    res.json({
      page,
      limit,
      total_users: countResult.rows[0].total_users,
      users: usersResult.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/users/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const sql =
      "SELECT id, email, created_at, updated_at FROM users WHERE id = $1";
    const result = await queryDB(sql, [userId]);
    const rows = result.rows;

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/users", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Missing email or password" });
    }
    const sql =
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, created_at, updated_at";
    const result = await queryDB(sql, [email, password]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Missing email or password" });
    }
    const result = await queryDB(
      `UPDATE users
       SET email = $1, password = $2, updated_at = now()
       WHERE id = $3
       RETURNING id, email, created_at, updated_at`,
      [email, password, id]
    );
    if (!result.rowCount) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User updated", user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await queryDB(
      "DELETE FROM users WHERE id = $1 RETURNING id",
      [id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/orders/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isUUID(userId)) {
      return res.status(400).json({ error: "userId must be a UUID" });
    }

    const result = await queryDB(
      "SELECT COUNT(*)::int AS user_count FROM users WHERE id = $1",
      [userId]
    );
    res.json({ user_id: userId, user_count: result.rows[0].user_count });
  } catch (err) {
    console.error("GET /orders/user/:userId failed", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/debug/crash", async (_req, res) => {
  try {
    const result = await queryDB("SELECT COUNT(*)::int AS total_users FROM users");
    res.json({ ok: true, total_users: result.rows[0].total_users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/reports/summary", async (_req, res) => {
  try {
    const result = await queryDB(
      `SELECT
         COUNT(*)::int AS total_users,
         COUNT(email)::int AS users_with_email,
         COUNT(password)::int AS users_with_password
       FROM users`
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;

const PORT = 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Buggy API server running on http://localhost:${PORT}`);
  });
}
