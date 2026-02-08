from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import asyncpg
import os
import zlib
import base64
import subprocess
import asyncio
import signal
from dotenv import load_dotenv
from typing import Optional, List
import httpx


load_dotenv()

app = FastAPI(title="CarListingVisualization Backend")

# Track active processes for cancellation
active_processes = {}

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# PostgreSQL connection pool - credentials from environment variables only
pg_config = {
    'host': os.getenv('PGHOST'),
    'port': int(os.getenv('PGPORT', '5432')),
    'database': os.getenv('PGDATABASE'),
    'user': os.getenv('PGUSER'),
    'password': os.getenv('PGPASSWORD')
}

# Required environment variables for DB connectivity
required_vars = ['PGHOST', 'PGDATABASE', 'PGUSER', 'PGPASSWORD']

# Track background DB init task
db_init_task: Optional[asyncio.Task] = None

import ssl

# Enable SSL for remote connections and create SSL context
PG_SSL_VERIFY = os.getenv('PGSSLVERIFY', 'true').lower() not in ('0', 'false', 'no')
if pg_config['host'] not in ['localhost', '127.0.0.1']:
    if PG_SSL_VERIFY:
        # If user provided a root CA file (PGSSLROOTCERT), use it
        ssl_cafile = os.getenv('PGSSLROOTCERT')
        if ssl_cafile and os.path.exists(ssl_cafile):
            try:
                SSL_CONTEXT = ssl.create_default_context(cafile=ssl_cafile)
            except Exception as e:
                print(f"⚠️  Failed to load SSL CA file {ssl_cafile}: {e}", flush=True)
                SSL_CONTEXT = ssl.create_default_context()
        else:
            # Prefer certifi bundle if available, fall back to system default
            try:
                import certifi
                SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
            except Exception:
                SSL_CONTEXT = ssl.create_default_context()
    else:
        # Insecure: do not verify certificate (for testing environments with self-signed certs)
        SSL_CONTEXT = ssl.SSLContext()
        SSL_CONTEXT.check_hostname = False
        SSL_CONTEXT.verify_mode = ssl.CERT_NONE
else:
    SSL_CONTEXT = None

# Async connection pool (initialized on startup)
pool: Optional[asyncpg.pool.Pool] = None

async def _init_db_pool_once():
    global pool
    pool = await asyncpg.create_pool(
        host=pg_config['host'],
        port=pg_config['port'],
        user=pg_config['user'],
        password=pg_config['password'],
        database=pg_config['database'],
        min_size=1,
        max_size=20,
        ssl=SSL_CONTEXT
    )


async def _retry_db_pool(max_attempts: int = 30, delay_seconds: int = 10):
    """Retry DB pool initialization in the background without crashing the app."""
    global pool
    for attempt in range(1, max_attempts + 1):
        if pool is not None:
            return
        try:
            await _init_db_pool_once()
            print("✅ DB connection pool initialized (retry)", flush=True)
            return
        except Exception as e:
            print(f"⚠️  DB connection failed (attempt {attempt}/{max_attempts}): {e}", flush=True)
            await asyncio.sleep(delay_seconds)
    print("⚠️  DB connection failed after retries; running without DB pool", flush=True)


@app.on_event("startup")
async def startup():
    global pool, db_init_task
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    if missing_vars:
        print(f"⚠️  Missing required DB environment variables: {', '.join(missing_vars)}", flush=True)
        print("⚠️  Backend will start without DB connectivity", flush=True)
        return
    try:
        await _init_db_pool_once()
        print("✅ DB connection pool initialized", flush=True)
    except Exception as e:
        print(f"⚠️  DB connection failed on startup: {e}", flush=True)
        if db_init_task is None or db_init_task.done():
            db_init_task = asyncio.create_task(_retry_db_pool())

    # Log SSL verification status at startup
    try:
        if SSL_CONTEXT is None:
            print("🔒 DB SSL: not used (local host)", flush=True)
        elif PG_SSL_VERIFY:
            print("🔒 DB SSL verification: ENABLED (using certifi/system CA)", flush=True)
        else:
            print("⚠️  DB SSL verification: DISABLED (INSECURE - certificates not verified)", flush=True)
    except Exception:
        print("⚠️  DB SSL verification: status unknown")

    # Verify server-side SSL usage for the new connection (if possible)
    if pool is None:
        return
    try:
        async with pool.acquire() as conn:
            try:
                row = await conn.fetchrow("SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()")
                ssl_used = None
                if row is not None:
                    # row can be a Record or mapping
                    ssl_used = row.get('ssl') if hasattr(row, 'get') else (row[0] if len(row) > 0 else None)

                if ssl_used is True:
                    if os.getenv('PGSSLROOTCERT'):
                        print("🔒 DB SSL: connection established and verified using pinned CA", flush=True)
                    elif PG_SSL_VERIFY:
                        print("🔒 DB SSL: connection established and SSL verification enabled (using certifi/system CA)", flush=True)
                    else:
                        print("🔒 DB SSL: connection established with SSL but verification disabled (insecure)", flush=True)
                elif ssl_used is False:
                    print("⚠️  DB SSL: connection established but not using SSL", flush=True)
                else:
                    print("⚠️  DB SSL: unable to determine server SSL usage (pg_stat_ssl may be unavailable)", flush=True)
            except Exception as e:
                print(f"⚠️  DB SSL verification check failed: {e}", flush=True)
    except Exception as e:
        print(f"⚠️  Could not acquire DB connection to verify SSL: {e}")

