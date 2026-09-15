# เส้นทางโฆษณา (Ad Route)

อัปโหลดผลลัพธ์แอดเซ็ตจาก Ads Manager คำนวณ "อิมเพรสชันต่อ 1 บาท" เทียบทุกแอดเซ็ต
และแนะนำว่าตัวไหนควรเปิดต่อ/เฝ้าระวัง/ควรปิด ตามเกณฑ์ที่ปรับได้จากหน้าแอดมิน —
ล็อกอินด้วย Google จริง (Supabase Auth) จำกัดเฉพาะอีเมล `@bananaandco.org`

สแตก: **Next.js 14 (App Router) + Supabase (Auth/Postgres/Realtime) + Tailwind**,
deploy บน **Vercel**.

> เวอร์ชันนี้ยังไม่มีฟีเจอร์ "ให้ AI อ่านตัวเลขจากภาพอัตโนมัติ" — กรอกข้อมูลเองในแท็บ
> อัปโหลด (ดูหัวข้อ "เพิ่มทีหลัง" ด้านล่างถ้าต้องการเพิ่มภายหลัง)

---

## 1. สร้างโปรเจกต์ Supabase

1. ไปที่ [supabase.com](https://supabase.com) → New project (จด **Project URL** และ
   **anon public key** จาก Project Settings → API ไว้ใช้ในขั้นตอนที่ 4)
2. เปิด **SQL Editor** → New query → วางเนื้อหาทั้งหมดจากไฟล์
   [`supabase/schema.sql`](./supabase/schema.sql) ในโปรเจกต์นี้ → Run
   - ไฟล์นี้สร้างตาราง `uploads`, `app_settings`, ตั้งค่า Row Level Security
     (จำกัดเฉพาะอีเมล `@bananaandco.org`), เปิด Realtime และ **ใส่อีเมลแอดมินคนแรก**
     (`got.data@bananaandco.org`) — แก้อีเมลในไฟล์ก่อนรันถ้าต้องการคนอื่นเป็นแอดมินคนแรก
3. ถ้าต้องการแอดมินคนอื่นเพิ่มทีหลัง ไม่ต้องแก้ SQL — เข้าแอปแล้วเพิ่มได้จากแท็บ
   "ผู้ดูแลระบบ" (เฉพาะแอดมินที่มีอยู่แล้วเท่านั้นที่เพิ่มคนอื่นได้)
4. ถ้าเคยรัน `supabase/schema.sql` ไปแล้วก่อนหน้านี้ (โปรเจกต์เก่า) ให้วางแล้ว Run ไฟล์นี้ซ้ำอีกครั้ง —
   เขียนให้รันซ้ำได้อย่างปลอดภัยเสมอ (ใช้ `if not exists` / `on conflict do nothing` ทุกจุด) เพื่อดึง
   ตาราง `profiles` (สำหรับบล็อคผู้ใช้) และคอลัมน์ `brand` ใหม่เข้ามา

## 2. สร้าง Google OAuth Client

1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   → สร้างโปรเจกต์ (หรือใช้โปรเจกต์เดิมของบริษัท)
2. **OAuth consent screen**: ตั้งเป็น Internal (ถ้าใช้ Google Workspace ขององค์กร
   `bananaandco.org`) หรือ External + จำกัด test users ตามความเหมาะสม
3. **Credentials → Create Credentials → OAuth client ID** → Application type:
   **Web application**
4. ใน **Authorized redirect URIs** ใส่ URL จาก Supabase (ดูได้ที่ Supabase Dashboard →
   Authentication → Providers → Google — มีช่อง "Callback URL" ให้คัดลอกพอดี) รูปแบบคือ:
   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```
5. คัดลอก **Client ID** และ **Client Secret** ที่ได้

## 3. เปิดใช้ Google provider ใน Supabase

1. Supabase Dashboard → Authentication → Providers → **Google** → Enable
2. วาง Client ID และ Client Secret จากขั้นตอนที่ 2
3. Authentication → URL Configuration:
   - **Site URL** = URL ของแอปที่ deploy แล้ว (เช่น `https://ad-route.vercel.app`)
   - **Redirect URLs** เพิ่ม `https://ad-route.vercel.app/auth/callback` (และ
     `http://localhost:3000/auth/callback` ถ้าจะรันทดสอบในเครื่องด้วย)

