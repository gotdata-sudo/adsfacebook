"use client";

import { useMemo, useState } from "react";
import { evaluateRow, fmt, type AdRow, type Rules } from "@/lib/rules";
import type { Upload } from "@/lib/types";
import { Pill, checkPillStatus, VerdictPill } from "@/components/Pill";
import PickBanner from "@/components/PickBanner";

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return (
      d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) +
      " " +
      d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
    );
  } catch {
    return "—";
  }
}

export default function RankingTab({
  uploads,
  rules,
  scope,
  setScope,
  isAdmin,
}: {
  uploads: Upload[];
  rules: Rules;
  scope: string;
  setScope: (s: string) => void;
  isAdmin: boolean;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [brandFilter, setBrandFilter] = useState("__all__");

  const brands = useMemo(() => {
    const set = new Set<string>();
    uploads.forEach((u) => u.brand && set.add(u.brand));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [uploads]);

  const visibleUploads = useMemo(
    () => (brandFilter === "__all__" ? uploads : uploads.filter((u) => (u.brand ?? "") === brandFilter)),
    [uploads, brandFilter]
  );

  const uploaders = useMemo(() => {
    const map = new Map<string, string>();
    visibleUploads.forEach((u) => map.set(u.uploader_email, u.uploader_name));
    return Array.from(map.entries()).map(([email, name]) => ({ email, name }));
  }, [visibleUploads]);

  const effectiveScope = !isAdmin && scope.startsWith("person:") ? "__all__" : scope;

  const items = useMemo(() => {
    if (effectiveScope === "__all__") {
      return visibleUploads.flatMap((u) => u.rows.map((row) => ({ row, batch: u })));
    }
    if (effectiveScope.startsWith("person:")) {
      const email = effectiveScope.slice("person:".length);
      return visibleUploads.filter((u) => u.uploader_email === email).flatMap((u) => u.rows.map((row) => ({ row, batch: u })));
    }
    const u = visibleUploads.find((x) => x.id === effectiveScope);
    if (!u) return [];
    return u.rows.map((row) => ({ row, batch: u }));
  }, [visibleUploads, effectiveScope]);

  const evaluated = useMemo(() => {
    const list = items.map((x) => ({ ...x, v: evaluateRow(x.row, rules) }));
    list.sort((a, b) => (b.v.impPerBaht ?? -1) - (a.v.impPerBaht ?? -1));
    return list;
  }, [items, rules]);

  const showBatch = effectiveScope === "__all__" || effectiveScope.startsWith("person:");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-display text-[19px] font-semibold m-0">เส้นทางที่ดีที่สุด</h1>
        <div className="flex gap-2 flex-wrap">
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="px-2.5 py-2 rounded-lg border border-lineStrong bg-surface text-[13px]"
          >
            <option value="__all__">ทุกแบรนด์</option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <select
            value={effectiveScope}
            onChange={(e) => setScope(e.target.value)}
            className="px-2.5 py-2 rounded-lg border border-lineStrong bg-surface text-[13px]"
          >
            <option value="__all__">ภาพรวมทั้งหมด (ทุกชุด)</option>
            {isAdmin && (
              <optgroup label="ตามคน">
                {uploaders.map((p) => (
                  <option key={p.email} value={`person:${p.email}`}>
                    {p.name} ({p.email})
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="ตามชุด">
              {visibleUploads.map((u) => (
                <option key={u.id} value={u.id}>
                  {fmtDate(u.created_at)} · {u.uploader_name} · {u.rows.length} แอดเซ็ต{u.note ? ` · ${u.note}` : ""}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="bg-surface border border-line rounded-card p-12 text-center text-inkFaint">
          <h3 className="text-inkDim text-[15px] mb-1">ยังไม่มีข้อมูล</h3>
          <p className="text-[13px]">อัปโหลดผลลัพธ์แอดเซ็ตในแท็บ &quot;อัปโหลด &amp; วิเคราะห์&quot; ก่อน</p>
        </div>
      ) : (
        <>
          <PickBanner rows={items.map((x) => x.row)} rules={rules} />
          <div className="overflow-x-auto border border-line rounded-xl">
            <table className="border-collapse w-full text-[13px]">
              <thead>
                <tr>
                  <th className="th">#</th>
                  <th className="th">แอดเซ็ต</th>
                  {showBatch && <th className="th">ชุด/วันที่</th>}
                  <th className="th">ใช้จ่าย</th>
                  <th className="th">อิมเพรสชัน</th>
                  <th className="th">อิมเพรสชัน/฿</th>
                  <th className="th">CPM</th>
                  <th className="th">CTR%</th>
                  <th className="th">ความถี่</th>
                  <th className="th">ผลลัพธ์</th>
                  <th className="th">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {evaluated.map((x, idx) => (
                  <FragmentRow
                    key={x.row.id + idx}
                    idx={idx}
                    row={x.row}
                    batch={x.batch}
                    v={x.v}
                    showBatch={showBatch}
                    expanded={expanded === idx}
                    onToggle={() => setExpanded(expanded === idx ? null : idx)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function FragmentRow({
  idx,
  row,
  batch,
  v,
  showBatch,
  expanded,
  onToggle,
}: {
  idx: number;
  row: AdRow;
  batch: Upload;
  v: ReturnType<typeof evaluateRow>;
  showBatch: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr onClick={onToggle} className={`cursor-pointer hover:bg-surface2 ${idx === 0 ? "shadow-[inset_3px_0_0_rgb(var(--good))]" : ""}`}>
        <td className="td font-mono">{idx + 1}</td>
        <td className="td">
          {row.adsetName || "(ไม่มีชื่อ)"}
          {row.campaignName && <div className="text-[12px] text-inkFaint">{row.campaignName}</div>}
        </td>
        {showBatch && (
          <td className="td text-[12px] text-inkFaint">
            {fmtDate(batch.created_at)}
            <br />
            {batch.uploader_name}
          </td>
        )}
        <td className="td font-mono">{fmt(row.amountSpent, 0)}</td>
        <td className="td font-mono">{fmt(row.impressions, 0)}</td>
        <td className="td font-mono">{v.impPerBaht === null ? "—" : fmt(v.impPerBaht, 2)}</td>
        <td className="td font-mono">{v.cpm === null ? "—" : fmt(v.cpm, 1)}</td>
        <td className="td font-mono">{row.ctrAll ?? "—"}</td>
        <td className="td font-mono">{row.frequency ?? "—"}</td>
        <td className="td font-mono">{row.results ?? "—"}</td>
        <td className="td">
          <VerdictPill v={v} />
        </td>
      </tr>
      {expanded && (
        <tr className="bg-surface2">
          <td colSpan={showBatch ? 11 : 10} className="td !py-3.5 !px-4">
            <div className="flex flex-col gap-1.5">
              {v.checks.map((c) => (
                <div key={c.key} className="flex gap-2.5 items-start text-[13px]">
                  <Pill status={checkPillStatus(c.status)} label={c.status === "fail" ? "ไม่ผ่าน" : c.status === "warn" ? "ระวัง" : c.status === "info" ? "ข้อมูล" : "ผ่าน"} />
                  <div>
                    <b className="font-display font-semibold">{c.label}:</b> <span className="text-inkDim">{c.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
