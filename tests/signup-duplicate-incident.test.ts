import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Regression suite for the 2026-11-16 22:27 EST incident (a first-time learner was told "email already exists").
// Production evidence (redacted): the account was created at 22:24:39 and the user was signed in server-side, the page showed
// nothing, and the same credentials were submitted again 30 s later -> Supabase 422 email_exists -> "already exists".
// Disposable fixtures only: no real addresses, no production calls.
const m = vi.hoisted(() => ({ rpc: vi.fn(), create: vi.fn(), signIn: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdmin: () => ({ rpc: m.rpc, auth: { admin: { createUser: m.create } } }), getSupabaseServer: async () => ({ auth: { signInWithPassword: m.signIn } }) }));
vi.mock("@/lib/rate-limit", () => ({ clientIp: () => "fixture", rateLimit: () => ({ ok: true }) }));
import { POST } from "@/app/api/auth/signup/route";
import { classifyCreateUserError } from "@/lib/signup-errors";
import { signupOutcome } from "@/lib/signup-flow";

const call = (password = "FixturePassword123") =>
  POST(new Request("https://example.test/api/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "learner@example.test", username: "learner_fixture", password, displayName: "Fixture learner" }) }));
const emailExists = { message: "A user with this email address has already been registered", code: "email_exists", status: 422 };

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  m.create.mockResolvedValue({ data: { user: { id: "11111111-1111-4111-8111-111111111111" } }, error: null });
  m.signIn.mockResolvedValue({ error: null });
  m.rpc.mockResolvedValue({ data: true, error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("first-time sign-up (control: must pass before and after the fix)", () => {
  it("creates the account and signs in", async () => {
    const r = await call();
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, signedIn: true });
    expect(m.create).toHaveBeenCalledTimes(1);
  });
  it("a taken username is reported as a username problem, never as an email problem", async () => {
    m.rpc.mockResolvedValue({ data: false, error: null });
    const r = await call();
    expect(r.status).toBe(409);
    expect((await r.json()).error).toMatch(/username/i);
    expect(m.create).not.toHaveBeenCalled();
  });
});

describe("double-submit / retry of the SAME credentials after a successful sign-up (the incident)", () => {
  it("signs the person in instead of showing an error", async () => {
    m.create.mockResolvedValue({ data: { user: null }, error: emailExists });
    const r = await call();
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, signedIn: true });
    expect(m.signIn).toHaveBeenCalledWith({ email: "learner@example.test", password: "FixturePassword123" });
  });
  it("does not create a second account or re-run signup side effects (referral, profile)", async () => {
    m.create.mockResolvedValue({ data: { user: null }, error: emailExists });
    await call();
    expect(m.create).toHaveBeenCalledTimes(1);
    expect(m.rpc.mock.calls.map((c) => c[0])).toEqual(["username_available"]);
  });
});

describe("a REAL existing account with a different password is never overwritten or opened", () => {
  it("returns 409 with an explicit email_exists code and recovery guidance", async () => {
    m.create.mockResolvedValue({ data: { user: null }, error: emailExists });
    m.signIn.mockResolvedValue({ error: { message: "Invalid login credentials", code: "invalid_credentials", status: 400 } });
    const r = await call("SomeOtherPassword123");
    expect(r.status).toBe(409);
    const body = await r.json();
    expect(body.code).toBe("email_exists");
    expect(body.error).toMatch(/forgot password/i);
    expect(m.signIn).toHaveBeenCalledTimes(1); // one verification attempt only, no retry loop
  });
  it("never reveals a session or ok:true to a caller who does not know the password", async () => {
    m.create.mockResolvedValue({ data: { user: null }, error: emailExists });
    m.signIn.mockResolvedValue({ error: { message: "Invalid login credentials", code: "invalid_credentials", status: 400 } });
    expect(await (await call("SomeOtherPassword123")).json()).not.toMatchObject({ ok: true });
  });
});

describe("error classification no longer matches on loose words", () => {
  it("an unrelated failure whose text contains 'already' / 'exists' is NOT reported as an existing email", async () => {
    m.create.mockResolvedValue({ data: { user: null }, error: { message: 'duplicate key value violates unique constraint "profiles_username_key" (Key already exists)', code: "unexpected_failure", status: 500 } });
    const r = await call();
    expect(r.status).toBe(500);
    expect((await r.json()).error).not.toMatch(/already|exists|sign in/i);
    expect(m.signIn).not.toHaveBeenCalled();
  });
  it("a database trigger failure is a generic retryable error", async () => {
    m.create.mockResolvedValue({ data: { user: null }, error: { message: "Database error creating new user", code: "unexpected_failure", status: 500 } });
    expect((await call()).status).toBe(500);
  });
  it("classifier: only email_exists / user_already_exists / the exact legacy 422 text count", () => {
    expect(classifyCreateUserError({ code: "email_exists" })).toBe("email_exists");
    expect(classifyCreateUserError({ code: "user_already_exists" })).toBe("email_exists");
    expect(classifyCreateUserError({ status: 422, message: "A user with this email address has already been registered" })).toBe("email_exists");
    expect(classifyCreateUserError({ status: 500, message: "table already exists" })).toBe("other");
    expect(classifyCreateUserError({ message: "already registered somewhere else" })).toBe("other");
    expect(classifyCreateUserError({})).toBe("other");
  });
});

describe("the page must not stay silent after a successful sign-up", () => {
  it("success without a message navigates (no silent form), and the button stays locked so it cannot be submitted twice", () => {
    expect(signupOutcome({ ok: true })).toEqual({ kind: "navigate" });
  });
  it("success with a message (account created but not signed in) shows the notice", () => {
    expect(signupOutcome({ ok: true, message: "Account created. Please sign in." })).toEqual({ kind: "notice", message: "Account created. Please sign in." });
  });
  it("an existing-email error carries its code so the page can offer Sign in / Forgot password", () => {
    expect(signupOutcome({ ok: false, error: "x", code: "email_exists" })).toEqual({ kind: "error", message: "x", code: "email_exists" });
  });
});
