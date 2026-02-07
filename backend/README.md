# FastAPI Backend for Car Listing Visualization

This is a Python FastAPI backend that replaces the previous Node.js Express backend.

## Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Copy `.env.example` to `.env` and configure your database credentials.

3. Run the server:
```bash
# Development mode with auto-reload
uvicorn main:app --reload --port 5001

# Production mode
uvicorn main:app --host 0.0.0.0 --port 5001
```

## API Endpoints

- `GET /` - Health check
- `GET /api/listings` - Get car listings with optional filters
  - Query params: `limit`, `offset`, `q` (text search), `vin`, `listing_id`, `make_id`, `model_id`, `min_year`, `max_year`, `min_price`, `max_price`, `min_odometer`, `max_odometer`, `drive`, `transmission`, `with_coords`, `user_lat`, `user_lon`, `radius`, `radius_unit`
  - If `user_lat`, `user_lon`, and `radius` are provided, results will be filtered to listings within the distance (as-the-crow-flies). The response will include `distance` (numeric) and `distance_unit` (`mi` or `km`) when a geo filter is applied.
- `GET /api/makes` - Get list of car makes
- `GET /api/models?make_id=<id>` - Get list of models (optionally filtered by make)
- `GET /api/drives` - Get list of drive types
- `GET /api/transmissions` - Get list of transmission types

## Migration from Node.js

The Python FastAPI backend is fully compatible with the existing frontend. All endpoints return the same JSON structure as the Node.js version.
