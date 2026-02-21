const request = require("supertest");

let mockUsers = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    email: "alice@example.com",
    password: "p1",
    created_at: "2026-02-20T00:00:00.000Z",
    updated_at: "2026-02-20T00:00:00.000Z",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    email: "bob@example.com",
    password: "p2",
    created_at: "2026-02-20T00:00:00.000Z",
    updated_at: "2026-02-20T00:00:00.000Z",
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    email: "cara@example.com",
    password: "p3",
    created_at: "2026-02-20T00:00:00.000Z",
    updated_at: "2026-02-20T00:00:00.000Z",
  },
];

jest.mock("./db", () => ({
  queryDB: jest.fn(async (sql, params = []) => {
    if (sql.includes("SELECT id, email, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT")) {
      const [limit, offset] = params;
      return {
        rows: mockUsers.slice(offset, offset + limit).map(({ id, email, created_at, updated_at }) => ({
          id,
          email,
          created_at,
          updated_at,
        })),
      };
    }

    if (sql.includes("SELECT COUNT(*)::int AS total_users FROM users")) {
      return { rows: [{ total_users: mockUsers.length }] };
    }

    if (sql.includes("SELECT id, email, created_at, updated_at FROM users WHERE id = $1")) {
      const id = params[0];
      const user = mockUsers.find((u) => u.id === id);
      return {
        rows: user
          ? [{ id: user.id, email: user.email, created_at: user.created_at, updated_at: user.updated_at }]
          : [],
      };
    }

    if (sql.includes("INSERT INTO users (email, password) VALUES ($1, $2)")) {
      const [email, password] = params;
      const id = "44444444-4444-4444-4444-444444444444";
      const newUser = {
        id,
        email,
        password,
        created_at: "2026-02-20T00:00:00.000Z",
        updated_at: "2026-02-20T00:00:00.000Z",
      };
      mockUsers.push(newUser);
      return {
        rows: [
          {
            id: newUser.id,
            email: newUser.email,
            created_at: newUser.created_at,
            updated_at: newUser.updated_at,
          },
        ],
      };
    }

    if (sql.includes("SET email = $1, password = $2, updated_at = now()")) {
      const [email, password, id] = params;
      const idx = mockUsers.findIndex((u) => u.id === id);
      if (idx === -1) {
        return { rowCount: 0, rows: [] };
      }
      mockUsers[idx] = {
        ...mockUsers[idx],
        email,
        password,
        updated_at: "2026-02-20T01:00:00.000Z",
      };
      return {
        rowCount: 1,
        rows: [
          {
            id: mockUsers[idx].id,
            email: mockUsers[idx].email,
            created_at: mockUsers[idx].created_at,
            updated_at: mockUsers[idx].updated_at,
          },
        ],
      };
    }

    if (sql.includes("DELETE FROM users WHERE id = $1 RETURNING id")) {
      const id = params[0];
      const before = mockUsers.length;
      mockUsers = mockUsers.filter((u) => u.id !== id);
      const deleted = before - mockUsers.length;
      return { rowCount: deleted, rows: deleted ? [{ id }] : [] };
    }

    if (sql.includes("SELECT COUNT(*)::int AS user_count FROM users WHERE id = $1")) {
      const id = params[0];
      const count = mockUsers.some((u) => u.id === id) ? 1 : 0;
      return { rows: [{ user_count: count }] };
    }

    if (sql.includes("COUNT(password)::int AS users_with_password")) {
      const withEmail = mockUsers.filter((u) => !!u.email).length;
      const withPassword = mockUsers.filter((u) => !!u.password).length;
      return {
        rows: [
          {
            total_users: mockUsers.length,
            users_with_email: withEmail,
            users_with_password: withPassword,
          },
        ],
      };
    }

    throw new Error(`Unhandled SQL in test mock: ${sql}`);
  }),
}));

const app = require("./buggy-apis");

describe("Users table APIs", () => {
  beforeEach(() => {
    mockUsers = [
      {
        id: "11111111-1111-1111-1111-111111111111",
        email: "alice@example.com",
        password: "p1",
        created_at: "2026-02-20T00:00:00.000Z",
        updated_at: "2026-02-20T00:00:00.000Z",
      },
      {
        id: "22222222-2222-2222-2222-222222222222",
        email: "bob@example.com",
        password: "p2",
        created_at: "2026-02-20T00:00:00.000Z",
        updated_at: "2026-02-20T00:00:00.000Z",
      },
      {
        id: "33333333-3333-3333-3333-333333333333",
        email: "cara@example.com",
        password: "p3",
        created_at: "2026-02-20T00:00:00.000Z",
        updated_at: "2026-02-20T00:00:00.000Z",
      },
    ];
  });

  test("GET /users returns paginated users with total count", async () => {
    const res = await request(app).get("/users?page=2&limit=1");
    expect(res.statusCode).toBe(200);
    expect(res.body.total_users).toBe(3);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0].id).toBe("22222222-2222-2222-2222-222222222222");
  });

  test("GET /users/:id returns a user", async () => {
    const res = await request(app).get("/users/11111111-1111-1111-1111-111111111111");
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      id: "11111111-1111-1111-1111-111111111111",
      email: "alice@example.com",
    });
  });

  test("GET /user/:id (singular alias) returns a user", async () => {
    const res = await request(app).get("/user/11111111-1111-1111-1111-111111111111");
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      id: "11111111-1111-1111-1111-111111111111",
      email: "alice@example.com",
    });
  });

  test("POST /users creates a user", async () => {
    const userData = { email: "john@example.com", password: "pass" };
    const res = await request(app).post("/users").send(userData);
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.email).toBe(userData.email);
  });

  test("PUT /users/:id updates a user", async () => {
    const res = await request(app)
      .put("/users/22222222-2222-2222-2222-222222222222")
      .send({ email: "bobby@example.com", password: "new-pass" });
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("User updated");
    expect(res.body.user).toMatchObject({
      id: "22222222-2222-2222-2222-222222222222",
      email: "bobby@example.com",
    });
  });

  test("DELETE /users/:id deletes a user", async () => {
    const res = await request(app).delete("/users/22222222-2222-2222-2222-222222222222");
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("User deleted");
  });

  test("GET /orders/user/:userId returns user count for id", async () => {
    const res = await request(app).get("/orders/user/11111111-1111-1111-1111-111111111111");
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      user_id: "11111111-1111-1111-1111-111111111111",
      user_count: 1,
    });
  });

  test("GET /debug/crash returns user count health payload", async () => {
    const res = await request(app).get("/debug/crash");
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, total_users: 3 });
  });

  test("GET /reports/summary returns users summary", async () => {
    const res = await request(app).get("/reports/summary");
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      total_users: 3,
      users_with_email: 3,
      users_with_password: 3,
    });
  });
});
