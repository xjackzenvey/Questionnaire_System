import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../server/db.js";
import { normalizeReviewBaseUrl } from "../server/review-url.js";
import { normalizeBasePath } from "../shared/paths.js";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";
test("authenticated editing, review, finalization and export lifecycle", async () => {
  const users = [],
    surveys = [],
    cookies = [];
  async function request(
    path,
    { method = "GET", body, cookie, expected = 200 } = {},
  ) {
    const res = await fetch(base + "/api" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json();
    assert.equal(res.status, expected, JSON.stringify(data));
    return {
      data,
      cookie: res.headers.get("set-cookie")?.split(";")[0],
      cookieHeader: res.headers.get("set-cookie"),
    };
  }
  try {
    await request("/surveys", { expected: 401 });
    for (let i = 0; i < 2; i++) {
      const r = await request("/auth/register", {
        method: "POST",
        body: {
          email: `qa-${randomUUID()}@example.com`,
          password: "Test-only-1234",
          name: "自动测试",
        },
        expected: 201,
      });
      assert.ok(
        r.cookieHeader.includes(
          `Path=${normalizeBasePath(process.env.APP_BASE_PATH)}/;`,
        ),
      );
      users.push(r.data.user.id);
      cookies.push(r.cookie);
    }
    const cookie = cookies[0];
    const { data: created } = await request("/surveys", {
      method: "POST",
      cookie,
      body: { title: "自动测试问卷" },
      expected: 201,
    });
    const id = created.id;
    surveys.push(id);
    const { data: s } = await request("/surveys/" + id, { cookie });
    await request("/surveys/" + id, { cookie: cookies[1], expected: 404 });
    const document = { ...s.document, title: "自动测试修订" };
    const { data: updated } = await request("/surveys/" + id, {
      method: "PUT",
      cookie,
      body: { document, revision: s.revision },
    });
    await request("/surveys/" + id, {
      method: "PUT",
      cookie,
      body: { document, revision: s.revision },
      expected: 409,
    });
    const { data: link } = await request(`/surveys/${id}/review-link`, {
      method: "POST",
      cookie,
      body: {},
    });
    const prefix = normalizeBasePath(process.env.APP_BASE_PATH);
    assert.equal(
      link.review_url,
      `${normalizeReviewBaseUrl(process.env.REVIEW_BASE_URL, prefix) || prefix}/review/${link.review_token}`,
    );
    const { data: reloaded } = await request(`/surveys/${id}`, { cookie });
    assert.equal(reloaded.review_url, link.review_url);
    await request("/review/" + link.review_token);
    await request("/surveys/" + id, {
      method: "PUT",
      body: { document, revision: updated.revision },
      expected: 401,
    });
    const q = document.questions[0];
    const body = {
      targetId: q.id,
      quote: q.title,
      revision: updated.revision,
      author: "评审者",
      body: "请补充时间范围",
    };
    await request(`/review/${link.review_token}/comments`, {
      method: "POST",
      body: { ...body, quote: "不存在的内容" },
      expected: 409,
    });
    const { data: comment } = await request(
      `/review/${link.review_token}/comments`,
      { method: "POST", body, expected: 201 },
    );
    await request(`/surveys/${id}/finalize`, {
      method: "POST",
      cookie,
      body: { revision: updated.revision },
      expected: 409,
    });
    await request(`/surveys/${id}/comments`, {
      method: "POST",
      cookie,
      body: { ...body, parentId: comment.id, body: "已确认并处理" },
      expected: 201,
    });
    await request(`/surveys/${id}/comments/${comment.id}`, {
      method: "PATCH",
      cookie,
      body: { resolved: true },
    });
    const { data: version } = await request(`/surveys/${id}/finalize`, {
      method: "POST",
      cookie,
      body: { revision: updated.revision },
      expected: 201,
    });
    await request("/review/" + link.review_token, { expected: 404 });
    await request(`/surveys/${id}/review-link`, {
      method: "POST",
      cookie,
      body: {},
      expected: 409,
    });
    await request("/surveys/" + id, {
      method: "PUT",
      cookie,
      body: { document, revision: updated.revision },
      expected: 409,
    });
    const { data: output } = await request(`/surveys/${id}/exports`, {
      method: "POST",
      cookie,
      body: { versionId: version.id, platform: "wjx" },
      expected: 201,
    });
    assert.match(output.text, /自动测试修订/);
    assert.ok(output.warnings.length > 0);
    await request(`/surveys/${id}/exports/${output.record.id}`, {
      method: "PATCH",
      cookie,
      body: { url: "javascript:alert(1)" },
      expected: 400,
    });
    await request(`/surveys/${id}/exports/${output.record.id}`, {
      method: "PATCH",
      cookie,
      body: { url: "https://www.wjx.cn/vm/example.aspx" },
    });
    const { data: copy } = await request(`/surveys/${id}/duplicate`, {
      method: "POST",
      cookie,
      body: {},
      expected: 201,
    });
    surveys.push(copy.id);
    const { data: copyComments } = await request(
      `/surveys/${copy.id}/comments`,
      { cookie },
    );
    assert.equal(copyComments.length, 0);
  } finally {
    if (surveys.length)
      await pool.query(
        "DELETE FROM qs_comments WHERE survey_id=ANY($1::uuid[])",
        [surveys],
      );
    if (surveys.length)
      await pool.query("DELETE FROM qs_surveys WHERE id=ANY($1::uuid[])", [
        surveys,
      ]);
    if (users.length) {
      await pool.query(
        "DELETE FROM qs_sessions WHERE sess->'user'->>'id'=ANY($1::text[])",
        [users],
      );
      await pool.query("DELETE FROM qs_users WHERE id=ANY($1::uuid[])", [
        users,
      ]);
    }
    await pool.end();
  }
});
