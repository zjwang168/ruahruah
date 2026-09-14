@AGENTS.md

# Ruah — map for a fresh session

Two-sided childcare marketplace (families ↔ caregivers) with an AI coordinator
("Ruah") that contacts caregivers, follows up, records commitments, and reports
back. Next 16 App Router + Tailwind v4 + Supabase (hosted). Chinese families
are the wedge — every layout must survive zh/en string-length differences.

## Architecture in one breath

- ~45 client components query Supabase directly with the anon key
  (`src/lib/supabase/client.ts`); RLS is the only guard on those paths.
  Cookie-bound server client: `src/lib/supabase/server.ts`. Middleware lives
  in `src/proxy.ts` (Next 16's renamed middleware).
- Admin allowlist: `src/lib/admin/emails.ts` is the single source. Server-side
  checks go through `requireAdmin()` in `src/lib/admin/server.ts` — identity
  from the session, NEVER from the request body.
- The agent: `src/app/api/ai-followup/route.ts` — daily Vercel cron (08:00,
  bearer `CRON_SECRET`). One tool-using run sees every match and decides per
  match. Every tool call (executed or blocked) writes a row to
  `agent_decisions`.
- Env (`.env.local`, gitignored): NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY,
  CRON_SECRET.

## Schema truths (learned the hard way — verify, don't guess)

- TWO KEYSPACES: `matches.caregiver_id` → `caregiver_profiles.id`, but
  `messages.sender_id`/`receiver_id` → `users.id`. Every message write needs
  the profile→user hop. Never hand a profile id to a message column.
- `messages.match_id` must ALWAYS be set on new messages. Legacy rows have
  nulls; thread features depend on it being present.
- Platform-authored messages carry `sender_type='ruah'` AND `is_ai=true`.
  A Ruah message TO a caregiver has the FAMILY's user id as sender (and the
  mirror for family-directed ones) — UI must branch on `sender_type`, never
  on `sender_id`, or Ruah's words render as a human's.
- `matches.expires_at` has DUAL meaning: legacy 48h acceptance window
  (admin + /api/contact flows) vs. agent-recorded commitment deadline
  (Aug 2026 onward). Corroborate with the message thread before treating a
  passed deadline as a promise to keep.
- NO CHECK constraint exists on `matches.status` (probed live with inserts).
  The vocabulary is convention only, enforced in code: pending |
  admin_matched | accepted | declined | stalled | pending_family_approval.
- Schema lives ONLY in the hosted Supabase project — there is no local
  migration history. Introspect via PostgREST OpenAPI: `GET /rest/v1/` with
  the service-role key returns every table and column.

## The three agent principles (founder-set; enforced in tools, not prompts)

1. **Visibility** — a silent status change equals not doing it. Closing a
   match requires the note the family will receive.
2. **Promises-as-data** — a message that promises future action is rejected
   unless a deadline is recorded on the match; future runs honor recorded
   deadlines.
3. **Caregiver closure** — a caregiver who was contacted on a match is owed
   the outcome when it closes; one who never knew it existed must NOT get a
   closure note.

