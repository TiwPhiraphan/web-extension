# SPEC & UPGRADE PLAN: web-extension v2.1.0
## Feature: Optional Bundler Support (`--bundler <vite|none>`, Vanilla / Zero-Build Mode)

เอกสารฉบับนี้จัดทำขึ้นสำหรับทีมพัฒนาและ AI Agent เพื่อใช้เป็นแผนและพิมพ์เขียว (Blueprint) ในการพัฒนา `web-extension` เวอร์ชัน **2.1.0** โดยระบุรายละเอียดสถาปัตยกรรม, การแก้ไขโค้ด, Flag API, โครงสร้างไฟล์ และชุดการทดสอบทั้งหมดอย่างครบถ้วน

---

## 1. บทนำและที่มา (Motivation & Background)

### 1.1 ปัญหาใน v2.0.0
ในเวอร์ชัน 2.0.0 `web-extension` บังคับใช้ **Vite + CRXJS** เป็นแกนหลักเสมอ แม้จะเลือกแบบ `--type content-only` หรือ `--lang js` โครงการที่ได้ก็ยังคงมี:
- `vite.config.ts / js`
- `manifest.config.ts / js`
- `targets.config.ts / js`
- `node_modules` ขนาดใหญ่จาก `vite` และ `@crxjs/vite-plugin`
- ขั้นตอนการ build ที่ต้องสั่ง `bun run build:chrome` ก่อนเสมอถึงจะได้โฟลเดอร์ `dist/chrome-mv3`

### 1.2 ความต้องการจริง (Real-World Use Case)
ส่วนขยายจำนวนมากในระบบงานจริง (เช่น ส่วนขยายระบบจัดการราคา, แก้ไข Layout ใบปะหน้า, เปลี่ยนเส้นทาง URL, หรือเชื่อมต่อ Native Messaging Host):
- มีขนาดโค้ดสั้น (50 - 300 บรรทัด)
- ไม่ได้ใช้ Framework (React/Vue/Svelte)
- ไม่ต้องการ Dependency ภายนอก
- ผู้พัฒนาต้องการความเรียบง่ายระดับ **Zero-Build**: เขียนไฟล์ `manifest.json` + `background.js` + `content.js` แล้วเปิด Google Chrome กด **"Load unpacked" ชี้มาที่โฟลเดอร์โปรเจกต์ได้ทันที** แก้ไขโค้ดแล้วกด Refresh ในเบราว์เซอร์ได้โดยไม่ต้องรอ Build Tool

### 1.3 เป้าหมายของ v2.1.0
เพิ่มความสามารถในการเลือกตัวสร้างโปรเจกต์ (Bundler):
1. **`vite` (Default):** โครงสร้างเดิมของ v2.0.0 (Vite + CRXJS + HMR + Multi-target) ทำงานเหมือนเดิม 100% ไม่มี Breaking Change
2. **`none` (Vanilla / Zero-build):** โครงสร้างคลีนเบาหวิว ไร้ Bundler สามารถนำโฟลเดอร์โปรเจกต์ไป Load Unpacked เข้า Chrome ได้ทันที

---

## 2. CLI API & UX Specification

### 2.1 Flag Definitions
เพิ่ม Flag ใหม่ในคำสั่ง `init`:

| Flag | Type | Allowed Values | Default (`--yes`) | คำอธิบาย |
|---|---|---|---|---|
| `--bundler <tool>` | string | `vite`, `none` | `vite` | เลือก Build Tool ที่ต้องการใช้งาน |
| `--vanilla` | boolean | `true` | - | Shorthand สะดวกใช้สำหรับ `--bundler none` |
| `--no-bundler` | boolean | `true` | - | Alias สำหรับ `--bundler none` |

### 2.2 Interactive Prompt (ผ่าน `@clack/prompts`)
จะแสดงคำถามนี้ในลำดับถัดจากการเลือกภาษา (`--lang`) หรือ Project Type (`--type`):

