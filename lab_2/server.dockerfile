FROM python:3.9-slim
WORKDIR /app
COPY multithreaded_server_lock.py .
COPY multithreaded_server_no_lock.py .
COPY singlethreaded_server.py .
COPY public/ ./public/
EXPOSE 8000
CMD ["python", "singlethreaded_server.py"]