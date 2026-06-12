'use client';

import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, X, ArrowLeft, AlertCircle, Loader2, Lightbulb, BookOpen, Award, Sparkles, RefreshCw } from 'lucide-react';
import { useJapanification } from '@/hooks/useJapanification';
import { useQuests } from '@/hooks/useQuests';
import { getActiveProfileId } from '@/lib/profile';
import { db, addLocalReview } from '@/core/db';
import { getDailyNewWordsCount, getDailyNewWordsLimit, incrementDailyNewWordsCount, syncExistingLocalWordsWithStarterDeck } from '@/core/localDeckService';
import { calculateNextFsrsState, alignPassiveToActiveState, createDefaultFsrsState } from '@/core/scheduler';
import { sanitizeHtml } from '@/lib/sanitize';
import { PhonosemanticHint, PhonosemanticData } from '@/components/PhonosemanticHint';
import phonosemanticsData from '@/resources/phonosemantics.json';
import { isAnswerAcceptable } from '@/lib/quiz/compare';
import styles from './quiz.module.css';

// Типизация phonosemantics.json
interface PhonosemanticEntry {
  reading: string;
  meaning: string;
  relatives: Array<{ kanji: string; reading: string; meaning: string }>;
}
const phonoMap: Record<string, PhonosemanticEntry> = phonosemanticsData;

/**
 * Ищет фоносемантические данные для слова.
 */
function findPhonosemanticData(word: string): PhonosemanticData | null {
  for (const char of word) {
    if (phonoMap[char]) {
      const entry = phonoMap[char];
      return { key: char, reading: entry.reading, relatives: entry.relatives };
    }
    for (const [key, entry] of Object.entries(phonoMap)) {
      if (entry.relatives.some(r => r.kanji === char)) {
        return { key, reading: entry.reading, relatives: entry.relatives };
      }
    }
  }
  return null;
}

interface TargetWord {
  word: string;
  translation: string;
}

interface LocalWord {
  profileId: string;
  id: number;
  word: string;
  reading: string;
  translation: string;
  category: string;
  source: 'anki' | 'starter' | 'manual';
  passive: any;
  active: any;
  contextExamples?: Array<{ sentence: string; translation?: string; timestamp: number }>;
  mnemonic?: string;
}

function QuizComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, addPoints } = useJapanification();
  const { incrementQuestProgress } = useQuests();

  const [profileId, setProfileId] = useState<string>('default');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [words, setWords] = useState<LocalWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const currentWord = words[currentIndex];
  const [userInput, setUserInput] = useState<string>('');
  
  // Состояния квиза
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [showFirstChar, setShowFirstChar] = useState<boolean>(false);
  const [dictDefinition, setDictDefinition] = useState<string | null>(null);
  const [isLoadingDict, setIsLoadingDict] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<number>(0);
  
  // Статистика
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [xpGained, setXpGained] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Мнемоника
  const [mnemonicText, setMnemonicText] = useState<string>('');
  const [isSavingMnemonic, setIsSavingMnemonic] = useState<boolean>(false);

  // ИИ-Этимология
  const [etymologyData, setEtymologyData] = useState<{ components: string[]; etymology: string } | null>(null);
  const [isLoadingEtymology, setIsLoadingEtymology] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const wordsParam = searchParams.get('words');
  const modeParam = searchParams.get('mode');

  // Сохранение мнемоники в IndexedDB
  const saveMnemonic = useCallback(async (text: string) => {
    if (words.length === 0 || currentIndex >= words.length) return;
    const currentWord = words[currentIndex];
    const cleanText = text.trim();
    if (cleanText === (currentWord.mnemonic || '')) return; // Нет изменений
    
    setIsSavingMnemonic(true);
    try {
      await db.words.update(currentWord.id, { mnemonic: cleanText || undefined });
      currentWord.mnemonic = cleanText || undefined;
      if (cleanText) {
        incrementQuestProgress('mnemonics', 1);
      }
    } catch (e) {
      console.error('Ошибка сохранения мнемоники:', e);
    } finally {
      setIsSavingMnemonic(false);
    }
  }, [words, currentIndex, incrementQuestProgress]);

  // Запрос ИИ-этимологии
  const fetchEtymology = useCallback(async () => {
    if (isLoadingEtymology || etymologyData || words.length === 0) return;
    const currentWord = words[currentIndex];
    
    setIsLoadingEtymology(true);
    try {
      const res = await fetch('/api/gemini/etymology', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: currentWord.word })
      });
      if (res.ok) {
        const data = await res.json();
        setEtymologyData(data);
        
        // Автозаполняем мнемонику, если пользователь не написал свою
        if (!mnemonicText.trim() && data.etymology) {
          setMnemonicText(data.etymology);
          await db.words.update(currentWord.id, { mnemonic: data.etymology });
          currentWord.mnemonic = data.etymology;
          incrementQuestProgress('mnemonics', 1);
        }
      } else {
        console.error('Ошибка API этимологии:', res.status);
      }
    } catch (e) {
      console.error('Ошибка запроса этимологии:', e);
    } finally {
      setIsLoadingEtymology(false);
    }
  }, [isLoadingEtymology, etymologyData, words, currentIndex, mnemonicText, incrementQuestProgress]);

  const getFSRSIntervalString = (grade: number) => {
    if (!currentWord) return '';
    try {
      const { newInterval } = calculateNextFsrsState(currentWord, grade, 'active');
      if (newInterval === 0 || newInterval < 1) return '10м';
      if (newInterval < 30) return `${Math.round(newInterval)}д`;
      return `${(newInterval / 30).toFixed(1)}м`;
    } catch (e) {
      return '';
    }
  };

  const saveReviewAndGoNext = async (grade: number) => {
    if (!currentWord) return;
    try {
      const { updatedWord, newInterval, lastInterval } = calculateNextFsrsState(currentWord, grade, 'active');
      let finalWord = updatedWord as LocalWord;
      
      const correct = grade > 1;
      if (correct) {
        finalWord = alignPassiveToActiveState(finalWord) as LocalWord;
        setCorrectCount(prev => prev + 1);
        setXpGained(prev => prev + 1);
        addPoints(1); // +1 XP за правильный ответ в профиль
      }

      if (currentWord.active.status === 'new') {
        incrementDailyNewWordsCount(profileId, 1);
      }

      // Сохраняем прогресс в IndexedDB
      await db.words.put(finalWord);

      // Пишем отзыв для синхронизации
      await addLocalReview({
        profileId,
        cardId: currentWord.id,
        ease: grade,
        interval: newInterval,
        lastInterval,
        duration: Date.now() - startTime,
        timestamp: Date.now(),
        synced: 0,
        reviewType: 'active'
      });

      // Инкрементируем квест на повторения
      incrementQuestProgress('reviews', 1);
    } catch (e) {
      console.error('Ошибка записи FSRS прогресса в квизе:', e);
    }

    await handleNextWord();
  };

  const handleCheckAnswer = () => {
    if (!currentWord || isAnswered || !userInput.trim()) return;

    const correct = isAnswerAcceptable(userInput, currentWord.word) || 
      (!!currentWord.reading && isAnswerAcceptable(userInput, currentWord.reading));
    setIsCorrect(correct);
    setIsAnswered(true);
    setSelectedGrade(correct ? 3 : 1);
  };

  const handleIgnoreTypo = () => {
    setIsCorrect(true);
    setSelectedGrade(3);
  };

  const handleNextWord = async () => {
    if (!currentWord) return;
    // Сохраняем мнемонику при переходе
    if (mnemonicText.trim() && mnemonicText !== (currentWord.mnemonic || '')) {
      await saveMnemonic(mnemonicText);
    }

    if (currentIndex < words.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsCompleted(true);
    }
  };

  const handleShowFirstChar = () => {
    setShowFirstChar(true);
  };

  const handleFetchDefinition = async () => {
    if (!currentWord || isLoadingDict || dictDefinition) return;
    setIsLoadingDict(true);
    try {
      const res = await fetch(`/api/dict/lookup?word=${encodeURIComponent(currentWord.word)}`);
      if (res.ok) {
        const data = await res.json();
        let rawDef = data.definition || data.entry || 'Определение отсутствует в базе';
        // Маскируем целевое слово в определении для исключения прямых подсказок
        const masked = rawDef.replaceAll(currentWord.word, '***');
        setDictDefinition(masked);
      } else {
        setDictDefinition('Не удалось загрузить определение');
      }
    } catch (e) {
      setDictDefinition('Ошибка словаря');
    } finally {
      setIsLoadingDict(false);
    }
  };

  // Загрузка слов
  useEffect(() => {
    const loadQuizWords = async () => {
      try {
        const activeProfile = getActiveProfileId();
        setProfileId(activeProfile);

        // Очищаем опечатки и склеенные слова в БД перед загрузкой
        await syncExistingLocalWordsWithStarterDeck(activeProfile);

        let loadedWords: LocalWord[] = [];

        if (wordsParam) {
          // Режим Ad-hoc: тестируем конкретные слова из чата
          const wordsList = wordsParam
            .split(',')
            .map(w => w.trim())
            .filter(Boolean);

          for (const wStr of wordsList) {
            const match = await db.words
              .where('profileId')
              .equals(activeProfile)
              .filter(item => item.word === wStr)
              .first();

            if (match) {
              loadedWords.push(match as unknown as LocalWord);
            } else {
              // Создаем дефолтный стейт для слова, если его нет в локальной БД
              loadedWords.push({
                profileId: activeProfile,
                id: Math.floor(Math.random() * 10000000),
                word: wStr,
                reading: wStr,
                translation: wStr,
                category: 'Unused Target Word',
                source: 'manual',
                passive: createDefaultFsrsState(Date.now()),
                active: createDefaultFsrsState(Date.now())
              });
            }
          }
        } else if (modeParam === 'new') {
          // Режим закрепления новых слов: берем новые слова (status === 'new')
          const matches = await db.words
            .where('profileId')
            .equals(activeProfile)
            .filter(item => item.active && item.active.status === 'new')
            .toArray();

          const todayNewCount = getDailyNewWordsCount(activeProfile);
          const limit = getDailyNewWordsLimit(activeProfile);
          const remainingQuota = Math.max(0, limit - todayNewCount);

          loadedWords = (matches as unknown as LocalWord[])
            .sort((a, b) => a.id - b.id)
            .slice(0, Math.max(remainingQuota, 10));
        } else {
          // Стандартный режим: due-слова по FSRS (исключая новые)
          const now = Date.now();
          const matches = await db.words
            .where('profileId')
            .equals(activeProfile)
            .filter(item => item.active && item.active.status !== 'new' && item.active.due <= now)
            .toArray();

          loadedWords = matches as unknown as LocalWord[];
        }

        if (loadedWords.length === 0) {
          setIsLoading(false);
          return;
        }

        // Перемешиваем слова
        const shuffled = [...loadedWords].sort(() => Math.random() - 0.5);
        setWords(shuffled);
        setStartTime(Date.now());
      } catch (err: any) {
        console.error('Ошибка загрузки слов для квиза:', err);
        setError('Не удалось загрузить карточки для повторения.');
      } finally {
        setIsLoading(false);
      }
    };

    loadQuizWords();
  }, [wordsParam]);

  // Сброс подсказок и установка фокуса при смене текущего слова
  useEffect(() => {
    if (words.length > 0 && currentIndex < words.length) {
      setUserInput('');
      setIsAnswered(false);
      setSelectedGrade(null);
      setShowFirstChar(false);
      setDictDefinition(null);
      setEtymologyData(null);
      setIsLoadingEtymology(false);
      setStartTime(Date.now());
      
      // Загружаем сохранённую мнемонику
      const currentWord = words[currentIndex];
      setMnemonicText(currentWord.mnemonic || '');
      
      // Фокусируемся на вводе
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [currentIndex, words]);

  // Клавиатурные шорткаты после ответа
  useEffect(() => {
    if (!isAnswered) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Игнорируем шорткаты, если фокус в textarea мнемоники
      if (document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      const key = e.key.toLowerCase();

      if (key === '1' || key === 'a' || key === 'f' || key === 'а') {
        e.preventDefault();
        saveReviewAndGoNext(1);
      } else if (key === '2' || key === 'h' || key === 'д' || key === 'р') {
        e.preventDefault();
        saveReviewAndGoNext(2);
      } else if (key === '3' || key === 'g' || key === 'п' || key === 'о') {
        e.preventDefault();
        saveReviewAndGoNext(3);
      } else if (key === '4' || key === 'e' || key === 'у') {
        e.preventDefault();
        saveReviewAndGoNext(4);
      } else if (key === 'i' || key === '\\' || key === '`' || key === '~' || key === 'ш') {
        if (!isCorrect) {
          e.preventDefault();
          handleIgnoreTypo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAnswered, isCorrect, currentWord, profileId, startTime, saveReviewAndGoNext]);



  if (isLoading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-secondary)', alignItems: 'center', justifyContent: 'center' }}>
        <div className="btn-3d" style={{ pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Loader2 className={styles.spin} size={20} />
          <span>{t('Загрузка квиза...', 'クイズを読み込み中...')}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.quizContainer}>
        <div className={styles.mainArea}>
          <div className={`${styles.cardFriendly} ${styles.resultsCard}`}>
            <AlertCircle size={48} style={{ color: 'var(--color-red)', marginBottom: 16 }} />
            <h2 className={styles.resultsTitle}>{t('Произошла ошибка', 'エラーが発生しました')}</h2>
            <p className={styles.resultsSubtitle}>{error}</p>
            <button onClick={() => router.push('/practice')} className="btn-3d btn-blue">
              {t('Вернуться назад', '戻る')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div className={styles.quizContainer}>
        <header className={styles.quizHeader}>
          <div className={styles.headerLeft}>
            <button onClick={() => router.push('/practice')} className={styles.backButton} title={t('Назад', '戻る')}>
              <ArrowLeft size={20} />
            </button>
            <h1 className={styles.quizTitle}>{t('Интервальный квиз', '間隔学習クイズ')}</h1>
          </div>
        </header>
        <div className={styles.mainArea}>
          <div className={`${styles.cardFriendly} ${styles.resultsCard}`}>
            <span className={styles.emptyIcon}>🎉</span>
            <h2 className={styles.resultsTitle}>{t('Все слова повторены!', 'すべての単語の復習完了！')}</h2>
            <p className={styles.resultsSubtitle}>
              {t('На сегодня у вас нет слов для повторения. Отличный результат!', '今日の復習対象はありません。素晴らしいですね！')}
            </p>
            <button onClick={() => router.push('/practice')} className="btn-3d btn-green">
              {t('Вернуться на страницу практики', '練習ページに戻る')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Завершение квиза
  if (isCompleted) {
    const scorePercent = Math.round((correctCount / words.length) * 100);
    return (
      <div className={styles.quizContainer}>
        <header className={styles.quizHeader}>
          <div className={styles.headerLeft}>
            <button onClick={() => router.push('/practice')} className={styles.backButton} title={t('Назад', '戻る')}>
              <ArrowLeft size={20} />
            </button>
            <h1 className={styles.quizTitle}>{t('Результаты квиза', 'クイズ結果')}</h1>
          </div>
        </header>
        <div className={styles.mainArea}>
          <div className={`${styles.cardFriendly} ${styles.resultsCard}`}>
            <div className={styles.trophyContainer}>
              <Award size={64} style={{ color: 'var(--color-yellow-shadow)' }} />
            </div>
            <h2 className={styles.resultsTitle}>{t('Повторение завершено!', '復習完了！')}</h2>
            <p className={styles.resultsSubtitle}>
              {t('Вы успешно проработали запланированные слова.', '単語の復習プロセスが終了しました。')}
            </p>

            <div className={styles.statsGrid}>
              <div className={styles.statBlock}>
                <span className={`${styles.statVal} ${styles.statValGreen}`}>{scorePercent}%</span>
                <span className={styles.statLbl}>{t('Точность', '正解率')}</span>
              </div>
              <div className={styles.statBlock}>
                <span className={styles.statVal}>+{xpGained} XP</span>
                <span className={styles.statLbl}>{t('Получено очков', '獲得 XP')}</span>
              </div>
            </div>

            <button onClick={() => router.push('/practice')} className="btn-3d btn-green" style={{ width: '100%', maxWidth: '280px' }}>
              {t('Продолжить', '続ける')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Находим подходящий пример предложения
  const examples = currentWord.contextExamples || [];
  const matchedExample = examples.find(ex => ex.sentence && ex.sentence.includes(currentWord.word));
  
  // Фоносемантические данные
  const phonoData = findPhonosemanticData(currentWord.word);

  // Функция для создания Cloze Deletion (пропуска)
  const getClozeSentence = (sentence: string, word: string) => {
    // Очищаем от rt-тегов фуриганы для проверки вхождения
    const cleanSentence = sentence.replace(/<rt>[\s\S]*?<\/rt>/gi, '').replace(/<\/?[^>]+(\>|$)/g, '');
    
    if (cleanSentence.includes(word)) {
      return sentence.replace(word, '_______');
    }
    
    // Если слово обернуто в ruby целиком
    const rubyRegex = new RegExp(`<ruby>[^<]*${word}[^<]*<rt>[^<]*</rt></ruby>`, 'g');
    if (sentence.match(rubyRegex)) {
      return sentence.replace(rubyRegex, '_______');
    }
    
    // Литеральная замена
    return sentence.replace(word, '_______');
  };



  const firstChar = currentWord.word[0] || (currentWord.reading && currentWord.reading[0]);
  const progressPercent = Math.round((currentIndex / words.length) * 100);

  return (
    <div className={styles.quizContainer}>
      {/* HEADER */}
      <header className={styles.quizHeader}>
        <div className={styles.headerLeft}>
          <button onClick={() => router.push('/practice')} className={styles.backButton} title={t('Назад', '戻る')}>
            <ArrowLeft size={20} />
          </button>
          <h1 className={styles.quizTitle}>{t('Интервальный квиз', '学習クイズ')}</h1>
        </div>
        <div className={styles.progressBarContainer}>
          <div className={styles.progressBar} style={{ width: `${progressPercent}%` }} />
        </div>
        <span className={styles.progressText}>{currentIndex + 1} / {words.length}</span>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className={styles.mainArea}>
        <div className={styles.cardFriendly}>
          <div className={styles.promptSection}>
            <span className={styles.promptLabel}>
              {matchedExample ? t('Заполните пропуск в предложении:', '文の空欄を埋めてください:') : t('Переведите слово на японский:', '単語を日本語に翻訳してください:')}
            </span>
            
            {/* Показ контекстного перевода */}
            <div className={styles.translationContext}>
              {matchedExample ? matchedExample.translation : currentWord.translation}
            </div>

            {/* Предложение с пропуском */}
            {matchedExample && (
              <div 
                className={styles.clozeSentence}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(getClozeSentence(matchedExample.sentence, currentWord.word)) }}
              />
            )}
          </div>

          {/* HINTS TRIGGER BAR */}
          {!isAnswered && (
            <div className={styles.hintContainer}>
              <button 
                onClick={handleShowFirstChar}
                disabled={showFirstChar}
                className={`${styles.hintButton} btn-3d`}
              >
                <Lightbulb size={14} />
                {t('Первый символ', '最初の文字')}
              </button>
              <button 
                onClick={handleFetchDefinition}
                disabled={isLoadingDict || !!dictDefinition}
                className={`${styles.hintButton} btn-3d`}
              >
                {isLoadingDict ? (
                  <Loader2 className={styles.spin} size={14} />
                ) : (
                  <BookOpen size={14} />
                )}
                {t('Словарное определение', '辞書の定義')}
              </button>
            </div>
          )}

          {/* HINTS TEXT DISPLAY */}
          {showFirstChar && (
            <div className={styles.hintContent}>
              <strong>{t('Подсказка (Первый символ):', 'ヒント（最初の文字）:')}</strong> {firstChar}
            </div>
          )}

          {dictDefinition && (
            <div className={styles.hintContent}>
              <strong>{t('Подсказка (Определение словаря):', 'ヒント（辞書の定義）:')}</strong>
              <div 
                className={styles.jitendexHtml}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(dictDefinition) }}
              />
            </div>
          )}

          {/* INPUT FORM */}
          <div className={styles.inputGroup}>
            <input
              ref={inputRef}
              type="text"
              className={styles.quizInput}
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              placeholder={t('Введите ответ на японском...', '日本語で入力...')}
              disabled={isAnswered}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (!isAnswered) {
                    if (userInput.trim()) handleCheckAnswer();
                  } else {
                    saveReviewAndGoNext(selectedGrade ?? (isCorrect ? 3 : 1));
                  }
                }
              }}
              autoFocus
            />
          </div>

          {/* FEEDBACK STATUS BANNERS */}
          {isAnswered && (
            <div className={`${styles.feedbackArea} ${isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect}`}>
              <div className={styles.feedbackIcon}>
                {isCorrect ? <Check size={18} /> : <X size={18} />}
              </div>
              <div className={styles.feedbackText}>
                {isCorrect ? (
                  t('Верно! Отличная работа.', '正解！素晴らしい仕事です。')
                ) : (
                  <>
                    <span>{t('Неверно. ', '不正解。')}</span>
                    {currentWord.reading && currentWord.reading.trim() !== currentWord.word.trim() ? (
                      <ruby>
                        <strong>{currentWord.word}</strong>
                        <rt style={{ fontSize: '0.55em', color: 'var(--text-secondary)' }}>{currentWord.reading}</rt>
                      </ruby>
                    ) : (
                      <strong>{currentWord.word}</strong>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* VISUAL REINFORCEMENT (KANJI RETENTION BLOCK) */}
          {isAnswered && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '16px 0', gap: '8px', animation: 'fadeIn 0.3s' }}>
              <span className={styles.overrideLabel}>{t('Визуальный образ слова:', '単語の視覚的イメージ:')}</span>
              <div style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '2px', textAlign: 'center' }}>
                {currentWord.reading && currentWord.reading.trim() !== currentWord.word.trim() ? (
                  <ruby>
                    {currentWord.word}
                    <rt style={{ fontSize: '0.45em', color: 'var(--text-secondary)', userSelect: 'none' }}>
                      {currentWord.reading}
                    </rt>
                  </ruby>
                ) : (
                  currentWord.word
                )}
              </div>
            </div>
          )}

          {/* PHONOSEMANTIC HINT — показываем после ответа */}
          {isAnswered && phonoData && (
            <PhonosemanticHint data={phonoData} />
          )}

          {/* MNEMONIC SECTION — показываем после ответа */}
          {isAnswered && (
            <div className={styles.mnemonicSection}>
              <span className={styles.mnemonicLabel}>📝 {t('Заметка / мнемоника', 'メモ / ニーモニック')}</span>
              <textarea
                className={styles.mnemonicTextarea}
                value={mnemonicText}
                onChange={e => setMnemonicText(e.target.value)}
                onBlur={() => saveMnemonic(mnemonicText)}
                placeholder={t('Запишите ассоциацию для запоминания...', '覚えるための連想メモを書いてください...')}
              />
              
              {/* Кнопка ИИ-Этимологии */}
              <button
                className={styles.etymologyBtn}
                onClick={fetchEtymology}
                disabled={isLoadingEtymology || !!etymologyData}
                type="button"
              >
                {isLoadingEtymology ? (
                  <Loader2 className={styles.spin} size={14} />
                ) : (
                  <Sparkles size={14} />
                )}
                ✨ {t('ИИ-Этимология', 'AI語源')}
              </button>

              {/* Результат этимологии */}
              {etymologyData && (
                <div className={styles.etymologyContent}>
                  {etymologyData.components.length > 0 && (
                    <div className={styles.etymologyComponents}>
                      {etymologyData.components.map((comp, i) => (
                        <span key={i} className={styles.etymologyChip}>{comp}</span>
                      ))}
                    </div>
                  )}
                  <div>{etymologyData.etymology}</div>
                </div>
              )}
            </div>
          )}

          {/* MANUAL OVERRIDE AND IGNORE TYPO CONTROLS */}
          {isAnswered && (
            <div style={{ width: '100%', marginTop: 24 }}>
              {/* Ignore Typo Button (visible only if validation initially failed and user has not ignored it yet) */}
              {!isCorrect && (
                <button
                  type="button"
                  onClick={handleIgnoreTypo}
                  className={`${styles.ignoreTypoBtn} btn-3d btn-yellow`}
                >
                  <RefreshCw size={16} />
                  {t('Опечатка / Принять ответ', 'タイポを許容 / 正解にする')}
                </button>
              )}

              {/* FSRS Rating Buttons */}
              <span className={styles.overrideLabel}>
                {t('Оцените сложность воспоминания:', '記憶の難易度を評価:')}
              </span>
              <div className={styles.overrideGradeBar}>
                <button
                  type="button"
                  onClick={() => saveReviewAndGoNext(1)}
                  className={`${styles.gradeBtn} btn-3d btn-gray ${!isCorrect ? styles.defaultGradeBtn : ''}`}
                >
                  <span className={styles.gradeLabel}>
                    {t('Повторить', 'もう一度')} {!isCorrect && ' ↵'}
                  </span>
                  <span className={styles.gradeBadge}>{getFSRSIntervalString(1)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => saveReviewAndGoNext(2)}
                  className={`${styles.gradeBtn} btn-3d btn-orange`}
                >
                  <span className={styles.gradeLabel}>{t('Трудно', ' 難しい')}</span>
                  <span className={styles.gradeBadge}>{getFSRSIntervalString(2)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => saveReviewAndGoNext(3)}
                  className={`${styles.gradeBtn} btn-3d btn-green ${isCorrect ? styles.defaultGradeBtn : ''}`}
                >
                  <span className={styles.gradeLabel}>
                    {t('Хорошо', ' 普通')} {isCorrect && ' ↵'}
                  </span>
                  <span className={styles.gradeBadge}>{getFSRSIntervalString(3)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => saveReviewAndGoNext(4)}
                  className={`${styles.gradeBtn} btn-3d btn-blue`}
                >
                  <span className={styles.gradeLabel}>{t('Легко', '簡単')}</span>
                  <span className={styles.gradeBadge}>{getFSRSIntervalString(4)}</span>
                </button>
              </div>
            </div>
          )}

          {/* SUBMIT OR NEXT ACTIONS */}
          <div className={styles.actionArea}>
            {!isAnswered ? (
              <button
                onClick={handleCheckAnswer}
                disabled={!userInput.trim()}
                className={`${styles.submitBtn} btn-3d btn-green`}
              >
                {t('Проверить', '確認')}
              </button>
            ) : (
              <button
                onClick={() => saveReviewAndGoNext(selectedGrade ?? (isCorrect ? 3 : 1))}
                className={`${styles.submitBtn} btn-3d btn-purple`}
              >
                {currentIndex < words.length - 1 ? t('Следующее слово', '次の単語') : t('Завершить', '終了')}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-secondary)', alignItems: 'center', justifyContent: 'center' }}>
        <div className="btn-3d" style={{ pointerEvents: 'none' }}>Загрузка...</div>
      </div>
    }>
      <QuizComponent />
    </Suspense>
  );
}
