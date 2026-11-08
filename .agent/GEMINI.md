# SPEC: CLI สำหรับ scaffold โปรเจกต์ Browser Extension

เอกสารนี้เขียนให้ AI/นักพัฒนาในอีก IDE นำไป implement ต่อ **โดยไม่ต้องเดา**
อ่านหัวข้อ 0 ก่อนเริ่มทำอะไรทั้งนั้น

---

## 0. กติกาสำหรับผู้ implement (สำคัญที่สุด)

1. **ห้ามเดา** เวอร์ชันของ package, ชื่อ API, หรือ option ของ plugin จากความจำ ให้ตรวจจากแหล่งจริงทุกครั้ง:
   - เวอร์ชัน/peer deps: `npm view <pkg> version peerDependencies`
   - API ของ library: อ่าน README/docs ของเวอร์ชันที่ติดตั้งจริงใน `node_modules`
2. ถ้าเจอเรื่องที่สเปกนี้ **ไม่ได้ระบุ** หรือ **ขัดกับความจริงที่ตรวจเจอ** ให้ **หยุดแล้วเขียนคำถามไว้ในไฟล์ `QUESTIONS.md`** แทนการเลือกเอง
3. ห้ามเพิ่มฟีเจอร์นอก scope (ดูหัวข้อ 17)
4. ทุกครั้งที่เสร็จหนึ่งหัวข้อ ให้รันทดสอบตามหัวข้อ 16 ที่เกี่ยวข้องก่อนไปต่อ
5. โค้ดของ CLI เขียนด้วย **TypeScript** (strict) ส่วนไฟล์ template ที่ถูก generate ให้ user มีทั้งแบบ TS และ JS
6. ภาษาใน prompt ของ CLI และ README: **อังกฤษเป็นหลัก** (เพราะ publish บน npm) ยกเว้นผู้ใช้สั่งเปลี่ยน
7. **ชื่อโปรเจกต์คือ `web-extension`** (ผู้ใช้กำหนดแล้ว) ดูหัวข้อ 0.1 ก่อนเริ่ม

### 0.1 ชื่อ `web-extension` และ repo ที่มีอยู่แล้ว (อ่านก่อนเขียนโค้ดบรรทัดแรก)

ผู้ใช้กำหนดชื่อเป็น `web-extension` และมี repo อยู่แล้วที่ https://github.com/TiwPhiraphan/web-extension

**สิ่งที่ตรวจเจอ ณ 8 พ.ย. 2026** (ข้อมูล repo ได้จากหน้า GitHub ผ่านตัวสรุปอัตโนมัติ ยังไม่ได้เห็นโค้ดจริง ต้องอ่านเองให้ครบ):

- repo มี `.agent/`, `bin/`, `src/`, `test/`, `.gitignore`, `LICENSE`, `README.md`, `bun.lock`, `package.json` และมี 1 commit
- README เดิมบอกว่าเป็น generator สำหรับ extension ข้าม browser (Chromium, Firefox, Safari) ใช้ Vite + CRXJS (MV3) ประกอบ manifest/config/entry ตามตัวเลือก ไม่ได้ copy template ตายตัว
- README เดิมใช้คำสั่ง `web-extension init` (ทั้งแบบ prompt และแบบ flags) และมีตัวเลือก UI framework (Vanilla/React/Vue/Svelte) และมี script ที่ generate ให้เกี่ยวกับ dev/build/Firefox/typecheck/แปลงเป็น Safari
- `npm view web-extension` ตอบ 404 พร้อมข้อความ **"Unpublished on 2026-03-08"** แปลว่าเคยมี package ชื่อนี้แล้วถูกถอนออก
- `npm view create-web-extension` ตอบ 404 ปกติ (ยังไม่มีใครใช้)

**สิ่งที่ผู้ implement ต้องทำก่อน:**

1. clone/อ่าน repo ปัจจุบันทั้งหมด (โดยเฉพาะ `package.json`, `bin/`, `src/`, `test/`, `.agent/`, `README.md`) แล้วเขียนสรุปว่า **มีอะไรอยู่แล้วและทำงานได้จริงไหม** ลง `NOTES.md`
2. สเปกนี้คือ **เป้าหมายพฤติกรรมที่ต้องการ** ไม่ใช่คำสั่งให้เริ่มใหม่ ให้ **ต่อยอดใน repo เดิม** ห้ามลบหรือเขียนทับของเดิมโดยไม่จำเป็น
3. ถ้าของเดิมมีสิ่งที่สเปกนี้ไม่ได้พูดถึง (เช่น UI framework, subcommand อื่น, script แปลง Safari) **ให้คงไว้** แล้วบันทึกใน `NOTES.md` ห้ามตัดออกเพราะสเปกไม่ได้เขียน
4. ถ้าของเดิมขัดกับสเปก (เช่น README เดิมบอก MV3 อย่างเดียว แต่สเปกนี้ต้องการ MV2 สำหรับ Firefox/Safari) **ให้ถือสเปกนี้เป็นเป้าหมาย** แต่ลงรายการความขัดแย้งใน `NOTES.md`
5. toolchain ของ repo เดิม (ดูจาก `package.json` และ `bun.lock` ดูเหมือนใช้ Bun) **มาก่อน** ข้อกำหนดเรื่อง tsup/vitest ในหัวข้อ 7 ถ้า repo มีตัว build/test อยู่แล้วให้ใช้ตัวเดิม ห้ามเปลี่ยนเครื่องมือเอง
6. **ก่อน publish** ต้องตรวจว่าชื่อ `web-extension` ใช้ publish ได้จริง (`npm publish --dry-run` และเช็กสิทธิ์) เพราะชื่อที่เคยถูก unpublish อาจติดข้อจำกัดของ npm ถ้า publish ไม่ได้ **หยุดแล้วเขียนลง `QUESTIONS.md`** ห้ามเปลี่ยนชื่อ package เอง

**รูปแบบคำสั่งที่ใช้ (ตามของเดิมใน repo):**

- package name = `web-extension`, bin name = `web-extension`
- คำสั่งหลักคือ subcommand `init`: `web-extension init [dir]`
- **ผู้ใช้ยืนยันแล้ว:** ถ้าเรียก `web-extension` โดยไม่มี subcommand ต้องทำงานเหมือน `init` ทุกประการ (รวมถึงการส่ง `[dir]` และ flags เช่น `web-extension my-app --lang ts` เท่ากับ `web-extension init my-app --lang ts`)
  - ถ้า argument แรกตรงกับชื่อ subcommand ที่มีอยู่ (`init` และ subcommand อื่นที่ repo เดิมมี) ให้ใช้ subcommand นั้น ถ้าไม่ตรงให้ถือเป็นการเรียก `init`
  - `--help`, `-h`, `--version`, `-v` ที่ระดับบนสุดยังแสดง help/เวอร์ชันตามปกติ ไม่ไปเข้า `init`
- **ข้อควรรู้เรื่อง `npm create`:** `npm create web-extension` จะไปหา package ชื่อ **`create-web-extension`** ไม่ใช่ `web-extension` ดังนั้นด้วยชื่อ package นี้จะใช้ `npm create` / `pnpm create` / `yarn create` / `bun create` ไม่ได้ ใช้ได้เฉพาะ `npx web-extension`, `pnpm dlx web-extension`, `bunx web-extension`, `bun x web-extension` หรือติดตั้ง global แล้วเรียก `web-extension init` ถ้าต้องการ `npm create web-extension` ต้องทำ package แยกชื่อ `create-web-extension` (ดูหัวข้อ 18 ข้อ 1) **ห้ามทำเองถ้ายังไม่ได้รับอนุญาต**

---

## 1. เป้าหมาย

พัฒนา CLI ชื่อ `web-extension` (ใช้ชื่อนี้ที่เดียวผ่าน constant เดียวในโค้ดและ `package.json`) ที่:

- รันผ่าน `npx web-extension init`, `pnpm dlx web-extension init`, `bunx web-extension init`, `bun x web-extension init` หรือติดตั้ง global แล้วใช้ `web-extension init`
- ใช้ `@clack/prompts` ถาม user ว่าจะทำ extension สำหรับ browser ไหน และมีส่วนประกอบอะไรบ้าง
- generate โปรเจกต์ที่ใช้ **Vite + @crxjs/vite-plugin** เป็น build tool
- ติดตั้ง **type package ที่ตรงกับ browser ที่เลือก** ให้อัตโนมัติ ทั้งโปรเจกต์ TS และ JS
- รองรับโปรเจกต์ที่มีแค่ **content script อย่างเดียว** (ไว้ hack DOM ของหน้าเว็บ ไม่มี popup/options ใดๆ) เป็นโหมดหลักโหมดหนึ่ง

---

## 2. การตัดสินใจที่ผู้ใช้ยืนยันแล้ว (ห้ามเปลี่ยนเอง)

