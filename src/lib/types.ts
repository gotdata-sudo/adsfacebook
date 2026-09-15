import type { AdRow } from "./rules";

export type Upload = {
  id: string;
  uploader_email: string;
  uploader_name: string;
  created_at: string;
  note: string | null;
  asset_paths: string[];
  rows: AdRow[];
};

export type AppSettingsRow = {
  key: string;
  value: unknown;
};
