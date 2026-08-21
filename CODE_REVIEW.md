# dsh-usage-stats 代码审查报告

> **审查方式**：源码与测试复核（含 DeepSeek Harness 宿主契约、README 一致性和新增对话折叠路径）；本轮允许按用户要求修正文档与实现
> **范围**：lib/（index.js 1990 行、client.js 4257 行、usage/ledger/pricing/balance/tokenizer）+ scripts/ 全部测试与工具 + package.json + README 契约
> **基线**：本轮执行 `npm test`、`git diff --check`；最终结果见文末验证记录

---

## 一、问题清单（按严重度降序）

### 高（4 项，均已修复）

[高] lib/index.js:448-454 — renderCombinedUsage 用「全部模型」重算 day/hour cost，非计费供应商把已定价费用打成 null 并连带关闭当日配额

- 触发条件：同一北京日/小时同时存在 deepseek-official 计费模型与任意非计费模型（GLM/MiMo 等，ledger 只跳过 facade 前缀，index.js:1931），非计费行 tokens>0 即触发。
- 影响：day.cost / 含该模型的 hour.cost / total.cost 全部变 null（客户端显示"—"）；更严重的是 index.js:965 costReliable=dayEntry.cost!==null 判为 false → 当日状态"unpriced" → 每日限额/硬停止整日失效（fail-open）。即「今天用过一次 GLM = 今天 DeepSeek 限额形同虚设」。
- 证据：已实际复现——同一 ledger 中官方条目(cost 0.0002)+GLM 条目 → day.cost=null、total.cost=null、hour(11).cost=null；而 renderUsage 单独渲染同数据 day.cost=0.0002。与 usage.js:438-441/460-470 的 billed-only 设计注释、test-usage.mjs:185 断言（"non-official provider must not blank the official day cost"）及 README 承诺（"外部 Token-only 模型不触发此状态"）直接矛盾。根因：mergeCost 对非计费行兜底 null（index.js:431-433）后，452-454 行未做 billed-only 过滤就重算（对照 usage.js:462-470）。
- 当前状态：已修复。`renderCombinedUsage` 现在只用官方计费模型重算日/小时费用；新增混合供应商回归测试。
- 分类：已确认缺陷（复现验证，已修复）

[高] lib/client.js:1851,1933（配合 1676/1957）— LimitsCard 多 Key 切换后输入框显示旧值，失焦即把旧 Key 的限额静默写进新 Key 规则

- 触发条件：多 API Key 配置（README 明确支持）下，在「预算与限额」页切换「目标 API Key」下拉，随后点击/失焦任一限额输入框（无需输入）。
- 影响：输入框用 uncontrolled defaultValue，key 切换后 DOM 值不更新；onBlur 以「当前 targetKey」合并保存，把上一个 Key 的 dailyCostLimit/lowBalanceWarning 静默覆盖到新选中 Key 的规则上，无任何提示；旧值持续显示误导用户。
- 证据：client.js:1851/1933 defaultValue: rule?.dailyCostLimit ?? ""（无 value/key 重挂载）、1852/1934 onBlur → handleSave、1711-1719 handleSave 按当前 targetKey 写 base；React 对 uncontrolled 输入只在首次挂载读取 defaultValue。
- 当前状态：已修复。每日限额和余额提醒输入框按 `targetKey` 重挂载，切换 Key 后不会沿用旧 DOM 值。
- 分类：已确认缺陷（已修复）

[高] lib/index.js:1731-1742 — `data action=clear` 后端没有校验二次确认字段，API 契约与前端提示不一致

- 触发条件：任何通过 loopback/Host 校验的客户端直接 POST `/api/usage-stats/data`，body 为 `{ action: "clear" }`。
- 影响：服务端直接清空 ledger 与 legacy 快照；前端 `DataCard` 的确认输入只保护正常 UI，不能保护同机脚本或其他本地页面调用。README 原先声称“二次确认”是不准确的。
- 当前状态：已修复。服务端现在要求 `confirmation` 为 `清除` 或 `DELETE`，前端确认对话框会将该字段一并提交。
- 分类：已确认缺陷（已修复）

[高] lib/client.js:1676-1686,1955-1962 — 已保存的 `stopOnExceed` 未回填设置页，且开关变更没有二次确认

