# 🛡️ TraceShield — Your Digital Footprint Guardian

> A Chrome Extension (Manifest V3) that passively monitors the personal data you share while browsing. Detects trackers, sensitive form fields, permission requests, and third-party data flows — then presents everything in a clean privacy dashboard.

**Mini Project — 22CY49 | Dayananda Sagar College of Engineering**
Department of Computer Science & Engineering (Cyber Security)
Under the Guidance of Dr. Mohammed Tajuddin, Prof. & HoD

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [File Structure](#file-structure)
- [Setup & Installation](#setup--installation)
- [How to Use](#how-to-use)
- [How It Works](#how-it-works)
- [Privacy Score](#privacy-score)
- [Known Limitations](#known-limitations)
- [Team](#team)

---

## Overview

Every time you browse the internet, websites silently collect data about you — through cookies, trackers, form field monitoring, and third-party scripts. TraceShield makes this invisible activity **visible**.

It runs entirely on-device. No data is ever sent to an external server. Only the *type* of data detected is stored (e.g. `"email"`), never the actual value you typed.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔍 **Tracker Detection** | Detects 25+ known trackers (Google Analytics, Facebook Pixel, Hotjar, TikTok Pixel, etc.) including dynamically injected scripts |
| 📤 **PII / Data Sharing Detection** | Detects 8 sensitive field types (email, phone, password, credit card, SSN, DOB, address, name) on focus — never reads values |
| 🛡️ **Privacy Score (0–100)** | Per-site score calculated from trackers, shared data, permissions, cookies, and third-party hosts |
| 🍪 **Cookie Scanner** | Classifies cookies as session, persistent, or tracking per site |
| 🌐 **Third-Party Host Monitor** | Tracks outbound XHR/fetch calls to external domains |
| 📍 **Permission Detection** | Detects geolocation, camera, microphone, notifications, and clipboard API requests |
| 🔴 **Alert Badge** | Extension icon badge count updates in real-time when new trackers or high-risk data is detected |
| 💡 **Rotating Cybersec Tips** | 10 security tips that rotate every time you open the popup |
| 🌓 **Dark / Light Mode** | Toggle between themes — preference is saved |
| 📥 **Export Report** | Download all collected data as a timestamped JSON file |
| 🔎 **Per-Site Detail View** | Full breakdown page: score deductions, cookie snapshot, tracker list, permission list, third-party hosts |
| 🗑️ **Clear Data** | One-click wipe of all collected data |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Extension Platform | Chrome Extension — Manifest V3 |
| Frontend | HTML, CSS (dark/light themes via CSS variables) |
| Backend Logic | Vanilla JavaScript (Service Worker) |
| Storage | `chrome.storage.local` (all on-device, no external DB) |
| Tracker Detection | RegEx pattern matching against script sources & page HTML |
| PII Detection | RegEx pattern matching on form field attributes |
| Cookie Scanning | `chrome.cookies` API |
| Third-Party Monitor | `chrome.webRequest` API (XHR/fetch type) |
| Security Scanning | Chrome `webNavigation` API |
| Visualization | CSS-based dashboard (no external charting library needed) |

---

## 📁 File Structure

```
TraceShield/
├── manifest.json           ← MV3 extension manifest
├── background.js           ← Service worker: storage, scoring, badge, message routing
├── content.js              ← Injected into every page: PII, tracker & permission detection
├── popup.html              ← Extension popup — dashboard shell
├── popup.css               ← Dark/light theme styles (shared with details page)
├── popup.js                ← Dashboard rendering, theme toggle, export, tips
├── details.html            ← Per-site detail view page
├── details.js              ← Detail view logic
└── icons/
    ├── generate_icons.html ← Open once in browser to export PNG icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 🚀 Setup & Installation

### Prerequisites

- Google Chrome (or any Chromium-based browser: Brave, Edge, Opera)
- No Node.js, no build step, no dependencies — pure vanilla JS

### Step 1 — Download the extension

**Option A — Clone the repo:**
```bash
git clone https://github.com/samarthbc/traceshield.git
cd traceshield
```

**Option B — Download ZIP:**
1. Go to the [GitHub repo](https://github.com/samarthbc/traceshield)
2. Click **Code → Download ZIP**
3. Extract the ZIP to a folder on your computer

### Step 2 — Load into Chrome

1. Open Chrome and navigate to:
   ```
   chrome://extensions
   ```
2. Toggle **Developer Mode** ON (top-right corner)
3. Click **Load Unpacked**
4. Select the `TraceShield/` folder (the one containing `manifest.json`)
5. The TraceShield shield icon will appear in your Chrome toolbar
6. Pin it by clicking the puzzle icon 🧩 → pin TraceShield

### Step 3 — Start Browsing

That's it! TraceShield runs automatically in the background. Open the popup any time to see your digital footprint dashboard.

> **After editing any file:** Click the refresh icon on the extension card in `chrome://extensions`, then reload your open tabs.

---

## 🧭 How to Use

### Popup Dashboard

Click the TraceShield icon in your toolbar to open the dashboard. You'll see:

- **Stats bar** — total sites tracked, trackers found, data types shared, permissions requested
- **Cybersec tip** — a new privacy tip every time you open the popup
- **Data Shared** — tag cloud of detected data types with counts
- **Website Activity** — cards for every site visited, sorted by most recent

### Site Cards

Each card shows:
- Domain name + privacy score badge (green/amber/red)
- Detected data types, tracker count, permissions, cookies
- Tracker name chips
- Last visit time + visit count

**Click any card** to open the full per-site detail view.

### Detail View

Shows a complete breakdown for one site:
- Visit summary (first seen, last visit, total visits, last URL)
- Cookie snapshot (total / session / persistent / tracking)
- Privacy score breakdown — every deduction explained line by line
- All detected data types with risk levels (High / Medium / Low)
- All tracker names
- All permissions requested
- All third-party XHR/fetch hosts

### Theme Toggle

Click `☀️ / 🌙` in the header to switch between dark and light mode. Your preference is saved.

### Export Report

Click **Export** to download a `.json` file containing all your TraceShield data — useful for analysis or your project report.

### Clear Data

Click **Clear** to wipe all collected data and start fresh.

---

## ⚙️ How It Works

```
Web Page (every tab)
  └── content.js
        • Scans <input> fields → detects PII data types (on focus)
        • Scans <script> src/content → detects tracker patterns
        • Wraps navigator APIs → detects permission requests
        • MutationObserver → catches dynamically injected elements
        │
        │  chrome.runtime.sendMessage
        ▼
background.js (Service Worker)
        • Receives: DATA_DETECTED, TRACKERS_DETECTED, PERMISSION_REQUESTED
        • Persists domain records to chrome.storage.local
        • Recalculates privacy score on every update
        • Updates extension badge count
        • Scans cookies on every webNavigation.onCompleted
        • Monitors third-party XHR via webRequest.onBeforeRequest
        │
        │  chrome.runtime.sendMessage (GET_ALL_DATA)
        ▼
popup.html + popup.js
        • Requests all data on open
        • Renders stats, data-type tags, site cards
        • Handles theme toggle, export, clear data
```

---

## 📊 Privacy Score

Each site starts at **100** and points are deducted:

| Factor | Deduction |
|---|---|
| Each tracker detected | −5 (max −30) |
| High-risk data (password, credit card, SSN) | −15 each |
| Medium-risk data (email, phone, address, name, DOB) | −5 each |
| Each permission requested | −10 (max −20) |
| Each tracking cookie | −3 (max −15) |
| Each third-party XHR host | −1 (max −10) |

**Score ranges:**
- 🟢 70–100 — Good privacy
- 🟡 40–69 — Medium exposure
- 🔴 0–39  — High exposure

---

## ⚠️ Known Limitations

1. **Tracker detection is heuristic** — based on URL/script pattern matching, not a full blocklist like uBlock Origin
2. **Permission wrapping is best-effort** — some browser contexts may prevent API overrides
3. **Third-party monitor is XHR/fetch only** — does not catch image/CSS/font requests to third-party domains
4. **TLD handling is simplified** — multi-part TLDs like `.co.uk` may not be grouped correctly
5. **No options page** — no user-configurable settings yet
6. **MV3 service workers are ephemeral** — in-memory state resets when the service worker sleeps

---


## 📄 License

This project is built for academic purposes as part of the Mini Project course 22CY49 at Dayananda Sagar College of Engineering, Bangalore.
