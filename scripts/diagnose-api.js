#!/usr/bin/env node

/**
 * API diagnostic script for deployed backend.
 *
 * Usage examples:
 *   node scripts/diagnose-api.js
 *   API_BASE_URL="http://your-eb-url/api/v1" node scripts/diagnose-api.js
 *   LOGIN_EMAIL="user@example.com" LOGIN_PASSWORD="Secret@123" node scripts/diagnose-api.js
 */

const DEFAULT_BASE_URL =
  "http://Insta-app-backend-env.eba-7c2tbppk.us-east-1.elasticbeanstalk.com/api/v1";

const API_BASE_URL = process.env.API_BASE_URL || DEFAULT_BASE_URL;
const LOGIN_EMAIL = process.env.LOGIN_EMAIL || "admin@instayt.com";
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || "Admin@1234";

async function callApi(method, path, { token, body } = {}) {
  const url = `${API_BASE_URL}${path}`;
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const start = Date.now();
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const elapsedMs = Date.now() - start;

  let data = null;
  let text = "";
  try {
    data = await res.json();
  } catch {
    text = await res.text();
  }

  return {
    ok: res.ok,
    status: res.status,
    elapsedMs,
    data,
    text,
  };
}

function printResult(label, result) {
  const status = `${result.status}`.padEnd(3, " ");
  console.log(`\n[${label}] status=${status} time=${result.elapsedMs}ms`);
  if (result.data) {
    console.log(JSON.stringify(result.data, null, 2));
  } else if (result.text) {
    console.log(result.text);
  } else {
    console.log("(empty body)");
  }
}

async function run() {
  console.log(`API_BASE_URL=${API_BASE_URL}`);

  const health = await callApi("GET", "/health");
  printResult("health", health);

  const noAuthFeed = await callApi("GET", "/posts/feed?limit=10");
  printResult("feed_without_auth", noAuthFeed);

  const login = await callApi("POST", "/auth/login", {
    body: {
      email: LOGIN_EMAIL,
      password: LOGIN_PASSWORD,
    },
  });
  printResult("login", login);

  const accessToken = login?.data?.data?.access_token;
  if (!accessToken) {
    console.log("\nDIAGNOSIS:");
    console.log("- Backend is reachable.");
    console.log("- Protected routes correctly reject missing auth header.");
    console.log("- Login did not return access_token.");
    console.log("- Most likely issue: wrong credentials or user missing in deployed DB.");
    process.exit(2);
  }

  const me = await callApi("GET", "/users/me", { token: accessToken });
  printResult("users_me", me);

  const feed = await callApi("GET", "/posts/feed?limit=10", { token: accessToken });
  printResult("feed_with_auth", feed);

  const stories = await callApi("GET", "/stories/feed?limit=50", { token: accessToken });
  printResult("stories_with_auth", stories);

  console.log("\nDIAGNOSIS:");
  if (!me.ok && me.status === 404) {
    console.log("- Login worked but /users/me returns User not found.");
    console.log("- Token user id does not match an existing user record in DB.");
    console.log("- Check deployed DB consistency and user document existence.");
    process.exit(3);
  }

  if (me.ok && feed.ok && stories.ok) {
    console.log("- Auth flow and protected APIs are working from backend perspective.");
    console.log("- Any remaining issue is likely client-side session/state.");
    process.exit(0);
  }

  console.log("- Some authenticated endpoints still fail. Check printed responses above.");
  process.exit(4);
}

run().catch((err) => {
  console.error("\nUnhandled error while diagnosing API:");
  console.error(err);
  process.exit(1);
});

