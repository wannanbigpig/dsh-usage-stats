# dsh-usage-stats 待修复清单

> **基线**：插件 0.7.0（`faf6925`）；本机宿主 `fcc0ad4621`（`dsh-v0.2.2-rc.1`）。宿主远端是否仍指向此提交不作为本清单的前提。
> **来源**：2026-11-11 只读审查（宿主 seam / 客户端 bundle / 服务端数据路径三路专项 + 复核）。
> **用途**：本文件是修复用清单；原审查报告保留在会话记录中，这里只保留可执行的修复项与证据。
> **使用方式**：优先级表示影响程度，实施顺序见下方建议；每项完成后勾选 `[x]` 并补上版本/提交。行号基于上述基线，改动后需重新定位。P2-8 已移入“已核查无问题”，不属于待修复项。
> **宿主路径**：文中 `deepseek-harness/packages/...` 以宿主仓库根为基准（本机 `~/data/openSource/deepseek-harness`）。
> **复核**：2026-11-11 核对当前源码，并以离线 fixture 确认 Moonshot 凭据误判、请求数差异、价格回退响应及迁移初始化行为；原审查的合成性能数字未在本次复测，完整验证边界见文末。

---

## 优先级总览

| ID | 优先级 | 项目 | 类型 | 建议前置 |
|---|---|---|---|---|
| P0-1 | 高 | 写路径每次调用整树 clone+zod+diff，并被 await 到 LLM 流收尾 | 性能/架构 | — |
| P0-2 | 高 | 满额后每次 append 全量 clone frozen archive | 性能 | — |
| P1-1 | 中 | `usage/get` 无范围/投影，侧栏摘要拉全量历史 | 性能/数据流 | — |
| P1-2 | 中 | Moonshot 凭据环境变量名与宿主适配器漂移 | 已确认缺陷 | — |
| P1-3 | 中 | 同轮多条告警时宿主 Toast 完全重叠 | 已确认缺陷 | — |
| P1-4 | 中 | 窄栏且关闭 Toast 时仍进行 3s revision 轮询 | 性能 | — |
| P1-5 | 中 | 旧数据迁移的 home 解析与宿主不一致 | 历史数据漏导入风险 | — |
| P1-6 | 中 | 当前宿主集成作业中的运行依赖覆盖不足 | 工程化/覆盖风险 | — |
| P1-7 | 中 | 会话标题读取整份日志，宿主已有轻量路径 | 可替代/性能 | P0-1 |
| P2-1 | 低 | 官方价格回退静默 | 错误语义 | — |
| P2-2 | 低 | 请求次数 all-provider 与 per-provider 口径不一致 | 已确认缺陷 | — |
| P2-3 | 低 | 死代码与死 CSS（含测试反向锁定） | 清理 | — |
| P2-4 | 低 | 发布包 2.9MB，截图占 2.5MB | 发布卫生 | — |
| P2-5 | 低 | Node 22.19 作业仅覆盖静态检查 | 工程化/覆盖风险 | — |
| P2-6 | 低 | 单文件客户端与文本断言测试的维护成本 | 维护性 | — |
| P2-7 | 低 | 重复实现/行为漂移（余额、stream usage 提取） | 维护性 | — |
| P2-8 | — | RPC `authority` 第三参用于旧宿主兼容 | 已核查，无需修复 | — |
| P2-9 | 低 | 客户端低优先项（重复过滤/隐藏页签请求/a11y） | 性能/a11y | — |

**建议落地顺序**（与优先级解耦）：先做 P1-2、P1-3、P2-1、P2-2 四个低风险、用户可见的小修复 → P1-1 增加范围/摘要端点 → P0-1/P0-2 写路径重构（收益最大、需回归）→ P1-6、P2-4、P2-5、P2-3 工程化清理 → P1-7 与可选改进。

---

## P0（高）

### [ ] P0-1 写路径每次调用整树 clone + zod 校验 + diff，并被 await 到 LLM 流收尾

