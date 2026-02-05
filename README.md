# CarListing Visualization (TypeScript + Tailwind + shadcn-ready)

This is a minimal Vite + React + TypeScript scaffold tailored for visualizing `CarListingData`.
It uses Tailwind for styles and component placeholders that can be replaced with `shadcn` components.

Quick start

1. Create the project and install deps:

```bash
cd CarListingVisualization
# install using npm or yarn
npm install
```

2. Initialize Tailwind (already configured files included)

3. To integrate shadcn UI follow their docs: https://ui.shadcn.com/

4. Run dev server:

```bash
npm run dev
```

Proxy configuration

The dev server proxies requests starting with `/api` to the backend. By default it forwards to `http://localhost:5000`.

To change the backend target, set `BACKEND_URL` when starting the dev server:

```bash
BACKEND_URL=http://your-backend:5000 npm run dev
```

Notes

- Replace ListingCard and Filters with `shadcn` components after running their setup.

Shadcn integration

- This scaffold includes lightweight shadcn-style components under `src/components/ui` (`Button`, `Input`, `Card`) and a `cn` helper in `src/utils/cn.ts`.
- To fully use the official `shadcn/ui` toolchain, run their setup in this project and replace the placeholder components; these files are already structured to be compatible.
- Backend endpoints expected at `/api/listings` — adjust `src/components/Dashboard.tsx`.
- The listing descriptions in DB are base64-compressed strings; you may add a helper to decode and decompress.

If you want, I can:
- Complete `shadcn` integration (generate component files and Tailwind tokens)
- Add a small Express proxy that talks to your existing backend
- Add map visualization (Leaflet or Mapbox) and clustering
