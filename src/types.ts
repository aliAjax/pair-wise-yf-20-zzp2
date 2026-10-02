export type Role = "safety" | "choreographer" | "viewer";

/** 一条点火指令（批文 / 现场脚本共用同一结构） */
export interface Cue {
  id: string; // 编号，如 C03
  segment: string; // 节目段落
  model: string; // 烟花型号
  caliber: string; // 口径
  angle: number; // 发射角度（度）
  position: string; // 点位名称
  x: number; // 平面图坐标（米）
  y: number;
  ignition: string; // 点火时刻 mm:ss.mmm
  duration: number; // 持续时间（秒）
  safetyDistance: number; // 安全距离（米）
  musicCue: string; // 音乐时间点
  version?: number; // 版本号；旧稿可能没有
}

/** 报备批文 */
export interface ApprovalDoc {
  docNo: string;
  title: string;
  source: string; // 签发 / 回传来源
  issuedAt: string;
  versioned: boolean; // false = 旧稿无版本号，按兼容模式打开
  cues: Cue[];
}

export type FieldKey = "position" | "ignition" | "angle" | "safetyDistance";

export type DiffType =
  | "deviation" // 同版本下现场偏离批文
  | "approval_newer" // 批文版本比现场新，现场未同步
  | "approval_stale" // 批文版本比现场旧，现场值保留
  | "unreported" // 现场有、批文无（未报备）
  | "missing_site"; // 批文有、现场无

export interface FieldDiff {
  field: FieldKey;
  approval: string;
  site: string;
}

export interface Diff {
  key: string;
  cueId: string;
  segment: string;
  position: string;
  model: string;
  type: DiffType;
  fields: FieldDiff[];
  approvalVersion?: number;
  siteVersion?: number;
}

export interface ReconNote {
  cueId: string;
  text: string;
}

export interface ReconResult {
  legacy: boolean;
  diffs: Diff[];
  notes: ReconNote[];
}

export type ResolutionAction = "released" | "removed" | "acknowledged";

export interface Resolution {
  action: ResolutionAction;
  by: Role;
  at: string;
  note: string;
}

export interface ActivityEntry {
  id: number;
  at: string;
  text: string;
  tone: "ok" | "warn" | "danger";
}