- 触发条件：已有 v2 规则将 `stopOnExceed` 保存为 `true`，重新打开设置页；或直接点击硬停止开关。
- 影响：设置页可能显示“关闭”而实际仍会拦截调用；用户点击时没有确认提示。README 原先关于“必须二次确认”的描述与实现、smoke 测试均不一致。
- 当前状态：已修复。设置页从当前 Key 规则直接回填 `stopOnExceed`，开启前显示确认对话框，取消时不保存。
- 分类：已确认缺陷（已修复）

[中] lib/client.js:3416-3460 — 对话大折叠曾读取 session 累计 Token，不能代表单个问答

- 触发条件：一个 session 连续产生两个或更多 turn，且界面启用过程大折叠的 Token 显示。
- 影响：`useProjection("tokenUsage")` 是宿主完整 session log 的累计 projection；每个大折叠都会显示相同的累计输入/输出，跨问答重复计数，无法回答“这一问一答用了多少 Token”。小折叠还会被错误地带上汇总口径（若调用方继续传入该 projection）。
- 宿主证据：`TokenUsageProjection` 的定义与 `usage-projection.ts` 都按整个 session 累计；单 turn 的 `assistant-step.data.usage` 才能按 turn 聚合。
- 当前状态：已修复。`compactProcessGroups` 现在聚合当前 turn 的 assistant step usage（输入 + cache read/write、输出），`compactSync` 只把它传给大折叠；小折叠不显示 Token。缺失 usage 时保持为空，不回退到 session 累计。
- 分类：已确认缺陷（已修复，需保留回归测试）

### 中（7 项，其中 2 项已修复）

[已撤回的原结论] 自定义定价对账本覆盖的费用无效

本项把“账单冻结”误读成了缺陷。当前设计在 `freezeLedgerEntry(..., config.pricing)` 时冻结发生调用时的 `costCny` 与 `pricingVersion`，后续自定义价格不会重写历史账单；这是 README 所述的审计/历史稳定性语义。自定义价格只影响新调用以及没有冻结费用的 legacy 估算。原报告将此列为“功能形同虚设”不成立，保留为设计取舍说明而非缺陷。

[中] lib/index.js:1885-1887,1933-1936 + lib/ledger.js:67-78 + lib/usage.js:110,116 — 事件兜底 sampleKey 缺会话身份，跨会话/并发流存在账本条目错配

- 触发条件：拦截器未捕获 usage chunk（pendingUsageKeys 为空）时，session/event 兜底键为 routeKey:turn:step——宿主 turn/step 是【每会话从 1 重新计数】（已核对 dsh-session invariant：nextTurn 初始 1、每 turn/start +1），两个会话的首个调用键完全相同。
- 影响：跨会话 appendLedger 按 sampleKey 整条替换（保留 previous.id），前一会话的 usage/costCny/时间戳被静默销毁；并发流时 LIFO pop 把 A 的 final 配到 B 的键，事件缺失时一方多计一方漏计。usage.js 折叠键（仅 turn:step，不含 provider/model）在相邻同值条目时同样后替前。
- 证据：ledger.js:67-78 findIndex 全表匹配替换；index.js:1934 pending.pop()（LIFO）；已核对宿主 packages/llm/llm/lib/types/types.d.ts:332-368 —— GenerateOptions（llm/stream payload）与 StreamChunk 均【无 turn/step 字段】，故拦截器主路径实际恒走 provider/model:pending:startedAt:UUID 唯一键（安全），碰撞面收窄为「事件兜底路径 + 并发 LIFO 错配 + fold 折叠键」。
- 分类：风险（主路径已核实安全，兜底/并发路径存在真实错配面）

[中] lib/index.js:1865-1873 — 每次计费调用在出流前同步等待「全账本聚合 + 可能的上游余额请求（最长 15s）」

- 触发条件：任意 deepseek-official 的 llm/stream；余额缓存冷启动（重启）或过期（每 refreshMs）。
- 影响：interceptor 在 for await 前 await limitsService.check → evaluateStatus → collectUsage 全量聚合（≤5000 条）+ evaluateStatuses 对过期 key 并发上游 GET /user/balance（UPSTREAM_TIMEOUT_MS=15000，AbortSignal.timeout）。上游慢/挂时每次模型调用最多阻塞 15s 才出首 token；GET /limits 轮询同样触发。稳态受 withLock/单飞+TTL 缓解，冷启动/上游故障时延迟显著。
- 证据：1865-1873 → 1311-1318 → 589-599 → 961-1009 → 661-700（674 上游请求）。
- 分类：风险

