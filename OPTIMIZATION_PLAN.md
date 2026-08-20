# dsh-usage-stats 优化与功能扩展方案

> 版本：0.2 · 2026-08-19
> 状态：已评审并精简
> 范围：除「导出 CSV/JSON」外的全部优化项与功能扩展（导出已单独推进，本文档不再展开）。
> 关联文档：`.aitasks/usage-billing-optimization-handoff.md`（设计交接，简称「交接文档」）、`.aitasks/lessons.md`（经验库）。

### 评审结论（本次已移除项）

| 移除项 | 原优先级 | 移除理由 |
| --- | --- | --- |
| E 多 Provider 余额 | 中 | 插件定位 DeepSeek 专用；New API / OpenRouter 需真实 Key 逐个联调、收益存疑，交接文档本就将其延后 |
| F 会话级费用 | 中 | 硬阻塞在 `llm/stream` payload 是否携带稳定会话 id 的未知契约，需先核对再定，当前不做 |
| G 消费趋势与预算预测 | 低 | 外推预测易误导、低价值，与「精确账单」定位相悖 |
| H 官方价格同步提醒 | 低 | 抓取官方页结构易变、风险高；有价值的「checkedAt 展示」已并入 B 项 |
| M CI / lint | 中 | 非用户侧价值；lint 引入有存量重排风险，可作为独立事项另行推进 |

## 1. 背景与目标

插件当前已具备侧栏「用量/余额」查询中心（余额卡、四摘要卡、年度热图、小时图、按日明细）与独立「设置 → 用量与计费」页（当前仅含限额配置 `LimitsCard`），服务端已实现 4 个回环端点、调用级账本（`lib/ledger.js`）、价格版本（`lib/pricing.js`）、限额状态机与 `agent/request` / `llm/stream` 拦截。

对照交接文档的阶段划分，**阶段 0–3 已基本落地**，但存在两类缺口：

1. **阶段 4 未完成**：设置页只做了「预算与限额」一个标签，账户、价格、通知、数据管理四块缺失。
2. **工程债**：定价双源、价格表只覆盖 2 个模型、注释过时、发布包缺脚本、账本上限硬编码等。

阶段 5 的可选扩展（多 Provider、会话级费用、消费趋势、价格同步提醒）经评审已从范围移除，理由见文首评审结论；如后续出现真实需求再单独评估。

本文档把以上内容整理为可执行的方案，供分阶段实施。

## 2. 现状盘点

### 2.1 已完成（不重复建设）

| 能力 | 位置 |
| --- | --- |
| 侧栏入口 + 查询中心（只读） | `lib/client.js` `UsageStatsPanel` / `sidebar.footer.action` |
| 设置页注册 + 限额配置 | `lib/client.js` `UsageBillingSettingsSection` / `LimitsCard` / `settings.section` |
| 余额查询（纯模块 + scheme 抽象） | `lib/balance.js` |
| 调用级账本（冻结费用/价格版本，按完成时间归属） | `lib/ledger.js` |
| 价格版本 + 峰谷归一化 | `lib/pricing.js` |
| Token 聚合 + 费用估算 | `lib/usage.js` |
| 限额 schema / 状态机 / 告警去重 | `lib/index.js` `createLimitsService` / `createAlertTracker` |
| 服务端端点（usage/keys/balance/limits） | `lib/index.js` |
| 离线 tokenizer CLI | `lib/tokenizer.js` / `scripts/count-tokens.mjs` |

### 2.2 待办缺口

| # | 缺口 | 类型 | 优先级 |
| --- | --- | --- | --- |
| A | 设置页「账户与余额」标签 | 阶段 4 功能 | 高 |
| B | 设置页「价格设置 + 官方差异预览」标签 | 阶段 4 功能 | 高 |
| C | 设置页「通知与提示」标签 | 阶段 4 功能 | 中 |
| D | 设置页「数据管理」标签（保留/清理/重建，导出除外） | 阶段 4 功能 | 高 |
| I | 定价双源收敛为单一来源 | 工程债 | 高 |
| J | 价格表扩充在售模型 | 工程债 | 高 |
| K | `index.js` 头部注释过时 | 工程债 | 低 |
| L | 发布包缺失 `scripts/`（npm 安装后 `npm run tokens` 不可用） | 工程债 | 中 |
| N | 账本上限 5000 硬编码、溢出降级无感知 | 工程债 | 中 |
| O | `exports` 缺 `./pricing` | 工程债 | 低 |

