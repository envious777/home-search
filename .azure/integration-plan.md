# Integration Plan

## Backend

- Folder: `api/`
- Run: `func start --script-root api`
- Port: `7071`
- Build: `npm run build --workspace api`
- Health: `GET /api/health`
- Analysis: `GET /api/assessor-analysis`

## Frontend

- Folder: `frontend/`
- Build: `npm run build --workspace frontend`
- Dev: `npm run dev --workspace frontend`
- API seam: `frontend/src/App.tsx` (`apiBase` and assessor fetch)
- Mock files to delete: none created

## API routes

- GET `/api/health`
- GET `/api/assessor-analysis?fromAddrNum=&toAddrNum=&address=&city=&zip=`

## Database

- None. No migrations and NO seed data are to be created.

## Shared types

- Frontend-local `frontend/src/types.ts`; backend-local `api/src/models/assessor.ts`.

## Services

- Essential: Azure Blob Storage via `STORAGE_CONNECTION_STRING` / `AzureWebJobsStorage`.
- Enhancement: none.
