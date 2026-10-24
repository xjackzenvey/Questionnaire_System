import test from "node:test";
import assert from "node:assert/strict";
import { normalizeReviewBaseUrl, withReviewUrl } from "../server/review-url.js";

test("review origin supports HTTPS, local ports, trailing slash and unset fallback", () => {
  assert.equal(
    normalizeReviewBaseUrl(" https://review.example.com/ "),
    "https://review.example.com",
  );
  assert.equal(
    normalizeReviewBaseUrl("http://localhost:5173"),
    "http://localhost:5173",
  );
  assert.equal(normalizeReviewBaseUrl(), "");
  assert.equal(
    withReviewUrl({ review_token: "abc" }, "https://review.example.com")
      .review_url,
    "https://review.example.com/review/abc",
  );
  assert.equal(
    withReviewUrl({ review_token: "abc" }, "").review_url,
    "/review/abc",
  );
  assert.equal(
    withReviewUrl({ review_token: null }, "https://review.example.com")
      .review_url,
    null,
  );
});
test("invalid review origins fail instead of producing broken or unsafe links", () => {
  for (const input of [
    "example.com",
    "javascript:alert(1)",
    "https://user:pass@example.com",
    "https://example.com/sub%20path",
    "https://example.com/?a=1",
    "https://example.com/#fragment",
  ])
    assert.throws(() => normalizeReviewBaseUrl(input));
});

test("review URLs retain deployment prefixes exactly once", () => {
  assert.equal(
    normalizeReviewBaseUrl("https://app.chisato.space", "/questions"),
    "https://app.chisato.space/questions",
  );
  assert.equal(
    normalizeReviewBaseUrl(
      "https://app.chisato.space/questions/",
      "/questions",
    ),
    "https://app.chisato.space/questions",
  );
  assert.equal(
    withReviewUrl({ review_token: "abc" }, "", "/questions").review_url,
    "/questions/review/abc",
  );
});
