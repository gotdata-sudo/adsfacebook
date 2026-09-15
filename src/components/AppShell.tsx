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

function UploadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 16V4m0 0 4 4m-4-4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function RouteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 19c4-1 5-5 8-11m0 0-3 1m3-1 1 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="19" cy="6" r="2" fill="currentColor" />
    </svg>
  );
}
function HistoryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function AdminIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 10-4-2.5-7-5.5-7-10V6l7-3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

const ICONS: Record<Tab, () => React.ReactElement> = {
  upload: UploadIcon,
  ranking: RouteIcon,
  history: HistoryIcon,
  dashboard: DashboardIcon,
  admin: AdminIcon,
};

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

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "upload", label: "อัปโหลด & วิเคราะห์" },
    { key: "ranking", label: "เส้นทางที่ดีที่สุด" },
    { key: "history", label: "ประวัติ", badge: uploads.length || undefined },
    { key: "dashboard", label: "แดชบอร์ด" },
    ...(amAdmin ? ([{ key: "admin", label: "ผู้ดูแลระบบ" }] as { key: Tab; label: string }[]) : []),
  ];

  function initials(name: string) {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
  }

  return (
    <div className="min-h-screen flex bg-bg">
      <aside className="w-[240px] flex-none bg-sidebarBg text-sidebarInk flex flex-col p-4 gap-6">
        <div className="flex items-center gap-2 font-display font-semibold text-[16px] px-1.5 pt-1">
          <span className="w-8 h-8 rounded-xl bg-accent text-accentInk flex items-center justify-center flex-none">
            <RouteIcon />
          </span>
          เส้นทางโฆษณา
        </div>

        <nav className="flex flex-col gap-1">
          {tabs.map((t) => {
            const Icon = ICONS[t.key];
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-full text-[13.5px] font-semibold whitespace-nowrap transition-colors ${
                  active ? "bg-sidebarActiveBg text-sidebarActiveInk" : "text-sidebarInkDim hover:bg-sidebarSurface2"
                }`}
              >
                <Icon />
                <span className="flex-1 text-left truncate">{t.label}</span>
                {!!t.badge && (
                  <span className="text-[11px] font-bold bg-accent text-accentInk rounded-full w-5 h-5 flex items-center justify-center flex-none">
                    {t.badge > 99 ? "99+" : t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-2xl bg-sidebarSurface2">
            <div className="w-8 h-8 rounded-full bg-accent text-accentInk flex items-center justify-center font-display font-bold text-[12px] flex-none">
              {initials(user.name)}
            </div>
            <div className="text-[12px] leading-tight min-w-0">
              <div className="font-semibold truncate">{user.name}</div>
              <div className="text-sidebarInkDim truncate">{user.email}</div>
            </div>
          </div>
          <button
            onClick={signOut}
            className="text-[13px] font-semibold border border-white/10 rounded-full px-3.5 py-2 text-sidebarInkDim hover:text-sidebarInk hover:bg-sidebarSurface2"
          >
            ออกจากระบบ
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 px-6 py-7 lg:px-10 lg:py-8">
        <div className="max-w-[1180px] mx-auto">
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
        </div>
      </main>
      <ToastHost toast={toast} />
    </div>
  );
}