## 3. 详细方案

---

### A. 设置页「账户与余额」标签（优先级：高）

**目标**：把账户/余额来源、Key 归属、刷新周期、侧栏展示开关从查询弹窗与配置散点收拢到设置页第一个标签。

**现状**：
- `lib/client.js` `UsageBillingSettingsSection` 仅渲染 `LimitsCard`。
- 余额轮询周期服务端写死 `DEFAULT_REFRESH_MS = 300000`（`lib/index.js:48`）。
- 侧栏状态点/摘要展示策略无开关，全量展示。

**方案**：
1. 新增 `AccountsCard` 组件，承载：
   - 默认账户 / API Key 引用选择（复用 `lib/index.js` `configuredKeys` 与 `resolveCredential`，只展示 ref 名与配置状态，绝不展示 Key 值）。
   - Provider → API Key 归属映射（`keyProviders`，`lib/index.js:870` `keyForProvider`）。
   - 余额刷新周期（下拉：关闭 / 1min / 5min / 15min / 30min）。
   - 侧栏展示开关：余额、今日消费、状态点 各自独立开关。
   - 手动刷新余额按钮 + 最近成功时间 / 最近失败原因 / 是否过期（余额快照 `fetchedAt/stale/status` 已在 `balance.js` / `createBalanceService` 落位）。
2. 服务端新增 `/api/usage-stats/accounts`（GET 读配置 + 余额快照状态，POST 写刷新周期与展示开关，loopback fence 沿用 `rejectForeignCaller`）。
3. `startBackgroundRefresh` 改为读取配置中的刷新周期（`lib/index.js:702`），支持关闭（关闭后仅查询时按需刷新）。

**涉及文件**：`lib/client.js`、`lib/index.js`、`lib/balance.js`（快照协议已具备，微调）。
**验证**：`scripts/test-server.mjs` 增 accounts 路由/刷新周期契约测试；`scripts/smoke-client.mjs` 增 AccountsCard 渲染契约。
**风险**：刷新周期变更需同步 `SIDEBAR_POLL_MS_OPEN/CLOSED`（`lib/client.js:2025` 附近）与 `startBackgroundRefresh`，避免两套节奏打架。

---

### B. 设置页「价格设置 + 官方差异预览」标签（优先级：高）

**目标**：官方价格为只读基线，用户可「复制为自定义方案」后编辑；提供官方/自定义差异预览与恢复默认；价格变更不得漂移历史费用。

**现状**：
- `lib/pricing.js` 已支持版本化 schema（`id/name/currency/timezone/windows/models/mode`）、legacy `pricing/peakHours/peakMultiplier` 兼容、`normalizePricing`。
- 账本已冻结 `costCny/pricingVersion`（`lib/ledger.js` `freezeLedgerEntry`），历史不漂移的底层已具备。
- 但 UI 无任何价格编辑入口；`validateConfig`（`lib/index.js:176`）只读入配置，无写入端点。

**方案**：
1. 新增 `PricingCard` 组件：
   - 官方价格表（`defaultPricingVersion()` 的 `models`）只读展示，含来源 URL、核对时间（`checkedAt`）、版本、生效时间。
   - 「复制为自定义方案」→ 生成可编辑副本（需命名 + 生效时间）。
   - 每模型编辑：空闲缓存命中输入 / 空闲缓存未命中输入 / 空闲输出 / 高峰三价；时区固定 `Asia/Shanghai`，高峰窗口固定 `09–12 / 14–18`。
   - 差异预览：官方 vs 自定义逐模型对比，高亮差异单元格。
   - 「恢复官方价格」。
2. 服务端新增 `/api/usage-stats/pricing`（GET 当前方案 + 官方基线，POST 保存自定义方案，POST action=restore 恢复默认），沿用 `readJsonBody` + loopback fence。
3. `validateConfig` 增加对 `mode/custom` 方案的结构校验（`normalizePricing` 已兜底，补严格模式校验）。

**涉及文件**：`lib/client.js`、`lib/index.js`、`lib/pricing.js`。
**验证**：`scripts/test-usage.mjs` 补「价格生效时间前后历史稳定」测试（账本冻结价不随当前价格变）；`scripts/test-server.mjs` 补 pricing 端点契约与恢复默认；`scripts/smoke-client.mjs` 补 PricingCard 差异预览契约。
**风险**：自定义价格写入后，`renderLedger` 的 legacy 估算仍按当前价格渲染——须在 UI 明确「历史估算」标识（已具备 `updatedAt` 标注，需前端强化提示文案）。

