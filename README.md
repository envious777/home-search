# Home Search

Home Search is a Larimer County property exploration tool. It combines an ArcGIS map with public geographic layers and county assessor/treasurer records so a user can search for an address, inspect its surroundings, and review the property's public facts in one workspace.

## What it does

- Searches geocoded addresses within the Larimer County extent.
- Shows street or satellite basemaps and lets users toggle FEMA floodplain, Fort Collins floodplain, bikeway, and flood-warning layers.
- Displays layer legends and ArcGIS popups for feature attributes. The flood-warning layer also shows the latest available stream and rain-gage readings.
- Saves selected locations in browser `localStorage` for quick return visits.
- Loads assessor and treasurer data for a selected address, with partial results when an individual upstream section is unavailable.
- Supports light and dark themes, persisted in browser `localStorage`.
- Provides optional 3D sun shadows. The selected building is rendered as an estimated extrusion based on assessor square footage and story count, and nearby real parcel footprints are used when available to improve the shadow context.
- Provides a historical imagery timelapse from 1999 through 2025. If an exact year is not published, the nearest earlier Larimer County imagery service is shown.

## Architecture

The repository is an npm workspace with a static frontend and an optional backend:

| Package    | Role                                                                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend` | React 19 + Vite UI, Fluent UI controls, ArcGIS Maps SDK for JavaScript map experience, and assessor analysis display                                     |
| `api`      | Node.js Azure Functions v4 HTTP endpoints for server-side assessor aggregation and building-footprint proxy                                              |

The frontend calls public ArcGIS services directly for map, geocoding, imagery, and operational layers. Assessor analysis uses `GET /api/assessor-analysis`, and 3D shadowing also calls `GET /api/building-footprints` to fetch nearby parcel geometry from the proxy. The UI can be deployed separately, but assessor analysis and footprint-based shadows require a reachable API.

## Local development

### Prerequisites

- Node.js with npm
- Azure Functions Core Tools v4
- Docker for the local Azurite storage emulator

Install dependencies from the repository root:

```sh
npm install
```

Start the local storage emulator:

```sh
docker compose up -d
```

Start the API from `api/` in a separate terminal:

```sh
cd api
npm run dev
```

Then run the frontend from the repo root:

```sh
npm run dev --workspace frontend
```

Open the Vite URL shown in the terminal, normally `http://127.0.0.1:5173/`. Vite proxies `/api` to `http://127.0.0.1:7071`. Without the Functions host, the map still works but assessor analysis and 3D footprint lookups cannot load.

The frontend includes a local override in [frontend/.env.local](frontend/.env.local) with `VITE_API_BASE_URL=/api`, which matches the Vite proxy for same-origin local development. For static deployments or a different hosting setup, set `VITE_API_BASE_URL` to the deployed Functions URL ending in `/api` before building.

The API's local defaults are in [api/local.settings.json](api/local.settings.json). The treasurer tax-district request always uses the previous calendar year (for example, `2025` in 2026).

```json
{
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "STORAGE_CONNECTION_STRING": "UseDevelopmentStorage=true"
  }
}
```

`local.settings.json` is for local execution. Configure equivalent application settings in the deployed Function App rather than committing credentials or environment-specific values.

## Verification

Run the complete workspace checks from the repository root:

```sh
npm run typecheck
npm test
npm run build
```

Formatting is checked with:

```sh
npm run format:check
```

For a separate static deployment, set `VITE_API_BASE_URL` to the deployed Functions URL ending in `/api` (for example, `https://example.azurewebsites.net/api`), then build and publish `frontend/dist`:

```sh
npm run build --workspace frontend
```

For same-origin hosting that routes `/api` to the Functions app, leave `VITE_API_BASE_URL` unset. For cross-origin hosting, allow the frontend origin in the Function App's CORS settings. This setting is embedded at build time, not read at runtime.

### GitHub Pages

The repository includes [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml). To enable it:

1. Push the repository to GitHub with the default branch named `main`.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main`, or run **Deploy frontend to GitHub Pages** from the repository's **Actions** tab.

The workflow builds `frontend/dist` and publishes the site at `https://<owner>.github.io/<repository>/`. Vite detects the GitHub repository name during the workflow and sets the correct asset base path. Deploy the API separately and set the repository Actions variable `VITE_API_BASE_URL` to its URL ending in `/api`; allow `https://<owner>.github.io` in the Function App's CORS settings. Without that variable and a running API, assessor analysis will not load on Pages.

The frontend tests cover browser storage and assessor API responses, while the API tests cover assessor endpoint and aggregation behavior. Tests that call public county or ArcGIS services may also depend on network availability when run outside the mocked test paths.

## Search and map workflow

