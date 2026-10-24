import { useEffect, useState } from "react";
import { Download, Copy, ExternalLink, CheckCircle2, Link } from "lucide-react";
import { api, date } from "./api";
import { Button, Empty, Modal } from "./ui";
export default function Versions({ survey, notify }) {
  const [versions, setVersions] = useState([]),
    [records, setRecords] = useState([]),
    [platform, setPlatform] = useState("wjx"),
    [output, setOutput] = useState(null),
    [busy, setBusy] = useState(false),
    [linkRecord, setLinkRecord] = useState(null);
  async function load() {
    const [v, r] = await Promise.all([
      api(`/surveys/${survey.id}/versions`),
      api(`/surveys/${survey.id}/exports`),
    ]);
    setVersions(v);
    setRecords(r);
  }
  useEffect(() => {
    load().catch((e) => notify(e.message));
  }, [survey.id]);
  async function generate(versionId) {
    setBusy(true);
    try {
      const data = await api(`/surveys/${survey.id}/exports`, {
        method: "POST",
        body: { versionId, platform },
      });
      setOutput(data);
      await load();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  function download() {
    const blob = new Blob(["\ufeff" + output.text], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${survey.title.replace(/[<>:"/\\|?*]/g, "_")}-${platform}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function saveUrl(e) {
    e.preventDefault();
    try {
      await api(`/surveys/${survey.id}/exports/${linkRecord.id}`, {
        method: "PATCH",
        body: { url: new FormData(e.currentTarget).get("url") },
      });
      setLinkRecord(null);
      await load();
      notify("正式作答链接已登记");
    } catch (e) {
      notify(e.message);
    }
  }
  return (
    <div className="versions-view">
      <h1>版本与导出</h1>
      <p className="muted">
        定稿保存完整快照。导出后，请在目标平台试填并核对设置。
      </p>
      {!versions.length ? (
        <Empty>
          <CheckCircle2 size={34} />
          <h3>还没有定稿版本</h3>
          <p>完成审阅后，点击右上角“定稿导出”。</p>
        </Empty>
      ) : (
        versions.map((v) => (
          <section className="version-card" key={v.id}>
            <div>
              <CheckCircle2 size={24} />
              <h2>定稿 V{v.number}</h2>
              <span className="muted">
                {date(v.created_at)} · {v.document.questions.length} 个问题
              </span>
            </div>
            <p>{v.document.title}</p>
            <label>
              导出目标
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                <option value="wjx">问卷星</option>
                <option value="tencent">腾讯问卷</option>
              </select>
            </label>
            <Button
              busy={busy}
              icon={Download}
              variant="primary"
              onClick={() => generate(v.id)}
            >
              生成导入文本
            </Button>
            <details>
              <summary>查看定稿内容</summary>
              <pre>{JSON.stringify(v.document, null, 2)}</pre>
            </details>
          </section>
        ))
      )}
      <h2 className="section-title">导出记录</h2>
      {records.length ? (
        records.map((r) => (
          <div className="export-record" key={r.id}>
            <div>
              <strong>
                {r.platform === "wjx" ? "问卷星" : "腾讯问卷"} · V{r.number}
              </strong>
              <small>{date(r.created_at)}</small>
              {r.external_url && (
                <a href={r.external_url} target="_blank" rel="noreferrer">
                  打开正式作答链接 <ExternalLink size={13} />
                </a>
              )}
            </div>
            <Button icon={Link} onClick={() => setLinkRecord(r)}>
              {r.external_url ? "修改链接" : "登记作答链接"}
            </Button>
          </div>
        ))
      ) : (
        <p className="muted">尚未导出问卷。</p>
      )}
      {output && (
        <Modal
          title={`导出至${output.record.platform === "wjx" ? "问卷星" : "腾讯问卷"}`}
          onClose={() => setOutput(null)}
        >
          <div className="notice">
            <strong>导入兼容性提示</strong>
            <ul>
              {output.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
          <textarea
            className="export-text"
            aria-label="导入文本"
            value={output.text}
            readOnly
          />
          <div className="modal-actions">
            <a
              target="_blank"
              rel="noreferrer"
              href={
                output.record.platform === "wjx"
                  ? "https://www.wjx.cn/help/help.aspx?h=1&helpid=138"
                  : "https://cloud.tencent.cn/document/product/1304/134309"
              }
            >
              查看官方导入说明 <ExternalLink size={13} />
            </a>
            <Button
              icon={Copy}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(output.text);
                  notify("已复制导入文本");
                } catch {
                  notify("复制失败，请选中文本手动复制");
                }
              }}
            >
              复制文本
            </Button>
            <Button icon={Download} variant="primary" onClick={download}>
              下载 TXT
            </Button>
          </div>
        </Modal>
      )}
      {linkRecord && (
        <Modal title="登记正式作答链接" onClose={() => setLinkRecord(null)}>
          <form onSubmit={saveUrl}>
            <label>
              目标平台的 HTTPS 作答链接
              <input
                name="url"
                type="url"
                required
                placeholder="https://…"
                defaultValue={linkRecord.external_url || ""}
              />
            </label>
            <Button variant="primary">保存链接</Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
