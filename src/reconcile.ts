import type {
  ApprovalDoc,
  Cue,
  Diff,
  DiffType,
  FieldDiff,
  FieldKey,
  ReconNote,
  ReconResult,
} from "./types";

/** mm:ss.mmm -> 毫秒，用于点火时刻比较与时间轴定位 */
export function ignitionToMs(value: string): number {
  const match = /^(\d+):(\d{1,2})(?:\.(\d{1,3}))?$/.exec(value.trim());
  if (!match) return Number.NaN;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const millis = match[3] ? Number(match[3].padEnd(3, "0")) : 0;
  return minutes * 60000 + seconds * 1000 + millis;
}

export const FIELD_LABELS: Record<FieldKey, string> = {
  position: "点位",
  ignition: "点火时刻",
  angle: "发射角度",
  safetyDistance: "安全距离",
};

/** 阻塞放行的差异类型：未报备属于硬阻塞 */
export function isBlocking(type: DiffType): boolean {
  return type === "unreported";
}

/** 只有安全员放行 / 处置才算数 */
export function isReleased(type: DiffType): boolean {
  return type === "approval_stale";
}

function fieldValue(cue: Cue, field: FieldKey): string {
  switch (field) {
    case "position":
      return cue.position;
    case "ignition":
      return cue.ignition;
    case "angle":
      return `${cue.angle}°`;
    case "safetyDistance":
      return `${cue.safetyDistance}m`;
  }
}

function diffFields(approval: Cue, site: Cue): FieldDiff[] {
  const keys: FieldKey[] = ["position", "ignition", "angle", "safetyDistance"];
  return keys
    .map((field) => ({
      field,
      approval: fieldValue(approval, field),
      site: fieldValue(site, field),
    }))
    .filter(
      (item) =>
        item.approval.trim() !== item.site.trim() ||
        (item.field === "ignition" &&
          ignitionToMs(item.approval) !== ignitionToMs(item.site))
    );
}

function diffKey(type: DiffType, cueId: string): string {
  return `${type}:${cueId}`;
}

/**
 * 逐项对账：批文 cue 与现场 cue 按编号对齐。
 * - 批文无版本号（旧稿）：兼容打开，不按版本号判胜负。
 * - 两边都有版本号：批文旧 -> approval_stale，现场值保留、不被旧安全距离盖掉；
 *   批文新 -> approval_newer，要求现场回同步。
 */
export function reconcile(approval: ApprovalDoc, site: Cue[]): ReconResult {
  const diffs: Diff[] = [];
  const notes: ReconNote[] = [];
  const siteById = new Map(site.map((cue) => [cue.id, cue]));
  const approvalIds = new Set(approval.cues.map((cue) => cue.id));

  for (const approvalCue of approval.cues) {
    const siteCue = siteById.get(approvalCue.id);
    if (!siteCue) {
      diffs.push({
        key: diffKey("missing_site", approvalCue.id),
        cueId: approvalCue.id,
        segment: approvalCue.segment,
        position: approvalCue.position,
        model: approvalCue.model,
        type: "missing_site",
        fields: [],
        approvalVersion: approvalCue.version,
      });
      continue;
    }

    const fields = diffFields(approvalCue, siteCue);
    if (fields.length === 0) continue;

    let type: DiffType;
    if (!approval.versioned || approvalCue.version === undefined) {
      // 旧稿无版本号：兼容模式，按差异提示，不自动裁决
      type = "deviation";
      notes.push({
        cueId: approvalCue.id,
        text: "批文为无版本号旧稿，按兼容模式对照，差异由安全员人工判定。",
      });
    } else if (siteCue.version === undefined) {
      // 现场条目缺版本号，以有版本号的批文为准
      type = "approval_newer";
    } else if (approvalCue.version < siteCue.version) {
      // 报备系统回传版本比现场旧：按版本号对账，现场改动保留
      type = "approval_stale";
    } else if (approvalCue.version > siteCue.version) {
      type = "approval_newer";
    } else {
      type = "deviation";
    }

    diffs.push({
      key: diffKey(type, approvalCue.id),
      cueId: approvalCue.id,
      segment: siteCue.segment,
      position: siteCue.position,
      model: siteCue.model,
      type,
      fields,
      approvalVersion: approvalCue.version,
      siteVersion: siteCue.version,
    });
  }

  for (const cue of site) {
    if (!approvalIds.has(cue.id)) {
      diffs.push({
        key: diffKey("unreported", cue.id),
        cueId: cue.id,
        segment: cue.segment,
        position: cue.position,
        model: cue.model,
        type: "unreported",
        fields: [],
        siteVersion: cue.version,
      });
    }
  }

  return { legacy: !approval.versioned, diffs, notes };
}

/** 点火间隔过近（<2.5s）仅作编排提示，不计入合规差异 */
export function findTimingConflicts(site: Cue[]): string[] {
  const sorted = [...site]
    .map((cue) => ({ id: cue.id, t: ignitionToMs(cue.ignition) }))
    .filter((item) => Number.isFinite(item.t))
    .sort((a, b) => a.t - b.t);
  const conflicts: string[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].t - sorted[i - 1].t;
    if (gap < 2500) {
      conflicts.push(
        `${sorted[i - 1].id} → ${sorted[i].id} 点火间隔仅 ${(gap / 1000).toFixed(2)}s`
      );
    }
  }
  return conflicts;
}
