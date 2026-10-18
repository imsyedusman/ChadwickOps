# ChadwickOps Production Provider API (v1)

This document describes the read-only, authenticated data provider API exposed by **ChadwickOps** for the standalone **Chadwick Production** application.

---

## 1. Architecture & Design Principles

* **Single Sync Authority:** ChadwickOps remains the exclusive sync worker connecting to the WorkGuru REST API.
* **Server-to-Server Authentication:** Requests must be authenticated using a dedicated API key via the standard `Authorization: Bearer <token>` header or `x-api-key: <token>` header. Session cookies are ignored.
* **Minimal Scope & Data Hygiene:** Endpoints expose only operational fields required for capacity planning, readiness, and scheduling. Passwords, hashed credentials, API secrets, client billing margins, and staff payroll rates (`hourlyRate`) are explicitly omitted.
* **Batch Resolution:** Database queries use indexed bulk joins and `inArray` grouping to eliminate N+1 overhead.

---

## 2. Authentication

Configure the secret token on the server in `.env`:
```env
CHADWICK_PRODUCTION_API_KEY=cp_live_<hex_key>
```

### Passing the Token
In incoming HTTP requests from Chadwick Production:
```http
Authorization: Bearer cp_live_<hex_key>
```
*or*
```http
x-api-key: cp_live_<hex_key>
```

### Error Responses
* **401 Unauthorized:** Missing, empty, or invalid API key.
  ```json
  { "error": "Unauthorized: Invalid API key." }
  ```
* **500 Internal Server Error:** Server-side API key configuration missing on the provider.

---

## 3. Endpoints

Base Path: `/api/production/v1`

### 3.1. Sync Freshness & System Health
* **Route:** `GET /api/production/v1/freshness`
* **Purpose:** Inspect WorkGuru core, procurement, and invoice sync timestamps along with current inventory counts.
* **Example Response:**
  ```json
  {
    "success": true,
    "data": {
      "serverTime": "2026-10-18T03:00:00.000Z",
      "syncFreshness": {
        "coreWorkGuruSync": {
          "lastSyncAt": "2026-10-18T02:45:10.000Z",
          "status": "SUCCESS",
          "syncedProjectsCount": 250
        },
        "procurementSync": {
          "lastSyncAt": "2026-10-18T02:30:00.000Z",
          "status": "COMPLETED",
          "mode": "INCREMENTAL",
          "totalOrders": 1900
        },
        "invoiceSync": {
          "lastSyncAt": "2026-10-18T01:15:00.000Z",
          "status": "SUCCESS"
        }
      },
      "counts": {
        "activeProjects": 250,
        "openPurchaseOrders": 1900,
        "activeStaff": 23
      }
    }
  }
  ```

---

### 3.2. Projects
* **Route:** `GET /api/production/v1/projects`
* **Query Parameters:**
  * `page` (integer, default: `1`)
  * `limit` (integer, default: `50`, max: `200`)
  * `archived` (`"false"` [default], `"true"`, `"all"`)
  * `status` (string, optional filter e.g. `"2.2 - In Progress"`)
  * `search` (string, optional search against number, name, client)
  * `updatedSince` (ISO date string, optional delta filter)
* **Example Response:**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1420,
        "projectNumber": "12394-01",
        "name": "Main Switchboard Upgrade",
        "clientName": "Acme Construction",
        "projectManager": "Joe",
        "status": "2.2 - In Progress",
        "priority": "HIGH",
        "bayLocation": "Bay 3",
        "projectType": "Standard",
        "hours": {
          "budget": 120.0,
          "actual": 45.5,
          "remaining": 74.5
        },
        "dates": {
          "deliveryDate": "2026-10-28",
          "scheduledStart": "2026-10-10",
          "drawingApprovalDate": "2026-10-01",
          "expectedDrawingApprovalDate": null,
          "sheetmetalOrderedDate": "2026-10-02",
          "sheetmetalDeliveredDate": "2026-10-12",
          "switchgearOrderedDate": "2026-10-03",
          "switchgearDeliveredDate": null
        },
        "isArchived": false,
        "updatedAt": "2026-10-18T01:30:00.000Z",
        "remoteUpdatedAt": "2026-10-18T01:25:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 250,
      "totalPages": 5,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
  ```

---

### 3.3. Project Stage Hours
* **Route:** `GET /api/production/v1/stage-hours`
* **Query Parameters:**
  * `projectId` (integer, optional filter by single project)
  * `page` (integer, default: `1`)
  * `limit` (integer, default: `100`, max: `500`)
* **Example Response:**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 5,
        "projectId": 881,
        "projectNumber": "12509-01",
        "projectName": "Flags and Bakelite Panels",
        "stages": {
          "frameAssemblyIfc": 50.0,
          "frameAssemblyIfm": 0.0,
          "switchgearMount": 50.0,
          "busbarIfc": 50.0,
          "busbarIfm": 0.0,
          "wiring": 50.0,
          "labels": 1.0,
          "testing": 5.0,
          "packagingFreight": 1.0
        },
        "totalStageHours": 207.0,
        "updatedAt": "2026-07-19T06:22:25.342Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 100,
      "total": 5,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
  ```

---

### 3.4. Synced WorkGuru Tasks
* **Route:** `GET /api/production/v1/tasks`
* **Query Parameters:**
  * `projectId` (integer, optional filter by single project)
  * `page` (integer, default: `1`)
  * `limit` (integer, default: `100`, max: `500`)
