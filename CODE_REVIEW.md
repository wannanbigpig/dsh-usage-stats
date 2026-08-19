# dsh-usage-stats 全仓库代码审查报告

> **审查日期**:2026-08-26
> **审查范围**:`lib/` 全部 13 个模块(~9,600 行)、`scripts/` 全部 13 个 `.mjs`、`cordis.patch.yml`、`package.json` 打包契约
> **审查对象**:当前工作区(含未提交的 requestCount / 月度限额继承 / unscoped 去重改动)
> **审查方式**:逐文件精读 + 并行子代理全文通读 client.js(6,360 行)与 scripts/ + `npm test` 基线 + 5 组只读复现实验 + 基准测试
> **审查性质**:只读,未修改任何源文件

---

## 目录

- [总体摘要](#总体摘要)
- [一、中级问题(12 项)](#一中级问题12-项)
- [二、低级问题(21 项)](#二低级问题21-项)
- [三、测试覆盖缺口](#三测试覆盖缺口)
- [四、基准测试数据](#四基准测试数据)
- [五、已核查无问题的方面](#五已核查无问题的方面)
- [六、优先修复建议](#六优先修复建议)
- [七、未验证项](#七未验证项)

---

## 总体摘要

工程质量明显高于同类插件项目。服务端纯模块化 + Zod 严格 schema + BigInt 纳米级冻结费用 + 原子存储更新 + 单飞行(single-flight)缓存 + 循环回环授权 RPC;密钥只经凭据 seam 解析、全文 grep 无 `innerHTML`/`dangerouslySetInnerHTML`/`eval` 等 XSS 注入面;北京时间 `dayKey/hourKey` 换算、峰谷/周末计费边界经实验验证正确;测试套件零真实网络、临时目录卫生、退出码契约可靠,`npm test` 本机全绿(exit 0)。

主要风险集中在四点:

1. **用量正确性的两个边界**——同 `(turn, step)` 流式重试丢样本、requestCount 的 day/hour 口径不一(后者在未提交改动中,建议修复后再提交);
2. **llm/stream 热路径的串行阻塞**——满账本时单次调用约 60-80ms(实测),直接叠加在流式首字节延迟上;
3. **客户端错误路径静默**——供应商加载失败永久空白、限额乐观保存失败不回滚;
4. **测试覆盖声明与实际的落差**——约 2/3 RPC 端点、balance.js 解析、pricing.js 官方页抓取、告警/硬停/后台刷新均为盲区,smoke-client 的字符串断言提供虚假覆盖感。

**结论**:无阻断性缺陷,可正常发布迭代;未提交的 requestCount 改动建议修复中级第 2 项后提交。

**统计**:中 12 项(已确认缺陷 6 / 风险 6);低 21 项(已确认缺陷 3 / 风险 14 / 待确认 4);无高危。

---

## 一、中级问题(12 项)

### [中-1] lib/ledger.js:622-624 + lib/index.js:1681-1701 — 同一 (turn, step) 的流式重试静默丢弃新 usage

触发条件:Harness 对同一 sessionId 的同一 (turn, step) 重试 llm/stream,且第一次尝试已上报 usage chunk(如供应商在 usage 后断流、上层重放该步骤)。

影响:重试那次的真实用量与费用永久丢失——第二次调用以相同 sampleKey 进入 recordLedgerState 时,被 recentSampleKeys 去重前置检查拦截(replaceSampleKey 仅 event 路径为 true),直接 return 原状态;appendLedger 内部的"同 sampleKey 替换"逻辑根本没机会执行。日限额/硬停止据此少算。

证据(本机复现):第 1 次 sampleKey "s:0:1" 记 10 tokens;第 2 次同 key 记 5000/300 tokens 后 ledger 仍为 1 条、usage 仍为 {inputTokens:10};设 replaceSampleKey:true 才被替换为 7000。与 usage.js 头注声明的"REPLACES the earlier value"语义相悖。

分类:已确认缺陷(边界场景)

### [中-2] lib/usage.js:585 + 617 + 629 — requestCount 的 day 口径与 hour 口径不一致(未提交的新功能)

触发条件:某天存在"仅零 token 样本"的模型(warmup 请求上报 {0,0}),或某模型当日只有零 token 调用。

影响:day.requestCount 对 tokens>0 过滤后的模型行求和(585 过滤 → 629 求和),而 hour.requestCount 对含零 token 行的完整列表求和(617)。本机复现:零 token 的 model-a + 正常的 model-b → day.requestCount=1,对应 hour.requestCount=2。"日 ≠ 各小时之和"违背自身一致性;README 新增的"请求次数"口径说明无法自洽。

分类:已确认缺陷(位于当前未提交改动中,建议提交前修复)

### [中-3] lib/index.js:1205 — evaluateStatus 兜底分支把"不可靠(null)的今日费用"当作可靠的 0

触发条件:targetKey 来自 keyProviders 映射、但不在 config.keys 与 limits.keys 的并集中(check() → keyForProvider 可返回任意映射 ref;validateConfig 不要求映射 ref ∈ keys)。

影响:statuses[ref] 未命中走兜底 evaluateKeyQuota({ todayCost: day.cost ?? 0 }),当日含未定价模型时 day.cost 为 null → 被抹成 0 且 todayCostReliable 缺省为 true,恰好违反本文件 819-821 行反复强调的"绝不能把不可靠消费当 0"原则,限额/硬停止整日失效。

证据(本机复现):对未知 key 传 todayCost:null + 已启用限额 10 + stopOnExceed → status "normal"、blocked false。

分类:已确认缺陷(边界场景)

### [中-4] lib/index.js:1686 + 1202(性能)— 每次官方 llm/stream 调用前同步全量渲染 ledger,写入路径再叠 3 次全量 clone/parse

触发条件:ledger 接近容量上限(默认 5000 条,约 53 个自然日)时的每次官方模型调用。

影响:check() → evaluateStatus → collectUsage → renderLedgerState 实测 21-35ms(100 次均值 21.5ms);完成后 recordLedgerState ~8ms + storage 层 StateSchema.parse 14.3ms + 2×structuredClone ~19ms。单次调用合计约 60-80ms 串行阻塞事件循环,直接叠加在流式首字节延迟上。(注:先前报告称 255ms,本机实测显著低于该值,但结构问题相同。)

证据:本机基准——renderLedgerState(5000 条/53 天) 34.4ms;StateSchema.parse 14.3ms;clone 9.7ms;append 8.1ms。renderLedgerState 内部要跑 4 次 renderUsage(estimated/exact/combined/frozen),结果无缓存。

分类:风险

### [中-5] lib/client.js:2182 + 2225-2229 — 供应商列表加载失败时,查询面板无错误提示、无重试入口

触发条件:/providers 与 /keys RPC 均失败(服务端插件异常/升级窗口)。

影响:loadProviders 两级 .catch(() => {}) 吞掉全部错误,selectedProviderId 保持 null;loadUsage 在 2182 行早退不拉数据,面板静默空白,用户只能重开页面碰运气。

证据:if (activeTab !== "summary" && !selectedProviderId) { setUsageLoading(false); return Promise.resolve(); }(已核对原文)。

分类:已确认缺陷

### [中-6] lib/client.js:2503 / 2505 — 所选日不在 recentList 时"前一天/后一天"导航方向错乱与死按钮

触发条件:选中"昨天"或热图老日期,该日恰无用量记录 → findIndex 返回 -1。

影响:"前一天"执行 pickDay(recentList[0]) 跳到最新有用量日(方向反向);"后一天"的 if (index > 0) 对 -1 恒假,按钮可点但完全无效(disabled 条件用日期字符串比较,此态不禁用)。

证据:已核对 2503/2505 行原文(onClick 内 findIndex -1 分支)。

分类:已确认缺陷

### [中-7] lib/client.js:2290 等(性能)— 查询面板派生聚合全部未 memo,每次渲染全量重算

触发条件:面板打开期间任意 state 变化(60s 轮询、loading 翻转、tab/筛选切换),一轮刷新至少 5-6 次重渲染。

影响:summarize(全量 days)、recentList、heatDayMap、providerUsageCapacity(与 focusedRangeDay 重复 filterDay)以及 JSX 内联 buildYearContributionHeatmap(约 372 天网格)每次重算,历史数据多时明显卡顿。

证据:const stats = summarize(days, activeModelFilter, serverToday); 等均无 useMemo 包裹。

分类:风险

### [中-8] lib/client.js:1817 + 1548 — pricing.peakHours 元素结构未校验,解构即抛 TypeError

触发条件:服务端返回的 peakHours 为数组但元素非二元数组(字符串/对象/null);pricingOf(1434)只校验数组整体。

影响:visiblePeakHours.map(([start, end]) … 与 isPeak 的 for…of 解构直接抛错;无 ErrorBoundary 时整个插件区域白屏。

证据:visiblePeakHours.map(([start, end], index) => … style: { left: `${100 * start / 24}%` …

分类:风险

### [中-9] lib/client.js:2892 + 2780-2782 + 3751-3772 — 限额/预警控件乐观更新,保存失败不回滚

触发条件:limits/alerts POST 失败(网络错误或服务端校验拒绝)。

影响:patchLocal 先写本地状态,失败仅 setError;UI 与服务器持续不一致直至重开设置页。对 stopOnExceed 这类影响调用阻断的开关,界面显示与实际生效配置可能相反。

证据:patchLocal({ enabled: event.target.checked }); handleSave({ enabled: event.target.checked });(PlanQuotaCard 同)。

分类:风险

### [中-10] scripts/smoke-client.mjs:32-487 — 200+ 条对 client.js 源码的字符串字面量断言构成"变更探测器"

触发条件:对 client.js(378KB 手写 bundle)做任何等价重构——CSS 顺序、类名、i18n 文案、JSX 写法。

影响:行为完全不变也大面积红测,维护成本极高;反之断言只证明"字符串存在",不证明组件行为正确,提供虚假覆盖感。真正的行为测试(renderToStaticMarkup/JSDOM)只覆盖其中一小部分。

证据:if (!source.includes('width:920px') || !source.includes('Math.min(920, window.innerWidth - panelGutter * 2)')) throw new Error(…)

分类:风险

### [中-11] scripts/test-server.mjs:401-402 — "端点面已被 dispatcher 测试覆盖"注释不实,16 个端点仅约 5 个被服务端实测

触发条件:改坏 keys/list、providers/list、balance/get、limits/get/update、pricing/get/update(含 fetch-official)、alerts/get/update、data/trim 中任意一个。

影响:npm test 仍全绿。grep 证实 createUsageOperations 在 scripts/ 仅出现于 import(12 行)与 typeof 检查(402 行),从未被实例化;test-server 经 harness.rpc.handler 只调了 usage/get、data/rebuild-estimated、accounts/update、data/get、data/clear 和一个 unknown 端点。

证据:// Operations constructor exposes exactly the official endpoint surface through dispatcher tests. + assert.equal(typeof createUsageOperations, "function");

分类:已确认缺陷(覆盖缺口 + 误导性注释)

### [中-12] scripts/test-storage-json-integration.mjs:12-24 — 兄弟目录 deepseek-harness 不存在时静默 exit 0

触发条件:在无 ../../deepseek-harness 检出的环境(多数 CI)运行 npm test。

影响:唯一针对真实 JsonStorageBackend 的并发/重启/迁移集成测试被跳过且返回成功;需显式 DSH_REQUIRE_JSON_INTEGRATION=1 才失败,而 package.json test 脚本未设置。第 12 行还以相对路径耦合两仓库检出布局。(本机因目录存在,实际已运行并通过。)

证据:console.log("official JSON backend integration skipped: …"); process.exit(0);

分类:风险

---

## 二、低级问题(21 项)

| # | 位置 | 问题 | 分类 |
|---|---|---|---|
| 1 | lib/pricing.js:341 | defaultPricing() 每次调用重建完整对象,高频默认参数路径重复构造(约 0.1ms/次),可 memoize 为模块级常量 | 风险 |
| 2 | lib/client.js:3321/3693 | accountUrl/sourceUrl(后者来自远端页面抓取)未校验协议即写入 href,可执行脚本 URI 依赖数据可信度;React 不清洗 scheme,rel="noreferrer" 不阻止 javascript: 执行 | 风险 |
| 3 | lib/client.js:5529 | 打开面板触发两次 loadSummary:onClick 先调用,open 变化使 effect 重跑;前一次被序号作废,白拉 5 个 RPC(含全量 usage) | 风险 |
| 4 | lib/client.js:5365 | 侧栏轮询只消费"今日"一行却拉全量 usage days,数据增长后轮询 CPU/序列化开销线性上升 | 风险 |
| 5 | lib/client.js:1597 | 热力图 mousemove 每帧 setHoveredCell,整棵约 371 个 button 重渲染,多年数据下悬停掉帧 | 风险 |
| 6 | lib/client.js:664 | todayKey() 回退用浏览器本地时区,与北京日界最多偏移一天(仅 usage 载荷缺 today 的回退路径) | 风险 |
| 7 | lib/client.js:2134 | 进度条 100 * model.tokens / maxTokens 无数值兜底,tokens 缺失时渲染 width:"NaN%"(2049/2093 处有 Number(x)||0,此处遗漏) | 风险 |
| 8 | lib/client.js:2327 | YEAR_START=2026 硬编码(行 645),2026-01-01(北京)前年份下拉为空、控件与热图状态不一致 | 待确认 |
| 9 | lib/client.js:3091 | accounts POST 响应缺 settings 字段时,合并把 settings 覆盖为 undefined,侧栏显示开关视觉"被重置"直至下次 load | 风险 |
| 10 | lib/client.js:1191 等 | AbortSignal.any/Object.hasOwn/Array.prototype.at/color-mix 无降级守卫,旧内核宿主全面板不可用(Chrome ≥116 / Safari ≥17.4) | 待确认 |
| 11 | lib/client.js:764 等 | 死代码与重复定义:fmtCompact(764)无调用、isPeak(1546)仅导出供测试、4 组无引用 locale 键(usage.rangeToday/rangeMonth、data.rebuilt、settings.tabPricing)、S.modelName 重复定义(536/619,后者静默覆盖) | 已确认缺陷 |
| 12 | scripts/count-tokens.mjs:34 | --tokenizer-dir 吞掉紧随其后的选项名作值,无 "--" 前缀防护(rebuild-today-legacy.mjs:25 有正确做法,行为不一致) | 已确认缺陷 |
| 13 | scripts/count-tokens.mjs:56 | 非交互空/未关闭 stdin 被当空文本退出码 0,"忘给文本"伪装成合法的 0 tokens;永不关闭的管道会挂起 | 风险 |
| 14 | scripts/test-usage.mjs:26 | 首个断言块在 let failures(49 行)之前调用 assert,失败抛 TDZ ReferenceError 掩盖真实信息(退出码仍非 0,已核对) | 已确认缺陷 |
| 15 | scripts/test-usage.mjs:813 | failures 计数与 process.exit(1) 为不可达死代码(assert 失败即 throw 快速退出) | 风险 |
| 16 | scripts/test-package.mjs:15 | 断言 version === "0.2.0" 字面量,每次版本 bump 必红(作为 0.2.0 破坏线临时护栏可理解,长期是发布绊线) | 风险 |
| 17 | scripts/test-server.mjs:402 | 末尾两条断言近乎恒真,撑起"端点面已覆盖"的表象 | 风险 |
| 18 | scripts/smoke-client.mjs:702-753 | 三个 JSDOM 块替换 globalThis 与 rpcResponder 无 try/finally,断言失败不还原(fail-fast 下实际后果为零,但违背自恢复意图) | 风险 |
| 19 | scripts/smoke-client.mjs:800 | flush(190) 对客户端 180ms 关闭延时(918 行)仅 10ms 裕量,与实现计时常数隐式耦合;884 行 flush(220) 对 160ms 裕量同仅 60ms | 待确认 |
| 20 | scripts/rebuild-today-legacy.mjs:55-71 | Connection RPC 的 HTTP 线上信封只被 mock 验证,真实 Harness HTTP 桥契约无人守卫 | 待确认 |
| 21 | scripts/test-conversation.mjs:18-26 | 向 globalThis 写入 window/document/navigator 等不还原(独立进程,当前无泄漏;单进程串联多脚本时会互相干扰) | 风险 |

---

## 三、测试覆盖缺口

完全无测试触及的模块:无(14 个 lib 模块都被至少一个脚本引用)。但存在四块接近"无有效覆盖"的区域:

1. **lib/balance.js** — 仅 body 超时分支被 test-providers.mjs:433-441 直测;DEEPSEEK_SCHEME.parse(CNY 优先、fail-open is_available)、unauthorized/unavailable/invalid-JSON 分类(44-90 行)均无测试。test-providers 的 deepseek-official 用例走 providers.js 自有适配器(两者未互相 import),test-server 的 createBalanceService 全程 mock queryBalance。
2. **lib/pricing.js** — parseOfficialPricingHtml(73)、fetchOfficialPricing(122)、migratePricingConfig(331)零脚本覆盖;官方定价页解析这个最易碎(HTML 结构变化)的部分在裸奔。
3. **lib/index.js(87KB)** — createUsageOperations 16 个端点中约 11 个无服务端调用;告警/通知管线(alerts/get、alerts/update、evaluateAll、toast 投递)完全未测;UsageLimitExceededError 的 stop-on-exceed 硬停执行路径未测(evaluateKeyQuota 纯函数有测,拦截 llm/stream 的效果无测);startBackgroundRefresh(574-627)真实调度/refreshMs=0 停用未测(所有 apply 用例都传 disableBackgroundRefresh: true)。
4. **lib/client.js(378KB)** — 行为覆盖(SSR/JSDOM + test-conversation 折叠行为)质量不错,但设置页交互流程(限流保存回写、账号卡操作、data-clear 确认弹窗、toast 五秒生命周期)主要靠字符串断言背书,而非行为验证。

Mock 契约保真度经重点核对未发现问题:test-rpc 的 {ok,value}/bad-request+issues/cancelled/internal 与 lib/rpc.js:33-77 逐字段一致,{authority:"loopback"} 与 rpc.js:81 一致;FakeTable 用法与 storage.js:149 transform(detached(current)) 克隆语义匹配;mock 返回形状与真实模块一致。

---

## 四、基准测试数据

本机实测(Node 22,5000 条 ledger,约 53 个自然日):

| 操作 | 耗时 | 触发频率 |
|---|---|---|
| renderLedgerState 全量渲染 | 21-35ms | 每次官方 llm/stream 的 check()、usage/get、后台刷新 |
| StateSchema.parse 全量校验 | 14.3ms | 每次 storage.update |
| structuredClone 全量深拷贝 ×2 | 19.4ms | 每次 repository.get()/update() |
| recordLedgerState 稳态追加 | 8.1ms | 每次 llm/stream 完成 |
| 构建 5000 条(迁移路径) | 19.3s | 一次性迁移 |

单次官方模型调用累计阻塞(串行):约 60-80ms。

---

## 五、已核查无问题的方面

- **安全**:全文 grep 无 innerHTML/dangerouslySetInnerHTML/insertAdjacentHTML/document.write/eval/new Function;密钥只在服务端凭据 seam 解析、不落盘不打日志;RPC 声明 authority: "loopback";validateConfig 强制 HTTPS(allowInsecure 显式开启例外);data/clear 需服务端二次确认词。
- **计费正确性**:dayKey/hourKey 北京时间换算、峰谷窗口(含 weekendOffPeakFrom 周末低谷)、costNanosOf BigInt 精确计算、非官方供应商不计费不拉低官方费用等边界经本机实验验证正确。
- **并发**:balance/provider 服务的 single-flight 防重复上游请求;createLoader/summaryRequestRef 序号竞态守卫;storage 表级原子 update;定时器与事件监听清理完整。
- **测试卫生**:npm test 全程零真实网络;全部临时目录 mkdtemp + finally rm;失败即非 0 退出;无未处理拒绝或 CI 挂起风险。
- **打包**:npm pack 校验通过(23 文件,含 LICENSE,files 字段与 exports 一一对应)。

---

## 六、优先修复建议

1. **提交前必修**:中级-2(requestCount day/hour 口径)——对 hour 求和前同样过滤零 token 行,或 day 求和改为不依赖过滤后的模型行。
2. **高收益低成本**:中级-3(兜底分支透传 costReliable)、中级-5(供应商失败给出错误 UI)、中级-6(导航 findIndex -1 守卫)、低-1(memoize defaultPricing)、低-7(NaN 兜底)。
3. **用量正确性**:中级-1(重试丢样本)——评估对 llm/stream 路径的重复样本改为"替换"而非"丢弃"的语义影响。
4. **性能**:中级-4(renderLedgerState 结果缓存 + ledger 版本失效)、中级-7(查询面板 useMemo);低-3/4(侧栏负载裁剪)。
5. **测试**:中级-11(为其余 11 个端点补服务端调用)、中级-12(CI 设 DSH_REQUIRE_JSON_INTEGRATION=1)、中级-10(逐步用行为断言替换字符串断言);为 balance.js 解析与 pricing.js 官方页抓取补测试。

---

## 七、未验证项

依 verification-gate 如实声明,以下内容未能在本环境验证:

- 真实 dsh 宿主内的端到端行为(llm/stream 拦截、sessionPersistence、官方 settings/storage 服约)——仅在测试桩上验证;
- client.js 真实浏览器交互性能(MutationObserver 频率、折叠控制器在大 DOM 下的表现)——静态审查结论;
- 基准数字为本机单次测量,不同机器/数据分布会有差异;
- 低-8/10/19(宿主内核兼容、YEAR_START、计时耦合)标注"待确认",需在对应环境实测。
