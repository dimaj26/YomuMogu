@echo off
title YomuMogu Tokenizer Server

if not exist logs mkdir logs

echo ================================================== >> logs\tokenizer.log
echo [Tokenizer Session Start] %date% %time% >> logs\tokenizer.log

if exist venv\Scripts\python.exe goto run_server

echo [Tokenizer] Creating virtual environment (venv)...
echo [Tokenizer] Creating virtual environment (venv)... >> logs\tokenizer.log

py -3.11 -m venv venv >> logs\tokenizer.log 2>&1
if exist venv\Scripts\python.exe goto install_deps

echo [Tokenizer] py -3.11 failed. Trying explicit path... >> logs\tokenizer.log
"%LocalAppData%\Programs\Python\Python311\python.exe" -m venv venv >> logs\tokenizer.log 2>&1

if not exist venv\Scripts\python.exe (
    echo [FAIL] Python 3.11 not found! Please install Python 3.11.
    echo [FAIL] Python 3.11 not found! Please install Python 3.11. >> logs\tokenizer.log
    exit /b 1
)

:install_deps
echo [Tokenizer] Installing dependencies from requirements.txt...
echo [Tokenizer] Installing dependencies from requirements.txt... >> logs\tokenizer.log
venv\Scripts\python.exe -m pip install -r requirements.txt --trusted-host pypi.org --trusted-host files.pythonhosted.org --trusted-host pypi.python.org >> logs\tokenizer.log 2>&1
if %errorlevel% neq 0 (
    echo [FAIL] Dependency installation failed. Check logs\tokenizer.log for details.
    echo [FAIL] Dependency installation failed. >> logs\tokenizer.log
    exit /b 1
)

:run_server
venv\Scripts\python.exe -c "import fugashi, fastapi, uvicorn, pydantic" 2>nul
if %errorlevel% neq 0 (
    echo [Tokenizer] Missing dependencies inside venv, installing...
    echo [Tokenizer] Missing dependencies inside venv, installing... >> logs\tokenizer.log
    venv\Scripts\python.exe -m pip install -r requirements.txt --trusted-host pypi.org --trusted-host files.pythonhosted.org --trusted-host pypi.python.org >> logs\tokenizer.log 2>&1
)

echo [Tokenizer] Starting MeCab Tokenizer server on port 8000...
echo [Tokenizer] Starting MeCab Tokenizer server on port 8000... >> logs\tokenizer.log
venv\Scripts\python.exe -m uvicorn src.services.tokenizer.server:app --host 127.0.0.1 --port 8000 --log-level info >> logs\tokenizer.log 2>&1

