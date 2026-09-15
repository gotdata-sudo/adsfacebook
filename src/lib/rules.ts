// Rule engine — ported from the original prototype and kept in one place
// so the Upload (live preview), Ranking, History and Admin screens always
// score a row identically. Raw fields are the only thing ever stored;
// everything here is derived at render time from the CURRENT rules, so an
// admin's threshold change re-evaluates every past upload immediately.

export type AdRow = {
  id: string;
  adsetName: string;
  campaignName: string | null;
  amountSpent: number | null;
  impressions: number | null;
  cpm: number | null;
  ctrAll: number | null;
  linkClicks: number | null;
  cpc: number | null;
  frequency: number | null;
  results: number | null;
  costPerResult: number | null;
  engagementRate: number | null;
  adAgeDays: number | null;
  bidAdjustmentRound: number | null;
};

export type Rules = {
  cpmMin: number;
  cpmMax: number;
  cpmDayCutoff: number;
  ctrMin: number;
  ctrMax: number;
  cpcSkipRounds: number;
  signupCaptureRate: number;
  targetCostPerResult: number | null;
  freqMin: number;
  freqMax: number;
  resultRateWarnAgeDays: number;
  resultRateWarnPct: number;
};

export const DEFAULT_RULES: Rules = {
  cpmMin: 300,
  cpmMax: 600,
  cpmDayCutoff: 1,
  ctrMin: 0.8,
  ctrMax: 1.25,
  cpcSkipRounds: 3,
  signupCaptureRate: 0.8,
  targetCostPerResult: null,
  freqMin: 1.08,
  freqMax: 9,
  resultRateWarnAgeDays: 3,
  resultRateWarnPct: 30,
};

export const RULES_FIELDS: { key: keyof Rules; label: string; step: string; nullable?: boolean }[] = [
  { key: "cpmMin", label: "CPM ต่ำสุด (บาท) — เกณฑ์วันแรก", step: "1" },
  { key: "cpmMax", label: "CPM สูงสุด (บาท) — เกณฑ์วันแรก", step: "1" },
  { key: "cpmDayCutoff", label: "ใช้เกณฑ์ CPM ถึงอายุแอด ≤ (วัน)", step: "1" },
  { key: "ctrMin", label: "CTR ต่ำสุดที่ยอมรับ (%)", step: "0.01" },
  { key: "ctrMax", label: "CTR สูงสุดของช่วงปกติ (%)", step: "0.01" },
  { key: "freqMin", label: "ความถี่ต่ำสุดที่เริ่มนิ่ง", step: "0.01" },
  { key: "freqMax", label: "ความถี่ห้ามเกิน", step: "0.01" },
  { key: "cpcSkipRounds", label: "จำนวนรอบขยับราคาที่ยังไม่ตัดสิน", step: "1" },
  { key: "signupCaptureRate", label: "สัดส่วนหัวสมัครที่ใช้คิดต้นทุนปรับ (0–1)", step: "0.01" },
  { key: "targetCostPerResult", label: "เป้าต้นทุน/ผลลัพธ์ปรับ (บาท, เว้นว่าง = ไม่ตัดสิน)", step: "1", nullable: true },
  { key: "resultRateWarnAgeDays", label: "เตือนอัตราผลลัพธ์/คลิก เมื่ออายุแอด ≥ (วัน)", step: "1" },
  { key: "resultRateWarnPct", label: "เตือนเมื่ออัตราผลลัพธ์/คลิกเกิน (%)", step: "1" },
];

export type CheckStatus = "pass" | "good" | "warn" | "fail" | "info";
export type Check = { key: string; status: CheckStatus; label: string; detail: string };
export type Verdict = "good" | "warn" | "bad" | "unknown";

export type Evaluation = {
  cpm: number | null;
  cpc: number | null;
  costPerResult: number | null;
  impPerBaht: number | null;
  resultRate: number | null;
  adjustedCostPerResult: number | null;
  checks: Check[];
  verdict: Verdict;
  verdictLabel: string;
  score: number | null;
};

function hasVal(v: unknown): v is number {
  return v !== null && v !== undefined && v !== ("" as unknown);
}
function n(v: unknown): number {
  if (!hasVal(v)) return 0;
  const num = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  return isNaN(num) ? 0 : num;
}
export function fmt(v: number | null | undefined, d = 2): string {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return Number(v).toLocaleString("th-TH", { maximumFractionDigits: d });
}

