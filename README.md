# 问序 · Question Studio

部署在自己服务器上的问卷编辑与审阅单体应用。React + Vite 前端，Node.js / Express 后端，PostgreSQL 存储。生产环境由 Node 同时提供静态页面和 API。

## 已实现

- 邮箱与密码注册登录，bcrypt 密码哈希，PostgreSQL 持久化 Cookie 会话。
- 我的问卷列表、搜索、状态筛选、创建与复制。
- 标题、说明、单选、多选、单行文本、多行文本、1–5 评分题；必填、移动、删除及预览。
- 手动保存与修订号冲突检测；避免过期页面覆盖更新。
- 可撤销审阅链接；持有链接的访客可查看全部讨论，不能修改内容。
- 问卷、说明、题目、选项与预览文字划选批注；引用原文、稳定目标 ID、修订号，原内容变化后提示。
- 多人批注和回复每 5 秒轮询同步；作者标记解决或重新打开。
- 待处理批注清零后定稿；快照只读并撤销审阅链接；复制新草稿继续修改，记录来源问卷与来源修订号。
- 问卷星文本导出、腾讯问卷 DSL 文本导出，兼容性提示、复制与 TXT 下载。
- 保存导出记录并登记外部正式作答链接。
- 桌面三栏编辑器与移动端批注面板。

## 本地运行

需要 Node.js 22 和可连接的 PostgreSQL。复制 `.env.example` 为 `.env` 并填写数据库参数与随机会话密钥。本机 `.env` 已按会话中提供的连接信息配置，不应提交到版本库。

```powershell
npm ci
npm run db:migrate
npm run dev
```

打开 http://localhost:5173 ，注册自己的账号。没有预置管理员或默认密码。

应用使用 `qs_` 前缀的专属表，启动时执行幂等建表及增量字段迁移。数据库账号需拥有这些表的建表、读写权限。不会创建或删除整个数据库。

## 验证

先运行开发服务器。接口集成测试使用当前 `.env` 数据库，创建唯一测试账号与问卷，并在结束时删除自己创建的数据。

```powershell
npm test
npx playwright test
npm run build
```

浏览器测试使用本机 Chrome（`channel: chrome`），覆盖注册、创建、编辑、审阅访客、回复、解决、定稿及导出。测试截图和运行产物写入系统临时目录，可通过 `QA_SCREENSHOT_DIR` 指定截图位置。

## 服务器部署

```sh
npm ci
npm run build
NODE_ENV=production TRUST_PROXY=1 npm start
```

也可以使用 `docker compose up -d --build`。容器只将端口暴露给服务器本机 `127.0.0.1:3001`，由 HTTPS 反向代理对外提供服务。参考 `docs/nginx.conf.example` 修改域名和证书路径。生产环境使用 Secure Cookie，必须通过 HTTPS 访问。`TRUST_PROXY=1` 仅用于应用后面有自己控制的一层反向代理时。

健康检查：`GET /api/health`。会话存储在 PostgreSQL，应用重启后登录仍有效。数据库备份需要同时包含全部 `qs_` 表；环境密钥由部署环境保管。当前没有提供服务器 SSH 信息，所以代码和本机预览已准备好，尚未部署到公网服务器。

### 协作 / 审阅链接域名

在后端 `.env` 或部署环境变量中配置：

```dotenv
REVIEW_BASE_URL=https://review.example.com
```

重启后端后，审阅链接会使用 `https://review.example.com/review/<令牌>`，包括已生成链接在界面中的显示和复制。留空时使用当前页面所在域名与 `APP_BASE_PATH`。支持协议、域名、可选端口和应用子路径；仅填写域名时自动附加 `APP_BASE_PATH`，显式填写子路径则直接使用该子路径。生产环境请使用 HTTPS。

该域名必须完成 DNS 解析、HTTPS 证书和反向代理配置，指向本应用，且同时转发页面与 `/api` 请求；只填写配置不会自动配置 DNS 或申请证书。可将审阅域名与管理端域名都配置到同一应用。访客无需共享管理端的登录 Cookie 即可审阅。域名变更不更换令牌，也不会自动撤销旧域名上仍可访问的链接。

### 部署到 /questions 子路径

例如应用对外地址为 `https://app.chisato.space/questions/`，在同一份 `.env` 中配置：

```dotenv
APP_BASE_PATH=/questions
REVIEW_BASE_URL=https://app.chisato.space/questions
```

`REVIEW_BASE_URL` 也可留空，链接将沿用访问页面的域名。`APP_BASE_PATH` 默认 `/`，支持 `/apps/questions` 等多级路径；不包含域名、参数、编码字符或 `..`。前端 Vite 的资源前缀、页面导航、API 地址、后端路由挂载、会话 Cookie 路径和审阅链接统一使用该配置。Vite 的公开资源路径由 [base 配置](https://vite.dev/config/shared-options.html#base) 控制。

修改 `APP_BASE_PATH` 后需重新构建前端并重启后端，二者必须使用相同的值：

```sh
npm run build
NODE_ENV=production TRUST_PROXY=1 npm start
```

Docker 使用 `docker compose up -d --build`，Compose 会把同一个 `APP_BASE_PATH` 同时传给镜像构建与运行环境。直接 `docker build` 时需传 `--build-arg APP_BASE_PATH=/questions`，并在运行容器时设置相同环境变量。

Nginx 必须保留 `/questions` 前缀转发，`proxy_pass` 地址末尾不要加 `/`：

```nginx
location = /questions {
    return 308 /questions/;
}
location /questions/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

对应地址为首页 `/questions/`、接口 `/questions/api/...`、审阅 `/questions/review/<令牌>`，健康检查 `/questions/api/health`。直接打开或刷新问卷和审阅地址也受支持。完整服务器示例见 `docs/nginx-subpath.conf.example`。

## 导出边界

导出是单向迁移，不会登录第三方账号，不会自动发布，不同步第三方改动，也不收集正式答案。目标平台实际导入尚未通过你的第三方账号验收；发布前应在目标平台试填，核对文本、题型、必填与评分设置。

- 问卷星：[从文本创建问卷](https://www.wjx.cn/help/help.aspx?h=1&helpid=138)。长文本与量表需要检查或手动调整；必填设置逐题确认。
- 腾讯问卷：[批量编辑](https://cloud.tencent.cn/document/product/1304/135758)、[题型语法](https://wj.qq.com/docs/survey-dsl/content/scene-default/)、[题目设置语法](https://wj.qq.com/docs/survey-dsl/content/grammar/)。导出原始选项、单行/多行文本题型和必答/选答标记；需要在腾讯问卷中开启题目设置语法支持。引导语换行合并，正文半角方括号转全角并提示。

第一版不含跳题、条件显示、附件、富文本、邮箱验证、找回密码或组织角色管理。访客昵称不是已验证身份。定稿版本在每个独立问卷中编号 V1；后续修改通过新问卷与来源修订记录追溯。

## 目录

`src/`：React 界面；`server/`：API、校验、导出和数据库；`tests/`：单元、接口和浏览器测试；`docs/`：视觉参考与部署示例。
