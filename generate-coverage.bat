@echo off
REM Test Coverage Report Generator for Windows
REM Generates HTML coverage reports for both frontend and backend

echo.
echo ========================================
echo    Test Coverage Report Generator
echo ========================================
echo.

:menu
echo What would you like to do?
echo 1) Generate Backend Coverage
echo 2) Generate Frontend Coverage
echo 3) Generate Both (Backend + Frontend)
echo 4) Open Coverage Dashboard
echo 5) Generate Both + Open Dashboard
echo.
set /p choice="Enter your choice (1-5): "

if "%choice%"=="1" goto backend
if "%choice%"=="2" goto frontend
if "%choice%"=="3" goto both
if "%choice%"=="4" goto dashboard
if "%choice%"=="5" goto all
echo Invalid choice. Exiting.
goto end

:backend
echo.
echo [Backend] Generating coverage...
cd backend
call npm run test:coverage
cd ..
echo.
echo [SUCCESS] Backend coverage generated!
echo Report: backend\coverage\index.html
echo.
goto end

:frontend
echo.
echo [Frontend] Generating coverage...
cd frontend
call npm run test:coverage
cd ..
echo.
echo [SUCCESS] Frontend coverage generated!
echo Report: frontend\coverage\index.html
echo.
goto end

:both
echo.
echo [Backend] Generating coverage...
cd backend
call npm run test:coverage
cd ..
echo.
echo [Frontend] Generating coverage...
cd frontend
call npm run test:coverage
cd ..
echo.
echo [SUCCESS] Both coverage reports generated!
echo.
goto end

:dashboard
echo.
echo Opening Coverage Dashboard...
start coverage-dashboard.html
goto end

:all
echo.
echo [Backend] Generating coverage...
cd backend
call npm run test:coverage
cd ..
echo.
echo [Frontend] Generating coverage...
cd frontend
call npm run test:coverage
cd ..
echo.
echo Opening Coverage Dashboard...
start coverage-dashboard.html
echo.
goto end

:end
echo.
echo ========================================
echo Coverage Reports:
echo   - Backend:  backend\coverage\index.html
echo   - Frontend: frontend\coverage\index.html
echo   - Dashboard: coverage-dashboard.html
echo ========================================
echo.
pause
