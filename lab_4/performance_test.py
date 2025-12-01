import asyncio
import httpx
import time
import matplotlib.pyplot as plt

LEADER_URL = "http://localhost:8000"
FOLLOWERS = [f"http://localhost:{i}" for i in range(8001, 8006)]

async def write_key(key, value):
    async with httpx.AsyncClient() as client:
        start = time.perf_counter()
        await client.post(f"{LEADER_URL}/set", json={"key": key, "value": value})
        return time.perf_counter() - start

async def run_batch(quorum):
    latencies = []
    for i in range(10):  # 10 keys per batch
        latency = await write_key(f"key{i}", f"value{i}")
        latencies.append(latency)
    return sum(latencies)/len(latencies)

async def main():
    quorum_latencies = {}
    for quorum in range(1, 6):  
        import os
        os.environ["WRITE_QUORUM"] = str(quorum)
        avg_latency = await run_batch(quorum)
        print(f"Quorum {quorum}: {avg_latency:.3f}s")
        quorum_latencies[quorum] = avg_latency

    plt.plot(list(quorum_latencies.keys()), list(quorum_latencies.values()), marker='o')
    plt.xlabel("Write Quorum")
    plt.ylabel("Average Write Latency (s)")
    plt.title("Quorum vs Write Latency")
    plt.show()

asyncio.run(main())
