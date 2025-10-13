FROM python:3.11-slim
WORKDIR /app
COPY client.py .
RUN mkdir downloads
CMD ["bash"]
