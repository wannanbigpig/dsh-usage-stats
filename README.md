# dsh-usage-stats

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 网页端（`dsh web`）提供的用量与计费插件：侧栏「用量/余额」查询中心展示 **DeepSeek 官方账户余额**、**Token 用量/贡献热图/按小时统计**；设置页提供独立的「用量与计费」配置入口。查询与配置分离：弹窗只读，会改变计费或调用行为的设置全部在设置页。支持**切换 API Key** 和**切换模型**。

DeepSeek official balance, token usage, a contribution heatmap, and per-hour statistics for the DeepSeek Harness Web GUI — opened from a dedicated sidebar action with model and API-key switchers.

## 功能 / Features

| | 能力 | 说明 |
| --- | --- | --- |
| 💳 | DeepSeek 官方余额 | `GET /user/balance`，展示总余额、充值余额、赠送余额，可切换多个 API Key |
| 🧭 | 独立侧栏入口 | 使用 Harness 原生 `sidebar.footer.action`；宽侧栏直接显示余额与今日消费，点击打开 760px 响应式查询中心 |
| 🗂️ | 查询中心双标签 | 「概览」：余额卡、四张摘要卡、年度热图、按小时统计；「明细」：模型筛选与按日明细，弹窗内不含任何配置表单 |
| ⚙️ | 独立设置入口 | 使用 Harness 原生 `settings.section` 注册「设置 → 用量与计费」，承载限额等配置；弹窗提供「前往设置」链接 |
| 📊 | Token 用量统计 | 今日 / 本月 / 累计 Token，按 `provider/model` 归集，缓存命中率 |
| 🟩 | 贡献热图 | GitHub Contributions 风格按自然年展示每日 Token 强度，右上角可切换年份 |
| ⏱️ | 按小时统计 | 选中日期的 24 小时输入/输出柱状图；悬停显示 Token、费用和模型明细，高峰时段自动标注 |
| 💰 | 消费金额 | 估算消费（CNY，可配置模型单价）；费用按**请求完成时间（usage 上报时间）**归属小时与峰谷，与 DeepSeek 官方账单口径一致 |
| ⚠️ | 用量提醒与限额 | 每日消费限额 + 最低余额保障 + 预警百分比，**按 API Key 独立配置** |
| 🛑 | 超限停止调用 | 默认仅提醒；显式开启 `stopOnExceed` 后，今日消费达到限额的严重预警比例（默认 90%，设置页可调）即在 `agent/request` / `llm/stream` 拦截模型调用 |
| 🔑 | 按 API Key 统计 | `keyProviders` 把 provider 路由映射到具体 Key，今日消费按 Key 归集、限额按 Key 判定 |
| 🔄 | 后台监测 | 服务端启动即刷新，之后每 5 分钟更新余额与本地 Token 聚合 |
| 🔒 | 本机安全边界 | 端点仅接受回环请求（GET / limits 支持 POST）；API Key 只在服务端解析，绝不进入浏览器或日志 |

界面支持中文和英文。Token 数据来自会话事件中的 provider-reported `usage`（`assistant/chunk` 或 `assistant/message`），不是本地估算；「消费金额」是根据模型单价 × Token 数计算的**估算值**，请以 DeepSeek 官方账单为准。统计、限额判定与「今日」口径均按**北京时间**（服务端下发 `today` 字段，客户端优先使用），机器或浏览器时区不是 UTC+8 也保持一致。

## 快速安装 / Quick start

