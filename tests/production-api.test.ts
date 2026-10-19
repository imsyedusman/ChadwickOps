import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { verifyProductionApiAuth } from "../src/lib/production-api-auth";

test("Production API Auth - Missing authorization header returns 401 when key is configured", () => {
  process.env.CHADWICK_PRODUCTION_API_KEY = "test-secret-key-12345";
  const req = new NextRequest("http://localhost:3000/api/production/v1/freshness");
  const auth = verifyProductionApiAuth(req);
  assert.equal(auth.authorized, false);
  assert.equal(auth.response?.status, 401);
});

test("Production API Auth - Invalid Bearer token returns 401", () => {
  process.env.CHADWICK_PRODUCTION_API_KEY = "test-secret-key-12345";
  const req = new NextRequest("http://localhost:3000/api/production/v1/freshness", {
    headers: { authorization: "Bearer wrong-key" },
  });
  const auth = verifyProductionApiAuth(req);
  assert.equal(auth.authorized, false);
  assert.equal(auth.response?.status, 401);
});

test("Production API Auth - Valid Bearer token succeeds", () => {
  process.env.CHADWICK_PRODUCTION_API_KEY = "test-secret-key-12345";
  const req = new NextRequest("http://localhost:3000/api/production/v1/freshness", {
    headers: { authorization: "Bearer test-secret-key-12345" },
  });
  const auth = verifyProductionApiAuth(req);
  assert.equal(auth.authorized, true);
  assert.equal(auth.response, undefined);
});

test("Production API Auth - Valid x-api-key header succeeds", () => {
  process.env.CHADWICK_PRODUCTION_API_KEY = "test-secret-key-12345";
  const req = new NextRequest("http://localhost:3000/api/production/v1/freshness", {
    headers: { "x-api-key": "test-secret-key-12345" },
  });
  const auth = verifyProductionApiAuth(req);
  assert.equal(auth.authorized, true);
  assert.equal(auth.response, undefined);
});

test("Production API Auth - Unconfigured server key returns 500", () => {
  delete process.env.CHADWICK_PRODUCTION_API_KEY;
  delete process.env.PRODUCTION_API_KEY;
  const req = new NextRequest("http://localhost:3000/api/production/v1/freshness", {
    headers: { authorization: "Bearer some-key" },
  });
  const auth = verifyProductionApiAuth(req);
  assert.equal(auth.authorized, false);
  assert.equal(auth.response?.status, 500);
});
