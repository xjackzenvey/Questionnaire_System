import "dotenv/config";
import express from "express";
import helmet from "helmet";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import { randomUUID, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { pool, transaction } from "./db.js";
import { migrate } from "./migrate.js";
import { documentSchema, exportText, targets } from "./document.js";
import { normalizeReviewBaseUrl, withReviewUrl } from "./review-url.js";
import { normalizeBasePath } from "../shared/paths.js";

const hostApp = express();
const app = express.Router();
const basePath = normalizeBasePath(process.env.APP_BASE_PATH);
const cookiePath = basePath + "/";
const reviewBaseUrl = normalizeReviewBaseUrl(
  process.env.REVIEW_BASE_URL,
  basePath,
);
if (basePath)
  hostApp.get(basePath, (req, res, next) =>
    req.path === basePath ? res.redirect(308, basePath + "/") : next(),
  );
hostApp.use(basePath || "/", app);
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
  throw new Error("SESSION_SECRET must contain at least 32 characters");
if (process.env.TRUST_PROXY === "1") hostApp.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === "production" ? undefined : false,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    if (req.get("sec-fetch-site") === "cross-site")
      return res.status(403).json({ error: "不允许跨站请求" });
    if (
      req.get("origin") &&
      req.get("origin") !== `${req.protocol}://${req.get("host")}`
    )
      return res.status(403).json({ error: "请求来源不匹配" });
  }
  next();
});
const PgStore = connectPgSimple(session);
app.use(
  session({
    store: new PgStore({ pool, tableName: "qs_sessions" }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      path: cookiePath,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 86400000,
    },
  }),
);
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "请求过于频繁，请稍后重试" },
  }),
);
const authLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "登录尝试过多，请稍后重试" },
});
const uuid = z.string().uuid();
function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  throw e;
}
function auth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "请先登录" });
  next();
}
async function owned(req, client = pool) {
  uuid.parse(req.params.id);
  const { rows } = await client.query(
    "SELECT * FROM qs_surveys WHERE id=$1 AND owner_id=$2",
    [req.params.id, req.session.user.id],
  );
  if (!rows[0]) fail(404, "问卷不存在");
  return rows[0];
}
async function shared(req) {
  const token = z
    .string()
    .regex(/^[a-f0-9]{48}$/)
    .parse(req.params.token);
  const { rows } = await pool.query(
    "SELECT id,title,document,revision,status FROM qs_surveys WHERE review_token=$1",
    [token],
  );
  if (!rows[0]) fail(404, "审阅链接无效或已撤销");
  return rows[0];
}
function newDocument(title) {
  return {
    title,
    description: "感谢您参与本次调查，您的建议将帮助我们持续改进。",
    questions: [
      {
        id: randomUUID(),
        type: "single",
        title: "您使用本产品的频率？",
        required: true,
        options: ["每天", "每周几次", "偶尔"].map((text) => ({
          id: randomUUID(),
          text,
        })),
      },
    ],
  };
}
app.get("/api/health", async (req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true });
});
app.get("/api/auth/me", (req, res) =>
  res.json({ user: req.session.user ?? null }),
);
const credentials = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(8).max(100),
  name: z.string().trim().min(1).max(60).optional(),
});
function loginSession(req, user) {
  return new Promise((resolve, reject) =>
    req.session.regenerate((e) => {
      if (e) return reject(e);
      req.session.user = user;
      req.session.save((e) => (e ? reject(e) : resolve()));
    }),
  );
}
app.post("/api/auth/register", authLimit, async (req, res) => {
  const data = credentials.parse(req.body);
  if (!data.name) fail(400, "请输入姓名");
  const user = { id: randomUUID(), name: data.name, email: data.email };
  try {
    await pool.query(
      "INSERT INTO qs_users(id,email,name,password_hash) VALUES($1,$2,$3,$4)",
      [user.id, user.email, user.name, await bcrypt.hash(data.password, 12)],
    );
  } catch (e) {
    if (e.code === "23505") fail(409, "该邮箱已经注册");
    throw e;
  }
  await loginSession(req, user);
  res.status(201).json({ user });
});
app.post("/api/auth/login", authLimit, async (req, res) => {
  const data = credentials.parse(req.body);
  const { rows } = await pool.query("SELECT * FROM qs_users WHERE email=$1", [
    data.email,
  ]);
  const row = rows[0];
  if (!row || !(await bcrypt.compare(data.password, row.password_hash)))
    fail(401, "邮箱或密码错误");
  const user = { id: row.id, email: row.email, name: row.name };
  await loginSession(req, user);
  res.json({ user });
});
app.post("/api/auth/logout", (req, res, next) =>
  req.session.destroy((e) => {
    if (e) return next(e);
    res.clearCookie("connect.sid", { path: cookiePath });
    res.json({ ok: true });
  }),
);
app.get("/api/surveys", auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.id,s.title,s.status,s.revision,s.updated_at,jsonb_array_length(s.document->'questions') AS question_count,(SELECT count(*)::integer FROM qs_comments c WHERE c.survey_id=s.id AND c.parent_id IS NULL AND NOT c.resolved) AS open_comments FROM qs_surveys s WHERE owner_id=$1 ORDER BY updated_at DESC`,
    [req.session.user.id],
  );
  res.json(rows);
});
app.post("/api/surveys", auth, async (req, res) => {
  const title = z.string().trim().min(1).max(200).parse(req.body.title);
  const id = randomUUID();
  await pool.query(
    "INSERT INTO qs_surveys(id,owner_id,title,document) VALUES($1,$2,$3,$4)",
    [id, req.session.user.id, title, newDocument(title)],
  );
  res.status(201).json({ id });
});
app.get("/api/surveys/:id", auth, async (req, res) =>
  res.json(withReviewUrl(await owned(req), reviewBaseUrl, basePath)),
);
app.put("/api/surveys/:id", auth, async (req, res) => {
  const document = documentSchema.parse(req.body.document);
  const revision = z.number().int().positive().parse(req.body.revision);
  await owned(req);
  const { rows } = await pool.query(
    `UPDATE qs_surveys SET document=$1,title=$2,revision=revision+1,updated_at=now() WHERE id=$3 AND owner_id=$4 AND revision=$5 AND status!='final' RETURNING *`,
    [document, document.title, req.params.id, req.session.user.id, revision],
  );
  if (!rows[0]) fail(409, "问卷已在其他页面更新或已经定稿，请重新加载后重试");
  res.json(withReviewUrl(rows[0], reviewBaseUrl, basePath));
});
app.post("/api/surveys/:id/duplicate", auth, async (req, res) => {
  const source = await owned(req);
  const id = randomUUID();
  const document = { ...source.document, title: source.title + "（副本）" };
  await pool.query(
    "INSERT INTO qs_surveys(id,owner_id,title,document,source_id,source_revision) VALUES($1,$2,$3,$4,$5,$6)",
    [
      id,
      req.session.user.id,
      document.title,
      document,
      source.id,
      source.revision,
    ],
  );
  res.status(201).json({ id });
});
app.post("/api/surveys/:id/review-link", auth, async (req, res) => {
  await owned(req);
  const token = randomBytes(24).toString("hex");
  const { rows } = await pool.query(
    `UPDATE qs_surveys SET review_token=$1,status=CASE WHEN status='draft' THEN 'review' ELSE status END,updated_at=now() WHERE id=$2 AND status!='final' RETURNING review_token,status`,
    [token, req.params.id],
  );
  if (!rows[0]) fail(409, "已定稿问卷不能重新开启审阅");
  res.json(withReviewUrl(rows[0], reviewBaseUrl, basePath));
});
app.delete("/api/surveys/:id/review-link", auth, async (req, res) => {
  await owned(req);
  await pool.query("UPDATE qs_surveys SET review_token=NULL WHERE id=$1", [
    req.params.id,
  ]);
  res.json({ ok: true });
});
app.post("/api/surveys/:id/finalize", auth, async (req, res) => {
  const revision = z.number().int().positive().parse(req.body.revision);
  const version = await transaction(async (client) => {
    await owned(req, client);
    const {
      rows: [s],
    } = await client.query("SELECT * FROM qs_surveys WHERE id=$1 FOR UPDATE", [
      req.params.id,
    ]);
    if (s.revision !== revision) fail(409, "问卷内容已变更，请重新加载后定稿");
    if (s.status === "final") fail(409, "问卷已经定稿");
    documentSchema.parse(s.document);
    const {
      rows: [counts],
    } = await client.query(
      "SELECT count(*)::integer AS count FROM qs_comments WHERE survey_id=$1 AND parent_id IS NULL AND NOT resolved",
      [s.id],
    );
    if (counts.count > 0) fail(409, "请先处理所有待解决批注再定稿");
    const {
      rows: [v],
    } = await client.query(
      "INSERT INTO qs_versions(id,survey_id,number,document) VALUES($1,$2,1,$3) RETURNING *",
      [randomUUID(), s.id, s.document],
    );
    await client.query(
      "UPDATE qs_surveys SET status='final',review_token=NULL,updated_at=now() WHERE id=$1",
      [s.id],
    );
    return v;
  });
  res.status(201).json(version);
});
app.get("/api/surveys/:id/versions", auth, async (req, res) => {
  await owned(req);
  const { rows } = await pool.query(
    "SELECT * FROM qs_versions WHERE survey_id=$1 ORDER BY number DESC",
    [req.params.id],
  );
  res.json(rows);
});
app.get("/api/surveys/:id/exports", auth, async (req, res) => {
  await owned(req);
  const { rows } = await pool.query(
    "SELECT e.*,v.number FROM qs_exports e JOIN qs_versions v ON e.version_id=v.id WHERE v.survey_id=$1 ORDER BY e.created_at DESC",
    [req.params.id],
  );
  res.json(rows);
});
app.post("/api/surveys/:id/exports", auth, async (req, res) => {
  await owned(req);
  const { platform, versionId } = z
    .object({ platform: z.enum(["wjx", "tencent"]), versionId: uuid })
    .parse(req.body);
  const {
    rows: [version],
  } = await pool.query(
    "SELECT * FROM qs_versions WHERE id=$1 AND survey_id=$2",
    [versionId, req.params.id],
  );
  if (!version) fail(404, "定稿版本不存在");
  const output = exportText(version.document, platform);
  const {
    rows: [record],
  } = await pool.query(
    "INSERT INTO qs_exports(id,version_id,platform) VALUES($1,$2,$3) RETURNING *",
    [randomUUID(), version.id, platform],
  );
  res.status(201).json({ ...output, record });
});
app.patch("/api/surveys/:id/exports/:exportId", auth, async (req, res) => {
  await owned(req);
  uuid.parse(req.params.exportId);
  const url = z.string().url().max(2000).parse(req.body.url);
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password)
    fail(400, "请输入 HTTPS 作答链接");
  const { rows } = await pool.query(
    "UPDATE qs_exports SET external_url=$1 WHERE id=$2 AND version_id IN(SELECT id FROM qs_versions WHERE survey_id=$3) RETURNING *",
    [url, req.params.exportId, req.params.id],
  );
  if (!rows[0]) fail(404, "导出记录不存在");
  res.json(rows[0]);
});
async function comments(s) {
  return (
    await pool.query(
      "SELECT * FROM qs_comments WHERE survey_id=$1 ORDER BY created_at",
      [s.id],
    )
  ).rows;
}
const commentSchema = z.object({
  targetId: z.string().max(100),
  quote: z.string().max(1000),
  revision: z.number().int().positive(),
  author: z.string().trim().min(1).max(60).optional(),
  body: z.string().trim().min(1).max(3000),
  parentId: uuid.nullable().optional(),
});
async function addComment(req, res, s, guest) {
  const comment = await transaction(async (client) => {
    const {
      rows: [current],
    } = await client.query("SELECT * FROM qs_surveys WHERE id=$1 FOR UPDATE", [
      s.id,
    ]);
    s = current;
    if (guest && s.review_token !== req.params.token)
      fail(404, "审阅链接无效或已撤销");
    if (s.status === "final") fail(409, "问卷已定稿，不能再添加批注");
    const data = commentSchema.parse(req.body);
    if (data.revision !== s.revision) fail(409, "问卷已更新，请刷新后重新批注");
    if (data.parentId) {
      const {
        rows: [parent],
      } = await client.query(
        "SELECT * FROM qs_comments WHERE id=$1 AND survey_id=$2 AND parent_id IS NULL",
        [data.parentId, s.id],
      );
      if (!parent) fail(400, "原批注不存在");
      data.targetId = parent.target_id;
      data.quote = parent.quote;
    } else {
      const text = targets(s.document).get(data.targetId);
      if (text === undefined || (data.quote && !text.includes(data.quote)))
        fail(409, "批注内容已变化，请刷新后重试");
    }
    const author = guest
      ? `${data.author || "匿名"}（访客）`
      : req.session.user.name;
    const {
      rows: [created],
    } = await client.query(
      "INSERT INTO qs_comments(id,survey_id,parent_id,target_id,quote,revision,author,body) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
      [
        randomUUID(),
        s.id,
        data.parentId || null,
        data.targetId,
        data.quote,
        s.revision,
        author,
        data.body,
      ],
    );
    return created;
  });
  res.status(201).json(comment);
}
app.get("/api/surveys/:id/comments", auth, async (req, res) =>
  res.json(await comments(await owned(req))),
);
app.post("/api/surveys/:id/comments", auth, async (req, res) =>
  addComment(req, res, await owned(req), false),
);
app.patch("/api/surveys/:id/comments/:commentId", auth, async (req, res) => {
  await owned(req);
  uuid.parse(req.params.commentId);
  const resolved = z.boolean().parse(req.body.resolved);
  const comment = await transaction(async (client) => {
    const {
      rows: [s],
    } = await client.query("SELECT * FROM qs_surveys WHERE id=$1 FOR UPDATE", [
      req.params.id,
    ]);
    if (s.status === "final") fail(409, "问卷已定稿");
    const { rows } = await client.query(
      "UPDATE qs_comments SET resolved=$1 WHERE id=$2 AND survey_id=$3 AND parent_id IS NULL RETURNING *",
      [resolved, req.params.commentId, s.id],
    );
    if (!rows[0]) fail(404, "批注不存在");
    return rows[0];
  });
  res.json(comment);
});
app.get("/api/review/:token", async (req, res) => res.json(await shared(req)));
app.get("/api/review/:token/comments", async (req, res) =>
  res.json(await comments(await shared(req))),
);
app.post("/api/review/:token/comments", async (req, res) =>
  addComment(req, res, await shared(req), true),
);
app.use("/api", (req, res) => res.status(404).json({ error: "接口不存在" }));
app.use(
  express.static(fileURLToPath(new URL("../dist", import.meta.url)), {
    setHeaders: (res) => res.set("Cache-Control", "public,max-age=3600"),
  }),
);
app.get("/{*path}", (req, res) =>
  res.sendFile(fileURLToPath(new URL("../dist/index.html", import.meta.url))),
);
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof z.ZodError)
    return res
      .status(400)
      .json({ error: error.issues[0]?.message || "输入格式错误" });
  if (error.code === "22P02")
    return res.status(400).json({ error: "无效的编号" });
  if (error.type === "entity.parse.failed")
    return res.status(400).json({ error: "无效的请求内容" });
  if (!error.status) console.error(error.message);
  res.status(error.status || 500).json({
    error: error.status ? error.message : "服务暂时不可用，请稍后重试",
  });
});
await migrate();
const server = hostApp.listen(Number(process.env.PORT) || 3001, "0.0.0.0", () =>
  console.log(
    `Question Studio listening on port ${process.env.PORT || 3001}${basePath || "/"}`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await pool.end();
      process.exit(0);
    }),
  );
