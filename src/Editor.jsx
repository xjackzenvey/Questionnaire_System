import { useCallback, useEffect, useRef, useState } from "react";
import {
  Save,
  Link,
  Download,
  Plus,
  List,
  Copy,
  Check,
  Lock,
  ArrowLeft,
  MessageSquare,
} from "lucide-react";
import { api, TYPES, newQuestion } from "./api";
import { Button, Modal, Empty } from "./ui";
import Question from "./Question";
import Comments from "./Comments";
import Versions from "./Versions";
export default function Editor({ id, token, navigate, notify }) {
  const guest = Boolean(token),
    endpoint = guest ? `/review/${token}` : `/surveys/${id}`;
  const [survey, setSurvey] = useState(null),
    [document, setDocument] = useState(null),
    [comments, setComments] = useState([]),
    [selected, setSelected] = useState(null),
    [target, setTarget] = useState({ id: "document", quote: "" }),
    [tab, setTab] = useState(guest ? "preview" : "edit"),
    [busy, setBusy] = useState(false),
    [linkOpen, setLinkOpen] = useState(false),
    [finalOpen, setFinalOpen] = useState(false),
    [loadError, setLoadError] = useState(""),
    [showComments, setShowComments] = useState(false);
  const dirty = Boolean(
      survey &&
      document &&
      JSON.stringify(document) !== JSON.stringify(survey.document),
    ),
    dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const refreshComments = useCallback(async () => {
    setComments(await api(endpoint + "/comments"));
  }, [endpoint]);
  const load = useCallback(async () => {
    const [s, c] = await Promise.all([
      api(endpoint),
      api(endpoint + "/comments"),
    ]);
    setSurvey(s);
    setDocument(s.document);
    setComments(c);
    setSelected(s.document.questions[0]?.id);
    setTarget({ id: "document", quote: s.document.title });
  }, [endpoint]);
  useEffect(() => {
    load().catch((e) => setLoadError(e.message));
  }, [load]);
  useEffect(() => {
    const timer = setInterval(() => {
      refreshComments().catch(() => {});
      if (guest)
        api(endpoint)
          .then((s) => {
            setSurvey((old) => {
              if (old?.revision !== s.revision) {
                setDocument(s.document);
                notify("问卷内容已更新");
              }
              return s;
            });
          })
          .catch((e) => setLoadError(e.message));
    }, 5000);
    return () => clearInterval(timer);
  }, [endpoint, guest, refreshComments, notify]);
  useEffect(() => {
    const guard = (e) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);
  useEffect(() => {
    const guard = (e) => {
      if (dirtyRef.current && !confirm("问卷尚未保存，确定离开？"))
        e.preventDefault();
    };
    window.addEventListener("qs:navigate", guard);
    return () => window.removeEventListener("qs:navigate", guard);
  }, []);
  async function save() {
    setBusy(true);
    try {
      const s = await api(endpoint, {
        method: "PUT",
        body: { document, revision: survey.revision },
      });
      setSurvey(s);
      setDocument((current) =>
        JSON.stringify(current) === JSON.stringify(document)
          ? s.document
          : current,
      );
      notify("问卷已保存");
      return s;
    } catch (e) {
      notify(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function reviewLink() {
    if (dirty && !(await save())) return;
    setLinkOpen(true);
  }
  async function createLink() {
    setBusy(true);
    try {
      const data = await api(endpoint + "/review-link", {
        method: "POST",
        body: {},
      });
      setSurvey((s) => ({ ...s, ...data }));
      notify("审阅链接已生成");
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function revoke() {
    try {
      await api(endpoint + "/review-link", { method: "DELETE" });
      setSurvey((s) => ({ ...s, review_token: null, review_url: null }));
      notify("审阅链接已撤销");
    } catch (e) {
      notify(e.message);
    }
  }
  async function finalize() {
    if (dirty) {
      notify("请先保存问卷再定稿");
      return;
    }
    setBusy(true);
    try {
      await api(endpoint + "/finalize", {
        method: "POST",
        body: { revision: survey.revision },
      });
      await load();
      setFinalOpen(false);
      setTab("versions");
      notify("已保存定稿快照，问卷现在只读");
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function duplicate() {
    try {
      const { id: newId } = await api(endpoint + "/duplicate", {
        method: "POST",
        body: {},
      });
      navigate("/surveys/" + newId);
    } catch (e) {
      notify(e.message);
    }
  }
  function leave() {
    navigate("/");
  }
  function add() {
    const q = newQuestion();
    setDocument((d) => ({ ...d, questions: [...d.questions, q] }));
    setSelected(q.id);
    setTimeout(
      () =>
        window.document
          .getElementById("target-" + q.id)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      50,
    );
  }
  function move(index, delta) {
    setDocument((d) => {
      const questions = [...d.questions];
      const to = index + delta;
      if (to < 0 || to >= questions.length) return d;
      [questions[index], questions[to]] = [questions[to], questions[index]];
      return { ...d, questions };
    });
  }
  if (loadError)
    return (
      <Empty>
        <h2>{loadError}</h2>
        <p>请检查链接或重新加载页面。</p>
        <Button onClick={() => window.location.reload()}>重新加载</Button>
        {!guest && <Button onClick={() => navigate("/")}>返回问卷列表</Button>}
      </Empty>
    );
  if (!survey || !document) return <Empty>正在打开问卷…</Empty>;
  const editable = !guest && tab === "edit" && survey.status !== "final";
  const displayed = { ...survey, document };
  return (
    <div className={`editor-page ${guest ? "guest-editor" : ""}`}>
      <header className="editor-toolbar">
        <div className="breadcrumb">
          {guest ? (
            <>
              <span className="mini-brand">问序</span>
              <span>问卷审阅</span>
            </>
          ) : (
            <button onClick={leave}>
              <ArrowLeft size={15} />
              我的问卷
            </button>
          )}
          <span>/</span>
          <strong>{survey.title}</strong>
        </div>
        <div className="toolbar-actions">
          {guest ? (
            <span className="review-label">
              <Lock size={14} />
              只能批注，不可修改
            </span>
          ) : (
            <>
              <span className="save-status">
                {dirty ? (
                  "有未保存的修改"
                ) : (
                  <>
                    <Check size={15} />
                    已保存 · 修订 {survey.revision}
                  </>
                )}
              </span>
              {survey.status !== "final" ? (
                <>
                  <Button icon={Save} busy={busy} onClick={save}>
                    保存
                  </Button>
                  <Button icon={Link} onClick={reviewLink}>
                    审阅链接
                  </Button>
                  <Button
                    icon={Download}
                    variant="primary"
                    onClick={() => setFinalOpen(true)}
                  >
                    定稿导出
                  </Button>
                </>
              ) : (
                <Button icon={Copy} onClick={duplicate}>
                  复制为新草稿
                </Button>
              )}
            </>
          )}
          <button
            aria-label="切换批注面板"
            className="icon-button comments-toggle"
            onClick={() => setShowComments(!showComments)}
          >
            <MessageSquare size={20} />
          </button>
        </div>
      </header>
      <div className="editor-tabs tabs">
        {!guest &&
          [
            ["edit", "编辑问卷"],
            ["preview", "预览问卷"],
            ["versions", "版本记录"],
          ].map(([value, label]) => (
            <button
              className={tab === value ? "active" : ""}
              key={value}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        {guest && <p>审阅中的问卷 · 点击题目或选项发起批注，也可划选文字</p>}
        {survey.status === "final" && (
          <span className="final-label">
            <Lock size={13} />
            已定稿，只读
          </span>
        )}
      </div>
      {tab === "versions" ? (
        <Versions survey={survey} notify={notify} />
      ) : (
        <div
          className={`editor-layout ${showComments ? "comments-visible" : ""}`}
        >
          <aside className="outline">
            <h2>
              问卷大纲
              <List size={18} />
            </h2>
            <div className="outline-items">
              {document.questions.map((q, i) => (
                <button
                  key={q.id}
                  className={selected === q.id ? "active" : ""}
                  onClick={() => {
                    setSelected(q.id);
                    window.document
                      .getElementById("target-" + q.id)
                      ?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                >
                  <span>{i + 1}</span>
                  <div>
                    <strong>{q.title}</strong>
                    <small>{TYPES[q.type]}</small>
                  </div>
                </button>
              ))}
            </div>
            {editable && (
              <Button icon={Plus} onClick={add}>
                添加问题
              </Button>
            )}
            <div className="outline-footer">
              {document.questions.length} 个问题
              <br />
              {guest ? "审阅意见每 5 秒同步" : "内容手动保存 · 批注每 5 秒同步"}
            </div>
          </aside>
          <main className="document-panel">
            <div className="document-intro" id="target-document">
              {editable ? (
                <input
                  aria-label="问卷标题"
                  className="document-title"
                  value={document.title}
                  onFocus={() =>
                    setTarget({ id: "document", quote: document.title })
                  }
                  onChange={(e) =>
                    setDocument({ ...document, title: e.target.value })
                  }
                />
              ) : (
                <h1
                  onMouseUp={() =>
                    setTarget({
                      id: "document",
                      quote:
                        window.getSelection()?.toString().trim() ||
                        document.title,
                    })
                  }
                >
                  {document.title}
                </h1>
              )}
              {editable ? (
                <textarea
                  id="target-description"
                  aria-label="问卷说明"
                  className="document-description"
                  value={document.description}
                  onFocus={() =>
                    setTarget({
                      id: "description",
                      quote: document.description.slice(0, 1000),
                    })
                  }
                  onChange={(e) =>
                    setDocument({ ...document, description: e.target.value })
                  }
                />
              ) : (
                <p
                  id="target-description"
                  onMouseUp={() =>
                    setTarget({
                      id: "description",
                      quote:
                        window.getSelection()?.toString().trim() ||
                        document.description.slice(0, 1000),
                    })
                  }
                >
                  {document.description}
                </p>
              )}
            </div>
            {tab === "preview" && (
              <div className="preview-note">
                仅预览问卷效果，填写内容不会提交或存储。
              </div>
            )}
            {document.questions.map((q, i) => (
              <Question
                key={q.id}
                question={q}
                index={i}
                editable={editable}
                selected={selected === q.id}
                onSelect={setSelected}
                comments={comments}
                setTarget={setTarget}
                onChange={(question) =>
                  setDocument((d) => ({
                    ...d,
                    questions: d.questions.map((x) =>
                      x.id === q.id ? question : x,
                    ),
                  }))
                }
                onRemove={() => {
                  if (document.questions.length === 1) {
                    notify("至少保留一个问题");
                    return;
                  }
                  if (confirm("删除这个问题？相关批注仍会保留。"))
                    setDocument((d) => ({
                      ...d,
                      questions: d.questions.filter((x) => x.id !== q.id),
                    }));
                }}
                onMove={(delta) => move(i, delta)}
              />
            ))}
            {editable && (
              <Button variant="add-question" icon={Plus} onClick={add}>
                添加问题
              </Button>
            )}
            <footer className="document-footer">问序 · 让问题更有价值</footer>
          </main>
          <Comments
            survey={displayed}
            comments={comments}
            target={target}
            setTarget={setTarget}
            endpoint={endpoint}
            guest={guest}
            dirty={dirty}
            notify={notify}
            refresh={refreshComments}
          />
        </div>
      )}
      {linkOpen && (
        <Modal title="邀请他人审阅" onClose={() => setLinkOpen(false)}>
          <p>持有链接的人可以查看问卷、发表批注与回复，不能修改内容。</p>
          <p className="muted">
            生成链接后问卷标记为审阅中。定稿后链接自动失效。
          </p>
          {survey.review_token ? (
            <>
              <label>
                审阅链接
                <input
                  aria-label="审阅链接"
                  value={
                    new URL(survey.review_url, window.location.origin).href
                  }
                  readOnly
                />
              </label>
              <div className="modal-actions">
                <Button onClick={revoke}>撤销链接</Button>
                <Button
                  icon={Copy}
                  variant="primary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        new URL(survey.review_url, window.location.origin).href,
                      );
                      notify("审阅链接已复制");
                    } catch {
                      notify("请手动复制链接");
                    }
                  }}
                >
                  复制链接
                </Button>
              </div>
            </>
          ) : (
            <Button
              busy={busy}
              variant="primary"
              icon={Link}
              onClick={createLink}
            >
              生成审阅链接
            </Button>
          )}
        </Modal>
      )}
      {finalOpen && (
        <Modal title="确认问卷定稿" onClose={() => setFinalOpen(false)}>
          <p>
            定稿会保存不可变的版本快照，并撤销审阅链接。之后可复制成新草稿继续修改。
          </p>
          <div className="notice">
            待处理批注：
            {comments.filter((c) => !c.parent_id && !c.resolved).length} 条
            <br />
            {dirty
              ? "当前有未保存内容，请先保存。"
              : "请确认题目、选项与说明已经审核完成。"}
          </div>
          <div className="modal-actions">
            <Button onClick={() => setFinalOpen(false)}>继续检查</Button>
            <Button
              busy={busy}
              variant="primary"
              disabled={
                dirty || comments.some((c) => !c.parent_id && !c.resolved)
              }
              onClick={finalize}
            >
              确认定稿
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