> การจำกัดโดเมน `@bananaandco.org` ทำที่ชั้นแอป (middleware + RLS ในฐานข้อมูล) ไม่ได้พึ่ง
> การตั้งค่าฝั่ง Google เพียงอย่างเดียว — ถ้ามีบัญชี Google นอกโดเมนหลุดเข้ามา ระบบจะ sign out
> และเด้งกลับหน้า login พร้อมข้อความแจ้งเตือนให้ทันที ถ้าต้องการเปลี่ยนโดเมนที่อนุญาต แก้ที่
> `ALLOWED_EMAIL_DOMAINS` ใน `src/middleware.ts` และฟังก์ชัน `is_org_member()` ใน
> `supabase/schema.sql` (รัน SQL ใหม่อีกครั้งหลังแก้)

## 4. ตั้งค่าตัวแปรแวดล้อม

คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่าจาก Supabase (ขั้นตอนที่ 1):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

(ใช้ค่าเดียวกันนี้ตั้งเป็น Environment Variables ในโปรเจกต์ Vercel ที่ขั้นตอนที่ 6)

## 5. รันทดสอบในเครื่อง (ไม่บังคับ)

```bash
npm install
npm run dev
```

เปิด http://localhost:3000 — ต้องตั้ง Redirect URL ของ localhost ใน Supabase ตามขั้นตอนที่ 3 ก่อน

## 6. Push ขึ้น GitHub แล้ว Deploy บน Vercel

```bash
git init
git add .
git commit -m "Initial commit: เส้นทางโฆษณา"
git branch -M main
git remote add origin <URL ของ GitHub repo คุณ>
git push -u origin main
```

