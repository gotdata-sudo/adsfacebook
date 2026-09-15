import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import { DEFAULT_RULES, type Rules } from "@/lib/rules";
import type { Upload } from "@/lib/types";

const DEFAULT_ADMIN_EMAIL = "got.data@bananaandco.org";

export default async function Home() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already guards this, but keep the page safe if hit directly.
  if (!user) redirect("/login");

  const [{ data: adminsRow }, { data: rulesRow }, { data: uploads }] = await Promise.all([
    supabase.from("app_settings").select("value").eq("key", "admins").maybeSingle(),
    supabase.from("app_settings").select("value").eq("key", "rules").maybeSingle(),
    supabase
      .from("uploads")
      .select("id, uploader_email, uploader_name, created_at, note, rows, asset_paths")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const admins: string[] =
    (adminsRow?.value as { emails?: string[] } | null)?.emails?.map((e) => e.toLowerCase()) ??
    [DEFAULT_ADMIN_EMAIL];
  const rules: Rules = { ...DEFAULT_RULES, ...((rulesRow?.value as Partial<Rules>) ?? {}) };
  const isAdmin = admins.includes((user.email ?? "").toLowerCase());

  return (
    <AppShell
      user={{ email: user.email ?? "", name: (user.user_metadata?.full_name as string) || user.email || "" }}
      initialAdmins={admins}
      initialRules={rules}
      initialUploads={(uploads ?? []) as unknown as Upload[]}
      isAdmin={isAdmin}
    />
  );
}