@app.on_event("shutdown")
async def shutdown():
    global pool
    if pool:
        await pool.close()
        pool = None


def decompress_description(b64: str) -> Optional[str]:
    """Decompress listing description from base64+zlib."""
    if not b64:
        return None
    try:
        buf = base64.b64decode(b64)
        try:
            out = zlib.decompress(buf)
            return out.decode('utf-8')
        except:
            # Not compressed; try to decode as UTF-8
            try:
                s = buf.decode('utf-8')
                return s if '\ufffd' not in s else b64
            except:
                return b64
    except:
        return b64


@app.get("/")
def root():
    return {"message": "CarListingVisualization backend"}


@app.get("/api/stats")
async def get_stats():
    """Get database statistics: total listings and total cars.
    Uses a short statement_timeout and falls back to estimated counts if needed."""
    if pool is None:
        raise HTTPException(status_code=500, detail="Database pool not initialized")

    async with pool.acquire() as conn:
        try:
            # Fail fast if COUNT(*) would take too long (5s)
            await conn.execute("SET LOCAL statement_timeout = 5000")
            total_listings = await conn.fetchval("SELECT COUNT(*) FROM listings")
            total_cars = await conn.fetchval("SELECT COUNT(*) FROM cars")
            return {"total_listings": total_listings, "total_cars": total_cars}
        except Exception as e:
            # Fallback to estimated counts
            try:
                est_listings = await conn.fetchval("SELECT COALESCE(reltuples::bigint,0) FROM pg_class WHERE relname = 'listings'")
                est_cars = await conn.fetchval("SELECT COALESCE(reltuples::bigint,0) FROM pg_class WHERE relname = 'cars'")
                return {
                    "total_listings": int(est_listings or 0),
                    "total_cars": int(est_cars or 0),
                    "note": "estimated counts due to DB timeout/error"
                }
            except Exception:
                raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/api/listings")
