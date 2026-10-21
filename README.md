# 京能协同 · jingneng10-14

浙江京能电力设备有限公司 · 企业协同平台（钣金 + 成套业务）

现有 React 工程已接入可实际使用的本机报价工作台：Excel 导入、物料增删改、原表算法计算、工时费用、数据库保存、版本恢复及 Excel 导出。

## 启动报价工作台

需要 Node.js 22.12 或更新版本，以及已运行的 Docker Desktop。首次安装依赖和数据库镜像需要联网。

Windows 用户可双击根目录的 **启动报价工作台.cmd**。启动器会安装依赖、初始化独立数据库并构建页面，打开 `http://127.0.0.1:5271/quotes`。

也可以在项目根目录运行：

```powershell
npm ci
npm run db:up
npm run build
npm start
```

开发模式运行 `npm run dev`，前端地址为 `http://127.0.0.1:5273/quotes`。

详细操作、计费规则和数据位置见 [报价工作台使用与维护](docs/quote-workbench-usage.md)，实际验证范围见 [验收记录](docs/quote-workbench-verification.md)。

## 当前范围

- 支持 `.xlsx` 导入预览、字段对应、多工作表和柜型分组；支持材料编辑、批量粘贴、复制和删除。
- 沿用原表的材料、柜体、人工、管理费、税费和利润计算口径，使用完整精度计算后显示两位小数。
- 真实保存到独立 MariaDB 11.8.9 数据库，支持自动保存、版本恢复和并发修改冲突检测。
- 导出含公式及缓存结果的 Excel 计算表，保留全部柜型、内部成本和备注。
- 历史价格库、店小二、采购协同和多人登录权限尚未接入；应用与数据库仅监听本机。

数据库密码首次随机生成，保存在被 Git 忽略的 `.local/workbench/mysql.env`；原始上传、备份和本地验收数据也不进入仓库。数据库使用独立端口 `33371`、数据卷及子网 `10.253.71.0/24`，在其他机器启动前应确认端口和子网可用。

## 目录结构

```
jingneng10-14/
├── frontend/                 # React + TypeScript，实际工作台在 src/workbench/
├── backend/                  # Express API、Excel 导入导出、持久化及集成测试
├── packages/quote-core/       # 前后端共用的原表计算规则与回归测试
├── scripts/                  # 初始化、启动、备份和本地原表核验
├── compose.workbench.yml     # 独立数据库配置
├── docs/                     # 使用说明、验收记录与历史方案
├── db/                       # 原平台数据库设计，工作台不直接执行此 schema
├── index.html                # 早期单文件交互原型
└── 启动报价工作台.cmd         # Windows 启动入口
```

## 验证

```powershell
npm run build
npm test
npm run lint --workspace frontend
```

数据库和应用启动后，可执行真实数据库集成测试：

```powershell
$env:RUN_DB_TESTS = '1'
npm test
```

默认测试不连接数据库。原表核验需自行提供本地基准文件：`npm run verify:reference -- '原报价Excel的绝对路径'`，文件不会随仓库提供。

## 原型预览

直接用浏览器打开根目录 `index.html` 可以查看早期单文件原型。它与实际工作台使用不同的数据；React 工程中的其他演示模块已显示演示标识。

## 设计要求

界面与交互对标 Apple 设计感：浅色留白、毛玻璃、细腻缓动、8px 间距体系。
