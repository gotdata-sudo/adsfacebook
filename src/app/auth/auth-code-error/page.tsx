export default function AuthCodeError() {
  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10 bg-bg text-ink">
      <div className="w-full max-w-[400px] bg-surface border border-line rounded-card shadow-sm p-8 text-center">
        <h1 className="font-display text-lg font-semibold mb-2">เข้าสู่ระบบไม่สำเร็จ</h1>
        <p className="text-inkDim text-sm mb-6">
          ลิงก์ยืนยันตัวตนหมดอายุหรือไม่ถูกต้อง กรุณาลองเข้าสู่ระบบอีกครั้ง
        </p>
        <a href="/login" className="inline-block rounded-lg bg-accent text-accentInk px-4 py-2 text-sm font-semibold">
          กลับไปหน้าเข้าสู่ระบบ
        </a>
      </div>
    </div>
  );
}
