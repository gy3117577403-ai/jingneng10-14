import { useNavigate } from "react-router-dom";
import { APPS } from "../../config/apps";
import { Card, Badge } from "../../components/ui/basic";
import { toast } from "../../components/ui/overlay";

export function Apps() {
  const navigate = useNavigate();
  const online = APPS.filter((a) => !a.comingSoon && a.code !== "dashboard");
  const coming = APPS.filter((a) => a.comingSoon);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">应用中心</div>
          <div className="page-desc">平台应用统一入口 · 新应用接入后自动出现在这里</div>
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-2)", marginBottom: 12 }}>已接入</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginBottom: 32 }}>
        {online.map((app) => (
          <Card key={app.code} hover>
            <div onClick={() => navigate(app.route)} style={{ cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <span style={{ transform: "scale(1.25)" }}>{app.icon}</span>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{app.name}</div>
              </div>
              <div style={{ fontSize: 13, color: "var(--color-text-3)" }}>{app.desc}</div>
            </div>
          </Card>
        ))}
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-2)", marginBottom: 12 }}>即将上线</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {coming.map((app) => (
          <Card key={app.code}>
            <div onClick={() => toast(`${app.name}正在开发中，敬请期待`, "🚧")} style={{ cursor: "pointer", opacity: 0.85 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <span style={{ transform: "scale(1.25)", filter: "grayscale(0.4)" }}>{app.icon}</span>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{app.name}</div>
                <Badge variant="orange">{app.badge}</Badge>
              </div>
              <div style={{ fontSize: 13, color: "var(--color-text-3)" }}>{app.desc}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function ComingSoon({ name }: { name: string }) {
  return (
    <div className="page">
      <div style={{ textAlign: "center", padding: "80px 0", color: "var(--color-text-3)" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🚧</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: "var(--color-text-2)", marginBottom: 8 }}>{name}</div>
        <div style={{ fontSize: 14 }}>该应用正在开发中，敬请期待</div>
      </div>
    </div>
  );
}