| หัวข้อ | ข้อสรุป |
|---|---|
| Build tool ของโปรเจกต์ที่ generate | Vite + `@crxjs/vite-plugin` |
| ถามอะไรใน CLI | ถามเฉพาะสิ่งที่ Vite/crxjs ทำได้จริง ไม่ถามฟีเจอร์ที่ build ไม่ได้ |
| โหมด content-only | ต้องมี ไม่ต้องมีหน้า UI ใดๆ |
| Manifest version | MV3 สำหรับทุก browser และ MV2 เป็นตัวเลือกสำหรับ **Firefox และ Safari** เท่านั้น (Chromium = MV3 อย่างเดียว) |
| ฟีเจอร์ที่เลือกได้ | background, content script, popup, options, side panel, declarativeNetRequest rules, devtools page, new tab override, และอื่นๆ (extras ในหัวข้อ 5) |
| ชื่อ package / CLI | `web-extension` (repo: https://github.com/TiwPhiraphan/web-extension) |
| เรียก `web-extension` โดยไม่มี subcommand | ทำงานเหมือน `web-extension init` (ดูหัวข้อ 0.1) |
| ตรวจ package manager | ผู้ใช้รันผ่าน `bunx` ให้ใช้ bun, `pnpm dlx` ใช้ pnpm ฯลฯ และต้องมีวิธีจัดการกรณีติดตั้ง CLI แบบ global (ดูหัวข้อ 12) |
| Flag ของ prompt | **ทุกคำถาม** ต้องมี flag ไว้ข้ามคำถาม เช่น `--browser chrome\|firefox` (ดูหัวข้อ 6) |
| ภาษาของ CLI | TypeScript |
| วิธีรัน | ต้องรองรับ npx / bunx / **bun x** และต้องเขียนไว้ใน README (ดูหัวข้อ 15) |
| ภาษาของโปรเจกต์ที่ generate | เลือกได้ TS หรือ JS |

---

## 3. ข้อเท็จจริงที่ตรวจแล้ว vs ที่ต้องตรวจเอง

### ตรวจแล้ว (จากการค้นเว็บ ณ พ.ย. 2026 แต่ยังต้อง `npm view` ยืนยันอีกรอบ)

- `@crxjs/vite-plugin` เป็น Vite plugin อ่าน manifest แล้ว build ให้ มี HMR สำหรับ popup/options/content script/side panel
- plugin มี option `browser: 'chrome' | 'firefox'` (ค่าเริ่มต้น `'chrome'`)
- เอกสารแสดงตัวอย่าง multi-browser build ด้วย Vite `mode` และ `outDir` แยกตาม browser
- ตัวอย่างและคำเตือนในเอกสารระบุว่า plugin ตีความ manifest ที่ไม่ใช่ `manifest_version: 3` ว่าเป็น MV2 deprecated → **ให้ถือว่า crxjs ไม่ใช่ทางที่ถูกสำหรับ MV2**
- แหล่งข้อมูลให้เวอร์ชันล่าสุดไม่ตรงกัน (เจอทั้ง 2.4.0 และ 2.7.0) และบอกว่ารองรับ Vite 3 ถึง 8 → **ต้องดูจาก `npm view` เอง**
- ต้องมี `/// <reference types="@crxjs/vite-plugin/client" />` ใน d.ts ถึงจะใช้ import แบบ `?script` ได้
- ไฟล์ manifest เขียนด้วย `defineManifest` ใน `manifest.config.ts` เพื่อให้ได้ type และค่า dynamic ได้

### ต้องตรวจเองก่อนเขียนโค้ด (เขียนผลลงใน `NOTES.md`)

1. crxjs `browser: 'firefox'` สร้าง `background.scripts` แทน `service_worker` ให้เองจริงไหม หรือเราต้อง post-process manifest เอง
2. dev mode (HMR) บน Firefox ใช้งานได้ไหม ถ้าไม่ได้ ให้ใช้ `vite build --watch` เป็น `dev:firefox` แทน และเขียนข้อจำกัดนี้ใน README ที่ generate
3. Safari: crxjs รองรับหรือไม่ ถ้าไม่ ให้ใช้ output ของ chrome/firefox MV3 แล้วให้ user แปลงด้วย `xcrun safari-web-extension-converter` (CLI **ไม่ต้องรันคำสั่งนี้**)
4. `declarativeNetRequest` ใช้ได้ใน Firefox MV2 หรือเฉพาะ MV3 ถ้าไม่แน่ใจให้ **ซ่อนตัวเลือก DNR เมื่อเลือก MV2**
5. peer dependency ของ crxjs ตรงกับ Vite เวอร์ชันไหน ให้ตรึง `vite` ใน template ให้อยู่ในช่วงที่ crxjs รองรับ

---

## 4. ปัญหา MV2 กับ crxjs และทางออกที่กำหนด

crxjs เน้น MV3 ดังนั้นเมื่อ user เลือก **Firefox หรือ Safari แบบ MV2** ต้องใช้ pipeline แยก

**ทางออกที่กำหนด (ทำตามนี้ ถ้าไม่ได้ให้ลง `QUESTIONS.md`):**

- โปรเจกต์ที่ generate มี Vite config เดียว แยกพฤติกรรมด้วย `mode`
- mode ที่เป็น MV3 → ใช้ `crx({ manifest, browser })`
- mode ที่เป็น MV2 → **ไม่ใช้ crxjs** ใช้ helper ของเราเอง `build/mv2.ts` ที่:
  1. build แต่ละ entry (background, popup html, options html, devtools html, newtab html) ผ่าน `build.rollupOptions.input`
  2. build **content script แต่ละไฟล์เป็น IIFE แยกต่างหาก** (`build.lib`, `formats: ['iife']`) เพราะ MV2 content script โหลดเป็น ES module ไม่ได้
  3. emit `manifest.json` (MV2) หลัง build จาก object เดียวกับที่ใช้สร้าง MV3 (ดูหัวข้อ 9)
  4. watch mode ใช้ `vite build --watch` (ไม่มี HMR ใน MV2)
- **ทางเลือกสำรอง** ถ้าทำ helper เองแล้วซับซ้อนเกิน: ใช้ `vite-plugin-web-extension` เฉพาะ MV2 mode (ต้อง verify ก่อนว่ารองรับ MV2 จริงและเข้ากับ Vite เวอร์ชันที่ใช้) **ต้องถามผู้ใช้ก่อนเปลี่ยน** ผ่าน `QUESTIONS.md`

---

## 5. Flow ของ prompt (ลำดับและเงื่อนไขชัดเจน)

ใช้ `@clack/prompts` ผ่าน `p.group()` หรือเรียกต่อกันเอง ทุก prompt ต้องเช็ก `p.isCancel()` แล้ว `p.cancel('Cancelled.')` + `process.exit(0)`

อ่าน README ของเวอร์ชัน `@clack/prompts` ที่ติดตั้งจริงก่อนเรียกใช้ signature อาจเปลี่ยน

**ทุกคำถามในตารางนี้ต้องมี flag คู่กัน** (ตารางจับคู่อยู่ในหัวข้อ 6.1) ถ้าผู้ใช้ส่ง flag ของคำถามไหนมา ให้ข้ามเฉพาะคำถามนั้น ห้ามเพิ่ม prompt ใหม่ในอนาคตโดยไม่เพิ่ม flag คู่กัน

| # | Prompt | ชนิด | ตัวเลือก / ค่าเริ่มต้น | เงื่อนไข |
|---|---|---|---|---|
| 1 | Project name | `text` | default `my-extension` | validate: ไม่ว่าง, เป็นชื่อ npm ที่ถูกต้อง (พิมพ์เล็ก ไม่มีช่องว่าง) และถ้าเป็น path ให้ใช้ basename เป็นชื่อ package |
| 1b | Directory not empty | `select` | Cancel / Overwrite / Merge | แสดงเมื่อโฟลเดอร์ปลายทางมีไฟล์อยู่แล้ว |
| 2 | Language | `select` | TypeScript (default) / JavaScript | |
| 3 | Project type | `select` | **Full extension** / **Content script only** | ถ้าเลือก content only ข้ามไปข้อ 7 |
| 4 | Target browsers | `multiselect` (required, อย่างน้อย 1) | `Chromium (Chrome, Edge, Brave, Opera)` (value `chrome`) / `Firefox` (value `firefox`) / `Safari` (value `safari`) | default เลือก Chromium (`chrome`) |
| 5 | Manifest version ของ Firefox | `select` | MV3 (recommended) / MV2 | แสดงเมื่อเลือก Firefox |
| 5b | Manifest version ของ Safari | `select` | MV3 (recommended) / MV2 | แสดงเมื่อเลือก Safari |
| 6 | Features | `multiselect` | ดูตารางด้านล่าง | เฉพาะ Full extension |
| 7 | Content script options | ชุดย่อย | ดูด้านล่าง | แสดงเสมอถ้ามี content script (บังคับในโหมด content only) |
| 8 | Extras | `multiselect` (ไม่บังคับ) | ดูด้านล่าง | เฉพาะ Full extension |
| 9a | Package manager | `select` | npm / pnpm / yarn / bun โดย `initialValue` = ผลการตรวจจับ | แสดงเฉพาะเมื่อการตรวจจับไม่มั่นใจ (`confident: false` ดูหัวข้อ 12) และมี TTY และไม่ได้ส่ง `--pm` |
| 9 | Install dependencies? | `confirm` | default yes | |
| 10 | Init git repository? | `confirm` | default yes | ข้ามถ้าอยู่ใน git repo อยู่แล้ว |

### ข้อ 6 Features (Full extension)

| value | label | หมายเหตุ |
|---|---|---|
| `background` | Background (service worker / background script) | default เลือก |
| `content` | Content script | default เลือก |
| `popup` | Popup | |
| `options` | Options page | |
| `sidepanel` | Side panel | ใช้ได้เฉพาะ Chromium และ Firefox (Firefox ใช้ `sidebar_action`) ถ้าเลือกแค่ Safari ให้ซ่อน |
| `dnr` | declarativeNetRequest rules | ซ่อนถ้ามี target ที่เป็น MV2 (จนกว่าจะ verify ตามหัวข้อ 3 ข้อ 4) |
| `devtools` | DevTools page | |
| `newtab` | New tab override | |

ถ้าเลือกหลาย browser แล้วฟีเจอร์ไม่รองรับบาง browser ให้ **คงตัวเลือกไว้** แต่ใส่ `hint` บอก browser ที่ไม่รองรับ และตอน generate ให้ **ข้ามฟีเจอร์นั้นใน manifest ของ browser ที่ไม่รองรับ** (ดูหัวข้อ 8)

### ข้อ 7 Content script options

- `matches` (`text`, default `https://*/*`) รับหลายรูปแบบคั่นด้วย comma, validate ว่าไม่ว่างและแต่ละอันขึ้นต้นด้วย `http://`, `https://`, `*://`, `file://` หรือเป็น `<all_urls>`
- `run_at` (`select`): `document_idle` (default) / `document_start` / `document_end`
- `world` (`select`): `ISOLATED` (default) / `MAIN` แสดงเฉพาะเมื่อทุก target เป็น MV3
- `css` (`confirm`): สร้างไฟล์ CSS ให้ content script ไหม default yes

### ข้อ 8 Extras (multiselect ไม่บังคับ)

| value | สิ่งที่ generate |
|---|---|
| `contextmenu` | `contextMenus` permission + ตัวอย่างสร้างเมนูใน background (ต้องมี `background`) |
| `commands` | `commands` ใน manifest + handler ใน background (ต้องมี `background`) |
| `omnibox` | `omnibox` keyword + handler (ต้องมี `background`) |
| `storage` | helper เล็กๆ `src/lib/storage` ครอบ `storage.local` (ต้องมี permission `storage`) |

ถ้า extra ต้องพึ่ง `background` แต่ user ไม่ได้เลือก `background` ให้ **ซ่อน extra นั้น**

### โหมด Content script only

- ไม่ถามข้อ 6 และ 8
- ไม่สร้าง background, popup, options, หรือ HTML ใดๆ
- manifest มีแค่ `content_scripts` (ไม่มี `permissions` เลย ยกเว้นจำเป็นจริง)
- ไฟล์หลัก `src/content/index.(ts|js)` เป็นตัวอย่าง hack DOM (หัวข้อ 13)

---

## 6. Flags สำหรับโหมด non-interactive (ทุก prompt ต้องมี flag คู่กัน)

**หลักการ (ผู้ใช้ยืนยันแล้ว):** ทุกคำถามในหัวข้อ 5 ต้องมี flag ที่ตอบแทนได้ ถ้าส่ง flag ของคำถามไหนมา ให้ **ข้ามเฉพาะคำถามนั้น**

- คำถามที่ยังไม่ได้ตอบ และเงื่อนไขยังเข้าข่าย ยังต้องถามตามปกติ โดยเงื่อนไขคำนวณจากค่าที่ส่งมาแล้ว เช่น `--browser firefox` จะข้ามข้อ 4 แต่ยังถามข้อ 5 (Firefox MV) ถ้าไม่ได้ส่ง `--firefox-mv`
- ถ้า flag ครบจนไม่มีคำถามเหลือ ก็ไม่ต้องถามอะไรเลย (ยังแสดง intro/outro ตามปกติ)
- ลำดับความสำคัญ: **flag > ค่า default ของ `--yes` > prompt**

### 6.1 ตารางจับคู่ prompt กับ flag

| # | Prompt | Flag | ค่าที่รับ | ค่า default เมื่อใช้ `--yes` |
|---|---|---|---|---|
| 1 | Project name | `[dir]` (positional) และ `--name <string>` | `[dir]` = โฟลเดอร์ปลายทาง, `--name` = ชื่อ package (ไม่ส่งให้ใช้ basename ของ `[dir]`) | `my-extension` |
| 1b | Directory not empty | `--if-exists <cancel\|overwrite\|merge>` และ `--overwrite` (= `--if-exists overwrite`) | | `cancel` (error, exit 1) |
| 2 | Language | `--lang <ts\|js>` | รับ `typescript` / `javascript` เป็น alias | `ts` |
| 3 | Project type | `--type <full\|content-only>` | | `full` |
| 4 | Target browsers | `--browser <chrome\|firefox\|safari>` | ส่งหลายค่าได้ทั้งแบบคั่น comma (`--browser chrome,firefox`) และแบบซ้ำ (`--browser chrome --browser firefox`) ดูหมายเหตุด้านล่าง | `chrome` |
| 5 | Manifest version ของ Firefox | `--firefox-mv <2\|3>` | | `3` |
| 5b | Manifest version ของ Safari | `--safari-mv <2\|3>` | | `3` |
| 6 | Features | `--features <list\|none>` | `background,content,popup,options,sidepanel,dnr,devtools,newtab` (`none` = เลือกว่าง ต่างจากการไม่ส่ง flag) | `background,content` |
| 7 | Content script: matches | `--matches <pattern[,pattern]>` | | `https://*/*` |
| 7 | Content script: run_at | `--run-at <document_start\|document_end\|document_idle>` | | `document_idle` |
| 7 | Content script: world | `--world <ISOLATED\|MAIN>` | | `ISOLATED` |
| 7 | Content script: css | `--css` / `--no-css` | | `--css` |
| 8 | Extras | `--extras <list\|none>` | `contextmenu,commands,omnibox,storage` | `none` |
| 9a | Package manager | `--pm <npm\|pnpm\|yarn\|bun>` | | ผลการตรวจ (หัวข้อ 12) |
| 9 | Install dependencies? | `--install` / `--no-install` | | `--install` |
| 10 | Init git repository? | `--git` / `--no-git` | | `--git` (ถ้าอยู่ใน git repo อยู่แล้ว ข้ามพร้อม warning ไม่ถือเป็น error) |

หมายเหตุเรื่อง `--browser`:

- key ของ browser ที่ใช้ทั้งโปรเจกต์คือ `chrome`, `firefox`, `safari` โดย **`chrome` หมายถึงทุก browser ตระกูล Chromium** (Chrome, Edge, Brave, Opera) ซึ่งใช้ build เดียวกัน (`dist/chrome-mv3`)
- รับ `chromium` เป็น alias ของ `chrome` และรับ `--browsers` เป็น alias ของ `--browser` (ไม่ต้องแสดงใน `--help`)
- ค่าซ้ำให้ตัดซ้ำเงียบๆ ไม่ error

### 6.2 รูปแบบคำสั่งและ flag ทั้งหมด

```
web-extension [init] [dir] [options]

  --name <string>
  --if-exists <cancel|overwrite|merge>
  --overwrite
  --lang <ts|js>
  --type <full|content-only>
  --browser <chrome|firefox|safari>         # ส่งหลายค่าได้
  --firefox-mv <2|3>
  --safari-mv <2|3>
  --features <list|none>
  --matches <pattern[,pattern]>
  --run-at <document_start|document_end|document_idle>
  --world <ISOLATED|MAIN>
  --css / --no-css
  --extras <list|none>
  --pm <npm|pnpm|yarn|bun>                  # override การตรวจจับ (หัวข้อ 12)
  --install / --no-install
  --git / --no-git
  --yes, -y                                 # ใช้ default (ตาราง 6.1) กับทุกคำถามที่ไม่ได้ส่ง flag
  --help, -h
  --version, -v
```

`--help` ต้องแสดงทุก flag ข้างบนพร้อมค่าที่รับและ default (ไม่นับ alias ที่ระบุว่าซ่อน)

### 6.3 กฎการตรวจสอบ flag

**ค่าผิดรูปแบบ:** ค่าที่ไม่อยู่ในรายการ (เช่น `--browser edge`) → error ข้อความชัดเจนพร้อมรายการค่าที่ถูกต้อง แล้ว `exit 1` ไม่ถามต่อ

**ชุด flag ที่เป็นไปไม่ได้ → error (`exit 1`)** เพื่อไม่ให้ generate ผิดจากที่ผู้ใช้สั่งโดยเงียบๆ:

- `--type content-only` ร่วมกับ `--features` หรือ `--extras`
- `--features` มี `sidepanel` แต่ browser ที่เลือกมีแค่ `safari`
- `--features` มี `dnr` ขณะที่มี target ที่เป็น MV2 (จนกว่าจะ verify ตามหัวข้อ 3 ข้อ 4)
- `--extras` มี `contextmenu`, `commands` หรือ `omnibox` แต่ไม่มี `background` ใน features
- `--world MAIN` ขณะที่มี target ที่เป็น MV2

**ชุด flag ที่ไม่มีผล → warning แล้วเดินต่อ (ไม่ error):**

- `--firefox-mv` โดยไม่ได้เลือก firefox, `--safari-mv` โดยไม่ได้เลือก safari
- `--matches`, `--run-at`, `--world`, `--css`/`--no-css` ขณะที่ไม่มี content script (full extension ที่ไม่มี `content` ใน features)
- `--git` ขณะที่อยู่ใน git repo อยู่แล้ว

ความต่างกับ prompt: ใน prompt ตัวเลือกที่เป็นไปไม่ได้ถูก **ซ่อน** (หัวข้อ 5) แต่กับ flag ต้อง **ปฏิเสธ** เพราะผู้ใช้สั่งมาตรงๆ

### 6.4 พฤติกรรมเมื่อไม่มี TTY (CI, pipe)

- ถ้า stdin หรือ stdout ไม่ใช่ TTY และไม่ได้ส่ง `--yes` และยังมีคำถามที่ไม่ได้ตอบ → **error `exit 1` พร้อมรายการ flag ที่ขาด** ห้ามค้างรอ input
- ถ้าส่ง `--yes` ใช้ default ตามตาราง 6.1 กับทุกข้อที่ไม่ได้ส่ง
- โฟลเดอร์ปลายทางไม่ว่างและไม่ได้ส่ง `--if-exists`/`--overwrite` ในโหมดนี้ → `cancel` (error) เพราะปลอดภัยที่สุด
- การตรวจ package manager ในโหมดนี้ **ไม่ถามเพิ่ม** ใช้ผลที่ตรวจได้ แล้วพิมพ์บรรทัดแจ้งว่าใช้ตัวไหนและมาจากสัญญาณอะไร (ดูหัวข้อ 12)

---

## 7. โครงสร้างของ CLI (repo ที่ต้องสร้าง)

```
web-extension/                   # repo เดิม ถ้ามีไฟล์/โฟลเดอร์ที่ต่างจากนี้ให้ยึดของเดิมแล้วบันทึกใน NOTES.md
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── README.md                    # หัวข้อ 15
├── src/
│   ├── index.ts                 # entry: parse flags, เรียก prompts, เรียก generate
│   ├── cli/
│   │   ├── args.ts              # parse flags (ใช้ node:util parseArgs ได้ ไม่ต้องลง dependency เพิ่ม)
│   │   ├── prompts.ts           # flow ของ @clack/prompts
│   │   └── context.ts           # type ของ answers ทั้งหมด
│   ├── generate/
│   │   ├── index.ts             # orchestrator
│   │   ├── manifest.ts          # สร้าง manifest object ต่อ target (หัวข้อ 9)
│   │   ├── copy.ts              # copy template + แทนค่า placeholder
│   │   ├── pkgjson.ts           # ประกอบ package.json ของโปรเจกต์ที่ generate
│   │   ├── tsconfig.ts          # ประกอบ tsconfig/jsconfig (หัวข้อ 10)
│   │   └── targets.ts           # นิยาม target id และ capability matrix
│   └── utils/
│       ├── pm.ts                # ตรวจ package manager (หัวข้อ 12)
│       ├── validate.ts
│       └── exec.ts              # รัน install / git init
├── templates/                   # ถูกแพ็กไปกับ npm package (ต้องอยู่ใน "files")
│   ├── base/                    # ไฟล์ที่ทุกโปรเจกต์ได้
│   ├── ts/                      # ไฟล์ที่มีเฉพาะ TS
│   ├── js/                      # ไฟล์ที่มีเฉพาะ JS
│   └── features/
│       ├── background/{ts,js}/
│       ├── content/{ts,js}/
│       ├── popup/{ts,js}/
│       ├── options/{ts,js}/
│       ├── sidepanel/{ts,js}/
│       ├── dnr/                 # rules.json (ไม่ขึ้นกับภาษา)
│       ├── devtools/{ts,js}/
│       ├── newtab/{ts,js}/
│       └── extras/{contextmenu,commands,omnibox,storage}/{ts,js}/
└── test/
    └── generate.test.ts         # หัวข้อ 16
```

### package.json ของ CLI

- `"type": "module"`
- `"name": "web-extension"`
- `"bin": { "web-extension": "./dist/index.js" }` (ถ้า repo เดิมใช้ path อื่น เช่น `bin/` ให้ยึดของเดิม)
- `"files": ["dist", "templates"]`
- `"engines": { "node": ">=20" }`
- dependencies: `@clack/prompts`, และตัวช่วยเล็กๆ ถ้าจำเป็นจริง (เช่น `picocolors`) เท่านั้น
- devDependencies: `typescript`, `tsup`, `@types/node`, `vitest` (**ยกเว้น** ถ้า repo เดิมมีตัว build/test อยู่แล้ว ให้ใช้ตัวเดิมตามหัวข้อ 0.1 ข้อ 5)
- build ด้วย `tsup` เป็น ESM เป้า `node20` ใส่ shebang `#!/usr/bin/env node` ที่บรรทัดแรกของ `src/index.ts`
- `scripts`: `build`, `dev` (tsup --watch), `test`, `typecheck`

### ข้อควรระวังเรื่อง template

- **npm ตัดไฟล์ชื่อ `.gitignore` ตอน publish** ให้เก็บใน template เป็น `_gitignore` แล้ว rename เป็น `.gitignore` ตอน copy
- ใช้ placeholder แบบ `{{name}}`, `{{description}}` แทนด้วย string replace ธรรมดา ห้ามเขียน engine เอง
- **ห้ามสร้าง manifest ด้วย string template** ให้สร้างเป็น object ใน `manifest.ts` แล้ว serialize เพื่อกัน JSON พัง
- ไฟล์ template ที่เป็น TS/JS ให้เก็บทั้งสองเวอร์ชันแยกกันตรงๆ (ไม่ใช้ตัวแปลง TS→JS ตอน generate เพราะจะเสีย comment/format)

---

## 8. Capability matrix

`targets.ts` ต้องเป็นแหล่งความจริงเดียว

target id = `<browser>-mv<n>` ได้แก่ `chrome-mv3`, `firefox-mv3`, `firefox-mv2`, `safari-mv3`, `safari-mv2`

key ของ browser คือ `chrome` / `firefox` / `safari` (ตรงกับค่าของ `--browser`) โดย `chrome` ครอบคลุมทุก browser ตระกูล Chromium (Chrome, Edge, Brave, Opera) และ script ที่ generate ใช้ชื่อตาม key เช่น `dev:chrome`, `build:firefox`

| ฟีเจอร์ | chrome-mv3 | firefox-mv3 | firefox-mv2 | safari-mv3 | safari-mv2 |
|---|---|---|---|---|---|
| background | `service_worker` | `scripts` | `scripts` (`persistent:false`) | ตรวจเอง (หัวข้อ 3) | `scripts` |
| content script | ใช่ | ใช่ | ใช่ (IIFE) | ใช่ | ใช่ (IIFE) |
| popup | `action` | `action` | `browser_action` | `action` | `browser_action` |
| options | `options_ui` | `options_ui` | `options_ui` | `options_ui` | `options_ui` |
| side panel | `side_panel` + permission `sidePanel` | `sidebar_action` | `sidebar_action` | ไม่รองรับ | ไม่รองรับ |
| DNR | ใช่ | ใช่ | ตรวจเอง | ตรวจเอง | ตรวจเอง |
| devtools page | `devtools_page` | `devtools_page` | `devtools_page` | ตรวจเอง | ตรวจเอง |
| new tab | `chrome_url_overrides.newtab` | เหมือนกัน | เหมือนกัน | ตรวจเอง | ตรวจเอง |
| `world: MAIN` ใน content script | ใช่ | ตรวจเอง | ไม่รองรับ | ตรวจเอง | ไม่รองรับ |

ช่อง "ตรวจเอง" = ให้ตรวจจากเอกสารทางการของ browser นั้น (MDN browser-compat-data, เอกสาร Apple) แล้วบันทึกผลใน `NOTES.md` ถ้ายังไม่ชัดเจนให้ **ปฏิบัติเหมือนไม่รองรับ** (ข้ามฟีเจอร์ใน manifest ของ target นั้น พร้อมพิมพ์ warning ตอน generate)

---

## 9. กฎการสร้าง manifest

สร้างใน `generate/manifest.ts` เป็นฟังก์ชัน `buildManifest(ctx, targetId): Manifest` ที่คืน object ล้วน

### ส่วนที่เหมือนกันทุก target

```jsonc
{
  "name": "{{name}}",
  "version": "0.0.1",
  "description": "{{description}}",
  "icons": { "16": "icons/16.png", "48": "icons/48.png", "128": "icons/128.png" }
}
```

- ไฟล์ icon: สร้างพื้นสีเรียบ 3 ขนาดด้วยสคริปต์ครั้งเดียว (ใช้ `node:zlib` เขียน PNG เอง) แล้ว commit ไว้ใน `templates/base/public/icons/`
- ห้ามใส่ permission ที่ไม่ได้ใช้ ให้เติมตามฟีเจอร์ที่เลือกเท่านั้น:
  - `storage` ← extra `storage`
  - `contextMenus` ← extra `contextmenu`
  - `declarativeNetRequest` (+ `declarativeNetRequestFeedback` ห้ามใส่เว้นแต่ต้องใช้) ← feature `dnr`
  - `sidePanel` ← feature `sidepanel` บน chrome
  - `host_permissions` (MV3) ← ใส่เมื่อมี DNR (ต้องมี host ที่ rule ใช้) ค่าเริ่มต้น `["<all_urls>"]` พร้อมคอมเมนต์ใน README ว่าควรแคบลง

### MV3 (chrome, firefox, safari)

- `manifest_version: 3`
- background: ดูตาราง (หัวข้อ 8) chrome ใช้ `{ "service_worker": "src/background/index.ts", "type": "module" }`
- firefox-mv3 ต้องมี `browser_specific_settings.gecko`:
  - `id`: `{{slug}}@example.com` (placeholder และต้องบอกใน README ว่าต้องเปลี่ยนก่อน publish)
  - `strict_min_version`: ตรวจจาก MDN ว่า MV3 + ฟีเจอร์ที่ใช้ต้องการเวอร์ชันขั้นต่ำเท่าไรแล้วใส่ ห้ามเดาตัวเลข
- `web_accessible_resources` แบบ MV3 (array ของ object `{resources, matches}`) ใส่เมื่อจำเป็นเท่านั้น

### MV2 (firefox, safari)

- `manifest_version: 2`
- `browser_action` แทน `action`
- host patterns ย้ายไปอยู่ใน `permissions`
- `web_accessible_resources` เป็น array ของ string
- `background: { "scripts": [...], "persistent": false }`
- firefox-mv2 ต้องมี `browser_specific_settings.gecko.id` เช่นกัน
- ไม่มี `declarativeNetRequest` (ตามหัวข้อ 3 ข้อ 4 จนกว่าจะ verify)

### Content scripts

```jsonc
"content_scripts": [{
  "matches": ["<จาก prompt>"],
  "js": ["src/content/index.ts"],      // หรือ .js
  "css": ["src/content/style.css"],    // ใส่เมื่อเลือก css
  "run_at": "<จาก prompt>",
  "world": "ISOLATED"                  // ใส่เฉพาะ MV3 และเมื่อเป็น MAIN ให้ใส่ "MAIN"
}]
```

ใน crxjs ให้ชี้ path เป็นไฟล์ source (`.ts`) ตรงๆ plugin จะ resolve เอง สำหรับ MV2 helper ของเราต้องแปลง path เป็นไฟล์ output ตอน emit manifest

### DNR

```jsonc
"declarative_net_request": {
  "rule_resources": [{ "id": "ruleset_1", "enabled": true, "path": "rules/rules.json" }]
}
```

- `rules.json` อยู่ที่ `public/rules/rules.json` (ไม่ผ่าน bundler)
- ตัวอย่างกฎเริ่มต้น: 1 rule block request ไปที่ `*://example.invalid/*` (โดเมน `.invalid` จะไม่ชนกับเว็บจริง) พร้อมคอมเมนต์ใน README อธิบายว่าต้องแก้เอง

---

## 10. Types และ tsconfig / jsconfig

### ชุด type ที่ต้องลง (devDependencies) ตาม browser ที่เลือก

| browser ที่เลือก | package | namespace ที่ได้ |
|---|---|---|
| Chromium | `@types/chrome` | `chrome.*` |
| Firefox | `@types/firefox-webext-browser` | `browser.*` |
| Safari | `@types/chrome` (Safari รองรับทั้ง `chrome` และ `browser`) ถ้าเลือก Safari อย่างเดียวและโค้ดตัวอย่างใช้ `browser.*` ให้พิจารณา `@types/firefox-webext-browser` แทน **ให้ตรวจแล้วบันทึกผล** | |

- ถ้าเลือก **หลาย browser** ให้ลงทั้งสองชุดได้ เพราะ namespace คนละชื่อ (`chrome` กับ `browser`) ไม่ชนกัน
- ลง `@crxjs/vite-plugin` เสมอเมื่อมี target MV3 อย่างน้อยหนึ่งตัว
- ลง `web-ext` เมื่อเลือก Firefox (ใช้รัน `run:firefox`)
- **เวอร์ชันของทุก package ต้องมาจาก `npm view` ตอนพัฒนา แล้วเขียนเป็น caret range ใน `generate/pkgjson.ts`** ห้ามเขียนจากความจำ

### โค้ดตัวอย่างต้องเรียก API ผ่าน helper เดียว

สร้าง `src/lib/browser.(ts|js)`:

```ts
// ถ้าเลือกหลาย browser หรือ Firefox: ใช้ตัวที่มี
export const api: typeof chrome =
  (globalThis as any).browser ?? (globalThis as any).chrome;
```

ถ้าเลือก Chromium อย่างเดียว ให้ export `chrome` ตรงๆ ทุก template (background, popup ฯลฯ) import `api` จากไฟล์นี้ ห้ามเรียก `chrome.*` ตรงๆ ใน template เพื่อให้เปลี่ยน browser ภายหลังได้ง่าย

### tsconfig (เฉพาะ TS)

ใช้ project references เพราะ service worker ต้องการ lib `WebWorker` ซึ่งชนกับ `DOM`

```
tsconfig.json              # references ไปสองตัวล่าง, "files": []
tsconfig.app.json          # lib: ["ES2022","DOM","DOM.Iterable"], include: src ทั้งหมด ยกเว้น src/background
tsconfig.background.json   # lib: ["ES2022","WebWorker"], include: src/background และ src/lib
tsconfig.node.json         # สำหรับ vite.config.ts, manifest.config.ts, build/*
```

- ทุกไฟล์ `strict: true`, `noEmit: true`, `moduleResolution: "bundler"`, `target: "ES2022"`, `isolatedModules: true`, `skipLibCheck: true`
- `types` ของ app/background: ใส่เฉพาะที่เลือกตามตารางด้านบน เช่น `["chrome"]` หรือ `["chrome","firefox-webext-browser"]`
- ถ้า target ที่เลือกมี Firefox (background เป็น page ที่มี DOM) ให้ยังใช้ `tsconfig.background.json` ได้ แต่ใส่ `DOM` เพิ่มใน lib ของ background ด้วย **ถ้ามี firefox ใน targets** เพื่อไม่ให้ error
- สร้าง `src/env.d.ts` ที่มี `/// <reference types="vite/client" />` และ `/// <reference types="@crxjs/vite-plugin/client" />` (ตัวหลังเฉพาะเมื่อมี target MV3)
- script `typecheck`: `tsc -b`

### jsconfig (เฉพาะ JS)

- สร้าง `jsconfig.json` ที่ `checkJs: true`, `module/moduleResolution` แบบ bundler, `types` เหมือน TS
- ลง `typescript` เป็น devDependency และ script `typecheck`: `tsc -p jsconfig.json --noEmit`
- ใส่ JSDoc type ในตัวอย่างโค้ดทุกจุดที่จำเป็น เพื่อให้ editor ได้ autocomplete จาก `@types/*`

---

## 11. Vite config และ pipeline ที่โปรเจกต์ generate ต้องมี

### โครงไฟล์ระดับ root ของโปรเจกต์ที่ generate

```
my-extension/
├── package.json
├── vite.config.(ts|js)
├── manifest.config.(ts|js)     # เรียก buildManifest ของโปรเจกต์ (สำเนาตรรกะที่ generate แล้วเป็นโค้ดที่ user แก้ได้)
├── targets.config.(ts|js)      # รายการ target ที่เลือก เช่น [{browser:'firefox', mv:2}, ...]
├── build/mv2.(ts|js)           # สร้างเฉพาะเมื่อมี target MV2
├── public/                     # icons/, rules/
├── src/
│   ├── lib/browser.(ts|js)
│   ├── background/index.(ts|js)
│   ├── content/index.(ts|js) + style.css
│   ├── popup/{index.html, main.(ts|js), style.css}
│   ├── options/{index.html, main.(ts|js), style.css}
│   ├── sidepanel/{index.html, main.(ts|js), style.css}
│   ├── devtools/{devtools.html, devtools.(ts|js), panel.html?}
│   └── newtab/{index.html, main.(ts|js), style.css}
├── .gitignore
└── README.md
```

สร้างเฉพาะโฟลเดอร์ของฟีเจอร์ที่เลือก

### การเลือก target ด้วย mode

- mode = target id (`chrome-mv3`, `firefox-mv3`, `firefox-mv2`, ...)
- `vite.config` อ่าน `mode` → หา target → ถ้า `mv === 3` ใช้ `crx({ manifest, browser: browser === 'firefox' ? 'firefox' : 'chrome' })` ถ้า `mv === 2` เรียก `build/mv2`
- `outDir`: `dist/<target id>`
- manifest สร้างจากฟังก์ชันที่รับ target id ใช้ `defineManifest` ของ crxjs ในกรณี MV3

**ตัวอย่างโครง (pseudo ห้ามคัดลอกไปใช้โดยไม่ตรวจ option กับเวอร์ชันจริง):**

```ts
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { getTarget } from './targets.config';
import { buildManifest } from './manifest.config';

export default defineConfig(({ mode }) => {
  const target = getTarget(mode);
  const manifest = buildManifest(target);
  return {
    build: { outDir: `dist/${target.id}`, emptyOutDir: true },
    plugins: target.mv === 3
      ? [crx({ manifest, browser: target.browser === 'firefox' ? 'firefox' : 'chrome' })]
      : [/* build/mv2 plugin */],
  };
});
```

### scripts ใน package.json ของโปรเจกต์ที่ generate

สำหรับทุก browser ที่เลือก สร้างชุด:

- `dev:<browser>` → `vite --mode <target id>` (MV2 หรือ Firefox ที่ HMR ใช้ไม่ได้ → `vite build --watch --mode <target id>`)
- `build:<browser>` → `vite build --mode <target id>`
- Firefox เพิ่ม `run:firefox` → `web-ext run --source-dir dist/<target id>`
- `typecheck`
- `dev` และ `build` เป็น alias ชี้ไป browser แรกที่เลือก
- `build:all` เมื่อเลือกมากกว่า 1 browser (รันต่อกันด้วย `&&` เพื่อให้ทำงานบน Windows ได้ ห้ามใช้ `npm-run-all` โดยไม่จำเป็น)

---

## 12. ขั้นตอนการ generate (algorithm)

1. รวบรวม answers จาก flags + prompts → `Context`
2. ตรวจ/จัดการโฟลเดอร์ปลายทาง (empty / overwrite / merge)
3. คำนวณรายการ target จาก browsers + MV ที่เลือก
4. copy `templates/base` → copy `templates/<lang>` → copy `templates/features/<f>/<lang>` ตามที่เลือก (ฟีเจอร์ที่ไม่มีเวอร์ชันภาษานั้นให้ error ระหว่างพัฒนา ไม่ใช่ตอนรัน)
5. แทน placeholder, rename `_gitignore`
6. เขียน `package.json`, tsconfig/jsconfig, `targets.config`, `manifest.config`, `vite.config` จาก generator (ไม่ใช่ template ตายตัว)
7. เขียน `README.md` ของโปรเจกต์ที่ generate โดยมีเฉพาะส่วนที่เกี่ยวกับ browser ที่เลือก
8. (ถ้าเลือก) git init → install dependencies ด้วย package manager ที่ตรวจเจอ แสดง `p.spinner()`
9. พิมพ์ `p.outro` พร้อม next steps ที่ใช้คำสั่งตาม package manager (`cd <dir>`, `<pm> run dev:<browser>`) และวิธีโหลด extension ของแต่ละ browser

### การตรวจ package manager (สเปกของ `utils/pm.ts`)

เป้าหมาย: ผู้ใช้รันผ่าน `bunx` ต้องได้ `bun`, รันผ่าน `pnpm dlx` ต้องได้ `pnpm` ฯลฯ และต้องจัดการกรณีที่ผู้ใช้ **ติดตั้ง CLI แบบ global** แล้วเรียก `web-extension init` ตรงๆ ด้วย

**ที่มาของปัญหา:** ตอนรันผ่าน `npx`, `pnpm dlx`, `yarn dlx`, `bunx` หรือ `bun x` ตัว package manager มักตั้ง environment variable `npm_config_user_agent` ให้ แต่ตอนรัน global bin จาก shell ตรงๆ ไม่มีตัวกลางมาตั้งค่านี้ ต้องหาสัญญาณอื่นแทน (ข้อความนี้เป็นสมมติฐาน ให้พิสูจน์ด้วยการรันจริงตามหัวข้อ "ต้องตรวจเองก่อนเขียนโค้ด" ด้านล่าง)

#### ชนิดข้อมูล

```ts
type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

type PmSource =
  | 'flag' | 'user-agent' | 'package-json' | 'lockfile'
  | 'global-path' | 'runtime' | 'prompt' | 'default';

interface PmResult {
  name: PackageManager;
  source: PmSource;
  confident: boolean; // false = ควรถามผู้ใช้ (ถ้ามี TTY)
}
```

เขียน `detectPackageManager(input): PmResult` ให้รับ `{ flag, env, argv1, cwd, targetDir, versions, fs }` เป็น parameter เพื่อให้ทดสอบได้โดยไม่ต้องรัน package manager จริง

#### ลำดับสัญญาณ (หยุดที่ตัวแรกที่ตรวจเจอ)

| ลำดับ | สัญญาณ | ผลลัพธ์ | confident |
|---|---|---|---|
| 1 | `--pm <name>` | ตามที่ส่งมา | ใช่ |
| 2 | `process.env.npm_config_user_agent` ขึ้นต้นด้วย `npm/`, `pnpm/`, `yarn/` หรือ `bun/` | ตามนั้น (ครอบคลุม `npx`, `pnpm dlx`, `yarn dlx`, `bunx`, `bun x`) | ใช่ |
| 3 | field `packageManager` ใน `package.json` ที่ใกล้ที่สุด เริ่มจากโฟลเดอร์ปลายทางแล้วไล่ขึ้น parent (รูปแบบ corepack `name@version`, รับเฉพาะ 4 ชื่อข้างบน) | ตามนั้น | ใช่ |
| 4 | lockfile ในโฟลเดอร์ปลายทาง แล้วไล่ขึ้น parent จนถึง root ของ git repo หรือ root ของ filesystem เจอโฟลเดอร์แรกที่มี lockfile ให้หยุด | `bun.lock`/`bun.lockb` → bun, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `package-lock.json`/`npm-shrinkwrap.json` → npm | ใช่ ถ้ามี lockfile เดียวในโฟลเดอร์นั้น, **ไม่** ถ้ามีหลายชนิดปนกัน (เลือกตามลำดับ bun, pnpm, yarn, npm แล้ว `confident: false`) |
| 5 | **ติดตั้งแบบ global:** `fs.realpathSync(process.argv[1])` แล้วแปลง `\` เป็น `/` และเทียบแบบไม่สนตัวพิมพ์กับ pattern ของ global directory ของแต่ละตัว | ตัวที่ pattern ตรง | **ไม่** (ติดตั้ง CLI ด้วยตัวไหนไม่ได้แปลว่าโปรเจกต์ใช้ตัวนั้น จึงถามยืนยัน โดยตั้ง default เป็นตัวที่เดาได้) |
| 6 | `process.versions.bun` มีค่า (รันภายใต้ runtime ของ Bun) | bun | ไม่ |
| 7 | ไม่มีสัญญาณเลย (รวมถึง global ของ npm ที่ path ไม่ต่างจาก node_modules ทั่วไป) | npm | ไม่ |

หมายเหตุ:

- ข้อ 2 อยู่เหนือข้อ 3 - 4 ตามที่ผู้ใช้ต้องการ: ถ้าผู้ใช้เรียกผ่าน `bunx` ให้ได้ bun แม้ parent มี `pnpm-lock.yaml`
- ห้ามเปลี่ยน shebang ของ `dist/index.js` เป็น `#!/usr/bin/env bun` เพราะผู้ใช้ที่ไม่มี Bun จะรันไม่ได้ ให้คง `#!/usr/bin/env node` (ซึ่งหมายความว่าสัญญาณข้อ 6 จะพบได้น้อย ถ้ายืนยันจากการทดสอบว่า `bunx` รัน script ด้วย node)
- ข้อ 5 pattern เริ่มต้นที่ **ต้องพิสูจน์ก่อนใช้** (ห้ามคัดลอกไปใช้โดยไม่ตรวจ): bun → `/.bun/install/global/`, pnpm → `/pnpm/global/`, yarn (classic) → `/yarn/global/` หรือ `/.config/yarn/global/` (Windows ใช้ path คนละแบบ) ส่วน npm ไม่มี pattern เฉพาะ

#### UX เมื่อตรวจได้แล้ว

- ทุกครั้งให้พิมพ์บรรทัดเดียว เช่น `p.log.info('Using bun (detected from user agent)')` โดยแปลง `source` เป็นข้อความที่คนอ่านรู้เรื่อง
- ถ้า `confident === false` และมี TTY และไม่ได้ส่ง `--pm` → ถามคำถามข้อ 9a (`select` 4 ตัวเลือก ตั้ง `initialValue` เป็นผลที่เดาได้)
- ถ้า `confident === false` และไม่มี TTY หรือใช้ `--yes` → ใช้ผลที่เดาได้ต่อเลย แต่ต้องพิมพ์บรรทัดแจ้งพร้อมบอกว่าใช้ `--pm` เพื่อเปลี่ยนได้
- ผลที่ได้ใช้กับ 3 อย่าง: คำสั่ง install, คำสั่ง run script ใน next steps (outro) และข้อความใน README ที่ generate

#### คำสั่งตาม package manager

| | install | run script (ใน next steps) |
|---|---|---|
| npm | `npm install` | `npm run <script>` |
| pnpm | `pnpm install` | `pnpm <script>` |
| yarn | `yarn` (ใช้ได้ทั้ง classic และ berry) | `yarn <script>` |
| bun | `bun install` | `bun run <script>` |

- ก่อน install ให้เช็กว่า package manager ที่เลือกมีอยู่ใน PATH จริง (รัน `<pm> --version`) ถ้าไม่มี → warning, ข้ามขั้น install, และพิมพ์คำสั่งให้ผู้ใช้รันเอง (ห้าม fallback ไปใช้ npm เองโดยไม่บอก)
- Windows: `npm`, `pnpm`, `yarn`, `bun` อาจเป็นไฟล์ `.cmd` ต้องเรียกผ่าน `cross-spawn` หรือ `spawn` แบบ `shell: true` อย่างปลอดภัย (ส่ง argument แบบ array ไม่ต่อ string จากข้อมูลผู้ใช้) ให้ทดสอบบน Windows จริง
- ถ้า install ล้มเหลว ห้ามลบโปรเจกต์ที่ generate แล้ว ให้ warning และบอกให้ user ลงเองด้วยคำสั่งที่พิมพ์ให้

#### ต้องตรวจเองก่อนเขียนโค้ด (บันทึกผลเป็นตารางใน `NOTES.md`)

รัน CLI เวอร์ชันทดลองที่พิมพ์ค่าต่อไปนี้ออกมา: `process.env.npm_config_user_agent`, `process.argv[1]`, `fs.realpathSync(process.argv[1])`, `process.versions.bun`, `process.execPath` ในทุกวิธีรันดังนี้ และถ้าทำได้ให้ทดสอบทั้ง Linux/macOS และ Windows:

1. `npx web-extension`
2. `pnpm dlx web-extension`
3. `yarn dlx web-extension` (Yarn 2+)
4. `bunx web-extension`
5. `bun x web-extension`
6. ติดตั้ง global ด้วย `npm i -g`, `pnpm add -g`, `bun add -g`, `yarn global add` (classic) แล้วเรียก `web-extension init` ตรงๆ

จากผลที่ได้ให้ยืนยันหรือแก้: (ก) `bunx` และ `bun x` ตั้ง `npm_config_user_agent` เป็น `bun/...` จริงไหม (ข) pattern ของ global path ของแต่ละตัวในแต่ละ OS (ค) `bunx` รัน CLI ด้วย node หรือ bun ถ้าผลต่างจากสมมติฐานในหัวข้อนี้ **ให้แก้ตาราง "ลำดับสัญญาณ" ตามผลจริง และลงรายการในไฟล์ `NOTES.md`** ห้ามเดาต่อ

### วิธีโหลด extension (ใส่ใน outro และ README ที่ generate)

- Chromium: `chrome://extensions` → Developer mode → Load unpacked → เลือก `dist/chrome-mv3`
- Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → เลือก `manifest.json` ใน dist หรือใช้ `run:firefox`
- Safari: ต้องมี Xcode แล้วรัน `xcrun safari-web-extension-converter dist/<target id>` (แค่บอกวิธี ไม่ต้องรันให้)

---

## 13. เนื้อหาของ template แต่ละฟีเจอร์ (ให้ minimal และรันได้จริง)

ทุกไฟล์ต้องสั้น มีคอมเมนต์อธิบายเฉพาะจุดที่ต้องรู้ ไม่มีโค้ดที่ไม่ได้ใช้

- **background**: ลงทะเบียน `api.runtime.onInstalled` พิมพ์ log และถ้ามี extra ก็เพิ่ม handler ของ extra นั้นไฟล์เดียวกัน (ต้องไม่ใช้ API ที่ไม่มีใน target ที่เลือก)
- **content script (full extension)**: log ว่าโหลดแล้ว + ตัวอย่างส่ง message ไป background ถ้ามี background
- **content script (content-only)**: ตัวอย่าง hack DOM ใช้ได้จริงโดยไม่พึ่งหน้าเว็บของเรา:
  - รอ DOM พร้อมแล้วเพิ่ม element/สไตล์เล็กๆ
  - ใช้ `MutationObserver` ดักเนื้อหาที่โหลดทีหลัง พร้อมคอมเมนต์วิธีหยุด observer
  - ถ้าเลือก css ให้ `import './style.css'` (ตรวจว่า crxjs รองรับวิธี import นี้กับเวอร์ชันที่ลง หรือใช้ `css` ใน manifest แทน)
- **popup / options / sidepanel / newtab**: HTML + entry script + CSS หน้าละไม่เกิน ~30 บรรทัด ไม่ใช้ framework (ดูหัวข้อ 17)
- **devtools**: `devtools.html` + script ที่เรียก `api.devtools.panels.create(...)` และ `panel.html`
- **dnr**: `public/rules/rules.json` ตามหัวข้อ 9
- **extras/storage**: `get/set` แบบ async พร้อม type
- **extras/contextmenu, commands, omnibox**: ตัวอย่าง handler 1 อันต่อ extra

---

## 14. ข้อควรระวังทางเทคนิค (ที่มักผิดถ้าไม่ระบุ)

1. content script ใน MV3 ของ crxjs ชี้เป็นไฟล์ `.ts` ใน manifest ได้ แต่ MV2 helper ต้อง build เป็น IIFE แยกไฟล์ ห้าม share chunk กับ background
2. `background` ของ Chromium เป็น service worker: ห้ามใช้ `window`, `document`, `localStorage` ใน template
3. Firefox ต้องมี `browser_specific_settings.gecko.id` ทั้ง MV2 และ MV3 ถ้าไม่มีจะลง/publish ไม่ได้
4. `side_panel` ใช้ได้เฉพาะ Chromium (ต้องเรียก `chrome.sidePanel.setPanelBehavior` ถ้าอยากให้เปิดจาก action) Firefox ใช้ `sidebar_action` คนละ key กัน ต้อง generate manifest คนละแบบ
5. Windows: path ใน manifest ต้องใช้ `/` เสมอ ใช้ `path.posix` ตอนประกอบ path ที่ลง manifest
6. ห้ามใช้คำสั่ง shell แบบ Unix เฉพาะ (`rm -rf`, `cp`) ใน scripts ของโปรเจกต์ที่ generate เพราะต้องรันบน Windows ได้ ถ้าต้องล้าง `dist` ใช้ `emptyOutDir` ของ Vite
7. ตรึงช่วงเวอร์ชัน `vite` ให้ตรงกับ peer dependency ของ crxjs (ตรวจด้วย `npm view`) ห้ามใช้ `latest` ตรงๆ
8. หลัง generate ต้อง `vite build --mode <ทุก target>` ผ่านโดยไม่มี error ของ manifest (ดูหัวข้อ 16)

---

## 15. README ที่ต้องเขียน

### README ของ CLI (`web-extension/README.md`, แก้ไฟล์เดิมใน repo ไม่ใช่เขียนใหม่ทั้งหมด)

ต้องมีหัวข้อ **Usage** ที่แสดงทุกวิธีรันดังนี้ และ **ต้องมีทั้ง `bunx` และ `bun x`** พร้อมหมายเหตุว่าบน Windows บางเครื่องคำสั่ง `bunx` ใช้ไม่ได้ ให้ใช้ `bun x` แทน (ทั้งสองทำสิ่งเดียวกัน)

````md
## Usage

```bash
# npm
npx web-extension@latest init

# pnpm
pnpm dlx web-extension@latest init

# yarn
yarn dlx web-extension@latest init

# bun
bunx web-extension@latest init
bun x web-extension@latest init

# หรือติดตั้งแบบ global
npm install -g web-extension
web-extension init
```

> **Windows + Bun:** บางเครื่องไม่มีคำสั่ง `bunx` ให้ใช้ `bun x web-extension@latest init` แทน
> (`bunx` เป็น alias ของ `bun x`)
````

- `yarn dlx` ใช้ได้เฉพาะ Yarn 2 ขึ้นไป ให้ใส่หมายเหตุนี้ใน README (Yarn 1 ใช้ `npx`)
- ห้ามใส่ `npm create web-extension` / `bun create web-extension` ใน README จนกว่าจะมี package `create-web-extension` จริง (ดูหัวข้อ 0.1 และ 18)

ส่วนอื่นของ README:

- คำอธิบายสั้นๆ ว่าทำอะไร และ browser/MV ที่รองรับ
- รายการ prompt ทั้งหมด และตาราง flags ที่จับคู่กับทุก prompt (หัวข้อ 6.1) พร้อมกฎ error/warning ของ flag และพฤติกรรมเมื่อไม่มี TTY (หัวข้อ 6.3 - 6.4)
- ส่วนอธิบายการตรวจ package manager: ลำดับสัญญาณ, กรณีติดตั้งแบบ global, และวิธี override ด้วย `--pm` (หัวข้อ 12)
- ตัวอย่างคำสั่ง non-interactive 2 - 3 แบบ (chrome ts, firefox mv2 js, content-only)
- ระบุว่า `web-extension` เฉยๆ เท่ากับ `web-extension init`
- ตารางว่าฟีเจอร์ไหนรองรับ browser/MV ไหน (ตาม capability matrix)
- ข้อจำกัดที่ทราบ (เช่น Firefox dev ไม่มี HMR ถ้ายืนยันแล้วว่าเป็นเช่นนั้น, Safari ต้องแปลงด้วย Xcode)
- วิธีพัฒนา CLI เอง (`install`, `build`, `test`, ลองรันด้วย `node dist/index.js`)

### README ของโปรเจกต์ที่ generate

- ชื่อโปรเจกต์ และ scripts ที่มีจริงเท่านั้น
- วิธีโหลด extension ตาม browser ที่เลือก (หัวข้อ 12)
- โครงโฟลเดอร์
- สิ่งที่ต้องแก้ก่อน publish (gecko id, `host_permissions`, ชื่อ/คำอธิบาย/icon)

---

## 16. แผนทดสอบและเกณฑ์ผ่าน

ใช้ `vitest` สำหรับ unit test และสคริปต์ smoke test ที่รัน CLI จริงแบบ `--yes`

### Unit test

- `manifest.ts`: ทุก target id × ชุดฟีเจอร์ที่สำคัญ (ทุกฟีเจอร์ / ไม่มีฟีเจอร์ / content-only) ต้องได้ manifest ที่:
  - `manifest_version` ตรงกับ target
  - มี key ที่ตาม capability matrix เท่านั้น (เช่น chrome ไม่มี `sidebar_action`, firefox ไม่มี `side_panel`)
  - MV2 ไม่มี `action`/`host_permissions`/`declarative_net_request`
  - firefox ทุก MV มี `browser_specific_settings.gecko.id`
- `validate.ts`: ชื่อโปรเจกต์ และ pattern ของ `matches`
- `pm.ts` (ทดสอบ `detectPackageManager` โดยส่ง env/argv/fs จำลองเข้าไป ไม่รัน package manager จริง):
  - user agent ทั้ง 4 ตัว (`npm/`, `pnpm/`, `yarn/`, `bun/`) ต้องได้ตัวนั้นและ `confident: true`
  - user agent ต้องชนะ lockfile/`packageManager` (เช่น user agent เป็น `bun/` แต่ parent มี `pnpm-lock.yaml` ต้องได้ bun)
  - `--pm` ต้องชนะทุกสัญญาณ
  - ไม่มี user agent: `packageManager` field → lockfile ทีละชนิด → หลาย lockfile ปนกัน (`confident: false`) → ไล่ขึ้น parent directory
  - global path ของ bun/pnpm/yarn ทั้ง path แบบ `/` และ `\` ต้องได้ `source: 'global-path'` และ `confident: false` (ใช้ pattern ที่ยืนยันแล้วใน `NOTES.md`)
  - ไม่มีสัญญาณเลย → npm, `confident: false`
  - ค่า user agent แปลกๆ หรือว่าง ต้องไม่ throw
- flags (`args.ts` + `prompts.ts`):
  - ส่ง flag ครบทุกข้อพร้อม `--yes` ต้องไม่เรียก prompt ใดเลย (mock `@clack/prompts` แล้ว assert ว่าไม่มีการเรียก)
  - ส่ง flag บางข้อ ต้องข้ามเฉพาะข้อนั้นและยังถามข้อที่เหลือที่เข้าเงื่อนไข (เช่น `--browser firefox` ต้องยังถามข้อ 5 ถ้าไม่ส่ง `--firefox-mv`)
  - `--browser chrome,firefox` และ `--browser chrome --browser firefox` ต้องให้ผลเท่ากัน, `chromium` ต้องเป็น alias ของ `chrome`, ค่าซ้ำต้องไม่ error
  - ค่านอกรายการต้อง error `exit 1` พร้อมรายการค่าที่ถูกต้อง
  - ชุด flag ที่เป็นไปไม่ได้ทุกข้อในหัวข้อ 6.3 ต้อง error และชุดที่ไม่มีผลต้อง warning
  - ไม่มี TTY และไม่มี `--yes` และมีคำถามค้าง ต้อง error พร้อมรายการ flag ที่ขาด ไม่ค้างรอ input
  - `--help` ต้องแสดงทุก flag ในหัวข้อ 6.2
- `args.ts`: `web-extension my-app --yes` ต้องได้ผลเหมือน `web-extension init my-app --yes`, argument แรกที่เป็นชื่อ subcommand ต้องไปที่ subcommand นั้น และ `--help`/`--version` ที่ระดับบนสุดต้องไม่เข้า `init`

### Smoke test (generate จริงลง temp dir แล้ว build)

| ชุด | flags |
|---|---|
| A | `--lang ts --browser chrome --features background,content,popup,options,sidepanel,dnr,devtools,newtab --extras contextmenu,commands,storage` |
| B | `--lang js --browser firefox --firefox-mv 2 --features background,content,popup,options` |
| C | `--lang ts --browser chrome,firefox,safari --firefox-mv 3 --safari-mv 2 --features background,content,popup` |
| D | `--lang ts --type content-only --browser chrome,firefox --matches "https://example.com/*"` |
| E | `--lang js --type content-only --browser firefox --firefox-mv 2` |

สำหรับแต่ละชุด ต้องผ่านทั้งหมดนี้:

1. generate สำเร็จ exit code 0
2. `install` สำเร็จ
3. `typecheck` ผ่าน (ทั้ง TS และ JS)
4. `build:<browser>` ผ่านทุก browser ที่เลือก
5. ไฟล์ `dist/<target id>/manifest.json` มีอยู่ และไฟล์ทุกตัวที่ manifest อ้างถึงมีอยู่จริงใน `dist` (เขียนสคริปต์ตรวจ path)
6. ชุด D และ E: ใน `dist` **ต้องไม่มี** background/popup/options/HTML ใดๆ และ manifest ไม่มี `permissions`
7. ใน `package.json` ของโปรเจกต์ที่ generate มี `@types/*` ตรงกับตารางหัวข้อ 10 เท่านั้น (ไม่ลงเกิน)

### ทดสอบแบบมือ (ให้ผู้ใช้ทำ)

- โหลด `dist/chrome-mv3` ใน Chrome และ `run:firefox` ใน Firefox แล้วเปิดหน้าเว็บที่ match ดูว่า content script ทำงาน
- ทดสอบ `npx`, `bunx` และ `bun x` บน Windows อย่างน้อยหนึ่งรอบ หลัง `npm pack` แล้วติดตั้งจาก tarball
- ทดสอบการตรวจ package manager ตามรายการ 6 วิธีรันในหัวข้อ 12 ("ต้องตรวจเองก่อนเขียนโค้ด") รวมถึงติดตั้ง global ด้วยทั้ง 4 ตัว และตรวจว่า CLI พิมพ์บรรทัด "Using <pm> (detected from ...)" ถูกต้อง และคำสั่ง install/next steps ตรงกับตัวที่เลือก

### เกณฑ์ผ่านทั้งโปรเจกต์

- smoke test A - E ผ่านทั้งหมด
- README ทั้งสองไฟล์ครบตามหัวข้อ 15 รวมถึงทั้ง `bunx` และ `bun x`
- `NOTES.md` มีผลการตรวจทุกข้อในหัวข้อ 3, 8 และตารางผลการรันจริงของหัวข้อ 12
- `QUESTIONS.md` ว่าง หรือมีเฉพาะข้อที่ผู้ใช้ต้องตัดสินใจจริง

---

## 17. นอก scope (ห้ามทำในเวอร์ชันแรก)

- UI framework **ใหม่** (เช่น Solid) และการเพิ่มตัวเลือก framework ที่ repo เดิมยังไม่มี สเปกนี้ไม่ได้ระบุเรื่อง UI framework เลย ถ้า repo เดิมรองรับ Vanilla/React/Vue/Svelte อยู่แล้วให้ **คงไว้ตามเดิม** (หัวข้อ 0.1 ข้อ 3) ถ้ายังไม่มี ให้ generate เป็น vanilla เท่านั้นและห้ามเพิ่มเอง
- CSS framework / Tailwind
- ESLint / Prettier / Husky ในโปรเจกต์ที่ generate
- การ publish ขึ้น Chrome Web Store / AMO / App Store
- การรัน `xcrun safari-web-extension-converter` แทน user ตอน init (ถ้า repo เดิมมี **npm script** ในโปรเจกต์ที่ generate ให้ user เป็นคนรันเองเพื่อแปลงเป็น Safari ให้คงไว้ได้)
- ระบบ update/upgrade โปรเจกต์ที่ generate ไปแล้ว
- i18n ของ CLI

---

## 18. คำถามที่ยังเปิดอยู่ (ถ้า implement แล้วต้องการคำตอบ ให้เขียนลง `QUESTIONS.md`)

1. อยากให้ใช้ `npm create web-extension` / `bun create web-extension` ได้ด้วยไหม ถ้าใช่ต้องทำ package แยกชื่อ `create-web-extension` (ตรวจแล้วยังว่าง) ที่เป็น wrapper เรียก `web-extension init` ตอนนี้ **ไม่ทำ** จนกว่าจะได้คำตอบ
1a. ชื่อ `web-extension` เคยถูก unpublish (8 มี.ค. 2026) ถ้า publish ไม่ได้จะใช้ชื่ออะไรแทน (เช่น scoped name) **ห้ามเลือกเอง**
2. ถ้า MV2 helper ซับซ้อนเกิน จะอนุญาตให้ใช้ `vite-plugin-web-extension` เฉพาะ MV2 ไหม
3. ต้องการให้มีตัวเลือก UI framework ในเวอร์ชันถัดไปไหม
4. Safari ต้องการให้ generate Xcode project ให้ในอนาคตไหม หรือแค่ให้คำสั่งแปลง