export function evaluateRow(r: AdRow, rules: Rules): Evaluation {
  const spend = n(r.amountSpent);
  const impressions = n(r.impressions);
  const linkClicks = n(r.linkClicks);
  const results = n(r.results);
  const adAge = hasVal(r.adAgeDays) ? n(r.adAgeDays) : 1;
  const round = hasVal(r.bidAdjustmentRound) ? n(r.bidAdjustmentRound) : 0;

  const cpm = hasVal(r.cpm) ? n(r.cpm) : impressions > 0 ? (spend / impressions) * 1000 : null;
  const cpc = hasVal(r.cpc) ? n(r.cpc) : linkClicks > 0 ? spend / linkClicks : null;
  const costPerResult = hasVal(r.costPerResult) ? n(r.costPerResult) : results > 0 ? spend / results : null;
  const impPerBaht = spend > 0 ? impressions / spend : null;
  const resultRate = linkClicks > 0 ? (results / linkClicks) * 100 : null;
  const adjustedCostPerResult = results > 0 ? spend / (results * (rules.signupCaptureRate || 0.8)) : null;

  const checks: Check[] = [];

  if (adAge <= rules.cpmDayCutoff) {
    if (cpm === null) {
      checks.push({ key: "cpm", status: "info", label: "CPM", detail: "ไม่มีข้อมูลพอคำนวณ" });
    } else if (cpm < rules.cpmMin) {
      checks.push({ key: "cpm", status: "good", label: "CPM", detail: `${fmt(cpm)} ต่ำกว่าช่วงเป้าหมาย (${rules.cpmMin}–${rules.cpmMax}) ยิ่งต่ำยิ่งดี` });
    } else if (cpm <= rules.cpmMax) {
      checks.push({ key: "cpm", status: "pass", label: "CPM", detail: `${fmt(cpm)} อยู่ในช่วงเป้าหมายวันแรก (${rules.cpmMin}–${rules.cpmMax})` });
    } else {
      checks.push({ key: "cpm", status: "warn", label: "CPM", detail: `${fmt(cpm)} สูงกว่าช่วงเป้าหมาย (${rules.cpmMin}–${rules.cpmMax}) ต้นทุนการมองเห็นแพง` });
    }
  } else {
    checks.push({ key: "cpm", status: "info", label: "CPM", detail: `${cpm === null ? "—" : fmt(cpm)} (เลยวันแรกแล้ว ไม่ใช้เกณฑ์นี้ตัดสิน)` });
  }

  if (!hasVal(r.ctrAll)) {
    checks.push({ key: "ctr", status: "info", label: "CTR", detail: "ไม่มีข้อมูล" });
  } else {
    const ctr = n(r.ctrAll);
    if (ctr < rules.ctrMin) checks.push({ key: "ctr", status: "fail", label: "CTR", detail: `${fmt(ctr)}% ต่ำกว่าช่วง ${rules.ctrMin}–${rules.ctrMax}% เนื้อหาอาจไม่ดึงดูด` });
    else if (ctr <= rules.ctrMax) checks.push({ key: "ctr", status: "pass", label: "CTR", detail: `${fmt(ctr)}% อยู่ในช่วงปกติ ${rules.ctrMin}–${rules.ctrMax}%` });
    else checks.push({ key: "ctr", status: "good", label: "CTR", detail: `${fmt(ctr)}% สูงกว่าช่วงปกติ ยิ่งสูงยิ่งดี` });
  }

  if (!hasVal(r.frequency)) {
    checks.push({ key: "freq", status: "info", label: "ความถี่", detail: "ไม่มีข้อมูล" });
  } else {
    const f = n(r.frequency);
    if (f > rules.freqMax) checks.push({ key: "freq", status: "fail", label: "ความถี่", detail: `${fmt(f)} เกิน ${rules.freqMax} เสี่ยงหลุดไปหากลุ่มเพื่อนของออดิเอนซ์เดิม` });
    else if (f < rules.freqMin) checks.push({ key: "freq", status: "warn", label: "ความถี่", detail: `${fmt(f)} ยังต่ำกว่า ${rules.freqMin} ยังไม่นิ่ง/ยังใหม่` });
    else checks.push({ key: "freq", status: "pass", label: "ความถี่", detail: `${fmt(f)} อยู่ในช่วงปกติ (${rules.freqMin}–${rules.freqMax}) ถ้าเป็นคนเดิมยิ่งดี` });
  }

  const pct = Math.round((rules.signupCaptureRate || 0.8) * 100);
  if (round >= 1 && round <= rules.cpcSkipRounds) {
    checks.push({
      key: "cpc",
      status: "info",
      label: "ต้นทุน/ผลลัพธ์",
      detail: `อยู่ระหว่างขยับราคา ครั้งที่ ${round}/${rules.cpcSkipRounds} (ทุก 5–10 นาที) — ยังไม่ตัดสินช่วงนี้${adjustedCostPerResult !== null ? `, ต้นทุน/ผลลัพธ์ปรับ (${pct}%) ล่าสุด ≈ ${fmt(adjustedCostPerResult)} บาท` : ""}`,
    });
  } else if (adjustedCostPerResult === null) {
    checks.push({ key: "cpc", status: "info", label: "ต้นทุน/ผลลัพธ์", detail: "ไม่มีข้อมูลผลลัพธ์พอคำนวณ" });
  } else if (hasVal(rules.targetCostPerResult)) {
    const t = n(rules.targetCostPerResult);
    if (adjustedCostPerResult > t) checks.push({ key: "cpc", status: "fail", label: "ต้นทุน/ผลลัพธ์", detail: `ต้นทุน/ผลลัพธ์ปรับ (${pct}%) ≈ ${fmt(adjustedCostPerResult)} บาท สูงกว่าเป้า ${fmt(t)} บาท` });
    else checks.push({ key: "cpc", status: "pass", label: "ต้นทุน/ผลลัพธ์", detail: `ต้นทุน/ผลลัพธ์ปรับ (${pct}%) ≈ ${fmt(adjustedCostPerResult)} บาท อยู่ในเป้า ${fmt(t)} บาท` });
  } else {
    checks.push({ key: "cpc", status: "info", label: "ต้นทุน/ผลลัพธ์", detail: `ต้นทุน/ผลลัพธ์ปรับ (ใช้จ่าย ÷ ${pct}% ของผลลัพธ์) ≈ ${fmt(adjustedCostPerResult)} บาท — ยังไม่ได้ตั้งเป้าในหน้าแอดมิน` });
  }

  if (resultRate === null) {
    checks.push({ key: "rate", status: "info", label: "อัตราผลลัพธ์/คลิก", detail: "ไม่มีข้อมูลคลิกลิงก์" });
  } else if (adAge >= rules.resultRateWarnAgeDays && resultRate > rules.resultRateWarnPct) {
    checks.push({ key: "rate", status: "warn", label: "อัตราผลลัพธ์/คลิก", detail: `${fmt(resultRate)}% หลังเปิดมา ${adAge} วัน สูงเกิน ${rules.resultRateWarnPct}% อาจเริ่มอิ่มตัว` });
  } else {
    checks.push({ key: "rate", status: "good", label: "อัตราผลลัพธ์/คลิก", detail: `${fmt(resultRate)}% ยิ่งสูงยิ่งดี` });
  }

  if (hasVal(r.engagementRate)) {
    checks.push({ key: "eng", status: "info", label: "อัตราการมีส่วนร่วม", detail: `${fmt(n(r.engagementRate))}% (ยังไม่ตั้งเกณฑ์ตัดสิน)` });
  }

  const fails = checks.filter((c) => c.status === "fail").length;
  const warns = checks.filter((c) => c.status === "warn").length;
  let verdict: Verdict;
  let verdictLabel: string;
  if (impPerBaht === null) {
    verdict = "unknown";
    verdictLabel = "รอข้อมูล";
  } else if (fails > 0) {
    verdict = "bad";
    verdictLabel = "ควรปิด";
  } else if (warns > 0) {
    verdict = "warn";
    verdictLabel = "เฝ้าระวัง";
  } else {
    verdict = "good";
    verdictLabel = "เปิดต่อ";
  }
  const score = impPerBaht === null ? null : Math.max(0, 100 - fails * 30 - warns * 12);

  return { cpm, cpc, costPerResult, impPerBaht, resultRate, adjustedCostPerResult, checks, verdict, verdictLabel, score };
}

