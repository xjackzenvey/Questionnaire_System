import React, { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { FileText, HelpCircle, LogOut, X } from "lucide-react";
import { api } from "./api";
import { appUrl, currentRoute } from "./paths";
import Auth from "./Auth";
import Dashboard from "./Dashboard";
const Editor = lazy(() => import("./Editor"));
import { Modal } from "./ui";
import "./styles.css";
function App() {
  const [user, setUser] = useState(undefined),
    [path, setPath] = useState(currentRoute),
    [message, setMessage] = useState(""),
    [help, setHelp] = useState(false);
  const notify = useCallback((text) => setMessage(text), []);
  const navigate = useCallback((url) => {
    if (!window.dispatchEvent(new Event("qs:navigate", { cancelable: true })))
      return;
    window.history.pushState({}, "", appUrl(url));
    setPath(url);
  }, []);
  useEffect(() => {
    const f = () => setPath(currentRoute());
    window.addEventListener("popstate", f);
    api("/auth/me")
      .then((d) => setUser(d.user))
      .catch((e) => {
        setUser(null);
        notify(e.message);
      });
    return () => window.removeEventListener("popstate", f);
  }, [notify]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 6000);
    return () => clearTimeout(timer);
  }, [message]);
  const review = path?.match(/^\/review\/([a-f0-9]{48})\/?$/),
    editor = path?.match(/^\/surveys\/([a-f0-9-]{36})\/?$/);
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST", body: {} });
      setUser(null);
      navigate("/");
    } catch (e) {
      notify(e.message);
    }
  }
  return (
    <>
      {review ? (
        <Editor
          key={path}
          token={review[1]}
          notify={notify}
          navigate={navigate}
        />
      ) : user === undefined ? (
        <div className="loading-screen">问序 · 正在连接工作空间…</div>
      ) : !user ? (
        <Auth onLogin={setUser} notify={notify} />
      ) : (
        <div className="app-shell">
          <aside className="global-sidebar">
            <button className="brand" onClick={() => navigate("/")}>
              问序<span>QUESTION STUDIO</span>
            </button>
            <nav>
              <button
                className="active"
                onClick={() => {
                  if (editor) window.location.assign(appUrl("/"));
                  else navigate("/");
                }}
              >
                <FileText size={19} />
                我的问卷
              </button>
            </nav>
            <div className="sidebar-bottom">
              <button onClick={() => setHelp(true)}>
                <HelpCircle size={18} />
                使用说明
              </button>
              <div className="user-block">
                <span className="avatar">{user.name[0]}</span>
                <div>
                  <strong>{user.name}</strong>
                  <small>{user.email}</small>
                </div>
                <button aria-label="退出登录" onClick={logout}>
                  <LogOut size={17} />
                </button>
              </div>
            </div>
          </aside>
          <div className="workspace">
            {editor ? (
              <Editor
                key={path}
                id={editor[1]}
                navigate={navigate}
                notify={notify}
              />
            ) : (
              <Dashboard navigate={navigate} notify={notify} />
            )}
          </div>
        </div>
      )}
      {message && (
        <div role="status" className="toast">
          {message}
          <button aria-label="关闭提示" onClick={() => setMessage("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {help && (
        <Modal title="从草稿到定稿" onClose={() => setHelp(false)}>
          <ol className="help-list">
            <li>创建问卷，编辑题目、选项与说明，然后保存。</li>
            <li>生成审阅链接，邀请他人逐题、逐选项或划选文字批注。</li>
            <li>回复意见，修改内容，将处理完成的批注标记为已解决。</li>
            <li>确认定稿，保存只读快照。需要继续修改时复制为新草稿。</li>
            <li>选择目标平台导出文本，在腾讯问卷或问卷星导入、试填并发布。</li>
            <li>将正式作答链接登记到导出记录，保留版本与发布去向。</li>
          </ol>
          <p className="muted">系统只负责设计与审阅，不收集正式作答数据。</p>
        </Modal>
      )}
    </>
  );
}
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Suspense fallback={<div className="loading-screen">正在加载问卷…</div>}>
      <App />
    </Suspense>
  </React.StrictMode>,
);
