"use client";

import { useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { blankRow, evaluateRow, ROW_FIELDS, type AdRow, type Rules } from "@/lib/rules";
import { parseFacebookAdsCsv } from "@/lib/csv";
import { VerdictPill } from "@/components/Pill";
import PickBanner from "@/components/PickBanner";
import type { ToastApi } from "@/components/Toast";

const NUM_COLS: { field: keyof AdRow; label: string; ph: string }[] = [
  { field: "amountSpent", label: "ใช้จ่าย (฿)", ph: "0" },
  { field: "impressions", label: "อิมเพรสชัน", ph: "0" },
  { field: "cpm", label: "CPM", ph: "auto" },
  { field: "ctrAll", label: "CTR %", ph: "0.00" },
  { field: "linkClicks", label: "คลิกลิงก์", ph: "0" },
  { field: "cpc", label: "CPC", ph: "auto" },
  { field: "frequency", label: "ความถี่", ph: "0.00" },
  { field: "results", label: "ผลลัพธ์", ph: "0" },
  { field: "costPerResult", label: "ต้นทุน/ผลลัพธ์", ph: "auto" },
  { field: "engagementRate", label: "Engagement %", ph: "—" },
  { field: "adAgeDays", label: "อายุแอด(วัน)", ph: "1" },
  { field: "bidAdjustmentRound", label: "รอบขยับราคา", ph: "0" },
];

let idCounter = 0;
function newId() {
  idCounter += 1;
  return `r${Date.now().toString(36)}${idCounter}`;
}

export default function UploadTab({
  user,
  rules,
  brands,
  supabase,
  onSaved,
  toast,
}: {
  user: { email: string; name: string };
  rules: Rules;
  brands: string[];
  supabase: SupabaseClient;
  onSaved: () => void;
  toast: ToastApi;
}) {
  const [rows, setRows] = useState<AdRow[]>([]);
  const [note, setNote] = useState("");
  const [brand, setBrand] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addBlank() {
    setRows((r) => [...r, blankRow(newId())]);
  }

  async function handleCsvFile(file: File) {
    const text = await file.text();
    const { rows: parsed, missingColumns } = parseFacebookAdsCsv(text, newId);
    if (missingColumns.length) {
      toast(`ไฟล์ CSV ขาดคอลัมน์ที่จำเป็น: ${missingColumns.join(", ")}`, "err");
      return;
    }
    if (!parsed.length) {
      toast("ไม่พบข้อมูลแอดเซ็ตในไฟล์ CSV", "err");
      return;
    }
    setRows((r) => [...r, ...parsed]);
    toast(`นำเข้า ${parsed.length} แอดเซ็ตจาก CSV เรียบร้อย — ตรวจสอบข้อมูลก่อนบันทึก`);
  }

  function onCsvInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    handleCsvFile(file).catch(() => toast("อ่านไฟล์ CSV ไม่สำเร็จ", "err"));
  }
  function removeRow(id: string) {
    setRows((r) => r.filter((x) => x.id !== id));
  }
  function updateField(id: string, field: keyof AdRow, raw: string) {
    setRows((r) =>
      r.map((row) => {
        if (row.id !== id) return row;
        const isText = field === "adsetName" || field === "campaignName" || field === "resultType";
        const value = isText ? raw : raw === "" ? null : parseFloat(raw);
        return { ...row, [field]: value as never };
      })
    );
  }

  async function save() {
    if (!brand) {
      toast("กรุณาเลือกแบรนด์ก่อนบันทึก", "err");
      return;
    }
    const named = rows.filter((r) => r.adsetName && r.adsetName.trim() !== "");
    const ready = named.filter((r) => (r.amountSpent ?? 0) > 0 && (r.impressions ?? 0) > 0);
    if (!ready.length) {
      toast("กรุณาใส่ชื่อแอดเซ็ต ยอดใช้จ่าย และอิมเพรสชัน อย่างน้อย 1 แถว", "err");
      return;
    }
    if (ready.length < named.length) {
      toast(`ข้าม ${named.length - ready.length} แถวที่ยังไม่มียอดใช้จ่าย/อิมเพรสชัน`);
    }
    setSaving(true);
    const cleanRows = ready.map((r) => {
      const o: Partial<AdRow> = { id: r.id };
      ROW_FIELDS.forEach((f) => {
        (o as Record<string, unknown>)[f] = r[f] ?? null;
      });
      return o as AdRow;
    });
    const { error } = await supabase.from("uploads").insert({
      uploader_email: user.email,
      uploader_name: user.name,
      note: note.trim() || null,
      brand,
      rows: cleanRows,
      asset_paths: [],
    });
    setSaving(false);
    if (error) {
      toast(`บันทึกไม่สำเร็จ: ${error.message}`, "err");
      return;
    }
    toast(`บันทึกชุดข้อมูล ${cleanRows.length} แถวเรียบร้อย`);
    setRows([]);
    setNote("");
    onSaved();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-surface border border-line rounded-card shadow-sm p-5">
        <h2 className="text-[17px] font-semibold font-display mb-1">กรอกผลลัพธ์แอดเซ็ต</h2>
        <p className="text-inkDim text-[13.5px] mb-4">
          กรอกตัวเลขจาก Ads Manager ด้วยตนเอง (ระบบเวอร์ชันนี้ยังไม่มีการอ่านภาพอัตโนมัติ) — ช่อง
          &quot;อายุแอด&quot; และ &quot;รอบขยับราคา&quot; ใช้ประกอบการตัดสินสถานะ ส่วน &quot;ประเภทผลลัพธ์&quot; (เช่น
          conversions:subscribe_website) ใช้เลือกเกณฑ์เฉพาะประเภทที่ตั้งไว้ในหน้าผู้ดูแลระบบ ถ้าไม่กรอกจะใช้เกณฑ์ค่าเริ่มต้น
        </p>
        <div className="mb-4 flex flex-col sm:flex-row gap-4">
          <div>
            <label className="block text-[13px] font-semibold text-inkDim mb-1.5">
              แบรนด์ <span className="text-bad">*</span>
            </label>
            {brands.length === 0 ? (
              <p className="text-bad text-[12.5px] max-w-xs">
                ยังไม่มีแบรนด์ให้เลือก — ให้แอดมินเพิ่มแบรนด์ในหน้าผู้ดูแลระบบก่อน
              </p>
            ) : (
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="px-3 py-2.5 rounded-lg border border-lineStrong bg-surface text-sm min-w-[200px]"
              >
                <option value="">เลือกแบรนด์…</option>
                {brands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex-1">
            <label className="block text-[13px] font-semibold text-inkDim mb-1.5">หมายเหตุชุดข้อมูล (ไม่บังคับ)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น แคมเปญเปิดตัว Q4 / บัญชีโฆษณา A"
              className="w-full sm:max-w-md px-3 py-2.5 rounded-lg border border-lineStrong bg-surface text-sm"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button onClick={addBlank} className="rounded-lg border border-lineStrong px-4 py-2.5 text-sm font-semibold">
            + เพิ่มแถวแอดเซ็ต
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-lineStrong px-4 py-2.5 text-sm font-semibold"
          >
            อัปโหลดไฟล์ CSV (Ads Manager)
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={onCsvInputChange} className="hidden" />
        </div>
      </div>

      {rows.length > 0 && (
        <div className="bg-surface border border-line rounded-card shadow-sm p-5">
          <h2 className="text-[17px] font-semibold font-display mb-1">ตรวจสอบข้อมูล &amp; ดูผลวิเคราะห์</h2>
          <p className="text-inkDim text-[13.5px] mb-4">แก้ไขตัวเลขได้โดยตรง สถานะจะคำนวณสดทันทีที่พิมพ์</p>
          <div className="overflow-x-auto border border-line rounded-xl">
            <table className="border-collapse w-full min-w-[1120px] text-[13px]">
              <thead>
                <tr>
                  <th className="th"></th>
                  <th className="th">ชื่อแอดเซ็ต</th>
                  <th className="th">แคมเปญ</th>
                  <th className="th">ประเภทผลลัพธ์</th>
                  {NUM_COLS.map((c) => (
                    <th key={c.field} className="th">
                      {c.label}
                    </th>
                  ))}
                  <th className="th">อิมเพรสชัน/฿</th>
                  <th className="th">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const v = evaluateRow(row, rules);
                  return (
                    <tr key={row.id} className="hover:bg-surface2">
                      <td className="td text-center">
                        <button onClick={() => removeRow(row.id)} className="text-inkFaint hover:text-bad text-base leading-none" aria-label="ลบแถว">
                          ×
                        </button>
                      </td>
                      <td className="td">
                        <input
                          value={row.adsetName}
                          onChange={(e) => updateField(row.id, "adsetName", e.target.value)}
                          placeholder="ชื่อแอดเซ็ต"
                          className="cell-input font-body min-w-[120px]"
                        />
                      </td>
                      <td className="td">
                        <input
                          value={row.campaignName ?? ""}
                          onChange={(e) => updateField(row.id, "campaignName", e.target.value)}
                          placeholder="—"
                          className="cell-input font-body min-w-[100px]"
                        />
                      </td>
                      <td className="td">
                        <input
                          value={row.resultType ?? ""}
                          onChange={(e) => updateField(row.id, "resultType", e.target.value)}
                          placeholder="เช่น conversions:subscribe_website"
                          className="cell-input font-mono min-w-[140px]"
                        />
                      </td>
                      {NUM_COLS.map((c) => (
                        <td key={c.field} className="td">
                          <input
                            type="number"
                            step="any"
                            value={(row[c.field] as number | null) ?? ""}
                            onChange={(e) => updateField(row.id, c.field, e.target.value)}
                            placeholder={c.ph}
                            className="cell-input font-mono min-w-[64px]"
                          />
                        </td>
                      ))}
                      <td className="td font-mono text-inkDim">{v.impPerBaht === null ? "—" : v.impPerBaht.toLocaleString("th-TH", { maximumFractionDigits: 2 })}</td>
                      <td className="td">
                        <VerdictPill v={v} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <PickBanner rows={rows} rules={rules} />
          </div>

          <div className="mt-4 flex gap-2.5">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-accent text-accentInk px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {saving ? "กำลังบันทึก…" : "บันทึกชุดนี้เข้าระบบ"}
            </button>
            <button onClick={() => setRows([])} className="rounded-lg border border-lineStrong px-4 py-2.5 text-sm font-semibold">
              ล้างข้อมูล
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