export function pickBest(rows: AdRow[], rules: Rules) {
  const evaluated = rows
    .map((row) => ({ row, v: evaluateRow(row, rules) }))
    .filter((x) => x.v.impPerBaht !== null);
  const nonBad = evaluated.filter((x) => x.v.verdict !== "bad");
  const pool = nonBad.length ? nonBad : evaluated;
  if (!pool.length) return null;
  pool.sort((a, b) => (b.v.impPerBaht ?? 0) - (a.v.impPerBaht ?? 0));
  return { row: pool[0].row, v: pool[0].v, hasHealthy: nonBad.length > 0 };
}

export const ROW_FIELDS: (keyof AdRow)[] = [
  "adsetName",
  "campaignName",
  "amountSpent",
  "impressions",
  "cpm",
  "ctrAll",
  "linkClicks",
  "cpc",
  "frequency",
  "results",
  "costPerResult",
  "engagementRate",
  "adAgeDays",
  "bidAdjustmentRound",
];

export function blankRow(id: string): AdRow {
  return {
    id,
    adsetName: "",
    campaignName: null,
    amountSpent: null,
    impressions: null,
    cpm: null,
    ctrAll: null,
    linkClicks: null,
    cpc: null,
    frequency: null,
    results: null,
    costPerResult: null,
    engagementRate: null,
    adAgeDays: 1,
    bidAdjustmentRound: 0,
  };
}
