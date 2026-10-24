import { z } from "zod";
const id = z.string().uuid();
const oneLine = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .refine((s) => !/[\r\n]/.test(s), "题目和选项不能包含换行");
export const documentSchema = z
  .object({
    title: oneLine,
    description: z.string().max(5000),
    questions: z
      .array(
        z.object({
          id,
          type: z.enum(["single", "multiple", "text", "textarea", "rating"]),
          title: oneLine,
          required: z.boolean(),
          options: z.array(z.object({ id, text: oneLine })).max(100),
        }),
      )
      .min(1)
      .max(200),
  })
  .superRefine((doc, ctx) => {
    const ids = new Set();
    for (const q of doc.questions) {
      if (["single", "multiple"].includes(q.type) && q.options.length < 2)
        ctx.addIssue({ code: "custom", message: "选择题至少需要两个选项" });
      for (const item of [q, ...q.options]) {
        if (ids.has(item.id))
          ctx.addIssue({ code: "custom", message: "题目或选项 ID 重复" });
        ids.add(item.id);
      }
    }
  });
export function targets(doc) {
  return new Map([
    ["document", doc.title],
    ["description", doc.description],
    ...doc.questions.flatMap((q) => [
      [q.id, q.title],
      ...q.options.map((o) => [o.id, o.text]),
    ]),
  ]);
}
export function exportText(doc, platform) {
  const types =
    platform === "tencent"
      ? {
          single: "单选题",
          multiple: "多选题",
          text: "单行文本题",
          textarea: "多行文本题",
          rating: "量表题",
        }
      : {
          single: "单选题",
          multiple: "多选题",
          text: "填空题",
          textarea: "简答题",
          rating: "量表题",
        };
  const warnings = [
    "导入后请核对题型、题目顺序、选项和必填设置；本文件不包含批注。",
  ];
  if (doc.questions.some((q) => q.required))
    warnings.push(
      platform === "tencent"
        ? "已生成 [必答]/[选答] 设置；请在腾讯问卷文本编辑中开启题目设置支持，并逐题核对。"
        : "必填规则请在目标平台逐题确认，文本导入不保证保留。",
    );
  if (doc.questions.some((q) => ["textarea", "rating"].includes(q.type)))
    warnings.push(
      "长文本与评分题需要在目标平台检查或手动调整；评分默认为 1–5 分。",
    );
  if (platform === "tencent")
    warnings.push(
      "请通过腾讯问卷批量编辑导入并检查识别结果；AI 文档创建可能消耗点数。",
    );
  const clean = (text) => text.replaceAll("[", "［").replaceAll("]", "］");
  if (
    [
      doc.title,
      doc.description,
      ...doc.questions.flatMap((q) => [
        q.title,
        ...q.options.map((o) => o.text),
      ]),
    ].some((s) => /[\[\]]/.test(s))
  )
    warnings.push(
      "正文中的半角方括号已转为全角，避免被目标平台识别成导入指令。",
    );
  if (platform === "tencent" && /[\r\n]/.test(doc.description))
    warnings.push("腾讯问卷导入引导语中的换行已合并为空格。");
  const questions = doc.questions.flatMap((q, i) => [
    platform === "tencent"
      ? `${clean(q.title)}[${types[q.type]}][${q.required ? "必答" : "选答"}]`
      : `${i + 1}. ${clean(q.title)} [${types[q.type]}]`,
    ...(["single", "multiple"].includes(q.type)
      ? q.options.map((o, j) =>
          platform === "tencent"
            ? clean(o.text)
            : `${j < 26 ? String.fromCharCode(65 + j) : j + 1}. ${clean(o.text)}`,
        )
      : q.type === "rating"
        ? ["1~5"]
        : []),
    "",
  ]);
  return {
    warnings,
    text: [
      clean(doc.title),
      clean(
        platform === "tencent"
          ? doc.description.replace(/[\r\n]+/g, " ")
          : doc.description,
      ),
      "",
      ...questions,
    ].join("\n"),
  };
}
