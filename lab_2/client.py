import sys
import socket
import os
import pathlib

BUFFER_SIZE = 8192

def recv_all(sock):
    chunks = []
    while True:
        data = sock.recv(BUFFER_SIZE)
        if not data:
            break
        chunks.append(data)
    return b''.join(chunks)

def parse_response(resp: bytes):
    sep = b"\r\n\r\n"
    if sep not in resp:
        return None, None, resp
    head, body = resp.split(sep, 1)
    headers = head.decode('iso-8859-1').split('\r\n')
    status_line = headers[0]
    hdrs = {}
    for h in headers[1:]:
        if ':' in h:
            k, v = h.split(':', 1)
            hdrs[k.strip().lower()] = v.strip()
    return status_line, hdrs, body

if __name__ == '__main__':
    if len(sys.argv) != 5:
        print('Usage: client.py server_host server_port url_path save_directory')
        sys.exit(1)
    host = sys.argv[1]
    port = int(sys.argv[2])
    path = sys.argv[3]
    save_dir = pathlib.Path(sys.argv[4])
    save_dir.mkdir(parents=True, exist_ok=True)

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.connect((host, port))
        req = f"GET {path} HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n"
        s.sendall(req.encode())
        raw = recv_all(s)

    status, headers, body = parse_response(raw)
    print('Status:', status)
    ctype = headers.get('content-type', '')

    if 'text/html' in ctype or status and '200' in status and ctype == '':
        print(body.decode('utf-8', errors='ignore'))
    elif 'image/png' in ctype or 'application/pdf' in ctype:
        filename = os.path.basename(path)
        if not filename:
            filename = 'index'
        out = save_dir / filename
        with open(out, 'wb') as f:
            f.write(body)
        print(f'Saved to {out}')
    else:
        print(body.decode('utf-8', errors='ignore'))
