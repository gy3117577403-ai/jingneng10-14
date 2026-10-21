/**
 * 应用注册表：平台插件化核心
 * 新增应用只需在这里加一行，侧边栏菜单自动出现。
 * （与后端 apps 表对应，后续可改为从接口拉取）
 */
import type { AppDefinition } from "../types";

const icon = (emoji: string, bg: string) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 32,
      height: 32,
      borderRadius: 9,
      background: bg,
      fontSize: 16,
      flexShrink: 0,
    }}
  >
    {emoji}
  </span>
);

export const APPS: AppDefinition[] = [
  {
    code: "dashboard",
    name: "工作台",
    icon: icon("🏠", "linear-gradient(135deg,#5ac8fa,#0071e3)"),
    route: "/dashboard",
    desc: "业务概览与待办",
    sort: 1,
  },
  {
    code: "quote",
    name: "报价管理",
    icon: icon("📝", "linear-gradient(135deg,#ffd60a,#ff9f0a)"),
    route: "/quotes",
    desc: "Excel 导入 · 工时费用 · 保存与导出",
    sort: 2,
  },
  {
    code: "approval",
    name: "审批中心",
    icon: icon("✅", "linear-gradient(135deg,#7dffa8,#34c759)"),
    route: "/approvals",
    desc: "待我审批与经办",
    sort: 3,
  },
  {
    code: "price",
    name: "价格库",
    icon: icon("💰", "linear-gradient(135deg,#ffd60a,#ff9f0a)"),
    route: "/apps/price",
    desc: "材料 · 箱柜 BOM · 加工费",
    badge: "即将上线",
    comingSoon: true,
    sort: 4,
  },
  {
    code: "drawing",
    name: "图纸快速分解",
    icon: icon("📐", "linear-gradient(135deg,#b28dff,#a259ff)"),
    route: "/apps/drawing",
    desc: "CAD 图纸智能拆解",
    badge: "即将上线",
    comingSoon: true,
    sort: 5,
  },
  {
    code: "quickquote",
    name: "快速报价",
    icon: icon("⚡", "linear-gradient(135deg,#ff9f0a,#ff375f)"),
    route: "/apps/quickquote",
    desc: "基于价格库一键报价",
    badge: "即将上线",
    comingSoon: true,
    sort: 6,
  },
  {
    code: "contacts",
    name: "通讯录",
    icon: icon("👥", "linear-gradient(135deg,#64d2ff,#0a84ff)"),
    route: "/contacts",
    desc: "部门与员工",
    sort: 7,
  },
];

/** 侧边栏显示的应用（排除工作台，工作台固定在顶部） */
export const SIDEBAR_APPS = APPS.filter((a) => a.code !== "dashboard").sort((a, b) => a.sort - b.sort);