- **位置**：`lib/storage.js:490`（`structuredClone(before)` → `StateSchema.parse` → `diffStates`）、`lib/storage.js:300-316`（全局文档 diff/写入）、`lib/index.js:2122`（`llm/stream` 的 finally 中 `await recordLedgerEntry`）、`lib/index.js:1337-1347`（写入入口）。
- **触发**：每次捕获到 usage 的调用；ledger 接近默认上限 5000 或归档有历史后进入稳态。
- **影响**：实测 1.8MB 状态（5000 条 ledger + 90 天归档）clone+zod 约 15–25ms/次；6.66MB 合成状态 clone+zod 73.7ms、端到端 `update` 130–160ms（no-op 也要 69ms）；该 await 位于流收尾路径，直接叠加到每次模型调用的结束时间。全局文档含 `recentSampleKeys`（实测 310–325KB）+ `estimated`，每次新调用整份重写（benchmark 中 `global.json` 578,677B → 578,763B）。
- **证据**：
  - 宿主 `storage-domain` 读入时已对每条行记录做 `valueSchema.parse`（`deepseek-harness/packages/storage/storage-domain/src/index.ts:126`），插件再对整个组合状态做一次 `StateSchema.parse`，属于对已校验数据的整树重复校验（跨行不变量仍需插件校验）。
  - `diffStates` 每次对全部 ledger/frozen 行做 `sameJson` 比对（`lib/storage.js:300-316`）。
  - 基准脚本（`/tmp`，合成数据）：`record at cap` 22–43ms、`clone+zod avg` 73.7ms（6.66MB 状态）；5000 条 ledger 无归档时 `clone+zod` 19ms、`renderLedgerState` 26ms。
- **修复方向**：
  1. 内存增量写：只校验受影响的 ledger/frozen 行，复用宿主行级校验；跨行不变量单独做轻量断言。
  2. 把 `recentSampleKeys` 与 `estimated.sessionRebuild` 拆到独立 table（宿主 per-record layout 已支持多表），避免全局文档随去重窗口/估算历史膨胀。
  3. 以调用身份、待写行内容或变更集合尽早判定 no-op，避免无变化时仍整树 clone/校验。`repository.revision()` 只标识已提交状态变化，不能单独证明本次 transform 无变化。同一 step 的多条写入可评估合并，但必须保留不同 attempt 的独立计费、失败回退持久性和部分写失败恢复。
- **验收**：
  - 新增基准：稳态下 `repository.update` 耗时不再随全量状态线性增长（记录改前/改后数据）。
  - `global.json` 体积与单次新调用的写入量显著下降（记录实测）。
  - 保持 `scripts/test-server.mjs` 的流重试/attempt 回退/去重用例，以及 `scripts/test-official-state.mjs` 已有的 no-op 不写行、不推进 revision 用例通过；新增早退路径还需覆盖 global 无写入及部分写失败恢复。

### [ ] P0-2 到达 ledger 上限后，每次 append 全量 clone frozen archive

- **位置**：`lib/ledger.js:772-793`（`foldFrozenLedgerEntries`）、`lib/ledger.js:482-523`、`lib/ledger.js:409-423`（整 archive `structuredClone` + 逐 day/model/hour 标记）。
- **触发**：ledger 满额后的每次新调用（稳态）。
- **影响**：实测 4.12MB 归档时 `recordLedgerState` 单次 22–43ms；16.3MB 合成归档 76–95ms/次；而溢出条目只属于最老的 1–2 天。
- **证据**：原审查 `/tmp` 基准记录为 `createLedgerState 31.9ms`、`record at cap 22.3–43.3ms`（4.12MB），16MB 档 `79.67–95.13ms`；当前 `cloneFrozenArchive` 的 `structuredClone` 覆盖整个 `archive.days`。本次未复测这些耗时。
- **修复方向**：只 fold 溢出条目所属的 day，再对该 day 单行 `put`；archive 其余部分保持不变。若溢出条目跨天，按 day 分组后逐行写。
- **验收**：满额稳态 append 的耗时不随 archive 总体积线性增长；补充“溢出只影响目标 day”的单元用例。

---

## P1（中）

### [ ] P1-1 `usage/get` 返回全部历史（每天 24 个小时桶 × 模型），侧栏摘要拉全量

