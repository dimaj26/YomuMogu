'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Settings, Sparkles, RefreshCw, AlertCircle, Play, XCircle, ArrowLeft, X, Volume2, Target } from 'lucide-react';
import { useJapanification } from '@/hooks/useJapanification';
import { getProfileItem, setProfileItem, removeProfileItem, getActiveProfileId } from '@/lib/profile';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { JpUI } from '@/components/JpUI';
import { PhonosemanticHint, PhonosemanticData } from '@/components/PhonosemanticHint';
import { 
  LOCAL_DECK_NAME,
  isLocalDeckInitialized,
  getDailyActivePool,
  getDailyNewWordsLimit,
  getDailyNewWordsCount,
  incrementDailyNewWordsCount,
  syncExistingLocalWordsWithStarterDeck,
  getPriorityWordsCount,
  incrementDailyNewWordsLimitOffset,
  syncDailyNewWordsCountWithDb
} from '@/core/localDeckService';
import { db } from '@/core/db';
import type { LocalWord } from '@/core/types';
import { AnkiWord } from '@/plugins/anki/filter';
import phonosemanticsData from '@/resources/phonosemantics.json';
import styles from './practice.module.css';

// Типизация phonosemantics.json
interface PhonosemanticEntry {
  reading: string;
  meaning: string;
  relatives: Array<{ kanji: string; reading: string; meaning: string }>;
}
const phonoMap: Record<string, PhonosemanticEntry> = phonosemanticsData;

/**
 * Ищет фоносемантические данные для слова по его кандзи.
 */
function findPhonosemanticData(word: string): PhonosemanticData | null {
  for (const char of word) {
    if (phonoMap[char]) {
      const entry = phonoMap[char];
      return {
        key: char,
        reading: entry.reading,
        relatives: entry.relatives
      };
    }
    // Проверяем, есть ли символ среди relatives какого-либо ключа
    for (const [key, entry] of Object.entries(phonoMap)) {
      if (entry.relatives.some(r => r.kanji === char)) {
        return {
          key,
          reading: entry.reading,
          relatives: entry.relatives
        };
      }
    }
  }
  return null;
}

// === Warm-up типы и логика ===
type WarmupStep = 'sight' | 'kana' | 'translation' | 'finished';

interface WarmupState {
  words: LocalWord[];
  currentIndex: number;
  step: WarmupStep;
  selectedAnswer: string | null;
  isCorrect: boolean | null;
}

function generateOptions(correct: string, allWords: LocalWord[], field: 'reading' | 'translation'): string[] {
  const others = allWords
    .filter(w => w[field] !== correct)
    .map(w => w[field]);
  // Перемешиваем и берём 2 дистрактора
  const shuffled = others.sort(() => Math.random() - 0.5).slice(0, 2);
  const options = [...shuffled, correct].sort(() => Math.random() - 0.5);
  return options;
}

