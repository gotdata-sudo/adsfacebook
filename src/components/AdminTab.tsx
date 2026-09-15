"use client";

import { useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_RULES,
  GLOBAL_RULES_FIELDS,
  PROFILE_FIELDS,
  defaultProfile,
  evaluateRow,
  type CheckKey,
  type CpmTier,
  type Rules,
} from "@/lib/rules";
import type { Profile, Upload } from "@/lib/types";
import type { ToastApi } from "@/components/Toast";

const CHECK_LABELS: Record<CheckKey, string> = {
  cpm: "CPM",
  ctr: "CTR",
  freq: "ความถี่",
  cpc: "ต้นทุน/ผลลัพธ์",
  rate: "อัตราผลลัพธ์/คลิก",
  eng: "อัตราการมีส่วนร่วม",
};

function newTierId() {
  return `tier-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

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
  brands,
  rules,
  uploads,
  profiles,
  me,
  onAdminsChange,
  onBrandsChange,
  onRulesChange,
  onUploadsChange,
  onProfilesChange,
  toast,
}: {
  supabase: SupabaseClient;
  admins: string[];
  brands: string[];
  rules: Rules;
  uploads: Upload[];
  profiles: Profile[];
  me: string;
  onAdminsChange: (a: string[]) => void;
  onBrandsChange: (b: string[]) => void;
  onRulesChange: (r: Rules) => void;
  onUploadsChange: (u: Upload[]) => void;
  onProfilesChange: (p: Profile[]) => void;
  toast: ToastApi;
}) {
  const [newAdmin, setNewAdmin] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [rulesDraft, setRulesDraft] = useState<Rules>(rules);
  const [savingRules, setSavingRules] = useState(false);
  const [newOverrideType, setNewOverrideType] = useState("");
  const [uploaderFilter, setUploaderFilter] = useState("__all__");

  const personStats = useMemo(() => {
    type PersonStat = { email: string; name: string; uploads: number; rows: number; good: number; warn: number; bad: number; spend: number };
    const map = new Map<string, PersonStat>();
    uploads.forEach((u) => {
      const s = map.get(u.uploader_email) ?? { email: u.uploader_email, name: u.uploader_name, uploads: 0, rows: 0, good: 0, warn: 0, bad: 0, spend: 0 };
      s.uploads += 1;
      u.rows.forEach((r) => {
        s.rows += 1;
        s.spend += r.amountSpent ?? 0;
        const v = evaluateRow(r, rules).verdict;
        if (v === "good" || v === "warn" || v === "bad") s[v] += 1;
      });
      map.set(u.uploader_email, s);
    });
    return Array.from(map.values()).sort((a, b) => b.rows - a.rows);
  }, [uploads, rules]);

  const filteredUploads = uploaderFilter === "__all__" ? uploads : uploads.filter((u) => u.uploader_email === uploaderFilter);

  function addTier() {
    setRulesDraft((d) => {
      const last = [...d.cpmTiers].sort((a, b) => a.minAgeDays - b.minAgeDays).at(-1);
      const minAgeDays = last ? (last.maxAgeDays ?? last.minAgeDays + 1) : 0;
      return { ...d, cpmTiers: [...d.cpmTiers, { id: newTierId(), minAgeDays, maxAgeDays: null, min: 300, max: 600 }] };
    });
  }
  function updateTier(id: string, patch: Partial<CpmTier>) {
    setRulesDraft((d) => ({ ...d, cpmTiers: d.cpmTiers.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  }
  function removeTier(id: string) {
    setRulesDraft((d) => ({ ...d, cpmTiers: d.cpmTiers.filter((t) => t.id !== id) }));
  }

  function updateWeight(key: CheckKey, kind: "fail" | "warn", value: number) {
    setRulesDraft((d) => ({ ...d, weights: { ...d.weights, [key]: { ...d.weights[key], [kind]: value } } }));
  }

  function addOverride() {
    const type = newOverrideType.trim();
    if (!type || rulesDraft.resultTypeOverrides[type]) return;
    setRulesDraft((d) => ({ ...d, resultTypeOverrides: { ...d.resultTypeOverrides, [type]: defaultProfile(d) } }));
    setNewOverrideType("");
  }
  function removeOverride(type: string) {
    setRulesDraft((d) => {
      const next = { ...d.resultTypeOverrides };
      delete next[type];
      return { ...d, resultTypeOverrides: next };
    });
  }
  function updateOverrideField(type: string, key: string, value: number | null) {
    setRulesDraft((d) => ({
      ...d,
      resultTypeOverrides: { ...d.resultTypeOverrides, [type]: { ...d.resultTypeOverrides[type], [key]: value } },
    }));
  }

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

  async function saveBrands(next: string[]) {
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "brands", value: { names: next } }, { onConflict: "key" });
    if (error) {
      toast(`บันทึกไม่สำเร็จ: ${error.message}`, "err");
      return;
    }
    onBrandsChange(next);
    toast("อัปเดตรายชื่อแบรนด์แล้ว");
  }

  async function addBrand() {
    const b = newBrand.trim();
    if (!b) return;
    if (brands.some((x) => x.toLowerCase() === b.toLowerCase())) {
      toast("มีแบรนด์นี้อยู่แล้ว", "err");
      return;
    }
    await saveBrands([...brands, b]);
    setNewBrand("");
  }

  async function removeBrand(b: string) {
    await saveBrands(brands.filter((x) => x !== b));
  }

  async function setBlocked(email: string, blocked: boolean) {
    const { error } = await supabase.from("profiles").update({ blocked }).eq("email", email);
    if (error) {
      toast(`อัปเดตไม่สำเร็จ: ${error.message}`, "err");
      return;
    }
    onProfilesChange(profiles.map((p) => (p.email === email ? { ...p, blocked } : p)));
    toast(blocked ? "บล็อคผู้ใช้นี้แล้ว" : "ปลดบล็อคแล้ว");
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

      <div className="grid grid-cols-1 gap-4">
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
          <h2 className="text-[17px] font-semibold font-display mb-1">จัดการแบรนด์</h2>
          <p className="text-inkDim text-[13.5px] mb-3">แบรนด์ในรายการนี้จะให้เลือกตอนอัปโหลดข้อมูล (บังคับเลือก 1 แบรนด์เสมอ)</p>
          {brands.length === 0 && <p className="text-inkFaint text-[13px] mb-2">ยังไม่มีแบรนด์ — เพิ่มอย่างน้อย 1 แบรนด์ก่อนให้ทีมอัปโหลดข้อมูลได้</p>}
          <div className="flex flex-col gap-2">
            {brands.map((b) => (
              <div key={b} className="flex items-center gap-2.5 px-3 py-2 bg-surface2 rounded-lg text-[13.5px]">
                <span className="flex-1">{b}</span>
                <button onClick={() => removeBrand(b)} className="text-bad border border-bad/30 rounded-md px-2.5 py-1 text-[12px] font-semibold">
                  ลบ
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <input
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
              placeholder="เพิ่มชื่อแบรนด์"
              className="flex-1 px-3 py-2 rounded-lg border border-lineStrong bg-surface text-sm"
            />
            <button onClick={addBrand} className="rounded-lg bg-accent text-accentInk px-3.5 py-2 text-[13px] font-semibold">
              เพิ่ม
            </button>
          </div>
        </div>

        <div className="bg-surface border border-line rounded-card shadow-sm p-5 flex flex-col gap-5">
          <div>
            <h2 className="text-[17px] font-semibold font-display mb-1">เกณฑ์การวิเคราะห์</h2>
            <p className="text-inkDim text-[13.5px]">ปรับช่วงตัวเลขที่ใช้ตัดสินสถานะแอดเซ็ตได้ตามหมายเหตุของทีม</p>
          </div>

          <div>
            <h3 className="text-[13.5px] font-semibold mb-2">ทั่วไป</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {GLOBAL_RULES_FIELDS.map((f) => (
                <NumberField
                  key={f.key}
                  label={f.label}
                  step={f.step}
                  value={rulesDraft[f.key]}
                  onChange={(v) => setRulesDraft((d) => ({ ...d, [f.key]: v ?? DEFAULT_RULES[f.key] }))}
                />
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-[13.5px] font-semibold mb-1">ช่วง CPM ตามอายุแอด</h3>
            <p className="text-inkFaint text-[12px] mb-2">
              เพิ่มได้หลายช่วง เรียงตามอายุ (วัน) — เว้น &quot;ถึงวัน&quot; ว่างไว้ = ไม่จำกัดช่วงบน
            </p>
            <div className="flex flex-col gap-2">
              {[...rulesDraft.cpmTiers]
                .sort((a, b) => a.minAgeDays - b.minAgeDays)
                .map((t) => (
                  <div key={t.id} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end bg-surface2 border border-line rounded-lg p-2.5">
                    <NumberField label="ตั้งแต่วัน" step="1" value={t.minAgeDays} onChange={(v) => updateTier(t.id, { minAgeDays: v ?? 0 })} />
                    <NumberField label="ถึงวัน (ว่าง=ไม่จำกัด)" step="1" nullable value={t.maxAgeDays} onChange={(v) => updateTier(t.id, { maxAgeDays: v })} />
                    <NumberField label="CPM ต่ำสุด" step="1" value={t.min} onChange={(v) => updateTier(t.id, { min: v ?? 0 })} />
                    <NumberField label="CPM สูงสุด" step="1" value={t.max} onChange={(v) => updateTier(t.id, { max: v ?? 0 })} />
                    <button onClick={() => removeTier(t.id)} className="text-bad border border-bad/30 rounded-md px-2.5 py-2 text-[12px] font-semibold h-fit">
                      ลบช่วง
                    </button>
                  </div>
                ))}
            </div>
            <button onClick={addTier} className="mt-2 rounded-lg border border-lineStrong px-3 py-1.5 text-[12.5px] font-semibold">
              + เพิ่มช่วงอายุ
            </button>
          </div>

          <div>
            <h3 className="text-[13.5px] font-semibold mb-1">เกณฑ์ค่าเริ่มต้น (ใช้เมื่อไม่มีเกณฑ์เฉพาะประเภทผลลัพธ์)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {PROFILE_FIELDS.map((f) => (
                <NumberField
                  key={f.key}
                  label={f.label}
                  step={f.step}
                  nullable={f.nullable}
                  value={rulesDraft[f.key]}
                  onChange={(v) => setRulesDraft((d) => ({ ...d, [f.key]: v ?? (f.nullable ? null : DEFAULT_RULES[f.key]) }))}
                />
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-[13.5px] font-semibold mb-1">น้ำหนักคะแนนต่อเกณฑ์</h3>
            <p className="text-inkFaint text-[12px] mb-2">คะแนนเริ่มที่ 100 แล้วหักตามน้ำหนักของเกณฑ์ที่ไม่ผ่าน/ต้องเฝ้าระวัง</p>
            <div className="overflow-x-auto">
              <table className="border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className="th">เกณฑ์</th>
                    <th className="th">หักเมื่อไม่ผ่าน (fail)</th>
                    <th className="th">หักเมื่อเฝ้าระวัง (warn)</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(CHECK_LABELS) as CheckKey[]).map((key) => (
                    <tr key={key}>
                      <td className="td">{CHECK_LABELS[key]}</td>
                      <td className="td">
                        <input
                          type="number"
                          step="1"
                          value={rulesDraft.weights[key].fail}
                          onChange={(e) => updateWeight(key, "fail", parseFloat(e.target.value) || 0)}
                          className="cell-input font-mono w-20"
                        />
                      </td>
                      <td className="td">
                        <input
                          type="number"
                          step="1"
                          value={rulesDraft.weights[key].warn}
                          onChange={(e) => updateWeight(key, "warn", parseFloat(e.target.value) || 0)}
                          className="cell-input font-mono w-20"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-[13.5px] font-semibold mb-1">เกณฑ์เฉพาะประเภทผลลัพธ์</h3>
            <p className="text-inkFaint text-[12px] mb-2">
              ชื่อประเภทต้องตรงกับค่าในคอลัมน์ &quot;ประเภทผลลัพธ์&quot; ของแถวข้อมูล (เช่น conversions:subscribe_website) เป๊ะๆ
            </p>
            <div className="flex flex-col gap-3">
              {Object.entries(rulesDraft.resultTypeOverrides).map(([type, profile]) => (
                <div key={type} className="border border-line rounded-xl p-3.5 bg-surface2">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="font-mono text-[13px] font-semibold">{type}</span>
                    <button onClick={() => removeOverride(type)} className="text-bad border border-bad/30 rounded-md px-2.5 py-1 text-[12px] font-semibold">
                      ลบเกณฑ์นี้
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PROFILE_FIELDS.map((f) => (
                      <NumberField
                        key={f.key}
                        label={f.label}
                        step={f.step}
                        nullable={f.nullable}
                        value={profile[f.key]}
                        onChange={(v) => updateOverrideField(type, f.key, v ?? (f.nullable ? null : 0))}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <input
                value={newOverrideType}
                onChange={(e) => setNewOverrideType(e.target.value)}
                placeholder="ชื่อประเภทผลลัพธ์ เช่น conversions:subscribe_website"
                className="flex-1 px-3 py-2 rounded-lg border border-lineStrong bg-surface text-sm font-mono"
              />
              <button onClick={addOverride} className="rounded-lg bg-accent text-accentInk px-3.5 py-2 text-[13px] font-semibold">
                + เพิ่มเกณฑ์
              </button>
            </div>
          </div>

          <button
            onClick={saveRules}
            disabled={savingRules}
            className="rounded-lg bg-accent text-accentInk px-3.5 py-2 text-[13px] font-semibold disabled:opacity-60 w-fit"
          >
            {savingRules ? "กำลังบันทึก…" : "บันทึกเกณฑ์"}
          </button>
        </div>
      </div>

      <div className="bg-surface border border-line rounded-card shadow-sm p-5">
        <h2 className="text-[17px] font-semibold font-display mb-1">ผู้ใช้งานทั้งหมด</h2>
        <p className="text-inkDim text-[13.5px] mb-3">ทุกคนที่เคยลงชื่อเข้าใช้ระบบนี้ — บล็อคได้ถ้าไม่ต้องการให้เข้าใช้งานอีก</p>
        {profiles.length === 0 ? (
          <p className="text-inkFaint text-[13px]">ยังไม่มีข้อมูล</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="border-collapse w-full text-[13px]">
              <thead>
                <tr>
                  <th className="th">ชื่อ</th>
                  <th className="th">อีเมล</th>
                  <th className="th">เข้าใช้ครั้งแรก</th>
                  <th className="th">เข้าใช้ล่าสุด</th>
                  <th className="th">สถานะ</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.email} className="hover:bg-surface2">
                    <td className="td">{p.name || "—"}</td>
                    <td className="td font-mono">
                      {p.email} {p.email === me && <span className="text-[10.5px] bg-accentDim text-accent px-1.5 py-0.5 rounded-full font-bold ml-1">คุณ</span>}
                    </td>
                    <td className="td text-inkFaint">{fmtDate(p.first_seen)}</td>
                    <td className="td text-inkFaint">{fmtDate(p.last_seen)}</td>
                    <td className="td">
                      {p.blocked ? <span className="text-bad font-semibold">ถูกบล็อค</span> : <span className="text-good font-semibold">ปกติ</span>}
                    </td>
                    <td className="td">
                      <button
                        onClick={() => setBlocked(p.email, !p.blocked)}
                        disabled={p.email === me}
                        className={`rounded-md px-2.5 py-1 text-[12px] font-semibold border disabled:opacity-40 ${
                          p.blocked ? "text-good border-good/30" : "text-bad border-bad/30"
                        }`}
                      >
                        {p.blocked ? "ปลดบล็อค" : "บล็อค"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-surface border border-line rounded-card shadow-sm p-5">
        <h2 className="text-[17px] font-semibold font-display mb-1">สถิติรายคน</h2>
        <p className="text-inkDim text-[13.5px] mb-3">ภาพรวมผลงานของแต่ละคนที่เคยอัปโหลดข้อมูล</p>
        {personStats.length === 0 ? (
          <p className="text-inkFaint text-[13px]">ยังไม่มีข้อมูล</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="border-collapse w-full text-[13px]">
              <thead>
                <tr>
                  <th className="th">คน</th>
                  <th className="th">ชุดข้อมูล</th>
                  <th className="th">แอดเซ็ตทั้งหมด</th>
                  <th className="th">ยอดใช้จ่ายรวม</th>
                  <th className="th text-good">เปิดต่อ</th>
                  <th className="th text-warn">เฝ้าระวัง</th>
                  <th className="th text-bad">ควรปิด</th>
                </tr>
              </thead>
              <tbody>
                {personStats.map((s) => (
                  <tr key={s.email} className="hover:bg-surface2 cursor-pointer" onClick={() => setUploaderFilter(s.email)}>
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

      <div className="bg-surface border border-line rounded-card shadow-sm p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="text-[17px] font-semibold font-display m-0">จัดการชุดข้อมูล</h2>
          <select
            value={uploaderFilter}
            onChange={(e) => setUploaderFilter(e.target.value)}
            className="px-2.5 py-2 rounded-lg border border-lineStrong bg-surface text-[13px]"
          >
            <option value="__all__">ทุกคน</option>
            {personStats.map((s) => (
              <option key={s.email} value={s.email}>
                {s.name} ({s.email})
              </option>
            ))}
          </select>
        </div>
        {filteredUploads.length === 0 ? (
          <p className="text-inkFaint text-[13px]">ยังไม่มีชุดข้อมูล</p>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredUploads.map((u) => (
              <div key={u.id} className="flex items-center gap-3.5 p-3.5 border border-line rounded-xl bg-surface">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[13.5px]">
                    {u.uploader_name} <span className="text-inkFaint text-[12px] font-normal">· {fmtDate(u.created_at)}</span>
                  </div>
                  <div className="text-[12px] text-inkFaint mt-0.5">
                    {u.rows.length} แอดเซ็ต · {u.uploader_email}
                    {u.note && ` · ${u.note}`}
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

function NumberField({
  label,
  step,
  value,
  nullable,
  onChange,
}: {
  label: string;
  step: string;
  value: number | null;
  nullable?: boolean;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <label className="block text-[12.5px] font-semibold text-inkDim mb-1">{label}</label>
      <input
        type="number"
        step={step}
        value={value ?? ""}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val === "" ? (nullable ? null : 0) : parseFloat(val));
        }}
        className="w-full px-3 py-2 rounded-lg border border-lineStrong bg-surface text-sm font-mono"
      />
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
