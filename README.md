# bshhadmin · 助贷管理后台（PC 端）

面向**管理员 / 主管**的 PC 管理后台，独占两项关键能力：

1. **简道云凭证配置管理**（`GET/POST /api/jdy/config`）—— 把凭证写入与前台 `bshh` 共用的**共享配置文件**；
2. **连接测试 & 数据概览**（`/api/jdy/test`、`/api/jdy/customers`）。

> 配套前台仓库：[bshh](https://github.com/cc1334468602-oss/bshh.git)
> 后台在「简道云接口」页面填完凭证 → 写入共享配置文件 → **前台 `bshh` 无需重启即时生效**。

---

## 技术栈

- **后端**：零依赖 Node.js 原生 `http` / `https`，单文件 `server.js`，无需 `npm install`
- **前端**：纯静态 `HTML + CSS + 原生 JS`（PC 后台页面）
- **数据源**：简道云 v5 API

## 目录结构

```
bshhadmin/
├── index.html              # PC 后台入口（原 admin.html）
├── css/admin.css
├── js/
│   ├── admin.js           # 后台逻辑（仪表盘实时拉取 /api/jdy/customers）
│   └── data.js            # 员工 / 简道云用户 / 产品(12款) / 匹配规则（不含客户明细）
├── server.js              # 后台服务（独占配置写入与测试，端口默认 9192）
├── package.json
├── ecosystem.config.js
├── .env.example
├── .gitignore / .gitattributes
└── deploy/
    ├── bootstrap.sh       # 服务器首次部署（含交互式录入简道云凭证）
    ├── update.sh
    ├── precheck.sh
    └── nginx.conf         # 后台站点模板（含 IP 白名单 / Basic Auth 注释）
```

> 说明：客户明细数据**不再内置于 `data.js`**，改由后台 `/api/jdy/customers` 实时从简道云拉取，
> 这样既保证两端数据一致，也避免把客户敏感信息进仓库。

## 本地启动

```bash
node server.js
# 或 npm start
# 默认 http://127.0.0.1:9192
```

凭证配置两种方式（优先级从高到低）：

1. **共享配置文件**（`JDY_CONFIG_PATH` 指向的文件）—— 推荐，与前台共用；
2. **本仓库 `.env`**：`cp .env.example .env` 后填写。

## 与前台的联动

```
bshhadmin (9192)  ──POST /api/jdy/config──►  共享配置文件
                                                     │
                                          bshh (9191) 每次请求实时读取
```

- 后台 `POST /api/jdy/config` → `saveConfig()` 把 `{apiKey, appId, entries}` 写入共享文件（权限 `0o600`）；
- 前台请求时 `loadConfig()` 实时读取该文件，凭证一改前台立即生效；
- 后台 `GET /api/jdy/config` **只返回 `hasApiKey` 标记与 `appId`，绝不回传明文 API Key**。

## 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/health` | 健康检查，返回 `jdyReady` 与 `configPath` |
| GET  | `/api/jdy/config` | 读取配置（**不含明文 apiKey**） |
| POST | `/api/jdy/config` | 写入配置（**后台独占**），写入后前台即时生效 |
| POST | `/api/jdy/test` | 简道云连接测试（用客户表单试拉 1 条） |
| POST | `/api/jdy/customers` | 客户概览（total + 按状态分布 byStatus） |

## 安全要点（后台更敏感）

- **禁止通过 HTTP 读取配置文件**：请求路径含 `jdy-config.json` 或 `.env` 一律返回 `403`；
- 配置文件写入后 `chmod 600`，仅运行用户可读；
- 简道云 API Key 不进代码、不进 Git、不在任何回显接口返回明文；
- 生产环境 Nginx 必须对后台加 **IP 白名单（`allow/deny`）或 Basic Auth**（`deploy/nginx.conf` 已留模板）；
- 强烈建议：在简道云开放平台给 API Key 配 **ECS 公网 IP 白名单**，并定期轮换；
- 推送前务必 `bash deploy/precheck.sh`。

## 部署

1. 首次：`bash deploy/bootstrap.sh`（交互式录入简道云凭证 → 写入共享配置 → 配置 Nginx → PM2 启动）；
2. 后续：`bash deploy/update.sh`；
3. 后台站点必须置于内网或加访问控制，切勿裸奔公网。

详见 `deploy/nginx.conf` 注释与 `bshh` 仓库的部署说明。
