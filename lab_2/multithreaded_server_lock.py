import http.server
import socketserver
import threading
import time
from collections import defaultdict
import mimetypes
import os

PORT = 8000
REQUEST_DELAY = 1
RATE_LIMIT = 5

request_counter = defaultdict(int)
counter_lock = threading.Lock()
rate_limit_dict = defaultdict(list)
rate_lock = threading.Lock()

class Lab2HTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        client_ip = self.client_address[0]

        with rate_lock:
            now = time.time()
            timestamps = rate_limit_dict[client_ip]
            timestamps = [t for t in timestamps if now - t < 1]
            if len(timestamps) >= RATE_LIMIT:
                self.send_response(429)
                self.end_headers()
                self.wfile.write(b"Rate limit exceeded\n")
                return
            timestamps.append(now)
            rate_limit_dict[client_ip] = timestamps

        time.sleep(REQUEST_DELAY)

        with counter_lock:
            request_counter[self.path] += 1

        filepath = self.translate_path(self.path)
        if os.path.isdir(filepath):
            self.list_directory(filepath)
            return
        if os.path.exists(filepath):
            self.send_response(200)
            mimetype, _ = mimetypes.guess_type(filepath)
            if not mimetype:
                mimetype = "application/octet-stream"
            self.send_header("Content-type", mimetype)
            self.send_header("Content-Length", str(os.path.getsize(filepath)))
            self.end_headers()
            with open(filepath, "rb") as f:
                self.wfile.write(f.read())
        else:
            self.send_error(404, "File not found")

    def list_directory(self, path):
        try:
            from html import escape
            file_list = os.listdir(path)
            file_list.sort()
            r = []
            displaypath = escape(self.path)
            r.append(f"<html><head><title>Directory listing for {displaypath}</title></head>")
            r.append(f"<body><h2>Directory listing for {displaypath}</h2><hr><ul>")
            for name in file_list:
                fullname = os.path.join(path, name)
                display_name = name
                if os.path.isdir(fullname):
                    display_name += "/"
                relative_path = os.path.join(self.path, name)
                count = request_counter.get(relative_path, 0)
                r.append(f'<li><a href="{escape(display_name)}">{escape(display_name)}</a> - Requests: {count}</li>')
            r.append("</ul><hr></body></html>")
            encoded = "\n".join(r).encode("utf-8", "surrogateescape")
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)
        except Exception as e:
            self.send_error(500, str(e))

class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

if __name__ == "__main__":
    server = ThreadedHTTPServer(("", PORT), Lab2HTTPRequestHandler)
    print(f"Serving on port {PORT} (WITH LOCK — thread-safe)")
    server.serve_forever()