[中] lib/index.js:222-225、lib/pricing.js:47,57 — 部分价格字段覆盖静默把未指定字段置 0

- 触发条件：用户只改一个价格字段（如 pricing.pricing[model]={inputMiss:1.0}），或版本化 models 条目缺 inputHit/output。
- 影响：未指定字段经 numberOrNull()??0 / finite(_,0) 变 0 —— cache-hit 与 output token 按 0 计费，费用严重低估且无任何告警/校验提示。
- 证据：index.js:223-225 整行替换；pricing.js:56-58 finite(row.inputHit,0)；validateConfig 无"必须三字段齐全"约束。
- 当前状态：已修复。部分覆盖现在继承现有模型字段，显式填写的 0 仍然保留为 0；前端不再把空值、非法值或负数静默转成 0，前后端均拒绝无效价格，并新增配置回归断言。
- 分类：已确认缺陷（已修复）

[已撤回的原结论] 版本化 `models` 与 legacy `pricing` 同时存在会丢失显式 peak 价

当前 `normalizePricing` 明确规定 legacy `pricing` 覆盖同名 `models`，并在 legacy 行中优先采用显式 `row.peak`；这是配置优先级设计，不是无条件误覆盖。若用户同时提供两种形态，应以 legacy 形态为最终值。原报告将该优先级描述为“已确认缺陷”不准确，保留为配置迁移/优先级风险提示。

[中] lib/client.js:3460-3475 — CompactConversationController 对 document.body 全局 MutationObserver（childList+subtree+characterData），每次 app 级 DOM 变更全量同步

- 触发条件：会话控制器挂载后任意 DOM 变化（流式 token characterData、其他会话渲染、toast）；running 组存在时每 1s 再同步。
- 影响：每次 sync 对所有 [data-chat-flow] 容器（未按 sessionKey 过滤，3227/3248）执行多次全量 querySelectorAll + 逐行剥类 + 逐组查 error 标记，成本 O(容器×行×组)；多会话同时挂载时 A 的 sync 剥掉 B 的折叠类再被 B 补回 → 交叉干扰/闪烁；长会话 + 高频流式更新下主线程卡顿风险。
- 证据：3474 observe(document.body,{childList,subtree,characterData})、3470 queueMicrotask 只合并批次不限频、3220-3222/3261-3268 无条件剥类。
- 分类：风险（代码事实确认，实际卡顿需宿主环境实测）

[中] lib/index.js:1953 + lib/client.js AccountsCard — 侧栏「关闭」刷新 cadence 实际无效

- 触发条件：用户在「账户与余额」把刷新周期设为「关闭」（POST refreshMs=null）。
- 影响：validateSettings 把 null 存为 null，但 startBackgroundRefresh 的 getRefreshMs = snapshot().refreshMs ?? config.refreshMs → null 回退到启动配置（默认 300000）→ 后台定时器照常每 5 分钟运行；UI 的「关闭」选项是死功能（注释声称"non-positive cadence disables the periodic timer"，但 UI 永远产生不了非正值）。
- 证据：index.js:1953、validateSettings refreshMs null 分支（1440-1445）、AccountsCard onChange 发送 null。
- 当前状态：已修复。`refreshCadenceOf` 将设置中的 `null` 转为 0，后台定时器按宿主注释停用；缺失值仍回退启动配置。
- 分类：已确认缺陷（已修复）

[中] 测试盲区：7/8 个 HTTP 处理器零覆盖 + renderCombinedUsage 混合供应商路径未测（掩盖高缺陷）+ pricing.js 无直接测试

- 触发条件：回归验证/发布前。
- 影响：rejectForeignCaller 回环围栏（403/405 分支）、其余 HTTP handler 的错误路径仍缺测试；`readJsonBody`、`renderCombinedUsage` 混合供应商和 pricing 输入校验本轮已补覆盖，但完整 handler 矩阵仍不齐。
- 证据：test-server.mjs 仍主要直接调用 accountsRoute.handler，其余 handler 的 400/403/405 分支覆盖不足；request() 助手硬编码 localhost/127.0.0.1 快乐路径。此前混合供应商与 pricing 盲区已由本轮回归测试补上。
- 当前状态：部分修复。已覆盖 `renderCombinedUsage` 混合供应商、pricing 输入校验、data clear 确认和若干配置路径；其余 HTTP handler 的错误分支、`readJsonBody` 超限和回环 403/405 仍缺少系统测试。
- 分类：已确认缺陷（覆盖缺口，部分修复）

