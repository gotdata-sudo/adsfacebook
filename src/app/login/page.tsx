"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [loading, setLoading] = useState(false);
  const params = useSearchParams();
  const domainError = params.get("error") === "domain";

  async function signIn() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { hd: "bananaandco.org" },
      },
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10 bg-bg">
      <div className="w-full max-w-[400px] bg-surface border border-line rounded-card shadow-sm p-8">
        <div className="w-11 h-11 rounded-xl bg-accent text-accentInk flex items-center justify-center mb-4">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M4 19c4-1 5-5 8-11m0 0-3 1m3-1 1 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="19" cy="6" r="2" fill="currentColor" />
          </svg>
        </div>
        <h1 className="font-display text-[22px] font-semibold mb-1">เข้าสู่ระบบ</h1>
        <p className="text-inkDim text-sm mb-6">
          ลงชื่อเข้าใช้ด้วยบัญชี Google ของทีม (@bananaandco.org) เพื่อเริ่มใช้งานเส้นทางโฆษณา
        </p>

        {domainError && (
          <div className="mb-4 text-sm rounded-lg border border-bad px-3 py-2 bg-badBg text-bad">
            บัญชีนี้ไม่ได้รับอนุญาต — ใช้ได้เฉพาะอีเมล @bananaandco.org เท่านั้น
          </div>
        )}

        <button
          onClick={signIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 rounded-lg border border-lineStrong bg-surface hover:bg-surface2 disabled:opacity-60 px-4 py-3 font-medium text-sm transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.85.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.16.28-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03l2.97-2.33z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
          </svg>
          {loading ? "กำลังเปิด Google…" : "เข้าสู่ระบบด้วย Google"}
        </button>

        <div className="mt-5 pt-4 border-t border-dashed border-line text-xs text-inkFaint leading-relaxed">
          ระบบนี้ใช้ Supabase Auth ยืนยันตัวตนผ่าน Google OAuth จริง จำกัดให้เข้าใช้ได้เฉพาะอีเมล
          @bananaandco.org เท่านั้น
        </div>
      </div>
    </div>
  );
}
