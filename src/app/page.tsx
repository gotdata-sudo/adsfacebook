import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import { DEFAULT_RULES, type Rules } from "@/lib/rules";
import type { Profile, Upload } from "@/lib/types";

const DEFAULT_ADMIN_EMAIL = "got.data@bananaandco.org";

export default async function Home() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already guards this, but keep the page safe if hit directly.
  if (!user) redirect("/login");

  const displayName = (user.user_metadata?.full_name as string) || user.email || "";
  // Records/refreshes this user's row in `profiles` so admins can see
  // everyone who has ever signed in. Never touches `blocked` (see the RPC).
  await supabase.rpc("touch_profile", { p_name: displayName });

  const [{ data: adminsRow }, { data: brandsRow }, { data: rulesRow }, { data: uploads }] = await Promise.all([
    supabase.from("app_settings").select("value").eq("key", "admins").maybeSingle(),
    supabase.from("app_settings").select("value").eq("key", "brands").maybeSingle(),
    supabase.from("app_settings").select("value").eq("key", "rules").maybeSingle(),
    supabase
      .from("uploads")
      .select("id, uploader_email, uploader_name, created_at, note, brand, rows, asset_paths")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const admins: string[] =
    (adminsRow?.value as { emails?: string[] } | null)?.emails?.map((e) => e.toLowerCase()) ??
    [DEFAULT_ADMIN_EMAIL];
  const brands: string[] = (brandsRow?.value as { names?: string[] } | null)?.names ?? [];
  const rules: Rules = { ...DEFAULT_RULES, ...((rulesRow?.value as Partial<Rules>) ?? {}) };
  const isAdmin = admins.includes((user.email ?? "").toLowerCase());

  let profiles: Profile[] = [];
  if (isAdmin) {
    const { data } = await supabase.from("profiles").select("email, name, first_seen, last_seen, blocked").order("last_seen", { ascending: false });
    profiles = (data ?? []) as Profile[];
  }

  return (
    <AppShell
      user={{ email: user.email ?? "", name: displayName }}
      initialAdmins={admins}
      initialBrands={brands}
      initialRules={rules}
      initialUploads={(uploads ?? []) as unknown as Upload[]}
      initialProfiles={profiles}
      isAdmin={isAdmin}
    />
  );
}
