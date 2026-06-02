#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e

echo "=== Building ORCAS Tracker Docker Image ==="
docker build -t orcas-tracker .

echo ""
echo "=== Starting ORCAS Tracker Container ==="
echo "Mapping host directory '$(pwd)/data' to '/app/data' inside the container."
echo "FastAPI backend will be accessible at: http://localhost:8000"
echo "Interactive API documentation at: http://localhost:8000/docs"
echo "Press Ctrl+C to stop the server."
echo ""

docker run -p 8000:8000 -v "$(pwd)/data:/app/data" orcas-tracker
