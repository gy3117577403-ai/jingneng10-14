/**
 * 前端专用类型：应用注册表、路由、UI 辅助类型
 * 后端数据模型类型见 ./api.ts（与 db/ 设计一一对应）
 */
import type { ReactNode } from "react";

export * from "./api";

/** 平台应用注册项（对应后端的 apps 表，菜单由此动态渲染） */
export interface AppDefinition {
  code: string; // quote | price | drawing | quickquote | approval | contacts | docs
  name: string;
  icon: ReactNode;
  route: string; // 如 /quotes
  desc: string;
  badge?: string; // 角标，如 "即将上线"
  comingSoon?: boolean;
  sort: number;
}

/** 当前登录用户（前端会话） */
export interface SessionUser {
  id: number;
  username: string;
  realName: string;
  deptName?: string;
  avatarUrl?: string;
  roles: string[];
}

/** 报价单列表筛选条件 */
export interface QuoteFilter {
  keyword?: string;
  docStatus?: string;
  approvalStatus?: string;
  page?: number;
  pageSize?: number;
}

/** 审批中心筛选 */
export interface ApprovalFilter {
  tab: "todo" | "done" | "mine";
  keyword?: string;
  page?: number;
  pageSize?: number;
}