需要 DeepSeek Harness `web` profile（`@deepseek-ai/dsh >= 0.1.0-rc.7`，`dsh plugin` 子命令自该版本引入）与 [pnpm](https://pnpm.io/installation)（`dsh plugin` 会把参数转发给 profile 目录里的 pnpm，因此所有 pnpm 子命令都可用）。

**本地 checkout 安装（开发推荐）**：在**包含插件目录的父目录**中执行（官方文档：从包含该包的目录运行），或已在插件根目录内用 `.`：

```bash
# 在 dsh-usage-stats 的父目录中执行
dsh plugin --profile web add ./dsh-usage-stats

# 或者已进入插件根目录
cd dsh-usage-stats
dsh plugin --profile web add .
```

目录路径安装会生成 `link:`（符号链接）依赖：改动插件代码**无需重新安装**，**重启正在运行的 `dsh web`** 并在浏览器硬刷新（Cmd/Ctrl+Shift+R）即可生效；侧栏底部会出现独立的「用量/余额」入口。

**从 GitHub 安装**（npm 未发布，`package.json` 为 `private`；也可以先 `npm pack` 再 `dsh plugin --profile web add ./dsh-usage-stats-0.1.0.tgz`）：

```bash
dsh plugin --profile web add github:wannanbigpig/dsh-usage-stats
```

**升级或卸载**（`update` 只对 GitHub/npm 安装的副本有意义；本地 `link:` 安装始终指向本地目录，直接 `git pull` 后重启 `dsh web` 即可）：

```bash
dsh plugin --profile web update dsh-usage-stats
dsh plugin --profile web remove dsh-usage-stats
```

## 凭据 / Credentials

插件通过 Harness 凭据服务读取 API Key，不会读取、创建或修改凭据文件，也绝不把 Key 发送到浏览器。把 Key 写入 `~/.dsh/.credentials.yaml`（或设置 `DSH_HOME` 后对应的目录）：

```yaml
# ~/.dsh/.credentials.yaml
DEEPSEEK_API_KEY: sk-your-key-here
```

默认读取 `DEEPSEEK_API_KEY`。多个账号 / 多个 API Key 时，在插件配置里追加凭据引用（名称即可，不要写 Key 值）：

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- insert:
    - id: usage-stats
      name: dsh-usage-stats
      config:
        keys:
          - DEEPSEEK_API_KEY
          - DEEPSEEK_API_KEY_2   # 第二个账号的凭据引用
```

浮层顶部的余额卡片会显示「API Key」下拉框，可在多个 Key 之间切换（余额按所选 Key 查询）。Token 统计来自本机会话日志，日志不记录「用哪个 Key」，但记录 provider 路由 —— 配置 `keyProviders` 后，今日消费会按 Key 精确归集，限额也按 Key 判定（见下）。

## 配置 / Configuration

所有配置都是可选的，默认值即可开箱使用：

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `keys` | `string[]` | `["DEEPSEEK_API_KEY"]` | 余额查询使用的凭据引用列表 |
| `defaultKeyRef` | `string` | `DEEPSEEK_API_KEY` | 默认选中的 Key |
| `baseURL` | `string` | `https://api.deepseek.com` | DeepSeek API 地址（`/user/balance` 相对此地址） |
| `refreshMs` | `number` | `300000` | 余额与用量后台刷新间隔（毫秒，最小 5000） |
| `pricing.pricing` | `object` | 见下 | 模型单价（CNY / 1M tokens）覆盖 |
| `pricing.peakMultiplier` | `number` | `2` | 官方高峰时段价格为空闲时段的 2 倍 |
| `pricing.peakHours` | `[start,end)[]` | `[[9,12],[14,18]]` | 官方高峰时段，北京时间 09:00–12:00、14:00–18:00 |
| `pricing.currency` | `string` | `CNY` | 消费金额显示货币；与 DeepSeek 中国区余额默认币种保持一致 |
| `keyProviders` | `object` | `{}` | Key → provider 路由列表；开启后今日消费按 Key 归集、限额按 Key 判定 |
| `allowInsecure` | `boolean` | `false` | 允许非 HTTPS `baseURL`（不推荐） |

### 按 API Key 统计（keyProviders）

会话日志不记录「用哪个 API Key」，但每个请求都记录 provider 路由。把 provider 映射到对应的 Key，插件就能把今日消费精确归集到每个 Key，并按 Key 执行限额：

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- insert:
    - id: usage-stats
      name: dsh-usage-stats
      config:
        keys:
          - DEEPSEEK_API_KEY
          - DEEPSEEK_API_KEY_2
        keyProviders:
          DEEPSEEK_API_KEY: [deepseek-official, vision-toolkit-deepseek-official]
          DEEPSEEK_API_KEY_2: [my-relay]        # 你在设置页配置的第二个 provider id
```

未在映射中的 provider 归到 `defaultKeyRef`。**未配置 `keyProviders` 时**，所有 Key 共享全局今日消费（此时每个 Key 的每日限额按总额判定）。余额始终按所选 Key 单独查询。

### 用量提醒与限额（设置 → 用量与计费）

「设置 → 用量与计费」页面承载限额配置（已从查询弹窗迁出，弹窗保持只读）。可**按 Key（或全局）**配置：

- **启用限额**：开关。
- **每日消费限额**（CNY）：今日估算消费达到限额 × `alertPercent`（默认 80%）→ 黄色预警；达到限额 × `criticalPercent`（默认 90%）→ 红色已超限，即硬停止的触发点（并非等到 100% 限额）；两个比例都可在设置页调整。
- **余额提醒线**：新鲜余额低于该值 → 预警；余额过期或查询失败时显示灰色状态且 fail-open。
- **预警百分比**：50% / 70% / 80% / 90% / 95%。
- **超限停止调用**：默认关闭，仅提醒；用户显式开启后，今日消费达到限额 × `criticalPercent`（默认 90%，设置页可调）即视为已超限，在 `agent/request` 与 `llm/stream` 拦截新的模型调用（抛出 `UsageLimitExceededError`，消息会提示去调整限额）。余额查询失败或快照过期时，最低余额规则 fail-open，不会阻断调用。

限额保存在 `~/.dsh/storages/usage-limits.json`，当前 schema 为 v2。旧 v1 文件会安全迁移：保留提醒规则，但不会自动继承旧 `stopOnExceed` / `minBalance` 为硬停止；用户需在设置页重新确认开启。v2 会拒绝未知配置字段。**规则解析采用全局兜底**：某个 Key 未设置数值（或仅有空壳规则）时，沿用全局限额；Key 设置了数值则覆盖全局、未设置的字段继续继承全局，因此全局限额始终是底线，不会被空壳 Key 规则静默绕过。拦截采用 **fail-open** 策略：限额检查本身出错时放行调用，绝不因插件故障阻塞模型。

状态统一为 `normal / warning / exceeded / blocked / stale / unavailable`。侧栏状态点与设置页读取同一个 `/limits` 状态源；告警只在状态跨越或冷却到期时触发，恢复正常时生成一次恢复事件，避免每次轮询或模型请求重复提醒。

默认单价（CNY / 1M tokens，严格对应 DeepSeek 官方中文价格页，2026-08）：

| 模型 | 命中·空闲 | 命中·高峰 | 未命中·空闲 | 未命中·高峰 | 输出·空闲 | 输出·高峰 |
| --- | --- | --- | --- | --- | --- | --- |
| `deepseek-v4-flash` | 0.05 | 0.10 | 1.5 | 3 | 4.5 | 9 |
| `deepseek-v4-pro` | 0.15 | 0.30 | 4.5 | 9 | 13.5 | 27 |
| 未配置模型 | — | — | — | — | — | — |

高峰时段为北京时间 09:00–12:00、14:00–18:00，其余为空闲时段；高峰单价为空闲单价的 2 倍。未识别模型仍显示 Token，但费用显示 `—`，不会静默套用其他模型价格。官方价格可能调整，请定期对照 <https://api-docs.deepseek.com/zh-cn/quick_start/pricing/>；可在 `pricing.pricing` 中按模型 id 覆盖。

## 使用 / Usage

1. 侧栏底部 **用量/余额** 会直接显示默认账户余额与今日消费：查询面板打开时每分钟刷新，关闭时每 5 分钟刷新；点击整行打开查询中心，窄侧栏模式只显示数据图标。
2. 查询中心分「概览 / 明细」两个标签：概览 = 余额卡、四张摘要卡、年度每日用量热图、按小时统计与所选日期模型摘要；明细 = 模型筛选与最近日期按日明细（点击日期可联动概览小时图）。
3. 顶部余额卡片：DeepSeek 官方余额 + 充值/赠送明细；多个 Key 时可切换；右上角刷新时图标会持续旋转到请求结束，旁边有「前往设置」链接。余额查询失败会缓存错误快照并在 `refreshMs`（默认 5 分钟）内复用，网络错误时余额显示「暂不可用」。
4. 「年度每日用量」：默认只展示今年 1–12 月；右上角切换年份，悬停查看日期与 Token，点击方块联动当天明细。
5. 「按小时统计」：展示所选日期的 24 小时输入/输出柱状图；零用量小时不渲染数据柱，高峰时段以跨全图的浅色背景区段提示；鼠标悬停、键盘聚焦或触屏点击某小时可查看总 Token、输入、输出、缓存、费用和模型拆分。费用与 Token 按**请求完成时间（usage 上报时间）**（北京时）归入对应小时：跨整点边界的流式请求同样按完成时间归属（如 17:59 发起、18:01 完成的请求计入 18 点小时并按空闲价计费，而不是计入 17 点高峰价），与官方账单口径一致。
6. 限额等配置请在「设置 → 用量与计费」中操作，按 Key（或全局）配置每日消费限额、余额提醒线、预警百分比与是否超限停止调用；开启硬停止时必须二次确认。

## 官方 tokenizer 离线计算

实际请求统计始终使用模型响应中的 provider-reported `usage`。这是账单与缓存命中最接近的口径；离线 tokenizer 只能计算传入的可见文本，无法还原服务端 system prompt、工具定义、缓存读写或隐藏推理 Token，因此不会混入余额与费用统计。

若已从 DeepSeek 官方文档下载 `deepseek_v3_tokenizer`，可用其 `tokenizer.json` 与 `tokenizer_config.json` 做离线文本计算（离线计数默认**不含 BOS/EOS 等特殊 token**）：

```bash
npm run tokens -- \
  --tokenizer-dir /Users/liuml/Downloads/deepseek_v3_tokenizer \
  --json 'token 用量计算'
```

也可通过环境变量 `DEEPSEEK_TOKENIZER_DIR` 指定目录，或从 stdin 输入文本。该实现使用 Hugging Face 的 `@huggingface/tokenizers` 直接读取官方文件，不需要 Python `transformers`。

## 数据与隐私 / Privacy

- API Key 只在服务端凭据服务中解析，响应中只有余额数值，没有任何 Key。
- 端点仅接受回环地址请求（peer socket 校验 + Host 二次校验）；`usage` / `keys` / `balance` 仅 GET，`limits` 支持 GET/POST（本机设置写入）。非允许方法返回 405，非回环返回 403。
- 用量缓存 `~/.dsh/storages/usage-stats-cache.json` 保存两部分：**调用级账本**（每次模型请求的稳定 ID、发起时间 occurredAt、完成时间 completedAt、provider/model、usage、当次 `costCny` 和 `pricingVersion`；统计归属按完成时间，缺失时回退发起时间，流结束后立即原子落盘）和 **legacy 快照**（切换前或账本截断时折叠的历史聚合，无请求时间明细、费用按当前价格估算，展示时保留但不伪装精确账单）；账本设有上限——条目超过 5000 条时最旧的条目折叠进 legacy 快照并截断账本，不会无限增长。不保存提示词、回复或文件路径。限额配置 `~/.dsh/storages/usage-limits.json` 只保存限额数值与开关。
- 本机反向代理会让插件看到代理自身的回环地址；请勿把端点经反向代理暴露到局域网或公网。

## API

| Method | Path | Response |
| --- | --- | --- |
| `GET` | `/api/usage-stats/usage` | 按日期/小时/模型聚合的 Token、缓存命中率与估算费用（含 `pricing` 配置）；费用按请求完成时间（usage 上报时间）归属小时与峰谷 |
| `GET` | `/api/usage-stats/keys` | 已配置的 API Key 凭据引用列表（仅名称，不含值） |
| `GET` | `/api/usage-stats/balance?key=<ref>&refresh=1` | 所选 Key 的 DeepSeek 官方余额快照 |
| `GET` | `/api/usage-stats/limits` | v2 限额配置 + 每个 Key 的统一实时状态及告警跨越/冷却/恢复元数据 |
| `POST` | `/api/usage-stats/limits` | 保存限额配置（本机回环），返回最新状态 |

## 开发与验证 / Development

```bash
npm install
npm test
npm pack --dry-run
```

`npm test` 完全离线，覆盖：
- `scripts/test-usage.mjs`：折叠语义（替换不重复计数、跨日移动）、小时桶、费用计算、真实会话日志折叠（设置 `DSH_SESSION_LOG` 指向 `session.jsonl` 可复现）；
- `scripts/test-tokenizer.mjs`：`tokenizer.json` / `tokenizer_config.json` 加载、编码计数与缺失文件错误；
- `scripts/test-server.mjs`：配置校验、路由注册、余额缓存与单飞、凭据不泄露、v1→v2 限额迁移、统一状态机、阻断/fail-open、告警冷却与恢复；
- `scripts/smoke-client.mjs`：客户端 bundle、侧栏入口、自然年贡献热图、小时悬停浮层、刷新动画、统一状态映射与硬停止二次确认。

真实数据验证需先运行 `dsh web`，然后打开「用量/余额」浮层或：

```bash
curl -s http://127.0.0.1:3080/api/usage-stats/usage | head -c 400
curl -s http://127.0.0.1:3080/api/usage-stats/balance
```

## License

[MIT](LICENSE)