### 低（18 项，其中 6 项已修复）

[低] lib/ledger.js:135-151 — pricingVersionOf 忽略每模型显式 peak 价格（`models` 结构经 normalize 后会进入 pricing）

- 触发条件：两套定价仅某模型的显式 peak 价不同。
- 影响：冻结在账本上的 pricingVersion 无法区分仅 peak 不同的配置，审计/溯源失真；`models` 形态本身会在 normalize 后进入 pricing，当前无下游消费方比对，影响限于元数据。已实测：仅改 peak 时版本串完全一致。
- 当前状态：已修复。pricing fingerprint 已纳入每模型显式 peak 字段，并新增版本差异测试。
- 分类：已确认缺陷（影响面低，已修复）

[低] lib/pricing.js:76 — normalizePricing 不校验 peakHours（与 validateConfig 校验不对称）

- 触发条件：POST /pricing 或 settings 文件直接走 normalizePricing，传入非法窗口（如 [[25,30]]、[["a","b"]]、[[13,2]]）。
- 影响：isPeakHour 静默产生错误峰谷判定，费用归属错乱且无报错（字符串比较/永假）。
- 证据：pricing.js:76 直接透传 vs index.js:235-244 严格校验；1682-1684/1447-1449 未校验入口。
- 当前状态：已修复。新增 `validatePricingInput`，仅对用户写入的 pricing POST 严格校验；历史 settings 读取仍保持宽松兼容。
- 分类：已确认缺陷（入口依赖，已修复）

[低] lib/index.js:681 + lib/balance.js:85 — 余额 total 无数值校验，NaN 序列化为 null 但 status 仍为 "ok"

- 触发条件：官方 /user/balance 返回非数字 total_balance。
- 影响：balance.total=NaN → JSON null（实测：Number("not-a-number")=NaN → {"total":null}），status 仍 ok → 状态点与金额显示不一致；下游 evaluateKeyQuota 靠 Number.isFinite 兜底 fail-open（不崩溃），客户端显示"—"。
- 当前状态：已修复。上游解析与 balance service 双层校验有限数值，非法响应归类为 `invalid-response`，不再缓存为 ok/NaN。
- 分类：风险（无数据损坏，状态/显示不一致，已修复）

[低] lib/client.js:537 — 年热力图 2028/2056 年产生 54 周，多出一列近乎全空的格子

- 触发条件：heatYear 选中 2028（或 2056，闰年且 1 月 1 日为周六）。
- 影响：weekCount=54，第 54 周 6/7 格为 null 空列。已实测跨 4 个时区一致——是日历布局问题而非 DST。
- 当前状态：已修复。热力图改用稳定的周边界计算，2028/2056 固定 53 列，并保留年首年尾日期。
- 分类：已确认缺陷（显示级，已修复）

[低] lib/client.js:3534-3536,3635-3640 — 侧栏摘要硬编码中文「余额/今日」，绕过 locale，en 界面显示中文

- 触发条件：界面语言为 en。
- 影响：wide 侧栏与 tooltip 直接拼接中文；字典里已存在的 panel.summary 键从未被引用（死键）。
- 当前状态：已修复。侧栏摘要改用 `panel.balance` / `panel.today` locale 键，中英文同步。
- 分类：已确认缺陷（已修复）

[低] lib/client.js:3502-3528 — notifiedAlertsRef 无限增长；slice(-3) 丢弃的告警仍被标记已通知，静默丢通知

- 触发条件：toast 通道开启、单批 4+ 条新告警。
- 影响：Set 只增不减（长期内存缓慢增长）；被 slice 掉的告警永久不再提示。
- 分类：已确认缺陷

[低] lib/client.js:775-782,553-554 — recentDays/热力图用浏览器本地时区，与服务端北京日键错位

- 触发条件：用户时区 ≠ +08:00（UTC-8/UTC+10）。
- 影响：recentDays 14 天窗口变 13/15 条；热图格子按本地日生成 key 查北京 dayMap，晚间用量跨日错位、isToday 高亮错位。侧栏「今日」本身用 payload.today（北京）无错位。
- 分类：已确认缺陷（显示级，不影响金额）

[低] lib/index.js:146-162 — readJsonBody 超限后 body 继续累积、socket 不销毁、end 仍对整串 parse

