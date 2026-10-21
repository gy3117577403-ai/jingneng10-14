import { useEffect, useState } from "react";
import { orgApi } from "../../api/endpoints";
import type { Department, User } from "../../types";
import { Card, CardTitle, Avatar, Badge } from "../../components/ui/basic";
import { SearchInput } from "../../components/ui/form";

export function Contacts() {
  const [depts, setDepts] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeDept, setActiveDept] = useState<number | null>(null);
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    orgApi.departments().then(setDepts).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      orgApi.users(keyword || undefined, activeDept ?? undefined)
        .then((r) => setUsers(r.list))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [keyword, activeDept]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">通讯录</div>
          <div className="page-desc">部门与员工信息</div>
        </div>
        <SearchInput value={keyword} onChange={setKeyword} placeholder="搜索姓名…" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, alignItems: "start" }}>
        <Card>
          <CardTitle>部门</CardTitle>
          <div
            onClick={() => setActiveDept(null)}
            style={{
              padding: "9px 12px", borderRadius: "var(--radius-s)", cursor: "pointer",
              background: activeDept === null ? "var(--color-accent-soft)" : "transparent",
              color: activeDept === null ? "var(--color-accent)" : "var(--color-text-2)",
              fontWeight: activeDept === null ? 600 : 400, fontSize: 14, marginBottom: 4,
            }}
          >
            全部部门
          </div>
          {depts.map((d) => (
            <div
              key={d.id}
              onClick={() => setActiveDept(d.id)}
              style={{
                padding: "9px 12px", borderRadius: "var(--radius-s)", cursor: "pointer",
                background: activeDept === d.id ? "var(--color-accent-soft)" : "transparent",
                color: activeDept === d.id ? "var(--color-accent)" : "var(--color-text-2)",
                fontWeight: activeDept === d.id ? 600 : 400, fontSize: 14, marginBottom: 4,
              }}
            >
              {d.name}
            </div>
          ))}
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {users.map((u) => (
            <Card key={u.id} hover>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Avatar name={u.realName} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{u.realName}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-3)" }}>
                    {u.deptName ?? "—"}{u.employeeNo ? ` · ${u.employeeNo}` : ""}
                  </div>
                </div>
                {u.status === 1 ? <Badge variant="green">在职</Badge> : <Badge variant="gray">停用</Badge>}
              </div>
              {u.phone && (
                <div style={{ marginTop: 10, fontSize: 13, color: "var(--color-text-2)" }} className="num">
                  📞 {u.phone}
                </div>
              )}
            </Card>
          ))}
          {users.length === 0 && (
            <div style={{ gridColumn: "1 / -1", color: "var(--color-text-3)", textAlign: "center", padding: 40 }}>
              没有找到匹配的员工
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
