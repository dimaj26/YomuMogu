'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Settings, Sparkles, RefreshCw, AlertCircle, Play, XCircle, ArrowLeft } from 'lucide-react';
import { useJapanification } from '@/hooks/useJapanification';
import { getProfileItem, setProfileItem, removeProfileItem, getActiveProfileId } from '@/lib/profile';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { JpUI } from '@/components/JpUI';
import { 
  LOCAL_DECK_NAME,
  isLocalDeckInitialized,
  getDailyActivePool,
  getDailyNewWordsLimit,
  getDailyNewWordsCount,
  incrementDailyNewWordsCount
} from '@/core/localDeckService';
import { db } from '@/core/db';
import { AnkiWord } from '@/plugins/anki/filter';
import styles from './practice.module.css';

export default function PracticePage() {
  const router = useRouter();
  const { state: jState, t } = useJapanification();

  const [activeProfileId, setActiveProfileId] = useState<string>('default');
  const [deckMode, setDeckMode] = useState<'standard' | 'custom' | 'local'>('local');
  const [selectedDeck, setSelectedDeck] = useState<string>('__all__');
  const [words, setWords] = useState<AnkiWord[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [inProgressSessions, setInProgressSessions] = useState<Set<string>>(new Set());

  const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(false);
  const [isLocalInitialized, setIsLocalInitialized] = useState<boolean>(false);
  const [dailyNewWordsCount, setDailyNewWordsCount] = useState<number>(0);
  const [dueActiveWordsCount, setDueActiveWordsCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);

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
          setDailyNewWordsCount(getDailyNewWordsCount(profileId));
          const localWords = await db.words
            .where('profileId')
            .equals(profileId)
            .filter(w => w.deckName === LOCAL_DECK_NAME)
            .toArray();
          const mapped = localWords.map(w => ({
            id: w.id,
            word: w.word,
            translation: w.translation,
            interval: w.interval,
            status: w.status,
            deckName: w.deckName,
            rawFront: w.word,
            rawBack: w.translation,
            cardIds: [w.id]
          }));
          setWords(mapped);
        } else {
          setWords([]);
        }
      } else {
        const savedWords = getProfileItem('words');
        if (savedWords) {
          setWords(JSON.parse(savedWords));
        } else {
          setWords([]);
        }
      }

      // Загружаем количество due слов для активного квиза
      const now = Date.now();
      const count = await db.words
        .where('profileId')
        .equals(profileId)
        .filter(w => w.active && w.active.due <= now)
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
        
        // Если это локальный режим, увеличиваем квоту изученных слов сегодня
        if (deckMode === 'local') {
          const newWordsInPool = wordsToUse.filter(w => w.status === 'new').length;
          if (newWordsInPool > 0) {
            incrementDailyNewWordsCount(activeProfileId, newWordsInPool);
            setDailyNewWordsCount(getDailyNewWordsCount(activeProfileId));
          }
        }
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

        {/* Информационная панель об источнике обучения */}
        <div className="card-friendly" style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 800 }}>
              Источник обучения:{' '}
              <span style={{ color: 'var(--color-blue)' }}>
                {deckMode === 'local' && 'Локальная колода'}
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
          <Link href="/settings" className="btn-3d" style={{ fontSize: '14px', padding: '8px 16px' }}>
            <Settings size={16} style={{ marginRight: 6 }} /> Настроить источник
          </Link>
        </div>

        {/* Квизы на повторение слов */}
        {words.length > 0 && (
          <div className="card-friendly" style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', fontSize: '20px', fontWeight: 800 }}>
                  <Sparkles size={20} style={{ color: 'var(--color-orange)', marginRight: 8 }} />
                  {t('Активное повторение слов', '単語の活発な復習')}
                </h2>
                <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {dueActiveWordsCount > 0 ? (
                    t(`У вас есть ${dueActiveWordsCount} слов(а), готовых к повторению по системе FSRS.`, `FSRSによる復習対象の単語が${dueActiveWordsCount}個あります。`)
                  ) : (
                    t('Все активные слова повторены! Отличная работа.', 'すべての単語の復習が完了しています！')
                  )}
                </p>
              </div>
              <button
                onClick={() => router.push('/practice/quiz')}
                disabled={dueActiveWordsCount === 0}
                className={`btn-3d ${dueActiveWordsCount > 0 ? 'btn-orange' : ''}`}
                style={{ padding: '10px 20px', fontSize: '15px' }}
              >
                {t(`Повторить активные слова (Квиз) [${dueActiveWordsCount}]`, `単語の復習テストに進む [${dueActiveWordsCount}]`)}
              </button>
            </div>
          </div>
        )}

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
                  ? 'Локальная колода еще не инициализирована. Пожалуйста, пройдите диагностику в настройках.'
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
                        <span key={idx} className={styles.sessionWordBadge}>
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
      </main>
    </div>
  );
}
