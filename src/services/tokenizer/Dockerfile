FROM python:3.11-slim

WORKDIR /app

# Устанавливаем системные библиотеки MeCab
RUN apt-get update && apt-get install -y \
    mecab \
    libmecab-dev \
    git \
    make \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Устанавливаем зависимости Python
RUN pip install --no-cache-dir fastapi uvicorn pydantic fugashi unidic-lite

# Копируем скрипт сервера
COPY server.py .

EXPOSE 8000

# API-ключ авторизации по умолчанию (рекомендуется переопределить при запуске контейнера)
ENV TOKENIZER_API_KEY="yomumogu-secret-token"

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
