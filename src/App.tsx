import { useMemo, useState } from "react";
import "./styles.css";
import type { ApprovalDoc, DiffEntry, Role, ScriptItem } from "./types";
import { DOCS, SCRIPT_ITEMS, SCRIPT_VERSION } from "./data";
import { reconcile, toSeconds, versionMode } from "./reconcile";

const project = {
  sourceNo: 10,
  id: "hxyfront-62008",
  port: 62008,
  title: "烟花燃放脚本编排 · 合规对账台",
};

const ROLES: Array<{ key: Role; label: string; desc: string }> = [
  { key: "safety", label: "安全员", desc: "守批文：放行差异、放行整场" },
  { key: "orchestrator", label: "编排师", desc: "调点位：修改现场脚本，无放行权" },
  { key: "guest", label: "访客", desc: "只读：任何确认操作均被权限拒绝" },
];

const FIELD_LABELS: Record<string, string> = {
  ignitionTime: "点火时刻",
  safetyDistance: "安全距离",
  angle: "发射角度",
};

export default function App() {
  const [role, setRole] = useState<Role>("safety");
  const [items, setItems] = useState<ScriptItem[]>(SCRIPT_ITEMS);
  const [doc, setDoc] = useState<ApprovalDoc | null>(null);
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [denied, setDenied] = useState<string | null>(null);
  const [released, setReleased] = useState(false);

  const diffs = useMemo(() => reconcile(items, doc), [items, doc]);
  const unresolved = useMemo(
    () => diffs.filter((d) => !resolved.has(d.key)),
    [diffs, resolved],
  );
  const blockingItemIds = useMemo(
    () => new Set(unresolved.map((d) => d.itemId)),
    [unresolved],
  );

  const toast = (msg: string) => {
    setDenied(msg);
    window.setTimeout(() => setDenied(null), 3600);
  };

  const loadDoc = (d: ApprovalDoc) => {
    setDoc(d);
    setResolved(new Set());
    setReleased(false);
  };

  // 编排师临时调点位；其他角色修改被权限拒绝。改动后该字段需重新放行。
  const updateItem = (id: string, field: keyof ScriptItem, raw: string) => {
    if (role !== "orchestrator") {
      toast("权限拒绝：现场脚本仅编排师可临时调整点位");
      return;
    }
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        if (field === "angle" || field === "safetyDistance") {
          const n = Number(raw);
          if (Number.isNaN(n)) return it;
          return { ...it, [field]: n };
        }
        return { ...it, [field]: raw };
      }),
    );
    setResolved((prev) => {
      const next = new Set(prev);
      next.delete(`${id}:${field}`);
      return next;
    });
  };

  // 安全员放行差异；其他角色确认一律拒绝
  const releaseDiff = (d: DiffEntry) => {
    if (role !== "safety") {
      toast("权限拒绝：差异仅安全员可放行，其他角色确认无效");
      return;
    }
    setResolved((prev) => new Set(prev).add(d.key));
  };

  const releaseAll = () => {
    if (role !== "safety") {
      toast("权限拒绝：整场放行仅安全员可执行");
      return;
    }
    if (unresolved.length > 0) {
      toast(`差异未清空（剩 ${unresolved.length} 项），无法放行整场`);
      return;
    }
    setReleased(true);
  };

  const mode = versionMode(doc);
  const maxSec = Math.max(...items.map((it) => toSeconds(it.ignitionTime))) + 30;

  return (
    <main className="app">
      {denied && (
        <div className="toast" role="alert">
          ⛔ {denied}
        </div>
      )}

      <section className="hero">
        <p>
          {project.id} · 源提示词{project.sourceNo} · Port {project.port}
        </p>
        <h1>{project.title}</h1>
        <span>
          载入报备批文后逐项对照现场脚本：点火时刻、安全距离、发射角度对不上即进差异清单。
          差异仅安全员可放行，编排师可临时调点位但无放行权。批文按版本号对账，旧批文不覆盖现场改动；
          无版本号旧稿按兼容模式打开。差异未清空时，预览图上标出阻塞段，不可放行整场。
        </span>
      </section>

      <section className="metrics">
        <article>
          <small>节目段落</small>
          <strong>{items.length}</strong>
        </article>
        <article>
          <small>点火节点</small>
          <strong>{items.length}</strong>
        </article>
        <article>
          <small>待清差异</small>
          <strong className={unresolved.length ? "num-alert" : ""}>
            {unresolved.length}
          </strong>
        </article>
        <article>
          <small>最大安全距离</small>
          <strong>{Math.max(...items.map((it) => it.safetyDistance))}m</strong>
        </article>
      </section>

      <section className="workspace">
        <aside className="panel">
          <h2>当前角色</h2>
          <div className="chips role-bar">
            {ROLES.map((r) => (
              <button
                key={r.key}
                className={role === r.key ? "active" : ""}
                onClick={() => setRole(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <p className="role-hint">{ROLES.find((r) => r.key === role)?.desc}</p>

          <h2 className="aside-title">批文载入</h2>
          <div className="doc-list">
            {DOCS.map((d) => (
              <button
                key={d.id}
                className={`doc-btn ${doc?.id === d.id ? "active" : ""}`}
                onClick={() => loadDoc(d)}
              >
                <span>{d.label}</span>
                <em>{d.receivedAt.slice(5)}</em>
              </button>
            ))}
          </div>
        </aside>

        <section className="panel">
          <div className="heading">
            <div>
              <p>现场脚本 v{SCRIPT_VERSION}（编排师维护）</p>
              <h2>逐项对账表</h2>
            </div>
            <span className={`pill ${doc ? (unresolved.length ? "pill-block" : "pill-ok") : "pill-idle"}`}>
              {doc ? (unresolved.length ? `阻塞 ${unresolved.length} 项` : "差异已清空") : "未载入批文"}
            </span>
          </div>

          {mode && (
            <div className={`banner banner-${mode}`}>
              {mode === "compatible" &&
                "旧稿批文无版本号 · 已按兼容模式打开：仅对照字段，不覆盖现场脚本。"}
              {mode === "older" &&
                `批文版本 v${doc?.version} 旧于现场 v${SCRIPT_VERSION}，按版本号对账：现场改动先留着，不被旧批文安全距离盖掉。`}
              {mode === "equal" &&
                `批文版本 v${doc?.version} 与现场一致，按批文逐项对账。`}
              {mode === "newer" &&
                `批文版本 v${doc?.version} 新于现场 v${SCRIPT_VERSION}，建议同步现场脚本后再对账。`}
            </div>
          )}

          <div className="table">
            <div className="t-row t-head">
              <span>段落</span><span>型号</span><span>口径</span>
              <span>发射角度</span><span>点火时刻</span><span>安全距离</span>
              <span>状态</span>
            </div>
            {items.map((it) => {
              const blocking = blockingItemIds.has(it.id);
              const cleared = doc && !blocking && diffs.some((d) => d.itemId === it.id);
              return (
                <div key={it.id} className={`t-row ${blocking ? "row-block" : ""}`}>
                  <span><b>{it.segment}</b></span>
                  <span>{it.model}</span>
                  <span>{it.caliber}</span>
                  <span>
                    <input
                      type="number"
                      value={it.angle}
                      disabled={role !== "orchestrator"}
                      onChange={(e) => updateItem(it.id, "angle", e.target.value)}
                    />°
                  </span>
                  <span>
                    <input
                      value={it.ignitionTime}
                      disabled={role !== "orchestrator"}
                      onChange={(e) => updateItem(it.id, "ignitionTime", e.target.value)}
                    />
                  </span>
                  <span>
                    <input
                      type="number"
                      value={it.safetyDistance}
                      disabled={role !== "orchestrator"}
                      onChange={(e) => updateItem(it.id, "safetyDistance", e.target.value)}
                    />m
                  </span>
                  <span>
                    {blocking ? (
                      <em className="tag tag-block">阻塞</em>
                    ) : cleared ? (
                      <em className="tag tag-ok">已放行</em>
                    ) : (
                      <em className="tag tag-idle">{doc ? "一致" : "待对账"}</em>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          {role !== "orchestrator" && (
            <p className="role-hint">当前为只读角色，切换为编排师可临时调整点位。</p>
          )}
        </section>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>差异清单</p>
            <h2>对不上的逐项列清</h2>
          </div>
          <span className="pill pill-idle">
            {doc ? `共 ${diffs.length} 项 · 待放行 ${unresolved.length} 项` : "未载入批文"}
          </span>
        </div>

        {!doc && <p className="empty">请先在左侧载入报备系统回传的批文。</p>}
        {doc && diffs.length === 0 && (
          <p className="empty ok">批文与现场脚本逐项一致，无差异。</p>
        )}

        <div className="diff-list">
          {diffs.map((d) => {
            const ok = resolved.has(d.key);
            return (
              <article key={d.key} className={ok ? "diff-ok" : "diff-block"}>
                <div className="diff-main">
                  <span className={`tag ${ok ? "tag-ok" : "tag-block"}`}>
                    {ok ? "已放行" : "未放行"}
                  </span>
                  <b>{d.segment}</b>
                  <span className="field-name">{FIELD_LABELS[d.field]}</span>
                </div>
                <div className="diff-vals">
                  <span className="v-approved">批文 {d.approved}</span>
                  <span className="v-arrow">→</span>
                  <span className="v-onsite">现场 {d.onsite}</span>
                </div>
                <button
                  className={ok ? "" : "primary"}
                  disabled={ok}
                  onClick={() => releaseDiff(d)}
                >
                  {ok ? "已放行" : "安全员放行"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>整场预览</p>
            <h2>时间轴 · 阻塞段标出</h2>
          </div>
          <button
            className={released ? "" : "primary"}
            disabled={released}
            onClick={releaseAll}
          >
            {released ? "✓ 整场已放行" : "安全员放行整场"}
          </button>
        </div>

        {released && (
          <div className="banner banner-ok">
            整场脚本已经安全员放行，差异全部清空，可按预览点火。
          </div>
        )}

        <div className="timeline">
          <div className="tl-track">
            {items.map((it) => {
              const sec = toSeconds(it.ignitionTime);
              const left = (sec / maxSec) * 100;
              const blocking = blockingItemIds.has(it.id);
              const cleared = doc && !blocking && diffs.some((d) => d.itemId === it.id);
              return (
                <div
                  key={it.id}
                  className={`tl-seg ${blocking ? "seg-block" : cleared ? "seg-ok" : "seg-idle"}`}
                  style={{ left: `${left}%` }}
                >
                  <span className="tl-label">{it.segment}</span>
                  <span className="tl-time">{it.ignitionTime}</span>
                  {blocking && <span className="tl-flag">阻塞段</span>}
                </div>
              );
            })}
          </div>
          <div className="tl-legend">
            <span><i className="swatch swatch-block" />阻塞段（差异未清空）</span>
            <span><i className="swatch swatch-ok" />已放行</span>
            <span><i className="swatch swatch-idle" />一致 / 未对账</span>
          </div>
        </div>
      </section>
    </main>
  );
}
