"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_RULES, type Rules } from "@/lib/rules";
import type { Profile, Upload } from "@/lib/types";
import UploadTab from "@/components/UploadTab";
import RankingTab from "@/components/RankingTab";
import HistoryTab from "@/components/HistoryTab";
import DashboardTab from "@/components/DashboardTab";
import AdminTab from "@/components/AdminTab";
import { useToast, ToastHost } from "@/components/Toast";

type Tab = "upload" | "ranking" | "history" | "dashboard" | "admin";

export default function AppShell({
  user,
  initialAdmins,
  initialBrands,
  initialRules,
  initialUploads,
  initialProfiles,
  isAdmin,
}: {
  user: { email: string; name: string };
  initialAdmins: string[];
  initialBrands: string[];
  initialRules: Rules;
  initialUploads: Upload[];
  initialProfiles: Profile[];
  isAdmin: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<Tab>("upload");
  const [rankingScope, setRankingScope] = useState<string>("__all__");
  const [admins, setAdmins] = useState<string[]>(initialAdmins);
  const [brands, setBrands] = useState<string[]>(initialBrands);
  const [rules, setRules] = useState<Rules>(initialRules);
  const [uploads, setUploads] = useState<Upload[]>(initialUploads);
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const amAdmin = admins.includes(user.email.toLowerCase()) || isAdmin;
  const toast = useToast();

  const refreshUploads = useCallback(async () => {
    const { data, error } = await supabase
      .from("uploads")
      .select("id, uploader_email, uploader_name, created_at, note, brand, rows, asset_paths")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error && data) setUploads(data as unknown as Upload[]);
  }, [supabase]);

  const refreshSettings = useCallback(async () => {
    const [{ data: adminsRow }, { data: brandsRow }, { data: rulesRow }] = await Promise.all([
      supabase.from("app_settings").select("value").eq("key", "admins").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "brands").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "rules").maybeSingle(),
    ]);
    if (adminsRow?.value) {
      const emails = ((adminsRow.value as { emails?: string[] }).emails ?? []).map((e) => e.toLowerCase());
      if (emails.length) setAdmins(emails);
    }
    if (brandsRow?.value) setBrands((brandsRow.value as { names?: string[] }).names ?? []);
    if (rulesRow?.value) setRules({ ...DEFAULT_RULES, ...(rulesRow.value as Partial<Rules>) });
  }, [supabase]);

  const refreshProfiles = useCallback(async () => {
    if (!amAdmin) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("email, name, first_seen, last_seen, blocked")
      .order("last_seen", { ascending: false });
    if (!error && data) setProfiles(data as Profile[]);
  }, [supabase, amAdmin]);

  useEffect(() => {
    if (amAdmin) refreshProfiles();
  }, [amAdmin, refreshProfiles]);

  useEffect(() => {
    const channel = supabase
      .channel("ad-route-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "uploads" }, () => {
        refreshUploads();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, () => {
        refreshSettings();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        refreshProfiles();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, refreshUploads, refreshSettings, refreshProfiles]);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function openBatchInRanking(uploadId: string) {
    setRankingScope(uploadId);
    setTab("ranking");
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "upload", label: "อัปโหลด & วิเคราะห์" },
    { key: "ranking", label: "เส้นทางที่ดีที่สุด" },
    { key: "history", label: "ประวัติ" },
    { key: "dashboard", label: "แดชบอร์ด" },
    ...(amAdmin ? ([{ key: "admin", label: "ผู้ดูแลระบบ" }] as { key: Tab; label: string }[]) : []),
  ];

  function initials(name: string) {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
  }

  return (
    <div>
      <header className="sticky top-0 z-20 backdrop-blur bg-bg/90 border-b border-line">
        <div className="max-w-[1180px] mx-auto flex items-center gap-4 py-3 px-5 flex-wrap">
          <div className="flex items-center gap-2 font-display font-semibold text-[17px] mr-auto">
            <span className="w-[30px] h-[30px] rounded-[9px] bg-accent text-accentInk flex items-center justify-center flex-none">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M4 19c4-1 5-5 8-11m0 0-3 1m3-1 1 3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="19" cy="6" r="2" fill="currentColor" />
              </svg>
            </span>
            เส้นทางโฆษณา
          </div>
          <nav className="flex gap-1 flex-wrap">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-2 border-b-2 text-[13.5px] font-semibold whitespace-nowrap transition-colors ${
                  tab === t.key ? "border-accent text-ink" : "border-transparent text-inkFaint hover:text-inkDim"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <div className="w-[30px] h-[30px] rounded-full bg-accentDim text-accent border border-accent/30 flex items-center justify-center font-display font-bold text-[12.5px] flex-none">
              {initials(user.name)}
            </div>
            <div className="text-[12.5px] leading-tight">
              <div className="font-semibold">{user.name}</div>
              <div className="text-inkFaint">{user.email}</div>
            </div>
            <button onClick={signOut} className="text-[13px] font-semibold border border-lineStrong rounded-lg px-2.5 py-1.5 ml-1">
              ออก
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1180px] mx-auto px-5 py-7">
        {tab === "upload" && (
          <UploadTab user={user} rules={rules} brands={brands} supabase={supabase} onSaved={refreshUploads} toast={toast} />
        )}
        {tab === "ranking" && (
          <RankingTab uploads={uploads} rules={rules} scope={rankingScope} setScope={setRankingScope} isAdmin={amAdmin} />
        )}
        {tab === "history" && <HistoryTab uploads={uploads} rules={rules} me={user.email} onOpen={openBatchInRanking} />}
        {tab === "dashboard" && <DashboardTab uploads={uploads} rules={rules} />}
        {tab === "admin" && amAdmin && (
          <AdminTab
            supabase={supabase}
            admins={admins}
            brands={brands}
            rules={rules}
            uploads={uploads}
            profiles={profiles}
            me={user.email}
            onAdminsChange={setAdmins}
            onBrandsChange={setBrands}
            onRulesChange={setRules}
            onUploadsChange={setUploads}
            onProfilesChange={setProfiles}
            toast={toast}
          />
        )}
      </main>
      <ToastHost toast={toast} />
    </div>
  );
}