```text
? Select build tool / bundler:
  ● Vite + CRXJS  (Modern: HMR, TypeScript, Multi-target, Bundling) [Recommended]
  ○ None / Vanilla (Zero-build: Direct "Load unpacked", Lightweight, Zero-dep)
```

- หากระบุ `--bundler`, `--vanilla`, `--no-bundler` หรือส่ง `--yes / -y` จะข้ามคำถามนี้โดยใช้ค่าตามที่กำหนด (Default คือ `vite`)

### 2.3 Flag Validation & Constraints
1. หากส่งค่า `--bundler` ที่ไม่ใช่ `vite` หรือ `none` ให้โยนข้อผิดพลาด:
   `Invalid value "${val}" for --bundler. Expected one of: vite, none`
2. **Safari Target กับ No-bundler:**
   Safari จำเป็นต้องรัน `xcrun safari-web-extension-converter` จาก output folder ถ้าเลือก `--browser safari` ร่วมกับ `--bundler none` ให้เตือน Warning หรืออนุญาตเฉพาะ MV2/MV3 structure มาตรฐาน
3. **Zero-Dependency Guarantee:**
   เมื่อเลือก `--bundler none` และ `--lang js` ตัว CLI จะสร้างโปรเจกต์ที่มี `package.json` แบบไร้ dependencies (หรือมีเพียง `@types/chrome` เพื่อให้ VS Code มี IntelliSense) ไม่จำเป็นต้องรัน `npm/bun install` เพื่อให้โปรเจกต์ทำงานได้

---

## 3. เปรียบเทียบสถาปัตยกรรมไฟล์ (Architecture Comparison)

### 3.1 โหมด Vite (`--bundler vite`) — *Default เดิม*
```text
my-extension/
├── public/
│   └── icons/ (16.png, 48.png, 128.png)
├── src/
│   ├── background/index.ts
│   ├── content/index.ts
│   └── popup/
├── manifest.config.ts
├── targets.config.ts
├── vite.config.ts
├── tsconfig.json (และ tsconfig.*.json)
├── package.json (vite, @crxjs/vite-plugin, ...)
└── dist/chrome-mv3/  <-- จุดที่นำไป Load Unpacked
```

### 3.2 โหมด Vanilla Zero-Build (`--bundler none --lang js`) — *ใหม่ใน v2.1.0*
```text
my-extension/
├── icons/
│   ├── 16.png
│   ├── 48.png
│   └── 128.png
├── src/
│   ├── background.js       # (ตาม features ที่เลือก)
│   ├── content.js
│   └── popup/
│       ├── index.html
│       ├── popup.js
│       └── popup.css
├── manifest.json           # Manifest v3 ตัวจริง วางที่ Root
├── package.json            # มีเฉพาะ metadata และ scripts ทั่วไป (ไม่มี vite)
└── README.md               # แนะนำการ Load Unpacked ชี้มาที่โฟลเดอร์นี้ตรงๆ
```
> **จุดสำคัญ:** ผู้ใช้สามารถนำโฟลเดอร์ `my-extension/` ไป Load Unpacked ใน `chrome://extensions` ได้ทันทีโดยไม่ต้องรันคำสั่ง Build ใดๆ ทั้งสิ้น

### 3.3 โหมด Vanilla TypeScript (`--bundler none --lang ts`)
กรณีที่ต้องการเขียน TypeScript แต่ไม่ต้องการ Vite:
- ใช้ `tsc` เพียวๆ คอมไพล์ไฟล์จาก `src/` ไปออกที่ `dist/`
- คัดลอก `manifest.json`, `icons/`, `html` ไปไว้ที่ `dist/`
- Script ใน `package.json` จะมีเพียง:
  - `"build": "tsc"`
  - `"dev": "tsc --watch"`

---

## 4. แผนการแก้ไขโค้ดรายไฟล์ (Step-by-Step Implementation Blueprint)

### 4.1 `src/cli/context.ts`
1. เพิ่ม Type `Bundler`:
   ```typescript
   export type Bundler = 'vite' | 'none';
   ```
