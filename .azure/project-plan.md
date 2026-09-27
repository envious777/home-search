# Project Plan

**Status**: Approved
**Created**: 2026-09-26
**Mode**: NEW

---

## 1. Project Overview

**Goal**: Build a home-search map that lets users toggle four ArcGIS operational layers, search and geocode an address with responsive suggestions, save locations in the browser, and inspect aggregated Larimer County Assessor property data. The project is designed so that every module is independently testable.

**App Type**: SPA + API

**API Login**: No

**Mode**: NEW

**Deployment Plan**: No deployment plan found

---

## 2. Backend — Azure Functions

| Component           | Technology     |
| ------------------- | -------------- |
| **Language**        | TypeScript     |
| **Runtime**         | Node           |
| **Package Manager** | npm            |
| **Test Runner**     | vitest         |
| **Mocking Library** | vi.mock        |
| **Test Command**    | npm test       |
| **Orchestration**   | docker-compose |

### Backend Responsibilities

- Expose a typed HTTP-triggered assessor aggregation function. The browser sends normalized address fields from the selected ArcGIS geocoding result; the function constructs and URL-encodes the Larimer County requests server-side.
- Treat the property lookup as the dependency that establishes the assessor account number. If it fails, return a clear upstream error and do not issue account-dependent calls. If an individual detail call fails, return the other successful sections plus per-section `status`, `data`, and `error` metadata rather than failing the entire analysis.
- Use bounded timeouts, response validation, and `Promise.allSettled` for the account-dependent calls. Do not expose upstream implementation details or allow arbitrary upstream URLs from the client.

### ArcGIS FeatureServer Queries

The frontend uses ArcGIS `FeatureLayer` instances backed by these exact query endpoints, with `outFields=*`, a suitable spatial reference, and layer-specific popup renderers:

1. `https://services1.arcgis.com/dLpFH5mwVvxSN4OE/arcgis/rest/services/FloodPlain_FEMA/FeatureServer/0/query` — FloodPlain FEMA
2. `https://services1.arcgis.com/dLpFH5mwVvxSN4OE/arcgis/rest/services/FloodPlain_City/FeatureServer/0/query` — FloodPlain City
3. `https://services1.arcgis.com/dLpFH5mwVvxSN4OE/arcgis/rest/services/BikeFacilities/FeatureServer/0/query` — Bikeway System
4. `https://services1.arcgis.com/dLpFH5mwVvxSN4OE/arcgis/rest/services/Fort_Collins_Floodwarning_Stream_Gage_Stage_and_Flow_Data_csv/FeatureServer/0/query` — Floodwarning Stream Gage Stage and Flow Data, 30-day rolling

### ArcGIS Address Search and Geocoding

Use the ArcGIS Maps SDK for JavaScript `Search` widget or its `SearchViewModel` with the ArcGIS World Geocoding service at `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer`. Restrict suggestions and results to Larimer County by setting the country, city, region, and extent search constraints. On selection, store the canonical address, coordinates, and locator attributes, place a marker graphic, zoom the map, and pass the normalized address to the assessor function. Do not scrape the geocoder in the browser or couple assessor calls to free-form text before a result is selected.

### Larimer County Assessor Endpoint Set

The backend maintains these ten upstream endpoint templates. `accountno` and `yr` are substituted from the property result and current configured tax year; the address lookup fields are populated from the selected geocoded address. The URLs below are the exact supplied examples and remain the integration contract:

| Purpose                 | Exact endpoint template                                                                                                                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Property search         | `https://apps.larimer.org/api/assessor2/property/?prop=property&parcel=undefined&scheduleNumber=undefined&serialIdentification=undefined&name=undefined&fromAddrNum=2743&toAddrNum=2743&address=Wyandotte&city=FORT%20COLLINS&zip=undefined&subdivisionNumber=undefined&sales=any&subdivisionName=&address2=` |
| Detail                  | `https://apps.larimer.org/api/assessor2/?prop=detail&accountno=R1004506`                                                                                                                                                                                                                                      |
| Sales                   | `https://apps.larimer.org/api/assessor2/?prop=sales&accountno=R1004506`                                                                                                                                                                                                                                       |
| Land attributes         | `https://apps.larimer.org/api/assessor2/?prop=landatt&accountno=R1004506`                                                                                                                                                                                                                                     |
| Improvement             | `https://apps.larimer.org/api/assessor2/?prop=improvement&accountno=R1004506`                                                                                                                                                                                                                                 |
| Value detail            | `https://apps.larimer.org/api/assessor2/?prop=valuedetail&accountno=R1004506`                                                                                                                                                                                                                                 |
| Improvement detail      | `https://apps.larimer.org/api/assessor2/?prop=impdtl&accountno=R1004506`                                                                                                                                                                                                                                      |
| Limit                   | `https://apps.larimer.org/api/assessor2/?prop=limit&accountno=R1004506`                                                                                                                                                                                                                                       |
| Treasurer property info | `https://apps.larimer.org/api/assessor2/treasurer/?prop=propinfo&accountno=R1004506`                                                                                                                                                                                                                          |
| Treasurer tax district  | `https://apps.larimer.org/api/assessor2/treasurer/?prop=taxdist&accountno=R1004506&yr=2025`                                                                                                                                                                                                                   |

The response contract returns the selected address, assessor account number, `sections` keyed by the ten purposes, and an `errors` array. A complete upstream response is shown as ready; a response with one or more failed optional sections is still usable and visibly marked partial; a failed property search is an overall error with retry guidance.

---

## 3. Frontend — Web App

| Component           | Technology   |
| ------------------- | ------------ |
| **Language**        | TypeScript   |
| **Framework**       | React + Vite |
| **Package Manager** | npm          |
| **Test Runner**     | vitest       |
| **Mocking Library** | vi.mock      |
| **Test Command**    | npm test     |

