// Minimal RFC4180 CSV parser (handles quoted fields, embedded commas/newlines, "" escapes)
// and a mapper for Meta (Facebook) Ads Manager Thai-locale exports.

import { blankRow, type AdRow } from "@/lib/rules";

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

function findHeaderIndex(header: string[], exact: string, startsWithFallback?: string): number {
  const i = header.indexOf(exact);
  if (i !== -1) return i;
  if (startsWithFallback) {
    return header.findIndex((h) => h.startsWith(startsWithFallback));
  }
  return -1;
}

function toNum(v: string | undefined): number | null {
  if (v === undefined) return null;
  const s = v.trim();
  if (s === "" || s === "-") return null;
  const n = parseFloat(s.replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

export type FbCsvParseResult = {
  rows: AdRow[];
  missingColumns: string[];
};

export function parseFacebookAdsCsv(text: string, newId: () => string): FbCsvParseResult {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], missingColumns: [] };
  const header = table[0];

  const col = {
    adSetName: findHeaderIndex(header, "ชื่อชุดโฆษณา"),
    amountSpent: findHeaderIndex(header, "จำนวนเงินที่ใช้จ่ายไป (THB)", "จำนวนเงินที่ใช้จ่ายไป"),
    impressions: findHeaderIndex(header, "อิมเพรสชัน"),
    reach: findHeaderIndex(header, "การเข้าถึง"),
    results: findHeaderIndex(header, "ผลลัพธ์"),
    costPerResult: findHeaderIndex(header, "ต้นทุนต่อผลลัพธ์"),
    cpcAll: findHeaderIndex(header, "CPC (ทั้งหมด) (THB)", "CPC (ทั้งหมด)"),
    cpcLink: findHeaderIndex(header, "CPC (ต้นทุนต่อการคลิกลิงก์) (THB)", "CPC (ต้นทุนต่อการคลิกลิงก์)"),
  };

  const required: [string, number][] = [
    ["ชื่อชุดโฆษณา", col.adSetName],
    ["จำนวนเงินที่ใช้จ่ายไป (THB)", col.amountSpent],
    ["อิมเพรสชัน", col.impressions],
    ["ผลลัพธ์", col.results],
  ];
  const missingColumns = required.filter(([, idx]) => idx === -1).map(([label]) => label);
  if (missingColumns.length) return { rows: [], missingColumns };

  type Agg = {
    adsetName: string;
    amountSpent: number;
    impressions: number;
    reach: number;
    results: number;
    linkClicks: number;
    allClicks: number;
  };
  const bySet = new Map<string, Agg>();

  for (const r of table.slice(1)) {
    const adsetName = (r[col.adSetName] ?? "").trim();
    if (!adsetName) continue;
    const amountSpent = toNum(r[col.amountSpent]) ?? 0;
    const impressions = toNum(r[col.impressions]) ?? 0;
    const reach = col.reach !== -1 ? toNum(r[col.reach]) ?? 0 : 0;
    const results = toNum(r[col.results]) ?? 0;
    const cpcLink = col.cpcLink !== -1 ? toNum(r[col.cpcLink]) : null;
    const cpcAll = col.cpcAll !== -1 ? toNum(r[col.cpcAll]) : null;
    const linkClicks = cpcLink && cpcLink > 0 ? amountSpent / cpcLink : 0;
    const allClicks = cpcAll && cpcAll > 0 ? amountSpent / cpcAll : 0;

    const agg = bySet.get(adsetName) ?? {
      adsetName,
      amountSpent: 0,
      impressions: 0,
      reach: 0,
      results: 0,
      linkClicks: 0,
      allClicks: 0,
    };
    agg.amountSpent += amountSpent;
    agg.impressions += impressions;
    agg.reach += reach;
    agg.results += results;
    agg.linkClicks += linkClicks;
    agg.allClicks += allClicks;
    bySet.set(adsetName, agg);
  }

  const rows: AdRow[] = Array.from(bySet.values()).map((agg) => {
    const base = blankRow(newId());
    return {
      ...base,
      adsetName: agg.adsetName,
      amountSpent: agg.amountSpent || null,
      impressions: agg.impressions || null,
      cpm: agg.impressions > 0 ? (agg.amountSpent / agg.impressions) * 1000 : null,
      ctrAll: agg.impressions > 0 ? (agg.allClicks / agg.impressions) * 100 : null,
      linkClicks: agg.linkClicks > 0 ? Math.round(agg.linkClicks) : null,
      cpc: agg.linkClicks > 0 ? agg.amountSpent / agg.linkClicks : null,
      frequency: agg.reach > 0 ? agg.impressions / agg.reach : null,
      results: agg.results || null,
      costPerResult: agg.results > 0 ? agg.amountSpent / agg.results : null,
    };
  });

  return { rows, missingColumns: [] };
}
