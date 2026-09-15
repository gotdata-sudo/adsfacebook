"use client";

import { useMemo, useState } from "react";
import { evaluateRow, type Rules } from "@/lib/rules";
import type { Upload } from "@/lib/types";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function DashboardTab({ uploads, rules }: { uploads: Upload[]; rules: Rules }) {
  const [from, setFrom] = useState(daysAgoStr(30));
  const [to, setTo] = useState(todayStr());
  const [brandFilter, setBrandFilter] = useState("__all__");
  const [viewMode, setViewMode] = useState<"combined" | "person">("combined");

  const brands = useMemo(() => {
    const set = new Set<string>();
    uploads.forEach((u) => u.brand && set.add(u.brand));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [uploads]);

  const filtered = useMemo(() => {
    const fromTime = from ? new Date(from + "T00:00:00").getTime() : -Infinity;
    const toTime = to ? new Date(to + "T23:59:59").getTime() : Infinity;
    return uploads.filter((u) => {
      const t = new Date(u.created_at).getTime();
      if (t < fromTime || t > toTime) return false;
      if (brandFilter !== "__all__" && (u.brand ?? "") !== brandFilter) return false;
      return true;
    });
  }, [uploads, from, to, brandFilter]);

  const totals = useMemo(() => {
    let rows = 0;
    let spend = 0;
    let impressions = 0;
    let results = 0;
    const counts = { good: 0, warn: 0, bad: 0, unknown: 0 };
    filtered.forEach((u) =>
      u.rows.forEach((r) => {
        rows += 1;
        spend += r.amountSpent ?? 0;
        impressions += r.impressions ?? 0;
        results += r.results ?? 0;
        counts[evaluateRow(r, rules).verdict] += 1;
      })
    );
    return { uploads: filtered.length, rows, spend, impressions, results, counts };
  }, [filtered, rules]);

  const personRows = useMemo(() => {
    type PersonStat = { email: string; name: string; uploads: number; rows: number; spend: number; good: number; warn: number; bad: number };
    const map = new Map<string, PersonStat>();
    filtered.forEach((u) => {
      const s = map.get(u.uploader_email) ?? { email: u.uploader_email, name: u.uploader_name, uploads: 0, rows: 0, spend: 0, good: 0, warn: 0, bad: 0 };
      s.uploads += 1;
      u.rows.forEach((r) => {
        s.rows += 1;
        s.spend += r.amountSpent ?? 0;
        const v = evaluateRow(r, rules).verdict;
        if (v === "good" || v === "warn" || v === "bad") s[v] += 1;
      });
      map.set(u.uploader_email, s);
    });
    return Array.from(map.values()).sort((a, b) => b.spend - a.spend);
  }, [filtered, rules]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-[19px] font-semibold m-0">แดชบอร์ด</h1>

      <div className="bg-surface border border-line rounded-card shadow-sm p-5">
        <div className="flex flex-wrap items-end gap-3.5">
          <div>
            <label className="block text-[12.5px] font-semibold text-inkDim mb-1">จากวันที่</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 rounded-lg border border-lineStrong bg-surface text-sm" />
          </div>
          <div>
            <label className="block text-[12.5px] font-semibold text-inkDim mb-1">ถึงวันที่</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 rounded-lg border border-lineStrong bg-surface text-sm" />
          </div>
          <div>
            <label className="block text-[12.5px] font-semibold text-inkDim mb-1">แบรนด์</label>
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-lineStrong bg-surface text-sm min-w-[160px]"
            >
              <option value="__all__">ทุกแบรนด์</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-1 bg-surface2 p-1 rounded-lg">
            <button
              onClick={() => setViewMode("combined")}
              className={`px-3 py-1.5 rounded-md text-[13px] font-semibold ${viewMode === "combined" ? "bg-surface shadow-sm" : "text-inkDim"}`}
            >
              ภาพรวมรวม
            </button>
            <button
              onClick={() => setViewMode("person")}
              className={`px-3 py-1.5 rounded-md text-[13px] font-semibold ${viewMode === "person" ? "bg-surface shadow-sm" : "text-inkDim"}`}
            >
              แยกรายคน
            </button>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-line rounded-card shadow-sm p-5">
        <h2 className="text-[17px] font-semibold font-display mb-3">สรุปตามตัวกรอง</h2>
        <div className="flex gap-3 flex-wrap">
          <Stat label="ชุดข้อมูล" value={totals.uploads} />
          <Stat label="แอดเซ็ตทั้งหมด" value={totals.rows} />
          <Stat label="ยอดใช้จ่ายรวม (฿)" value={totals.spend.toLocaleString("th-TH", { maximumFractionDigits: 0 })} />
          <Stat label="อิมเพรสชันรวม" value={totals.impressions.toLocaleString("th-TH")} />
          <Stat label="ผลลัพธ์รวม" value={totals.results.toLocaleString("th-TH")} />
          <Stat label="เปิดต่อ" value={totals.counts.good} colorClass="text-good" />
          <Stat label="เฝ้าระวัง" value={totals.counts.warn} colorClass="text-warn" />
          <Stat label="ควรปิด" value={totals.counts.bad} colorClass="text-bad" />
        </div>
      </div>

      {viewMode === "person" && (
        <div className="bg-surface border border-line rounded-card shadow-sm p-5">
          <h2 className="text-[17px] font-semibold font-display mb-3">สรุปแยกรายคน</h2>
          {personRows.length === 0 ? (
            <p className="text-inkFaint text-[13px]">ไม่มีข้อมูลในช่วง/แบรนด์ที่เลือก</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="border-collapse w-full text-[13px]">
                <thead>
                  <tr>
                    <th className="th">คน</th>
                    <th className="th">ชุดข้อมูล</th>
                    <th className="th">แอดเซ็ต</th>
                    <th className="th">ยอดใช้จ่าย (฿)</th>
                    <th className="th text-good">เปิดต่อ</th>
                    <th className="th text-warn">เฝ้าระวัง</th>
                    <th className="th text-bad">ควรปิด</th>
                  </tr>
                </thead>
                <tbody>
                  {personRows.map((s) => (
                    <tr key={s.email} className="hover:bg-surface2">
                      <td className="td">
                        {s.name} <span className="text-inkFaint text-[12px]">· {s.email}</span>
                      </td>
                      <td className="td font-mono">{s.uploads}</td>
                      <td className="td font-mono">{s.rows}</td>
                      <td className="td font-mono">{s.spend.toLocaleString("th-TH", { maximumFractionDigits: 0 })}</td>
                      <td className="td font-mono text-good">{s.good}</td>
                      <td className="td font-mono text-warn">{s.warn}</td>
                      <td className="td font-mono text-bad">{s.bad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, colorClass }: { label: string; value: number | string; colorClass?: string }) {
  return (
    <div className="flex-1 min-w-[140px] bg-surface2 border border-line rounded-xl px-4 py-3.5">
      <div className="text-[11.5px] uppercase tracking-wide text-inkFaint font-display">{label}</div>
      <div className={`font-mono text-[22px] font-semibold mt-1 ${colorClass ?? ""}`}>{value}</div>
    </div>
  );
}
