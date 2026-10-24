import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { documentSchema, exportText, targets } from "../server/document.js";
const doc = () => ({
  title: "测试问卷",
  description: "问卷说明",
  questions: [
    {
      id: randomUUID(),
      type: "single",
      title: "使用频率？",
      required: true,
      options: [
        { id: randomUUID(), text: "每天" },
        { id: randomUUID(), text: "偶尔" },
      ],
    },
  ],
});
test("validates choices and stable identifiers", () => {
  const d = doc();
  assert.equal(documentSchema.safeParse(d).success, true);
  d.questions[0].options.pop();
  assert.equal(documentSchema.safeParse(d).success, false);
});
test("rejects duplicate identifiers and multiline export injection", () => {
  const d = doc();
  d.questions[0].options[0].id = d.questions[0].id;
  assert.equal(documentSchema.safeParse(d).success, false);
  const e = doc();
  e.questions[0].title = "题目\n2. 注入题目";
  assert.equal(documentSchema.safeParse(e).success, false);
});
test("exports questions without discussion and reports lossy settings", () => {
  const d = doc();
  const out = exportText(d, "wjx");
  assert.match(out.text, /1\. 使用频率？ \[单选题\]/);
  assert.match(out.text, /A\. 每天/);
  assert.ok(out.warnings.some((w) => w.includes("必填")));
  assert.equal(targets(d).get(d.questions[0].options[0].id), "每天");
});
test("Tencent export uses native type names, raw options and required settings", () => {
  const d = doc();
  d.questions.push({
    id: randomUUID(),
    type: "textarea",
    title: "其他建议",
    required: false,
    options: [],
  });
  const out = exportText(d, "tencent");
  assert.match(out.text, /使用频率？\[单选题\]\[必答\]\n每天\n偶尔/);
  assert.match(out.text, /其他建议\[多行文本题\]\[选答\]/);
  assert.doesNotMatch(out.text, /A\. 每天/);
});