- **位置**：`lib/usage.js:631-710`、`lib/index.js:1815-1820`（仅 provider 过滤，无 from/to）、`lib/client.js:6703-6745`（侧栏 `loadSummary` 拉 `/usage`）、`lib/client.js:2440-2445`（实际只取今天）、`lib/client.js:4007-4029` 与 `6484`（面板/设置页同样拉全量取今天费用）。
- **触发**：侧栏常驻（打开 60s、关闭 5min）、面板恢复可见、revision 变化刷新、切换供应商/Key/日期。
- **影响**：实测 90 天/3 模型/每天 6 个活跃小时 = 578KB；365 天/8 模型/每天 9 小时 = 5.4MB；同一状态下不含 hours 只有 60KB、仅今天 7KB。每次轮询完整传输 + JSON 解析 + `structuredClone`。
- **证据**：以 `renderUsage` 生成合成账本并 `JSON.stringify` 量得上述大小；服务端无 `from/to/daysOnly` 参数。
- **修复方向**：为 `usage/get` 增加 `from/to` 与 `includeHours=0`（或独立 summary 端点）；侧栏改用 today 摘要（`usage/today` 或 `summary=1`）；hours 按选中日懒加载。
- **验收**：记录改前/改后的响应字节数（90 天、365 天两组）；侧栏轮询只请求摘要端点；概览日历/热图/年选择器行为不变；客户端现有筛选与日期联动回归通过。

### [ ] P1-2 Moonshot 凭据环境变量名与宿主适配器声明漂移（已确认缺陷）

- **位置**：`lib/providers.js:451-452`（硬编码 `MOONSHOTAI_API_KEY` / `MOONSHOTAI_CN_API_KEY`）、`lib/index.js:421-430`（profile 未写 `apiKeyEnv` 时回退内置表）。
- **宿主证据**：`deepseek-harness/packages/llm/llm-pi-ai/src/provider-data.generated.ts:30-31` 声明 `moonshotai` / `moonshotai-cn` 的 env 均为 `MOONSHOT_API_KEY`；`apiKeyEnv` 在 profile 中可选（`.../llm-pi-ai/src/config.ts:107`），缺省时宿主按适配器声明的 env 发现凭据。
- **触发**：用环境变量认证、`llm-pi-ai` profile 未显式写 `apiKeyEnv` 的 Moonshot 用户。
- **影响**：插件判定 `configured=false`，不查询余额/套餐，Key 选择器不命中；`README.md:263` 还把旧名当示例。
- **修复方向**：从 `listConfigurableProviders()` 读取宿主已公开的 `nativeAuth.env` / `baseURLEnv` / `defaultBaseURL`（`.../llm/src/types.ts:252-285`），仅完全缺失时用内置表；同步 README。其他 provider 的 env 名与宿主已核对一致（仅 Moonshot 两处漂移）。
- **验收**：fixture 场景下（profile 无 `apiKeyEnv`、环境只有 `MOONSHOT_API_KEY`）Moonshot 行显示已配置并可查询；补测试覆盖“profile 有/无 apiKeyEnv”两种路径。

### [ ] P1-3 同轮多条告警时宿主 Toast 完全重叠（已确认 UI 缺陷）

- **位置**：`lib/client.js:6700`（一次最多保留 3 条）、`lib/client.js:6982-6990`（同时渲染多个 `primitives.Toast`）。
- **宿主证据**：`deepseek-harness/packages/client/ui-primitives/src/Toast.module.css:7-9` 固定 `position:fixed; top:40px; left:50%`，组件无堆叠偏移 API。
- **触发**：一次 `/alerts` 响应里有 ≥2 条新告警（多 Key/多窗口同时越阈，或 `cooldownMs` 很小）。
- **影响**：同一 5s 生命周期内多条横幅完全重叠，只有最上层可读，其余告警实际不可达。
- **修复方向**：合并为一条摘要 Toast（如“N 条告警：…”，点击进入通知页），或串行展示（前一条结束后再弹下一条）。
- **验收**：jsdom 或浏览器中构造同轮 2–3 条告警，断言可见文案覆盖全部告警或可逐条查看。

### [ ] P1-4 窄栏且关闭 Toast 时仍进行 3s revision 轮询