- 触发条件：本地进程/被攻陷页面 POST 超大 body。
- 影响：reject 后 data 监听器仍 body += chunk（无界内存 + O(n²) 拼接）；req.body 快路径完全绕过 64KB 上限。
- 当前状态：已修复。字符串快路径和流式路径都按 UTF-8 字节限制；超限立即清理监听器、销毁请求并返回错误，新增流式/快路径测试。
- 分类：已确认缺陷（loopback 限定，已修复）

[低] lib/index.js:119-129 + 危险 POST 端点 — 无 CSRF token/Origin 校验（同机本地页面可经 text/plain 表单触发 clear/改限额）

- 触发条件：用户在本机打开一个「本地来源」的不可信页面（localhost 开发服务器、file:// 等），以 form enctype="text/plain" 提交原始 JSON。
- 影响：可永久清空用量缓存（clear 无恢复路径）、整体禁用限额、改定价/通知；无法窃取密钥（响应不可跨域读且无密钥值）。真实性：Chrome/Firefox PNA 拦截 public→local 但 local→local 放行；Host 校验恰好挡掉 DNS rebinding。影响是用户自身数据破坏，非凭据泄露。
- 分类：风险（已确认攻击面，受 PNA/Host 缓解）

[低] lib/index.js:1796,1900-1904 — pendingUsageKeys 无界增长

- 触发条件：流有 usage 但对应 assistant/message 事件未到达（流中断/事件未投递，尤其工具调用流）。
- 影响：Map 数组项只 push 不清理，进程存活期内无界累积。
- 分类：风险

[低] lib/index.js:907-914,1488-1498 — saveLimits/saveSettingsFile 固定 tmp 路径且无写串行化

- 触发条件：两个并发 POST /limits（或 settings 相关 POST，如两个标签页同时保存）。
- 影响：writeFile(tmp) 互相覆盖 + rename 交错 → 磁盘内容与内存态可能短暂不一致（多数收敛为后写者）；对比 saveCache 走 serializeWrite（574-578）此处未做。
- 分类：风险

[低] lib/index.js:1745-1749 + scripts/rebuild-today-legacy.mjs — data action=rebuild 是 no-op；恢复工具是死代码

- 触发条件：用户点「重新统计」（尤其 clear 之后）；或手动执行 rebuild-today-legacy.mjs。
- 影响：rebuild 只读重渲染现缓存（会话事件折叠已退役，账本就是唯一来源），clear 后数据永久丢失却返回 rebuilt:true（误导）；rebuild-today-legacy.mjs 未被 package.json/README 引用，且 execSync 拼接文件路径存在 shell 注入面（本地工具、影响小）。
- 分类：待确认 / 风险

[低] 杂项

- lib/usage.js renderLedger —— 零用量（warmup）调用会产生 0-token 天行（已实测 {tokens:0, models:0}），与注释"zero-token days never surface"矛盾，污染日列表/热图；
- lib/index.js:1359 vs 1864 —— limitsService.check 优先 config.provider，interceptor 优先 payload.provider，两处优先级不一致；
- lib/index.js:968 —— limits.keys 中不在 config.keys 的「幽灵 key」会生成状态行并进 alertTracker（可产生幽灵告警）并可能对其发起余额请求；
- lib/client.js —— 全局限额 banner 显示 statusMap 第一个 key 的状态（statusMap 无 "__global__" 键）；AccountsCard「立即刷新」只刷默认 key；svg path/polyline 的 key 被放进 props 产生 React dev 警告（client.js:1404，外观级）；hostNameOf("") 返回 "" 而非 null（不构成绕过）；withLock 并发渲染共享先到者 pricing；大量死字典键（panel.summary/nav/limits.stopConfirm/limits.save 等）。
- 分类：多为风险/低危

---

## 二、本轮 README 与报告修订

- README 已补充当前第六个「折叠会话」设置标签，并明确：小折叠保留但不显示耗时/Token，最终回复留在大折叠外。
- README 已把折叠 Token 口径写成单个问答（turn），并说明它来自该 turn 的 assistant step usage；session projection 不用于该 UI。
- README 已修正 Token 采集入口与 `/usage` 实际读取 ledger/legacy 的分层描述。
- README 已同步预警百分比范围、硬停止开启确认行为，以及 `data clear` 的前后端确认契约。
- 本轮已修复混合供应商费用污染、多 Key 限额输入框陈旧值、`data clear` 服务端确认、`stopOnExceed` 回填/开启确认、部分价格字段归零、刷新“关闭”失效、余额非数值状态误报和 pricing fingerprint 漏记 peak 等问题，并补充对应回归测试。
- 原报告中“自定义定价使历史账单失效”和“legacy 定价无条件丢失显式 peak”两项已撤回，改为设计语义/配置优先级说明。

