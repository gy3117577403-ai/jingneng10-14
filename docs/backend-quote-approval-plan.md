# 京能 10-14 后端落地方案：报价与审批接入真实数据库

版本：方案 v1；日期：2026-10-21（北京时间）
依据：main / 8f42f7cefda9e705d4a7addbcf659ad6faee7b50
状态：仓库已拉取；本文是待实施方案，尚未建立后端、执行迁移或连接业务数据库。

本文保留报价与审批整体方案的历史快照。后续完成的本机报价工作台采用独立实现，实际范围见 [使用说明](./quote-workbench-usage.md) 和 [验收记录](./quote-workbench-verification.md)；本方案中的登录、审批等能力尚未据此落地。

## 1. 交付目标与当前事实

第一阶段交付：业务员登录后创建、保存和修改报价；提交后按顺序进入技术审核、负责人终审；驳回或撤回后能够修改并重提；报价内容、每次提交版本、审批人、意见、时间和状态进入 MySQL，刷新页面和重启服务后仍可查询。

本仓库已新增 React + TypeScript 工程，接入目标为 frontend/。根目录 index.html 是上一版原型，不能用其演示通过情况代替 React 工程验收。

已核实的代码事实：

| 现状 | 证据 | 对落地的影响 |
|---|---|---|
| React 工程已存在，根 README 的进度仍未同步 | frontend/package.json；README.md 第 32 行 | 使用现有工程，先不重建前端 |
| 请求封装默认启用 Mock；真实请求发送 Cookie | frontend/src/api/client.ts 第 9–10、47 行 | 需要真实会话、登录页及联调配置 |
| 实际请求为 /api/quotes、/api/approvals；旧规范描述 /api/quote/quotes | frontend/src/api/endpoints.ts；db/应用接入规范.md | 第一阶段以现有客户端路径为准，并同步文档 |
| 审批按钮只按报价状态显示，未校验当前节点审批人 | frontend/src/pages/Quotes/QuoteDetail.tsx 第 72–96 行 | 需要服务端授权与 allowedActions |
| 审批表只有步骤数字，无节点人员分配；业务单与审批单一对一 | db/schema.sql 第 312–345 行 | 需要真实节点、提交轮次和不可覆盖的历史 |
| 新建 Mock 报价写入一个数组，详情却读取另一初始数组；找不到时返回第一张单 | frontend/src/api/mock.ts 第 43、67 行；frontend/src/mocks/data.ts 第 101–108 行 | Mock 的“新建成功”不能证明新建和详情一致 |
| Mock 评论只返回对象，审批列表也未按登录者归属查询 | frontend/src/api/mock.ts 第 82–101 行 | 评论、待办和经办列表都必须真正持久化并按人过滤 |
| 工作台用第一页 5 条报价计算“本月”指标 | frontend/src/pages/Dashboard/Dashboard.tsx 第 23–35 行 | 需要独立统计接口和明确时间口径 |
| SQL 定义了用户、角色和权限点，但没有角色与权限关联表 | db/schema.sql 第 41–120 行 | 补角色授权关系，不把管理员称谓当作业务审批授权 |

本次只确认了源代码与结构，没有重新运行新 React 工程的构建或浏览器验收；上一轮单文件原型的运行结果不适用于这个新版本。

## 2. 推荐技术方案

采用 TypeScript + NestJS + TypeORM/mysql2 + MySQL 8.4，组织为一个按模块划分的服务。前后端统一语言，沿用现有 MySQL 数据模型，报价与审批可以在同一个数据库事务内完成。

