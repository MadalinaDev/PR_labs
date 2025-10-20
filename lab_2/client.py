import requests
from concurrent.futures import ThreadPoolExecutor
import time

URLS = [
    "http://localhost:8000/public/book_1.pdf",
    "http://localhost:8000/public/book_2.pdf",
    "http://localhost:8000/public/book_3.pdf",
    "http://localhost:8000/public/books.png",
    "http://localhost:8000/public/book_shelf.png",
    "http://localhost:8000/public/book_1.pdf",
    "http://localhost:8000/public/book_1.pdf",
    "http://localhost:8000/public/book_1.pdf",
    "http://localhost:8000/public/book_1.pdf",
    "http://localhost:8000/public/book_1.pdf",
]

NUM_REQUESTS = len(URLS)

def make_request(url, i):
    r = requests.get(url)
    print(f"Request {i} to {url}: {r.status_code}")

start = time.time()
with ThreadPoolExecutor(max_workers=NUM_REQUESTS) as executor:
    for i, url in enumerate(URLS):
        executor.submit(make_request, url, i)
end = time.time()

print(f"Total time for {NUM_REQUESTS} concurrent requests: {end - start:.2f}s")