## 三、做得好的地方（strengths）

1. **回环安全边界扎实**：以 peer socket 地址为决定依据、Host 仅附加校验，IPv4-mapped IPv6 归一化，DNS rebinding 被 Host 校验天然挡住（已对 fence 辅助函数做边界单测，全部通过）。
2. **写路径不丢账**：serializeWrite 链保证并发完成逐条落账；缓存 temp+rename 原子持久化；账本 id 去重 WeakMap + compact 后索引重建；facade 供应商防双计。
3. **限额语义健全**：costReliable 防把不可靠费用当 0 消费、100% 才硬停（90% 只预警）、resolveLimitRule 只收紧不静默退出、v1→v2 限额迁移 fail-open、配额检查失败放行——设计意图清晰，测试覆盖到位。
4. **纯模块边界清晰**：usage/ledger/pricing/balance/tokenizer 零 cordis 依赖，单测断言精确到分值/文案/DOM 结构；zh/en 字典 225/225 逐键对齐、占位符一致。
5. **客户端无 XSS 面**：全量动态内容走 textContent/children，无 innerHTML/dangerouslySetInnerHTML；请求竞态防护（createLoader/summaryRequestRef）设计正确。

---

## 四、摘要

- **总体评价**：工程整体质量较高——安全围栏、持久化原子性、限额 fail-open 语义、测试断言精度都较扎实；本轮已修复 4 个高危问题（混合供应商合并、多 Key 限额 UI、`data clear` 确认、`stopOnExceed` 回填/确认），以及部分价格覆盖、刷新“关闭” cadence、pricing fingerprint、峰谷输入、余额异常、热力图列数、locale 文案和 JSON body 限制等问题。当前仍有 **5 个中危、12 个低危待处理项**，主要集中在并发兜底、请求前聚合延迟、全局 MutationObserver、HTTP 错误路径覆盖和若干显示/资源边界。对话 Token 的 session/turn 混用已修复并有回归测试。README 与代码的折叠、Token、ledger 口径已同步。
- **计数**：待处理高 0 / 中 5 / 低 12；本轮已修复高 4 / 中 2 / 低 6；另有 2 项原报告结论已撤回，分别改为设计语义/配置优先级说明。
- **建议**：先处理剩余中危并补齐 HTTP 错误路径覆盖，再按用户场景处理低危 UI/性能项；真实 Harness 浏览器视觉验收仍需单独执行。

### 验证记录

- `npm test`：通过。包含 syntax check、usage、tokenizer、server、client smoke 和 `test-conversation.mjs`；对话回归确认多 turn Token 不累计到下一轮、小折叠不显示 Token/整体耗时、最终回复不被吞掉。
- 本轮新增回归覆盖：混合供应商费用隔离、部分 pricing 字段继承、非法 `peakHours` 拒绝、`data clear` 双重确认、硬停止回填/确认、多 Key 输入框重挂载、余额非数值响应、刷新关闭 cadence、pricing fingerprint、2028/2056 热力图列数和英文侧栏 locale。
- `git diff --check`：通过。
- `npm test` 仍输出已有 React `key` spread warning（`path`/`polyline`），不影响退出码；该问题保留在低危杂项中。

---

## 五、未验证项（剩余测试风险）

| 项目 | 状态 |
| --- | --- |
| 真实 Harness 流式浏览器下的折叠同步卡顿 | 未验证（需宿主环境实测） |

## 六、宿主 UI 风格复核与本轮调整

本轮将插件的会话折叠和设置面板与 `/Users/liuml/data/openSource/deepseek-harness` 的原生组件对照复核。宿主 `packages/client/ui-primitives/src/DisclosureRow.module.css` 规定可展开行使用 24px 高度、16px leading 区域、14px 标题和 `--dsw-alias-label-tertiary` 图标色；`packages/client/ui-trajectory/src/client/TrajectoryTurnHeader.module.css` 使用 `--dsw-font-xs-strong-13` / `--dsw-font-xs-13` 和语义色变量。插件此前存在以下已确认的 UI 兼容性问题：

