import os
from fastapi import FastAPI, HTTPException, Security
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel
import fugashi

app = FastAPI(title="YomuMogu MeCab Tokenizer Service")

# Загружаем API-ключ безопасности из переменных окружения
API_KEY = os.environ.get("TOKENIZER_API_KEY", "yomumogu-secret-token")
api_key_header = APIKeyHeader(name="X-Tokenizer-API-Key", auto_error=True)

class Token(BaseModel):
    surface: str
    pos: str
    lemma: str
    reading: str | None = None

class TokenizeRequest(BaseModel):
    text: str
    mode: str = "lemmas" # Режим токенизации: "lemmas" или "detailed"

class TokenizeResponse(BaseModel):
    lemmas: list[str] = []
    tokens: list[Token] = []

# Инициализируем MeCab-парсер. UniDic-lite будет автоматически загружен через fugashi.
try:
    tagger = fugashi.Tagger()
except Exception as e:
    print(f"Ошибка инициализации MeCab Tagger: {e}")
    tagger = None

def verify_api_key(api_key: str = Security(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Неверный API-ключ авторизации")
    return api_key

@app.post("/tokenize", response_model=TokenizeResponse)
def tokenize_text(request: TokenizeRequest, api_key: str = Security(verify_api_key)):
    if not tagger:
        raise HTTPException(status_code=500, detail="MeCab парсер не инициализирован на сервере")
    
    text = request.text.strip()
    if not text:
        return TokenizeResponse(lemmas=[], tokens=[])
    
    try:
        if request.mode == "detailed":
            tokens = []
            for word in tagger(text):
                # Пропускаем служебные частицы и знаки препинания для фильтрации в обучении,
                # но для отображения субтитров нам нужны все токены, кроме чисто пробельных символов.
                surface = word.surface
                if not surface.strip():
                    continue
                
                pos = word.feature.pos1 if hasattr(word.feature, 'pos1') else ""
                lemma = word.feature.lemma if hasattr(word.feature, 'lemma') else None
                base_word = lemma.split('-')[0] if lemma else surface
                
                reading = None
                try:
                    if hasattr(word.feature, 'kana') and word.feature.kana:
                        reading = word.feature.kana
                    elif hasattr(word.feature, 'pron') and word.feature.pron:
                        reading = word.feature.pron
                except Exception:
                    pass
                
                tokens.append(Token(
                    surface=surface,
                    pos=pos,
                    lemma=base_word,
                    reading=reading
                ))
            return TokenizeResponse(tokens=tokens)
        else:
            lemmas = set()
            for word in tagger(text):
                # Пропускаем служебные частицы (助詞) и знаки пунктуации (補助記号 / 記号)
                pos = word.feature.pos1
                if pos in ["助詞", "補助記号", "記号"]:
                    continue
                
                lemma = word.feature.lemma
                if lemma:
                    # В UniDic лемма может возвращаться с суффиксом, например "食べる-1"
                    # Извлекаем базовую словарную форму
                    base_word = lemma.split('-')[0]
                    lemmas.add(base_word)
                else:
                    # Если лемма отсутствует (например, для заимствованных слов/имен), берем оригинальное написание
                    lemmas.add(word.surface)
                    
            return TokenizeResponse(lemmas=sorted(list(lemmas)))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка токенизации текста: {str(e)}")
