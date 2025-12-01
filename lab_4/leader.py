import os
import asyncio
import random
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import httpx
from fastapi import Body


app = FastAPI()
store = {}

FOLLOWERS = os.getenv("FOLLOWERS", "").split(",")
WRITE_QUORUM = int(os.getenv("WRITE_QUORUM", 3))
MIN_DELAY = int(os.getenv("MIN_DELAY", 0)) / 1000
MAX_DELAY = int(os.getenv("MAX_DELAY", 1000)) / 1000

class Item(BaseModel):
    key: str
    value: str

async def replicate_to_follower(follower_url, key, value):
    delay = random.uniform(MIN_DELAY, MAX_DELAY)
    await asyncio.sleep(delay)
    async with httpx.AsyncClient() as client:
        try:
            await client.post(f"{follower_url}/replicate", json={"key": key, "value": value}, timeout=5)
            return True
        except:
            return False

@app.post("/set")
async def set_value(item: Item):
    store[item.key] = item.value
    tasks = [replicate_to_follower(f, item.key, item.value) for f in FOLLOWERS]
    success_count = 0

    for task in asyncio.as_completed(tasks):
        result = await task
        if result:
            success_count += 1
        if success_count >= WRITE_QUORUM:
            return {"status": "success"}

    raise HTTPException(status_code=500, detail="Write quorum not reached")


@app.get("/get/{key}")
async def get_value(key: str):
    return {"key": key, "value": store.get(key, None)}


@app.post("/config")
async def update_quorum(write_quorum: int = Body(...)):
    global WRITE_QUORUM
    WRITE_QUORUM = write_quorum
    return {"status": "ok", "WRITE_QUORUM": WRITE_QUORUM}
