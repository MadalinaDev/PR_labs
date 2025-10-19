import http.server
import time
import os
import mimetypes

PORT = 8000
REQUEST_DELAY = 1

class SingleThreadedHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        time.sleep(REQUEST_DELAY)
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

if __name__ == "__main__":
    server = http.server.HTTPServer(("", PORT), SingleThreadedHandler)
    print(f"Serving single-threaded on port {PORT}")
    server.serve_forever()