* **Example Response:**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 13380,
        "workguruId": "5761434",
        "projectId": 1958,
        "projectNumber": "12611-02",
        "projectName": "The Greens Golf Club - Main Switchboard – MSB PART 2",
        "taskName": "00 - Quote/Project setup",
        "hours": {
          "budget": 0,
          "actual": 0,
          "remaining": 0
        },
        "updatedAt": "2026-10-17T04:28:05.778Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 100,
      "total": 5706,
      "totalPages": 58,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
  ```

---

### 3.5. Purchase Orders & Lines
* **Route:** `GET /api/production/v1/purchase-orders`
* **Query Parameters:**
  * `projectId` (integer, optional)
  * `poNumber` (string, optional)
  * `supplier` (string, optional)
  * `status` (string, optional)
  * `page` (integer, default: `1`)
  * `limit` (integer, default: `50`, max: `200`)
* **Example Response:**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 3644,
        "workguruId": "1393839",
        "projectId": 1655,
        "projectNumber": "12568-01",
        "projectName": "Bingara Homestead - MSB",
        "poNumber": "PO-85120",
        "supplierName": "HI SWITCH",
        "status": "Approved",
        "hydrationStatus": "COMPLETE",
        "dates": {
          "issueDate": "2026-10-15",
          "expectedDate": "2026-10-22",
          "receivedDate": null
        },
        "readinessSummary": {
          "totalLineItems": 1,
          "fullyReceivedLineItems": 1,
          "allReceived": true
        },
        "lines": [
          {
            "id": 9210,
            "productId": 451,
            "name": "Custom Enclosure 2000x800x600",
            "description": null,
            "quantity": 1,
            "receivedQuantity": 1,
            "outstandingQuantity": 0,
            "isFullyReceived": true
          }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 1909,
      "totalPages": 39,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
  ```

---

### 3.5. Suppliers & Lead Times
* **Route:** `GET /api/production/v1/suppliers`
* **Purpose:** Returns configured master suppliers, lead times, tiers, and active PO suppliers.
* **Example Response:**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 4,
        "name": "HI SWITCH",
        "tier": "TIER_1",
        "leadTimeWeeks": 3,
        "notes": "Sheetmetal enclosure fabricator",
        "isConfigured": true,
        "activeOrdersCount": 18
      }
    ],
    "total": 45
  }
  ```

---

### 3.6. Workshop Staff & Skills
* **Route:** `GET /api/production/v1/workforce/staff`
* **Query Parameters:**
  * `workshopOnly` (boolean, default: `true`)
  * `activeOnly` (boolean, default: `true`)
* **Security & Privacy:** Omits `hourlyRate` and sensitive contact information.
* **Example Response:**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 2,
        "workguruId": "WG-STAFF-02",
        "fullName": "Alex Smith",
        "isApprentice": false,
        "isWorkshopStaff": true,
        "isActive": true,
        "skillProficiencies": {
          "frameAssembly": 1.0,
          "switchgearMount": 1.0,
          "busbar": 0.9,
          "wiring": 0.95,
          "labels": 0.8,
          "testing": 0.85,
          "packagingFreight": 0.7
        },
        "updatedAt": "2026-10-18T00:00:00.000Z"
      }
    ],
    "total": 23
  }
  ```

---

### 3.7. Staff Absences
* **Route:** `GET /api/production/v1/workforce/absences`
* **Query Parameters:**
  * `staffId` (integer, optional)
  * `startDate` (YYYY-MM-DD, optional)
  * `endDate` (YYYY-MM-DD, optional)
* **Example Response:**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 14,
        "staffId": 2,
        "staffName": "Alex Smith",
        "startDate": "2026-10-24",
        "endDate": "2026-10-25",
        "hours": 16.0,
        "reason": "Annual leave",
        "absenceType": "annual",
        "createdAt": "2026-10-15T00:00:00.000Z"
      }
    ],
    "total": 1
  }
  ```

---

### 3.8. Existing Worker Assignments
* **Route:** `GET /api/production/v1/workforce/assignments`
* **Query Parameters:**
  * `projectId` (integer, optional)
  * `staffId` (integer, optional)
  * `status` (`"active"` [default], `"completed"`, `"all"`)
* **Example Response:**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 55,
        "projectId": 1420,
        "projectNumber": "12394-01",
        "projectName": "Main Switchboard Upgrade",
        "staffId": 2,
        "staffName": "Alex Smith",
        "stage": "Wiring",
        "assignedHours": 20.0,
        "dates": {
          "projectedStart": "2026-10-20",
          "projectedEnd": "2026-10-22"
        },
        "status": "active",
        "notes": "Lead wiring of control section",
        "updatedAt": "2026-10-18T02:00:00.000Z"
      }
    ],
    "total": 12
  }
  ```

---

## 4. Local Testing Without Exposing Secrets

Test locally using PowerShell or curl by pulling the configured key directly from your local environment file:

```powershell
# 1. Test unauthenticated request (Expected: 401 Unauthorized)
curl.exe -i http://localhost:3000/api/production/v1/freshness

# 2. Test invalid credential (Expected: 401 Unauthorized)
curl.exe -i -H "Authorization: Bearer invalid_secret_key" http://localhost:3000/api/production/v1/freshness

# 3. Test valid credential extracted safely from .env (Expected: 200 OK)
$token = (Get-Content .env | Select-String "^CHADWICK_PRODUCTION_API_KEY=").Line.Split("=")[1].Trim()
curl.exe -i -H "Authorization: Bearer $token" http://localhost:3000/api/production/v1/freshness

# 4. Test project pagination (5 items per page)
curl.exe -s -H "Authorization: Bearer $token" "http://localhost:3000/api/production/v1/projects?limit=5&page=1"

# 5. Test staff retrieval
curl.exe -s -H "Authorization: Bearer $token" "http://localhost:3000/api/production/v1/workforce/staff"
```
