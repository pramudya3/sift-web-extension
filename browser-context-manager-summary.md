# Browser Context Manager

## 1. Ringkasan

Browser Context Manager adalah aplikasi yang membantu pengguna mengurangi **overwhelm akibat terlalu banyak tab browser**.

Masalah utamanya bukan sekadar jumlah tab, tetapi banyaknya **context atau pekerjaan yang belum selesai** yang tersimpan di dalam tab.

Contoh:

> 30 tab terbuka → pengguna takut menutup tab karena mungkin masih dibutuhkan → semua tab dipertahankan → browser semakin berantakan → pengguna semakin sulit menentukan apa yang penting.

Produk ini bertujuan memutus siklus tersebut:

> **Close your tabs. Keep your context.**

Aplikasi mengubah kumpulan tab menjadi **context / workspace yang dapat disimpan, diarsipkan, dipulihkan, dan dipahami kembali**.

---

## 2. Masalah yang Diselesaikan

### Masalah utama

Pengguna internet aktif sering:

- membuka banyak tab;
- membuka tab untuk hal yang berbeda-beda;
- takut menutup tab karena takut lupa;
- lupa alasan mengapa suatu tab dibuka;
- kesulitan membedakan pekerjaan aktif dan pekerjaan yang sudah tidak relevan;
- merasa semua tab merupakan pekerjaan yang belum selesai;
- akhirnya mengalami visual clutter dan cognitive overload.

### Insight utama

Tab sering digunakan sebagai **external memory**.

Pengguna mempertahankan tab bukan karena ingin melihatnya sekarang, tetapi karena:

> "Kalau saya tutup, nanti saya lupa."

Maka produk tidak hanya perlu mengelola tab, tetapi menjaga **context di balik tab tersebut**.

---

## 3. Konsep Produk

Konsep inti:

```text
Tabs
  ↓
Context detection
  ↓
Projects / Workspaces
  ↓
Archive
  ↓
Resume later
```

Contoh:

Daripada melihat:

```text
Tab 1
Tab 2
Tab 3
...
Tab 30
```

produk mengubahnya menjadi:

```text
Research Instagram API
├── Meta API documentation
├── Instagram Login
├── Facebook Login
├── OAuth documentation
└── Related research

Client Website
├── Admin panel
├── Design reference
├── Documentation
└── Project tools

Learning
├── Tutorial
├── Documentation
└── Articles
```

---

## 4. Value Proposition

### Primary

> **Close your tabs. Keep your context.**

### Alternatif

> **Never lose your context.**

> **Turn browser chaos into organized contexts.**

> **You don't need to keep tabs open to remember them.**

Produk sebaiknya tidak diposisikan sebagai sekadar:

> "AI Tab Manager"

karena kategori tab manager sudah memiliki banyak pemain.

Positioning yang lebih kuat:

> **A memory layer for your browser.**

---

## 5. Bentuk Aplikasi

MVP sebaiknya berupa:

1. **Browser Extension**
2. **Web Dashboard**
3. **Backend / API**

Tidak perlu membuat desktop app pada tahap awal.

### Arsitektur

```text
                 CHROME / EDGE
                      │
              ┌───────▼────────┐
              │ Browser        │
              │ Extension      │
              │                │
              │ • Tab tracking │
              │ • Sessions     │
              │ • Grouping     │
              │ • Archive      │
              │ • Restore      │
              └───────┬────────┘
                      │
                      │ HTTPS
                      ▼
              ┌───────────────┐
              │ Backend       │
              │               │
              │ Context data  │
              │ User account  │
              │ AI processing │
              └───────┬───────┘
                      │
                      ▼
              ┌───────────────┐
              │ Web Dashboard │
              │               │
              │ Projects      │
              │ Archives      │
              │ Search        │
              │ AI summaries  │
              └───────────────┘
```

---

## 6. Interface

### 6.1 Extension Popup

Popup sederhana untuk aktivitas cepat.

Contoh:

