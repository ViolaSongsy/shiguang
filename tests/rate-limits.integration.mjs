import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

// Run after `npm run build`. The server always uses a disposable local database.
let server;
let directory;
let baseUrl;
let first;
let second;
let output = "";
const password = "integration-only-password";

async function request(path, { method = "POST", body, cookie, headers = {} } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function signup(email) {
  const response = await request("/api/auth/signup", { body: { email, password } });
  assert.equal(response.status, 201, await response.text());
  return { email, cookie: response.headers.get("set-cookie").split(";")[0] };
}

async function startServer(trustedHeader = "") {
  output = "";
  const listener = createServer();
  await new Promise((resolve, reject) => listener.once("error", reject).listen(0, "127.0.0.1", resolve));
  const port = listener.address().port;
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      TURSO_DATABASE_URL: `file:${join(directory, "test.db")}`,
      TURSO_AUTH_TOKEN: "",
      TRUSTED_PROXY_IP_HEADER: trustedHeader,
      OPENAI_API_KEY: "",
      RESEND_API_KEY: "",
      APP_URL: baseUrl,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Test server startup timed out")), 20000);
    server.once("error", error => { clearTimeout(timeout); reject(error); });
    server.once("exit", code => { clearTimeout(timeout); reject(new Error(`Test server exited (${code}): ${output}`)); });
    server.stdout.on("data", chunk => {
      output = (output + chunk).slice(-4000);
      if (output.includes("Ready in")) { clearTimeout(timeout); resolve(); }
    });
    server.stderr.on("data", chunk => { output = (output + chunk).slice(-4000); });
  });
}

async function stopServer() {
  if (server && server.exitCode === null && server.signalCode === null) {
    await new Promise(resolve => { server.once("exit", resolve); server.kill("SIGTERM"); });
  }
}

before(async () => {
  directory = await mkdtemp(join(tmpdir(), "journal-rate-limits-"));
  await startServer();
  first = await signup("first@example.invalid");
  second = await signup("second@example.invalid");
});

after(async () => {
  await stopServer();
  if (directory) await rm(directory, { recursive: true, force: true });
});

test("failed logins do not block another account; email casing and spoofed IPs do not bypass the quota", async () => {
  for (let i = 0; i < 20; i++) {
    const response = await request("/api/auth/login", {
      body: { email: i % 2 ? first.email.toUpperCase() : first.email, password: "wrong-password" },
      headers: { "x-forwarded-for": `192.0.2.${i + 1}`, "x-real-ip": `198.51.100.${i + 1}` },
    });
    assert.equal(response.status, 401);
  }
  assert.equal((await request("/api/auth/login", { body: { email: first.email, password } })).status, 429);
  assert.equal((await request("/api/auth/login", { body: { email: second.email, password } })).status, 200);
});

test("signup quota is isolated by email without a verified IP", async () => {
  for (let i = 0; i < 9; i++) await signup(`signup-${i}@example.invalid`);
  for (let i = 0; i < 7; i++) {
    assert.equal((await request("/api/auth/signup", { body: { email: first.email.toUpperCase(), password } })).status, 409);
  }
  assert.equal((await request("/api/auth/signup", { body: { email: first.email, password } })).status, 429);
});

test("password reset requests retain per-email quotas without blocking another account", async () => {
  for (const user of [first, second]) {
    for (let i = 0; i < 3; i++) {
      assert.equal((await request("/api/auth/forgot-password", { body: { email: user.email } })).status, 200);
    }
  }
  assert.equal((await request("/api/auth/forgot-password", { body: { email: first.email } })).status, 429);
});

test("reset token quotas do not block unrelated reset tokens", async () => {
  for (const token of ["invalid-first-token-for-test", "invalid-second-token-for-test"]) {
    for (let i = 0; i < 10; i++) {
      assert.equal((await request("/api/auth/reset-password", { body: { token, password } })).status, 400);
    }
    assert.equal((await request("/api/auth/reset-password", { body: { token, password } })).status, 429);
  }
});

test("export quota remains enforced per user without exhausting another user's quota", async () => {
  for (let i = 0; i < 30; i++) {
    const response = await request("/api/export?type=entries&format=json&range=all", { method: "GET", cookie: first.cookie });
    assert.equal(response.status, 200, await response.text());
  }
  assert.equal((await request("/api/export?type=entries&format=json&range=all", { method: "GET", cookie: first.cookie })).status, 429);
  assert.equal((await request("/api/export?type=entries&format=json&range=all", { method: "GET", cookie: second.cookie })).status, 200);
});

test("entries remain private to their owner and can be deleted through the dynamic route", async () => {
  const created = await request("/api/entries", { cookie: first.cookie, body: { content: "Fictional integration entry", mood: "😌" } });
  assert.equal(created.status, 201);
  const { entry } = await created.json();
  const otherJournal = await request("/api/journal", { method: "GET", cookie: second.cookie });
  assert.equal(otherJournal.status, 200);
  assert.equal((await otherJournal.json()).entries.some(item => item.id === entry.id), false);
  assert.equal((await request(`/api/entries/${entry.id}`, { method: "DELETE", cookie: second.cookie })).status, 404);
  const ownJournal = await request("/api/journal", { method: "GET", cookie: first.cookie });
  assert.equal((await ownJournal.json()).entries.some(item => item.id === entry.id), true);
  assert.equal((await request(`/api/entries/${entry.id}`, { method: "DELETE", cookie: first.cookie })).status, 200);
  assert.equal((await request(`/api/entries/${entry.id}`, { method: "DELETE" })).status, 401);
});

test("signing out invalidates the server session and clears journal access", async () => {
  const account = await signup("logout-test@example.invalid");
  assert.equal((await request("/api/auth/me", { method: "GET", cookie: account.cookie })).status, 200);
  assert.equal((await request("/api/auth/logout", { cookie: account.cookie })).status, 200);
  const current = await request("/api/auth/me", { method: "GET", cookie: account.cookie });
  assert.equal((await current.json()).user, null);
  assert.equal((await request("/api/journal", { method: "GET", cookie: account.cookie })).status, 401);
});

test("a configured proxy header enforces an IP quota across accounts and ignores other forwarding headers", async () => {
  await stopServer();
  await startServer("x-real-ip");
  for (let i = 0; i < 20; i++) {
    const response = await request("/api/auth/login", {
      body: { email: `missing-${i}@example.invalid`, password },
      headers: { "x-real-ip": "192.0.2.1", "x-forwarded-for": `198.51.100.${i + 1}` },
    });
    assert.equal(response.status, 401);
  }
  assert.equal((await request("/api/auth/login", { body: { email: second.email, password }, headers: { "x-real-ip": "192.0.2.1" } })).status, 429);
  assert.equal((await request("/api/auth/login", { body: { email: second.email, password }, headers: { "x-real-ip": "192.0.2.2" } })).status, 200);
  assert.equal((await request("/api/auth/login", { body: { email: second.email, password } })).status, 200);
});
