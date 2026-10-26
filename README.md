# DIZO Watch Lab
### Bluetooth Diagnostic, Protocol Research & Smartwatch Control Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-cyan.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-purple.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Vitest-3.0-green.svg)](https://vitest.dev/)

**DIZO Watch Lab** is an engineering workstation and Bluetooth Low Energy (BLE) protocol diagnostic platform built specifically to inspect, diagnose, and experimentally recover a **DIZO Watch D** smartwatch.

---

## 🎯 Primary Engineering Objective

The immediate objective is to **determine whether the watch supports date and time synchronization through Bluetooth Low Energy** because its physical touchscreen is broken and the manufacturer's official companion application has been discontinued.

> **Scientist Principle:** DIZO Watch Lab strictly follows experimental protocol verification. It **does not claim the watch can be controlled** until candidate commands are verified experimentally against the physical hardware display. No simulated telemetry is ever presented as real device data.

---

## 🚀 Key Features

1. **Web Bluetooth Device Manager:**
   - User-initiated BLE device chooser dialog.
   - Broad peripheral discovery (`acceptAllDevices: true`) and filtered name prefix discovery (`DIZO`, `Watch`).
   - Dynamic `optionalServices` registration (mandatory for Web Bluetooth GATT access).
   - Single-peripheral connection conflict detection and recovery workflow.

2. **GATT Service & Characteristic Explorer:**
   - Full tree enumeration of primary services and exposed characteristics.
   - Instant resolution against standard Bluetooth SIG Assigned Numbers (`0x1800`, `0x1801`, `0x1805`, `0x180A`, `0x1812`, `0x2A2B`, `0x2A00`, etc.).
   - Cross-referencing against previously observed DIZO Watch D reference UUIDs (`000001FF-...`, `00006287-...`, `0000FF02-...`, `00006387-...`).
   - Live read, subscribe/unsubscribe notifications, and raw byte inspector modal.

3. **Time Synchronization Research Lab (Primary Screen):**
   - **Section A:** Live reference host clock displaying system date, time, timezone, and UTC offset from the local RTC.
   - **Section B:** Evaluation of candidate time synchronization protocols (Bluetooth SIG CTS `0x1805`, DaFit/Realtek `0xFF02` Opcode 0x04, and Proprietary `0x6387` Epoch Time).
   - **Section C:** Formal time synchronization status tracker (`NOT_INVESTIGATED`, `INVESTIGATION_IN_PROGRESS`, `POSSIBLE_CHARACTERISTIC_IDENTIFIED`, `CANDIDATE_COMMAND_IDENTIFIED`, `COMMAND_TESTED`, `TIME_SYNC_VERIFIED`, `UNSUPPORTED_OR_UNRESOLVED`).
   - **Section D:** 7-step safe execution workflow:
     1. Review intended operation
     2. Review destination characteristic
     3. Review live byte breakdown
     4. Confirm operation
     5. Execute command
     6. Inspect peripheral response
     7. Manual watch display verification prompt ("Did the screen time change?")

4. **Safe Command Laboratory:**
   - Read-only by default.
   - Interactive packet builder with checksum engine (Sum modulo 256, XOR checksum, CRC-16 CCITT).
   - Physical safety interlock requiring manual release before any write operation.
   - Two-stage confirmation dialog with mandatory purpose documentation.
   - Strict prohibition against random writes or brute-force guessing.

5. **Data Inspector & Notification Monitor:**
   - Real-time packet capture stream for incoming notifications and indication events.
   - Multi-format view: Hexadecimal, Decimal array, and safe ASCII/UTF-8 dump.
   - Stream pause/resume and JSON/CSV export.

6. **Local Diagnostic Logging (IndexedDB):**
   - Full audit trail of browser capability checks, connections, disconnections, reads, writes, notifications, and errors.
   - Persisted across browser sessions using IndexedDB (`idb`).
   - Search, severity filtering (`INFO`, `SUCCESS`, `WARNING`, `ERROR`), and JSON/CSV export.

7. **Dual Mode (Live BLE & Mock Simulator):**
   - One-click toggle between live Web Bluetooth and an offline mock simulator for automated testing and UI validation.

---

## 🛠️ Technology Stack

- **Frontend:** React 18, Vite 6, TypeScript 5.7, Tailwind CSS 3.4, Lucide React
- **Bluetooth:** Web Bluetooth API (`navigator.bluetooth`) with clean `IBluetoothService` abstraction
- **Persistence:** Browser IndexedDB via `idb` (zero cloud database, zero external telemetry)
- **Testing:** Vitest 3, React Testing Library, JSDOM, Mock Bluetooth client

---

## 💻 Setup & Installation on Windows

### Prerequisites
- Node.js v18+ (tested on Node v22.20.0)
- Desktop Google Chrome, Microsoft Edge, or another Chromium-based browser supporting the Web Bluetooth API.

### Install Dependencies
```bash
npm install
```

### Run Automated Tests
```bash
npm test
```

### Build for Production
```bash
npm run build
```

### Start Development Server
```bash
npm run dev
```
The server will start on `http://localhost:5173` and bind to `0.0.0.0` for local area network access.

---

## 📱 Laptop & Android Phone Access Guide