```text
┌──────────────────────────────┐
│ 🧠 Context                   │
│                              │
│ 23 tabs                      │
│ 4 contexts                   │
│                              │
│ ┌──────────────────────────┐ │
│ │ 🔵 Instagram API         │ │
│ │ 8 tabs                   │ │
│ │ [Continue]               │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ 🟢 Client Project        │ │
│ │ 6 tabs                   │ │
│ │ [Continue]               │ │
│ └──────────────────────────┘ │
│                              │
│ [Clean tabs] [Dashboard]     │
└──────────────────────────────┘
```

### 6.2 Browser Side Panel

Side panel berfungsi sebagai interface utama ketika pengguna sedang bekerja.

Contoh:

```text
┌──────────────────────────────────────────────┬──────────────┐
│                                              │   CONTEXT    │
│                CURRENT WEBSITE               │              │
│                                              │ 🧠 Research  │
│                                              │              │
│                Article / App                 │ 8 tabs       │
│                                              │              │
│                                              │ ✓ Meta API   │
│                                              │ ✓ OAuth      │
│                                              │ ✓ Graph API  │
│                                              │              │
│                                              │ Next:        │
│                                              │ Compare      │
│                                              │ authentication│
│                                              │              │
│                                              │ [Archive]    │
│                                              │ [Continue]   │
└──────────────────────────────────────────────┴──────────────┘
```

### 6.3 Web Dashboard

Dashboard digunakan untuk pengelolaan context jangka panjang.

```text
Projects

🟢 Instagram SaaS Research
   17 tabs
   Last active: 20 minutes ago

🟡 Arabic Learning App
   24 tabs
   Last active: yesterday

⚪ Laptop Research
   8 tabs
   Last active: 12 days ago
```

---

## 7. Fitur Utama

### MVP v1

#### Tab Management

- membaca tab yang sedang terbuka;
- menyimpan session;
- restore session;
- close tab;
- reopen tab;
- duplicate detection;
- archive tab;
- search tab;
- basic workspace/project.

#### Tab Triage

Ketika jumlah tab terlalu banyak, pengguna dapat melakukan cleanup.

Contoh:

```text
You have 23 open tabs.

14 haven't been touched in 3 days.

Clean this up?
```

Pilihan:

- Keep
- Save
- Archive
- Discard

Tujuannya bukan memaksa pengguna menutup tab, tetapi membantu mereka mengambil keputusan.

---

## 8. Tab → Project / Context

Ini merupakan fitur pembeda yang lebih penting daripada sekadar grouping.

AI atau rule engine mencoba memahami bahwa beberapa tab sebenarnya merupakan satu pekerjaan.

Contoh:

```text
17 tabs
   ↓
Instagram API Research
```

Bukan hanya:

```text
Tab #1
Tab #2
Tab #3
...
```

Context dapat memiliki:

```text
Project
├── Name
├── Goal
├── Tabs
├── Notes
├── Status
├── Last activity
├── Summary
└── Next action
```

Contoh:

```text
PROJECT
Instagram API Research

Goal:
Memahami API Instagram untuk SaaS.

Sources:
├── Meta documentation
├── Instagram Login
├── Facebook Login
├── API reference
└── Discussions

Status:
🟡 In progress

Next action:
Review authentication flow
```

---

## 9. Resume Context

Salah satu fitur paling bernilai.

Ketika pengguna kembali setelah beberapa waktu:

```text
Yesterday you were researching Instagram API.

You left 11 tabs open.

Last activity:
Instagram API with Instagram Login

Would you like to continue?
```

Pilihan:

```text
[Continue]
```

AI dapat memberikan ringkasan:

```text
Yesterday you were comparing
Facebook Login and Instagram Login.

You had already determined:
- ...
- ...
- ...

You had not yet checked:
- ...

Recommended next step:
Review authentication flow.
```

Konsep ini menjadikan aplikasi sebagai **memory layer**, bukan hanya tab manager.

---

## 10. "What Was I Doing?"

Fitur lanjutan untuk menjawab pertanyaan:

> "Tadi saya sebenarnya sedang mengerjakan apa?"

Contoh:

```text
You appear to have 3 active contexts:

1. Instagram API research — 14 tabs
2. Arabic learning project — 21 tabs
3. Client website — 7 tabs

5 tabs don't appear related to an active project.
```

Fitur ini membantu mengurangi perasaan bahwa puluhan tab berarti puluhan pekerjaan.

Misalnya:

> 31 tabs ≠ 31 unfinished things.

