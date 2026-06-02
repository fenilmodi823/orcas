import os
import sys
import json
import logging
import asyncio
import requests
from datetime import datetime, timezone

# Robust absolute paths
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
ASTEROID_CATALOG_PATH = os.path.join(PROJECT_ROOT, "data", "catalogs", "PHA.text")
LIVE_DEBRIS_PATH = os.path.join(PROJECT_ROOT, "data", "catalogs", "live_debris.json")

# Global timestamp of the last successful sync
LAST_SYNC_TIME = None

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)
logger = logging.getLogger("telemetry_worker")


def write_file_safely(path: str, content: str) -> None:
    """
    Writes file content safely using a temporary file and atomic replace.
    Ensures that ML models and other utilities can read the file seamlessly
    without lockups or partial/corrupted reads.
    """
    os.makedirs(os.path.dirname(path), exist_ok=True)
    temp_path = f"{path}.tmp"
    with open(temp_path, "w", encoding="utf-8") as f:
        f.write(content)
    os.replace(temp_path, path)


def generate_fallback_from_pha() -> list:
    """
    Reads local PHA.text and parses it into a minimal JSON-compatible format.
    Used as a graceful fallback when live telemetry fetching fails and no cached JSON is present.
    """
    fallback_data = []
    if os.path.exists(ASTEROID_CATALOG_PATH):
        try:
            with open(ASTEROID_CATALOG_PATH, "r", encoding="utf-8", errors="ignore") as f:
                for line in f:
                    if not line.strip():
                        continue
                    # MPC format name is usually at columns 166-200
                    name = line[166:200].strip() if len(line) > 166 else None
                    if not name:
                        # Fallback parsing strategy: match parentheses
                        if "(" in line and ")" in line:
                            idx_start = line.rfind("(")
                            idx_end = line.rfind(")")
                            if idx_start != -1 and idx_end != -1 and idx_end > idx_start:
                                name = line[idx_start:idx_end+25].strip()
                    
                    if not name:
                        name = "Unknown Asteroid/PHA"
                    
                    fallback_data.append({
                        "OBJECT_NAME": name,
                        "OBJECT_ID": "FALLBACK-PHA",
                        "COMMENT": "Graceful fallback generated from local PHA.text catalog"
                    })
        except Exception as e:
            logger.error(f"Error parsing PHA.text for fallback generation: {e}")
            
    if not fallback_data:
        fallback_data = [{"OBJECT_NAME": "Fallback Object", "OBJECT_ID": "00000", "COMMENT": "Default empty fallback placeholder"}]
        
    return fallback_data


async def fetch_live_debris_data() -> None:
    """
    Infinite async loop that downloads the newest debris data from CelesTrak every 12 hours.
    Runs asynchronously on background executor threads to avoid blocking FastAPI.
    """
    global LAST_SYNC_TIME
    url = "https://celestrak.org/NORAD/elements/gp.php?GROUP=debris&FORMAT=json"
    
    while True:
        logger.info("Initializing live telemetry daemon fetch sequence...")
        try:
            loop = asyncio.get_running_loop()
            
            # Execute blocking network request in the thread pool executor
            response = await loop.run_in_executor(
                None,
                lambda: requests.get(url, timeout=25)
            )
            response.raise_for_status()
            data = response.json()
            
            # Serialize JSON
            json_str = json.dumps(data, indent=2)
            
            # Execute atomic/safe write in the thread pool executor
            await loop.run_in_executor(
                None,
                lambda: write_file_safely(LIVE_DEBRIS_PATH, json_str)
            )
            
            LAST_SYNC_TIME = datetime.now(timezone.utc).isoformat()
            logger.info(f"Live telemetry background sync successful. Objects fetched: {len(data)}. Sync timestamp: {LAST_SYNC_TIME}")
            
        except Exception as e:
            # Handle failure gracefully: log alert and failover
            logger.error(f"ALERT: CelesTrak API sync failed: {e}. Graceful failover initiated.")
            
            if not os.path.exists(LIVE_DEBRIS_PATH):
                logger.warning(f"No existing {LIVE_DEBRIS_PATH} cache found. Constructing fallback file from PHA.text...")
                try:
                    fallback_list = generate_fallback_from_pha()
                    fallback_json_str = json.dumps(fallback_list, indent=2)
                    write_file_safely(LIVE_DEBRIS_PATH, fallback_json_str)
                    logger.info("Fallback live_debris.json constructed successfully.")
                except Exception as write_err:
                    logger.error(f"Failed to write fallback data to {LIVE_DEBRIS_PATH}: {write_err}")
            else:
                logger.info(f"Retaining existing cached telemetry catalog at {LIVE_DEBRIS_PATH}.")
                
        # Sleep for 12 hours (43200 seconds)
        await asyncio.sleep(43200)


if __name__ == "__main__":
    # Script execution mode for direct manual validation
    logger.info("Running manual telemetry worker fetch...")
    asyncio.run(fetch_live_debris_data())
