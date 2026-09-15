import type { AdRow } from "./rules";

export type Upload = {
  id: string;
  uploader_email: string;
  uploader_name: string;
  created_at: string;
  note: string | null;
  brand: string | null;
  asset_paths: string[];
  rows: AdRow[];
};

export type AppSettingsRow = {
  key: string;
  value: unknown;
};

export type Profile = {
  email: string;
  name: string;
  first_seen: string;
  last_seen: string;
  blocked: boolean;
};
