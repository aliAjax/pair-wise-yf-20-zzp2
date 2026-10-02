export type Role = "safety" | "orchestrator" | "guest";

export interface ScriptItem {
  id: string;
  segment: string; // 节目段落
  model: string; // 烟花型号
  caliber: string; // 口径
  angle: number; // 发射角度（点位）
  ignitionTime: string; // 点火时刻 mm:ss.mmm
  safetyDistance: number; // 安全距离 m
  duration: string; // 持续时间
  musicTime: string; // 音乐时间点
}

export interface ApprovalItem {
  id: string;
  ignitionTime: string;
  safetyDistance: number;
  angle: number;
}

export interface ApprovalDoc {
  id: string;
  label: string;
  version: number | null; // null = 旧稿无版本号
  source: string;
  receivedAt: string;
  note: string;
  items: ApprovalItem[];
}

export type DiffField = "ignitionTime" | "safetyDistance" | "angle";

export interface DiffEntry {
  key: string;
  itemId: string;
  segment: string;
  field: DiffField;
  fieldLabel: string;
  approved: string;
  onsite: string;
}

export type VersionMode = "compatible" | "older" | "equal" | "newer";