- **位置**：`lib/client.js:6632`（`SIDEBAR_USAGE_REVISION_POLL_MS = 3000`）、`lib/client.js:6890-6900`（无条件 `setInterval`）、`lib/client.js:6764-6773`（jobs 为空时只更新 revision）。
- **触发与影响**：页面可见、窄栏且 Toast 关闭时，revision 变化后的 `jobs` 为空，但仍按 3s 间隔发请求，理论上限约 20 次/分钟。宽栏摘要和开启的 Toast 都是实际消费者，不能统称“无消费者”。
- **已有保护**：`checkUsageRevision` 在 `document.visibilityState === "hidden"`、已有 revision 请求或摘要加载中时直接返回（`lib/client.js:6752`）；后台窗口已有请求门控，不能把常驻 timer 等同于后台仍发请求。
- **修复方向**：在 `wide !== true && notifications.channels?.toast !== true` 时跳过轮询；宽栏或 Toast 开启时保留刷新，并按实际需要评估间隔。`UsageStatsPanel` 是常驻侧栏入口，不应直接用明细页签的 `tab.visible` 门控，否则关闭明细会影响侧栏摘要与通知。
- **验收**：页面隐藏，或窄栏且 Toast 关闭时，不发 revision 请求；宽栏且 Toast 关闭时仍更新摘要，窄栏且 Toast 开启时仍能投递告警；恢复可见或消费者重新开启后及时刷新。记录所选间隔与请求频率。

### [ ] P1-5 旧数据一次性迁移的 home 解析与宿主不一致（历史数据漏导入风险）

- **位置**：`lib/migration.js:16-23`（`process.env.DSH_HOME ?? ~/.dsh`，不展开 `~`、不 trim）、`lib/index.js:2247` 与 `2265`（生产调用 `legacyUsageStatsPaths(deps.dshHome)`，`deps.dshHome` 恒 `undefined`）。
- **宿主证据**：`deepseek-harness/packages/util/home-paths/src/index.ts:135-136`（configured > `DSH_HOME` > `~/.dsh`，纯空白环境变量视为未设）；`.../boot/app-boot/src/profile-context.ts:23` 的 `profileContext.home` 是当前 profile 的 home。`ctx.dshHomePath` 是函数（`.../util/home-paths/src/index.ts:160-161`），内部从环境解析 home，不能作为路径字符串，也不能替代 configured home。
- **触发**：以 configured home 启动（桌面/嵌入式/非默认 home）而进程环境无 `DSH_HOME`。
- **影响**：错误路径下找不到旧 JSON 后创建空 domain，原历史不显示；旧文件仍在，并非已被删除。`isFreshDomain` 根据 `installedAt` 和表是否为空决定是否调用初始化（`lib/storage.js:344-347`、`:408`），因此仅不写 `legacyCacheImported` 标记也不会让重启重试。
- **复核**：内存 domain fixture 将 `legacyCacheImported` 设为 `false` 后连续打开两次，初始化仍只执行一次，且 `installedAt > 0`。
- **修复方向**：保留测试注入的 `deps.dshHome`，生产优先读取 `profileContext.home`；缺失时按宿主规则回退到环境变量与默认目录。纯空白环境变量按未设处理，展开 `~` 并规范化绝对路径。为已经错误初始化的 domain 单独设计补导入路径，保留现有新账本并验证去重；不能只改完成标记。读取或解析失败继续明确报错，不转换为空数据。
- **验收**：覆盖 configured home、有效环境路径、`~`、纯空白环境变量与默认 home；用临时旧 JSON 验证首次迁移及重启不重复导入。补测已初始化空 domain 的恢复，以及已有新账本时补导入不覆盖、不重计。没有旧文件的全新安装可正常完成初始化，不要求无意义地反复重试。

### [ ] P1-6 当前宿主集成作业中的运行依赖覆盖不足

- **位置**：`package.json:88-96`（devDependencies 全为 `0.2.1-rc.3`）、`package-lock.json` 同；`.github/workflows/ci.yml:29-64`（integration checkout `dsh-v0.2.2-rc.1`，但 `npm ci` 装 0.2.1-rc.3；只有 `test:host-current`/storage-json 读 `DSH_HARNESS_ROOT` 源码）；`package.json:111-125`（peer 全 `*`，无 `engines.dsh`）。
- **已有策略**：`README.md:185` 明确保留 `0.2.1-rc.3` 作为回归基线，移除 `engines.dsh` 与宿主 peer 版本限制，按实际能力接入；`scripts/test-package.mjs`、`scripts/test-host-current.mjs` 还验证后续版本不被元数据限制。该策略本身不是缺陷，不应在本项中恢复版本限制。
- **风险**：CI 已有当前 tag 集成与 master drift 作业，但多数普通包导入仍解析插件 `node_modules` 中的旧宿主依赖；检出当前宿主并设置 `DSH_HARNESS_ROOT` 不等于全部测试都已在当前宿主运行依赖下执行。这是覆盖边界，不是已复现的运行不兼容；跨版本错误类型兜底也不能单独证明缺陷。
- **修复方向**：保留旧依赖基线，增加或扩展隔离的当前宿主依赖测试矩阵，使相关行为测试实际解析目标版本的宿主包，并在日志输出解析路径与版本。用于依赖装配的目标版本从所选宿主 manifest 推导；用于验证未来版本不受限的显式版本样例继续保留。
- **验收**：CI 日志能证明旧基线和当前宿主两组测试各自使用的运行依赖版本及解析路径；现有能力探测和版本不限制测试继续通过。不要求重新增加 `engines.dsh`。

