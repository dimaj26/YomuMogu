@echo off
title YomuMogu Tokenizer Server
echo [Tokenizer] Checking Python dependencies...
python -c "import fugashi, fastapi, uvicorn, pydantic" 2>nul
if %errorlevel% neq 0 (
    echo [Tokenizer] Installing missing dependencies (fugashi, unidic-lite, fastapi, uvicorn, pydantic)...
    pip install fugashi unidic-lite fastapi uvicorn pydantic
) else (
    echo [Tokenizer] Dependencies are already installed.
)
echo [Tokenizer] Starting MeCab Tokenizer server on port 8000...
python -m uvicorn src.services.tokenizer.server:app --host 127.0.0.1 --port 8000
pause
