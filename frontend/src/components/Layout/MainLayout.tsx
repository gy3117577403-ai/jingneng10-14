import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { APPS, SIDEBAR_APPS } from "../../config/apps";
import { Avatar } from "../ui/basic";
import { orgApi } from "../../api/endpoints";
import type { SessionUser } from "../../types";
import "./layout.css";

const MIN_W = 160;
const MAX_W = 300;
const DEFAULT_W = 232;

function useSidebarWidth() {
  const [width, setWidth] = useState(() => {
    const v = Number(localStorage.getItem("jn-sidebar-width"));
    return v >= MIN_W && v <= MAX_W ? v : DEFAULT_W;
  });
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("jn-sidebar-collapsed") === "1"
  );
  useEffect(() => { localStorage.setItem("jn-sidebar-width", String(width)); }, [width]);
  useEffect(() => { localStorage.setItem("jn-sidebar-collapsed", collapsed ? "1" : "0"); }, [collapsed]);
  return { width, setWidth, collapsed, setCollapsed };
}

function Sidebar({ user }: { user: SessionUser | null }) {
  const { width, setWidth, collapsed, setCollapsed } = useSidebarWidth();
  const dragging = useRef(false);
  const location = useLocation();

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "ew-resize";
    document.body.classList.add("sidebar-dragging");
    const move = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const w = Math.min(MAX_W, Math.max(MIN_W, ev.clientX));
      setWidth(w);
      if (w <= MIN_W + 8) setCollapsed(true);
      else if (collapsed) setCollapsed(false);
    };
    const up = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.classList.remove("sidebar-dragging");
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }, [collapsed, setWidth, setCollapsed]);

  const dash = APPS.find((a) => a.code === "dashboard")!;

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`} style={{ width: collapsed ? 72 : width }}>
      <div className="brand">
        <div className="brand-logo">京</div>
        <div className="brand-text">
          <div className="brand-name">京能协同</div>
          <div className="brand-sub">企业协同管理平台</div>
        </div>
      </div>

      <nav className="nav">
        <NavLink to={dash.route} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`} title={dash.name}>
          {dash.icon}
          <span className="nav-label">{dash.name}</span>
        </NavLink>

        <div className="nav-section">应用</div>
        {SIDEBAR_APPS.filter((a) => !a.comingSoon).map((app) => (
          <NavLink
            key={app.code}
            to={app.route}
            className={({ isActive }) =>
              `nav-item${isActive || location.pathname.startsWith(app.route + "/") ? " active" : ""}`
            }
            title={app.name}
          >
            {app.icon}
            <span className="nav-label">{app.name}</span>
          </NavLink>
        ))}

        <div className="nav-section">即将上线</div>
        {SIDEBAR_APPS.filter((a) => a.comingSoon).map((app) => (
          <span key={app.code} className="nav-item disabled" title={`${app.name}（${app.desc}）`}>
            {app.icon}
            <span className="nav-label">{app.name}</span>
            <span className="nav-badge">{app.badge}</span>
          </span>
        ))}
      </nav>

      <div className="sidebar-footer">
        <Avatar name={user?.realName ?? "管"} size={30} />
        <div className="user-meta">
          <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.realName ?? "—"}</div>
          <div style={{ fontSize: 11, color: "var(--color-text-3)" }}>{user?.deptName ?? ""}</div>
        </div>
        <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)} title={collapsed ? "展开" : "折叠"}>
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      {!collapsed && <div className="sidebar-drag" onMouseDown={onMouseDown} />}
    </aside>
  );
}

function Header({ title }: { title: string }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  useEffect(() => { orgApi.me().then(setUser).catch(() => {}); }, []);
  return (
    <header className="header">
      <div className="header-title">{title}</div>
      <div className="header-right">
        <span style={{ fontSize: 13, color: "var(--color-text-3)" }}>
          {new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })}
        </span>
        <div className="header-user">
          <Avatar name={user?.realName ?? "管"} size={30} />
          <span>{user?.realName ?? ""}</span>
        </div>
      </div>
    </header>
  );
}

const TITLES: Record<string, string> = {
  "/dashboard": "工作台",
  "/quotes": "报价管理",
  "/approvals": "审批中心",
  "/contacts": "通讯录",
  "/apps": "应用中心",
};

export function MainLayout() {
  const location = useLocation();
  const [user, setUser] = useState<SessionUser | null>(null);
  useEffect(() => { orgApi.me().then(setUser).catch(() => {}); }, []);

  const seg = "/" + location.pathname.split("/").filter(Boolean)[0];
  const title = TITLES[seg] ?? (location.pathname.startsWith("/quotes/") ? "报价管理" : "京能协同");

  return (
    <div className="layout">
      <Sidebar user={user} />
      <div className="main">
        <Header title={title} />
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