Bisa jadi hanya:

> **3 active contexts.**

---

## 11. Peran AI

Produk **tidak harus bergantung sepenuhnya pada AI**.

AI sebaiknya menjadi **intelligence layer**, bukan fondasi aplikasi.

### Tanpa AI

Fitur berikut tetap dapat berjalan:

- save session;
- restore tabs;
- close/restore;
- duplicate detection;
- tab history;
- snooze;
- workspace;
- search;
- grouping berdasarkan domain;
- grouping berdasarkan rule;
- archive.

### Dengan AI

AI digunakan untuk:

- context detection;
- semantic grouping;
- project detection;
- context summary;
- research summary;
- memahami tujuan kumpulan tab;
- menentukan kemungkinan next action;
- menjawab "What was I doing?";
- natural-language tab commands.

Arsitektur:

```text
              Browser Extension
                     │
                     ▼
             Tab Context Engine
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
     Sessions      Rules       Metadata
        │            │            │
        └────────────┼────────────┘
                     ▼
              Context Store
                     │
              ┌──────┴──────┐
              ▼             ▼
          Normal UI       AI Layer
                            │
                     ┌──────┼──────┐
                     ▼      ▼      ▼
                  Group   Summary  Recall
```

---

## 12. CPU / GPU Performance

Aplikasi sebaiknya dirancang agar **tidak membuat laptop menjadi lambat**.

Extension tidak perlu terus-menerus memproses seluruh halaman.

Informasi dasar yang cukup:

```text
URL
Title
Domain
Favicon
Tab state
Created time
Last active time
Workspace
```

Contoh:

```json
{
  "title": "Instagram API with Instagram Login",
  "url": "https://developers.facebook.com/...",
  "domain": "developers.facebook.com",
  "lastActive": "...",
  "createdAt": "...",
  "workspaceId": "research-instagram"
}
```

### Hindari

```text
80 tabs
 ↓
download seluruh halaman
 ↓
parse HTML
 ↓
local LLM
 ↓
embeddings
 ↓
vector processing
```

Ini tidak diperlukan untuk MVP.

### Lebih baik

```text
80 tabs
 ↓
metadata
 ↓
local storage / backend
```

AI dipanggil hanya ketika diperlukan.

---

## 13. AI Processing

AI tidak harus dijalankan secara lokal.

Model yang disarankan:

```text
Browser Extension
       │
       │ metadata / selected content
       ▼
Backend
       │
       ▼
AI Provider
       │
       ▼
Context / Summary
       │
       ▼
Browser Extension
```

Dengan demikian:

- GPU laptop tidak digunakan untuk AI;
- CPU lokal tetap ringan;
- AI processing dapat dikontrol;
- biaya AI dapat dihitung berdasarkan penggunaan.

AI juga dapat dibuat **on-demand**, misalnya hanya ketika user menekan:

> Analyze this workspace

---

## 14. Privacy

Privacy kemungkinan menjadi tantangan yang lebih besar daripada CPU.

Extension berpotensi mengetahui website yang dikunjungi user, sehingga permission dan data handling harus dirancang dengan sangat hati-hati.

### Prinsip

Default:

- simpan metadata seminimal mungkin;
- jangan membaca seluruh isi halaman tanpa kebutuhan;
- jangan mengirim seluruh browsing history ke server;
- AI dipanggil hanya ketika diperlukan;
- berikan kontrol yang jelas kepada user.

### Privacy Mode

```text
☑ Never send full page content
☑ Don't track browsing history
☑ AI only when requested
☑ Store sessions locally
```

Privacy dapat menjadi salah satu selling point produk.

---

## 15. Free vs Pro

### Free

```text
Tab management
Session management
Workspace
Archive
Restore
Search
Duplicate detection
Basic rules
```

### Pro

```text
AI context detection
AI summaries
Automatic project detection
"What was I doing?"
Research summaries
Next-action suggestions
Natural-language commands
Advanced context management
```

Dengan model ini, aplikasi tetap berguna tanpa AI.

AI menjadi fitur premium yang meningkatkan value.

---

## 16. Roadmap

### Phase 1 — MVP

Browser extension:

