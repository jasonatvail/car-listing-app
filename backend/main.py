from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import psycopg2
from psycopg2.pool import SimpleConnectionPool
import os
import zlib
import base64
import subprocess
import asyncio
import signal
from dotenv import load_dotenv
from typing import Optional, List

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

# Validate required environment variables
required_vars = ['PGHOST', 'PGDATABASE', 'PGUSER', 'PGPASSWORD']
missing_vars = [var for var in required_vars if not os.getenv(var)]
if missing_vars:
    raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")

# Enable SSL for remote connections
if pg_config['host'] not in ['localhost', '127.0.0.1']:
    pg_config['sslmode'] = 'require'

# Create connection pool
pool = SimpleConnectionPool(1, 20, **pg_config)


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


@app.get("/api/listings")
def get_listings(
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
    with_coords: bool = False
):
    """Get listings with optional filtering."""
    conn = pool.getconn()
    try:
        cursor = conn.cursor()
        
        # Build filters
        filters = []
        params = []
        idx = 1
        
        # Handle listing ID search - exact match
        if listing_id:
            filters.append(f"l.listing_id = %s")
            params.append(listing_id)
        
        # Handle VIN search - partial match
        if vin:
            filters.append(f"c.vin_id ILIKE %s")
            params.append(f"%{vin}%")
        
        if with_coords:
            filters.append("l.lat IS NOT NULL AND l.lon IS NOT NULL")
        
        if min_price is not None:
            filters.append("listing_price >= %s")
            params.append(min_price)
        
        if max_price is not None:
            filters.append("listing_price <= %s")
            params.append(max_price)
        
        if make_id is not None:
            filters.append("mk.make_id = %s")
            params.append(make_id)
        
        if model_id is not None:
            filters.append("c.model_id = %s")
            params.append(model_id)
        
        if min_year is not None:
            filters.append("c.year >= %s")
            params.append(min_year)
        
        if max_year is not None:
            filters.append("c.year <= %s")
            params.append(max_year)
        
        if min_odometer is not None:
            filters.append("l.listing_odometer >= %s")
            params.append(min_odometer)
        
        if max_odometer is not None:
            filters.append("l.listing_odometer <= %s")
            params.append(max_odometer)
        
        if drive is not None:
            filters.append("c.drives_id = %s")
            params.append(drive)
        
        if transmission is not None:
            filters.append("c.transmission_id = %s")
            params.append(transmission)
        
        # Fetch larger batch if text search is needed
        sql_limit = min(max(limit * 10, 100), 1000) if (q or vin or listing_id) else limit
        
        # Build query
        query = """
            SELECT 
                l.listing_id, 
                l.listing_price, 
                l.listing_odometer, 
                l.listing_description, 
                l.listing_vin_id,
                l.lat AS listing_lat,
                l.lon AS listing_lon,
                r.region_name AS listing_region, 
                c.year AS listing_year,
                mk.make_name || ' ' || md.model_name AS listing_make_model,
                tr.transmission_type AS listing_transmission_type,
                dr.drives_type AS listing_drive_type
            FROM listings l
            LEFT JOIN cars c ON l.listing_vin_id = c.vin_id
            LEFT JOIN models md ON c.model_id = md.model_id
            LEFT JOIN makes mk ON md.make_id = mk.make_id
            LEFT JOIN drives dr ON c.drives_id = dr.drives_id
            LEFT JOIN transmissions tr ON c.transmission_id = tr.transmission_id
            LEFT JOIN regions r ON l.listing_region_id = r.region_id
        """
        
        if filters:
            query += " WHERE " + " AND ".join(filters)
        
        query += f" ORDER BY l.listing_id DESC LIMIT %s OFFSET %s"
        params.extend([sql_limit, 0])
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        # Process results
        skipped_vin_count = 0
        results = []
        
        for row in rows:
            # Skip VINs longer than 17 characters
            if row[4] and len(row[4]) > 17:
                skipped_vin_count += 1
                continue
            
            results.append({
                'listing_id': row[0],
                'listing_price': row[1],
                'listing_odometer': row[2],
                'listing_description': decompress_description(row[3]),
                'listing_vin_id': row[4],
                'listing_lat': str(row[5]) if row[5] is not None else None,
                'listing_lon': str(row[6]) if row[6] is not None else None,
                'listing_region': row[7],
                'listing_year': row[8],
                'listing_make_model': row[9],
                'listing_transmission_type': row[10],
                'listing_drive_type': row[11]
            })
        
        if skipped_vin_count > 0:
            print(f"Skipped {skipped_vin_count} listings due to long VIN (>17 chars)")
        
        # Apply text search filter if provided
        if q:
            lower_q = q.lower()
            results = [
                r for r in results
                if (lower_q in (r['listing_description'] or '').lower() or
                    lower_q in (r['listing_vin_id'] or '').lower())
            ]
            # Apply offset/limit after filtering
            results = results[offset:offset + limit]
        else:
            # Apply offset if no post-filtering
            if offset > 0:
                results = results[offset:offset + limit]
        
        cursor.close()
        return results
        
    except Exception as e:
        print(f"DB error: {e}")
        return []
    finally:
        pool.putconn(conn)


