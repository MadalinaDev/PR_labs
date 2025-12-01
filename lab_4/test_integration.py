import asyncio
import httpx

LEADER_URL = "http://localhost:8000"
FOLLOWERS = [f"http://localhost:{i}" for i in range(8001, 8006)]

async def test_write_read():
    async with httpx.AsyncClient() as client:
        await client.post(f"{LEADER_URL}/set", json={"key": "foo", "value": "bar"})
        resp = await client.get(f"{LEADER_URL}/get/foo")
        print("Leader:", resp.json())
        for f in FOLLOWERS:
            r = await client.get(f"{f}/get/foo")
            print(f"Follower {f}:", r.json())

asyncio.run(test_write_read())
