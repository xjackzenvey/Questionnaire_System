import { useState } from "react";
import {
  ArrowRight,
  Check,
  MessageSquare,
  Layers,
  FileOutput,
} from "lucide-react";
import { api } from "./api";
import { Button } from "./ui";
export default function Auth({ onLogin, notify }) {
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const fields = Object.fromEntries(new FormData(e.currentTarget));
      const { user } = await api("/auth/" + (register ? "register" : "login"), {
        method: "POST",
        body: fields,
      });
      onLogin(user);
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-story">
        <div className="brand">
          问序<span>QUESTION STUDIO</span>
        </div>
        <div>
          <h1>
            让每一份问卷，
            <br />
            经得起讨论。
          </h1>
          <p>
            从第一个问题，到最终定稿。
            <br />
            把编辑、审阅与版本留在同一个地方。
          </p>
          <ul>
            <li>
              <MessageSquare />
              逐题批注，充分讨论
            </li>
            <li>
              <Layers />
              版本定稿，有迹可循
            </li>
            <li>
              <FileOutput />
              适配导出，交给专业平台收集
            </li>
          </ul>
        </div>
        <small>
          <Check size={14} /> 专注问卷设计与审阅
        </small>
      </section>
      <section className="auth-form">
        <div className="mobile-brand">问序</div>
        <h2>{register ? "创建你的工作空间" : "欢迎回来"}</h2>
        <p>
          {register
            ? "注册后开始编辑和分享审阅问卷。"
            : "登录，继续打磨你的下一份问卷。"}
        </p>
        <form onSubmit={submit}>
          {register && (
            <label>
              姓名
              <input
                name="name"
                autoComplete="name"
                required
                maxLength={60}
                placeholder="你的姓名"
              />
            </label>
          )}
          <label>
            邮箱
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </label>
          <label>
            密码
            <input
              name="password"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              required
              minLength={8}
              maxLength={100}
              placeholder="至少 8 位字符"
            />
          </label>
          <Button busy={busy} variant="primary" icon={ArrowRight}>
            {register ? "创建账号" : "登录工作空间"}
          </Button>
        </form>
        <p className="auth-switch">
          {register ? "已有账号？" : "还没有账号？"}
          <button onClick={() => setRegister(!register)}>
            {register ? "立即登录" : "注册账号"}
          </button>
        </p>
      </section>
    </div>
  );
}