1. Use the map's top-right search box to search for an address. The geocoder is restricted to the Larimer County extent.
2. Select a result to center the map, place an active pin, and request the assessor analysis.
3. Use the right-hand panels to toggle operational layers, inspect legends, and manage saved locations.
4. Switch between Streets and Satellite basemaps. Enable **Sun Shadows (3D)** to inspect the building mass and adjust the sun date/time. The map prefers real parcel footprints in the surrounding area when available, then falls back to the modeled estimate from assessor data.
5. Enable **Imagery Timelapse** to choose a historical year or play the available imagery sequence. Changing the year pauses playback.
6. Review the full-width assessor analysis below the map. Use **View table** inside a section when the raw upstream records are needed.

Saved locations are browser-local and are not synchronized between browsers or devices. Selecting a saved location runs the assessor lookup again so the displayed records remain fresh.

## External services and data boundaries

The app depends on the following public services:

- ArcGIS World Geocoding Service for address suggestions.
- ArcGIS feature and map services for FEMA floodplain, Fort Collins floodplain, bikeways, flood warnings, and historical imagery.
- Larimer County assessor and treasurer APIs for property records.
- Colorado geospatial services for nearby building footprints, proxied through the local API to avoid CORS issues during 3D shadow rendering.

These services can change, rate-limit requests, or be temporarily unavailable. Map layers fail independently and assessor sections use partial-result handling. The app does not provide legal, surveying, tax, flood-risk, or valuation advice; county records and map visualizations should be independently verified.

## Assessor analysis

Selecting a geocoded address on the map loads Larimer County assessor and treasurer records for that property and renders them in the full-width **Assessor analysis** section below the map.

### Flow

```mermaid
sequenceDiagram
  participant UI as Frontend (App.tsx)
  participant API as Functions (assessor-analysis)
  participant LC as apps.larimer.org/api/assessor2
  UI->>API: GET /api/assessor-analysis (address query)
  API->>LC: property search (address to accountno)
  par 9 section requests
    API->>LC: detail, sales, landatt, improvement, valuedetail, impdtl, limit
    API->>LC: treasurer/propinfo, treasurer/taxdist
  end
  API-->>UI: analysis (200 or partial 206)
  UI->>UI: AssessorSections renders each section
```

1. **Address normalization** — [frontend/src/App.tsx](frontend/src/App.tsx) (`toAddressQuery`) splits the canonical address into a house number and a bare street name. Directionals (`N`, `SW`, …) and suffixes (`Dr`, `Ave`, …) are stripped because the Larimer search only matches bare street names. The city returned by the geocoder is passed through to the county search.
2. **API aggregation** — [frontend/src/lib/assessor/client.ts](frontend/src/lib/assessor/client.ts) calls the Functions endpoint. The API searches for the first `accountno` and fetches the county sections.
3. **Partial results** — the API fetches all sections in parallel with `Promise.allSettled`, each with an 8 s timeout. A failing section returns a partial (`206`) analysis rather than failing the whole request.

### API

The frontend calls the Azure Functions endpoint:

`GET /api/assessor-analysis`

| Query param   | Required | Notes                                              |
| ------------- | -------- | -------------------------------------------------- |
| `fromAddrNum` | yes      | House number, max 12 chars                         |
| `toAddrNum`   | yes      | Defaults to `fromAddrNum`; max 12 chars            |
| `address`     | yes      | Bare street name (e.g. `Wyandotte`), max 120 chars |
| `city`        | yes      | e.g. `FORT COLLINS`, max 80 chars                  |
| `zip`         | no       |                                                    |

| Status | Meaning                                                          |
| ------ | ---------------------------------------------------------------- |
| `200`  | All sections loaded                                              |
| `206`  | Some sections failed; `partial: true` and `errors` lists them    |
| `400`  | Missing or oversized query params                                |
| `502`  | Property search unavailable, or no account found for the address |
| `504`  | Aggregation threw unexpectedly                                   |

The treasurer tax-district section is requested for the previous calendar year.

Example:

```sh
curl 'http://127.0.0.1:7071/api/assessor-analysis?fromAddrNum=2473&toAddrNum=2473&address=Wyandotte&city=FORT%20COLLINS'
```

### Response shape

Defined in [api/src/models/assessor.ts](api/src/models/assessor.ts):

```ts
interface AssessorResponse {
  address: { fromAddrNum: string; toAddrNum: string; address: string; city: string; zip?: string };
  accountno: string | null;
  sections: Record<SectionName, { status: "fulfilled" | "rejected"; data: unknown; error: string | null }>;
  errors: string[];
  partial: boolean;
}
```

Each fulfilled section's `data` is tabular: `{ columns: string[]; records: Record<string, string | null>[] }`. All values arrive as strings (e.g. `"225000.00"`, `".21"`), so the frontend parses numbers itself.

