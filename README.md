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

The primary objective is to **investigate, communicate with, and recover functionality on a DIZO Watch D smartwatch whose physical touchscreen is broken**.

When attempting to pair with a phone, the watch repeatedly displays a confirmation dialog asking the user to accept or reject phone binding. Because the touch digitizer cannot register touch input, **DIZO Watch Lab** provides a dedicated **Pairing Assistant** to investigate whether phone binding can be confirmed over Bluetooth Low Energy, alongside a complete protocol diagnostic workbench and date/time synchronization lab.

> **Scientist Principle:** DIZO Watch Lab strictly follows experimental protocol verification. It **does not claim the watch can be controlled** until candidate commands are verified experimentally against the physical hardware display. No simulated telemetry is ever presented as real device data.

---

## 🚀 Core Features Matrix

1. **Pairing Assistant (Core Feature C — Top Priority):**
   - 8 precise hardware state indicators: `Watch disconnected`, `Watch connected`, `Pairing confirmation detected`, `Waiting for confirmation`, `Acceptance command not yet identified`, `Command sent`, `Acceptance verified`, `Operation failed`.
   - 5 core buttons: `Connect to Watch`, `Check Pairing Status`, `Accept on Watch`, `Cancel Operation`, `View Diagnostic Log`.
   - Safety gating with mandatory disclaimer: *"The Bluetooth command for accepting this watch's phone-binding confirmation has not yet been verified."*
   - Investigates Linwear vendor opcode handshake (`0xFF02` / `0xFF03`), WeChat / Tencent Sports AirSync (`0xFEE7` / `0xFEA1`), and standard BLE HID virtual input (`0x1812`).

2. **GATT Service & Characteristic Explorer (Core Feature B):**
   - Full tree enumeration of primary services and exposed characteristics.
   - Standard Bluetooth SIG Assigned Numbers resolution (`0x1800`, `0x1801`, `0x1805`, `0x180A`, `0x1812`).
   - Permissions matrix (`Read`, `Write`, `WriteWithoutResponse`, `Notify`, `Indicate`).
   - Real-time read, notification subscription, hex dump, and optional UTF-8 string interpretation.

3. **Protocol Research Workspace (Core Feature E):**
   - Controlled 6-step experimental workflow:
     1. Capture initial baseline snapshot (Snapshot A).
     2. Perform single known action on phone or watch.
     3. Capture resulting post-action state (Snapshot B).
     4. Byte-by-byte delta comparator highlighting shifted registers.
     5. Protocol annotations with strict confidence classification (`UNVERIFIED`, `PROBABLE`, `VERIFIED`).
     6. Export collected evidence as structured JSON.

4. **Notification Monitor (Core Feature D):**
   - Live stream of incoming notification and indication packets with timestamps, byte lengths, hex payloads, and ASCII previews.
   - Dedicated notification channel controller to subscribe/unsubscribe directly.
   - Stream pause/resume, clear history, and JSON/TXT/CSV local export.

5. **Date & Time Synchronization Research (Core Feature F):**
   - Reference host clock displaying system date, time, timezone, and UTC offset from the local RTC.
   - Evaluation of candidate protocols (Bluetooth SIG CTS `0x1805`, DaFit/Realtek `0xFF02` Opcode 0x04, Linwear Epoch `0x6387`).
   - 7-step safe execution workflow with manual watch display verification prompt.

6. **Device Connection Panel (Core Feature A):**
   - User-initiated BLE device chooser dialog (`Scan / Connect to Watch`).
   - Connection status indicators, selected device identifier, and graceful disconnect handler.
   - Real-device MAC scanner and direct connect for Android environments.

7. **Local Diagnostic Logging (IndexedDB):**
   - Full audit trail of browser capability checks, connections, disconnections, reads, writes, notifications, and errors.
   - Zero external cloud transmission or telemetry leakage.

---

## 🔬 Verified Capabilities & Unresolved Protocol Questions

### Verified Capabilities
- **GATT Connectivity**: DIZO Watch D establishes stable GATT connection in Chrome/Edge on Desktop and Android Chrome.
- **Service Enumeration**: Primary vendor services `000001FF-...`, `00006287-...`, `0000FEE7-...` and standard services `0x1800`, `0x1801`, `0x180A`, `0x1812` are reliably discovered.
- **Notification Subscriptions**: Characteristic `0000FF03` and `00006487` accept Client Characteristic Configuration Descriptor (CCCD) writes and stream notification packets.
- **Read Access**: Characteristics such as WeChat AirSync status (`0xFEA1` -> `07 00 00 ...`), device MAC (`0xFEC9` -> `CC EA FF AD B4 29`), and HID mode (`0x2A4E` -> `00`) can be read cleanly.

### Unresolved Protocol Questions
1. **Remote Phone-Binding Acceptance**: Does the Realtek RTL8762 Bee2 / Linwear bootloader permit clearing the on-screen confirmation prompt solely via a BLE GATT write, or does the MCU hardware require a capacitive interrupt on the digitizer pins?
2. **WeChat AirSync Auth Token**: Does writing a positive token to `0xFEA1` bypass the touch prompt when pairing via standard BLE instead of Tencent's WeChat mini-program?
3. **HID Virtual Input Report**: Does writing an Enter keycode (`0x28`) to HID Report `0x2A4D` under service `0x1812` dispatch a click event to the prompt's focused button?

---

## 📱 Native Android Version & Roadmap

The project includes a ready-to-run Capacitor Android bridge that compiles directly to a native Android APK:
- Pre-configured Android project under `./android` with `@capacitor-community/bluetooth-le` 8.3.0.
- Pre-compiled debug APK available at `./dizo-watch-lab.apk`.
- Roadmap:
  - **Phase 1 (Complete)**: Hybrid Capacitor implementation bridging Web UI with native Android BLE GATT client.
  - **Phase 2 (Current)**: Testing candidate pairing acceptance packets and notification streams on physical Android hardware.
  - **Phase 3 (Next)**: Dedicated Kotlin native background service for continuous telemetry capture and persistent bond management.

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
