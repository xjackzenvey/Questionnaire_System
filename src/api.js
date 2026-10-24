import { appUrl } from "./paths";
export async function api(path, options = {}) {
  const response = await fetch(appUrl("/api") + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await response
    .json()
    .catch(() => ({ error: "服务器返回了无效响应" }));
  if (!response.ok) throw new Error(data.error || "操作失败");
  return data;
}
export const date = (value) =>
  new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
export const TYPES = {
  single: "单选题",
  multiple: "多选题",
  text: "单行填空",
  textarea: "多行填空",
  rating: "评分题",
};
export function newQuestion() {
  return {
    id: crypto.randomUUID(),
    type: "single",
    title: "请输入问题",
    required: false,
    options: ["选项一", "选项二"].map((text) => ({
      id: crypto.randomUUID(),
      text,
    })),
  };
}