### [ ] P1-7 会话标题读取整份日志，宿主已有官方轻量路径

- **位置**：`lib/rebuild.js:184-258`（`list()` 全部 snapshot → 逐 session `handle.read(0)` 全量，8 并发 + 自维护 revision 缓存）、`lib/index.js:1832-1846`。
- **宿主证据**：`ctx.sessionQuery.readTitleSnapshots(ids, signal)`（`deepseek-harness/packages/session-query/session-query/src/index.ts:251-270`，live-preferred、prepared-session 缓存）；`sessionProjectionCache.cachedSnapshot(header, ['title'])` / `cachedPredecessorTitle(header)`（`.../session/session-projection-cache/src/index.ts:162`、`:187`；base bundle 默认挂载，宿主会话列表即用此路径）。
- **影响**：重启后首次打开工作区/会话分布，读取量 = 会话数 × 日志大小；大 session 放大明显。
- **修复方向**：优先 projection cache → `sessionQuery.readTitleSnapshots` → 现状持久层回退；只读必要窗口而非 offset 0 全量。
- **注意（不要过度重构）**：projection cache 可能未 seeding；`sessionQuery` 默认持久读并发 4、prepared 缓存 5，低于插件 8，冷启动批量场景可能略慢。必须保留回退并做基准对比。
- **验收**：记录冷/热启动下标题读取的字节数与耗时；cache 命中时不读日志；标题结果与宿主侧栏一致；旧宿主/无该服务时回退路径仍可用。

---

## P2（低）

### [ ] P2-1 官方价格回退静默

- **位置/证据**：`lib/pricing.js:249-290` 生成 `policyFallback` / `pricingSourceFallback`，`:426-427` 保留标记；`lib/index.js:1933` 已将完整结果作为 `candidate` 返回。客户端 `lib/client.js:5626-5633` 保存候选结果，但未按回退标记显示提示。
- **触发与影响**：官网 HTML 获取失败、远程策略获取成功且含价格时，返回远程策略中的价格和 `pricingSourceFallback=true`；策略失败而 HTML 成功时，返回 `policyFallback=true`。UI 都未提示回退来源，用户可能误认为价格与路由策略均为最新抓取结果。两路都失败时会抛错，不会成功回退到内置价格。
- **修复**：客户端读取现有候选标记，分别提示价格来源回退和路由策略回退，并展示已有 `checkedAt`；无需新增重复的 RPC 字段。补测两种单路失败和两路均失败的展示与错误行为。

### [ ] P2-2 请求次数 all-provider 与 per-provider 口径不一致（已确认缺陷）

- **位置/证据**：`lib/usage.js:661`（过滤零 token 模型行）vs `:704`（用未过滤列表求和）；`lib/index.js:264-277` 从过滤后模型重算。
- **复现**：零 token 样本 + 正常样本 → all-provider `requestCount=2`、单供应商 `=1`。
- **既有口径与修复**：`scripts/test-usage.mjs` 已明确零 token 调用属于真实请求，日/小时计数必须保留。单供应商视图应沿用该口径，不能因隐藏零 token 模型展示行而丢掉计数；补全部/单供应商视图的日、小时、总计一致性回归。本次离线复现也确认真实 ledger 渲染路径存在 `2 → 1` 差异。

### [ ] P2-3 死代码与死 CSS（清理前先改测试）