2. เพิ่มฟิลด์ใน `Context`:
   ```typescript
   export interface Context {
     // ...ฟิลด์เดิม...
     bundler: Bundler;
   }
   ```

### 4.2 `src/cli/args.ts`
1. เพิ่มฟิลด์ใน `ParsedArgs`:
   ```typescript
   bundler?: Bundler;
   ```
2. เพิ่ม `VALID_BUNDLERS = ['vite', 'none'];`
3. เพิ่มการตรวจจับ Flag ในลูป Parsing:
   - `--bundler`: ตรวจสอบความถูกต้องว่าอยู่ใน `VALID_BUNDLERS` หรือไม่
   - `--vanilla`: เซ็ต `result.bundler = 'none'`
   - `--no-bundler`: เซ็ต `result.bundler = 'none'`
4. อัปเดตฟังก์ชัน `printHelp()` เพิ่มคำอธิบายของ `--bundler`, `--vanilla`, `--no-bundler`

### 4.3 `src/cli/prompts.ts`
1. เพิ่มขั้นตอนถาม `bundler` ในกรณีที่เป็น Interactive TTY และไม่ได้ระบุ Flag หรือ `--yes`:
   ```typescript
   let bundler: Bundler = args.bundler || (useDefaults ? 'vite' : (undefined as any));
   if (!bundler) {
     if (!isTTY) {
       bundler = 'vite';
     } else {
       bundler = handleCancel(
         await p.select({
           message: 'Select build tool / bundler:',
           options: [
             {
               value: 'vite',
               label: 'Vite + CRXJS',
               hint: 'Modern HMR, TypeScript, bundling, multi-browser',
             },
             {
               value: 'none',
               label: 'None / Vanilla',
               hint: 'Zero-build, lightweight, instant Load unpacked',
             },
           ],
           initialValue: 'vite',
         }),
       ) as Bundler;
     }
   }
   ```
2. ปรับการถามเรื่อง `install dependencies`:
   - หากเลือก `bundler === 'none'` และ `language === 'js'` ค่าเริ่มต้นของ `install` สามารถตั้งเป็น `false` ได้โดยอัตโนมัติ เนื่องจากไม่มี Build Dependency

### 4.4 สร้างโมดูลใหม่ `src/generate/vanilla.ts`
สร้างไฟล์แยกสำหรับสร้างโปรเจกต์ Vanilla เพื่อไม่ให้ `src/generate/index.ts` ซับซ้อนเกินไป:
- **`generateVanillaProject(ctx: Context)`**:
  1. สร้างโฟลเดอร์ Root และโครงสร้างไฟล์พื้นฐาน (`icons/`, `src/`)
  2. สร้างไฟล์ `manifest.json` โดยตรงที่ Root (กรณี JS) หรือใน `dist/` (กรณี TS) โดยแปลงจาก `buildManifestObject(ctx)`
  3. คัดลอก Code Templates ตาม Features ที่เลือก:
     - `background.js` (หรือ `.ts`)
     - `content.js` (และ `style.css` ถ้ามี)
     - `popup/` (HTML, JS, CSS)
     - `options/`, `sidepanel/`, `devtools/`, `newtab/`
  4. สร้าง `package.json` เวอร์ชัน Vanilla:
     - หากเป็น JS: ไม่มี dependencies หรือ devDependencies (มีเฉพาะ name, version, description, type: "module")
     - หากเป็น TS: มีเฉพาะ `typescript` และ `@types/chrome`
  5. สร้าง `README.md` ที่แนะนำวิธี "Load unpacked" ชี้ตรงมาที่โฟลเดอร์โปรเจกต์

### 4.5 `src/generate/index.ts`
ปรับปรุงจุดเข้าหลักของ Generator ให้แตกกิ่งตามค่า `ctx.bundler`:
```typescript
export function generateProject(ctx: Context): { targetDir: string; targets: TargetConfig[] } {
  if (ctx.bundler === 'none') {
    return generateVanillaProject(ctx);
  }
  // ...โค้ดสร้างโปรเจกต์ Vite + CRXJS เดิม...
}
```