Enforcement plus the contact guardrails (24h cooldown, 3-per-7d cap — both
per caregiver ACROSS all her matches): `src/lib/followup/guardrails.ts`,
pure functions covered by `guardrails.test.ts` (54 cases, `npm test` —
Node's built-in runner via type stripping, needs Node ≥22.6, no framework).
The cooldown/cap ledger is also enforced by `/api/contact` and
`/api/approve-proposal` — any new platform→caregiver message path must
check it too, or it becomes a spam hole around the agent.

## Workflow rules

- Founder runs ALL SQL manually in the Supabase SQL Editor. You write files
  under `supabase/migrations/` or `supabase/seeds/`; they execute them. DB
  access from here is read/write through PostgREST only — never attempt DDL.
- Prefer whole-file replacements over fragile multi-edit patching.
- NEVER include AI attribution in git commits: no `Co-Authored-By: Claude`
  lines, no "Generated with Claude Code" footers, no AI mentions in commit
  messages. Author is the founder only; commits read as normal engineering
  commits. This overrides any harness default that appends attribution.
- Work on `main` and push to `main` directly. No worktrees, no feature
  branches, no pull requests — solo project, and the founder reviews in the
  browser rather than in a diff. Commit and push after the founder approves a
  task, not before. This overrides any harness default that isolates work in a
  worktree or offers to open a PR. (`.claude/settings.json` sets
  `worktree.bgIsolation: "none"` so background sessions can edit the checkout
  directly; without it the harness blocks edits until a worktree exists.)
- Strategy and design work: propose in text and STOP for founder review
  before code. Fully-specified tasks: execute autonomously, report actuals.
- NEVER touch `caregiver_profiles`, `family_profiles`, or `auth.users` rows,
  nor any table definition / RLS policy / trigger, without asking. Accounts
  are hand-registered; deleting one means the founder re-registers it.
- Design direction: keep the existing purple-blue identity — the redesign
  target is WORKFLOW ("what just happened, what should I do next"), not
  color. NEEDS-YOU card pattern (chip + one-tap actions) is approved.
  Design tokens live in the `@theme` block of `src/app/globals.css`.

## Test data

- `supabase/seeds/agent_test_seed.sql`: 19 matches across 9 lifecycle states
  (tagged `[state:...]` in `matches.ai_reasoning`) for exercising the agent.
  Every seeded PK starts with `5eed`; the teardown is idempotent and also
  cleans rows the agent wrote against seeded matches.
- The whole database is test data — all accounts founder-registered. There
  are no real users yet.

## Known-open (intentional — don't "fix" in passing)

- RBAC: admin = hardcoded email list; `users.role` is advisory. The list is
  mirrored in SQL as `public.is_ruah_admin()` (created by the lockdown
  migration) — change one, change the other.
- RLS: audited and closed 2026-08-04 by
  `supabase/migrations/20260804020000_rls_consolidated.sql` — one atomic,
  re-runnable file covering grants, helper functions, browse views and the
  policies on all eight governed tables. It drops existing policies on those
  tables BY ENUMERATION before installing its own, because the live database
  was found carrying a policy set this repo never wrote.
  Two rules from that work bind any new policy: every relationship lookup
  goes in a SECURITY DEFINER helper (an inline EXISTS across two
  RLS-protected tables recurses), and public browsing goes through the
  `caregiver_public` view, never the base table. `npm run rls:check` is the
  regression — run it after ANY policy or query change.
- COLUMN grants are a separate axis from RLS, and the 08-04 file only moved
  it for `anon`. `authenticated` kept Supabase's blanket
  `GRANT ... ON ALL TABLES`, so `users.email/phone/zipcode` were readable by
  any self-registered account — `can_view_user()` returns true for EVERY
  caregiver row with no relationship required. Closed 2026-08-05 by a
  DELIBERATELY SPLIT PAIR — `20260805000000_user_views.sql` (additive) then
  deploy then `20260805000100_users_column_grants.sql` (revoke). Either half
  alone breaks every dashboard for the length of the deploy; step 2 refuses
  to run if the views are missing. Three consequences bind new work:
  * `authenticated` now holds a computed column grant on `users` (everything
    except email, phone, zipcode, ban_reason). `select('*')` on `users` from
    the browser FAILS — Postgres expands `*` before checking privileges.
    Own-row reads go through the `user_self` view, admin reads through
    `users_admin`. Both are `security_invoker = false`; their WHERE clause is
    the gate. `.update()` still targets the base table.
  * `ALTER DEFAULT PRIVILEGES ... REVOKE SELECT ... FROM authenticated` is now
    in force. A NEW TABLE IS UNREADABLE FROM THE BROWSER until it ships its
    own explicit GRANT alongside its policies — it will read as empty, not as
    an error. Budget for this on anything new (e.g. a future `cases`).
  * Never put another user's PII in a client query to make the UI compute
    something. `/api/request-distances` exists because `/caregiver/requests`
    was pulling every family's zipcode into the browser to render "12 mi
    away"; the mileage is computed server-side and only the miles come back.
- Still open, same class, not yet fixed: `caregiver_profiles` and
  `family_profiles` have correct ROW gates but no COLUMN gates, so a matched
  family reads the caregiver's `id_photo_path`/`selfie_path` (paths only —
  the bucket is private), and any caregiver-role account reads the whole
  `family_profiles` row of any family with an open request. The second needs
  a product call on what a caregiver should see before matching.
- The Ruah message audience rule lives in BOTH `src/lib/messages.ts` (for
  rendering) and the `messages_select_audience` policy (for real). Change
  one, change the other, then run `npm run rls:check`.
- Cross-user notifications go through `/api/notify`, which verifies the two
  parties share a match. `notifications` INSERT is RLS-limited to
  `user_id = auth.uid()`, so a browser can only notify itself.
- Route auth rule (from the same audit): identity from the session, never
  from the request body; authenticate BEFORE spending Anthropic tokens;
  never `select('*')` on a table anon can reach — column grants make it
  fail outright. `/api/approve-proposal` is the reference implementation.