这是基于本仓库的技术建议，并非此前已经确定的企业技术标准。Nest 官方提供 TypeORM 集成，TypeORM 官方支持 MySQL/mysql2；具体包版本在实施时通过兼容性检查后固定到 lockfile，方案不承诺未经安装验证的版本组合。[Nest 数据库集成](https://docs.nestjs.com/techniques/database)、[TypeORM MySQL 驱动](https://typeorm.io/docs/drivers/mysql/)

~~~mermaid
flowchart LR
  U[React 前端] --> G[同源 /api]
  G --> A[登录与权限]
  A --> Q[报价服务]
  A --> W[审批服务]
  Q --> M[(MySQL)]
  W --> M
  W --> L[审批记录 / 通知 / 操作日志]
  L --> M
~~~

建议目录：

- frontend/：现有页面、登录态、请求封装与业务交互。
- backend/src/auth/：认证、会话、权限与数据范围。
- backend/src/quotes/：报价、金额计算、版本快照。
- backend/src/approvals/：节点分配、动作处理、审批查询。
- backend/src/common/：事务、请求校验、错误响应、日志。
- backend/src/notifications/：站内通知。
- backend/src/database/migrations/：唯一的数据库结构演进入口。
- docs/openapi.yaml：实际实现后生成并提交的接口契约。
- compose.yaml：后续本地 MySQL 及服务启动配置。
- .local/：实施时使用的本地配置、备份和验收材料，加入根目录忽略规则。

第一阶段不引入 Redis、消息队列或通用流程设计器；会话、序列、站内通知均使用 MySQL。未来接入外部 ERP、邮件或钉钉时，再增加事务消息与重试机制。

2026-10-21 环境复测：Docker 引擎已可连接，hello-world 拉取及运行成功；使用现有 bridge 网络的临时 Compose 服务通过本机端口访问和重建容器后的数据卷持久化测试。但新建默认 Compose 网络时报 `all predefined address pools have been fully subnetted`，MySQL 8.4 镜像经一次重试仍未完成下载，尚未运行 SQL 测试。M0 仍需落实不冲突的项目网络、完整 MySQL 镜像和独立数据库；不能以本次文件持久化测试或 SQLite 替代 MySQL 事务和并发验收。详见 [Docker 复测记录](./docker-test-2026-10-21.md)。

## 3. 第一期范围与默认业务规则

### 3.1 纳入第一期

1. 账号登录、退出、当前用户、最小角色和数据范围。
2. 报价列表、详情、新建、编辑、草稿软删除。
3. 单号生成、明细校验、服务端金额计算。
4. 顺序两级审批：技术审核、负责人终审。
5. 驳回、退回、撤回、修改重提；各轮历史可查询。
6. 报价评论、审批时间线、站内通知、操作日志。
7. “待我审批 / 我已审批 / 我发起的”三个真实查询。
8. 报价数量、金额和待审批指标按真实数据库计算。
9. 数据重启保留、并发处理、备份恢复和桌面/手机流程验收。

### 3.2 本方案的默认值，尚非已确认业务制度

- 一个公司、人民币、手工填写报价明细，单价默认未税。
- 两级顺序审批；每级明确指派一个账号，开发验收用虚构账号。
- 默认禁止申请人自审，技术审批人与终审人不同。
- 业务员管理自己创建且归自己负责的报价；跨人查看、代录和分派需要独立权限。
- 草稿及被驳回后重新编辑的单据可改；审批中、已批准单据锁定。
- 已批准报价要改价或改明细，先复制为新报价并关联原单，再重新审批。
- 审批过程中的撤回仅限申请人或明确授权的业务负责人，必须填写原因；已批准不支持撤回。
- 税率可选值先沿用原型作为开发样例，正式启用值需按企业实际口径配置。

实际审批人、是否按金额分级、是否允许自审等，只影响规则配置和验收用例；不能从演示姓名或“部门负责人”字段自动推断授权。缺少有效审批人时，提交返回明确配置错误，不能自动通过。

### 3.3 后续阶段

价格库、CAD/图纸分解、快速报价、真实附件传输、客户主数据整合、ERP 转单后续接入。第一期保留报价中的客户名称/联系人/电话快照，不额外建立第二套客户主数据。

在 ERP 尚未接入时，“转订单”按钮禁用并标注未接入；/api/quotes/:id/convert 返回 501 和业务错误码，不修改 doc_status，不显示“已推送 ERP”。未来只有拿到可追溯订单标识并确认成功，才进入 ordered 状态。

## 4. 数据库调整

### 4.1 迁移方式

保留 db/schema.sql 作为原始设计参考，将既有 20 张表转为可重复部署的版本迁移，并在后续迁移中补充约束。价格和附件相关表可作为未启用结构保留，以维持现有外键依赖，但第一期不写入演示价格或声称相应业务已上线。

迁移使用独立命令执行；应用启动不自动改表，关闭 ORM synchronize。运行账号只具备必要业务权限，迁移账号与运行账号分开。原脚本含固定 CREATE DATABASE/USE jn_collab，不能直接向任意已有实例整段执行。[TypeORM 迁移说明](https://typeorm.io/docs/migrations/why/)

先创建报价、版本和审批表，再补报价上的版本/活动审批外键，处理循环依赖。种子同时对齐实际前端路由 /quotes、/approvals、/contacts；未实现的价格库不按原脚本默认启用为正式应用。

数据库名建议 jn_collab_dev、jn_collab_test；生产实例及名称另行配置。初期数据量小，先保证索引、分页和事务正确，无需分库分表。

### 4.2 保留并改造的表

| 表 | 调整 |
|---|---|
| users / roles / user_roles / app_permissions | 建立真实账号与权限；审批权限按技术审核和终审区分，停用账号不能继续使用旧会话 |
| quotes | 增加 lock_version、latest_revision_id、active_approval_id、approved_revision_id、source_quote_id、submitted_at、approved_at；source_quote_id 保留复制来源，created_by 由会话确定 |
| quote_items | 保存真实明细；金额由后端生成；未接价格库时 cabinet_id/material_id 必须为空，接入时补齐引用校验和 material_id 外键 |
| approvals | 增加 round_no、quote_revision_id、policy_version、completed_at；唯一键从 (biz_type,biz_id) 改为 (biz_type,biz_id,round_no) |
| approvals | 增加仅在 pending 时产生 biz_id 的生成列，并对 (biz_type,生成列) 建唯一索引，数据库层限制一单同时只有一个进行中的审批实例 |
| approval_records | 关联实际节点，保存动作人及姓名快照、意见、请求标识；只追加，不重写历史 |
| notifications | 增加 event_key；(user_id,event_key) 唯一，避免重试产生重复通知 |
| operation_logs | 记录 request_id、操作者、业务单号、版本、动作和必要前后值，不记录密码或会话令牌 |

不机械地给每个查询加 deleted_at：关联表、审批记录等目前没有该字段。软删除只用于声明了该字段的实体，审计记录和审批快照不提供物理删除接口。

### 4.3 新增的六张支撑表

| 表 | 关键内容 | 作用 |
|---|---|---|
| role_permissions | role_id、permission_id；联合唯一 | 真实角色授权 |
| auth_sessions | 用户、令牌摘要、CSRF 信息、有效期、撤销时间 | 会话能够跨服务重启保存并可主动失效 |
| document_sequences | 单据类型、年月、当前序号；类型+年月唯一 | 并发生成报价单号 |
| quote_revisions | quote_id、revision_no、snapshot_json、snapshot_hash、提交人及时间；quote_id+revision_no 唯一 | 固定每次送审的完整报价内容 |
| approval_steps | approval_id、step_no、节点名称、assignee_id、分配时姓名快照、状态、处理时间；approval_id+step_no 唯一 | 表达谁现在可以审批、谁在等待 |
| idempotency_requests | user_id、method、path、key、请求摘要、HTTP 状态、响应、有效期；作用域内 key 唯一 | 重试同一动作时返回原结果 |

审批规则第一期用版本化配置定义两级节点，提交时解析成真实用户并写入 approval_steps；保存规则版本及解析结果。修改配置只影响后续提交，不改已在途流程。规则配置中的真实人员映射放在部署配置中，不把真实人员名单写入示例种子。

## 5. 报价与审批状态

~~~mermaid
flowchart LR
  D[草稿] -->|提交并冻结版本| T[待技术审核]
  T -->|技术通过| F[待负责人终审]
  F -->|终审通过| A[已批准]
  T -->|驳回或退回| R[待修改]
  F -->|驳回或退回| R
  R -->|保存修改| D
  T -->|申请人撤回| D
  F -->|申请人撤回| D
~~~

数据库继续用 doc_status=pending 表示审批中，具体处于哪个节点由审批实例和节点记录表达，不新增两个互相竞争的报价状态来源。

| 动作 | 报价状态 | 审批实例与节点 |
|---|---|---|
| 创建/保存草稿 | draft / none | 无活动实例 |
| 提交 | pending / pending | 创建新轮次和快照；技术节点 pending、终审节点 waiting |
| 技术通过 | 仍为 pending / pending | 技术节点 approved；终审节点变 pending |
| 终审通过 | approved / approved | 实例 approved；固定 approved_revision_id |
| 任一级驳回 | rejected / rejected | 实例 rejected；当前节点 rejected，未开始节点 cancelled |
| 任一级退回修改 | rejected / rejected | 实例 rejected；当前节点 returned；记录 action=return，界面显示“退回修改”原因 |
| 保存驳回后的修改 | draft / none | 老实例不变，保留上一轮；lock_version 增加 |
| 撤回审批 | draft / none | 实例 cancelled；未完成节点 cancelled；保留已完成动作 |
| 再次提交 | pending / pending | 新 revision、新 round、新实例，不复用或清空旧记录 |
| 删除 | 仅草稿软删除 | 已有历史仍保留，不级联删除审批记录或版本 |

只有最终节点通过才改变报价为 approved。默认不允许跳节点、替别人点通过或一次批准整个流程。

第一期禁止停用仍承担活动节点的账号，先提示需处理在途任务；后续如增加转交，必须做显式授权、记录原受理人与新受理人及原因。

### 5.1 一次审批动作的事务边界

一次动作统一执行：

1. 校验会话、CSRF、请求格式和请求幂等键。
2. 幂等记录命中时校验请求摘要及当前访问权限，返回原响应，不再推进流程。
3. 开始事务并按统一顺序锁定幂等记录、报价、活动审批、当前节点。
4. 校验 expectedVersion、approvalId、stepNo 与数据库当前状态一致。
5. 校验操作者是当前指派人、拥有对应节点权限，且不违反自审规则。
6. 追加审批记录，推进或结束节点与实例，更新报价及 lock_version。
7. 同一事务写站内通知、操作日志和幂等响应。
8. 提交成功才返回成功；任何一步失败全部回滚。

事务中的所有数据库操作使用同一事务连接/EntityManager。MySQL 行锁用于保护取号和状态转换，前端按钮禁用只是交互优化，不承担并发正确性。[TypeORM 事务](https://typeorm.io/docs/transactions/)、[MySQL 锁定读取](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html)

技术通过、终审通过、驳回、撤回和重提均递增 lock_version。陈旧页面返回 HTTP 409，提示刷新后重新决定；不同幂等键的重复操作也必须被节点状态和版本检查拦截。

短事务禁止调用外部服务。死锁允许有限次数重试同一业务请求，不能生成新的审批动作。单据创建只锁取号行；其他路径遵循固定业务锁顺序，提交审批不再次分配报价单号。

## 6. 金额、单号与数据契约

### 6.1 金额

- 数量最多三位小数，单价及金额两位小数；沿用 DECIMAL(12,3)、DECIMAL(14,2)。
- 后端使用十进制运算库计算，不能以 JavaScript 浮点或客户端传入合计为依据。
- 统一规则：先将每行“数量×单价”按四舍五入保留两位，再求和得到未税小计；税额=小计×税率÷100，四舍五入到两位；价税合计=小计+税额。
- 服务端拒绝客户端写入 subtotal、taxAmount、totalAmount、status、createdBy、审批人等受控字段。
- 每行校验产品名称、数量>0、单价>=0以及精度和总额上限；不能只验证“至少一条有效明细”后放过其他负数行。
- 零价行可存草稿；本方案默认提交时返回 422 并指出具体零价行。实际赠品或待核价需求确认后再配置例外，不能把原型的零单价自动当作有效正式报价。
- 明细总额超出 DECIMAL 容量返回字段错误，不能静默截断。
- 版本快照保存客户/联系人、全部明细、税率、计算结果及计算规则版本。后续价格库调价不能修改历史送审版本。

API 中 ID 使用十进制字符串，避免 BIGINT 经 JavaScript Number 丢失精度；金额、数量和税率也使用规范十进制字符串。相应修改当前前端 number 类型、Number(id) 和金额格式化函数。列表页只格式化显示；表单预览与后端使用相同舍入规则，保存后以服务器返回值为准。

### 6.2 单号

采用 Q + YYYYMM + 月内流水，至少补齐四位；超过 9999 后自然扩展位数，绝不回绕。年月按服务端创建草稿时的 Asia/Shanghai 日期生成，允许跳号，不回收已分配编号。

使用 document_sequences 的唯一键和事务行锁/原子递增取号；新月份首次建行采用可处理唯一键竞争的插入方式。报价单唯一键提供最后一道约束，禁止 MAX(quote_no)+1，也不相信客户端单号。

### 6.3 时间和响应

本方案建议新库统一存 UTC DATETIME(3)，连接时区固定 UTC，API 返回带时区的 ISO 8601，页面和月份统计按 Asia/Shanghai。旧数据字典写“存北京时间”，实施时必须同步修改；将来导入旧数据需显式转换，不能直接假定已是 UTC。

成功响应沿用 { code: 0, msg: "", data: ... }。错误同时返回真实 HTTP 状态与业务码，建议：

| HTTP | 用途 |
|---|---|
| 401 | 未登录或会话过期 |
| 403 | 已识别资源但无操作权限、不是当前审批人 |
| 404 | 资源不存在或不在该用户可见范围 |
| 409 | 版本冲突、节点已处理、状态不允许、同 key 不同请求内容 |
| 422 | 字段/金额不合法、缺少有效审批人配置 |
| 501 | ERP 转单尚未接入 |
| 503 | 数据库不可用 |

失败体带 msg、requestId，字段错误额外带 errors。前端 client 先安全解析 JSON 业务错误，再显示提示，不能把所有 4xx 都显示成“网络请求失败”。

## 7. API 与前端改动

### 7.1 第一阶段接口

所有路径以下列 /api 为基址，保留现有业务命名。后续应用可以建立独立模块，但报价不同时维护两套不同语义的写入口。

| 方法与路径 | 行为 |
|---|---|
| GET /api/auth/csrf | 获取 Cookie 会话方案需要的 CSRF 信息 |
| POST /api/auth/login；POST /api/auth/logout | 真实登录与会话撤销 |
| GET /api/me | 用户、角色、权限、业务范围；不返回密码字段 |
| GET /api/departments；GET /api/users | 通讯录和审批人选择的受限查询 |
| GET /api/apps | 返回启用且可访问的业务入口 |
| GET /api/quotes | 关键词、状态、分页，统一套用数据可见范围 |
| POST /api/quotes | 创建草稿、服务端取号和金额计算 |
| GET /api/quotes/:id | 当前内容、状态、版本、当前节点、历史入口及 allowedActions |
| PUT /api/quotes/:id | 编辑草稿或驳回单；必传 expectedVersion |
| DELETE /api/quotes/:id | 草稿软删除；传 If-Match 版本及幂等键 |
| POST /api/quotes/:id/submit | 冻结版本、启动两级审批；必传 expectedVersion |
| POST /api/quotes/:id/approve | 兼容现有路径，委托统一审批服务处理当前节点 |
| POST /api/quotes/:id/reject | 当前节点驳回；意见必填 |
| POST /api/quotes/:id/return | 当前节点退回修改；意见必填 |
| POST /api/quotes/:id/withdraw | 申请人撤回当前实例；原因必填 |
| POST /api/quotes/:id/copy | 复制已批准报价为新草稿并保留来源关联 |
| GET /api/quotes/:id/revisions；GET /api/quotes/:id/revisions/:revisionId | 查询各次送审内容；校验 revisionId 属于该报价 |
| POST /api/quotes/:id/comments | 持久保存纯文本评论；作者取当前会话 |
| GET /api/approvals?tab=todo\|done\|mine | 按当前用户查询待办、已办和发起的各轮审批 |
| GET /api/approvals/:id | 特定审批轮次的快照、节点与历史 |
| GET /api/notifications；POST /api/notifications/:id/read | 只读取和标记本人的站内通知 |
| GET /api/dashboard/summary | 按数据范围和业务月份聚合完整结果，不用列表第一页算总量 |
| GET /health/live；GET /health/ready | 区分进程存活与数据库/迁移就绪 |

通过、驳回、退回和撤回携带 approvalId、stepNo、expectedVersion、comment；首次提交和重提携带 expectedVersion，由服务器生成新的审批实例。所有业务写接口携带 Idempotency-Key。接口层只负责认证、校验和 DTO 转换，审批状态转换只放在一份领域服务中。

QuoteDetail 增加 lockVersion、currentApproval、currentStep、allowedActions、latestRevisionId、approvedRevisionId；Approval 增加 roundNo、revisionId、currentAssignee 和业务链接。状态及允许动作均由后端计算。

“待我审批”只含分配给当前用户且处于当前节点的 pending 任务；“我已审批”按本人实际处理记录查询，并按审批实例去重，即使该实例仍在后续节点也应出现；“我发起的”只含本人提交的实例，不是全部申请。

### 7.2 身份和访问控制

使用服务端会话 + HttpOnly Cookie，适配现有 credentials: include。部署走同源 /api，开发由 Vite 代理转发。生产 Cookie 启用 Secure 和合适的 SameSite，所有写请求做 CSRF 与来源校验；登录时轮换会话，退出、账号停用和密码变更时使旧会话失效。[Nest CSRF 说明](https://docs.nestjs.com/security/csrf)

用户角色与数据范围分开判定。基础权限建议包括 quote:view、quote:view_all、quote:create、quote:edit、quote:delete、quote:submit、quote:withdraw、quote:review_technical、quote:review_final、quote:comment。

系统管理员可管理配置，不因 admin 角色自动获得代批资格；要参与审批需明确业务授权和节点指派。审批人可读取分配给自己及本人曾处理的报价审批材料，不能因此浏览全部报价。评论、版本、通知、列表和汇总接口与详情使用一致范围，避免通过其他入口越权。

### 7.3 必须同步修改的前端

| 文件/页面 | 改动 |
|---|---|
| frontend/src/api/client.ts | 真实模式不回退 Mock；处理 401/403/409/422；附加 CSRF、版本及幂等键；保存失败保留输入 |
| frontend/src/api/endpoints.ts | 补编辑、删除、重提、撤回、版本、审批详情、统计和通知接口 |
| frontend/src/types/api.ts 及 db/frontend-types.ts | 统一 ID/Decimal 字符串、版本、节点和 allowedActions；后续以 OpenAPI 生成避免两份漂移 |
| frontend/src/App.tsx / Layout | 登录页、会话守卫、真实退出；受控菜单；401 回登录 |
| QuoteForm.tsx | 支持编辑；逐行校验；十进制预览；提交成功后使用服务端明细和金额 |
| QuoteDetail.tsx | 按 allowedActions 显示按钮；显示当前审批人；增加审批意见；通过技术节点时文案不能宣称整单批准 |
| Approvals.tsx | 点击某次审批打开该实例/快照，不能一律跳当前报价内容，否则旧轮次可能显示新价格 |
| Dashboard.tsx | 使用 summary 接口统计；移除 ERP 未接入时的误导性转单统计 |
| 评论输入 | 第一期作为普通文本保存；结构化 @通知未实现前去掉“可提及同事”的承诺 |
| frontend/vite.config.ts / 环境配置 | /api 代理及显式真实模式；生产构建必须确认 Mock 关闭 |
| README.md / frontend/README.md / 数据字典 / 接入规范 | 对齐实际 React 工程、接口路径、会话方案、轮次、金额和时区约定 |

后端故障应明确显示失败并保留表单。没有查询成功不能显示“暂无待办”或零统计，尤其要移除当前 catch 后忽略错误的行为。桌面与 390×844 手机的登录、表单和审批意见弹窗纳入验收。

## 8. 实施顺序和每步验收

| 阶段 | 具体交付 | 通过条件 |
|---|---|---|
| M0：数据库和契约 | 后端工程、锁定依赖、独立 MySQL、版本迁移、OpenAPI 初稿、统一 DTO | 空库迁移成功；重复运行不重复建表；readiness 能识别连接失败；真实业务库未被触碰 |
| M1：真实报价 | 真实登录、最小权限、报价 CRUD、金额和单号 | 两名业务员、一名技术审核人、一名终审人四个虚构账号可登录；保存后刷新/重启仍存在；另一业务员不能越权读写；创建后详情准确对应 |
| M2：真实审批 | 两级节点、快照、重提轮次、驳回/退回/撤回、事务和幂等 | 技术通过后仍待终审；非指派人不可审批；重提保留旧轮次；并发点击只产生一次有效动作 |
| M3：前端闭环 | 编辑/审批意见/历史、待办/已办/发起、评论、通知和工作台统计 | VITE_USE_MOCK=false 完整走通流程；接口失败不产生假成功；手机可操作 |
| M4：恢复与交付 | 数据库备份/恢复脚本、验收记录、部署与回退说明 | 独立恢复库可查询同一报价及历史；关键表计数和快照摘要一致；正式人员与规则配置完成后才开始业务试用 |

这些阶段是实施顺序，不是已经完成的进度，也不是未经估算的工期承诺。

### 8.1 关键验收案例

1. 使用虚构业务员、技术审核人、终审人分别登录，操作同一报价；刷新页面、重启 API 和 MySQL 后记录完整。
2. 数量 2、单价 100、税率 13，保存后得到 200.00、26.00、226.00。
3. 小数舍入边界：三行均为数量 0.333、单价 0.10，逐行金额应各 0.03，小计 0.09，不能按未舍入总和得到 0.10。
4. 负数、越界、超精度、空产品、夹在有效行之间的无效行都被服务端拒绝。
5. 同时创建多笔报价单号不重复；相同幂等键的重复创建返回同一张单，同 key 不同内容返回冲突。
6. 技术通过后终审才收到待办；申请人、未指派同事、只有管理员身份者不能绕过规则代批。
7. 并发批准/驳回、重复点击、旧页面操作不得推进两次、产生两条有效决定或覆盖最终状态。
8. 驳回后修改价格再提交，第一轮仍能看到原金额与意见，第二轮显示新金额和新节点。
9. 审批中改价失败；已批准改价失败；复制新报价后重新审批。
10. 撤回与审批并发，只能有一个合法结果，相关报价、审批、节点、通知与日志保持一致。
11. 人为让事务中的日志或通知写入失败，报价状态和审批决定同时回滚，不出现“半成功”。
12. A 业务员不能通过猜 ID 读取 B 的报价、版本或评论；节点人员按授权可查看分配材料。
13. “我已审批”能显示我已经技术通过但还在终审的单据；不能混入别人处理的单据。
14. 数据库断开时提交失败，前端保留内容且不弹成功；恢复后允许按同一请求标识重试。
15. 超过一页且跨月份的数据下，统计仍正确；“本月报价”按创建月份，“待我审批”按当前活动任务，二者口径独立。
16. 备份恢复到独立库，核对报价、明细、版本、节点、审批记录、评论的行数及关键快照摘要。
17. 桌面及 390×844 手机完成新建、编辑、提交、驳回意见、重提；无横向遮挡导致关键按钮不可达。
18. 未接 ERP 时无法把正式报价变成 ordered，也不产生“已推送 ERP”的假成功。

集成测试必须使用真实 MySQL；状态与金额规则可做单元测试，但 Mock 通过不能替代事务、锁、重启持久化和恢复验证。

## 9. 环境、数据与交付约定

建议开发端口：前端 5173、API 3100、MySQL 13306，仅绑定本机；实施时先检查占用，再选定端口。MySQL 用独立持久卷，测试使用单独数据库，不能把清库命令指向生产连接。

基础种子只创建明确标为开发使用的虚构账号和必要规则。账号密码在本地安全生成，不提交固定通用密码；真实人员、客户和原始报价资料不写入公开种子或仓库。数据库连接信息仅保存在后端环境配置中，VITE_ 变量不得含秘密。

备份先写入专用目录并记录时间、库名、迁移版本与摘要；恢复必须用不同库名核对。数据库迁移以兼容性增量为主，应用版本回退不等于删除新表或清空历史。正式运行前验证备份恢复，而非只验证备份文件存在。

本轮工作完成边界：源仓库克隆到当前目录，并形成这份方案。后续首个可验收里程碑应是“真实账号保存一张报价到 MySQL，刷新和重启后仍可准确读取”，随后增加两个真实审批节点及历史留痕。
