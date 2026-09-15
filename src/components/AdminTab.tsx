"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_RULES, RULES_FIELDS, evaluateRow, type Rules } from "@/lib/rules";
import type { Upload } from "@/lib/types";
import type { ToastApi } from "@/components/Toast";

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

function validEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function AdminTab({
  supabase,
  admins,
  rules,
  uploads,
  me,
  onAdminsChange,
  onRulesChange,
  onUploadsChange,
  toast,
}: {
  supabase: SupabaseClient;
  admins: string[];
  rules: Rules;
  uploads: Upload[];
  me: string;
  onAdminsChange: (a: string[]) => void;
  onRulesChange: (r: Rules) => void;
  onUploadsChange: (u: Upload[]) => void;
  toast: ToastApi;
}) {
  const [newAdmin, setNewAdmin] = useState("");
  const [rulesDraft, setRulesDraft] = useState<Rules>(rules);
  const [savingRules, setSavingRules] = useState(false);

  let totalRows = 0;
  const counts = { good: 0, warn: 0, bad: 0 };
  uploads.forEach((u) =>
    u.rows.forEach((r) => {
      totalRows++;
      const v = evaluateRow(r, rules).verdict;
      if (v === "good" || v === "warn" || v === "bad") counts[v]++;
    })
  );

  async function saveAdmins(next: string[]) {
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "admins", value: { emails: next } }, { onConflict: "key" });
    if (error) {
      toast(`บันทึกไม่สำเร็จ: ${error.message}`, "err");
      return;
    }
    onAdminsChange(next);
    toast("อัปเดตรายชื่อแอดมินแล้ว");
  }

  async function addAdmin() {
    const em = newAdmin.trim().toLowerCase();
    if (!validEmail(em)) {
      toast("อีเมลไม่ถูกต้อง", "err");
      return;
    }
    if (admins.includes(em)) {
      toast("มีอยู่ในรายชื่อแล้ว", "err");
      return;
    }
    await saveAdmins([...admins, em]);
    setNewAdmin("");
  }

  async function removeAdmin(em: string) {
    if (admins.length <= 1) return;
    await saveAdmins(admins.filter((e) => e !== em));
  }

  async function saveRules() {
    setSavingRules(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "rules", value: rulesDraft }, { onConflict: "key" });
    setSavingRules(false);
    if (error) {
      toast(`บันทึกไม่สำเร็จ: ${error.message}`, "err");
      return;
    }
    onRulesChange(rulesDraft);
    toast("บันทึกเกณฑ์แล้ว · มีผลกับทุกคนทันที");
  }

  async function deleteBatch(id: string) {
    const { error } = await supabase.from("uploads").delete().eq("id", id);
    if (error) {
      toast(`ลบไม่สำเร็จ: ${error.message}`, "err");
      return;
    }
    onUploadsChange(uploads.filter((u) => u.id !== id));
    toast("ลบชุดข้อมูลแล้ว");
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-[19px] font-semibold m-0">ผู้ดูแลระบบ</h1>

      <div className="bg-surface border border-line rounded-card shadow-sm p-5">
        <h2 className="text-[17px] font-semibold font-display mb-3">ภาพรวมทั้งองค์กร</h2>
        <div className="flex gap-3 flex-wrap">
          <Stat label="ชุดข้อมูลทั้งหมด" value={uploads.length} />
          <Stat label="แอดเซ็ตที่วิเคราะห์แล้ว" value={totalRows} />
          <Stat label="พร้อมเปิดต่อ" value={counts.good} colorClass="text-good" />
          <Stat label="ควรปิด" value={counts.bad} colorClass="text-bad" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface border border-line rounded-card shadow-sm p-5">
          <h2 className="text-[17px] font-semibold font-display mb-1">รายชื่อแอดมิน</h2>
          <p className="text-inkDim text-[13.5px] mb-3">อีเมลในรายการนี้จะมองเห็นแท็บ &quot;ผู้ดูแลระบบ&quot;</p>
          <div className="flex flex-col gap-2">
            {admins.map((em) => (
              <div key={em} className="flex items-center gap-2.5 px-3 py-2 bg-surface2 rounded-lg text-[13.5px]">
                <span className="flex-1 font-mono">{em}</span>
                {em === me && <span className="text-[10.5px] bg-accentDim text-accent px-1.5 py-0.5 rounded-full font-bold">คุณ</span>}
                <button
                  onClick={() => removeAdmin(em)}
                  disabled={admins.length <= 1}
                  className="text-bad border border-bad/30 rounded-md px-2.5 py-1 text-[12px] font-semibold disabled:opacity-40"
                >
                  ลบ
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <input
              value={newAdmin}
              onChange={(e) => setNewAdmin(e.target.value)}
              placeholder="เพิ่มอีเมลแอดมิน"
              className="flex-1 px-3 py-2 rounded-lg border border-lineStrong bg-surface text-sm"
            />
            <button onClick={addAdmin} className="rounded-lg bg-accent text-accentInk px-3.5 py-2 text-[13px] font-semibold">
              เพิ่ม
            </button>
          </div>
        </div>

        <div className="bg-surface border border-line rounded-card shadow-sm p-5">
          <h2 className="text-[17px] font-semibold font-display mb-1">เกณฑ์การวิเคราะห์</h2>
          <p className="text-inkDim text-[13.5px] mb-3">ปรับช่วงตัวเลขที่ใช้ตัดสินสถานะแอดเซ็ตได้ตามหมายเหตุของทีม</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {RULES_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="block text-[12.5px] font-semibold text-inkDim mb-1">{f.label}</label>
                <input
                  type="number"
                  step={f.step}
                  value={rulesDraft[f.key] ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRulesDraft((d) => ({
                      ...d,
                      [f.key]: val === "" ? (f.nullable ? null : DEFAULT_RULES[f.key]) : parseFloat(val),
                    }));
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-lineStrong bg-surface text-sm font-mono"
                />
              </div>
            ))}
          </div>
          <button
            onClick={saveRules}
            disabled={savingRules}
            className="mt-4 rounded-lg bg-accent text-accentInk px-3.5 py-2 text-[13px] font-semibold disabled:opacity-60"
          >
            {savingRules ? "กำลังบันทึก…" : "บันทึกเกณฑ์"}
          </button>
        </div>
      </div>

      <div className="bg-surface border border-line rounded-card shadow-sm p-5">
        <h2 className="text-[17px] font-semibold font-display mb-3">จัดการชุดข้อมูล</h2>
        {uploads.length === 0 ? (
          <p className="text-inkFaint text-[13px]">ยังไม่มีชุดข้อมูล</p>
        ) : (
          <div className="flex flex-col gap-2">
            {uploads.map((u) => (
              <div key={u.id} className="flex items-center gap-3.5 p-3.5 border border-line rounded-xl bg-surface">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[13.5px]">
                    {u.uploader_name} <span className="text-inkFaint text-[12px] font-normal">· {fmtDate(u.created_at)}</span>
                  </div>
                  <div className="text-[12px] text-inkFaint mt-0.5">
                    {u.rows.length} แอดเซ็ต · {u.uploader_email}
                  </div>
                </div>
                <button onClick={() => deleteBatch(u.id)} className="text-bad border border-bad/30 rounded-md px-3 py-1.5 text-[12.5px] font-semibold">
                  ลบชุดนี้
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, colorClass }: { label: string; value: number; colorClass?: string }) {
  return (
    <div className="flex-1 min-w-[140px] bg-surface2 border border-line rounded-xl px-4 py-3.5">
      <div className="text-[11.5px] uppercase tracking-wide text-inkFaint font-display">{label}</div>
      <div className={`font-mono text-[22px] font-semibold mt-1 ${colorClass ?? ""}`}>{value}</div>
    </div>
  );
}
