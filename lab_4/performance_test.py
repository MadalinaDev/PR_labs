import asyncio
import httpx
import time
import matplotlib.pyplot as plt
import os

LEADER_URL = "http://localhost:8000"

async def write_key(key, value):
    async with httpx.AsyncClient() as client:
        start = time.perf_counter()
        await client.post(f"{LEADER_URL}/set", json={"key": key, "value": value})
        return time.perf_counter() - start

async def run_batch():
    latencies = []
    for i in range(100):  # 100 writes per quorum
        latency = await write_key(f"key{i}", f"value{i}")
        latencies.append(latency)
    return sum(latencies) / len(latencies)

async def main():
    trials = 1
    quorum_range = range(1, 6)
    all_results = {trial: [] for trial in range(1, trials+1)}

    for trial in range(1, trials + 1):
        print(f"\n=== TRIAL {trial} ===")
        for quorum in quorum_range:
            os.environ["WRITE_QUORUM"] = str(quorum)
            avg_latency = await run_batch()
            print(f"Trial {trial} - Quorum {quorum}: {avg_latency:.3f}s")
            all_results[trial].append(avg_latency)

    # Plot
    plt.figure(figsize=(10, 6))

    for trial in range(1, trials+1):
        plt.plot(
            list(quorum_range),
            all_results[trial],
            marker="o",
            label=f"Trial {trial}"
        )

    plt.xlabel("Write Quorum")
    plt.ylabel("Average Write Latency (s)")
    plt.title("Quorum vs Write Latency (5 Trials)")
    plt.legend()
    plt.grid(True)
    plt.show()

    # Checking replica consistency
    async with httpx.AsyncClient() as client:
        mismatches = 0
        for i in range(100):
            key = f"key{i}"
            leader_resp = await client.get(f"{LEADER_URL}/get/{key}")
            leader_value = leader_resp.json().get("value")
            for port in range(8001, 8006):
                follower_resp = await client.get(f"http://localhost:{port}/get/{key}")
                follower_value = follower_resp.json().get("value")
                if follower_value != leader_value:
                    mismatches += 1
                    print(f"Mismatch for {key} on follower {port}: {follower_value} != {leader_value}")
        if mismatches == 0:
            print("All replicas match the leader!")
        else:
            print(f"Total mismatches: {mismatches}")



asyncio.run(main())
