import type { ApprovalDoc, Cue } from "./types";

/** 现场脚本（编排师当前工作台） */
export const SITE_CUES: Cue[] = [
  {
    id: "C01",
    segment: "Intro",
    model: "30mm扇形架",
    caliber: "30mm",
    angle: 75,
    position: "A-前沿水台",
    x: 18,
    y: 6,
    ignition: "00:12.500",
    duration: 4.5,
    safetyDistance: 35,
    musicCue: "00:12 前奏第一拍",
    version: 3,
  },
  {
    id: "C02",
    segment: "Intro",
    model: "罗马烛光",
    caliber: "20mm",
    angle: 80,
    position: "B-左侧架",
    x: 10,
    y: 12,
    ignition: "00:18.800",
    duration: 3.2,
    safetyDistance: 25,
    musicCue: "00:18 弦乐进入",
    version: 3,
  },
  {
    id: "C03",
    segment: "Chorus A",
    model: "75mm礼花弹",
    caliber: "75mm",
    angle: 90,
    position: "C-主发射点",
    x: 50,
    y: 18,
    ignition: "01:08.200",
    duration: 6,
    safetyDistance: 80,
    musicCue: "01:08 副歌重拍",
    version: 4,
  },
  {
    id: "C04",
    segment: "Chorus A",
    model: "75mm礼花弹",
    caliber: "75mm",
    angle: 88,
    position: "D-右侧架",
    x: 78,
    y: 16,
    ignition: "01:21.000",
    duration: 5.5,
    safetyDistance: 80,
    musicCue: "01:21 鼓花",
    version: 4,
  },
  {
    id: "C05",
    segment: "Chorus B",
    model: "扇形架",
    caliber: "50mm",
    angle: 70,
    position: "E-水面浮台",
    x: 50,
    y: 8,
    ignition: "02:14.400",
    duration: 5,
    safetyDistance: 45,
    musicCue: "02:14 人声高音",
    version: 2,
  },
  {
    id: "C06",
    segment: "Finale",
    model: "冷焰火",
    caliber: "15mm",
    angle: 60,
    position: "F-近景区",
    x: 42,
    y: 4,
    ignition: "03:42.000",
    duration: 8,
    safetyDistance: 12,
    musicCue: "03:42 尾声齐奏",
    version: 5,
  },
  {
    id: "C07",
    segment: "Finale",
    model: "100mm礼花弹",
    caliber: "100mm",
    angle: 90,
    position: "G-后场中央",
    x: 50,
    y: 24,
    ignition: "03:50.500",
    duration: 7,
    safetyDistance: 100,
    musicCue: "03:50 终场重拍",
    version: 5,
  },
];

function clone(cues: Cue[]): Cue[] {
  return cues.map((cue) => ({ ...cue }));
}

/** 批文甲：当前批文（回传版本最新），现场存在点火时刻 / 安全距离 / 点位偏离，且有条目未报备 */
export const APPROVAL_CURRENT: ApprovalDoc = {
  docNo: "YHBA-2026-1007",
  title: "滨江音乐节烟花燃放批文（当前版）",
  source: "市应急管理局报备系统",
  issuedAt: "2026-09-28 14:20",
  versioned: true,
  cues: (() => {
    const cues = clone(SITE_CUES).filter((cue) => cue.id !== "C07");
    const c01 = cues.find((cue) => cue.id === "C01")!;
    c01.ignition = "00:12.000"; // 现场临时延后了 0.5s
    c01.safetyDistance = 35;
    const c03 = cues.find((cue) => cue.id === "C03")!;
    c03.safetyDistance = 100; // 现场擅自缩到 80m
    const c06 = cues.find((cue) => cue.id === "C06")!;
    c06.position = "F-近景区外移点";
    c06.x = 46;
    c06.y = 7;
    c06.safetyDistance = 20; // 现场 12m 不达标
    c06.version = 5;
    return cues;
  })(),
};