จากนั้นที่ [vercel.com/new](https://vercel.com/new):

1. Import repo นี้จาก GitHub
2. Framework Preset: **Next.js** (ตรวจจับอัตโนมัติ)
3. ใส่ Environment Variables สองตัวจากขั้นตอนที่ 4 (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
4. Deploy
5. คัดลอก URL ที่ได้ (เช่น `https://ad-route.vercel.app`) กลับไปใส่ใน Supabase → Authentication →
   URL Configuration (ขั้นตอนที่ 3) ถ้ายังไม่ได้ใส่ URL จริง

เข้า URL ที่ deploy แล้ว → "เข้าสู่ระบบด้วย Google" → ถ้าเป็นอีเมล `@bananaandco.org` และตรงกับ
อีเมลแอดมินที่ seed ไว้ในขั้นตอนที่ 1 จะเห็นแท็บ "ผู้ดูแลระบบ" ทันที

---

## โครงสร้างโปรเจกต์

```
src/
  app/
    page.tsx              หน้าแอปหลัก (server component, ดึง user/rules/uploads เริ่มต้น)
    login/page.tsx         หน้าล็อกอิน (Sign in with Google)
    auth/callback/route.ts รับ OAuth code จาก Supabase แล้วแลก session
  components/
    AppShell.tsx            เมนูแท็บ + subscribe realtime + state กลาง
    UploadTab.tsx           กรอกข้อมูลแอดเซ็ต + พรีวิวผลวิเคราะห์สด
    RankingTab.tsx          จัดอันดับอิมเพรสชัน/บาท + เหตุผลรายข้อ
    HistoryTab.tsx          ประวัติการอัปโหลดทั้งทีม
    DashboardTab.tsx        สรุปภาพรวม/รายคน กรองตามช่วงวันและแบรนด์
    AdminTab.tsx            สถิติรวม / จัดการแอดมิน+แบรนด์ / ปรับเกณฑ์ / บล็อคผู้ใช้
  lib/
    rules.ts                 rule engine — จุดเดียวที่ตัดสิน "เปิดต่อ/เฝ้าระวัง/ควรปิด"
    supabase/client.ts        Supabase client ฝั่ง browser
    supabase/server.ts        Supabase client ฝั่ง server (Server Components)
  middleware.ts              บังคับล็อกอิน + จำกัดโดเมนอีเมล
supabase/schema.sql          ตาราง + Row Level Security + seed แอดมินคนแรก
```

## เกณฑ์การวิเคราะห์ (ปรับได้ที่แท็บผู้ดูแลระบบ)

ค่าเริ่มต้นแปลมาจากหมายเหตุทีม: CPM 300–600 บาท (เกณฑ์วันแรก), CTR 0.8–1.25%, ความถี่ไม่เกิน 9
(ต่ำกว่า 1.08 ถือว่ายังไม่นิ่ง), ช่วงขยับราคา 3 ครั้งแรกยังไม่ตัดสินต้นทุน (ใช้สูตร
ยอดใช้จ่าย ÷ 80% ของผลลัพธ์แทน), อัตราผลลัพธ์ต่อคลิกลิงก์เกิน 30% หลังเปิดมา 3 วันขึ้นไปจะเตือนว่า
อาจเริ่มอิ่มตัว "อัตราการมีส่วนร่วม" เก็บไว้แสดงผลอย่างเดียว (ยังไม่มีเกณฑ์ตัดสินชัดเจนจากทีม —
ปรับเพิ่มได้ใน `src/lib/rules.ts` เมื่อมีตัวเลขที่ต้องการ)

## เพิ่มทีหลัง: อ่านภาพด้วย AI อัตโนมัติ

ตอนนี้กรอกข้อมูลเอง เมื่อพร้อมเพิ่มระบบอ่านภาพ Ads Manager อัตโนมัติ แนวทางที่แนะนำ:

1. สมัคร API key ที่ [console.anthropic.com](https://console.anthropic.com) (มีค่าใช้จ่ายแยก
   ตามการใช้งาน จริง) ตั้งเป็น `ANTHROPIC_API_KEY` ใน Vercel
2. เพิ่ม Route Handler ใหม่ เช่น `src/app/api/extract/route.ts` ที่รับไฟล์ภาพ (multipart/form-data)
   แล้วเรียก Anthropic Messages API แบบ vision (ส่ง image content block + สั่งให้ตอบ JSON array
   ตามโครงสร้าง `AdRow` ใน `src/lib/rules.ts`) — สามารถอ้างอิง prompt เดิมที่เคยออกแบบไว้แล้ว
   (มีเนื้อหาอธิบายคอลัมน์ Ads Manager ภาษาไทย/อังกฤษครบ) ให้ copy กลับมาใช้ได้เลย
3. เก็บภาพต้นฉบับด้วย [Supabase Storage](https://supabase.com/docs/guides/storage) แล้วบันทึก
   path ไว้ในคอลัมน์ `asset_paths` ที่เตรียมไว้ในตาราง `uploads` แล้ว
4. ในฝั่ง UI เพิ่มปุ่ม "ให้ AI อ่านข้อมูลจากภาพ" ใน `UploadTab.tsx` ที่อัปโหลดไฟล์ไปยัง route
   handler ใหม่ แล้วเทผลลัพธ์เข้า state `rows` เดิม (โครงสร้างข้อมูลตรงกันอยู่แล้ว ไม่ต้องแก้ rule
   engine หรือหน้าอื่น)

## หมายเหตุความปลอดภัย

- ตัวแปร `NEXT_PUBLIC_SUPABASE_ANON_KEY` เป็นคีย์สาธารณะโดยออกแบบ (ใช้ฝั่ง browser ได้ปลอดภัย)
  เพราะการเข้าถึงข้อมูลจริงถูกควบคุมด้วย Row Level Security ในฐานข้อมูล ไม่ใช่การซ่อนคีย์
- อย่า commit ไฟล์ `.env.local` ขึ้น git (อยู่ใน `.gitignore` แล้ว)
- สิทธิ์แอดมิน (แก้เกณฑ์/ลบข้อมูล/จัดการแอดมิน) ถูกบังคับทั้งฝั่ง UI และฝั่งฐานข้อมูล (RLS policy
  `is_admin()`) ไม่ใช่แค่ซ่อนปุ่มในหน้าเว็บ
