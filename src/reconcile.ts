import type { ApprovalDoc, DiffEntry, ScriptItem, VersionMode } from "./types";
import { SCRIPT_VERSION } from "./data";

// 逐项对照：点火时刻、安全距离、发射角度（点位）对不上即进差异清单
export function reconcile(items: ScriptItem[], doc: ApprovalDoc | null): DiffEntry[] {
  if (!doc) return [];
  const map = new Map(doc.items.map((it) => [it.id, it] as const));
  const diffs: DiffEntry[] = [];
  for (const item of items) {
    const ap = map.get(item.id);
    if (!ap) continue;
    const checks: Array<[DiffEntry["field"], string, string, string]> = [
      ["ignitionTime", "点火时刻", ap.ignitionTime, item.ignitionTime],
      ["safetyDistance", "安全距离", `${ap.safetyDistance}m`, `${item.safetyDistance}m`],
      ["angle", "发射角度", `${ap.angle}°`, `${item.angle}°`],
    ];
    for (const [field, fieldLabel, approved, onsite] of checks) {
      if (approved !== onsite) {
        diffs.push({
          key: `${item.id}:${field}`,
          itemId: item.id,
          segment: item.segment,
          field,
          fieldLabel,
          approved,
          onsite,
        });
      }
    }
  }
  return diffs;
}

// 按版本号对账；旧稿无版本号进入兼容模式
export function versionMode(doc: ApprovalDoc | null): VersionMode | null {
  if (!doc) return null;
  if (doc.version === null) return "compatible";
  if (doc.version < SCRIPT_VERSION) return "older";
  if (doc.version === SCRIPT_VERSION) return "equal";
  return "newer";
}

export function toSeconds(t: string): number {
  const [m, rest] = t.split(":");
  return Number(m) * 60 + Number(rest);
}