- **位置/证据**：
  - `scripts/check-client-css.mjs` 实测 26 个未引用类（`.usg_valueWithIndicator`、`.usg_activity*`、`.usg_detailsHero*`、`.usg_inputPrefix/Suffix`、`.usg_limitActions`、`.usg_saveBtn`、`.usg_workspaceDonut*`、`.usg_balanceCard`）。
  - `scripts/smoke-client.mjs:128`、`:549` 断言其中 2 个已死规则必须存在 → 先改测试为行为断言，否则删样式会红。
  - `lib/client.js:2115-2117`、`:6158`（`rebuild` 死分支，RPC 端点表无 `data/rebuild`）。
  - `lib/migration.js:386-403` `initializeLegacyMigrations`、`lib/ledger.js:382-384` `renderLedger`+applyFrozenCosts、`:686-688` `hasRecentSampleKey` 未发现生产入口调用；前两者仍有测试依赖。`compactLedger` 被 `recordLedgerState` 调用（`lib/ledger.js:772`），不属于死代码。
  - `lib/pricing.js:314`、`:433-444` `pricing.windows` 无读取方。
- **修复**：按组件分批删死 CSS（activity → detailsHero → workspaceDonut → input/limit → 其余），每批跑 `npm run check` + `smoke-client` + 视觉核对。`package.json` 公开了 `./ledger`、`./migration` 等入口，仓内生产调用缺失不足以证明导出可删除；涉及公开导出时先核对 API 兼容要求，不直接按死代码处理。
- **说明**：此项在 `docs/host-audit-2026-11-11.md` 已记录为“仍可继续优化”，本次补充了测试阻塞点与分组。

### [ ] P2-4 发布包 2.9MB，截图占 2.5MB

- **位置/证据**：`package.json:24-32` `files` 含 `docs/assets/screenshots/`（10 张共 2.5MB）；原审查 `npm pack --dry-run` 记录为 2,900,324B / 解包 3,696,342B / 32 files；README 用相对路径图片（GitHub 可显示）；`.gitignore` 缺 `output/`。根目录现有旧 tgz 约 1.0MiB，已被 `*.tgz` 忽略，不属于待提交文件。
- **修复**：从 npm `files` 移除截图（保留在仓库供 README/GitHub Pages）时同步处理 npm README 的图片 URL，或评估 webp；`.gitignore` 增加 `output/`，并核对 `dist-pack/` 是否需要忽略。在 CI 加经实测确定的包体积阈值防回归；本地旧 tgz 无需作为此缺陷的一部分删除。

### [ ] P2-5 Node 22.19 作业仅覆盖静态检查

- **位置/证据**：`package.json:85-87` `engines.node >=22.19.0`；宿主要求 `>=24.9.0`；`.github/workflows/ci.yml:13-26` 的 22.19 job 只跑 `npm run check` + `check:site`（无行为测试）。
- **已有策略**：`README.md:185` 已说明插件支持 Node.js `>=22.19`，运行宿主时遵守宿主自己的 Node.js 要求；两者下限不同本身不构成缺陷。
- **改进与验收**：为 Node 22.19 作业补充适用的离线行为测试，或把作业名明确为语法与站点合同检查，并说明未覆盖完整宿主运行。仅凭最新宿主要求更高版本，不上调插件 Node 下限。

### [ ] P2-6 单文件客户端与文本断言测试的维护成本

- **位置/证据**：`lib/client.js` 8082 行/543KB（CSS 约 114KB），无构建/source map；`scripts/smoke-client.mjs` 2623 行/354 处 `source.includes`（改注释/换行即红）；宿主构建 preset 未通过 npm exports 发布（`deepseek-harness/packages/client/modules/README.md` Build requirements），外部插件不能直接复用。
- **修复（二选一，先决定）**：
  - A. 拆源：把组件/样式/本地化拆为源文件，由仓库内脚本生成同一 `lib/client.js`（保持宿主入口不变）。
  - B. 暂不拆：把 smoke 的 `source.includes` 逐步收敛为 render/DOM 断言，至少移除锁死死 CSS 的断言（与 P2-3 联动）。
- **验收**：记录抽样改造后的定位/回归成本变化；`npm run check` 的语法/ CSS 合同继续通过。

### [ ] P2-7 重复实现/行为漂移（余额、stream usage 提取）

- **位置/证据**：
  - DeepSeek 余额两份：`lib/balance.js:87-136` vs `lib/providers.js:89-160`，同端点同解析，超时分类分别为 `unavailable` 与 `timeout`。
  - stream usage 提取重复：`lib/index.js:2032-2039`、`lib/usage.js:171-198`，宿主已导出 `lastAssistantStreamChunk`（`deepseek-harness/packages/llm/llm/src/assistant-stream.ts:373`，token-meter 亦使用）。
