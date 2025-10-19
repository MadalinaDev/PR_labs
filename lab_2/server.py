import sys
import socket
import os
import pathlib
import urllib.parse
import mimetypes

HOST = '0.0.0.0'
PORT = 8000
BUFFER_SIZE = 8192
BASE_DIR = None

HTTP_404 = b"HTTP/1.1 404 Not Found\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: "
HTTP_200 = b"HTTP/1.1 200 OK\r\n"

def safe_path(request_path: str) -> pathlib.Path:
    unquoted = urllib.parse.unquote(request_path)
    if unquoted.startswith('/'):
        unquoted = unquoted[1:]
    candidate = (BASE_DIR / unquoted).resolve()
    if not str(candidate).startswith(str(BASE_DIR.resolve())):
        return None
    return candidate

def list_directory(path: pathlib.Path, url_path: str) -> bytes:
    entries = []
    for entry in sorted(path.iterdir()):
        name = entry.name + ('/' if entry.is_dir() else '')
        href = urllib.parse.quote(os.path.join(url_path, entry.name))
        entries.append(f'<li><a href="/{href}">{name}</a></li>')
    body = f"<html><head><meta charset=\"utf-8\"></head><body><h1>Index of /{url_path}</h1><ul>\n" + "\n".join(entries) + "\n</ul></body></html>"
    b = body.encode('utf-8')
    headers = HTTP_200 + b"Content-Type: text/html; charset=utf-8\r\nContent-Length: " + str(len(b)).encode() + b"\r\n\r\n"
    return headers + b

def guess_mime(path: pathlib.Path):
    mime, _ = mimetypes.guess_type(str(path))
    if mime in ("text/html", "image/png", "application/pdf"):
        return mime
    return None

def handle_request(conn: socket.socket, addr):
    try:
        data = conn.recv(BUFFER_SIZE)
        if not data:
            return
        first_line = data.split(b"\r\n", 1)[0].decode(errors='ignore')
        parts = first_line.split()
        if len(parts) < 2:
            return
        method, path = parts[0], parts[1]
        if method != 'GET':
            conn.sendall(b"HTTP/1.1 405 Method Not Allowed\r\nContent-Length: 0\r\n\r\n")
            return
        path_no_q = path.split('?', 1)[0]
        target = safe_path(path_no_q)
        if target is None or not target.exists():
            body = b"<html><body><h1>404 Not Found</h1></body></html>"
            resp = HTTP_404 + str(len(body)).encode() + b"\r\n\r\n" + body
            conn.sendall(resp)
            return
        if target.is_dir():
            index_file = target / 'index.html'
            if index_file.exists():
                target = index_file
            else:
                url_path = path_no_q.lstrip('/')
                resp = list_directory(target, url_path)
                conn.sendall(resp)
                return
        mime = guess_mime(target)
        if mime is None:
            body = b"<html><body><h1>404 Not Found</h1></body></html>"
            resp = HTTP_404 + str(len(body)).encode() + b"\r\n\r\n" + body
            conn.sendall(resp)
            return
        with open(target, 'rb') as f:
            content = f.read()
        headers = HTTP_200 + f"Content-Type: {mime}\r\nContent-Length: {len(content)}\r\n\r\n".encode()
        conn.sendall(headers + content)
    except Exception as e:
        print('Error handling request from', addr, e)
    finally:
        try:
            conn.shutdown(socket.SHUT_RDWR)
        except Exception:
            pass
        conn.close()

def serve(bind_host=HOST, bind_port=PORT):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind((bind_host, bind_port))
        s.listen(1)
        print(f"Serving HTTP on {bind_host} port {bind_port} (base dir: {BASE_DIR}) ...")
        while True:
            conn, addr = s.accept()
            print('Connection from', addr)
            handle_request(conn, addr)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python3 server.py /path/to/served_content [port]')
        sys.exit(1)
    BASE_DIR = pathlib.Path(sys.argv[1])
    if not BASE_DIR.exists() or not BASE_DIR.is_dir():
        print('Base directory does not exist or is not a directory')
        sys.exit(1)
    if len(sys.argv) >= 3:
        PORT = int(sys.argv[2])
    serve()
