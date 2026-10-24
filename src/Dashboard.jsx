import { useEffect, useState } from "react";
import {
  Plus,
  ArrowUpRight,
  Search,
  FileText,
  MessageSquare,
  Copy,
} from "lucide-react";
import { api, date } from "./api";
import { Button, Empty, Modal } from "./ui";
export default function Dashboard({ navigate, notify }) {
  const [surveys, setSurveys] = useState(null),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [create, setCreate] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/surveys")
      .then(setSurveys)
      .catch((e) => notify(e.message));
  }, [notify]);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const { id } = await api("/surveys", {
        method: "POST",
        body: { title: new FormData(e.currentTarget).get("title") },
      });
      navigate("/surveys/" + id);
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function duplicate(id) {
    try {
      const result = await api(`/surveys/${id}/duplicate`, {
        method: "POST",
        body: {},
      });
      navigate("/surveys/" + result.id);
    } catch (e) {
      notify(e.message);
    }
  }
  const items = surveys?.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "all" || s.status === filter),
  );
  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <h1>我的问卷</h1>
          <p>每一个好问题，都从这里开始。</p>
        </div>
        <Button icon={Plus} variant="primary" onClick={() => setCreate(true)}>
          新建问卷
        </Button>
      </div>
      <div className="list-tools">
        <div className="tabs">
          {[
            ["all", "全部问卷"],
            ["draft", "草稿"],
            ["review", "审阅中"],
            ["final", "已定稿"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={filter === key ? "active" : ""}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={17} />
          <input
            aria-label="搜索问卷"
            placeholder="搜索问卷名称"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <div className="survey-list">
        <div className="survey-row table-head">
          <span>问卷名称</span>
          <span>状态</span>
          <span>待处理批注</span>
          <span>最后更新</span>
          <span>操作</span>
        </div>
        {!surveys ? (
          <Empty>正在加载问卷…</Empty>
        ) : !items.length ? (
          <Empty>
            <FileText size={38} />
            <h3>{surveys.length ? "没有匹配的问卷" : "开始你的第一份问卷"}</h3>
            <p>创建、讨论、定稿，让问题更有价值。</p>
            <Button icon={Plus} onClick={() => setCreate(true)}>
              新建问卷
            </Button>
          </Empty>
        ) : (
          items.map((s) => (
            <div className="survey-row" key={s.id}>
              <button
                className="survey-name"
                onClick={() => navigate("/surveys/" + s.id)}
              >
                <span className="document-icon">
                  <FileText size={22} />
                </span>
                <span>
                  <strong>{s.title}</strong>
                  <small>
                    {s.question_count} 个问题 · 修订 {s.revision}
                  </small>
                </span>
              </button>
              <span>
                <span className={`status ${s.status}`}>
                  {
                    { draft: "草稿", review: "审阅中", final: "已定稿" }[
                      s.status
                    ]
                  }
                </span>
              </span>
              <span className="muted">
                <MessageSquare size={15} /> {s.open_comments}
              </span>
              <span className="muted">{date(s.updated_at)}</span>
              <div className="row-actions">
                <button
                  aria-label={"复制" + s.title}
                  className="icon-button"
                  onClick={() => duplicate(s.id)}
                >
                  <Copy size={17} />
                </button>
                <button
                  aria-label={"打开" + s.title}
                  className="icon-button"
                  onClick={() => navigate("/surveys/" + s.id)}
                >
                  <ArrowUpRight size={19} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <p className="dashboard-note">
        在问序完成编辑与审阅，定稿后导出至腾讯问卷或问卷星。
      </p>
      {create && (
        <Modal title="新建问卷" onClose={() => setCreate(false)}>
          <form onSubmit={submit}>
            <label>
              问卷名称
              <input
                name="title"
                autoFocus
                required
                maxLength={200}
                placeholder="例如：用户体验调研"
              />
            </label>
            <p className="muted">从草稿开始，你可以随时邀请他人批注。</p>
            <Button variant="primary" busy={busy}>
              创建并开始编辑
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
