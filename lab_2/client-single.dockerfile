FROM python:3.12-slim
WORKDIR /app
COPY client_single.py .
RUN pip install requests
CMD ["python", "client_singlethreaded.py"]