---

## 4. Services Required

| Azure Service | Role in App                                                                                 | Environment Variable        | Default Value (Local)        | Classification |
| ------------- | ------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------- | -------------- |
| Blob Storage  | Required Azure Functions host storage; no user files or saved locations are persisted there | `STORAGE_CONNECTION_STRING` | `UseDevelopmentStorage=true` | Essential      |

Browser `localStorage` is the application store for saved locations and is intentionally not represented as an Azure service. No authentication service or server-side database is planned.

---

## 5. Prerequisites

### Run

| Tool                       | Service(s)        | Installed | Version  |
| -------------------------- | ----------------- | --------- | -------- |
| Node.js                    | *                 | ✅        | v24.13.0 |
| npm                        | *                 | ✅        | 11.6.2   |
| Azure Functions Core Tools | Assessor Data API | ✅        | 4.12.1   |

### Debug

| Tool                                                                      | Service(s)        | Installed | Version                                    |
| ------------------------------------------------------------------------- | ----------------- | --------- | ------------------------------------------ |
| Docker                                                                    | Assessor Data API | ✅        | 29.8.0                                     |
| Docker Compose                                                            | Assessor Data API | ✅        | Docker Compose plugin detected with Docker |
| Azure Functions VS Code extension (`ms-azuretools.vscode-azurefunctions`) | Assessor Data API | ❓        | unknown                                    |

Double-check the tool marked `❓` before local debugging.

---

## 6. Design System & UI

**Component Library**: Fluent UI v9
**Style Direction**: A calm, map-first civic data console with a light cartographic base, compact controls, strong layer visibility cues, and restrained elevation around the search, saved-location, and assessor panels. The map remains the dominant workspace while data panels make property analysis scannable.
**Typography**: Segoe UI Variable

### Color Palette

| Token     | Hex       | Usage                                                                                   |
| --------- | --------- | --------------------------------------------------------------------------------------- |
| `primary` | `#176B87` | Search actions, selected layer controls, links, and the selected property marker accent |
| `accent`  | `#D97706` | Assessor attention states, partial-data badges, and map analysis highlights             |
| `surface` | `#F5F7F4` | Application background and map-adjacent panel surfaces                                  |
| `text`    | `#173042` | Property facts, panel headings, and primary interface copy                              |
| `muted`   | `#61727B` | Address metadata, timestamps, helper text, and unavailable-section copy                 |
| `border`  | `#CBD7D8` | Panel boundaries, inputs, layer rows, and data table dividers                           |

### Pages

| Page            | Route | Purpose                                                                                                                                       | Layout                            |
| --------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Home Search Map | `/`   | Search Larimer County addresses, inspect the four operational layers, save locations, and review assessor analysis for the selected property. | `header, main, sidebar, split(map | panel), tabs` |

### Sample Content

Home Search Map — selected property and map layers:

| Address                                 | Account           | Analysis state                                                        | Saved |
| --------------------------------------- | ----------------- | --------------------------------------------------------------------- | ----- |
| 2743 Wyandotte Street, Fort Collins, CO | R1004506          | Partial results remain usable when an optional assessor section fails | No    |
| FloodPlain FEMA                         | Operational layer | Toggleable                                                            | On    |
| Bikeway System                          | Operational layer | Toggleable                                                            | Off   |

Home Search Map — layer controls:
`FloodPlain FEMA: on` · `FloodPlain City: on` · `Bikeway System: off` · `Floodwarning Stream Gage Stage and Flow Data: off`

---

## 7. Project Structure

```text
.
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── features/map/
│   │   ├── features/search/
│   │   ├── features/saved-locations/
│   │   ├── features/assessor/
│   │   ├── lib/
│   │   └── App.tsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── api/
│   ├── AssessorAnalysis/
│   │   ├── function.json
│   │   └── index.ts
│   ├── src/
│   │   ├── assessor/
│   │   ├── http/
│   │   └── models/
│   ├── host.json
│   ├── local.settings.json
│   └── package.json
├── tests/
│   ├── frontend/
│   └── api/
├── docker-compose.yml
└── package.json
```

---

## 8. Route Definitions

| #   | Method | Path                     | Description                                                                                            | Request Body                                                         | Response Body                                       | Status Codes            |
| --- | ------ | ------------------------ | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | --------------------------------------------------- | ----------------------- |
| 1   | GET    | `/api/health`            | Check the Functions host and assessor integration configuration                                        | —                                                                    | `{ status, services }`                              | 200, 503                |
| 2   | GET    | `/api/assessor-analysis` | Resolve the selected address, find the assessor account, and aggregate all ten Larimer County sections | Query: `fromAddrNum`, `toAddrNum`, `address`, `city`, optional `zip` | `{ address, accountno, sections, errors, partial }` | 200, 206, 400, 502, 504 |

The frontend stores saved locations under a versioned browser key such as `fort-collins-home-search.saved-locations`. Each record includes a stable client id, canonical address, latitude, longitude, locator attributes, and saved timestamp. Saving is idempotent by canonical address plus coordinates; selecting a saved record restores the marker and map extent, and deleting removes only that browser record. Saved data is local to the browser, survives reloads, and has no authentication or cross-device synchronization.

---

## 9. Next Steps

1. Run **azure-project-scaffold** to execute this plan
2. Run **azure-project-integrate** to wire the frontend to live data, smoke-test the backend, and create the migrations
3. Run **azure-debug-plan** → **azure-debug-generate** for Docker emulators and VS Code debugging
4. Run the **azure-deploy** agent when ready; it uses **azure-app-onboard** for architecture, cost estimation, IaC generation, provisioning, and health verification