@app.get("/api/makes")
def get_makes():
    """Get list of makes."""
    conn = pool.getconn()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT make_id, make_name FROM makes ORDER BY make_name")
        rows = cursor.fetchall()
        cursor.close()
        return [{"make_id": row[0], "make_name": row[1]} for row in rows]
    except Exception as e:
        print(f"DB error: {e}")
        return []
    finally:
        pool.putconn(conn)


@app.get("/api/models")
def get_models(make_id: Optional[int] = None):
    """Get list of models, optionally filtered by make."""
    conn = pool.getconn()
    try:
        cursor = conn.cursor()
        if make_id:
            cursor.execute("SELECT model_id, model_name FROM models WHERE make_id = %s ORDER BY model_name", (make_id,))
        else:
            cursor.execute("SELECT model_id, model_name FROM models ORDER BY model_name")
        rows = cursor.fetchall()
        cursor.close()
        return [{"model_id": row[0], "model_name": row[1]} for row in rows]
    except Exception as e:
        print(f"DB error: {e}")
        return []
    finally:
        pool.putconn(conn)


@app.get("/api/drives")
def get_drives():
    """Get list of drive types."""
    conn = pool.getconn()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT drives_id AS id, drives_type AS name FROM drives ORDER BY drives_type")
        rows = cursor.fetchall()
        cursor.close()
        return [{"id": row[0], "name": row[1]} for row in rows]
    except Exception as e:
        print(f"DB error: {e}")
        return []
    finally:
        pool.putconn(conn)


@app.get("/api/transmissions")
def get_transmissions():
    """Get list of transmission types."""
    conn = pool.getconn()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT transmission_id AS id, transmission_type AS name FROM transmissions ORDER BY transmission_type")
        rows = cursor.fetchall()
        cursor.close()
        return [{"id": row[0], "name": row[1]} for row in rows]
    except Exception as e:
        print(f"DB error: {e}")
        return []
    finally:
        pool.putconn(conn)


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


@app.post("/api/remove-duplicates")
async def remove_duplicates(request: RemoveDuplicatesRequest):
    """
    Trigger the RemoveDuplicateCars.py script to merge duplicate car records.
    Streams output in real-time using Server-Sent Events.
    """
    try:
        # Path to the script (container path)
        script_path = "/scripts/RemoveDuplicateCars.py"
        
        # Build the command - use -u flag for unbuffered output
        cmd = ["python3", "-u", script_path]
        
        if request.interactive:
            cmd.append("--interactive")
        
        # Add batch size parameter
        cmd.extend(["--batch-size", str(request.batch_size)])
        
        # Return a streaming response
        return StreamingResponse(
            stream_subprocess_output(cmd, "remove_duplicates"),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no"
            }
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error starting script: {str(e)}")


@app.post("/api/cancel-operation")
async def cancel_operation():
    """Cancel the currently running duplicate removal process."""
    try:
        if "remove_duplicates" in active_processes:
            process = active_processes["remove_duplicates"]
            process.terminate()  # Send SIGTERM
            
            # Wait a bit for graceful shutdown
            try:
                await asyncio.wait_for(process.wait(), timeout=5)
            except asyncio.TimeoutError:
                # Force kill if it doesn't respond
                process.kill()
                await process.wait()
            
            return {"message": "Process cancelled successfully"}
        else:
            raise HTTPException(status_code=404, detail="No active process to cancel")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error cancelling process: {str(e)}")


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
