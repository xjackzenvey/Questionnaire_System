import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBasePath, pathWithinApp } from "../shared/paths.js";

test("normalizes root, trailing slash and nested deployment prefixes", () => {
  for (const value of ["", "/", "  /  "])
    assert.equal(normalizeBasePath(value), "");
  assert.equal(normalizeBasePath("/questions/"), "/questions");
  assert.equal(normalizeBasePath("/apps/questions"), "/apps/questions");
  for (const value of [
    "questions",
    "//example.com",
    "/questions//x",
    "/../x",
    "/questions?x",
    "/questions#x",
    "/%71uestions",
  ])
    assert.throws(() => normalizeBasePath(value));
});
test("strips only exact application path boundaries", () => {
  assert.equal(
    pathWithinApp("/questions/surveys/abc", "/questions"),
    "/surveys/abc",
  );
  assert.equal(pathWithinApp("/questions", "/questions"), "/");
  assert.equal(pathWithinApp("/questions/", "/questions"), "/");
  assert.equal(pathWithinApp("/questions-extra/surveys", "/questions"), null);
  assert.equal(pathWithinApp("/surveys/abc", ""), "/surveys/abc");
});
