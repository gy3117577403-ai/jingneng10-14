# 京能协同 · 前端

企业协同管理平台的前端工程（React 18 + Vite + TypeScript）。

## 快速开始

```bash
cd frontend
npm install
npm run dev      # 开发模式，默认 http://localhost:5173
npm run build    # 生产构建
```

## 目录结构

```
src/
  api/          接口层：client.ts（统一请求）+ endpoints.ts（各模块接口）+ mock.ts（Mock 路由）
  mocks/        本地模拟数据（与 db/ 数据模型一致）
  config/       应用注册表 apps.tsx（新增应用加一行，菜单自动出现）
  components/
    ui/         基础组件：Button / Card / Form / Table / Modal / Drawer / Badge / Timeline…
    Layout/     应用外壳：可折叠+拖拽侧边栏、顶栏
  pages/
    Dashboard/  工作台
    Quotes/     报价管理（列表 / 新建 / 详情）
    Approvals/  审批中心
    Contacts/   通讯录
    Apps/       应用中心
  types/        类型定义（api.ts 复制自 db/frontend-types.ts，保持同步）
  styles/       设计语言：tokens.css（设计变量）+ global.css
```

## 设计语言

Apple 设计感：浅色留白、毛玻璃（backdrop-filter）、细腻缓动、8px 间距体系。
设计变量集中在 `src/styles/tokens.css`，所有组件都引用变量，换肤只改一处。

## 联调说明（给后端 Codex）

1. 接口路径约定见 `db/应用接入规范.md` 第六章，前端 `src/api/endpoints.ts` 已按此封装。
2. 统一响应格式：`{ code: 0, msg: "", data: T }`，类型见 `src/types/api.ts` 的 `ApiResponse`。
3. 当前 `.env` 里 `VITE_USE_MOCK=true`，前端用本地 Mock 独立运行；
   后端就绪后把 `VITE_API_BASE` 指向真实地址、`VITE_USE_MOCK` 改为 `false` 即可联调，
   前端代码零改动。
