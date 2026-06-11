'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Loader2, Sparkles, BookOpen, Plus, Check, AlertCircle, Upload } from 'lucide-react';
import { getProfileItem, getActiveProfileId } from '@/lib/profile';
import { sanitizeHtml } from '@/lib/sanitize';
import { parseSubtitlesToSegments, type SubtitleSegment } from '@/lib/media/parser';
import styles from './MediaInteractivePlayer.module.css';

// Типизация подробного токена MeCab
interface MeCabToken {
  surface: string;
  pos: string;
  lemma: string;
  reading: string | null;
}

interface MediaInteractivePlayerProps {
  url: string;
  title: string;
  onClose: () => void;
}

/**
 * Преобразует катакану в хирагану для более привычного чтения в карточках Anki
 */
function katakanaToHiragana(src: string): string {
  if (!src) return '';
  return src.replace(/[\u30a1-\u30f6]/g, (match) => {
    return String.fromCharCode(match.charCodeAt(0) - 0x60);
  });
}

export function MediaInteractivePlayer({ url, title, onClose }: MediaInteractivePlayerProps) {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [segments, setSegments] = useState<SubtitleSegment[]>([]);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>(-1);
  const [currentTime, setCurrentTime] = useState<number>(0);
  
  // Кэш токенизированных строк: SegmentText -> MeCabToken[]
  const [tokenizedCache, setTokenizedCache] = useState<Record<string, MeCabToken[]>>({});
  const [activeTokens, setActiveTokens] = useState<MeCabToken[]>([]);
  const [isTokenizing, setIsTokenizing] = useState<boolean>(false);
  const [tokenizerDown, setTokenizerDown] = useState<boolean>(false);

  // Словарь и Anki поповер
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedToken, setSelectedToken] = useState<MeCabToken | null>(null);
  const [dictResult, setDictResult] = useState<any | null>(null);
  const [isLoadingDict, setIsLoadingDict] = useState<boolean>(false);
  const [ankiStatus, setAnkiStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [ankiError, setAnkiError] = useState<string | null>(null);

  // Ссылки на плееры
  const audioRef = useRef<HTMLAudioElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ytContainerRef = useRef<HTMLDivElement>(null);

  // Извлекаем ID видео, если ссылка ведет на YouTube (синхронно)
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  const ytVideoId = (match && match[2].length === 11) ? match[2] : null;
  const isYoutube = !!ytVideoId;

  // Драг-энд-дроп файлов субтитров
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Загружаем транскрипт с сервера
  const loadTranscript = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/media/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Не удалось получить субтитры');
      }

      const data = await response.json();
      if (data.segments && data.segments.length > 0) {
        setSegments(data.segments);
        setTokenizerDown(!!data.tokenizerDown);
      } else {
        throw new Error('Для этого видео отсутствуют дорожки японских субтитров.');
      }
    } catch (err: any) {
      console.warn('Ошибка загрузки транскрипта:', err);
      setError(err.message || 'Ошибка загрузки субтитров. Вы можете загрузить свой файл .srt/.vtt');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTranscript();
    return () => {
      if (ytTimerIntervalRef.current) {
        clearInterval(ytTimerIntervalRef.current);
      }
    };
  }, [url]);

  // Прослушивание сообщений от браузерного расширения для получения субтитров
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'YOMUMOGU_YT_SUBTITLES') {
        // Фильтруем по videoId, если он передан в сообщении от расширения
        if (event.data.videoId && event.data.videoId !== ytVideoId) {
          console.log(`[Player] Игнорируем субтитры для другого видео: ${event.data.videoId} (текущее: ${ytVideoId})`);
          return;
        }

        const receivedSegments = event.data.segments;
        if (Array.isArray(receivedSegments) && receivedSegments.length > 0) {
          setSegments(receivedSegments);
          setError(null);
          setIsLoading(false);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [ytVideoId]);

  // Инициализация YouTube API
  useEffect(() => {
    if (!isYoutube || !ytVideoId || isLoading) return;

    // Функция инициализации
    const initPlayer = () => {
      if (ytPlayerRef.current || !ytContainerRef.current) return;
      // @ts-ignore
      ytPlayerRef.current = new window.YT.Player(ytContainerRef.current, {
        videoId: ytVideoId,
        playerVars: {
          origin: typeof window !== 'undefined' ? window.location.origin : '',
          cc_load_policy: 1,
          rel: 0,
        },
        events: {
          onStateChange: (event: any) => {
            // @ts-ignore
            if (event.data === window.YT.PlayerState.PLAYING) {
              startYtTimer();
            } else {
              stopYtTimer();
            }
          },
          onError: (event: any) => {
            const code = event.data;
            if (code === 101 || code === 150) {
              setError('Владелец видео запретил его воспроизведение во встраиваемых проигрывателях.');
            } else {
              setError(`Ошибка воспроизведения YouTube (код ${code})`);
            }
          }
        },
      });
    };

    // @ts-ignore
    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      // Загружаем скрипт API YouTube
      // @ts-ignore
      if (!window.onYouTubeIframeAPIReady) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
        
        // @ts-ignore
        window.onYouTubeIframeAPIReady = () => {
          initPlayer();
        };
      } else {
        // Подменяем callback, если скрипт уже грузится
        // @ts-ignore
        const oldCallback = window.onYouTubeIframeAPIReady;
        // @ts-ignore
        window.onYouTubeIframeAPIReady = () => {
          if (oldCallback) oldCallback();
          initPlayer();
        };
      }
    }

    return () => {
      stopYtTimer();
      if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === 'function') {
        try {
          ytPlayerRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying YouTube player:', e);
        }
        ytPlayerRef.current = null;
      }
    };
  }, [isYoutube, ytVideoId, isLoading]);

  // Таймер для отслеживания времени YouTube
  const startYtTimer = () => {
    stopYtTimer();
    ytTimerIntervalRef.current = setInterval(() => {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
        const time = ytPlayerRef.current.getCurrentTime();
        setCurrentTime(time);
      }
    }, 200);
  };

  const stopYtTimer = () => {
    if (ytTimerIntervalRef.current) {
      clearInterval(ytTimerIntervalRef.current);
      ytTimerIntervalRef.current = null;
    }
  };

  // Слушатель времени стандартного аудио плеера
  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  // Поиск активного сегмента субтитров
  useEffect(() => {
    const idx = segments.findIndex(
      (s) => currentTime >= s.start && currentTime <= s.start + s.duration
    );
    if (idx !== activeSegmentIndex) {
      setActiveSegmentIndex(idx);
    }
  }, [currentTime, segments, activeSegmentIndex]);

  // Запуск токенизации при смене активного сегмента
  useEffect(() => {
    if (activeSegmentIndex === -1) {
      setActiveTokens([]);
      return;
    }

    const text = segments[activeSegmentIndex].text;
    
    // Проверяем кэш
    if (tokenizedCache[text]) {
      setActiveTokens(tokenizedCache[text]);
      return;
    }

    // Токенизируем через API
    const tokenizeSegment = async () => {
      setIsTokenizing(true);
      try {
        const res = await fetch('/api/media/tokenize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text, mode: 'detailed' }),
        });

        if (res.ok) {
          const data = await res.json();
          const tokens: MeCabToken[] = data.tokens || [];
          setTokenizedCache(prev => ({ ...prev, [text]: tokens }));
          setActiveTokens(tokens);
        }
      } catch (err) {
        console.error('Ошибка токенизации субтитра:', err);
      } finally {
        setIsTokenizing(false);
      }
    };

    tokenizeSegment();
  }, [activeSegmentIndex, segments, tokenizedCache]);

  // Обработка клика по токену слова
  const handleTokenClick = async (token: MeCabToken) => {
    setSelectedToken(token);
    setSelectedWord(token.surface);
    setAnkiStatus('idle');
    setAnkiError(null);
    setIsLoadingDict(true);
    setDictResult(null);

    const lookupWord = token.lemma || token.surface;
    try {
      const res = await fetch(`/api/dict/lookup?word=${encodeURIComponent(lookupWord)}`);
      if (res.ok) {
        const data = await res.json();
        setDictResult(data);
      } else {
        setDictResult({ error: 'Не удалось получить словарное определение.' });
      }
    } catch (err) {
      setDictResult({ error: 'Ошибка связи со словарем.' });
    } finally {
      setIsLoadingDict(false);
    }
  };

  // Добавление слова в Anki
  const handleAddToAnki = async () => {
    if (!selectedToken) return;

    setAnkiStatus('loading');
    setAnkiError(null);

    const profileId = getActiveProfileId();
    const deckName = getProfileItem('selected_deck') || 'Japanese';
    const frontField = getProfileItem('front_field') || 'Front';
    const backField = getProfileItem('back_field') || 'Back';

    const word = selectedToken.lemma || selectedToken.surface;
    const rawReading = selectedToken.reading || '';
    const reading = katakanaToHiragana(rawReading);

    let translation = 'Импортировано из видео';
    let definitionHtml = '';

    if (dictResult) {
      definitionHtml = dictResult.definition || dictResult.entry || '';
      
      // Попробуем извлечь русский перевод из определения
      // JitenDex обычно имеет структурированные теги. Напишем простой парсер для первого встреченного значения.
      if (dictResult.definition) {
        const textOnly = dictResult.definition
          .replace(/<[^>]*>/g, '') // убираем HTML теги
          .replace(/\s+/g, ' ')
          .trim();
        translation = textOnly.split(';')[0]?.substring(0, 80) || translation;
      }
    }

    try {
      const res = await fetch('/api/anki/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deckName,
          frontField,
          backField,
          word,
          reading,
          translation,
          definitionHtml,
          history: [] // История диалога пуста, так как это видеоплеер
        }),
      });

      if (res.ok) {
        setAnkiStatus('success');
      } else {
        const errData = await res.json();
        throw new Error(errData.error || 'Не удалось отправить слово в Anki');
      }
    } catch (err: any) {
      console.error('Ошибка добавления карточки:', err);
      setAnkiStatus('error');
      setAnkiError(err.message || 'Ошибка соединения с AnkiConnect');
    }
  };

  // Обработка драг-энд-дропа файлов субтитров
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const text = await file.text();
      const loadedSegments = parseSubtitlesToSegments(text);
      
      if (loadedSegments.length > 0) {
        setSegments(loadedSegments);
        setError(null);
        setIsLoading(false);
      } else {
        setError('Не удалось найти временные сегменты в файле субтитров.');
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const text = await file.text();
      const loadedSegments = parseSubtitlesToSegments(text);
      
      if (loadedSegments.length > 0) {
        setSegments(loadedSegments);
        setError(null);
        setIsLoading(false);
      } else {
        setError('Не удалось распарсить файл субтитров.');
      }
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        {/* Шапка */}
        <header className={styles.header}>
          <div className={styles.titleInfo}>
            <Sparkles size={20} className={styles.sparkleIcon} />
            <h2 className={styles.title}>{title}</h2>
          </div>
          <button className={`${styles.closeBtn} btn-3d btn-red`} onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        {/* Тело модального окна */}
        <div className={styles.body}>
          {/* Левая часть: Видео/Аудио плеер */}
          <div className={styles.playerContainer}>
            {isYoutube ? (
              <div className={styles.ytWrapper}>
                <div ref={ytContainerRef} id="youtube-player-iframe" className={styles.ytIframe}></div>
              </div>
            ) : (
              <div className={styles.audioWrapper}>
                <div className={styles.audioArtwork}>
                  <Play size={48} className={styles.playIcon} />
                  <p>Аудио подкаст</p>
                </div>
                <audio
                  ref={audioRef}
                  src={url}
                  controls
                  onTimeUpdate={handleAudioTimeUpdate}
                  className={styles.audioElement}
                />
              </div>
            )}

            {/* Субтитры */}
            <div className={styles.subtitlesContainer}>
              {isLoading ? (
                <div className={styles.loadingBox}>
                  <Loader2 className={styles.spin} size={28} />
                  <p>Сканирование транскрипта и загрузка японской дорожки...</p>
                </div>
              ) : error ? (
                <div className={styles.errorBox}>
                  <AlertCircle size={24} style={{ color: 'var(--color-red)' }} />
                  <p className={styles.errorMsg}>{error}</p>
                  
                  {/* Загрузка своего файла */}
                  <div 
                    className={`${styles.dragBox} ${dragActive ? styles.dragActive : ''}`}
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                  >
                    <Upload size={24} />
                    <p>Перетащите сюда свой файл <strong>.srt</strong> или <strong>.vtt</strong></p>
                    <span className={styles.orSpan}>или</span>
                    <label className={`${styles.fileLabel} btn-3d btn-blue`}>
                      Выбрать файл
                      <input 
                        type="file" 
                        accept=".srt,.vtt" 
                        onChange={handleFileChange} 
                        className={styles.fileInput} 
                      />
                    </label>
                  </div>
                </div>
              ) : segments.length > 0 ? (
                <div className={styles.subtitlesBox}>
                  {/* Рендеринг активной строки с токенизацией */}
                  {activeSegmentIndex !== -1 ? (
                    <div className={styles.activeLine}>
                      {tokenizerDown && (
                        <div className={styles.tokenizerWarning} data-testid="tokenizer-warning">
                          Разбор слов недоступен (токенизатор не запущен)
                        </div>
                      )}
                      {isTokenizing ? (
                        <div className={styles.tokenizeLoading}>
                          <Loader2 className={styles.spin} size={16} />
                          <span>Разбор японских морфем...</span>
                        </div>
                      ) : activeTokens.length > 0 ? (
                        <div className={styles.tokensGrid}>
                          {activeTokens.map((token, i) => {
                            // Проверяем тип части речи, чтобы выделить важные (существительные, глаголы, прилагательные)
                            const isContentWord = token.pos === '名詞' || token.pos === '動詞' || token.pos === '形容詞' || token.pos === '形状詞';
                            return (
                              <span
                                key={i}
                                data-testid="word-token"
                                onClick={() => handleTokenClick(token)}
                                className={`${styles.wordToken} ${isContentWord ? styles.contentWord : ''} ${selectedWord === token.surface ? styles.selectedToken : ''}`}
                                title={token.reading ? `Чтение: ${katakanaToHiragana(token.reading)}` : undefined}
                              >
                                {token.surface}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <p className={styles.rawText}>{segments[activeSegmentIndex].text}</p>
                      )}
                    </div>
                  ) : (
                    <p className={styles.inactiveMsg}>Запустите воспроизведение для отображения субтитров</p>
                  )}

                  {/* Список всех сегментов для навигации кликом */}
                  <div className={styles.playlistBox}>
                    <p className={styles.playlistTitle}>Транскрипт видео:</p>
                    <div className={styles.segmentsList}>
                      {segments.map((seg, i) => (
                        <div
                          key={i}
                          onClick={() => {
                            setCurrentTime(seg.start);
                            if (isYoutube && ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
                              ytPlayerRef.current.seekTo(seg.start, true);
                            } else if (audioRef.current) {
                              audioRef.current.currentTime = seg.start;
                            }
                          }}
                          className={`${styles.segmentRow} ${i === activeSegmentIndex ? styles.segmentRowActive : ''}`}
                        >
                          <span className={styles.segmentTime}>
                            {Math.floor(seg.start / 60)}:
                            {String(Math.floor(seg.start % 60)).padStart(2, '0')}
                          </span>
                          <span className={styles.segmentText}>{seg.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Правая часть: Словарная дефиниция / Добавление в Anki */}
          <div className={styles.sidebar}>
            {selectedWord ? (
              <div className={`${styles.sidebarCard} card-friendly`}>
                <div className={styles.sidebarHeader}>
                  <BookOpen size={18} style={{ color: 'var(--color-blue)' }} />
                  <h3>Словарная карточка</h3>
                </div>

                <div className={styles.wordMainInfo}>
                  <div className={styles.selectedWordDisplay}>{selectedWord}</div>
                  {selectedToken?.reading && (
                    <div className={styles.readingDisplay}>
                      【{katakanaToHiragana(selectedToken.reading)}】
                    </div>
                  )}
                  {selectedToken?.lemma && selectedToken.lemma !== selectedWord && (
                    <div className={styles.lemmaDisplay}>
                      Начальная форма: <strong>{selectedToken.lemma}</strong>
                    </div>
                  )}
                  <div className={styles.posDisplay}>
                    Часть речи: <span>{selectedToken?.pos || 'Неизвестно'}</span>
                  </div>
                </div>

                <div className={styles.dictionaryContent}>
                  {isLoadingDict ? (
                    <div className={styles.sidebarLoading}>
                      <Loader2 className={styles.spin} size={20} />
                      <p>Запрос в JitenDex...</p>
                    </div>
                  ) : dictResult?.error ? (
                    <p className={styles.dictError}>{dictResult.error}</p>
                  ) : dictResult ? (
                    <div 
                      className={styles.dictHtml}
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(dictResult.definition || dictResult.entry || '<p>Определение отсутствует</p>') }}
                    />
                  ) : (
                    <p className={styles.dictPlaceholder}>Определение не найдено</p>
                  )}
                </div>

                {/* Добавить в Anki */}
                <div className={styles.ankiActionSection}>
                  {ankiStatus === 'success' ? (
                    <div className={styles.ankiSuccessBox}>
                      <Check size={16} />
                      <span>Слово добавлено в Anki!</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleAddToAnki}
                      disabled={ankiStatus === 'loading' || isLoadingDict}
                      className={`btn-3d btn-green ${styles.ankiBtn}`}
                    >
                      {ankiStatus === 'loading' ? (
                        <>
                          <Loader2 className={styles.spin} size={16} style={{ marginRight: 6 }} />
                          Создание...
                        </>
                      ) : (
                        <>
                          <Plus size={16} style={{ marginRight: 6 }} />
                          Добавить в Anki
                        </>
                      )}
                    </button>
                  )}

                  {ankiStatus === 'error' && (
                    <div className={styles.ankiErrorBox}>
                      <AlertCircle size={14} />
                      <span>{ankiError || 'Ошибка синхронизации'}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.sidebarEmpty}>
                <Sparkles size={32} className={styles.emptySparkle} />
                <p>Кликните по любому японскому слову в субтитрах, чтобы увидеть его чтение, грамматический разбор и русский перевод из словаря JitenDex.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