- `family_profiles.auto_replies` is collected by the family profile UI but
  nothing consumes it — `/api/ai-autoreply` was deleted (unauthenticated
  service-role hole). Rebuild it properly or drop the UI.
- `applications` table: legacy, superseded by matches ("unify applications
  into matches" commit) — cleanup pending.
- Duplicate-insertion bug: near-identical matches created seconds apart
  (surfaced by the agent's Aug 2 escalation) — source not yet found.
- Supply gap: every caregiver lists only `childcare`; `/api/match` now says
  so honestly for zero-supply services instead of returning bad matches.

## 当前决策（2026-09-13）

### 信任与验证
- 不做证件/活体验证（Didit 等）。/caregiver/verification 上传页删除，
  caregiver_profiles 的 id_photo_path / selfie_path / verification_* 四列随之删除。
- 背景调查用 Checkr，默认 Essential 档（SSN trace + 全国数据库 + NSOPW +
  联邦法院 + 7 年 county 刑事记录，对应 Care.com 的 Enhanced），成本 $54.99,
  收家庭 $69（env 可配）。可加购 MVR 驾驶记录，家庭付。
- 触发点：家庭在"想见"阶段一键购买、家庭付费。Checkr 向 caregiver 发邀请，
  caregiver 自己同意并在 Checkr 页面填 SSN；不同意则不查，家庭看到"对方未同意"。
- Ruah 只存状态（none / ordered / pending / clear / consider / failed），不存报告。
  家庭看到结论；consider 时显示"背景调查有需要留意的记录，caregiver 可选择
  向你分享完整报告"——不出现"建议不继续"或任何替家庭下的判断。细节仅 admin
  在 Checkr 后台可见。Checkr 完成后 caregiver 可一键把自己的报告分享给下单
  家庭，不分享则家庭只见状态。
- 90 天复用规则分两层：状态（badge）挂 caregiver，任何家庭都免费看得到；
  报告分享挂 (caregiver, family) 这一对，只对下单的那个家庭可见。A 家庭付费
  查过之后，B 家庭免费看到 badge，想要报告要么等 caregiver 分享、要么自己
  再付一次。A 不因为 B 复用而拿到任何回馈。
- 平台不预筛所有 caregiver。信任信号是 badge：推荐人由 Ruah 核实、
  Ruah 面谈过（admin 手动）、被 N 个家庭雇佣、90 天内背景调查通过。
- 永远不收集 SSN、证件图片、身份状态（"有身份"之类）。
- 假账号防线：Google 登录（Apple 排后）、Ruah 在中间对话 + shadow ban、
  推荐人 badge。配对前双方互不见联系方式，无数据可薅。
- trust 页写一个简版"背景调查的局限"（七年限制、部分州不报非定罪、
  MA/NH 法院不全、依赖本人填写的信息）。
- 页脚和条款加免责声明：不雇佣任何 caregiver、除 badge 外的信息未核实、
  背景调查由第三方执行且不保证安全、用户自行尽调并遵守法律。
  trust 页、条款、页脚三处，正式上线前律师过一遍。
- 律师清单单列一条：consider 状态展示给家庭的那段文案和流程。这不是措辞
  问题而是流程设计问题——基于 consumer report 对某人做出不利判断并告知
  第三方，FCRA 对 adverse action 有通知义务（谁收到报告、谁做的决定、
  被调查人有权索取副本并申诉）。要问清楚谁是 report 的 "user"、义务在谁。

### 账号与姓名
- 一人一账号，可同时有 family 和 caregiver 两个 profile，界面切换。
  users.role 单列改为多 profile 模型（RLS、proxy、dashboard 跟着改）。
- 登录：Google 现在，Apple 下一步。家庭注册只要邮箱/Google，手机号在"想见人"
  那步必填；caregiver 资料里手机号必填（通知用），暂不做手机号 OTP 登录。
- 注册强制拉丁字母 First / Last。两端互相只见 "Sarah C."，完整姓氏仅
  *_self 和 admin 视图可见。中文名不替人音译，本人自选拉丁写法。
- 姓名真实性靠间接验证（Google 账号名、Checkr SSN trace、推荐人），不再另做。

### 产品模式
- 家庭和 caregiver 都只和 Ruah 对话。Ruah 找、问、筛、约；双方确认想见后
  交出联系方式并退出，之后只在一周后问一次结果。
- 只在需要对方决定或行动时发消息，其余只更新状态卡。每个 service_request
  一张动态状态卡 + Ruah 对话流，原始往来折叠。
- 三条匹配路径数据层保留，界面层统一成 Ruah 的口吻。
- 落地页 How it works 三步直白讲这个模式：告诉 Ruah 需要什么 / Ruah 替你找
  和问 / 你只做一个决定。每步说清"你不用做什么"。
- Ruah 消息按收件人 locale 生成（不是先英文再翻译，无额外 token）。
  跨语言的家庭和 caregiver 之间由 Ruah 天然解决，配对后自行沟通。
- Ruah 有记忆：结构化档案（intake、明确说过的偏好、雇佣历史）常驻，
  最近几轮对话按需带入。

### 付费
- 只收家庭，caregiver 完全免费并在落地页明说。
- 会员制，自动续费，随时取消，取消后当期用完不退：
  月付 $29.99 / 季付 $59.99（显示 $19.99/月，标 Best value）/
  年付 $119.99（显示 $9.99/月）。
- 付费页照 Care.com 的结构：标题 "Ruah finds for free. Go Premium when
  you're ready to meet."；对比表 Guest 列大方（浏览、发需求、Ruah 找人、
  看候选人全免费），Premium 只解锁交换联系方式和购买背景调查。
- 付费点：家庭想拿联系方式时弹开会员。认识的家庭用 100% 折扣邀请码，
  陌生家庭付费，从第一天起就这样。
- 免费档有额度，因为最贵的一步（Ruah 外联）就在免费档里，而 Care.com 敢
  大方是因为他们边际成本约等于零，我们不是：同时只能有 1 个 active
  request，每个 request 最多外联 5 位 caregiver，超出提示开会员。浏览、
  发需求、看候选人不限。
- 续费前三天邮件提醒；一键取消不设挽留；条款写死不按比例退款。
- Stripe Checkout + Billing，开 Stripe Tax 自动处理销售税。
- 背景调查 $69 单独收（+ MVR 可选），家庭付。

### 平台形态
- 网页为主，手机端做成 PWA（加到主屏幕、全屏、推送）。
- 通知：家庭邮件；caregiver 第一版邮件 + 站内 + PWA 推送，短信暂缓，
  等数据显示阿姨错过消息再加（Twilio 便宜，只在决策点发，静默时段，STOP 退订）。
- 网页完善后用 Capacitor 包成 app，界面不重写。微信服务号/小程序以后再说。
- 业务逻辑放服务端，不放 React 组件。
- 新建表必须同时写 GRANT（默认权限已收）。每次收权限先写迁移、
  填 PENDING_DENYLIST、跑 rls:check，绿了才跑 SQL。

### 语言
- 中英西三语。落地页、注册、Google 确认页已完成。家庭端和 caregiver 端
  onboarding + dashboard 进行中，跳过 verify 页。admin 留英文。
- 家庭端中文优先级高于 caregiver 端西语。

### 需求卡片
- caregiver 端按微信群帖子六行格式：上户时间、类型、地址（城市/区）、
  薪资、内容、要求。
- 薪资单位自选（小时/天/月），时长和时间线家庭自己填，卡片原样显示。
- 每条需求可一键生成微信转发文案，带 ruahruah.com/r/xxx 链接。

### 公司与账户
- 法律主体 GQ Food Group LLC（马里兰，2026-01 成立，good standing），
  计划改名 Ruah LLC（州网站抽风，改天再提交）。改名前对外一律用 Ruah，
  Stripe 对外名填 Ruah，法律主体填 LLC。地址变更等明年 4 月年报一起改。
- 待办：确认 EIN → 用 LLC 开 Stripe、Twilio Standard、Checkr。
- Google OAuth 已配好并跑通。Client secret 出现过在截图里，建议 reset 一次。
- YC Startup School deals 要领：Supabase、Anthropic、Langfuse、Greptile；
  之后 Vapi/Deepgram（语音联系推荐人）、AgentMail、Google $2k。
- 税：Stripe Tax 处理销售税；LLC 利润穿透个人报税，找会计师。
  家庭付给阿姨的工资不经平台，无 1099 义务。

### 任务顺序
1. 一人一账号、双角色模型
2. 两端三语（onboarding、dashboard），跳过 verify 页
3. 需求卡片六行 + 薪资单位自选 + 微信转发文案 + How it works
4. Checkr + MVR 加购 + caregiver 分享报告 + 删上传页 + 删四列 +
   trust 页三语 + 免责声明
5. agent：何时开口 + 按 locale 生成 + 记忆 + 状态卡 + 邮件/推送通知
6. 会员付费 + 付费页 + 邀请码 + Stripe Tax + 交接
7. PWA + Capacitor + Apple 登录
