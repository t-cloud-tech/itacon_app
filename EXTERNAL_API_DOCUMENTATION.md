# Business Defaulters – External API Documentation

Comprehensive guide for integrating with the **Business Defaulters External Partner API**. This API allows partner platforms, ERPs, CRM systems, accounting software, and third-party applications to verify business entities, check defaulter status, and assess credit/payment risk using **GSTIN** and/or **Phone Number**.

---

## 📑 Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [Base URLs](#2-base-urls)
3. [Authentication & API Key (Token) System](#3-authentication--api-key-token-system)
   - [What is the API Key / Token?](#what-is-the-api-key--token)
   - [How Authentication Works](#how-authentication-works)
   - [How API Keys are Generated](#how-api-keys-are-generated)
   - [Key Lifecycle & Statuses](#key-lifecycle--statuses)
   - [Rate Limiting](#rate-limiting)
4. [Endpoint: Check Defaulter Status](#4-endpoint-check-defaulter-status)
   - [HTTP Methods & URL](#http-methods--url)
   - [Request Headers](#request-headers)
   - [Request Parameters / Body](#request-parameters--body)
   - [Matching Logic & Data Sanitization](#matching-logic--data-sanitization)
5. [Field-by-Field Reference](#5-field-by-field-reference)
   - [Request Fields](#request-fields)
   - [Response Fields](#response-fields)
   - [Risk Level Classification Matrix](#risk-level-classification-matrix)
6. [Response Examples](#6-response-examples)
   - [Scenario A: Defaulter Found (High Risk)](#scenario-a-defaulter-found-high-risk)
   - [Scenario B: Clean Registered Company (Zero Defaulter Reports)](#scenario-b-clean-registered-company-zero-defaulter-reports)
   - [Scenario C: Not Found in Database (Safe)](#scenario-c-not-found-in-database-safe)
   - [Scenario D: Closed / Resolved Disputes (Low Risk)](#scenario-d-closed--resolved-disputes-low-risk)
7. [Code Integration Snippets](#7-code-integration-snippets)
   - [cURL](#curl)
   - [JavaScript / Node.js (Axios & Fetch)](#javascript--nodejs)
   - [Python (requests)](#python)
   - [PHP](#php)
8. [Admin API Key Management](#8-admin-api-key-management)
   - [CLI Key Generator](#cli-key-generator)
   - [Admin REST Endpoints](#admin-rest-endpoints)
9. [HTTP Status Codes & Error Handling](#9-http-status-codes--error-handling)

---

## 1. Overview & Architecture

The **Business Defaulters External API** provides a secure, lightweight, and low-latency REST interface. It allows external clients to query the centralized database of businesses and overdue payment defaulters.

### Key Highlights:
- **Flexible Matching:** Search by **GST number**, **Phone number**, or **both** simultaneously.
- **Privacy First (Data Masking):** Sensitive PII (Personally Identifiable Information) like full phone numbers, personal Aadhaar/PAN, and internal reporter notes are filtered and masked (`******XXXX`).
- **Standardized Risk Ratings:** Provides clear categorization (`SAFE`, `CLEAN`, `LOW`, `MEDIUM`, `HIGH`).
- **Dual Method Support:** Accepts both `POST` (JSON body) and `GET` (query string parameters).

---

## 2. Base URLs

| Environment | Base URL |
| :--- | :--- |
| **Local Development** | `http://localhost:5000/api/external` |
| **Production** | `https://<your-production-domain>/api/external` |

All routes detailed in this document are relative to the base URL above.

---

## 3. Authentication & API Key (Token) System

### What is the API Key / Token?
Every partner integration uses a cryptographically generated API key with the following structure:

```text
bd_live_5f3a8b29c1e4d7a0b3f8e2d1c7a9b4f0e2d5c8a1b7e4d9f2
└──┬───┘ └─────────────────────────┬────────────────────────┘
 Prefix           48-character cryptographically secure hex
```

#### Security Attributes:
- **Prefix (`bd_live_`):** Identifies the key as an active live token and assists in quick auditing.
- **Irreversible SHA-256 Storage:** The server **never** stores the plain API key in the database. Only its one-way SHA-256 hash (`keyHash`) is stored.
- **Non-recoverable:** Once generated, the raw key cannot be retrieved from the server again. If lost, a new key must be generated.

### How Authentication Works
Every incoming request to external endpoints passes through `verifyExternalApiKey`. Clients must supply their API key in **one** of the following HTTP request headers:

#### Option 1: Dedicated Header (Recommended)
```http
x-api-key: bd_live_5f3a8b29c1e4d7a0b3f8e2d1c7a9b4f0e2d5c8a1b7e4d9f2
```

#### Option 2: Authorization Header (Bearer format)
```http
Authorization: Bearer bd_live_5f3a8b29c1e4d7a0b3f8e2d1c7a9b4f0e2d5c8a1b7e4d9f2
```

#### Option 3: Authorization Header (ApiKey format)
```http
Authorization: ApiKey bd_live_5f3a8b29c1e4d7a0b3f8e2d1c7a9b4f0e2d5c8a1b7e4d9f2
```

### How API Keys are Generated
1. **Via CLI script (recommended for system administrators):**
   ```bash
   node backend/Script/generateApiKey.js "Partner App Name" "partner@company.com" "Description"
   ```
2. **Via Admin REST endpoint:**
   `POST /api/external/keys` (Requires Admin Bearer JWT).

### Key Lifecycle & Statuses
- **Active (`isActive: true`):** The key functions normally and processes requests.
- **Deactivated (`isActive: false`):** Requests are immediately rejected with HTTP `403 Forbidden` (`"This API key has been deactivated"`).
- **Automated Analytics:** Every successful request automatically and non-blockingly increments `usageCount` and records `lastUsedAt`.

### Rate Limiting
- **Global Rate Limiter:** 120 requests per 15-minute rolling window per IP.
- **Response Headers Included:**
  - `RateLimit-Limit`: Maximum requests allowed in the window.
  - `RateLimit-Remaining`: Remaining requests available.
  - `RateLimit-Reset`: Seconds remaining until the quota resets.
- If the limit is exceeded, HTTP `429 Too Many Requests` is returned.

---

## 4. Endpoint: Check Defaulter Status

The core service endpoint to verify if a business party is a reported defaulter.

### HTTP Methods & URL
```http
POST /api/external/check-defaulter
GET  /api/external/check-defaulter
```

### Request Headers
| Header | Value | Requirement |
| :--- | :--- | :--- |
| `Content-Type` | `application/json` | Required for `POST` |
| `x-api-key` | `bd_live_...` | **Required** (or use `Authorization`) |

---

### Request Parameters / Body

#### For `POST` (JSON Body):
```json
{
  "gst": "24AAACG1234F1Z8",
  "phone": "9979312651"
}
```

#### For `GET` (Query Parameters):
```text
/api/external/check-defaulter?gst=24AAACG1234F1Z8&phone=9979312651
```

> **Note:** At least one search parameter (`gst` or `phone`) must be supplied. Supplying both provides the highest matching accuracy.

---

### Matching Logic & Data Sanitization

1. **GST Matching:**
   - Trims and converts input to uppercase.
   - Searches against plaintext index helper (`gsthelper`) and secure hash (`gstHash`).
2. **Phone Number Matching:**
   - Strips non-digit characters (e.g. `+91`, `-`, spaces).
   - Matches against primary and secondary phone numbers (`phone`, `phone2`, `phone3`, `phone4`).
   - Automatically checks both full numbers and **last 10 digits** to support numbers entered with or without country codes.
3. **Data Masking:**
   - Phone numbers are masked as `******XXXX` (exposing only the final 4 digits).
   - Sensitive legal documents (PAN, Aadhaar, Passport) and dispute internal remarks are completely omitted from the external response.

---

## 5. Field-by-Field Reference

### Request Fields

| Field Name | Type | Presence | Description & Format |
| :--- | :--- | :--- | :--- |
| `gst` | `string` | Optional* | 15-character Indian Goods and Services Tax Identification Number (e.g. `24AAACG1234F1Z8`). Case-insensitive. |
| `phone` | `string` | Optional* | 10-digit to 13-digit mobile/phone number (e.g. `9979312651` or `+919979312651`). |

*\*At least one of `gst` or `phone` is required.*

---

### Response Fields

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `success` | `boolean` | `true` if the request was validated and processed successfully. |
| `exists` | `boolean` | `true` if a registered business matching the search criteria was located in the database. `false` if no record exists. |
| `isDefaulter` | `boolean` | `true` if the party has **1 or more verified or pending fraud/unpaid reports**. `false` if clean. |
| `riskLevel` | `string` | Standardized credit/defaulter risk score: `SAFE`, `CLEAN`, `LOW`, `MEDIUM`, or `HIGH`. |
| `matchedCount` | `number` | Total number of business entities matched by the provided search criteria. |
| `reportCount` | `object` | Detailed tally of dispute reports filed against the entity: |
| `reportCount.total` | `number` | Combined count of active reports (`verified` + `pending` + `closed`). |
| `reportCount.verified`| `number` | Number of **confirmed/verified** fraud or non-payment default reports. |
| `reportCount.pending` | `number` | Number of unverified/in-investigation reports currently under review. |
| `reportCount.closed`  | `number` | Number of resolved or settled disputes. |
| `parties` | `array` | List of sanitized business entity objects (see sub-fields below). |
| `parties[].id` | `string` | Unique MongoDB ObjectId of the business entity. |
| `parties[].companyName`| `string` | Registered legal or trade name of the business entity. |
| `parties[].gst` | `string` | Registered GSTIN of the company. |
| `parties[].city` | `string` | City of registered operations. |
| `parties[].state` | `string` | State or Union Territory. |
| `parties[].address` | `string` | Registered office address. |
| `parties[].phone` | `string` | Masked contact phone number (e.g. `******2651`). |

---

### Risk Level Classification Matrix

| Risk Level | Condition | Suggested Action for Partner Apps |
| :--- | :--- | :--- |
| 🔴 **`HIGH`** | `verifiedCount > 0` | **High Danger:** Verified non-payment / fraud reports exist. Avoid credit terms; demand advance payment or escrow. |
| 🟡 **`MEDIUM`** | `pendingCount > 0` & `verifiedCount === 0` | **Caution:** Disputed reports exist and are under verification. Request additional references before extending credit. |
| 🟢 **`LOW`** | `closedCount > 0` & `verifiedCount === 0` & `pendingCount === 0` | **Low Risk:** Past complaints were resolved or closed. Normal business terms may be extended with routine diligence. |
| 🟢 **`CLEAN`** | Party is registered in database, but has **0** reports of any kind. | **Clean Record:** Valid registered company with zero negative reports on the platform. |
| ⚪ **`SAFE`** | Entity not found in database (`exists: false`). | **No Record:** No matching entity or reports exist in the database. |

---

## 6. Response Examples

### Scenario A: Defaulter Found (High Risk)
> The business entity exists and has verified default reports filed by creditors.

**Request:**
```http
POST /api/external/check-defaulter
x-api-key: bd_live_a1b2c3d4e5f6789012345678abcdef0123456789abcdef01
Content-Type: application/json

{
  "gst": "27AABCS1429B1Z2",
  "phone": "9820012345"
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "exists": true,
  "isDefaulter": true,
  "riskLevel": "HIGH",
  "matchedCount": 1,
  "reportCount": {
    "total": 3,
    "verified": 2,
    "pending": 1,
    "closed": 0
  },
  "parties": [
    {
      "id": "664b18c0e2a87401c9012345",
      "companyName": "Acme Trading & Logistics Pvt Ltd",
      "gst": "27AABCS1429B1Z2",
      "city": "Mumbai",
      "state": "Maharashtra",
      "address": "Unit 402, Trade Square, Andheri East",
      "phone": "******2345"
    }
  ]
}
```

---

### Scenario B: Clean Registered Company (Zero Defaulter Reports)
> The business is registered on the platform with 0 negative reports.

**Response (`200 OK`):**
```json
{
  "success": true,
  "exists": true,
  "isDefaulter": false,
  "riskLevel": "CLEAN",
  "matchedCount": 1,
  "reportCount": {
    "total": 0,
    "verified": 0,
    "pending": 0,
    "closed": 0
  },
  "parties": [
    {
      "id": "664b22c0e2a87401c9067890",
      "companyName": "Apex Precision Textiles",
      "gst": "24AAACG1234F1Z8",
      "city": "Surat",
      "state": "Gujarat",
      "address": "Ring Road Textile Market, Surat",
      "phone": "******1265"
    }
  ]
}
```

---

### Scenario C: Not Found in Database (Safe)
> Neither the GST nor the phone number matched any known party.

**Response (`200 OK`):**
```json
{
  "success": true,
  "exists": false,
  "isDefaulter": false,
  "riskLevel": "SAFE",
  "matchedCount": 0,
  "reportCount": {
    "total": 0,
    "verified": 0,
    "pending": 0,
    "closed": 0
  },
  "message": "No matching record found in the database."
}
```

---

### Scenario D: Closed / Resolved Disputes (Low Risk)
> The company had a past report that was resolved and marked as closed.

**Response (`200 OK`):**
```json
{
  "success": true,
  "exists": true,
  "isDefaulter": false,
  "riskLevel": "LOW",
  "matchedCount": 1,
  "reportCount": {
    "total": 1,
    "verified": 0,
    "pending": 0,
    "closed": 1
  },
  "parties": [
    {
      "id": "665c33d0e2a87401c9099999",
      "companyName": "Sunrise Retailers LLP",
      "gst": "29AABCS8888D1Z1",
      "city": "Bengaluru",
      "state": "Karnataka",
      "address": "Brigade Road, Bengaluru",
      "phone": "******9876"
    }
  ]
}
```

---

## 7. Code Integration Snippets

### cURL

#### POST Method:
```bash
curl -X POST "http://localhost:5000/api/external/check-defaulter" \
  -H "Content-Type: application/json" \
  -H "x-api-key: bd_live_YOUR_API_KEY_HERE" \
  -d '{"gst": "24AAACG1234F1Z8", "phone": "9979312651"}'
```

#### GET Method:
```bash
curl -X GET "http://localhost:5000/api/external/check-defaulter?phone=9979312651" \
  -H "x-api-key: bd_live_YOUR_API_KEY_HERE"
```

---

### JavaScript / Node.js

#### Using Axios:
```javascript
const axios = require("axios");

async function verifyParty(gst, phone) {
  try {
    const response = await axios.post(
      "http://localhost:5000/api/external/check-defaulter",
      { gst, phone },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.BUSINESS_DEFAULTER_API_KEY,
        },
      }
    );

    const data = response.data;
    if (data.isDefaulter) {
      console.warn(`⚠️ WARNING: Entity is a Defaulter! Risk Level: ${data.riskLevel}`);
      console.warn(`Verified Default Reports: ${data.reportCount.verified}`);
    } else {
      console.log(`✅ Entity is Clean. Risk Level: ${data.riskLevel}`);
    }
    return data;
  } catch (error) {
    if (error.response) {
      console.error(`API Error [${error.response.status}]:`, error.response.data);
    } else {
      console.error("Network Error:", error.message);
    }
  }
}

// Call example
verifyParty("24AAACG1234F1Z8", "9979312651");
```

#### Using Fetch (Browser or Node 18+):
```javascript
const response = await fetch("http://localhost:5000/api/external/check-defaulter", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "bd_live_YOUR_API_KEY_HERE",
  },
  body: JSON.stringify({
    gst: "24AAACG1234F1Z8",
    phone: "9979312651",
  }),
});

const result = await response.json();
console.log(result);
```

---

### Python

```python
import os
import requests

API_URL = "http://localhost:5000/api/external/check-defaulter"
API_KEY = os.getenv("BD_API_KEY", "bd_live_YOUR_API_KEY_HERE")

def check_defaulter(gst=None, phone=None):
    headers = {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
    }
    payload = {}
    if gst:
        payload["gst"] = gst
    if phone:
        payload["phone"] = phone

    response = requests.post(API_URL, json=payload, headers=headers)

    if response.status_code == 200:
        data = response.json()
        print(f"Exists: {data.get('exists')}")
        print(f"Is Defaulter: {data.get('isDefaulter')}")
        print(f"Risk Level: {data.get('riskLevel')}")
        return data
    else:
        print(f"Error {response.status_code}: {response.text}")
        return None

# Test with phone
check_defaulter(phone="9979312651")
```

---

### PHP

```php
<?php
$apiKey = "bd_live_YOUR_API_KEY_HERE";
$url = "http://localhost:5000/api/external/check-defaulter";

$payload = json_encode([
    "gst" => "24AAACG1234F1Z8",
    "phone" => "9979312651"
]);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Content-Type: application/json",
    "x-api-key: " . $apiKey
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode === 200) {
    $data = json_decode($response, true);
    print_r($data);
} else {
    echo "API Error ($httpCode): " . $response;
}
?>
```

---

## 8. Admin API Key Management

Administrators can issue, monitor, deactivate, and revoke API keys for external partners.

### CLI Key Generator
From the `backend` folder, run:

```bash
# Syntax: node Script/generateApiKey.js "<Partner Name>" "<Contact Email>" "<Description>"
node Script/generateApiKey.js "Zoho Books Integration" "integration@zoho.com" "Syncing credit check for invoiced vendors"
```

**Output:**
```text
=======================================================
🎉 NEW PARTNER API KEY GENERATED SUCCESSFULLY!
=======================================================
App Name     : Zoho Books Integration
Contact Email: integration@zoho.com
Key Prefix   : bd_live_a1b2c3d4...
API Key ID   : 664b33d0e2a87401c9077777
-------------------------------------------------------
RAW API KEY (Copy now, not stored in plaintext):
👉  bd_live_a1b2c3d4e5f6789012345678abcdef0123456789abcdef01  👈
=======================================================
```

---

### Admin REST Endpoints
*(All admin endpoints require an Admin Bearer JWT: `Authorization: Bearer <ADMIN_JWT>`)*

#### 1. Create a New API Key
`POST /api/external/keys`

```json
{
  "name": "Tally Connector",
  "contactEmail": "admin@tallypartner.com",
  "description": "Daily automated defaulter batch verification",
  "rateLimitPerMin": 120
}
```

#### 2. List All Partner API Keys
`GET /api/external/keys`
*Returns array of all keys with `name`, `keyPrefix`, `contactEmail`, `isActive`, `usageCount`, `lastUsedAt`, and `createdAt` (omitting secret hashes).*

#### 3. Toggle Key Status (Activate / Deactivate)
`PATCH /api/external/keys/:id/toggle`
*Instantly deactivates or reactivates a partner's access.*

#### 4. Delete an API Key
`DELETE /api/external/keys/:id`
*Permanently revokes and removes the API key.*

---

## 9. HTTP Status Codes & Error Handling

All error responses return a standardized JSON structure with a descriptive error message:

```json
{
  "success": false,
  "message": "Human-readable explanation of error"
}
```

### Reference Status Codes

| HTTP Status | Reason | Cause & Resolution |
| :--- | :--- | :--- |
| **`200 OK`** | Success | Request succeeded. Entity status and report counts returned. |
| **`400 Bad Request`** | Missing Input | Neither `gst` nor `phone` was provided in request body or query params. |
| **`401 Unauthorized`** | Missing / Invalid Key | The `x-api-key` header was omitted, malformed, or the key hash does not match any registered key. |
| **`403 Forbidden`** | Deactivated Key | The API key has been deactivated by an administrator (`isActive: false`). Contact support to restore. |
| **`404 Not Found`** | Resource Missing | Used in admin key management if key ID is invalid. |
| **`429 Too Many Requests`** | Rate Limit Exceeded | Client exceeded the rate limit (120 requests / 15 minutes). Back off and retry after the reset interval. |
| **`500 Internal Server Error`** | Server Error | An unexpected server-side error occurred. Contact platform technical support. |

---

### Common Error Responses

#### Missing API Key (`401 Unauthorized`)
```json
{
  "success": false,
  "message": "API key is missing. Please provide a valid 'x-api-key' header."
}
```

#### Invalid API Key (`401 Unauthorized`)
```json
{
  "success": false,
  "message": "Invalid API key provided."
}
```

#### Deactivated API Key (`403 Forbidden`)
```json
{
  "success": false,
  "message": "This API key has been deactivated. Please contact support."
}
```

#### Missing Search Parameters (`400 Bad Request`)
```json
{
  "success": false,
  "message": "Please provide at least one search field: 'gst' or 'phone'."
}
```

#### Rate Limit Exceeded (`429 Too Many Requests`)
```json
{
  "success": false,
  "message": "Rate limit exceeded. Please wait a few minutes before trying again."
}
```

---

*Document generated for Business Defaulters Platform External API Service.*