/** 批文乙：报备系统回传的旧版本批文，按版本号对账，现场改动必须保留 */
export const APPROVAL_STALE: ApprovalDoc = {
  docNo: "YHBA-2026-0918",
  title: "滨江音乐节烟花燃放批文（回传旧版）",
  source: "报备系统历史回传",
  issuedAt: "2026-09-18 09:05",
  versioned: true,
  cues: clone([
    {
      id: "C01",
      segment: "Intro",
      model: "30mm扇形架",
      caliber: "30mm",
      angle: 75,
      position: "A-前沿水台",
      x: 18,
      y: 6,
      ignition: "00:10.000",
      duration: 4.5,
      safetyDistance: 50, // 旧批文更保守，不得反向覆盖现场 35m
      musicCue: "00:10 旧前奏",
      version: 1,
    },
    {
      id: "C02",
      segment: "Intro",
      model: "罗马烛光",
      caliber: "20mm",
      angle: 80,
      position: "B-左侧架",
      x: 10,
      y: 12,
      ignition: "00:16.000",
      duration: 3.2,
      safetyDistance: 30,
      musicCue: "00:16 旧弦乐点",
      version: 1,
    },
    {
      id: "C03",
      segment: "Chorus A",
      model: "75mm礼花弹",
      caliber: "75mm",
      angle: 90,
      position: "C-主发射点",
      x: 50,
      y: 18,
      ignition: "01:05.000",
      duration: 6,
      safetyDistance: 120,
      musicCue: "01:05 旧副歌",
      version: 2,
    },
    {
      id: "C04",
      segment: "Chorus A",
      model: "75mm礼花弹",
      caliber: "75mm",
      angle: 88,
      position: "D-右侧架",
      x: 78,
      y: 16,
      ignition: "01:18.000",
      duration: 5.5,
      safetyDistance: 90,
      musicCue: "01:18 旧鼓花",
      version: 2,
    },
    {
      id: "C05",
      segment: "Chorus B",
      model: "扇形架",
      caliber: "50mm",
      angle: 70,
      position: "E-水面浮台",
      x: 50,
      y: 8,
      ignition: "02:14.400",
      duration: 5,
      safetyDistance: 45,
      musicCue: "02:14 人声高音",
      version: 2,
    },
    {
      id: "C06",
      segment: "Finale",
      model: "冷焰火",
      caliber: "15mm",
      angle: 60,
      position: "F-近景区",
      x: 42,
      y: 4,
      ignition: "03:40.000",
      duration: 8,
      safetyDistance: 25,
      musicCue: "03:40 旧尾声",
      version: 1,
    },
  ]),
};

/** 批文丙：旧稿，没有任何版本号，需按兼容模式打开 */
export const APPROVAL_LEGACY: ApprovalDoc = {
  docNo: "YHBA-2025-初排",
  title: "初排纸质稿（无版本号旧稿）",
  source: "纸质稿扫描录入",
  issuedAt: "2025-12-30 （未标注版本）",
  versioned: false,
  cues: clone(
    SITE_CUES.filter((cue) => cue.id !== "C07").map((cue) => {
      const withoutVersion: Cue = { ...cue };
      delete withoutVersion.version;
      if (cue.id === "C03") withoutVersion.safetyDistance = 80;
      if (cue.id === "C06") {
        withoutVersion.ignition = "03:45.000";
        withoutVersion.safetyDistance = 12;
      }
      return withoutVersion;
    })
  ),
};

export const SAMPLE_APPROVALS: { key: string; label: string; doc: ApprovalDoc }[] = [
  { key: "current", label: "载入当前批文", doc: APPROVAL_CURRENT },
  { key: "stale", label: "载入回传旧版批文", doc: APPROVAL_STALE },
  { key: "legacy", label: "载入无版本号旧稿", doc: APPROVAL_LEGACY },
];
