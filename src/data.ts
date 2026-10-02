import type { ApprovalDoc, ScriptItem } from "./types";

// 现场脚本（编排师维护，版本 v3）
export const SCRIPT_VERSION = 3;

export const SCRIPT_ITEMS: ScriptItem[] = [
  {
    id: "s1",
    segment: "Intro",
    model: "30mm扇形架",
    caliber: "30mm",
    angle: 45,
    ignitionTime: "00:12.500",
    safetyDistance: 35,
    duration: "00:08.000",
    musicTime: "00:12.000",
  },
  {
    id: "s2",
    segment: "Chorus A",
    model: "75mm礼花弹",
    caliber: "75mm",
    angle: 60,
    ignitionTime: "01:08.200",
    safetyDistance: 80,
    duration: "00:12.000",
    musicTime: "01:08.000",
  },
  {
    id: "s3",
    segment: "Finale",
    model: "冷焰火",
    caliber: "-",
    angle: 90,
    ignitionTime: "03:42.000",
    safetyDistance: 25,
    duration: "00:20.000",
    musicTime: "03:41.500",
  },
];

// 报备系统回传的批文（多版本，演示对账规则）
export const DOCS: ApprovalDoc[] = [
  {
    id: "bp-v2",
    label: "批文 v2.0（旧版）",
    version: 2,
    source: "报备系统",
    receivedAt: "2026-09-28 09:12",
    note: "版本旧于现场 v3，按版本号对账，现场改动保留",
    items: [
      { id: "s1", ignitionTime: "00:12.500", safetyDistance: 35, angle: 45 },
      { id: "s2", ignitionTime: "01:08.200", safetyDistance: 60, angle: 60 },
      { id: "s3", ignitionTime: "03:40.000", safetyDistance: 25, angle: 90 },
    ],
  },
  {
    id: "bp-v3",
    label: "批文 v3.0（同步）",
    version: 3,
    source: "报备系统",
    receivedAt: "2026-10-01 16:40",
    note: "与现场脚本同版本，按批文逐项对账",
    items: [
      { id: "s1", ignitionTime: "00:12.500", safetyDistance: 35, angle: 45 },
      { id: "s2", ignitionTime: "01:08.200", safetyDistance: 80, angle: 55 },
      { id: "s3", ignitionTime: "03:42.000", safetyDistance: 25, angle: 90 },
    ],
  },
  {
    id: "bp-v4",
    label: "批文 v4.0（新版）",
    version: 4,
    source: "报备系统",
    receivedAt: "2026-10-02 08:05",
    note: "版本新于现场 v3，建议同步现场脚本后再对账",
    items: [
      { id: "s1", ignitionTime: "00:12.500", safetyDistance: 35, angle: 45 },
      { id: "s2", ignitionTime: "01:08.200", safetyDistance: 80, angle: 60 },
      { id: "s3", ignitionTime: "03:42.000", safetyDistance: 30, angle: 90 },
    ],
  },
  {
    id: "bp-draft",
    label: "旧稿（无版本号·兼容）",
    version: null,
    source: "历史报备件",
    receivedAt: "2026-08-15 11:20",
    note: "旧稿无版本号，按兼容模式打开，仅对照字段不覆盖现场",
    items: [
      { id: "s1", ignitionTime: "00:12.000", safetyDistance: 30, angle: 45 },
      { id: "s2", ignitionTime: "01:08.200", safetyDistance: 60, angle: 60 },
      { id: "s3", ignitionTime: "03:42.000", safetyDistance: 25, angle: 90 },
    ],
  },
];
