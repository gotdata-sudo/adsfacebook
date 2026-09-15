"use client";

import { useMemo, useState } from "react";
import { evaluateRow, type Rules } from "@/lib/rules";
import type { Upload } from "@/lib/types";

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

export default function HistoryTab({
  uploads,
  rules,
  me,
  onOpen,
}: {
  uploads: Upload[];
  rules: Rules;
  me: string;
  onOpen: (uploadId: string) => void;
}) {
  const [filter, setFilter] = useState<"all" | "mine">("all");
  const list = useMemo(
    () => uploads.filter((u) => filter === "all" || u.uploader_email === me),
    [uploads, filter, me]
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-display text-[19px] font-semibold m-0">ประวัติการอัปโหลด</h1>
        <div className="flex bg-surface2 rounded-[9px] p-[3px] gap-0.5">
          {(["all", "mine"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold ${filter === f ? "bg-surface text-ink shadow-sm" : "text-inkDim"}`}
            >
              {f === "all" ? "ทั้งหมด" : "ของฉัน"}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="bg-surface border border-line rounded-card p-12 text-center text-inkFaint">
          <h3 className="text-inkDim text-[15px] mb-1">ยังไม่มีประวัติ</h3>
          <p className="text-[13px]">เมื่อบันทึกชุดข้อมูลแล้วจะแสดงที่นี่</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {list.map((u) => {
            const counts = { good: 0, warn: 0, bad: 0 };
            u.rows.forEach((r) => {
              const v = evaluateRow(r, rules).verdict;
              if (v === "good" || v === "warn" || v === "bad") counts[v]++;
            });
            return (
              <div
                key={u.id}
                onClick={() => onOpen(u.id)}
                className="flex items-center gap-3.5 p-3.5 border border-line rounded-xl bg-surface cursor-pointer hover:border-accent/40"
              >
                <div className="w-[52px] h-[52px] rounded-[9px] bg-surface2 flex items-center justify-center text-inkFaint flex-none">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M4 16V4m0 0h16m-16 0 5 6 3-3 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[13.5px] flex gap-2 items-center">
                    {u.uploader_name}
                    <span className="text-inkFaint text-[12px] font-normal">· {fmtDate(u.created_at)}</span>
                  </div>
                  <div className="text-[12px] text-inkFaint mt-0.5">
                    {u.rows.length} แอดเซ็ต · {u.uploader_email}
                    {u.note ? ` · ${u.note}` : ""}
                  </div>
                </div>
                <div className="flex gap-1.5 flex-none">
                  {counts.good > 0 && <span className="font-mono text-[12px] px-2 py-0.5 rounded-full font-semibold bg-goodBg text-good">{counts.good}</span>}
                  {counts.warn > 0 && <span className="font-mono text-[12px] px-2 py-0.5 rounded-full font-semibold bg-warnBg text-warn">{counts.warn}</span>}
                  {counts.bad > 0 && <span className="font-mono text-[12px] px-2 py-0.5 rounded-full font-semibold bg-badBg text-bad">{counts.bad}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