---

### C. 设置页「通知与提示」标签（优先级：中）

**目标**：把告警事件从「静默去重」升级为「用户可配置的通知策略」。

**现状**：
- 服务端 `createAlertTracker`（`lib/index.js:1143`）已实现状态跨越 / 冷却 / 恢复去重，产生 `shouldNotify/type/at` 事件，但**无任何输出通道**，事件被丢弃。
- 前端只有侧栏状态点（被动展示），无 Toast / 系统通知。

**方案**：
1. 新增 `NotificationsCard` 组件：
   - 通道开关：侧栏状态点 / Harness Toast（系统通知不在本期范围）。
   - 事件开关：预警、超限、余额不足、恢复正常 各自独立。
   - 冷却时间配置（默认 30min）。
   - 告警历史列表（时间、账户、阈值、当前值、动作结果）。
2. 服务端：`evaluateAll` 产出的告警事件按通知策略写入内存环形告警历史（上限如 200 条），并随 `/api/usage-stats/limits` 或新 `/api/usage-stats/alerts` 下发；Toast 由客户端轮询 `evaluateAll` 结果触发（复用现有 60s/5min 轮询）。
3. 通知策略持久化到 limits 存储或独立 `alerts` 存储。

**涉及文件**：`lib/client.js`、`lib/index.js`。
**验证**：`scripts/test-server.mjs` 补告警历史与冷却配置契约；`scripts/test-usage.mjs` 已覆盖 `createAlertTracker` 去重逻辑，补策略过滤。
**风险**：系统通知需浏览器权限，跨平台差异大，不在本期范围；只做侧栏 + Toast。

---

### D. 设置页「数据管理」标签（优先级：高，导出除外）

**目标**：让用户了解并控制数据保留、重建与清理；明确「provider usage 是统计真值、离线 tokenizer 只估算可见文本」的口径。

**现状**：
- 账本上限 `DEFAULT_MAX_LEDGER_ENTRIES = 5000` 硬编码（`lib/index.js:1179`），溢出折叠进 legacy 快照后从精确落账降级为估算，**用户无感知、无配置**。
- 无数据保留天数、无重建聚合、无清除历史能力（交接文档 §6.3.E 明确要求）。
- 缓存 v2（账本 + legacy 快照）已支持原子写与降级（`loadCache`/`saveCache`）。

**方案**：
1. 新增 `DataCard` 组件：
   - 数据保留天数（联动账本上限与 legacy 快照裁剪）。
   - 当前聚合数据大小、日期范围、账本条目数、legacy 估算区间。
   - 「重建聚合」（从账本 + legacy 重新 render，不改原始数据）。
   - 「清除缓存 / 清除历史」（二次确认，清除后账本与快照重置）。
   - 离线 tokenizer 目录状态 + 口径说明（provider usage vs 本地估算）。
   - （导出 CSV/JSON 已在别处推进，本文档不含。）
2. 服务端新增 `/api/usage-stats/data`（GET 元信息，POST 执行 rebuild/clear/trim，动作需显式 `action` 字段 + 危险操作二次确认由前端承载）。
3. 账本上限改为可配置：`maxLedgerEntries` 读自配置，`compactLedger` 折叠时在快照上打「含精确账本折叠」标记，UI 展示「近 N 条为精确、更早为估算」。

**涉及文件**：`lib/client.js`、`lib/index.js`、`lib/ledger.js`（微调折叠标记）。
**验证**：`scripts/test-server.mjs` 补 data 端点（元信息/重建/清理）与保留天数裁剪契约；`scripts/test-usage.mjs` 补 `compactLedger` 折叠标记。
**风险**：清除历史不可逆——必须二次确认且后端对 `clear` 动作做独立校验，防止误触发；重建聚合不得改变账本冻结价。

---

### I. 定价双源收敛（优先级：高，工程债）

**现状**：
- 模型单价硬编码两处：`lib/usage.js:305`（`defaultPricing()`）与 `lib/pricing.js:22`（`defaultPricingVersion()`）。
- `lib/index.js:203` 里 `merged = defaultPricing()` 又回灌 `normalizePricing` 二次归一，链路绕。

