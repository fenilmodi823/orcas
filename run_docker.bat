@echo off
echo === Building ORCAS Tracker Docker Image ===
docker build -t orcas-tracker .

if %errorlevel% neq 0 (
    echo [ERROR] Docker build failed.
    exit /b %errorlevel%
)

echo.
echo === Starting ORCAS Tracker Container ===
echo Mapping host directory "%cd%\data" to "/app/data" inside the container.
echo FastAPI backend will be accessible at: http://localhost:8000
echo Interactive API documentation at: http://localhost:8000/docs
echo Press Ctrl+C to stop the server.
echo.

docker run -p 8000:8000 -v "%cd%/data:/app/data" orcas-tracker
