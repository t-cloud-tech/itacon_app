# Free iOS Testing Setup Guide for ITACON Granito
**Firebase Project:** `itacon-app`  
**Bundle Identifier:** `com.itacon.app` (Configured across all iOS configurations & GoogleService-Info.plist)  
**Prerequisites:** Windows PC, GitHub account, iPhone (optional for physical device test), No Mac required, No paid Apple Developer account required.

---

## 1. Connect Repo to Codemagic (Free Cloud Builds)

Codemagic provides 500 free build minutes every month on Apple Silicon macOS build machines.

1. Go to [https://codemagic.io](https://codemagic.io) and click **Sign Up** using your **GitHub account**.
2. Click **Add application**.
3. Select your repository: `t-cloud-tech/itacon_app` (or your GitHub fork).
4. Select **Flutter App** as the project type.
5. **Switch from Workflow Editor to `codemagic.yaml`:**
   - If Codemagic displays the visual UI editor with tabs (Build, Artifacts, etc.), click **"Switch to configuration file"** at the top right (or under the cog icon / project settings, choose **Codemagic configuration file**).
   - Codemagic will parse [`codemagic.yaml`](codemagic.yaml) directly from the repo root.
6. You will see two available workflows:
   - **`ios-simulator`**: Produces `itacon-simulator.zip` for browser testing via Appetize.io.
   - **`ios-unsigned-ipa`**: Produces `itacon-unsigned.ipa` for installing on a physical iPhone via Sideloadly.
7. To run a build:
   - Click **Start new build**.
   - Select the branch: `main`.
   - Select workflow: `ios-simulator` (or `ios-unsigned-ipa`).
   - Click **Start build**.
8. Once the build finishes (takes ~4–6 minutes), download the generated artifact from the **Artifacts** section on the right side of the build page.

---

## 2. In-Browser iPhone Testing with Appetize.io (Zero Setup)

Appetize.io lets you run and interact with the iOS app in Chrome/Edge on Windows without touching a physical phone.

1. Download **`itacon-simulator.zip`** from the `ios-simulator` Codemagic build artifacts.
2. Go to [https://appetize.io](https://appetize.io) and create a free account.
3. Click **Upload** and upload `itacon-simulator.zip`.
4. Select device: **iPhone 15 Pro** (or iPhone 14/15/16).
5. Click **View App in Browser**.
6. An interactive virtual iPhone appears in your browser where you can tap, scroll, fill forms, and test the complete app!

---

## 3. Physical iPhone Sideloading via Sideloadly (Windows PC)

To install the app directly on a real iPhone without a Mac and without paying Apple:

### Requirements on your Windows PC
- [iTunes for Windows (Non-Microsoft Store version)](https://www.apple.com/itunes/) or Apple Devices app installed so Windows recognizes your iPhone.
- [iCloud for Windows (Direct installer from Apple, not MS Store)](https://support.apple.com/en-us/102998).
- [Sideloadly](https://sideloadly.io/) (Free tool for Windows).

### Sideloading Steps
1. Download **`itacon-unsigned.ipa`** from the `ios-unsigned-ipa` Codemagic build artifacts.
2. Connect your iPhone to your Windows PC with a Lightning / USB-C cable and tap **Trust This Computer** on the iPhone screen.
3. Launch **Sideloadly** on Windows.
4. Drag and drop `itacon-unsigned.ipa` into the IPA box in Sideloadly.
5. Under **Apple ID**, type your free personal Apple ID email.
6. Click **Start**. Sideloadly will ask for your Apple ID password (it uses Apple's free developer provisioning API to sign the app on your computer).
7. Sideloadly will show **Done!** and the ITACON Granito icon will appear on your iPhone home screen.

### First-Time iOS Verification on iPhone
1. **Trust Developer Certificate:**
   - On your iPhone, open **Settings → General → VPN & Device Management**.
   - Under *Developer App*, tap your Apple ID email.
   - Tap **Trust "[Your Apple ID]"** → tap **Trust**.
2. **Enable iOS 16+ / iOS 17+ Developer Mode (Required on modern iOS):**
   - Open **Settings → Privacy & Security → Developer Mode** (at the bottom).
   - Toggle **Developer Mode** to **ON**.
   - Tap **Restart**.
   - After restart, unlock your iPhone and tap **Turn On** when prompted.
3. Open **ITACON Granito** on your iPhone.

> [!NOTE]
> **The 7-Day Free Apple ID Rule:** Apps signed with a free personal Apple ID are valid for **7 days**. After 7 days, open Sideloadly on your PC and click **Start** to renew it for another 7 days. Your app data, login state, and database entries are completely preserved during re-signing.

---

## 4. Firebase Phone Auth & OTP Test Number Setup

Because free accounts and simulators do not have Apple Push Notification service (APNs) credentials, Firebase Auth uses either silent reCAPTCHA verification (configured via `REVERSED_CLIENT_ID` in `Info.plist`) or whitelist test numbers. Setting up a whitelist test number ensures instant, 100% reliable OTP login without SMS charges:

1. Open the [Firebase Console](https://console.firebase.google.com/project/itacon-app/authentication/providers).
2. Go to **Authentication → Sign-in method → Phone**.
3. Expand **Phone numbers for testing**.
4. Add a test phone number and a fixed 6-digit OTP code, for example:
   - **Phone number:** `+91 99999 88888`
   - **Verification code (OTP):** `123456`
5. Click **Save**.
6. When testing on your iPhone or Appetize.io:
   - Enter `99999 88888` on the login or registration screen.
   - Enter `123456` when prompted for the OTP.
   - The login completes immediately without needing real SMS delivery!

> [!WARNING]
> **Launch Reminder:** Before releasing to the public App Store, remember to delete test numbers from Firebase Console so unauthorized users cannot use fixed test credentials.

---

## 5. iPhone Test Checklist

Run through this test suite on the iPhone or Appetize.io:

- [ ] **App Launch:** App opens cleanly without crashing or hanging on splash.
- [ ] **Signup + OTP:** Register a new user with the test phone number; OTP verification proceeds seamlessly.
- [ ] **Customer Referral Code:** Enter an existing customer referral code during signup; verify rewards attribution.
- [ ] **Salesperson Assignment:** Enter `SALES-107` (or leave empty for Auto-Assign); verify correct salesperson link.
- [ ] **Login Flow:** Log in with phone + OTP or username/password; session persists across app restarts.
- [ ] **Products Collection (Catalog Order):**
  - Open **Products Collection** screen.
  - Verify count shows **304**.
  - Verify all **tiles** appear first in their standard order.
  - Scroll to the bottom: verify the **6 Fixing Solutions adhesives** appear as the last 6 items in exact sequence (`LX-01`, `LX-02`, `LX-03`, `LX-03W`, `LX-04`, `LX-04W`).
- [ ] **Sorting Verification:**
  - Sort by **Price: Low to High**: tiles are sorted among themselves, followed by adhesives at the end.
  - Sort by **Price: High to Low**: tiles are sorted among themselves, followed by adhesives at the end.
  - Sort by **Product Name: A to Z**: tiles sorted A–Z, followed by adhesives A–Z at the end.
- [ ] **Search & Filters:**
  - Search `"LX"`: only the 6 adhesives appear.
  - Search a tile name (e.g., `"Statuario"`): only that tile appears.
  - Filter by Surface (e.g., `Glossy`): only glossy tiles appear, with no empty grid gaps.
- [ ] **Trending Showcase:** Open Home screen; scroll through Trending Tiles horizontal list.
- [ ] **Cart & Checkout:** Add tiles and an adhesive to the cart; verify box/sqft calculations and adhesive bag counts. Complete order checkout.
- [ ] **Payment Proof Upload:** In Order Details, tap **Upload Payment Receipt**; pick an image from the iPhone Photo Library or Camera. Verify upload completes.
- [ ] **PO PDF Download:** Tap **Download Purchase Order**; verify the generated PDF opens or saves to the iOS Files app (`UIFileSharingEnabled`).
- [ ] **Logout:** Open Profile screen → tap Logout; verify return to welcome screen.
- [ ] **Screen Layouts:** Test portrait mode on both small screen (iPhone SE / iPhone 13 mini) and large screen (iPhone 15 Pro Max) to ensure no RenderFlex overflows.

---

## 6. What CANNOT Be Tested on a Free Account (Pre-Launch Limitations)

| Feature | Free Apple ID / Simulator | Paid Apple Developer Account ($99/yr) |
| :--- | :--- | :--- |
| **App Testing & UI Verification** | Supported (Appetize.io & Sideloadly) | Supported |
| **Firestore & Storage Integration** | Supported (Live `itacon-app` DB) | Supported |
| **Phone Auth (OTP)** | Supported (Test numbers & reCAPTCHA) | Supported (Silent APNs verification) |
| **Camera & Gallery Picker** | Supported (Physical device via Sideloadly) | Supported |
| **PDF Viewing & Saving** | Supported | Supported |
| **APNs Push Notifications** | **Not supported** *(Apple requires paid Developer entitlement)* | **Supported** *(Requires APNs Key in Firebase)* |
| **TestFlight External Beta** | **Not supported** *(Apple requires paid account)* | **Supported** |
| **App Store Public Release** | **Not supported** | **Supported** |

> [!TIP]
> The app is already programmed to safely skip APNs token registration on free/simulator builds without crashing. When your client or company is ready to launch, they can register for the **$99/year Apple Developer Program**, upload the APNs Authentication Key (.p8) to Firebase Console, and distribute builds via TestFlight.
