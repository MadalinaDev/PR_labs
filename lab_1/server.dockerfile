FROM python:3.11-slim

WORKDIR /app

COPY server.py .
COPY public ./public

EXPOSE 8000

CMD ["python", "server.py", "./public", "8000"]