1. **主题变量名称不属于 Harness 契约**：`state-warning-primary`、`state-info-primary`、`label-error`、`input-bg` 在宿主 `ui-theme` 中没有定义，导致警告色、焦点轮廓、差异色和价格输入背景在主题切换或无回退路径时失效。
2. **折叠排版与原生 disclosure 行不一致**：小折叠使用 26px/12px/18px，外层指标使用硬编码 14px/18px；原生折叠行与轨迹头部使用 24px/14px 或宿主 13px 字体 token，容易造成行高和字重跳变。
3. **面板强调色和余额图标保留硬编码蓝/绿**：在宿主深浅主题下可能与品牌色、成功色不一致；这属于低危视觉一致性问题，不影响数据或交互。
4. **思考/工具指标图标语义不够直观**：旧原子轨道和扳手线稿在 14px 指标栏中辨识度不足；本轮思考指标改用用户提供的原子填充图标，工具指标改用新的扳手填充路径，并统一继承主题 `currentColor`。
5. **按小时柱状图输入颜色受宿主品牌色影响**：输入柱原先复用 `--usg-blue`，在宿主品牌色为黑色的主题下会显示为黑色，与输入/输出图例区分不明显；本轮固定为蓝色输入柱（`#3b82f6`）和绿色输出柱（`#22c55e`），日柱和图例同步。
6. **单日用量提示与详情层级混淆**：热图小方块原先只有浏览器默认 title，无法稳定展示整日统计；小时柱 tooltip 点击后还会常驻。现已增加热图整日悬停 tooltip（含 Token、输入/输出、缓存、费用和模型），移除原生 title 避免双提示，小时柱 tooltip 离开即隐藏，同时恢复单日下方的 `DayDetail`，保留 DeepSeek 官方模型明细。
7. **按小时日期选择器的原生焦点边框过重**：透明无边框选择器聚焦时仍显示浏览器蓝色 outline；现已明确清除 focus/focus-visible 的 outline、边框和阴影，保持与宿主无边框控件一致。
8. **多日柱状图 tooltip 信息不完整**：「本月」等范围原先只显示总 Token 和命中率，缺少输入/输出及模型；现已补齐整日输入、输出、缓存和模型摘要。
9. **按天维度柱状图与参考 UI 色彩不一致**：本月、近 7/30 天等日柱原先复用蓝色；现已改为橙色 `#f59e0b`，按小时输入/输出仍分别使用蓝色/绿色。

本轮已完成最小调整：

- 将上述未定义变量替换为实际宿主别名：`state-warn-primary`、`state-business-primary`、`state-error-primary`、`bg-layer-1`，并为关键颜色保留兼容回退。
- 将蓝色、成功色、警告色、按钮前景色和余额图标改为宿主语义变量；余额图标去掉固定渐变，使用宿主品牌色和阴影。
- 将小折叠统一为 24px，并采用 `--dsw-font-xs-13`；外层标题/指标采用 `--dsw-font-xs-strong-13` / `--dsw-font-xs-13`。折叠仍保持无 hover 背景，仅保留淡化的前置展开箭头和底部细分隔线，符合用户当前交互要求。
- 自定义价格编辑改为严格校验：空值、非数字和负数不再被静默归零，服务端 pricing API 也会拒绝同类输入并返回可读错误。另修复编辑器草稿形状不一致导致的空表：`draftOf` 返回模型映射，表格现在直接遍历草稿，并在当前方案缺少 `models` 或仅有 legacy `pricing` 时回退到已保存自定义价/官方价。

**状态**：以上 UI/编辑问题已修复，位置为 `lib/client.js:38-41,66,74,215,224,233,261,270,273,284,3143-3175,3389-3408` 及 `lib/pricing.js:100-150`。尚未在真实 Harness 浏览器中逐像素验收，需发布前在浅色/深色主题和窄屏下各走一次会话折叠、思考/工具指标和价格编辑。
| 上游 /user/balance 返回非数字金额的真实行为 | 未验证（需真实响应样本） |
| Node 18 环境实跑测试套件 | 未验证（当前在 Node 25.9.0 验证，代码仅用 ≥18 特性） |
| 真实 DeepSeek tokenizer 文件的 encode 语义（includeSpecialTokens） | 未验证（无真实文件；fixture 构造与 encode 通过） |
| 并发流 sampleKey LIFO 错配的实际触发频率 | 未验证（代码路径确认，需并行工具调用场景观测） |