1. detect tabs;
2. save session;
3. restore session;
4. archive;
5. close/restore;
6. duplicate detection;
7. basic workspace;
8. basic tab search.

Tidak perlu AI terlebih dahulu.

### Phase 2 — Context

Tambahkan:

- context/project;
- automatic grouping;
- context history;
- resume context.

### Phase 3 — AI

Tambahkan:

- AI context detection;
- summaries;
- "What was I doing?";
- next action;
- semantic search.

### Phase 4 — SaaS

Tambahkan:

- account;
- cloud sync;
- cross-device;
- web dashboard;
- subscription;
- team/workspace jika diperlukan.

---

## 17. Teknologi Awal

### Browser Extension

Target awal:

- Chrome
- Chromium-based browsers
- Edge

Kemudian dapat dipertimbangkan:

- Firefox
- Safari

Teknologi:

```text
TypeScript
Chrome Extension APIs
Manifest V3
Browser Side Panel
Local Storage / IndexedDB
```

### Backend

Contoh:

```text
Go
PostgreSQL
REST API
Authentication
Background jobs
```

### Frontend Dashboard

Contoh:

```text
Nuxt 3
Vue 3
TypeScript
Tailwind CSS
```

### AI

AI provider dapat dibuat abstraction layer sehingga tidak terkunci pada satu provider.

```text
AI Service
├── Context classification
├── Summarization
├── Project detection
├── Recall
└── Recommendation
```

---

## 18. Core Product Loop

Loop utama produk:

```text
User opens tabs
        ↓
Tabs become contexts
        ↓
User works
        ↓
Context automatically updated
        ↓
User finishes / pauses
        ↓
Archive context
        ↓
Tabs can be closed
        ↓
Later
        ↓
Resume context
        ↓
Continue work
```

Produk harus membuat user merasa:

> **"Saya boleh menutup tab karena context saya tetap aman."**

---

## 19. Product Philosophy

Produk tidak boleh menjadi sumber cognitive overload baru.

Jangan membuat:

- terlalu banyak notification;
- terlalu banyak AI suggestions;
- dashboard kompleks;
- terlalu banyak configuration;
- proses cleanup yang merepotkan.

Prinsip utama:

> **The product should reduce digital clutter, not become another source of clutter.**

Idealnya extension terasa hampir tidak terlihat dan hanya muncul ketika dibutuhkan.

---

## 20. Core Differentiation

Perbedaan utama dibanding tab manager biasa:

### Tab Manager

> "Saya punya 30 tab."

### Context Manager

> "Saya punya 3 pekerjaan aktif yang kebetulan terdiri dari 30 tab."

### Bookmark Manager

> "Simpan URL ini."

### Context Manager

> "Simpan apa yang sedang saya kerjakan, mengapa tab-tab ini penting, dan bagaimana saya bisa melanjutkannya nanti."

### AI Assistant

> "Saya bisa menjawab pertanyaan."

### Context Manager

> "Saya tahu pekerjaan browser yang sedang kamu kerjakan dan bisa membantu kamu kembali ke sana."

---

## 21. Potential Long-Term Vision

Jika berhasil, produk dapat berkembang dari:

```text
Tab Manager
      ↓
Context Manager
      ↓
Browser Memory
      ↓
Personal Work Context
```

Dalam jangka panjang, aplikasi tidak hanya mengingat tab, tetapi dapat mengingat:

- project;
- research;
- reading list;
- unfinished work;
- decisions;
- notes;
- context;
- previous sessions;
- next actions.

Visi akhirnya:

> **A memory layer between the user and the web.**

atau:

> **Your browser remembers what you were doing, so you don't have to keep everything open.**

---

## 22. Kesimpulan

Produk ini sebaiknya dimulai sebagai **browser extension**, bukan desktop app.

Core system harus ringan dan tidak bergantung pada AI.

```text
Extension
   +
Context engine
   +
Archive / Restore
   +
Web dashboard
   +
Optional AI
```

AI digunakan untuk memahami **meaning dan context**, bukan untuk menjalankan fungsi dasar tab management.

Fokus produk bukan:

> "How do we manage 100 tabs?"

Tetapi:

> **"How do we let users close 100 tabs without losing the work behind them?"**

Itulah problem yang menjadi dasar produk.
