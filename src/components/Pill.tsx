import type { CheckStatus, Evaluation } from "@/lib/rules";

const STYLES: Record<string, string> = {
  good: "bg-goodBg text-good border-good/30",
  warn: "bg-warnBg text-warn border-warn/30",
  fail: "bg-badBg text-bad border-bad/30",
  info: "bg-infoBg text-info border-info/30",
};

export function Pill({ status, label }: { status: "good" | "warn" | "fail" | "info"; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-bold border whitespace-nowrap ${STYLES[status]}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current flex-none" />
      {label}
    </span>
  );
}

export function checkPillStatus(status: CheckStatus): "good" | "warn" | "fail" | "info" {
  if (status === "pass" || status === "good") return "good";
  if (status === "warn") return "warn";
  if (status === "fail") return "fail";
  return "info";
}

export function VerdictPill({ v }: { v: Evaluation }) {
  const status = v.verdict === "good" ? "good" : v.verdict === "warn" ? "warn" : v.verdict === "bad" ? "fail" : "info";
  return <Pill status={status} label={v.verdictLabel} />;
}
