# DIZO Watch D Real-Device Testing & Verification Checklist

Use this checklist during physical testing sessions with the **DIZO Watch D** smartwatch.

---

## 📋 Phase 1: Physical Device Preparation

- [ ] **Battery State:** Watch is charged to at least 50% (or plugged into magnetic charger).
- [ ] **Physical Display:** Press the side hardware crown/button to confirm the display turns on.
- [ ] **Disconnection of Other Hosts:**
  - [ ] Turn off Bluetooth on any smartphone previously paired with the watch (Realme Link / DIZO companion app).
  - [ ] In Windows Settings -> *Bluetooth & devices*, check if "DIZO Watch D" is listed. If paired, ensure no background Windows service is occupying the GATT client.
- [ ] **Host Platform:** Laptop is running desktop Google Chrome or Microsoft Edge.

---

## 📋 Phase 2: Browser Discovery & GATT Link

- [ ] Open `http://localhost:5173` on desktop Chrome.
- [ ] Verify **Web Bluetooth API** indicator on Dashboard displays *Available & Active*.
- [ ] Navigate to **Device Connection**:
  - [ ] Keep discovery mode as *Broad Discovery* (`acceptAllDevices: true`).
  - [ ] Click **Select & Connect Watch**.
  - [ ] Browser native chooser popup appears.
  - [ ] Locate "DIZO Watch D" (or device advertising MAC / model name) in the chooser list.
  - [ ] Select device and click **Pair / Connect**.
- [ ] **Status Verification:**
  - [ ] Header badge changes from `DISCONNECTED` -> `CONNECTING...` -> `CONNECTED`.
  - [ ] Device identifier and timestamp appear on Dashboard.
  - [ ] Diagnostic log records `[SUCCESS] [BLUETOOTH] GATT connection established`.

---

## 📋 Phase 3: GATT Service & Characteristic Enumeration

- [ ] Navigate to **GATT Explorer**.
- [ ] Verify services are enumerated without throwing security errors.
- [ ] Check presence of standard Bluetooth SIG services:
  - [ ] `0x1800` (Generic Access) — Read `0x2A00` (Device Name). Should return "DIZO Watch D" or similar model string.
  - [ ] `0x180A` (Device Information) — Attempt reading `0x2A24` (Model), `0x2A26` (Firmware), `0x2A29` (Manufacturer).
  - [ ] `0x1805` (Current Time Service) — **CRITICAL CHECK**: Is service `00001805-0000-1000-8000-00805f9b34fb` present?
- [ ] Check presence of observed reference UUIDs:
  - [ ] `000001ff-3c17-d293-8e48-14fe2e4da212`
  - [ ] `00006287-3c17-d293-8e48-14fe2e4da212`
  - [ ] `0000ff02-0000-1000-8000-00805f9b34fb`
  - [ ] `0000ff03-0000-1000-8000-00805f9b34fb`
- [ ] Document all discovered service UUIDs and permissions.

---

## 📋 Phase 4: Notification Subscriptions & Telemetry

- [ ] Locate any characteristic exposing `notify` or `indicate` permissions (e.g. `0xFF03` or under service `0x6287`).
- [ ] Click **Subscribe**.
- [ ] Badge displays `NOTIFYING`.
- [ ] Navigate to **Data Inspector**:
  - [ ] Confirm incoming packets stream without UI lag or memory leak.
  - [ ] Inspect hex payload and ASCII preview.
  - [ ] Test **Pause Stream** and **Resume Stream**.
  - [ ] Verify events are stored in IndexedDB.

---

## 📋 Phase 5: Time Synchronization Protocol Investigation

- [ ] Navigate to **Time Sync Lab**.
- [ ] Review **Section A (Reference Host Time)**: Confirm date, local time, and UTC offset match your laptop clock.
- [ ] Review **Section B (Candidate Profiles)**:
  - [ ] **Candidate 1: Bluetooth SIG CTS (0x1805 / 0x2A2B)**
    - Was CTS discovered in GATT table?
    - If YES: Click *Inspect & Test Protocol* -> Review 10-byte struct -> Confirm & Transmit.
    - If NO: Service is unsupported by watch firmware; proceed to candidate 2.
  - [ ] **Candidate 2: DaFit / Realtek 0xFF02 Protocol**
    - Was characteristic `0000FF02` discovered with write permissions?
    - First, subscribe to `0000FF03` in Data Inspector.
    - Click *Inspect & Test Protocol* for Opcode `0x04` -> Confirm & Transmit.
    - Observe any immediate response packet on `0000FF03`.
  - [ ] **Candidate 3: Proprietary 6287 / 6387 Epoch Time**
    - Was service `00006287` discovered with writable characteristic `6387`?
    - Execute candidate test under strict monitoring.
- [ ] **Step 7 Visual Inspection on Watch Display:**
  - [ ] Wake the watch display by pressing the side button.
  - [ ] Inspect the displayed hour, minute, and date.
  - [ ] Click **YES** or **NO** on the manual verification prompt.
  - [ ] Verify the formal status tracker updates accordingly.

---

## 📋 Phase 6: Session Teardown & Export

- [ ] Navigate to **Diagnostic Logs**:
  - [ ] Verify all steps and operations were recorded with timestamps.
  - [ ] Click **Export JSON** and **Export CSV** to archive the session evidence.
- [ ] Navigate to **Time Sync Lab** -> Click **Export Evidence Report**.
- [ ] Click **Disconnect** in header to gracefully terminate the GATT link.