async def get_listings(
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    q: Optional[str] = None,
    vin: Optional[str] = None,
    listing_id: Optional[int] = None,
    make_id: Optional[int] = None,
    model_id: Optional[int] = None,
    min_year: Optional[int] = None,
    max_year: Optional[int] = None,
    min_price: Optional[int] = None,
    max_price: Optional[int] = None,
    min_odometer: Optional[int] = None,
    max_odometer: Optional[int] = None,
    drive: Optional[int] = None,
    transmission: Optional[int] = None,
    with_coords: bool = False,
    user_lat: Optional[float] = None,
    user_lon: Optional[float] = None,
    radius: Optional[float] = None,
    radius_unit: Optional[str] = 'mi'
):
    """Get listings with optional filtering."""
    if pool is None:
        return []

    # Build filters using $n placeholders for asyncpg
    filters = []
    params: List = []

    if listing_id:
        filters.append(f"l.listing_id = ${len(params) + 1}")
        params.append(listing_id)

    if vin:
        filters.append(f"c.vin_id ILIKE ${len(params) + 1}")
        params.append(f"%{vin}%")

    if with_coords:
        filters.append("l.listing_latitude IS NOT NULL AND l.listing_longitude IS NOT NULL")

    if min_price is not None:
        filters.append(f"listing_price >= ${len(params) + 1}")
        params.append(min_price)

    if max_price is not None:
        filters.append(f"listing_price <= ${len(params) + 1}")
        params.append(max_price)

    if make_id is not None:
        filters.append(f"mk.make_id = ${len(params) + 1}")
        params.append(make_id)

    if model_id is not None:
        filters.append(f"c.model_id = ${len(params) + 1}")
        params.append(model_id)

    if min_year is not None:
        filters.append(f"c.year >= ${len(params) + 1}")
        params.append(min_year)

    if max_year is not None:
        filters.append(f"c.year <= ${len(params) + 1}")
        params.append(max_year)

    if min_odometer is not None:
        filters.append(f"l.listing_odometer >= ${len(params) + 1}")
        params.append(min_odometer)

    if max_odometer is not None:
        filters.append(f"l.listing_odometer <= ${len(params) + 1}")
        params.append(max_odometer)

    if drive is not None:
        filters.append(f"c.drives_id = ${len(params) + 1}")
        params.append(drive)

    if transmission is not None:
        filters.append(f"c.transmission_id = ${len(params) + 1}")
        params.append(transmission)

    # Handle geo-distance filter (haversine/acos formula). If user provides lat/lon and a radius, apply filter.
    geo_distance_expr = None
    geo_used = False
    if user_lat is not None and user_lon is not None and radius is not None:
        # Ensure listings have coords
        if not with_coords:
            filters.append("l.listing_latitude IS NOT NULL AND l.listing_longitude IS NOT NULL")
        # Choose Earth radius in requested units
        earth_radius = 3958.7613 if (radius_unit or 'mi') == 'mi' else 6371.0088
        # Parameter indices for user lat, lon, and radius
        lat_idx = len(params) + 1
        lon_idx = len(params) + 2
        radius_idx = len(params) + 3
        geo_distance_expr = (
            f"({earth_radius} * acos(cos(radians(${lat_idx})) * cos(radians(l.listing_latitude)) * "
            f"cos(radians(l.listing_longitude) - radians(${lon_idx})) + sin(radians(${lat_idx})) * sin(radians(l.listing_latitude))))"
        )
        # Filter by distance
        filters.append(f"{geo_distance_expr} <= ${radius_idx}")
        # Append user params in the same order
        params.extend([user_lat, user_lon, radius])
        geo_used = True
        print(f"Applying geo filter: lat={user_lat} lon={user_lon} radius={radius} unit={radius_unit}")

    sql_limit = min(max(limit * 10, 100), 1000) if (q or vin or listing_id) else limit

    # Build SELECT and include a distance column when geo is used for ordering
    select_extra = f", {geo_distance_expr} AS distance" if geo_used else ""

    query = f"""
        SELECT 
            l.listing_id, 
            l.listing_price, 
            l.listing_odometer, 
            d.description_text AS listing_description, 
            l.listing_vin_id,
            l.listing_latitude AS listing_lat,
            l.listing_longitude AS listing_lon,
            r.region_name AS listing_region, 
            c.year AS listing_year,
            mk.make_name || ' ' || md.model_name AS listing_make_model,
            tr.transmission_type AS listing_transmission_type,
            dr.drives_type AS listing_drive_type{select_extra}
        FROM listings l
        LEFT JOIN cars c ON l.listing_vin_id = c.vin_id
        LEFT JOIN models md ON c.model_id = md.model_id
        LEFT JOIN makes mk ON md.make_id = mk.make_id
        LEFT JOIN drives dr ON c.drives_id = dr.drives_id
        LEFT JOIN transmissions tr ON c.transmission_id = tr.transmission_id
        LEFT JOIN regions r ON l.listing_region_id = r.region_id
        LEFT JOIN descriptions d ON l.listing_description_id = d.description_id
    """

    if filters:
        query += " WHERE " + " AND ".join(filters)

    params.extend([sql_limit, 0])
    if geo_used:
        query += f" ORDER BY distance ASC, l.listing_id DESC LIMIT ${len(params)-1} OFFSET ${len(params)}"
    else:
        query += f" ORDER BY l.listing_id DESC LIMIT ${len(params)-1} OFFSET ${len(params)}"

    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
    except Exception as e:
        print(f"DB error: {e}")
        return []

    print(f"DB query returned {len(rows)} rows")
    skipped_vin_count = 0
    results = []
    for row in rows:
        vin = row['listing_vin_id']
        if vin and len(vin) > 17:
            skipped_vin_count += 1
            continue
        results.append({
            'listing_id': row['listing_id'],
            'listing_price': row['listing_price'],
            'listing_odometer': row['listing_odometer'],
            'listing_description': decompress_description(row['listing_description']),
            'listing_vin_id': vin,
            'listing_lat': str(row['listing_lat']) if row['listing_lat'] is not None else None,
            'listing_lon': str(row['listing_lon']) if row['listing_lon'] is not None else None,
            'listing_region': row['listing_region'],
            'listing_year': row['listing_year'],
            'listing_make_model': row['listing_make_model'],
            'listing_transmission_type': row['listing_transmission_type'],
            'listing_drive_type': row['listing_drive_type'],
            'distance': float(row['distance']) if 'distance' in row and row['distance'] is not None else None,
            'distance_unit': 'mi' if geo_used and (radius_unit or 'mi') == 'mi' else ('km' if geo_used else None)
        })

    if skipped_vin_count > 0:
        print(f"Skipped {skipped_vin_count} listings due to long VIN (>17 chars)")

    if q:
        lower_q = q.lower()
        results = [
            r for r in results
            if (lower_q in (r['listing_description'] or '').lower() or
                lower_q in (r['listing_vin_id'] or '').lower())
        ]
        results = results[offset:offset + limit]
    else:
        if offset > 0:
            results = results[offset:offset + limit]

    print(f"Returning {len(results)} results")
    return results