### Sections

| Section key             | Upstream `prop`      | Panel title       | Visualization                                                                                                                                                                                           |
| ----------------------- | -------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `detail`                | `detail`             | Property          | Key/value summary: address, owner, mailing address, subdivision, legal, parcel, mill levy (local / school). Flags when the owner mailing address differs from the property.                             |
| `improvement`           | `improvement`        | Building          | Stat tiles (beds, baths, above-grade sf, basement total/finished, year built/remodeled, stories) plus style, condition, quality, HVAC, exterior, roof, foundation, neighborhood. One card per building. |
| `valueDetail`           | `valuedetail`        | Valuation         | Actual value, assessed value, assessment ratio; stacked bar of land vs. improvement value.                                                                                                              |
| `treasurerPropertyInfo` | `treasurer/propinfo` | Property tax      | Latest year's tax (with half-year split), actual/assessed value, balance due, due dates; SVG bar chart of annual tax across all years with total change.                                                |
| `treasurerTaxDistrict`  | `treasurer/taxdist`  | Tax breakdown     | Horizontal bars per taxing district for the latest year: amount, mill levy, share of bill.                                                                                                              |
| `sales`                 | `sales`              | Sales history     | Timeline, newest first. Deed codes are expanded (`WD`, `WDJ`, `QC`, …). `$0` transfers are muted as "No consideration"; market sales show % change from the previous market sale.                       |
| `improvementDetail`     | `impdtl`             | Building features | Rows grouped by type + description with units summed. Area types (basement, garage, porch, deck, patio, carport) show sf; others show a count.                                                          |
| `landAttributes`        | `landatt`            | Land              | Chips of attribute / description.                                                                                                                                                                       |
| `limit`                 | `limit`              | Tax district      | Key/value: tax district, tax area, account, schedule, parcel.                                                                                                                                           |

Every visualized section includes a collapsible **View table** with the raw columns and records. Any section without a dedicated view, or whose data isn't in `columns`/`records` form, falls back to a plain table. Rejected sections show their error message.

### Parcel number format

Larimer County parcel numbers (`parcelnb`) are 10 digits encoding the property's Public Land Survey System location. The Property section splits the number into these segments (`splitParcel` in [AssessorSections.tsx](frontend/src/features/assessor/AssessorSections.tsx)):

| Digits | Segment                            | Example `9726307001` | 2473 Wyandotte `9721420021` |
| ------ | ---------------------------------- | -------------------- | --------------------------- |
| 1      | Range (last digit; `9` = range 69) | `9`                  | `9`                         |
| 2      | Township                           | `7`                  | `7`                         |
| 3–4    | Section                            | `26`                 | `21`                        |
| 5      | Quarter section                    | `3`                  | `4`                         |
| 6–7    | Block                              | `07`                 | `20`                        |
| 8–10   | Lot                                | `001`                | `021`                       |

The parcel block/lot are survey-grid identifiers and may differ from the platted block/lot in the legal description (e.g. `LOT 21, BLK 2, BROWN FARM`). Parcels that aren't 10 digits are shown unsplit.

### Data notes

- `treasurerPropertyInfo.ACTUAL_LAND_VAL` / `ASSESSED_LAND_VAL` hold the **total** property value (land + improvement), not land only; the UI labels them "Actual value" / "assessed".
- `improvement.adjyrblt` is the assessor's effective year built, reflecting remodels.
- Deed-type labels and the area-vs-count rule for building features are frontend heuristics, not provided by the API.

### Code map

| Path                                                                                                       | Purpose                                                         |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [api/AssessorAnalysis/index.ts](api/AssessorAnalysis/index.ts)                                             | Azure Function HTTP trigger (`assessor-analysis` route)         |
| [api/src/http/validation.ts](api/src/http/validation.ts)                                                   | Query param validation                                          |
| [api/src/assessor/endpoints.ts](api/src/assessor/endpoints.ts)                                             | Upstream URL builders and section list                          |
| [api/src/assessor/client.ts](api/src/assessor/client.ts)                                                   | Account lookup, parallel section fetch, partial-result handling |
| [api/src/models/assessor.ts](api/src/models/assessor.ts)                                                   | Response types                                                  |
| [frontend/src/features/assessor/AssessorSections.tsx](frontend/src/features/assessor/AssessorSections.tsx) | Section renderers and table fallback                            |

### Adding a section

1. Add the key to `SectionName` in [api/src/models/assessor.ts](api/src/models/assessor.ts) and to `sections` / the `prop` map in [api/src/assessor/endpoints.ts](api/src/assessor/endpoints.ts).
2. It will render as a table automatically. For a custom view, add a renderer to the `views` map in [AssessorSections.tsx](frontend/src/features/assessor/AssessorSections.tsx); map order controls display order.
