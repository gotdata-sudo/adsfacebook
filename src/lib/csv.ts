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
    results: findHeaderIndex(header, "ผลลัพธ์"),
    costPerResult: findHeaderIndex(header, "ต้นทุนต่อผลลัพธ์"),
    cpm: findHeaderIndex(header, "CPM (ต้นทุนต่ออิมเพรสชั่น 1,000 ครั้ง) (THB)", "CPM ("),
    ctrAll: findHeaderIndex(header, "CTR (ทั้งหมด)"),
    cpcLink: findHeaderIndex(header, "CPC (ต้นทุนต่อการคลิกลิงก์) (THB)", "CPC (ต้นทุนต่อการคลิกลิงก์)"),
    frequency: findHeaderIndex(header, "ความถี่"),
  };

  const required: [string, number][] = [
    ["ชื่อชุดโฆษณา", col.adSetName],
    ["จำนวนเงินที่ใช้จ่ายไป (THB)", col.amountSpent],
    ["อิมเพรสชัน", col.impressions],
    ["ผลลัพธ์", col.results],
  ];
  const missingColumns = required.filter(([, idx]) => idx === -1).map(([label]) => label);
  if (missingColumns.length) return { rows: [], missingColumns };

  const rows: AdRow[] = [];
  for (const r of table.slice(1)) {
    const adsetName = (r[col.adSetName] ?? "").trim();
    if (!adsetName) continue;
    const amountSpent = toNum(r[col.amountSpent]);
    const cpcLink = col.cpcLink !== -1 ? toNum(r[col.cpcLink]) : null;
    const linkClicks = cpcLink && cpcLink > 0 && amountSpent ? Math.round(amountSpent / cpcLink) : null;

    const base = blankRow(newId());
    rows.push({
      ...base,
      adsetName,
      amountSpent,
      impressions: toNum(r[col.impressions]),
      cpm: col.cpm !== -1 ? toNum(r[col.cpm]) : null,
      ctrAll: col.ctrAll !== -1 ? toNum(r[col.ctrAll]) : null,
      linkClicks,
      cpc: cpcLink,
      frequency: col.frequency !== -1 ? toNum(r[col.frequency]) : null,
      results: toNum(r[col.results]),
      costPerResult: col.costPerResult !== -1 ? toNum(r[col.costPerResult]) : null,
    });
  }

  return { rows, missingColumns: [] };
}
