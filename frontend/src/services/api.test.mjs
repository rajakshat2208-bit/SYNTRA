// Regression tests for normalizeApiBaseUrl — the exact bug class that broke
// production twice (missing /api, trailing slash, silent localhost fallback).
// Run with: node --test src/services/api.test.mjs
// No test framework dependency — uses Node's built-in test runner (Node 18+).
import { test } from "node:test";
import assert from "node:assert/strict";
import { __normalizeApiBaseUrl as normalize } from "./api.js";

const RENDER_URL = "https://syntra-backend-9hq1.onrender.com";
const EXPECTED = `${RENDER_URL}/api`;

test("bare origin gets /api appended", () => {
  assert.equal(normalize(RENDER_URL, false), EXPECTED);
});

test("trailing slash is stripped before appending /api", () => {
  assert.equal(normalize(`${RENDER_URL}/`, false), EXPECTED);
});

test("already-correct URL is left unchanged", () => {
  assert.equal(normalize(EXPECTED, false), EXPECTED);
});

test("trailing slash after /api is stripped", () => {
  assert.equal(normalize(`${EXPECTED}/`, false), EXPECTED);
});

test("duplicate /api/api is collapsed to a single /api", () => {
  assert.equal(normalize(`${RENDER_URL}/api/api`, false), EXPECTED);
});

test("missing URL in development falls back to localhost", () => {
  assert.equal(normalize(undefined, false), "http://localhost:8000/api");
});

test("missing URL in production throws instead of silently using localhost", () => {
  assert.throws(() => normalize(undefined, true), /VITE_API_URL is not configured/);
});
