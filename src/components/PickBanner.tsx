import { fmt, type AdRow, type Rules, pickBest } from "@/lib/rules";
import { VerdictPill } from "@/components/Pill";

export default function PickBanner({ rows, rules }: { rows: AdRow[]; rules: Rules }) {
  const best = rows.length ? pickBest(rows, rules) : null;

  if (!best) {
    return (
      <div className="flex items-center gap-3.5 bg-surface border border-line rounded-card px-5 py-4">
        <Icon muted />
        <div>
          <div className="text-[12px] font-bold uppercase tracking-wide text-inkFaint">ยังสรุปไม่ได้</div>
          <div className="font-display text-[16px]">ยังไม่มีข้อมูลพอเปรียบเทียบ</div>
          <div className="text-[13px] text-inkDim">กรอกอย่างน้อยยอดใช้จ่ายและอิมเพรสชัน 1 แถวขึ้นไป</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3.5 bg-accent text-accentInk rounded-card px-5 py-4 shadow-sm">
      <Icon />
      <div>
        <div className="text-[12px] font-bold uppercase tracking-wide text-accentInk/70">เส้นทางที่แนะนำ · อิมเพรสชันต่อบาทสูงสุด</div>
        <div className="font-display text-[16px]">
          {best.row.adsetName || "(ไม่มีชื่อ)"} — {fmt(best.v.impPerBaht, 2)} อิมเพรสชัน/฿
          {!best.hasHealthy && <span className="font-bold"> (ทุกแถวยังเข้าเกณฑ์ &quot;ควรปิด&quot; — พิจารณาปรับก่อนเปิดต่อ)</span>}
        </div>
        <div className="mt-1.5">
          <VerdictPill v={best.v} />
        </div>
      </div>
    </div>
  );
}

function Icon({ muted }: { muted?: boolean }) {
  return (
    <div
      className={`w-10 h-10 rounded-[8px] flex items-center justify-center flex-none ${
        muted ? "bg-surface2 text-inkFaint" : "bg-accentInk/15 text-accentInk"
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M4 19c4-1 5-5 8-11m0 0-3 1m3-1 1 3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="19" cy="6" r="2" fill="currentColor" />
      </svg>
    </div>
  );
}