- **修复**：余额统一到一个实现/一套状态词汇；优先复用宿主 `lastAssistantStreamChunk`，仅保留插件特有语义（attempt 与 message 的替换规则）在本地。
- **验收**：超时/网络失败在两条账户路径得到同一 status；stream 样本提取的现有重试/回退用例保持通过。

### [ ] P2-9 客户端低优先项（合并）

- **重复过滤**：服务端已按 provider 过滤，客户端再次全量过滤（`lib/client.js:2261-2265`，调用点 `:4017`、`:6729`、`:6783`；合成 365 天约 4.4ms/次）。建议服务端返回“已过滤”标记或客户端信任服务端。
- **隐藏页签的事件请求**：`keepMounted` 保留但不可见时，全局事件回调仍可请求 `/limits`、`/providers`；`/keys` 在 effect 初始化和 provider 查询失败回退时读取（`lib/client.js:4037-4076`、`:4148-4160`）。按已有 `surfaceVisible` 门控后台事件读取，并在恢复可见时刷新；常规 usage/余额/限额定时轮询已有可见性门控。
- **请求合并（待量化）**：`lib/client.js:4148-4160` 仅注册 `loadLimitStatus` 的事件回调，首次主动调用在 `:4167-4184`，不能据此判定挂载时固定调用两次。侧栏与面板确实分别读取 limits；先统计实际请求数和触发时序，再决定是否合并。
- **a11y**：概览/明细 tab 缺 `aria-controls` 与对应 `role=tabpanel`（`:4298-4324`，对照设置页 `:6576-6596` 已正确）。补齐关联并保持键盘 `navigateTabs` 行为。
- **验收**：请求数统计（改前/改后）；jsdom a11y 断言；键盘/读屏路径人工核对。

---

## 可选改进（无实际影响证据，先不排期）

- **`settings.describe()` 热路径缓存**：`accounts/get`、`limits/get` 每次调用都会重建所有 active entry 的 schema/表单并 redact（`lib/index.js:389-390`、`:655-662`；宿主 `deepseek-harness/packages/settings/settings/src/index.ts:302-341`）。可用 `settings/document-updated(ns, revision)` 做失效缓存，或每请求只调一次。
- **工作区分组接 `workspaceRegistry`**：用宿主 canonical path（realpath）+ durable title 替代原始 `cwd` 分组，避免符号链接/尾斜杠拆行（`lib/index.js:2004-2031`；宿主 `.../workspace/workspace/src/index.ts:292`、`:502`）。历史 ledger/frozen 已冻结原始 cwd，需展示层反查或一次性重写迁移。
- **只判存在性时改用 `credentials.describe(ref).configured`**，替代实际 resolve 凭据值（`lib/index.js:305-313`）。
- **用 `APP_IDENTITY.version` 替代 `createRequire("@deepseek-ai/dsh-llm/package.json")`**（`lib/index.js:554`）。
- **`cordis.patch.yml` 简化**：当前 `config.trustedHosts` 与宿主 web-app connection 行等价，而 patch 按顶层 key 整体覆写；可评估只保留 `inject` 覆盖（`cordis.patch.yml:16-18`；宿主 `.../bundle/web-app/cordis.patch.yml:236-245`）。`webRuntime` 是旧宿主兼容分支，不能因当前宿主不提供它就当作死代码删除；移除配置或插件自身 `webServer` 注入前，仍需验证受支持旧宿主的 bundle 装配与通道归属。
- **批量删除用宿主 `deleteMany`**（`lib/storage.js:319-325`）；`data/trim` 可减少多写槽与自维护 stale 恢复。
- **base64 logo 改用宿主 asset 机制**：约 27KB 内联在 bundle 中，宿主支持 `require.asset("plugins/<pkg>/assets/<emitted>")` 与 `dsh.client` 资源路由（`deepseek-harness/packages/client/modules/README.md` Package assets）。
- **客户端细节**：图表字面量色板集中为 token/色板；tooltip 同时叠 border 与 elevation 违反宿主 `docs/web-styling.md` 基线；侧栏触发按钮补 `aria-expanded/aria-haspopup`；`TruncatedModelName` 评估宿主 `Tooltip`；`check-client-css` 加 ratchet 防死样式累积；smoke 文本断言逐步改为 DOM 断言。
- **`test:host-current` 的版本取值区分用途**：实际宿主依赖装配、日志中的版本从所选 manifest 推导；用于证明未来版本不被元数据限制的显式版本样例保留，不从旧依赖 lock 反推未来支持范围。