export default function PracticePage() {
  const router = useRouter();
  const { state: jState, t } = useJapanification();

  const [activeProfileId, setActiveProfileId] = useState<string>('default');
  const [deckMode, setDeckMode] = useState<'standard' | 'custom' | 'local'>('local');
  const [selectedDeck, setSelectedDeck] = useState<string>('__all__');
  const [words, setWords] = useState<AnkiWord[]>([]);
  const [localWords, setLocalWords] = useState<LocalWord[]>([]); // Полные LocalWord для lookup статусов
  const [sessions, setSessions] = useState<any[]>([]);
  const [inProgressSessions, setInProgressSessions] = useState<Set<string>>(new Set());

  const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(false);
  const [isLocalInitialized, setIsLocalInitialized] = useState<boolean>(false);
  const [dailyNewWordsCount, setDailyNewWordsCount] = useState<number>(0);
  const [dailyNewWordsLimit, setDailyNewWordsLimit] = useState<number>(10);
  const [dueActiveWordsCount, setDueActiveWordsCount] = useState<number>(0);
  const [newWordsCount, setNewWordsCount] = useState<number>(0);
  const [priorityWordsCount, setPriorityWordsCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);

  // Warm-up состояние
  const [warmup, setWarmup] = useState<WarmupState | null>(null);
  const [warmupOptions, setWarmupOptions] = useState<string[]>([]);

  // Загружаем данные профиля и сессий
  const loadProfileData = async () => {
    try {
      const profileId = getActiveProfileId();
      setActiveProfileId(profileId);

      const savedMode = getProfileItem('deck_mode') || 'local';
      setDeckMode(savedMode as 'standard' | 'custom' | 'local');

      const savedDeck = getProfileItem('selected_deck') || '__all__';
      setSelectedDeck(savedDeck);

      // Загружаем сохраненные сессии
      const savedSessions = getProfileItem('sessions');
      if (savedSessions) {
        setSessions(JSON.parse(savedSessions));
      } else {
        setSessions([]);
      }

      // Загружаем слова в зависимости от выбранного режима
      if (savedMode === 'local') {
        const initialized = await isLocalDeckInitialized(profileId);
        setIsLocalInitialized(initialized);
        if (initialized) {
          await syncExistingLocalWordsWithStarterDeck(profileId);
          setDailyNewWordsCount(await syncDailyNewWordsCountWithDb(profileId));
          setDailyNewWordsLimit(getDailyNewWordsLimit(profileId));
          const loadedLocalWords = await db.words
            .where('profileId')
            .equals(profileId)
            .filter(w => w.category === LOCAL_DECK_NAME)
            .toArray();
          setLocalWords(loadedLocalWords);
          const mapped = loadedLocalWords.map(w => ({
            id: w.id,
            word: w.word,
            translation: w.translation,
            interval: w.active.interval,
            status: w.active.status,
            deckName: w.category,
            rawFront: w.word,
            rawBack: w.translation,
            cardIds: [w.id]
          }));
          setWords(mapped);

          // Считаем новые слова
          const newCount = loadedLocalWords.filter(w => w.active.status === 'new').length;
          setNewWordsCount(newCount);

          // Считаем приоритетные слова для баннера
          const pCount = await getPriorityWordsCount(profileId, LOCAL_DECK_NAME);
          setPriorityWordsCount(pCount);
        } else {
          setWords([]);
          setLocalWords([]);
        }
      } else {
        const savedWords = getProfileItem('words');
        if (savedWords) {
          setWords(JSON.parse(savedWords));
        } else {
          setWords([]);
        }
      }

      // Загружаем количество due слов для активного квиза (исключая новые)
      const now = Date.now();
      const count = await db.words
        .where('profileId')
        .equals(profileId)
        .filter(w => w.active && w.active.status !== 'new' && w.active.due <= now)
        .count();
      setDueActiveWordsCount(count);
    } catch (e) {
      console.error('Ошибка загрузки данных профиля для практики', e);
    } finally {
      setHasLoaded(true);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, []);

  // Отслеживаем прогресс сессий в процессе
  useEffect(() => {
    if (!hasLoaded || sessions.length === 0) return;

    const inProgress = new Set<string>();
    sessions.forEach(session => {
      try {
        const savedStateStr = getProfileItem(`chat_state_${session.id}`);
        if (savedStateStr) {
          const savedState = JSON.parse(savedStateStr);
          if (savedState && savedState.messages && savedState.messages.length > 0) {
            inProgress.add(session.id);
          }
        }
      } catch (e) {
        // Ошибка чтения
      }
    });
    setInProgressSessions(inProgress);
  }, [sessions, activeProfileId, hasLoaded]);

  // Lookup статуса слова по его text (word)
  const wordStatusMap = useMemo(() => {
    const map = new Map<string, string>();
    localWords.forEach(w => {
      map.set(w.word, w.active.status);
    });
    return map;
  }, [localWords]);

  // Получить CSS-класс бейджа по статусу
  const getBadgeClass = (wordText: string): string => {
    const status = wordStatusMap.get(wordText);
    if (status === 'new') return `${styles.sessionWordBadge} ${styles.sessionWordBadgeNew}`;
    if (status === 'learning' || status === 'review') return `${styles.sessionWordBadge} ${styles.sessionWordBadgeLearning}`;
    if (status === 'mature') return `${styles.sessionWordBadge} ${styles.sessionWordBadgeMature}`;
    return styles.sessionWordBadge;
  };

  // === Limit Offset handler ===
  const handleAddLimit = useCallback(() => {
    incrementDailyNewWordsLimitOffset(activeProfileId, 10);
    setDailyNewWordsLimit(getDailyNewWordsLimit(activeProfileId));
  }, [activeProfileId]);

  // === Warm-up логика ===
  const startWarmup = useCallback(() => {
    const newWords = localWords.filter(w => w.active.status === 'new');
    if (newWords.length === 0) return;

    // Берём min(dailyLimit - todayNewCount, totalNewWords, 10)
    const limit = Math.min(
      Math.max(0, dailyNewWordsLimit - dailyNewWordsCount),
      newWords.length,
      10
    );
    if (limit === 0) return;
    const wordsForWarmup = newWords.slice(0, limit);

    const state: WarmupState = {
      words: wordsForWarmup,
      currentIndex: 0,
      step: 'sight',
      selectedAnswer: null,
      isCorrect: null,
    };
    setWarmup(state);
    setWarmupOptions([]);
  }, [localWords, dailyNewWordsLimit, dailyNewWordsCount]);

  const advanceWarmup = useCallback(() => {
    if (!warmup) return;
    const { step, currentIndex, words: wWords } = warmup;
    const currentWord = wWords[currentIndex];

    if (step === 'sight') {
      // Переход к kana check
      const options = generateOptions(currentWord.reading, wWords, 'reading');
      setWarmupOptions(options);
      setWarmup({ ...warmup, step: 'kana', selectedAnswer: null, isCorrect: null });
    } else if (step === 'kana') {
      // Переход к translation check
      const options = generateOptions(currentWord.translation, wWords, 'translation');
      setWarmupOptions(options);
      setWarmup({ ...warmup, step: 'translation', selectedAnswer: null, isCorrect: null });
    } else {
      // Следующее слово или завершение
      if (currentIndex < wWords.length - 1) {
        setWarmup({
          ...warmup,
          currentIndex: currentIndex + 1,
          step: 'sight',
          selectedAnswer: null,
          isCorrect: null
        });
        setWarmupOptions([]);
      } else {
        // Разминка пройдена, переходим к завершающему экрану
        setWarmup({
          ...warmup,
          step: 'finished',
          selectedAnswer: null,
          isCorrect: null
        });
      }
    }
  }, [warmup]);

  const handleWarmupAnswer = useCallback((answer: string) => {
    if (!warmup || warmup.selectedAnswer !== null) return;
    const currentWord = warmup.words[warmup.currentIndex];
    const correctAnswer = warmup.step === 'kana' ? currentWord.reading : currentWord.translation;
    const correct = answer === correctAnswer;
    setWarmup({ ...warmup, selectedAnswer: answer, isCorrect: correct });
  }, [warmup]);

  const playTTS = useCallback((word: string) => {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q=${encodeURIComponent(word)}`;
    const audio = new Audio(url);
    audio.play().catch(() => {});
  }, []);

  // Сгенерировать темы диалогов при помощи Gemini
  const generateSessions = async () => {
    setIsLoadingSessions(true);
    setError(null);
    try {
      let wordsToUse = words;
      if (deckMode === 'local') {
        wordsToUse = await getDailyActivePool(activeProfileId, LOCAL_DECK_NAME);
      }

      if (wordsToUse.length === 0) {
        if (deckMode === 'local') {
          setError('Колода не инициализирована или пуста. Пройдите оценку знаний в настройках.');
        } else {
          setError('Список слов пуст. Импортируйте слова в настройках.');
        }
        setIsLoadingSessions(false);
        return;
      }

      const response = await fetch('/api/gemini/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ words: wordsToUse }),
      });
      const data = await response.json();
      if (response.ok) {
        const newSessions = data.sessions || [];
        setSessions(newSessions);
        setProfileItem('sessions', JSON.stringify(newSessions));
      } else {
        setError(data.error || 'Не удалось сгенерировать темы');
      }
    } catch (err) {
      setError('Ошибка при обращении к ИИ для генерации тем.');
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const startSession = (session: any) => {
    setProfileItem('active_session', JSON.stringify(session));
    router.push('/chat');
  };

  const handleDiscardSession = (sessionId: string) => {
    if (window.confirm(t(
      "Вы действительно хотите сбросить прогресс этой сессии диалога? Весь несинхронизированный прогресс будет потерян.",
      "このセッションをリセットしますか？未同期の進捗は失われます。",
      2
    ))) {
      removeProfileItem(`chat_state_${sessionId}`);
      
      const activeStr = getProfileItem('active_session');
      if (activeStr) {
        try {
          const parsed = JSON.parse(activeStr);
          if (parsed && parsed.id === sessionId) {
            removeProfileItem('active_session');
          }
        } catch {}
      }
      
      setInProgressSessions(prev => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }
  };

  if (!hasLoaded) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-secondary)', alignItems: 'center', justifyContent: 'center' }}>
        <div className="btn-3d" style={{ pointerEvents: 'none' }}>Загрузка...</div>
      </div>
    );
  }

  // Рендер Warm-up оверлея
  const renderWarmup = () => {
    if (!warmup) return null;
    const isFinished = warmup.step === 'finished';
    const currentWord = !isFinished ? warmup.words[warmup.currentIndex] : null;
    const phonoData = currentWord ? findPhonosemanticData(currentWord.word) : null;

    return (
      <div className={styles.warmupOverlay}>
        <div className={styles.warmupCard}>
          <div className={styles.warmupHeader}>
            <span className={styles.warmupProgress}>
              {isFinished ? 'Завершено' : `${warmup.currentIndex + 1} / ${warmup.words.length}`}
            </span>
            <button className={styles.warmupCloseBtn} onClick={() => setWarmup(null)} title="Закрыть">
              <X size={20} />
            </button>
          </div>

          {warmup.step === 'sight' && currentWord && (
            <>
              <span className={styles.warmupStep}>Знакомство</span>
              <div className={styles.warmupKanji}>{currentWord.word}</div>
              <div className={styles.warmupReading}>{currentWord.reading}</div>
              <div className={styles.warmupTranslation}>{currentWord.translation}</div>
              <button
                className={styles.warmupAudioBtn}
                onClick={() => playTTS(currentWord.word)}
                type="button"
              >
                <Volume2 size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                Послушать
              </button>
              {phonoData && <PhonosemanticHint data={phonoData} />}
              <button className="btn-3d btn-blue" onClick={advanceWarmup} style={{ marginTop: 8 }}>
                Далее →
              </button>
            </>
          )}

          {warmup.step === 'kana' && currentWord && (
            <>
              <span className={styles.warmupStep}>Проверка чтения</span>
              <div className={styles.warmupKanji}>{currentWord.word}</div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                Выберите правильное чтение:
              </p>
              <div className={styles.warmupAnswerGrid}>
                {warmupOptions.map((opt, i) => {
                  let cls = styles.warmupAnswerBtn;
                  if (warmup.selectedAnswer !== null) {
                     if (opt === currentWord.reading) cls += ` ${styles.warmupCorrect}`;
                     else if (opt === warmup.selectedAnswer && !warmup.isCorrect) cls += ` ${styles.warmupWrong}`;
                  }
                  return (
                    <button
                      key={i}
                      className={cls}
                      onClick={() => handleWarmupAnswer(opt)}
                      disabled={warmup.selectedAnswer !== null}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {warmup.selectedAnswer !== null && (
                <button className="btn-3d btn-blue" onClick={advanceWarmup} style={{ marginTop: 8 }}>
                  Далее →
                </button>
              )}
            </>
          )}

          {warmup.step === 'translation' && currentWord && (
            <>
              <span className={styles.warmupStep}>Проверка перевода</span>
              <div className={styles.warmupKanji}>{currentWord.word}</div>
              <div className={styles.warmupReading}>{currentWord.reading}</div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                Выберите правильный перевод:
              </p>
              <div className={styles.warmupAnswerGrid}>
                {warmupOptions.map((opt, i) => {
                  let cls = styles.warmupAnswerBtn;
                  if (warmup.selectedAnswer !== null) {
                     if (opt === currentWord.translation) cls += ` ${styles.warmupCorrect}`;
                     else if (opt === warmup.selectedAnswer && !warmup.isCorrect) cls += ` ${styles.warmupWrong}`;
                  }
                  return (
                    <button
                      key={i}
                      className={cls}
                      onClick={() => handleWarmupAnswer(opt)}
                      disabled={warmup.selectedAnswer !== null}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {warmup.selectedAnswer !== null && (
                <button className="btn-3d btn-blue" onClick={advanceWarmup} style={{ marginTop: 8 }}>
                  {warmup.currentIndex < warmup.words.length - 1 ? 'Следующее слово →' : 'Завершить разминку ✓'}
                </button>
              )}
            </>
          )}

          {warmup.step === 'finished' && (
            <>
              <span className={styles.warmupStep}>Разминка завершена!</span>
              <div style={{ margin: '24px 0', textAlign: 'center' }}>
                <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Вы познакомились с {warmup.words.length} новыми словами.
                </p>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  Теперь закрепите их с помощью активного квиза, чтобы перевести в процесс интервального повторения.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button
                  className="btn-3d btn-green"
                  onClick={() => {
                    const wordsParam = warmup.words.map(w => w.word).join(',');
                    router.push(`/practice/quiz?words=${encodeURIComponent(wordsParam)}&mode=new`);
                    setWarmup(null);
                  }}
                >
                  Закрепить новые слова (Квиз)
                </button>
                <button className="btn-3d" onClick={() => setWarmup(null)}>
                  Закрыть
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <header className="navbar">
        <Link href="/" className="logo-container" style={{ textDecoration: 'none' }}>
          <BookOpen size={32} className="logo-text" />
          <span className="logo-text">YomuMogu</span>
        </Link>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <LanguageSwitcher />
        </div>
      </header>

      <main className={styles.main}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <Link href="/" className="btn-3d" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={18} />
          </Link>
          <h1 className={styles.title} style={{ margin: 0 }}>Практика диалога</h1>
        </div>

        {/* Предупреждающий баннер: мало приоритетных слов */}
        {deckMode === 'local' && isLocalInitialized && priorityWordsCount > 0 && priorityWordsCount < 12 && (
          <div className={styles.warningBanner}>
            <AlertCircle size={18} />
            <p>Доступно только {priorityWordsCount} слов(а) для генерации сессий. При нехватке слов сессии могут содержать повторяющиеся слова.</p>
          </div>
        )}

        <div className={styles.layoutWrapper}>
          {/* ЛЕВАЯ КОЛОНКА */}
          <div className={styles.leftColumn}>
            <div className={styles.practiceGrid}>
              {/* Блок «Новые слова на сегодня» */}
              {deckMode === 'local' && (
                <div className="card-friendly" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', fontSize: '20px', fontWeight: 800 }}>
                    <Target size={20} style={{ color: 'var(--color-blue)', marginRight: 8 }} />
                    {t('Новые слова на сегодня', '今日の新しい単語')}
                  </h2>
                  
                  <div style={{ marginTop: '16px', flexGrow: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', fontWeight: 700 }}>
                      <span>Изучено сегодня:</span>
                      <span>{dailyNewWordsCount} из {dailyNewWordsLimit}</span>
                    </div>
                    
                    {/* Progress bar */}
                    <div style={{ width: '100%', height: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', overflow: 'hidden', marginBottom: '16px', border: '1px solid var(--border-color)' }}>
                      <div style={{ width: `${Math.min(100, (dailyNewWordsCount / dailyNewWordsLimit) * 100)}%`, height: '100%', backgroundColor: 'var(--color-blue)', transition: 'width 0.3s ease' }} />
                    </div>

                    <p style={{ margin: '8px 0', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {dailyNewWordsCount >= dailyNewWordsLimit ? (
                        <span style={{ color: 'var(--color-orange)' }}>Дневной лимит новых слов исчерпан.</span>
                      ) : (
                        `Осталось изучить по лимиту: ${Math.max(0, dailyNewWordsLimit - dailyNewWordsCount)}`
                      )}
                    </p>
                    <p style={{ margin: '8px 0', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      Всего неизученных слов: {newWordsCount}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap' }}>
                    <button
                      onClick={startWarmup}
                      disabled={dailyNewWordsCount >= dailyNewWordsLimit || newWordsCount === 0}
                      className="btn-3d btn-blue"
                      style={{ flex: 1, padding: '10px 20px', fontSize: '14px' }}
                    >
                      🎯 {t('Начать разминку', 'ウォームアップ開始')}
                    </button>
                    <button
                      onClick={handleAddLimit}
                      className="btn-3d"
                      style={{ padding: '10px 16px', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title={t('Добавить +10 слов', 'さらに10単語追加')}
                    >
                      ➕ Добавить +10
                    </button>
                  </div>
                </div>
              )}

              {/* Блок «Активное повторение» */}
              {words.length > 0 && (
                <div className="card-friendly" style={{ display: 'flex', flexDirection: 'column', height: '100%', gridColumn: deckMode !== 'local' ? '1 / -1' : undefined }}>
                  <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', fontSize: '20px', fontWeight: 800 }}>
                    <Sparkles size={20} style={{ color: 'var(--color-orange)', marginRight: 8 }} />
                    {t('Активное повторение слов', '単語の活発な復習')}
                  </h2>
                  
                  <div style={{ marginTop: '16px', flexGrow: 1 }}>
                    <p style={{ margin: '8px 0', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {dueActiveWordsCount > 0 ? (
                        t(`У вас есть ${dueActiveWordsCount} слов(а), готовых к повторению по системе FSRS.`, `FSRSによる復習対象の単語が${dueActiveWordsCount}個あります。`)
                      ) : (
                        t('Все активные слова повторены! Отличная работа.', 'すべての単語の復習が完了しています！')
                      )}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                    <button
                      onClick={() => router.push('/practice/quiz?mode=review')}
                      disabled={dueActiveWordsCount === 0}
                      className={`btn-3d ${dueActiveWordsCount > 0 ? 'btn-orange' : ''}`}
                      style={{ flex: 1, padding: '10px 20px', fontSize: '14px' }}
                    >
                      🧠 {t('Начать повторение', '復習開始')} [{dueActiveWordsCount}]
                    </button>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className={styles.errorAlert}>
                <AlertCircle size={18} />
                <p>{error}</p>
              </div>
            )}

            {/* Сетка сессий */}
            <div className="card-friendly" style={{ minHeight: '300px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
                <h2 className={styles.cardTitle} style={{ margin: 0 }}>
                  <Sparkles size={20} style={{ color: 'var(--color-blue)', marginRight: 8 }} />
                  Разговорные сессии с Gemini ИИ
                </h2>
                
                {sessions.length === 0 && words.length > 0 && (
                  <button
                    onClick={generateSessions}
                    disabled={isLoadingSessions}
                    className="btn-3d btn-blue"
                    style={{ padding: '8px 16px', fontSize: '14px' }}
                  >
                    {isLoadingSessions ? 'Создание тем...' : 'Сгенерировать темы тренировок'}
                  </button>
                )}
              </div>

              {isLoadingSessions && (
                <div className={styles.loadingText} style={{ padding: '48px 24px' }}>
                  <RefreshCw size={28} className={`${styles.spin}`} style={{ margin: '0 auto 16px auto', color: 'var(--color-blue)', display: 'block' }} />
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '16px' }}>ИИ анализирует ваши слова и подбирает лучшие сценарии...</p>
                </div>
              )}

              {words.length === 0 ? (
                <div className={styles.emptyState}>
                  <XCircle size={48} className={styles.emptyIcon} />
                  <p>
                    {deckMode === 'local'
                      ? 'Локальный список еще не инициализирован. Пожалуйста, пройдите диагностику в настройках.'
                      : 'Слова из Anki не импортированы. Пожалуйста, выберите колоду и импортируйте слова в настройках.'
                    }
                  </p>
                  <Link href="/settings" className="btn-3d btn-green" style={{ marginTop: '12px', padding: '10px 20px', fontSize: '15px' }}>
                    Перейти в настройки
                  </Link>
                </div>
              ) : (
                !isLoadingSessions && sessions.length === 0 && (
                  <div className={styles.emptyState}>
                    <Sparkles size={48} className={styles.emptyIcon} style={{ color: 'var(--color-yellow-shadow)' }} />
                    <p>Темы для диалогов еще не сгенерированы. Нажмите кнопку ниже, чтобы ИИ подготовил сценарии на основе ваших слов.</p>
                    <button
                      onClick={generateSessions}
                      className="btn-3d btn-blue"
                      style={{ marginTop: '12px', padding: '10px 20px', fontSize: '15px' }}
                    >
                      Сгенерировать темы тренировок
                    </button>
                  </div>
                )
              )}

              {!isLoadingSessions && sessions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div className={styles.sessionGrid}>
                    {sessions.map((session) => (
                      <div key={session.id} className={styles.sessionCard}>
                        <h4 className={styles.sessionTitle}>{session.title}</h4>
                        <p className={styles.sessionDescription}>{session.description}</p>
                        <div className={styles.sessionWordsTitle}>Целевые слова:</div>
                        <div className={styles.sessionWordList}>
                          {session.targetWords.map((tw: any, idx: number) => (
                            <span key={idx} className={getBadgeClass(tw.word)}>
                              {tw.translation}
                            </span>
                          ))}
                        </div>
                        {inProgressSessions.has(session.id) ? (
                          <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: 'auto' }}>
                            <button
                              onClick={() => startSession(session)}
                              className="btn-3d btn-blue"
                              style={{ flex: 1, padding: '8px 12px', fontSize: '14px' }}
                            >
                              Продолжить
                            </button>
                            <button
                              onClick={() => handleDiscardSession(session.id)}
                              className="btn-3d btn-red"
                              style={{ padding: '8px 12px', fontSize: '14px' }}
                              title="Сбросить прогресс сессии"
                            >
                              Сброс
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startSession(session)}
                            className="btn-3d btn-green"
                            style={{ width: '100%', marginTop: 'auto', padding: '8px 16px', fontSize: '14px' }}
                          >
                            Начать практику
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={generateSessions}
                    disabled={isLoadingSessions}
                    className="btn-3d"
                    style={{ padding: '10px 20px', fontSize: '14px', alignSelf: 'center' }}
                  >
                    Перегенерировать другие темы
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ПРАВАЯ КОЛОНКА (САЙДБАР) */}
          <div className={styles.rightColumn}>
            {/* Информационная панель об источнике обучения */}
            <div className="card-friendly" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 800 }}>
                  Источник обучения:{' '}
                  <span style={{ color: 'var(--color-blue)', display: 'block', marginTop: '4px' }}>
                    {deckMode === 'local' && 'Локальный список'}
                    {deckMode === 'standard' && 'Стандартная Anki'}
                    {deckMode === 'custom' && `Своя Anki (${selectedDeck})`}
                  </span>
                </h3>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {deckMode === 'local' ? (
                    `Лимит новых слов сегодня: ${dailyNewWordsCount} из ${getDailyNewWordsLimit(activeProfileId)}`
                  ) : (
                    `Импортировано слов: ${words.length}`
                  )}
                </p>
              </div>
              <Link href="/settings" className="btn-3d" style={{ fontSize: '14px', padding: '10px 16px', display: 'flex', justifyContent: 'center' }}>
                <Settings size={16} style={{ marginRight: 6 }} /> Настроить источник
              </Link>
            </div>

            {/* Виджет советов по FSRS */}
            <div className="card-friendly" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} style={{ color: 'var(--color-yellow-shadow)' }} />
                Интервальные повторения
              </h3>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.5', color: 'var(--text-secondary)', fontWeight: 600 }}>
                YomuMogu использует двухкритериальный алгоритм FSRS для раздельного отслеживания навыков чтения (пассивный) и письма (активный).
              </p>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.5', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Старайтесь регулярно проходить разминки и общаться в чате с Gemini, чтобы поддерживать стабильность вашей памяти на высоком уровне.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Warm-up оверлей */}
      {renderWarmup()}
    </div>
  );
}
