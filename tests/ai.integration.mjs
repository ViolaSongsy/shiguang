import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

// Exercise the real SDK and Zod helpers against a local fake API, with no paid calls.
let mock;
let server;
let directory;
let baseUrl;
let cookie;
let mode = "success";
const calls = [];
const reflection = {
  title: "散步的一天", what_happened: "今天去公园散步。", main_emotions: ["平静"],
  repeated_worries: [], trigger: "公园", known_facts: ["去散步"], guesses: [],
  fear_meaning: "没有足够信息。", anxiety_story: "没有足够信息。",
  kinder_interpretation: "一次短暂休息。", companion_note: "记住这个片刻。",
  next_step: "继续记录。", theme_tags: ["散步"], intensity: 3,
};
const trend = {
  title: "一周回望", emotional_weather: "平静", mood_direction: "信息不足",
  recurring_patterns: ["散步"], improving_signs: [], stuck_points: [],
  gentle_reading: "记录里有散步的片刻。", next_focus: "继续观察。",
};
const entries = [{ content: "今天去公园散步。", mood: "🙂", context: null, intensity: 3, created_at: "2026-10-22T12:00:00Z" }];
const inputs = [
  ["reflect", { entries }, "reflection", reflection, "daily_reflection"],
  ["trends", { days: 7, reflections: [{ ...reflection, reflection_date: "2026-10-22" }] }, "trend", trend, "trend_summary"],
];

async function listen(listener) {
  await new Promise((resolve, reject) => listener.once("error", reject).listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${listener.address().port}`;
}

function post(path, body, authenticated = true) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(authenticated ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
}

before(async () => {
  directory = await mkdtemp(join(tmpdir(), "shiguang-ai-"));
  mock = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    calls.push({ path: request.url, body });
    response.setHeader("Content-Type", "application/json");
    if (mode === "auth-error") {
      response.writeHead(401);
      response.end(JSON.stringify({ error: { message: "Test key rejected", type: "authentication_error" } }));
      return;
    }
    const content = body.response_format.json_schema.name === "daily_reflection" ? reflection : trend;
    response.end(JSON.stringify({
      id: "chatcmpl-local-test", object: "chat.completion", created: 0, model: "local-test-model",
      choices: [{ index: 0, finish_reason: "stop", message: {
        role: "assistant", refusal: mode === "refusal" ? "Test refusal" : null,
        content: mode === "refusal" ? null : JSON.stringify(mode === "invalid-output" ? { title: "Incomplete" } : content),
      } }],
    }));
  });
  const mockUrl = await listen(mock);
  const reservation = createServer();
  const appUrl = await listen(reservation);
  await new Promise(resolve => reservation.close(resolve));
  baseUrl = appUrl;
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", new URL(appUrl).port], {
    env: { ...process.env, NODE_ENV: "production", TURSO_DATABASE_URL: `file:${join(directory, "ai.db")}`,
      TURSO_AUTH_TOKEN: "", TRUSTED_PROXY_IP_HEADER: "", RESEND_API_KEY: "", APP_URL: appUrl,
      OPENAI_API_KEY: "local-test-only", OPENAI_BASE_URL: `${mockUrl}/v1`, OPENAI_MODEL: "local-test-model" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error(`Startup timeout: ${output}`)), 20000);
    server.once("error", error => { clearTimeout(timeout); reject(error); });
    server.once("exit", code => { clearTimeout(timeout); reject(new Error(`Server exited ${code}: ${output}`)); });
    server.stdout.on("data", chunk => { output += chunk; if (output.includes("Ready in")) { clearTimeout(timeout); resolve(); } });
    server.stderr.on("data", chunk => { output = (output + chunk).slice(-4000); });
  });
  const signup = await post("/api/auth/signup", { email: "ai-tests@example.invalid", password: "integration-only-password" }, false);
  assert.equal(signup.status, 201, await signup.text());
  cookie = signup.headers.get("set-cookie").split(";")[0];
});

after(async () => {
  if (server && server.exitCode === null && server.signalCode === null) {
    await new Promise(resolve => { server.once("exit", resolve); server.kill("SIGTERM"); });
  }
  if (mock?.listening) await new Promise(resolve => mock.close(resolve));
  if (directory) await rm(directory, { recursive: true, force: true });
});

for (const [route, input, field, expected, schemaName] of inputs) {
  test(`${route} validates SDK structured output and handles provider failures`, async () => {
    mode = "success";
    const success = await post(`/api/${route}`, input);
    assert.equal(success.status, 200, await success.clone().text());
    assert.deepEqual(await success.json(), { [field]: expected, mode: "ai" });
    const call = calls.at(-1);
    assert.equal(call.path, "/v1/chat/completions");
    assert.equal(call.body.model, "local-test-model");
    assert.equal(call.body.response_format.json_schema.name, schemaName);
    assert.equal(call.body.response_format.json_schema.strict, true);
    assert.equal(call.body.response_format.json_schema.schema.additionalProperties, false);

    for (const [scenario, status] of [["refusal", 422], ["invalid-output", 500], ["auth-error", 502]]) {
      mode = scenario;
      const response = await post(`/api/${route}`, input);
      assert.equal(response.status, status, await response.clone().text());
      assert.equal(typeof (await response.json()).error, "string");
    }
    const count = calls.length;
    assert.equal((await post(`/api/${route}`, {})).status, 400);
    assert.equal((await post(`/api/${route}`, input, false)).status, 401);
    assert.equal(calls.length, count, "invalid and unauthenticated requests must not reach the provider");
  });
}
