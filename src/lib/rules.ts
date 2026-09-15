// Rule engine — ported from the original prototype and kept in one place
// so the Upload (live preview), Ranking, History and Admin screens always
// score a row identically. Raw fields are the only thing ever stored;
// everything here is derived at render time from the CURRENT rules, so an
// admin's threshold change re-evaluates every past upload immediately.

export type AdRow = {
  id: string;
  adsetName: string;
  campaignName: string | null;
  resultType: string | null;
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

// CPM target band for ad sets whose age (in days) falls in [minAgeDays, maxAgeDays].
// maxAgeDays === null means "no upper bound" (covers everything above minAgeDays).
export type CpmTier = {
  id: string;
  minAgeDays: number;
  maxAgeDays: number | null;
  min: number;
  max: number;
};

export type CheckKey = "cpm" | "ctr" | "freq" | "cpc" | "rate" | "eng";

export type CheckWeights = Record<CheckKey, { fail: number; warn: number }>;

// The thresholds that can be overridden per result type (e.g. a "lead" ad set
// judged by different CTR/frequency targets than a "traffic" one). The
// top-level Rules fields with the same names ARE the default profile.
export type ResultTypeProfile = {
  ctrMin: number;
  ctrMax: number;
  freqMin: number;
  freqMax: number;
  targetCostPerResult: number | null;
  resultRateWarnAgeDays: number;
  resultRateWarnPct: number;
  engagementMin: number | null;
  engagementMax: number | null;
};

export type Rules = ResultTypeProfile & {
  cpmTiers: CpmTier[];
  cpcSkipRounds: number;
  signupCaptureRate: number;
  weights: CheckWeights;
  // Keyed by the exact "result type" string (e.g. "conversions:subscribe_website").
  // A present entry is a COMPLETE profile that fully replaces the default one —
  // there is no per-field inheritance, so editing one starts from a clone of
  // the default profile.
  resultTypeOverrides: Record<string, ResultTypeProfile>;
};

export const DEFAULT_CHECK_WEIGHTS: CheckWeights = {
  cpm: { fail: 30, warn: 12 },
  ctr: { fail: 30, warn: 12 },
  freq: { fail: 30, warn: 12 },
  cpc: { fail: 30, warn: 12 },
  rate: { fail: 30, warn: 12 },
  eng: { fail: 30, warn: 12 },
};

export const DEFAULT_RULES: Rules = {
  cpmTiers: [{ id: "tier-1", minAgeDays: 0, maxAgeDays: 1, min: 300, max: 600 }],
  ctrMin: 0.8,
  ctrMax: 1.25,
  cpcSkipRounds: 3,
  signupCaptureRate: 0.8,
  targetCostPerResult: null,
  freqMin: 1.08,
  freqMax: 9,
  resultRateWarnAgeDays: 3,
  resultRateWarnPct: 30,
  engagementMin: null,
  engagementMax: null,
  weights: DEFAULT_CHECK_WEIGHTS,
  resultTypeOverrides: {},
};

export const GLOBAL_RULES_FIELDS: { key: "cpcSkipRounds" | "signupCaptureRate"; label: string; step: string }[] = [
  { key: "cpcSkipRounds", label: "จำนวนรอบขยับราคาที่ยังไม่ตัดสิน", step: "1" },
  { key: "signupCaptureRate", label: "สัดส่วนหัวสมัครที่ใช้คิดต้นทุนปรับ (0–1)", step: "0.01" },
];

export const PROFILE_FIELDS: { key: keyof ResultTypeProfile; label: string; step: string; nullable?: boolean }[] = [
  { key: "ctrMin", label: "CTR ต่ำสุดที่ยอมรับ (%)", step: "0.01" },
  { key: "ctrMax", label: "CTR สูงสุดของช่วงปกติ (%)", step: "0.01" },
  { key: "freqMin", label: "ความถี่ต่ำสุดที่เริ่มนิ่ง", step: "0.01" },
  { key: "freqMax", label: "ความถี่ห้ามเกิน", step: "0.01" },
  { key: "targetCostPerResult", label: "เป้าต้นทุน/ผลลัพธ์ปรับ (บาท, เว้นว่าง = ไม่ตัดสิน)", step: "1", nullable: true },
  { key: "resultRateWarnAgeDays", label: "เตือนอัตราผลลัพธ์/คลิก เมื่ออายุแอด ≥ (วัน)", step: "1" },
  { key: "resultRateWarnPct", label: "เตือนเมื่ออัตราผลลัพธ์/คลิกเกิน (%)", step: "1" },
  { key: "engagementMin", label: "Engagement ต่ำสุดที่ยอมรับ (%, เว้นว่าง = ไม่ตัดสิน)", step: "0.01", nullable: true },
  { key: "engagementMax", label: "Engagement สูงสุดของช่วงปกติ (%, เว้นว่าง = ไม่ตัดสิน)", step: "0.01", nullable: true },
];

export function defaultProfile(rules: Rules): ResultTypeProfile {
  return {
    ctrMin: rules.ctrMin,
    ctrMax: rules.ctrMax,
    freqMin: rules.freqMin,
    freqMax: rules.freqMax,
    targetCostPerResult: rules.targetCostPerResult,
    resultRateWarnAgeDays: rules.resultRateWarnAgeDays,
    resultRateWarnPct: rules.resultRateWarnPct,
    engagementMin: rules.engagementMin,
    engagementMax: rules.engagementMax,
  };
}

function resolveProfile(rules: Rules, resultType: string | null): ResultTypeProfile {
  if (resultType && rules.resultTypeOverrides[resultType]) return rules.resultTypeOverrides[resultType];
  return defaultProfile(rules);
}

function resolveCpmTier(tiers: CpmTier[], adAge: number): CpmTier | null {
  const sorted = [...tiers].sort((a, b) => a.minAgeDays - b.minAgeDays);
  for (const t of sorted) {
    if (adAge >= t.minAgeDays && (t.maxAgeDays === null || adAge <= t.maxAgeDays)) return t;
  }
  return null;
}

export type CheckStatus = "pass" | "good" | "warn" | "fail" | "info";
export type Check = { key: CheckKey; status: CheckStatus; label: string; detail: string };
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
  const profile = resolveProfile(rules, r.resultType);

  const cpm = hasVal(r.cpm) ? n(r.cpm) : impressions > 0 ? (spend / impressions) * 1000 : null;
  const cpc = hasVal(r.cpc) ? n(r.cpc) : linkClicks > 0 ? spend / linkClicks : null;
  const costPerResult = hasVal(r.costPerResult) ? n(r.costPerResult) : results > 0 ? spend / results : null;
  const impPerBaht = spend > 0 ? impressions / spend : null;
  const resultRate = linkClicks > 0 ? (results / linkClicks) * 100 : null;
  const adjustedCostPerResult = results > 0 ? spend / (results * (rules.signupCaptureRate || 0.8)) : null;

  const checks: Check[] = [];

  const tier = resolveCpmTier(rules.cpmTiers, adAge);
  if (!tier) {
    checks.push({ key: "cpm", status: "info", label: "CPM", detail: `${cpm === null ? "—" : fmt(cpm)} (ไม่มีเกณฑ์ช่วงอายุนี้)` });
  } else if (cpm === null) {
    checks.push({ key: "cpm", status: "info", label: "CPM", detail: "ไม่มีข้อมูลพอคำนวณ" });
  } else if (cpm < tier.min) {
    checks.push({ key: "cpm", status: "good", label: "CPM", detail: `${fmt(cpm)} ต่ำกว่าช่วงเป้าหมาย (${tier.min}–${tier.max}) ยิ่งต่ำยิ่งดี` });
  } else if (cpm <= tier.max) {
    checks.push({ key: "cpm", status: "pass", label: "CPM", detail: `${fmt(cpm)} อยู่ในช่วงเป้าหมาย (${tier.min}–${tier.max}) สำหรับอายุแอด ${adAge} วัน` });
  } else {
    checks.push({ key: "cpm", status: "warn", label: "CPM", detail: `${fmt(cpm)} สูงกว่าช่วงเป้าหมาย (${tier.min}–${tier.max}) ต้นทุนการมองเห็นแพง` });
  }

  if (!hasVal(r.ctrAll)) {
    checks.push({ key: "ctr", status: "info", label: "CTR", detail: "ไม่มีข้อมูล" });
  } else {
    const ctr = n(r.ctrAll);
    if (ctr < profile.ctrMin) checks.push({ key: "ctr", status: "fail", label: "CTR", detail: `${fmt(ctr)}% ต่ำกว่าช่วง ${profile.ctrMin}–${profile.ctrMax}% เนื้อหาอาจไม่ดึงดูด` });
    else if (ctr <= profile.ctrMax) checks.push({ key: "ctr", status: "pass", label: "CTR", detail: `${fmt(ctr)}% อยู่ในช่วงปกติ ${profile.ctrMin}–${profile.ctrMax}%` });
    else checks.push({ key: "ctr", status: "good", label: "CTR", detail: `${fmt(ctr)}% สูงกว่าช่วงปกติ ยิ่งสูงยิ่งดี` });
  }

  if (!hasVal(r.frequency)) {
    checks.push({ key: "freq", status: "info", label: "ความถี่", detail: "ไม่มีข้อมูล" });
  } else {
    const f = n(r.frequency);
    if (f > profile.freqMax) checks.push({ key: "freq", status: "fail", label: "ความถี่", detail: `${fmt(f)} เกิน ${profile.freqMax} เสี่ยงหลุดไปหากลุ่มเพื่อนของออดิเอนซ์เดิม` });
    else if (f < profile.freqMin) checks.push({ key: "freq", status: "warn", label: "ความถี่", detail: `${fmt(f)} ยังต่ำกว่า ${profile.freqMin} ยังไม่นิ่ง/ยังใหม่` });
    else checks.push({ key: "freq", status: "pass", label: "ความถี่", detail: `${fmt(f)} อยู่ในช่วงปกติ (${profile.freqMin}–${profile.freqMax}) ถ้าเป็นคนเดิมยิ่งดี` });
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
  } else if (hasVal(profile.targetCostPerResult)) {
    const t = n(profile.targetCostPerResult);
    if (adjustedCostPerResult > t) checks.push({ key: "cpc", status: "fail", label: "ต้นทุน/ผลลัพธ์", detail: `ต้นทุน/ผลลัพธ์ปรับ (${pct}%) ≈ ${fmt(adjustedCostPerResult)} บาท สูงกว่าเป้า ${fmt(t)} บาท` });
    else checks.push({ key: "cpc", status: "pass", label: "ต้นทุน/ผลลัพธ์", detail: `ต้นทุน/ผลลัพธ์ปรับ (${pct}%) ≈ ${fmt(adjustedCostPerResult)} บาท อยู่ในเป้า ${fmt(t)} บาท` });
  } else {
    checks.push({ key: "cpc", status: "info", label: "ต้นทุน/ผลลัพธ์", detail: `ต้นทุน/ผลลัพธ์ปรับ (ใช้จ่าย ÷ ${pct}% ของผลลัพธ์) ≈ ${fmt(adjustedCostPerResult)} บาท — ยังไม่ได้ตั้งเป้าในหน้าแอดมิน` });
  }

  if (resultRate === null) {
    checks.push({ key: "rate", status: "info", label: "อัตราผลลัพธ์/คลิก", detail: "ไม่มีข้อมูลคลิกลิงก์" });
  } else if (adAge >= profile.resultRateWarnAgeDays && resultRate > profile.resultRateWarnPct) {
    checks.push({ key: "rate", status: "warn", label: "อัตราผลลัพธ์/คลิก", detail: `${fmt(resultRate)}% หลังเปิดมา ${adAge} วัน สูงเกิน ${profile.resultRateWarnPct}% อาจเริ่มอิ่มตัว` });
  } else {
    checks.push({ key: "rate", status: "good", label: "อัตราผลลัพธ์/คลิก", detail: `${fmt(resultRate)}% ยิ่งสูงยิ่งดี` });
  }

  if (!hasVal(r.engagementRate)) {
    checks.push({ key: "eng", status: "info", label: "อัตราการมีส่วนร่วม", detail: "ไม่มีข้อมูล" });
  } else {
    const eng = n(r.engagementRate);
    if (profile.engagementMin === null && profile.engagementMax === null) {
      checks.push({ key: "eng", status: "info", label: "อัตราการมีส่วนร่วม", detail: `${fmt(eng)}% (ยังไม่ตั้งเกณฑ์ตัดสิน)` });
    } else if (hasVal(profile.engagementMin) && eng < n(profile.engagementMin)) {
      checks.push({ key: "eng", status: "fail", label: "อัตราการมีส่วนร่วม", detail: `${fmt(eng)}% ต่ำกว่า ${fmt(profile.engagementMin)}% เนื้อหาอาจไม่ดึงดูด` });
    } else if (hasVal(profile.engagementMax) && eng > n(profile.engagementMax)) {
      checks.push({ key: "eng", status: "good", label: "อัตราการมีส่วนร่วม", detail: `${fmt(eng)}% สูงกว่า ${fmt(profile.engagementMax)}% ยิ่งสูงยิ่งดี` });
    } else {
      checks.push({ key: "eng", status: "pass", label: "อัตราการมีส่วนร่วม", detail: `${fmt(eng)}% อยู่ในช่วงปกติ` });
    }
  }

  const fails = checks.filter((c) => c.status === "fail");
  const warns = checks.filter((c) => c.status === "warn");
  const weightFor = (key: CheckKey) => rules.weights[key] ?? DEFAULT_CHECK_WEIGHTS[key];
  const failScore = fails.reduce((sum, c) => sum + weightFor(c.key).fail, 0);
  const warnScore = warns.reduce((sum, c) => sum + weightFor(c.key).warn, 0);

  let verdict: Verdict;
  let verdictLabel: string;
  if (impPerBaht === null) {
    verdict = "unknown";
    verdictLabel = "รอข้อมูล";
  } else if (fails.length > 0) {
    verdict = "bad";
    verdictLabel = "ควรปิด";
  } else if (warns.length > 0) {
    verdict = "warn";
    verdictLabel = "เฝ้าระวัง";
  } else {
    verdict = "good";
    verdictLabel = "เปิดต่อ";
  }
  const score = impPerBaht === null ? null : Math.max(0, 100 - failScore - warnScore);

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
  "resultType",
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
    resultType: null,
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
