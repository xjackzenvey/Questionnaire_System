import { useState } from "react";
import {
  MessageSquare,
  CornerUpLeft,
  Check,
  RotateCcw,
  Send,
} from "lucide-react";
import { api, date } from "./api";
import { Button, Empty } from "./ui";
import { questionParts } from "../shared/question";
export default function Comments({
  survey,
  comments,
  target,
  setTarget,
  endpoint,
  guest,
  dirty,
  notify,
  refresh,
}) {
  const [filter, setFilter] = useState(false),
    [body, setBody] = useState(""),
    [name, setName] = useState(sessionStorage.getItem("review-name") || ""),
    [reply, setReply] = useState(null),
    [busy, setBusy] = useState(false);
  const roots = comments.filter((c) => !c.parent_id),
    items = roots.filter((c) => c.resolved === filter);
  const texts = new Map([
    ["document", survey.document.title],
    ["description", survey.document.description],
    ...survey.document.questions.flatMap((q) => [
      [q.id, q.title],
      [`${q.id}-section`, questionParts(q).sectionTitle],
      ...q.options.map((o) => [o.id, o.text]),
    ]),
  ]);
  async function submit(e) {
    e.preventDefault();
    if (dirty) {
      notify("请先保存问卷，再添加批注");
      return;
    }
    setBusy(true);
    try {
      await api(endpoint + "/comments", {
        method: "POST",
        body: {
          targetId: target.id,
          quote: target.quote,
          revision: survey.revision,
          author: guest ? name : undefined,
          body,
          parentId: reply?.id || null,
        },
      });
      sessionStorage.setItem("review-name", name);
      setBody("");
      setReply(null);
      await refresh();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function resolve(c) {
    try {
      await api(`/surveys/${survey.id}/comments/${c.id}`, {
        method: "PATCH",
        body: { resolved: !c.resolved },
      });
      await refresh();
    } catch (e) {
      notify(e.message);
    }
  }
  return (
    <aside className="comments-panel">
      <h2>
        <MessageSquare size={21} />
        批注与讨论
      </h2>
      <div className="tabs comment-tabs">
        {[false, true].map((value) => (
          <button
            key={String(value)}
            className={filter === value ? "active" : ""}
            onClick={() => setFilter(value)}
          >
            {value ? "已解决" : "待处理"}
            <span>{roots.filter((c) => c.resolved === value).length}</span>
          </button>
        ))}
      </div>
      {guest && (
        <p className="guest-note">
          持有链接的人可查看并参与讨论。访客姓名由本人填写。
        </p>
      )}
      <div className="comment-list">
        {!items.length ? (
          <Empty>
            <MessageSquare size={30} />
            <p>{filter ? "暂无已解决批注" : "暂无待处理批注"}</p>
            <small>选择题目、选项或划选文字发起讨论</small>
          </Empty>
        ) : (
          items.map((c) => (
            <article className="comment" key={c.id}>
              <button
                className="quote"
                onClick={() => {
                  setTarget({ id: c.target_id, quote: c.quote });
                  document
                    .getElementById("target-" + c.target_id)
                    ?.scrollIntoView({ block: "center", behavior: "smooth" });
                }}
              >
                {c.quote || "问卷整体"}
                {(!texts.has(c.target_id) ||
                  !texts.get(c.target_id)?.includes(c.quote)) && (
                  <small>原内容已修改或删除</small>
                )}
              </button>
              <div className="comment-author">
                <span className="avatar">{c.author[0]}</span>
                <div>
                  <strong>{c.author}</strong>
                  <small>
                    {date(c.created_at)} · 修订 {c.revision}
                  </small>
                </div>
              </div>
              <p className="comment-body">{c.body}</p>
              {comments
                .filter((r) => r.parent_id === c.id)
                .map((r) => (
                  <div className="reply" key={r.id}>
                    <strong>{r.author}</strong>
                    <small>{date(r.created_at)}</small>
                    <p>{r.body}</p>
                  </div>
                ))}
              {survey.status !== "final" && (
                <div className="comment-actions">
                  <button
                    onClick={() => {
                      setReply(c);
                      setTarget({ id: c.target_id, quote: c.quote });
                    }}
                  >
                    <CornerUpLeft size={14} />
                    回复
                  </button>
                  {!guest && (
                    <button onClick={() => resolve(c)}>
                      {c.resolved ? (
                        <RotateCcw size={14} />
                      ) : (
                        <Check size={14} />
                      )}{" "}
                      {c.resolved ? "重新打开" : "标记解决"}
                    </button>
                  )}
                </div>
              )}
            </article>
          ))
        )}
      </div>
      {survey.status !== "final" ? (
        <form className="comment-composer" onSubmit={submit}>
          <div className="composer-target">
            {reply ? "回复：" : "批注："}
            <span>{reply ? reply.author : target.quote || "问卷整体"}</span>
            {reply && (
              <button type="button" onClick={() => setReply(null)}>
                取消
              </button>
            )}
          </div>
          {guest && (
            <input
              aria-label="访客姓名"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              required
              placeholder="你的姓名（访客）"
            />
          )}
          <textarea
            aria-label="批注内容"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={3000}
            required
            placeholder="写下你的建议，开启讨论…"
          />
          <Button variant="primary" icon={Send} busy={busy} disabled={dirty}>
            发表{reply ? "回复" : "批注"}
          </Button>
        </form>
      ) : (
        <p className="locked-note">已定稿，讨论记录只读。</p>
      )}
    </aside>
  );
}