### Why Web Bluetooth Needs a Secure Context
Web Bluetooth is restricted by browser security policies: it **only functions in a Secure Context** (`window.isSecureContext === true`).
- `http://localhost:5173` on your laptop is **Secure** ✅
- `https://your-domain.com` is **Secure** ✅
- `http://192.168.x.x:5173` (LAN IP) on an Android phone is **Insecure** ❌ (Web Bluetooth API is automatically disabled by Chrome)

### Recommended Testing Methods on Android Phone:

#### Method 1: ADB Port Forwarding (Recommended - Zero SSL Config)
1. Enable **USB Debugging** on your Android phone.
2. Connect your phone to your Windows laptop with a USB cable.
3. Open PowerShell on Windows and run:
   ```powershell
   adb reverse tcp:5173 tcp:5173
   ```
4. On your Android phone, open Chrome and navigate to:
   ```
   http://localhost:5173
   ```
   *Because the URL is `localhost`, Chrome treats it as a Secure Context and grants full Web Bluetooth access!*

#### Method 2: Android Chrome Security Flag Override (Wireless Wi-Fi)
1. On your Android phone, open Chrome and navigate to `chrome://flags`.
2. Search for **"Insecure origins treated as secure"**.
3. Enable the flag and enter your laptop's Wi-Fi IP (e.g. `http://192.168.1.50:5173`).
4. Tap **Relaunch** in Chrome and navigate to that IP address.

---

## 🔍 Bluetooth Troubleshooting Guide for DIZO Watch D

1. **Connection Conflicts (Single-Peripheral Limit):**
   BLE smartwatches generally permit only **one active GATT connection** at any given moment. If the watch was previously paired with:
   - The official DIZO App
   - Realme Link App
   - Android / iOS OS Bluetooth Settings
   - Windows Bluetooth Settings
   
   The watch will reject connection attempts with a `NetworkError` or `Connection failed for unknown reason`.
   **Fix:** Turn off Bluetooth on nearby phones, unpair from Windows Bluetooth settings, and try connecting again.

2. **Sleep State / Reduced Advertising:**
   Budget smartwatches drop their advertising interval to save power when the display turns off.
   **Fix:** Press the physical button/crown on the DIZO Watch D to wake the display immediately before clicking "Connect Watch".

3. **Low Battery Cutoff:**
   When battery drops below ~15%, wearable PMICs disable Bluetooth radio transmitters.
   **Fix:** Connect the watch to its magnetic charging cable.

---

## 📁 Project Structure

```
dizo-watch-lab/
├── src/
│   ├── components/
│   │   ├── common/             # Reusable Badge, Modal, CapabilityBanner
│   │   └── layout/             # Header, Sidebar, AppLayout
│   ├── context/
│   │   └── BluetoothContext.tsx# Reactive state & Bluetooth orchestration
│   ├── data/
│   │   ├── knownUuids.ts       # Bluetooth SIG database & observed reference UUIDs
│   │   └── timeCandidateProtocols.ts # Candidate CTS & vendor time packet formats
│   ├── pages/
│   │   ├── DashboardPage.tsx       # System health & telemetry overview
│   │   ├── DeviceConnectionPage.tsx# Scanner, filters & connection conflict guide
│   │   ├── GattExplorerPage.tsx    # Discovered GATT tree, reads & notifications
│   │   ├── DataInspectorPage.tsx   # Live packet stream, hex dump & export
│   │   ├── CommandLabPage.tsx      # Checksums, safe write & interlock engine
│   │   ├── TimeSyncPage.tsx        # 7-step controlled time synchronization lab
│   │   ├── DiagnosticLogsPage.tsx  # IndexedDB audit logs with CSV/JSON export
│   │   └── SettingsHelpPage.tsx    # LAN setup, Android migration & chipset notes
│   ├── services/
│   │   ├── bluetooth/
│   │   │   ├── bluetoothInterface.ts   # Typed abstraction (IBluetoothService)
│   │   │   ├── webBluetoothService.ts  # Browser Web Bluetooth client
│   │   │   └── mockBluetoothService.ts # Offline test simulator
│   │   ├── diagnostics/
│   │   │   └── diagnosticLogger.ts     # Multi-level logger with CSV/JSON export
│   │   └── storage/
│   │       └── indexedDb.ts            # Local IndexedDB persistence (idb)
│   ├── tests/
│   │   ├── setup.ts
│   │   ├── App.test.tsx
│   │   ├── bluetoothService.test.ts
│   │   ├── byteUtils.test.ts
│   │   ├── diagnosticLogger.test.ts
│   │   └── uuidUtils.test.ts
│   ├── types/
│   │   ├── bluetooth.ts        # Typed GATT, device, and experiment interfaces
│   │   └── diagnostics.ts      # Log levels, categories, and filters
│   ├── utils/
│   │   ├── byteUtils.ts        # Hex, ASCII, UTF-8, Checksum & CTS formatters
│   │   └── uuidUtils.ts        # RFC 4122 validation, normalization & aliases
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── CHECKLIST.md                # Real-device testing checklist
├── ANDROID_MIGRATION.md        # Capacitor & Native Android BLE architecture
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## ⚖️ Safety & Integrity Notice

DIZO Watch Lab was engineered for ethical hardware recovery and research. It respects device security boundaries, never attempts to brute-force undocumented writes, and provides strict auditability for all Bluetooth Low Energy interactions.