### 4.6 Template Additions (ในโฟลเดอร์ `templates/`)
- เพิ่ม templates สำหรับไฟล์ Vanilla ที่ไม่ต้องผ่าน Vite bundler (เช่น `manifest.json` static schema, relative import paths ที่รองรับ ES Modules บน Chrome MV3)

---

## 5. แผนการทดสอบและการตรวจสอบคุณภาพ (Testing & Verification Plan)

### 5.1 Unit Tests (`test/`)
1. **`test/args.test.ts`**:
   - ทดสอบ `--bundler vite` -> `args.bundler === 'vite'`
   - ทดสอบ `--bundler none` -> `args.bundler === 'none'`
   - ทดสอบ `--vanilla` -> `args.bundler === 'none'`
   - ทดสอบ `--no-bundler` -> `args.bundler === 'none'`
   - ทดสอบ `--bundler webpack` -> เกิดข้อผิดพลาด Invalid bundler
2. **`test/generate.test.ts`**:
   - ทดสอบ generate โปรเจกต์ด้วย `--bundler none --lang js`:
     - ต้องมีไฟล์ `manifest.json` อยู่ที่ Root
     - ต้อง**ไม่มี**ไฟล์ `vite.config.js`, `manifest.config.js`, `targets.config.js`
     - ตรวจสอบว่าใน `package.json` ไม่มี dependency ของ `vite` หรือ `@crxjs/vite-plugin`
   - ทดสอบ generate โปรเจกต์ด้วย `--bundler vite` (Default regression test):
     - ต้องมีไฟล์ `vite.config.ts`, `manifest.config.ts` เหมือนเดิม 100%

### 5.2 Smoke Tests (`test-smoke.mjs`)
เพิ่มชุดทดสอบ Suite F:
- **Suite F:** Vanilla Chrome MV3 Extension (JavaScript, Content Script + Background)
  - สร้างด้วย: `bun x . my-vanilla --bundler none --lang js --yes`
  - ตรวจสอบความถูกต้องของ `manifest.json`
  - ยืนยันว่าสามารถนำโฟลเดอร์ไปใช้เป็น Extension Unpacked ได้ทันที

---

## 6. เอกสารที่ต้องปรับปรุงประกอบการ Release v2.1.0

1. **`package.json`**:
   - อัปเกรดเวอร์ชันจาก `2.0.0` เป็น `2.1.0`
2. **`README.md`**:
   - เพิ่มหัวข้ออธิบาย `--bundler` ในตาราง Flags
   - เพิ่ม Recipe ตัวอย่างการสร้าง "Zero-Build Vanilla Extension":
     ```bash
     web-extension my-vanilla-ext --bundler none --lang js --yes
     ```
3. **`AI.md`**:
   - อัปเดต Parameter Matrix, Flag Invariants, และ System Specification สำหรับ AI Agents
4. **`DEVELOPER.md`**:
   - บันทึกการเพิ่มโมดูล `vanilla.ts` และการทำงานแบบคู่ขนาน (Dual-engine generator)

---

## 7. กำหนดการและขั้นตอนการส่งมอบ (Delivery Checklist)

- [ ] อัปเดต `Context` และ Types ใน `src/cli/context.ts`
- [ ] เพิ่ม Argument parsing และ validation ใน `src/cli/args.ts`
- [ ] เพิ่มคำถามใน `src/cli/prompts.ts`
- [ ] สร้างโมดูล `src/generate/vanilla.ts`
- [ ] อัปเดต Router ใน `src/generate/index.ts`
- [ ] เขียน Unit Tests ครอบคลุมทุกเงื่อนไขใน `test/`
- [ ] รัน `bun run test` (Vitest) ผ่านทั้งหมด 100%
- [ ] รัน `bun run typecheck` (tsc) ผ่าน 0 error
- [ ] รัน `bun run test:smoke` ผ่านทุก Suite
- [ ] ปรับปรุงเอกสาร `README.md`, `AI.md`, `DEVELOPER.md`
- [ ] บันทึกและสรุปการอัปเกรดเตรียม Publish v2.1.0

