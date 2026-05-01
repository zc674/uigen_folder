// @vitest-environment node
import { test, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";
import type { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

import { createSession, getSession, deleteSession, verifySession } from "@/lib/auth";

const TEST_SECRET = new TextEncoder().encode("development-secret-key");

async function makeToken(payload: object, expiresIn = "7d") {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(TEST_SECRET);
}

function makeRequest(token?: string) {
  return {
    cookies: {
      get: vi.fn().mockReturnValue(token ? { value: token } : undefined),
    },
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// --- createSession ---

test("createSession sets auth-token cookie", async () => {
  await createSession("user-1", "test@example.com");

  expect(mockCookieStore.set).toHaveBeenCalledOnce();
  const [name] = mockCookieStore.set.mock.calls[0];
  expect(name).toBe("auth-token");
});

test("createSession sets a valid JWT as the cookie value", async () => {
  await createSession("user-1", "test@example.com");

  const [, token] = mockCookieStore.set.mock.calls[0];
  expect(typeof token).toBe("string");
  expect(token.split(".")).toHaveLength(3);
});

test("createSession sets correct cookie options", async () => {
  await createSession("user-1", "test@example.com");

  const [, , options] = mockCookieStore.set.mock.calls[0];
  expect(options.httpOnly).toBe(true);
  expect(options.sameSite).toBe("lax");
  expect(options.path).toBe("/");
  expect(options.expires).toBeInstanceOf(Date);
});

test("createSession sets secure flag in production", async () => {
  const original = process.env.NODE_ENV;
  (process.env as any).NODE_ENV = "production";

  await createSession("user-1", "test@example.com");

  const [, , options] = mockCookieStore.set.mock.calls[0];
  expect(options.secure).toBe(true);

  (process.env as any).NODE_ENV = original;
});

test("createSession cookie expires ~7 days from now", async () => {
  const before = Date.now();
  await createSession("user-1", "test@example.com");
  const after = Date.now();

  const [, , options] = mockCookieStore.set.mock.calls[0];
  const expiresMs = options.expires.getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  expect(expiresMs).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
  expect(expiresMs).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
});

test("createSession JWT payload contains userId and email", async () => {
  await createSession("user-42", "hello@example.com");

  const [, token] = mockCookieStore.set.mock.calls[0];
  const { jwtVerify } = await import("jose");
  const { payload } = await jwtVerify(token, TEST_SECRET);
  expect(payload.userId).toBe("user-42");
  expect(payload.email).toBe("hello@example.com");
});

test("createSession JWT is signed with HS256", async () => {
  await createSession("user-1", "test@example.com");

  const [, token] = mockCookieStore.set.mock.calls[0];
  const header = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString());
  expect(header.alg).toBe("HS256");
});

test("createSession does not set secure flag outside production", async () => {
  await createSession("user-1", "test@example.com");

  const [, , options] = mockCookieStore.set.mock.calls[0];
  expect(options.secure).toBe(false);
});

test("createSession produces a different token for different users", async () => {
  await createSession("user-1", "a@example.com");
  const [, token1] = mockCookieStore.set.mock.calls[0];

  await createSession("user-2", "b@example.com");
  const [, token2] = mockCookieStore.set.mock.calls[1];

  expect(token1).not.toBe(token2);
});

// --- getSession ---

test("getSession returns null when no cookie", async () => {
  mockCookieStore.get.mockReturnValue(undefined);
  expect(await getSession()).toBeNull();
});

test("getSession returns session payload from valid token", async () => {
  const token = await makeToken({ userId: "user-1", email: "test@example.com", expiresAt: new Date() });
  mockCookieStore.get.mockReturnValue({ value: token });

  const session = await getSession();
  expect(session?.userId).toBe("user-1");
  expect(session?.email).toBe("test@example.com");
});

test("getSession returns null for expired token", async () => {
  const token = await makeToken({ userId: "user-1", email: "test@example.com" }, "-1s");
  mockCookieStore.get.mockReturnValue({ value: token });

  expect(await getSession()).toBeNull();
});

test("getSession returns null for malformed token", async () => {
  mockCookieStore.get.mockReturnValue({ value: "not.a.valid.jwt" });
  expect(await getSession()).toBeNull();
});

test("getSession returns null for token signed with wrong secret", async () => {
  const wrongSecret = new TextEncoder().encode("wrong-secret");
  const token = await new SignJWT({ userId: "user-1" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(wrongSecret);
  mockCookieStore.get.mockReturnValue({ value: token });

  expect(await getSession()).toBeNull();
});

test("getSession returns null for empty string token", async () => {
  mockCookieStore.get.mockReturnValue({ value: "" });
  expect(await getSession()).toBeNull();
});

test("getSession reads from the auth-token cookie name", async () => {
  mockCookieStore.get.mockReturnValue(undefined);
  await getSession();
  expect(mockCookieStore.get).toHaveBeenCalledWith("auth-token");
});

test("getSession returns all payload fields", async () => {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const token = await makeToken({ userId: "user-99", email: "full@example.com", expiresAt });
  mockCookieStore.get.mockReturnValue({ value: token });

  const session = await getSession();
  expect(session?.userId).toBe("user-99");
  expect(session?.email).toBe("full@example.com");
  expect(session?.expiresAt).toBeDefined();
});

test("getSession returns payload for a token with no expiry", async () => {
  const secret = new TextEncoder().encode("development-secret-key");
  const token = await new SignJWT({ userId: "user-1", email: "test@example.com" })
    .setProtectedHeader({ alg: "HS256" })
    .sign(secret);
  mockCookieStore.get.mockReturnValue({ value: token });

  const session = await getSession();
  expect(session?.userId).toBe("user-1");
  expect(session?.email).toBe("test@example.com");
});

// --- deleteSession ---

test("deleteSession removes auth-token cookie", async () => {
  await deleteSession();
  expect(mockCookieStore.delete).toHaveBeenCalledOnce();
  expect(mockCookieStore.delete).toHaveBeenCalledWith("auth-token");
});

// --- verifySession ---

test("verifySession returns null when no cookie on request", async () => {
  expect(await verifySession(makeRequest())).toBeNull();
});

test("verifySession returns session payload from valid token", async () => {
  const token = await makeToken({ userId: "user-2", email: "other@example.com", expiresAt: new Date() });

  const session = await verifySession(makeRequest(token));
  expect(session?.userId).toBe("user-2");
  expect(session?.email).toBe("other@example.com");
});

test("verifySession returns null for expired token", async () => {
  const token = await makeToken({ userId: "user-1" }, "-1s");
  expect(await verifySession(makeRequest(token))).toBeNull();
});

test("verifySession returns null for malformed token", async () => {
  expect(await verifySession(makeRequest("bad.token.value"))).toBeNull();
});

test("verifySession returns null for token signed with wrong secret", async () => {
  const wrongSecret = new TextEncoder().encode("wrong-secret");
  const token = await new SignJWT({ userId: "user-1" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(wrongSecret);

  expect(await verifySession(makeRequest(token))).toBeNull();
});
