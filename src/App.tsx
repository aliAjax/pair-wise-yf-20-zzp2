import { useMemo, useRef, useState } from "react";
import "./styles.css";
import {
  FIELD_LABELS,
  findTimingConflicts,
  ignitionToMs,
  isBlocking,
  isReleased,
  reconcile,
} from "./reconcile";
import {
  APPROVAL_CURRENT,
  SAMPLE_APPROVALS,
  SITE_CUES,
} from "./sampleData";
import type {
  ActivityEntry,
  ApprovalDoc,
  Cue,
  Diff,
  DiffType,
  Resolution,
  Role,
} from "./types";

const ROLE_LABELS: Record<Role, string> = {
  safety: "安全员",
  choreographer: "编排师",
  viewer: "观察员",
};

const DIFF_META: Record<
  DiffType,
  { title: string; tone: "danger" | "warn"; hint: string }
> = {
  deviation: {
    title: "现场偏离批文",
    tone: "danger",
    hint: "同版本下现场脚本与批文不一致，须回改或由安全员处置。",
  },
  approval_newer: {
    title: "批文更新·现场待同步",
    tone: "danger",
    hint: "批文版本号比现场新，现场须按批文回同步。",
  },
  approval_stale: {
    title: "批文回传版本旧·现场保留",
    tone: "warn",
    hint: "按版本号对账：现场版本更新，现场改动先留着，不得被旧批文安全距离覆盖，安全员放行才算数。",
  },
  unreported: {
    title: "未报备条目·硬阻塞",
    tone: "danger",
    hint: "现场有、批文无，未报备点火点禁止执行。",
  },
  missing_site: {
    title: "批文有·现场缺",
    tone: "warn",
    hint: "现场脚本缺失该报备条目，须补排或由安全员确认不执行。",
  },
};

function nowLabel(): string {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}

