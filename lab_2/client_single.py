import requests
import time
import os

SERVER_HOST = os.getenv("SERVER_HOST", "localhost")
SERVER_PORT = os.getenv("SERVER_PORT", "8000")

URLS = [
    f"http://{SERVER_HOST}:{SERVER_PORT}/public/book_1.pdf",
    f"http://{SERVER_HOST}:{SERVER_PORT}/public/book_2.pdf",
    f"http://{SERVER_HOST}:{SERVER_PORT}/public/book_3.pdf",
    f"http://{SERVER_HOST}:{SERVER_PORT}/public/books.png",
    f"http://{SERVER_HOST}:{SERVER_PORT}/public/book_shelf.png",
    f"http://{SERVER_HOST}:{SERVER_PORT}/public/book_1.pdf",
    f"http://{SERVER_HOST}:{SERVER_PORT}/public/book_1.pdf",
    f"http://{SERVER_HOST}:{SERVER_PORT}/public/book_1.pdf",
    f"http://{SERVER_HOST}:{SERVER_PORT}/public/book_1.pdf",
    f"http://{SERVER_HOST}:{SERVER_PORT}/public/book_1.pdf",
]

start = time.time()

for i, url in enumerate(URLS):
    r = requests.get(url)
    print(f"Request {i+1} to {url}: {r.status_code}")

end = time.time()
print(f"Total time for {len(URLS)} sequential requests: {end - start:.2f}s")