**方案**：
1. 让 `lib/pricing.js` 成为唯一价格真源：`defaultPricingVersion()` 维护官方峰谷价。
2. `lib/usage.js` 的 `defaultPricing()` 改为薄转发：`return normalizePricing(defaultPricingVersion())`，或直接 `import { defaultPricing }` 自 `pricing.js` 并删除本地定义。
3. 删除 `lib/index.js` 里对 `defaultPricing()` 的二次归一（`merged` 逻辑），改为直接 `normalizePricing(rawConfig.pricing ?? defaultPricingVersion())`。
4. 全量跑 `npm test` 确认行为一致（尤其 `test-usage.mjs` 的峰谷/单价断言）。

**涉及文件**：`lib/usage.js`、`lib/pricing.js`、`lib/index.js`。
**验证**：`npm run check` + `npm test`，重点核对 `defaultPricing()` 与 `normalizePricing(defaultPricingVersion())` 输出一致。
**风险**：低，但涉及计费基础，必须全量回归；`exports` 若有外部消费者引用 `usage.js` 的 `defaultPricing`，保留转发保持兼容。

---

### J. 价格表扩充在售模型（优先级：高，工程债）

**现状**：`lib/pricing.js:22` 只覆盖 `deepseek-v4-flash/pro`；`deepseek-chat`、`deepseek-reasoner`（v3 在售线）无价格映射，费用显示 `—`（行为正确但体验缺）。

**方案**：
1. 核对 DeepSeek 官方价格页（`OFFICIAL_PRICING_SOURCE`），把在售模型（含 v3 系 `deepseek-chat` / `deepseek-reasoner` 及 v4 全系）的峰谷价补进 `defaultPricingVersion().models`。
2. `checkedAt` 更新为核对当日。
3. 价格表以官方口径为准，不臆造未上架模型价格。

**涉及文件**：`lib/pricing.js`。
**验证**：`npm test`（`test-usage.mjs` 若有模型清单断言需同步更新）；人工核对官方页。
**风险**：价格核对错误会直接导致计费误差——必须按官方页逐行确认，本文档不臆造具体单价。

---

### K. 头部注释过时（优先级：低）

**现状**：`lib/index.js:4` 写 "Registers three read-only, loopback-only endpoints"，实际 4 个端点且 `/limits` 支持 POST。

**方案**：更新头部注释为 4 端点（usage/keys/balance/limits），并标注 limits 支持 POST；同步 README 端点表。

**涉及文件**：`lib/index.js`、`README.md`。
**验证**：`npm run check`。
**风险**：无。

---

### L. 发布包缺失 `scripts/`（优先级：中）

**现状**：`package.json` `files` 只含 `lib/ assets/ cordis.patch.yml README LICENSE`；`npm run tokens`（离线 tokenizer CLI）依赖 `scripts/count-tokens.mjs`，npm 安装的包内缺失。

**方案**：
1. 明确 `tokens` CLI 定位：若面向终端用户，把 `scripts/count-tokens.mjs` 打进发布包（`files` 增加 `scripts/count-tokens.mjs`）；若仅本地开发，从 `package.json` 的 `scripts.tokens` 中移除并在 README 标注「仅源码仓库可用」。
2. 推荐方案：CLI 属于开发/诊断工具，不随包发布；`files` 保持不含 `scripts/`，`scripts.tokens` 保留但 README 注明仅本地 checkout 可用。若后续要发布 CLI，再评估独立 bin。

**涉及文件**：`package.json`、`README.md`。
**验证**：`npm pack --dry-run` 核对产物清单与 README 描述一致。
**风险**：二选一需与用户确认定位；本文档默认「不随包发布 + README 说明」。

---

### N. 账本上限硬编码 + 溢出降级无感知（优先级：中）

**现状**：`DEFAULT_MAX_LEDGER_ENTRIES = 5000`（`lib/index.js:1179`）不可配置；`compactLedger` 折叠时丢弃 `costCny`，历史降级为估算，无 UI 提示。

**方案**（与 D 数据管理联动）：
1. 上限读自配置 `maxLedgerEntries`（默认 5000），在「数据管理」标签可改。
2. `compactLedger` 折叠时在 legacy 快照打「foldedAt / foldedCount」标记；`renderCombinedUsage` 下发「账本精确区间 vs 估算区间」元信息。
3. 前端明细表对估算区间行显示「估算」角标，替代当前无差别展示。