function App() {
  const [role, setRole] = useState<Role>("choreographer");
  const [approval, setApproval] = useState<ApprovalDoc | null>(null);
  const [site, setSite] = useState<Cue[]>(() => SITE_CUES.map((cue) => ({ ...cue })));
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});
  const [releasedAt, setReleasedAt] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivityEntry[]>([
    { id: 0, at: nowLabel(), text: "现场脚本已载入，等待载入报备批文进行逐项对账。", tone: "ok" },
  ]);
  const [denied, setDenied] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const activitySeq = useRef(1);
  const denyTimer = useRef<number | undefined>(undefined);

  const recon = useMemo(
    () => (approval ? reconcile(approval, site) : null),
    [approval, site]
  );

  const openDiffs = useMemo(
    () => (recon ? recon.diffs.filter((diff) => !resolutions[diff.key]) : []),
    [recon, resolutions]
  );
  const resolvedDiffs = useMemo(
    () => (recon ? recon.diffs.filter((diff) => resolutions[diff.key]) : []),
    [recon, resolutions]
  );

  const blockingCueIds = useMemo(
    () => new Set(openDiffs.map((diff) => diff.cueId)),
    [openDiffs]
  );
  const blockedSegments = useMemo(() => {
    const set = new Set<string>();
    for (const diff of openDiffs) {
      const cue = site.find((item) => item.id === diff.cueId);
      set.add(cue?.segment ?? diff.segment);
    }
    return set;
  }, [openDiffs, site]);

  const conflicts = useMemo(() => findTimingConflicts(site), [site]);

  function log(text: string, tone: ActivityEntry["tone"] = "ok") {
    setActivities((prev) => [
      { id: activitySeq.current++, at: nowLabel(), text, tone },
      ...prev,
    ]);
  }

  /** 权限闸门：只有安全员能确认 / 放行，别的角色一律拒绝 */
  function deny(action: string): boolean {
    if (role === "safety") return false;
    const message = `权限拒绝：${ROLE_LABELS[role]}无权「${action}」，仅安全员可确认放行。`;
    setDenied(message);
    log(message, "danger");
    window.clearTimeout(denyTimer.current);
    denyTimer.current = window.setTimeout(() => setDenied(null), 3200);
    return true;
  }

  function loadApproval(doc: ApprovalDoc, via = "载入") {
    setApproval(doc);
    setResolutions({});
    setReleasedAt(null);
    const legacy = !doc.versioned;
    log(
      `${via}批文 ${doc.docNo}（${doc.title}）${
        legacy ? "：旧稿无版本号，已按兼容模式打开" : "，已按版本号逐项对账"
      }。`,
      legacy ? "warn" : "ok"
    );
  }

  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result)) as Partial<ApprovalDoc> & {
          cues?: Partial<Cue>[];
        };
        if (!raw || typeof raw.docNo !== "string" || !Array.isArray(raw.cues)) {
          throw new Error("缺少 docNo 或 cues");
        }
        const versioned = raw.versioned !== false;
        const doc: ApprovalDoc = {
          docNo: raw.docNo,
          title: typeof raw.title === "string" ? raw.title : raw.docNo,
          source: typeof raw.source === "string" ? raw.source : "外部批文文件",
          issuedAt: typeof raw.issuedAt === "string" ? raw.issuedAt : "未知",
          versioned,
          cues: raw.cues.map((cue, index) => ({
            id: String(cue.id ?? `X${index + 1}`),
            segment: String(cue.segment ?? "未命名段落"),
            model: String(cue.model ?? "未填型号"),
            caliber: String(cue.caliber ?? "-"),
            angle: Number(cue.angle ?? 90),
            position: String(cue.position ?? "未标注点位"),
            x: Number(cue.x ?? 50),
            y: Number(cue.y ?? 16),
            ignition: String(cue.ignition ?? "00:00.000"),
            duration: Number(cue.duration ?? 0),
            safetyDistance: Number(cue.safetyDistance ?? 0),
            musicCue: String(cue.musicCue ?? "-"),
            ...(versioned && typeof cue.version === "number"
              ? { version: cue.version }
              : {}),
          })),
        };
        loadApproval(doc, "导入");
      } catch (error) {
        log(`批文文件解析失败：${(error as Error).message}`, "danger");
      }
    };
    reader.readAsText(file);
  }

  /** 现场脚本字段编辑（编排师临时调点位），改动会立刻重新对账 */
  function updateSiteCue(id: string, patch: Partial<Cue>) {
    setSite((prev) =>
      prev.map((cue) => (cue.id === id ? { ...cue, ...patch } : cue))
    );
    setReleasedAt(null);
    const names = Object.keys(patch)
      .map((key) => FIELD_LABELS[key as keyof typeof FIELD_LABELS] ?? key)
      .join("、");
    log(`${ROLE_LABELS[role]}调整现场条目 ${id}：${names}，已重新对账。`, "warn");
  }

  /** 把现场条目回改至批文值（仅用于 deviation / approval_newer） */
  function applyApproval(diff: Diff) {
    if (deny("回改至批文")) return;
    if (!approval) return;
    const approvalCue = approval.cues.find((cue) => cue.id === diff.cueId);
    if (!approvalCue) return;
    setSite((prev) =>
      prev.map((cue) =>
        cue.id === diff.cueId
          ? {
              ...cue,
              position: approvalCue.position,
              x: approvalCue.x,
              y: approvalCue.y,
              ignition: approvalCue.ignition,
              angle: approvalCue.angle,
              safetyDistance: approvalCue.safetyDistance,
              ...(approvalCue.version !== undefined
                ? { version: approvalCue.version }
                : {}),
            }
          : cue
      )
    );
    const note = `安全员已将 ${diff.cueId} 回改至批文值（${diff.fields
      .map((field) => FIELD_LABELS[field.field])
      .join("、")}）。`;
    setResolutions((prev) => ({
      ...prev,
      [diff.key]: { action: "released", by: "safety", at: nowLabel(), note },
    }));
    setReleasedAt(null);
    log(note, "ok");
  }

  /** 批文版本旧时放行现场值，现场改动保留 */
  function releaseStale(diff: Diff) {
    if (deny("放行现场改动")) return;
    const note = `安全员核验版本号（批文 v${diff.approvalVersion ?? "-"} < 现场 v${
      diff.siteVersion ?? "-"
    }）：现场值有效并予以保留，旧批文安全距离不覆盖现场，差异登记放行。`;
    setResolutions((prev) => ({
      ...prev,
      [diff.key]: { action: "released", by: "safety", at: nowLabel(), note },
    }));
    setReleasedAt(null);
    log(note, "ok");
  }

  /** 批文有、现场缺：安全员确认现场不执行 */
  function acknowledgeMissing(diff: Diff) {
    if (deny("确认现场不执行")) return;
    const note = `安全员确认 ${diff.cueId}（${diff.position}）本场不执行，报备条目挂起。`;
    setResolutions((prev) => ({
      ...prev,
      [diff.key]: { action: "acknowledged", by: "safety", at: nowLabel(), note },
    }));
    setReleasedAt(null);
    log(note, "ok");
  }

  /** 现场有、批文无：安全员撤下未报备条目 */
  function removeUnreported(diff: Diff) {
    if (deny("撤下未报备条目")) return;
    setSite((prev) => prev.filter((cue) => cue.id !== diff.cueId));
    const note = `安全员撤下未报备条目 ${diff.cueId}（${diff.position} / ${diff.model}）。`;
    setResolutions((prev) => ({
      ...prev,
      [diff.key]: { action: "removed", by: "safety", at: nowLabel(), note },
    }));
    setReleasedAt(null);
    log(note, "danger");
  }

  function finalRelease() {
    if (!approval) return;
    if (deny("整场放行")) return;
    if (openDiffs.length > 0) return;
    const stamp = nowLabel();
    setReleasedAt(stamp);
    log(`安全员整场放行：差异已全部清空，预览阻塞解除（${stamp}）。`, "ok");
  }

  const canFinalRelease = approval !== null && openDiffs.length === 0;

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <p className="kicker">hxyfront-62008 · 合规对账台 · Port 62008</p>
          <h1>烟花燃放脚本 · 批文对账</h1>
          <span className="subtitle">
            载入批文后逐项对照现场脚本；点火时刻、安全距离等不一致自动进入差异清单；只有安全员放行才算数。
          </span>
        </div>
        <div className="role-switch" role="group" aria-label="角色切换">
          <span className="role-label">当前角色</span>
          {(Object.keys(ROLE_LABELS) as Role[]).map((item) => (
            <button
              key={item}
              className={role === item ? "role active" : "role"}
              onClick={() => setRole(item)}
            >
              {ROLE_LABELS[item]}
            </button>
          ))}
        </div>
      </header>

      <section className="loader panel">
        <div className="loader-info">
          <h2>报备批文</h2>
          {approval ? (
            <div className="doc-meta">
              <strong>{approval.title}</strong>
              <span>文号 {approval.docNo}</span>
              <span>{approval.source}</span>
              <span>签发 {approval.issuedAt}</span>
              {!approval.versioned && (
                <span className="badge warn">旧稿无版本号 · 兼容打开</span>
              )}
              {approval.versioned && (
                <span className="badge ok">按版本号对账</span>
              )}
            </div>
          ) : (
            <p className="muted">尚未载入批文，请选择示例批文或导入批文 JSON。</p>
          )}
        </div>
        <div className="loader-actions">
          {SAMPLE_APPROVALS.map((sample) => (
            <button
              key={sample.key}
              className={approval?.docNo === sample.doc.docNo ? "ghost active" : "ghost"}
              onClick={() => loadApproval(sample.doc)}
            >
              {sample.label}
            </button>
          ))}
          <button className="ghost" onClick={() => fileRef.current?.click()}>
            导入批文 JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleImportFile(file);
              event.target.value = "";
            }}
          />
        </div>
      </section>

      <section className="metrics">
        <article>
          <small>批文对照条目</small>
          <strong>{approval?.cues.length ?? 0}</strong>
        </article>
        <article className={openDiffs.length ? "stat-danger" : ""}>
          <small>待清差异</small>
          <strong>{openDiffs.length}</strong>
        </article>
        <article className={blockedSegments.size ? "stat-danger" : ""}>
          <small>预览阻塞段落</small>
          <strong>{blockedSegments.size}</strong>
        </article>
        <article>
          <small>安全员已处置</small>
          <strong>{Object.keys(resolutions).length}</strong>
        </article>
      </section>

      {releasedAt && (
        <div className="release-banner ok">
          ✅ 安全员已于 {releasedAt} 整场放行，全部段落可执行。
        </div>
      )}
      {approval && !canFinalRelease && !releasedAt && (
        <div className="release-banner warn">
          ⛔ 差异未清空，预览中标注的阻塞段落禁止执行；须由安全员逐项处置后再整场放行。
        </div>
      )}
      {!approval && (
        <div className="release-banner warn">
          ⚠ 未载入批文，无法对账。载入后差异清单、阻塞标记与放行闸口才会生效。
        </div>
      )}

      <div className="recon-grid">
        <section className="panel diff-panel">
          <div className="heading">
            <div>
              <p className="kicker">差异清单</p>
              <h2>待安全员处置（{openDiffs.length}）</h2>
            </div>
          </div>

          {!approval && <p className="muted">载入批文后在此逐项列出差异。</p>}
          {approval && openDiffs.length === 0 && (
            <p className="muted ok-text">差异已清空，可由安全员整场放行。</p>
          )}

          <div className="diff-list">
            {openDiffs.map((diff) => (
              <DiffCard
                key={diff.key}
                diff={diff}
                role={role}
                onApply={applyApproval}
                onRelease={releaseStale}
                onAcknowledge={acknowledgeMissing}
                onRemove={removeUnreported}
              />
            ))}
          </div>

          {resolvedDiffs.length > 0 && (
            <>
              <h3 className="resolved-title">已处置（{resolvedDiffs.length}）</h3>
              <div className="diff-list">
                {resolvedDiffs.map((diff) => (
                  <article key={diff.key} className="diff-card resolved">
                    <div className="diff-head">
                      <span className="diff-id">{diff.cueId}</span>
                      <span className="badge ok">安全员已处置</span>
                    </div>
                    <p className="resolved-note">{resolutions[diff.key].note}</p>
                    <small className="muted">{resolutions[diff.key].at}</small>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="panel cue-panel">
          <div className="heading">
            <div>
              <p className="kicker">逐项对照</p>
              <h2>现场脚本 vs 批文</h2>
            </div>
            <span className="muted">编排师可直接调整现场值，差异实时重算</span>
          </div>
          <div className="cue-list">
            {site.map((cue) => {
              const cueDiffs = openDiffs.filter((diff) => diff.cueId === cue.id);
              const approvalCue = approval?.cues.find((item) => item.id === cue.id);
              const blocked = blockingCueIds.has(cue.id);
              return (
                <CueCard
                  key={cue.id}
                  cue={cue}
                  approvalCue={approvalCue}
                  loaded={approval !== null}
                  blocked={blocked}
                  diffs={cueDiffs}
                  editable={role === "choreographer"}
                  onUpdate={(patch) => updateSiteCue(cue.id, patch)}
                />
              );
            })}
          </div>
        </section>
      </div>

      <section className="panel preview-panel">
        <div className="heading">
          <div>
            <p className="kicker">整场节目预览</p>
            <h2>点位平面图与时间轴</h2>
          </div>
          <div className="legend">
            <span><i className="dot site" />现场点位</span>
            <span><i className="dot approval" />批文点位</span>
            <span><i className="dot block" />阻塞</span>
          </div>
        </div>

        <SiteMap approval={approval} site={site} blockedIds={blockingCueIds} />

        <Timeline site={site} blockedIds={blockingCueIds} blockedSegments={blockedSegments} />
      </section>

      <div className="bottom-grid">
        <section className="panel">
          <div className="heading">
            <div>
              <p className="kicker">型号清单</p>
              <h2>现场在用型号</h2>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>型号</th>
                <th>口径</th>
                <th>数量</th>
                <th>最小安全距离</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(
                site.reduce<
                  Record<string, { model: string; caliber: string; count: number; min: number }>
                >((acc, cue) => {
                  const item = acc[cue.model] ?? {
                    model: cue.model,
                    caliber: cue.caliber,
                    count: 0,
                    min: Infinity,
                  };
                  item.count += 1;
                  item.min = Math.min(item.min, cue.safetyDistance);
                  acc[cue.model] = item;
                  return acc;
                }, {})
              ).map((item) => (
                <tr key={item.model}>
                  <td>{item.model}</td>
                  <td>{item.caliber}</td>
                  <td>{item.count}</td>
                  <td>{Number.isFinite(item.min) ? `${item.min}m` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <div className="heading">
            <div>
              <p className="kicker">冲突时间提示</p>
              <h2>相邻点火间隔</h2>
            </div>
          </div>
          {conflicts.length === 0 ? (
            <p className="muted">相邻点火间隔均不小于 2.5s，未发现编排冲突。</p>
          ) : (
            <ul className="conflict-list">
              {conflicts.map((text) => (
                <li key={text}>⚠ {text}</li>
              ))}
            </ul>
          )}
          <p className="muted small">该提示仅服务编排，不计入合规差异；合规以批文对账为准。</p>
        </section>

        <section className="panel log-panel">
          <div className="heading">
            <div>
              <p className="kicker">操作留痕</p>
              <h2>对账日志</h2>
            </div>
          </div>
          <ul className="log-list">
            {activities.map((entry) => (
              <li key={entry.id} className={`tone-${entry.tone}`}>
                <small>{entry.at}</small>
                <span>{entry.text}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="release-bar panel">
        <div>
          <strong>整场放行闸门</strong>
          <span className="muted">
            {role === "safety"
              ? "当前为安全员账号，可处置差异并整场放行。"
              : `当前为${ROLE_LABELS[role]}账号，确认与放行将被权限拒绝。`}
          </span>
        </div>
        <button
          className="primary"
          disabled={!canFinalRelease || releasedAt !== null}
          onClick={finalRelease}
        >
          {releasedAt ? "已整场放行" : canFinalRelease ? "安全员整场放行" : "差异未清空·禁止放行"}
        </button>
      </footer>

      {denied && (
        <div className="toast" role="alert">
          🔒 {denied}
        </div>
      )}
    </main>
  );
}

/* ---------------- 差异卡片 ---------------- */

function DiffCard(props: {
  diff: Diff;
  role: Role;
  onApply: (diff: Diff) => void;
  onRelease: (diff: Diff) => void;
  onAcknowledge: (diff: Diff) => void;
  onRemove: (diff: Diff) => void;
}) {
  const { diff, role } = props;
  const meta = DIFF_META[diff.type];
  const locked = role !== "safety";

  return (
    <article className={`diff-card ${meta.tone}`}>
      <div className="diff-head">
        <span className="diff-id">{diff.cueId}</span>
        <span className="segment-tag">{diff.segment}</span>
        <span className={`badge ${meta.tone}`}>{meta.title}</span>
        {isBlocking(diff.type) && <span className="badge danger solid">阻塞</span>}
      </div>
      <p className="diff-hint">{meta.hint}</p>

      {diff.fields.length > 0 && (
        <table className="field-table">
          <tbody>
            {diff.fields.map((field) => (
              <tr key={field.field}>
                <th>{FIELD_LABELS[field.field]}</th>
                <td className="approval-val">批文 {field.approval}</td>
                <td className="arrow">→</td>
                <td className="site-val">现场 {field.site}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {diff.type === "unreported" && (
        <p className="diff-detail">
          现场新增：{diff.model} · {diff.position}
          {diff.siteVersion !== undefined ? ` · v${diff.siteVersion}` : ""}
          ，批文中无此编号。
        </p>
      )}
      {diff.type === "missing_site" && (
        <p className="diff-detail">
          批文要求：{diff.model} · {diff.position}
          {diff.approvalVersion !== undefined ? ` · v${diff.approvalVersion}` : ""}
          ，现场脚本缺失。
        </p>
      )}
      {diff.type === "approval_stale" && (
        <p className="diff-detail">
          版本号：批文 v{diff.approvalVersion} 旧于现场 v{diff.siteVersion}
          ，按版本号以现场为准，旧安全距离保留不覆盖。
        </p>
      )}
      {diff.type === "approval_newer" && (
        <p className="diff-detail">
          版本号：批文 v{diff.approvalVersion} 新于现场 v{diff.siteVersion ?? "未标注"}
          ，现场须同步。
        </p>
      )}

      <div className="diff-actions">
        {(diff.type === "deviation" || diff.type === "approval_newer") && (
          <button
            className="action danger"
            title={locked ? "仅安全员可回改" : "按批文覆盖现场值"}
            onClick={() => props.onApply(diff)}
          >
            {locked ? "🔒 仅安全员可回改至批文" : "回改至批文"}
          </button>
        )}
        {isReleased(diff.type) && (
          <>
            <button
              className="action warn"
              disabled
              title="批文版本更旧，禁止用旧批文值覆盖现场"
            >
              禁止以旧批文覆盖现场
            </button>
            <button
              className="action ok"
              title={locked ? "仅安全员可放行" : "核验版本后放行现场值"}
              onClick={() => props.onRelease(diff)}
            >
              {locked ? "🔒 仅安全员可放行" : "安全员放行·现场保留"}
            </button>
          </>
        )}
        {diff.type === "missing_site" && (
          <button
            className="action warn"
            title={locked ? "仅安全员可确认" : "登记该条目本场不执行"}
            onClick={() => props.onAcknowledge(diff)}
          >
            {locked ? "🔒 仅安全员可确认不执行" : "确认现场不执行"}
          </button>
        )}
        {diff.type === "unreported" && (
          <button
            className="action danger solid"
            title={locked ? "仅安全员可撤下" : "从现场脚本撤下该未报备条目"}
            onClick={() => props.onRemove(diff)}
          >
            {locked ? "🔒 仅安全员可撤下" : "撤下未报备条目"}
          </button>
        )}
      </div>
    </article>
  );
}

/* ---------------- 条目对照卡片 ---------------- */

function CueCard(props: {
  cue: Cue;
  approvalCue: Cue | undefined;
  loaded: boolean;
  blocked: boolean;
  diffs: Diff[];
  editable: boolean;
  onUpdate: (patch: Partial<Cue>) => void;
}) {
  const { cue, approvalCue, loaded, blocked, diffs, editable, onUpdate } = props;
  const mismatchFields = new Set(
    diffs.flatMap((diff) => diff.fields.map((field) => field.field))
  );
  const unreported = loaded && !approvalCue;

  return (
    <article className={`cue-card ${blocked ? "blocked" : ""} ${!loaded ? "no-approval" : ""}`}>
      <div className="cue-head">
        <span className="cue-id">{cue.id}</span>
        <span className="segment-tag">{cue.segment}</span>
        <span className="cue-model">{cue.model} · {cue.caliber}</span>
        <span className="cue-version">
          {cue.version !== undefined ? `现场 v${cue.version}` : "现场无版本号"}
        </span>
        {blocked && <span className="badge danger solid">段落阻塞</span>}
        {unreported && <span className="badge danger solid">未报备</span>}
        {loaded && approvalCue && !blocked && (
          <span className="badge ok">对账一致</span>
        )}
      </div>

      <div className="cue-columns">
        <div className="cue-col approval-col">
          <small>批文</small>
          {!loaded ? (
            <p className="muted">未载入批文</p>
          ) : !approvalCue ? (
            <p className="muted danger-text">批文无此条目</p>
          ) : (
            <dl>
              <dt>点位</dt>
              <dd className={mismatchFields.has("position") ? "cell-bad" : ""}>
                {approvalCue.position}
              </dd>
              <dt>点火时刻</dt>
              <dd className={mismatchFields.has("ignition") ? "cell-bad" : ""}>
                {approvalCue.ignition}
              </dd>
              <dt>发射角度</dt>
              <dd className={mismatchFields.has("angle") ? "cell-bad" : ""}>
                {approvalCue.angle}°
              </dd>
              <dt>安全距离</dt>
              <dd className={mismatchFields.has("safetyDistance") ? "cell-bad" : ""}>
                {approvalCue.safetyDistance}m
              </dd>
              <dt>版本</dt>
              <dd>{approvalCue.version !== undefined ? `v${approvalCue.version}` : "无版本号"}</dd>
            </dl>
          )}
        </div>

        <div className="cue-col site-col">
          <small>现场脚本{editable ? "（可调整）" : ""}</small>
          <div className="site-fields">
            <label>
              <span>点位</span>
              <input
                value={cue.position}
                disabled={!editable}
                onChange={(event) => onUpdate({ position: event.target.value })}
              />
            </label>
            <label>
              <span>点火时刻</span>
              <input
                value={cue.ignition}
                disabled={!editable}
                onChange={(event) => onUpdate({ ignition: event.target.value })}
              />
            </label>
            <label>
              <span>角度(°)</span>
              <input
                type="number"
                value={cue.angle}
                disabled={!editable}
                onChange={(event) => onUpdate({ angle: Number(event.target.value) })}
              />
            </label>
            <label>
              <span>安全距离(m)</span>
              <input
                type="number"
                value={cue.safetyDistance}
                disabled={!editable}
                onChange={(event) =>
                  onUpdate({ safetyDistance: Number(event.target.value) })
                }
              />
            </label>
          </div>
          <p className="cue-meta">
            持续 {cue.duration}s · 音乐点 {cue.musicCue}
          </p>
        </div>
      </div>
    </article>
  );
}

/* ---------------- 点位平面图 ---------------- */

function SiteMap(props: {
  approval: ApprovalDoc | null;
  site: Cue[];
  blockedIds: Set<string>;
}) {
  const { approval, site, blockedIds } = props;
  const approvalById = new Map(approval?.cues.map((cue) => [cue.id, cue]) ?? []);

  return (
    <svg className="site-map" viewBox="0 0 100 34" role="img" aria-label="燃放点位平面图">
      <rect x="0" y="0" width="100" height="34" rx="1.5" className="map-bg" />
      <polygon points="20,32 80,32 70,18 30,18" className="stage" />
      <text x="50" y="29" textAnchor="middle" className="map-label">观众区</text>
      <line x1="0" y1="17" x2="100" y2="17" className="map-line" />

      {approval?.cues.map((cue) => {
        const siteCue = site.find((item) => item.id === cue.id);
        if (siteCue) return null;
        return (
          <g key={`a-${cue.id}`}>
            <rect
              x={cue.x - 1.6}
              y={cue.y - 1.6}
              width="3.2"
              height="3.2"
              className="map-approval-only"
            />
            <text x={cue.x} y={cue.y - 2.4} textAnchor="middle" className="map-id">
              {cue.id}
            </text>
          </g>
        );
      })}

      {site.map((cue) => {
        const approvalCue = approvalById.get(cue.id);
        const moved =
          approvalCue &&
          (approvalCue.position !== cue.position ||
            approvalCue.x !== cue.x ||
            approvalCue.y !== cue.y);
        const blocked = blockedIds.has(cue.id);
        return (
          <g key={cue.id}>
            {moved && (
              <line
                x1={approvalCue!.x}
                y1={approvalCue!.y}
                x2={cue.x}
                y2={cue.y}
                className="map-connector"
              />
            )}
            {moved && (
              <>
                <rect
                  x={approvalCue!.x - 1.6}
                  y={approvalCue!.y - 1.6}
                  width="3.2"
                  height="3.2"
                  className="map-approval-marker"
                />
                <text
                  x={approvalCue!.x}
                  y={approvalCue!.y - 2.4}
                  textAnchor="middle"
                  className="map-id"
                >
                  {cue.id}′
                </text>
              </>
            )}
            <circle
              cx={cue.x}
              cy={cue.y}
              r="1.7"
              className={
                blocked ? "map-dot block" : !approvalCue && approval ? "map-dot block" : "map-dot"
              }
            />
            <text x={cue.x} y={cue.y - 2.6} textAnchor="middle" className="map-id">
              {cue.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------------- 时间轴 / 段落预览 ---------------- */

function Timeline(props: {
  site: Cue[];
  blockedIds: Set<string>;
  blockedSegments: Set<string>;
}) {
  const { site, blockedIds, blockedSegments } = props;
  const segments: string[] = [];
  for (const cue of [...site].sort((a, b) => ignitionToMs(a.ignition) - ignitionToMs(b.ignition))) {
    if (!segments.includes(cue.segment)) segments.push(cue.segment);
  }
  const times = site.map((cue) => ignitionToMs(cue.ignition)).filter(Number.isFinite);
  const maxT = Math.max(...(times.length ? times : [0]), 1000);

  return (
    <div className="timeline">
      {segments.map((segment) => {
        const cues = site
          .filter((cue) => cue.segment === segment)
          .sort((a, b) => ignitionToMs(a.ignition) - ignitionToMs(b.ignition));
        const blocked = blockedSegments.has(segment);
        return (
          <div key={segment} className={`tl-row ${blocked ? "blocked" : ""}`}>
            <div className="tl-label">
              <span>{segment}</span>
              {blocked ? (
                <span className="badge danger solid">⛔ 阻塞段</span>
              ) : (
                <span className="badge ok">可执行</span>
              )}
            </div>
            <div className="tl-track">
              {blocked && <div className="tl-block-overlay">差异未清空 · 禁止执行</div>}
              {cues.map((cue) => (
                <div
                  key={cue.id}
                  className={`tl-cue ${blockedIds.has(cue.id) ? "block" : ""}`}
                  style={{ left: `${(ignitionToMs(cue.ignition) / maxT) * 100}%` }}
                  title={`${cue.id} ${cue.ignition} · ${cue.position} · 安全距离 ${cue.safetyDistance}m`}
                >
                  <i />
                  <b>{cue.id}</b>
                  <small>{cue.ignition}</small>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default App;
