"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. Safe to call multiple times — Next.js
 * client components can import and call this directly; @supabase/ssr
 * handles session storage via cookies so the session is also visible
 * to the server (middleware, server components, route handlers).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
