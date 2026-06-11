'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Loader2, Sparkles, BookOpen, Plus, Check, AlertCircle, Upload } from 'lucide-react';
import { getProfileItem, getActiveProfileId } from '@/lib/profile';
import { sanitizeHtml } from '@/lib/sanitize';
import { parseSubtitlesToSegments, normalizeSegments, type SubtitleSegment } from '@/lib/media/parser';
import { regroupIntoSentences } from '@/lib/media/sentences';
import { assessKaraokeQuality } from '@/lib/media/karaokeQuality';
import { computeFillFraction, interpolatePlayerTime } from '@/lib/media/karaokeProgress';
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

  // Состояния для плавной караоке-интерполяции времени
  const [displayTime, setDisplayTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const lastPollTimeRef = useRef<number>(0);
  const lastPollAtMsRef = useRef<number>(0);
  
  // Кэш токенизированных строк: SegmentText -> MeCabToken[]
  const [tokenizedCache, setTokenizedCache] = useState<Record<string, MeCabToken[]>>({});
  const [activeTokens, setActiveTokens] = useState<MeCabToken[]>([]);
  const [isTokenizing, setIsTokenizing] = useState<boolean>(false);
  const [tokenizerDown, setTokenizerDown] = useState<boolean>(false);

  // Флаг: сервер уже вернул сегменты (для выбора cc_load_policy при инициализации плеера)
  const hasServerSegmentsRef = useRef<boolean>(false);
  const segmentsRef = useRef<SubtitleSegment[]>([]);
  segmentsRef.current = segments;
  // Состояние кнопки CC (YouTube субтитры): true = показаны
  const [ccEnabled, setCcEnabled] = useState<boolean>(false);

  // Функция ресинхронизации часов дисплея с реальным временем плеера
  const resyncClock = (playerTime: number, playingState: boolean) => {
    lastPollTimeRef.current = playerTime;
    lastPollAtMsRef.current = performance.now();
    setDisplayTime(playerTime);
    setIsPlaying(playingState);
  };

  // Эффект анимационного цикла (rAF) для плавного обновления displayTime
  useEffect(() => {
    if (!isPlaying) return;

    let animationFrameId: number;
    const tick = () => {
      const now = performance.now();
      const interpolated = interpolatePlayerTime(
        lastPollTimeRef.current,
        lastPollAtMsRef.current,
        now,
        true
      );
      setDisplayTime(interpolated);
      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying]);

  // Оценка качества караоке для текущего сегмента
  const karaokeAssessment = React.useMemo(() => {
    if (activeSegmentIndex === -1) return { eligible: false, reason: 'Нет активного сегмента' };
    const segment = segments[activeSegmentIndex];
    return assessKaraokeQuality(segment);
  }, [activeSegmentIndex, segments]);

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
        // Запоминаем, что сервер вернул сегменты — cc_load_policy будет 0
        hasServerSegmentsRef.current = true;
        setSegments(normalizeSegments(data.segments));
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
          // Принимаем субтитры от расширения, если текущие сегменты пусты или не имеют пословных таймингов, а расширение прислало с пословными таймингами
          const currentHasWords = segmentsRef.current.some(s => s.words && s.words.length > 0);
          const receivedHasWords = receivedSegments.some((s: any) => s.words && s.words.length > 0);

          if (hasServerSegmentsRef.current && currentHasWords) {
            console.log('[Player] Игнорируем субтитры расширения: сервер предоставил сегменты с пословными таймингами');
            return;
          }
          if (hasServerSegmentsRef.current && !receivedHasWords) {
            console.log('[Player] Игнорируем субтитры расширения без пословных таймингов, так как есть серверные');
            return;
          }

          setSegments(regroupIntoSentences(normalizeSegments(receivedSegments)));
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
          // cc_load_policy=0: сервер уже предоставил субтитры с пословными таймингами, YouTube CC не нужны
          // cc_load_policy=1: субтитров нет или они без пословных таймингов, включаем CC чтобы расширение могло их перехватить
          cc_load_policy: (hasServerSegmentsRef.current && segments.some(s => s.words && s.words.length > 0)) ? 0 : 1,
          rel: 0,
        },
        events: {
          onStateChange: (event: any) => {
            // @ts-ignore
            if (event.data === window.YT.PlayerState.PLAYING) {
              startYtTimer();
              if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
                resyncClock(ytPlayerRef.current.getCurrentTime(), true);
              }
            } else {
              stopYtTimer();
              if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
                resyncClock(ytPlayerRef.current.getCurrentTime(), false);
              }
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
        resyncClock(time, true);
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
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
      resyncClock(time, !audioRef.current.paused);
    }
  };

  // Поиск активного сегмента субтитров
  useEffect(() => {
    // Находим последний сегмент, который уже начался (sticky)
    const idx = segments.reduce((acc, s, i) => {
      if (currentTime >= s.start) {
        return i;
      }
      return acc;
    }, -1);
    
    if (idx !== activeSegmentIndex) {
      setActiveSegmentIndex(idx);
    }
  }, [currentTime, segments, activeSegmentIndex]);


  // Запуск токенизации при смене активного сегмента
  useEffect(() => {
    if (activeSegmentIndex === -1 || tokenizerDown) {
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
          if (data.tokenizationSkipped) {
            setTokenizerDown(true);
            setActiveTokens([]);
          } else {
            const tokens: MeCabToken[] = data.tokens || [];
            setTokenizedCache(prev => ({ ...prev, [text]: tokens }));
            setActiveTokens(tokens);
          }
        } else {
          setTokenizerDown(true);
          setActiveTokens([]);
        }
      } catch (err) {
        console.error('Ошибка токенизации субтитра:', err);
        setTokenizerDown(true);
        setActiveTokens([]);
      } finally {
        setIsTokenizing(false);
      }
    };

    tokenizeSegment();
  }, [activeSegmentIndex, segments, tokenizedCache, tokenizerDown]);


  // Опрос здоровья токенизатора для авто-восстановления
  useEffect(() => {
    if (!tokenizerDown) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/media/tokenize');
        if (res.ok) {
          const data = await res.json();
          if (data.success && !data.tokenizerDown) {
            setTokenizerDown(false);
            if (activeSegmentIndex !== -1) {
              const text = segments[activeSegmentIndex].text;
              setTokenizedCache(prev => {
                const copy = { ...prev };
                delete copy[text];
                return copy;
              });
            }
          }
        }
      } catch (err) {
        console.warn('Ошибка при циклическом опросе токенизатора:', err);
      }
    }, 10000);

    return () => clearInterval(pollInterval);
  }, [tokenizerDown, activeSegmentIndex, segments]);


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
        setSegments(regroupIntoSentences(normalizeSegments(loadedSegments)));
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
        setSegments(regroupIntoSentences(normalizeSegments(loadedSegments)));
        setError(null);
        setIsLoading(false);
      } else {
        setError('Не удалось распарсить файл субтитров.');
      }
    }
  };

  return (
    <div 
      className={styles.modalOverlay}
      data-has-words={segments.some(s => s.words && s.words.length > 0) ? "true" : "false"}
      data-yt-state={ytPlayerRef.current ? "loaded" : "unloaded"}
    >
      <div className={styles.modalContent}>
        {/* Шапка */}
        <header className={styles.header}>
          <div className={styles.titleInfo}>
            <Sparkles size={20} className={styles.sparkleIcon} />
            <h2 className={styles.title}>{title}</h2>
            <div 
              data-testid="tokenizer-status-dot"
              className={`${styles.statusDot} ${tokenizerDown ? styles.statusDotOffline : styles.statusDotOnline}`}
              title={tokenizerDown ? 'Токенизатор не запущен. Нажмите для повторной попытки.' : 'Разбор слов активен'}
              onClick={() => {
                if (tokenizerDown) {
                  setTokenizerDown(false);
                  if (activeSegmentIndex !== -1) {
                    const text = segments[activeSegmentIndex].text;
                    setTokenizedCache(prev => {
                      const copy = { ...prev };
                      delete copy[text];
                      return copy;
                    });
                  } else {
                    loadTranscript();
                  }
                }
              }}
            />
          </div>
          <div className={styles.headerActions}>
            {/* Кнопка CC: управляет субтитрами YouTube через недокументированный API (best-effort) */}
            {isYoutube && (
              <button
                className={`${styles.ccBtn} btn-3d ${ccEnabled ? 'btn-blue' : 'btn-gray'}`}
                aria-label="Субтитры YouTube"
                onClick={() => {
                  const player = ytPlayerRef.current;
                  if (ccEnabled) {
                    // Скрываем CC
                    try {
                      if (player && typeof player.unloadModule === 'function') {
                        player.unloadModule('captions');
                      }
                    } catch (e) {
                      console.warn('[Player] Не удалось скрыть субтитры YouTube через unloadModule:', e);
                    }
                    setCcEnabled(false);
                  } else {
                    // Показываем CC
                    try {
                      if (player && typeof player.loadModule === 'function') {
                        player.loadModule('captions');
                      }
                    } catch (e) {
                      console.warn('[Player] Не удалось показать субтитры YouTube через loadModule:', e);
                    }
                    setCcEnabled(true);
                  }
                }}
              >
                CC
              </button>
            )}
            <button className={`${styles.closeBtn} btn-3d btn-red`} onClick={onClose}>
              <X size={18} />
            </button>
          </div>
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
                  onPlay={() => {
                    if (audioRef.current) {
                      resyncClock(audioRef.current.currentTime, true);
                    }
                  }}
                  onPause={() => {
                    if (audioRef.current) {
                      resyncClock(audioRef.current.currentTime, false);
                    }
                  }}
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
                    <div className={`${styles.activeLine} ${currentTime >= segments[activeSegmentIndex].start + segments[activeSegmentIndex].duration ? styles.dimmedLine : ''}`}>
                      {tokenizerDown && (
                        <div className={styles.tokenizerWarning} data-testid="tokenizer-warning">
                          Разбор слов недоступен: токенизатор не запущен (run-server.bat)
                        </div>
                      )}
                      {isTokenizing ? (
                        <div className={styles.tokenizeLoading}>
                          <Loader2 className={styles.spin} size={16} />
                          <span>Разбор японских морфем...</span>
                        </div>
                      ) : activeTokens.length > 0 ? (
                        <div className={styles.tokensGrid} data-testid={karaokeAssessment.eligible ? "karaoke-fill" : undefined}>
                          {(() => {
                            // Рассчитываем символьные диапазоны для токенов активного сегмента
                            let tokenSpans = [];
                            let charAccumulator = 0;
                            for (const t of activeTokens) {
                              tokenSpans.push({
                                start: charAccumulator,
                                end: charAccumulator + t.surface.length
                              });
                              charAccumulator += t.surface.length;
                            }

                            // Вычисляем положение фронта заполнения караоке
                            const activeSegment = segments[activeSegmentIndex];
                            let currentCharFront = 0;
                            if (karaokeAssessment.eligible && activeSegment) {
                              const relativeTimeMs = (displayTime - activeSegment.start) * 1000;
                              const fillFraction = computeFillFraction(
                                relativeTimeMs,
                                activeSegment.duration * 1000,
                                activeSegment.words
                              );
                              currentCharFront = fillFraction * charAccumulator;
                            }

                            return activeTokens.map((token, i) => {
                              // Проверяем тип части речи, чтобы выделить важные (существительные, глаголы, прилагательные)
                              const isContentWord = token.pos === '名詞' || token.pos === '動詞' || token.pos === '形容詞' || token.pos === '形状詞';
                              
                              const span = tokenSpans[i];
                              let isFilled = false;
                              let fillPercentage = 0;

                              if (karaokeAssessment.eligible && span) {
                                if (span.end <= currentCharFront) {
                                  isFilled = true;
                                } else if (span.start < currentCharFront && span.end > currentCharFront) {
                                  fillPercentage = ((currentCharFront - span.start) / (span.end - span.start)) * 100;
                                }
                              }

                              const tokenStyle: React.CSSProperties = {};
                              if (fillPercentage > 0) {
                                tokenStyle.backgroundSize = `${Math.round(fillPercentage)}% 100%`;
                              }

                              const tokenClasses = [
                                styles.wordToken,
                                isContentWord ? styles.contentWord : '',
                                selectedWord === token.surface ? styles.selectedToken : '',
                                isFilled ? styles.filledToken : ''
                              ].filter(Boolean).join(' ');

                              return (
                                <span
                                  key={i}
                                  data-testid="word-token"
                                  onClick={() => handleTokenClick(token)}
                                  className={tokenClasses}
                                  style={tokenStyle}
                                  title={token.reading ? `Чтение: ${katakanaToHiragana(token.reading)}` : undefined}
                                >
                                  {token.surface}
                                </span>
                              );
                            });
                          })()}
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
                            resyncClock(seg.start, isPlaying);
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
