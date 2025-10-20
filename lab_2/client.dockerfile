FROM python:3.9-slim
WORKDIR /app
COPY client.py .
COPY client_single.py .
RUN pip install requests
CMD ["python", "client.py"]