@app.get("/api/makes")
async def get_makes():
    """Get list of makes."""
    if pool is None:
        return []
    async with pool.acquire() as conn:
        try:
            rows = await conn.fetch("SELECT make_id, make_name FROM makes ORDER BY make_name")
            return [{"make_id": r['make_id'], "make_name": r['make_name']} for r in rows]
        except Exception as e:
            print(f"DB error: {e}")
            return []


@app.get("/api/models")
async def get_models(make_id: Optional[int] = None):
    """Get list of models, optionally filtered by make."""
    if pool is None:
        return []
    async with pool.acquire() as conn:
        try:
            if make_id:
                rows = await conn.fetch("SELECT model_id, model_name FROM models WHERE make_id = $1 ORDER BY model_name", make_id)
            else:
                rows = await conn.fetch("SELECT model_id, model_name FROM models ORDER BY model_name")
            return [{"model_id": r['model_id'], "model_name": r['model_name']} for r in rows]
        except Exception as e:
            print(f"DB error: {e}")
            return []


@app.get("/api/drives")
async def get_drives():
    """Get list of drive types."""
    if pool is None:
        return []
    async with pool.acquire() as conn:
        try:
            rows = await conn.fetch("SELECT drives_id AS id, drives_type AS name FROM drives ORDER BY drives_type")
            return [{"id": r['id'], "name": r['name']} for r in rows]
        except Exception as e:
            print(f"DB error: {e}")
            return []


@app.get('/api/geocode')
async def geocode_address(address: str):
    """Geocode an address using server-side Google Geocoding API if configured.

    Returns JSON: { lat: float, lon: float, formatted_address: str }
    If no server-side geocoder key is configured, returns 404 so clients can fall back to a public geocoder.
    """
    # Prefer server-side Google geocoding (keeps API key secret)
    gkey = os.getenv('GOOGLE_GEOCODER_KEY')
    if not gkey:
        # Indicate to clients that server-side geocoding is not available
        raise HTTPException(status_code=404, detail='Server-side geocoding not configured')

    url = 'https://maps.googleapis.com/maps/api/geocode/json'
    params = {'address': address, 'key': gkey}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(url, params=params)
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        print('Geocode HTTP error', e)
        raise HTTPException(status_code=502, detail='Geocoding failed')

    if data.get('status') != 'OK' or not data.get('results'):
        raise HTTPException(status_code=404, detail='No geocoding results')

    res = data['results'][0]
    loc = res['geometry']['location']
    formatted = res.get('formatted_address') or ''
    try:
        lat = float(loc['lat'])
        lon = float(loc['lng'])
    except Exception:
        raise HTTPException(status_code=502, detail='Invalid geocoding response')

    return {'lat': lat, 'lon': lon, 'formatted_address': formatted}


@app.get("/api/transmissions")
async def get_transmissions():
    """Get list of transmission types."""
    if pool is None:
        return []
    async with pool.acquire() as conn:
        try:
            rows = await conn.fetch("SELECT transmission_id AS id, transmission_type AS name FROM transmissions ORDER BY transmission_type")
            return [{"id": r['id'], "name": r['name']} for r in rows]
        except Exception as e:
            print(f"DB error: {e}")
            return []


class RemoveDuplicatesRequest(BaseModel):
    interactive: bool = False
    batch_size: int = 100


async def stream_subprocess_output(cmd, process_id="default"):
    """Stream subprocess output line by line."""
    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
        stdin=asyncio.subprocess.DEVNULL,  # Prevent hanging on input prompts
        cwd="/scripts"  # Updated to container path
    )
    
    # Store process for later cancellation
    active_processes[process_id] = process
    
    try:
        while True:
            line = await process.stdout.readline()
            if not line:
                break
            yield f"data: {line.decode('utf-8', errors='ignore')}\n\n"
        
        await process.wait()
        
        if process.returncode == 0:
            yield f"data: [DONE] Process completed successfully\n\n"
        elif process.returncode == -15:  # SIGTERM
            yield f"data: [CANCELLED] Process was cancelled by user\n\n"
        else:
            yield f"data: [ERROR] Process failed with code {process.returncode}\n\n"
    finally:
        # Remove from active processes
        if process_id in active_processes:
            del active_processes[process_id]

# Lambda handler using Mangum
try:
    from mangum import Mangum
    handler = Mangum(app, lifespan="off")
except ImportError:
    # Mangum not installed, skip Lambda handler
    pass

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "5001"))
    uvicorn.run(app, host="0.0.0.0", port=port)