**涉及文件**：`lib/index.js`、`lib/ledger.js`、`lib/client.js`。
**验证**：`scripts/test-usage.mjs` 补折叠标记；`scripts/test-server.mjs` 补配置化上限。
**风险**：折叠标记需向后兼容旧缓存（缺省视为「无折叠标记，全部按原口径」）。

---

### O. `exports` 缺 `./pricing`（优先级：低）

**现状**：`package.json` `exports` 暴露 `./usage ./balance ./ledger ./tokenizer`，但 `lib/pricing.js` 无导出入口。

**方案**：`exports` 增加 `"./pricing": "./lib/pricing.js"`。

**涉及文件**：`package.json`。
**验证**：`npm pack --dry-run` + `node -e "import('@wannanbigpig/dsh-usage-stats/pricing')"`（本地 link 后）。
**风险**：无。

---

## 4. 实施顺序与里程碑

按「依赖关系 + 风险 + 价值」排期，工程债（I/J/K/L/N/O）多为低风险先行，阶段 4 功能为主体。

### 里程碑 1：工程债清理（低风险，先行）

- I 定价双源收敛
- J 价格表扩充
- K 注释修正
- L 发布包脚本定位
- O exports 补 pricing

**验收**：`npm run check`、`npm test`、`npm pack --dry-run` 全绿。

### 里程碑 2：设置页四标签（阶段 4 主体）

- A 账户与余额
- B 价格设置 + 差异预览
- C 通知与提示
- D 数据管理（含 N 账本上限配置化）

**验收**：交接文档 §12 非视觉检查项通过；设置页五个标签齐备（限额已有）；查询弹窗保持只读。

## 5. 验收标准汇总

### 功能验收（用户视觉）
- 设置页含「账户与余额 / 预算与限额 / 价格设置 / 通知与提示 / 数据管理」五个标签。
- 价格差异预览高亮官方 vs 自定义差异，恢复默认一键生效。
- 告警可通过 Toast/侧栏触发，冷却可配置，告警历史可查。
- 数据管理可查看保留天数/大小/范围，重建/清理有二次确认，清理后数据确实重置。

### 非视觉（实现 AI 代码级）
- 定价单一来源，`defaultPricing()` 与 `normalizePricing(defaultPricingVersion())` 输出一致。
- 价格生效时间前后，账本冻结价不漂移（历史稳定）。
- 余额过期/查询失败 fail-open，不触发硬停止（已有，回归验证）。
- 凭据值不出现在接口、日志、DOM、导出、告警历史中（回归验证）。
- 写盘原子替换，损坏文件安全降级（已有，回归验证）。
- `llm/stream` 拦截器保持 async generator 契约（见 `lessons.md` 高频回归项）。
- 通知策略与告警冷却按状态跨越/恢复去重（`createAlertTracker` 回归）。

## 6. 风险与边界

| 风险 | 应对 |
| --- | --- |
| 价格表核对错误导致计费误差 | J 项逐行核对官方页，本文档不臆造单价；变更前人工复核 |
| 系统通知跨平台差异 | C 项只做侧栏 + Toast，系统通知不在本期范围 |
| 清除历史不可逆 | D 项二次确认 + 后端 `action` 独立校验 |

## 7. 附录：相关代码位置索引

| 内容 | 位置 |
| --- | --- |
| 服务端入口 / 端点 / 拦截器 | `lib/index.js` |
| 设置页主体（仅限额） | `lib/client.js:1940` `UsageBillingSettingsSection` |
| 限额卡片 | `lib/client.js:1094` `LimitsCard` |
| 余额查询纯模块 | `lib/balance.js` |
| 调用级账本 / 折叠 / 冻结 | `lib/ledger.js` |
| 价格版本 / 归一化 | `lib/pricing.js` |
| Token 聚合 / 费用估算 | `lib/usage.js` |
| 告警去重 | `lib/index.js:1143` `createAlertTracker` |
| 账本上限 | `lib/index.js:1179` `DEFAULT_MAX_LEDGER_ENTRIES` |
| 后台刷新 | `lib/index.js:702` `startBackgroundRefresh` |
| 侧栏/设置 slot 注册 | `lib/client.js:2402` 附近 |
| 离线 tokenizer | `lib/tokenizer.js` / `scripts/count-tokens.mjs` |
| 设计交接（阶段 4/5 原文） | `.aitasks/usage-billing-optimization-handoff.md` |
| 经验库（llm/stream 契约等） | `.aitasks/lessons.md` |