---

## 修复边界（避免过度修正）

- **不要**用宿主 `tokenMeter` / `tokenUsage` / `sessionStats` 投影替换插件的 ledger：它们只有每会话四类 token 汇总，无成本、无日/小时维度、无 provider 归属、不跨会话落盘；插件需要跨会话长期聚合 + CNY 计费 + 冻结归档。可复用的只是样本提取 helper 与替换语义。
- **不要**无条件把标题读取换成 `sessionQuery`：projection cache 可能未 seeding，宿主默认并发/缓存低于插件现状；必须保留持久层回退并做冷/热基准。
- **不要**为了删兼容分支而删除旧宿主支持：`settings.register`、`webRuntime`、`settings.get` 等分支对旧宿主仍可能是必经路径；先决定支持范围，再按版本策略清理（本清单未把兼容分支列为缺陷）。
- **不要**在未量化前重写客户端构建：宿主构建 preset 未发布给外部插件，引入构建需自带 tsdown/lightningcss 并复刻 `__ModuleLoader__`/CSS/资产契约，属独立改造。

---

## 已核查无问题（无需修复）

- **seam 签名**：settings `describe/update/replace/mutate/configure`、storageDomain `open` + `invalidRecords` backup-and-skip、sessionPersistence `list/open/read` + `SessionFormatUnsupportedError`、deepseekAccount `getState/watch(signal,true)/getBalance`、pluginManager `listBundles/listVersions/updateBundle`、`plugin-manager/update-state`、`webStartup`/`webServer` 组合——均与宿主 `fcc0ad4621` 一致。
- **P2-8 RPC `authority` 第三参（保留兼容，无需修复）**：当前宿主 `handle(channel, handler)` 忽略第三参，但 `lib/rpc.js:87-90` 明确为 `<=0.1.1-rc.x` 旧宿主保留 `{ authority: "loopback" }`；`scripts/test-rpc.mjs:53-68` 也覆盖传参。当前宿主由传输层统一认证，已认证远程 peer 的权限属于宿主通道模型；现有代码注释已区分两代行为，不因新宿主忽略参数而删除兼容代码。
- **计费口径**：北京时间固定 day/hour、`completedAt` 归因、峰谷/周末、BigInt 纳米舍入、未知价格→null、流重试替换——代码与最小复现核对未发现错误。
- **生命周期**：RPC/storage domain/account watch/后台刷新均有 effect/AbortController 清理，未发现泄漏。

## 本次复核验证与边界

- 已运行 `node scripts/test-usage.mjs`、`node scripts/test-pricing-review.mjs`、`node scripts/test-rpc.mjs`、`node scripts/test-official-state.mjs`，均退出 0；本次仅修订清单，未修改插件实现，待修复项不因此标记完成。
- 离线 fixture 已复现：Moonshot 缺省 `apiKeyEnv` 时误用 `MOONSHOTAI_API_KEY` 并判未配置，显式指定 `MOONSHOT_API_KEY` 时正常；真实 ledger 渲染路径全部视图 `requestCount=2`、单供应商 `=1`；价格候选已携带回退标记且两路失败会拒绝；`legacyCacheImported=false` 不会使已初始化 domain 重试。
- 本次未运行完整 `npm test` / `test:host-current`；`docs/host-audit-2026-11-11.md` 已记录此前完整验证，实施代码修改前按当前工作区与改动范围判断哪些结果仍可复用。
- 未在真实浏览器验证 Toast 重叠、隐藏页签时序与视觉回归；P1-3/P1-4/P2-9 的验收需要浏览器或 jsdom 补测。
- 未连接真实供应商/官方价格页面；本次凭据发现和回退控制流使用离线 mock 验证，真实端点与抓取格式仍未验证，涉及这些路径的实现修改再做对应网络冒烟。
- 未做自定义 `DSH_HOME` 的完整启动及磁盘迁移复现；已验证路径解析差异和初始化重试条件，P1-5 仍需临时目录集成用例覆盖实际补导入。
- 性能数字来自原审查的合成数据基准（状态规模/归档天数/活跃小时假设），本次未复测，线上历史分布未采样；P0-1/P0-2/P1-1 实施时补充可复用的仓内基准脚本、环境与输入参数，并以代表性数据形态复核。
