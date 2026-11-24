# CSE Analyzer

Next.js 14 (App Router) + TypeScript + Tailwind + Recharts, using the public cse.lk API.

    npm install
    npm run dev      # http://localhost:3000

Pages: Market overview (/), Stocks explorer (/stocks), Stock detail with chart (/stock/LOLC.N0000), Sectors, Announcements.

Server components call cse.lk directly (30s cache). Charts call /api/cse/[endpoint], a small proxy that avoids CORS.
CSE response shapes are not formally documented: field mappings live in lib/cse.ts (toRow) and each page uses pick() with fallbacks. Log a raw response and adjust if a column shows "–".
