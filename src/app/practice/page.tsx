'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Settings, Sparkles, RefreshCw, AlertCircle, Play, XCircle, ArrowLeft, X, Volume2, Target, Trophy, CheckCircle } from 'lucide-react';
import { useJapanification } from '@/hooks/useJapanification';
import { useQuests } from '@/hooks/useQuests';
import { useMediaRecommendation, type MediaItem } from '@/hooks/useMediaRecommendation';
import { MediaInteractivePlayer } from '@/components/MediaInteractivePlayer';
import { LearningTrack } from '@/components/LearningTrack';
import type { MacroLadderProfile } from '@/components/LearningTrack';
import { buildCompetencyProfile } from '@/lib/competency/profile';
import { getProfileItem, setProfileItem, removeProfileItem, getActiveProfileId } from '@/lib/profile';
import type { GeneratedSession } from '@/lib/gemini/client';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { PhonosemanticHint, PhonosemanticData } from '@/components/PhonosemanticHint';
import { ScienceTip } from '@/components/ScienceTip';
import { BalanceWidget } from '@/components/BalanceWidget';
import { ServiceUnavailable } from '@/components/ServiceUnavailable';
import { recordActivity, type Strand } from '@/lib/balance/balance';
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
import { db, getGrammarProgressList, type GrammarProgress } from '@/core/db';
import { GrammarTrack } from '@/components/GrammarTrack';
import { GrammarTrainer } from '@/components/GrammarTrainer';
import grammarRules from '@/resources/grammar_rules.json';
import type { LocalWord } from '@/core/types';
import { canEnterChat } from '@/core/scheduler';
import { AnkiWord } from '@/plugins/anki/filter';
import phonosemanticsData from '@/resources/phonosemantics.json';
import { isAnswerAcceptable } from '@/lib/quiz/compare';
import { romajiToHiragana } from '@/lib/quiz/romaji';
import { sortNewWordsByPriority, pickNonInterferingBatch } from '@/lib/words/priority';
import { pickDiscriminationDistractors } from '@/lib/words/similarity';
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

function generateOptions(
  correct: string,
  currentWord: LocalWord,
  allWords: LocalWord[],
  field: 'reading' | 'translation'
): string[] {
  // 1. Сначала ищем дистракторы среди зрелых слов с общими кандзи (интерференция)
  const discriminationDistractors = pickDiscriminationDistractors(currentWord, allWords, field)
    .filter(val => val !== correct);
  
  let distractors = Array.from(new Set(discriminationDistractors));

  // 2. Если не набрали 2 дистрактора, добираем по ситуационным тегам
  if (distractors.length < 2) {
    const targetTags = currentWord.tags || [];
    const sameTagWords = allWords.filter(w => 
      w.word !== currentWord.word && 
      w[field] !== correct &&
      w.tags && 
      w.tags.some(t => t !== 'universal' && targetTags.includes(t)) &&
      !distractors.includes(w[field])
    );

    const sameTagVals = Array.from(new Set(sameTagWords.map(w => w[field])));
    const needed = 2 - distractors.length;
    distractors = [...distractors, ...sameTagVals.sort(() => Math.random() - 0.5).slice(0, needed)];
  }

  // 3. Если все еще меньше 2, добираем из оставшихся слов
  if (distractors.length < 2) {
    const others = allWords
      .filter(w => w.word !== currentWord.word && w[field] !== correct && !distractors.includes(w[field]))
      .map(w => w[field]);
    const uniqueOthers = Array.from(new Set(others));
    const needed = 2 - distractors.length;
    distractors = [...distractors, ...uniqueOthers.sort(() => Math.random() - 0.5).slice(0, needed)];
  } else {
    distractors = distractors.slice(0, 2);
  }

  const options = [...distractors, correct].sort(() => Math.random() - 0.5);
  return options;
}

export default function PracticePage() {
  const router = useRouter();
  const { state: jState, t } = useJapanification();
  const { quests } = useQuests();

  const [activeProfileId, setActiveProfileId] = useState<string>('default');
  const [deckMode, setDeckMode] = useState<'standard' | 'custom' | 'local'>('local');
  const [selectedDeck, setSelectedDeck] = useState<string>('__all__');
  const [words, setWords] = useState<AnkiWord[]>([]);
  const [localWords, setLocalWords] = useState<LocalWord[]>([]); // Полные LocalWord для lookup статусов
  const [sessions, setSessions] = useState<GeneratedSession[]>([]);
  const [inProgressSessions, setInProgressSessions] = useState<Set<string>>(new Set());
  const [completedSessions, setCompletedSessions] = useState<Set<string>>(new Set());
  const [completedSessionsCountToday, setCompletedSessionsCountToday] = useState<number>(0);

  const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(false);
  const [isLocalInitialized, setIsLocalInitialized] = useState<boolean>(false);
  const [dailyNewWordsCount, setDailyNewWordsCount] = useState<number>(0);
  const [dailyNewWordsLimit, setDailyNewWordsLimit] = useState<number>(10);
  const [dueActiveWordsCount, setDueActiveWordsCount] = useState<number>(0);
  const [newWordsCount, setNewWordsCount] = useState<number>(0);
  const [priorityWordsCount, setPriorityWordsCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  // Отдельное состояние для недоступности ИИ-сервиса (с возможностью повтора), не путать с валидационными ошибками
  const [serviceError, setServiceError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);

  const isChatAllowed = useMemo(() => {
    if (deckMode !== 'local') return true;
    return canEnterChat(localWords);
  }, [deckMode, localWords]);

  // Контекст для прогрессивного раскрытия: квесты (повторения/чаты/мнемоники)
  // показываем, когда у пользователя уже есть слова в изучении. Нулевому новичку
  // (только новые слова) — мягкая подсказка вместо непонятных целей.
  const hasStudyContext = useMemo(
    () => deckMode !== 'local' || localWords.some(w => w.active.status !== 'new'),
    [deckMode, localWords]
  );

  // Warm-up состояние
  const [warmup, setWarmup] = useState<WarmupState | null>(null);
  const [warmupOptions, setWarmupOptions] = useState<string[]>([]);
  const [warmupTypedInput, setWarmupTypedInput] = useState<string>('');

  // Грамматические состояния
  const [activeTab, setActiveTab] = useState<'words' | 'grammar' | 'media'>('words');
  const [activityLog, setActivityLog] = useState<Strand[]>([]);
  const [selectedGrammarLevel, setSelectedGrammarLevel] = useState<'N5' | 'N4'>('N5');
  const [grammarProgress, setGrammarProgress] = useState<Record<string, GrammarProgress>>({});
  const [activeGrammarRuleId, setActiveGrammarRuleId] = useState<string | null>(null);

  // Профиль компетентности для макро-лестницы
  const [macroLadderProfile, setMacroLadderProfile] = useState<MacroLadderProfile>({
    activeLevelId: 'N5',
    coverages: {}
  });

  // Состояния для медиа-рекомендаций
  const {
    recommendations: mediaRecommendations,
    isLoading: isMediaLoading,
    error: mediaError,
    addCustomUrl,
    refreshFeed: refreshMediaFeed
  } = useMediaRecommendation();
  const [activeMedia, setActiveMedia] = useState<MediaItem | null>(null);
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [isAddingUrl, setIsAddingUrl] = useState<boolean>(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Новые состояния для поиска видео по запросу (Phase B)
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [searchContinuation, setSearchContinuation] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [shownVideoIds, setShownVideoIds] = useState<string[]>([]);

  const handleMediaSearch = useCallback(async (isRefresh = false, nextToken?: string) => {
    const queryToSearch = isRefresh ? activeSearchQuery : searchQuery;
    if (!queryToSearch.trim() && !nextToken) return;

    setIsSearching(true);
    setSearchError(null);
    try {
      const profileId = getActiveProfileId();

      // Находим леммы известных пользователю слов
      const localWords = await db.words.where('profileId').equals(profileId).toArray();
      const knownWords: string[] = [];
      for (const w of localWords) {
        const isActiveKnown = w.active && (w.active.status === 'mature' || (w.active.status === 'review' && w.active.interval >= 7));
        if (isActiveKnown) {
          knownWords.push(w.word);
        }
      }

      // Генерируем новый seed для случайной перетасовки при нажатии «Обновить»
      const seed = isRefresh ? Math.floor(Math.random() * 100000) : 42;

      // Тир подбора под уровень: chatLevel как прагматичный прокси уровня пользователя
      // (1-2 → beginner, 3 → bridge, 4-5 → acquisition)
      const mediaTier = jState.chatLevel <= 2 ? 'beginner' : jState.chatLevel === 3 ? 'bridge' : 'acquisition';

      const res = await fetch('/api/media/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryToSearch,
          excludeIds: shownVideoIds,
          seed,
          knownWords,
          continuation: nextToken,
          pageSize: 6,
          tier: mediaTier
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Не удалось выполнить поиск');
      }

      const data = await res.json();
      const newResults = data.results || [];

      if (nextToken) {
        setSearchResults(prev => [...prev, ...newResults]);
      } else {
        setSearchResults(newResults);
      }

      setSearchContinuation(data.continuation || null);
      if (!nextToken) {
        setActiveSearchQuery(queryToSearch);
      }

      // Сохраняем видео в историю просмотренных
      const newVideoIds = newResults.map((r: MediaItem) => r.id);
      let updatedHistory = [...shownVideoIds, ...newVideoIds];
      if (updatedHistory.length > 500) {
        updatedHistory = updatedHistory.slice(updatedHistory.length - 500);
      }
      setShownVideoIds(updatedHistory);
      setProfileItem('shown_video_ids', JSON.stringify(updatedHistory), profileId);

    } catch (err) {
      setSearchError((err instanceof Error ? err.message : '') || 'Ошибка поиска видео');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, activeSearchQuery, shownVideoIds, jState.chatLevel]);

  const handleResetSearch = () => {
    setSearchQuery('');
    setActiveSearchQuery('');
    setSearchResults([]);
    setSearchContinuation(null);
    setSearchError(null);
  };

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

      // Загружаем прогресс по грамматике
      const progressList = await getGrammarProgressList(profileId);
      const progressMap: Record<string, GrammarProgress> = {};
      progressList.forEach(p => {
        progressMap[p.ruleId] = p;
      });
      setGrammarProgress(progressMap);

      // Вычисляем профиль компетентности для макро-лестницы N5→N1
      const allProfileWords = await db.words.where('profileId').equals(profileId).toArray();
      const sessionsRaw = getProfileItem('competency_sessions');
      const competencySessions: import('@/lib/competency/profile').SessionStat[] = sessionsRaw
        ? JSON.parse(sessionsRaw)
        : [];
      const computedProfile = buildCompetencyProfile(
        allProfileWords,
        progressMap,
        competencySessions
      );
      setMacroLadderProfile({
        activeLevelId: computedProfile.level,
        coverages: {
          [computedProfile.level]: {
            lexCoverage: computedProfile.lexCoverage,
            grammarCoverage: computedProfile.grammarCoverage
          }
        }
      });

      // Загружаем историю показанных видео для поиска
      const savedShown = getProfileItem('shown_video_ids', profileId);
      if (savedShown) {
        try {
          setShownVideoIds(JSON.parse(savedShown));
        } catch {
          setShownVideoIds([]);
        }
      } else {
        setShownVideoIds([]);
      }

      const savedLog = getProfileItem('activity_log', profileId);
      if (savedLog) {
        try {
          setActivityLog(JSON.parse(savedLog));
        } catch {
          setActivityLog([]);
        }
      } else {
        setActivityLog([]);
      }
    } catch (e) {
      console.error('Ошибка загрузки данных профиля для практики', e);
    } finally {
      setHasLoaded(true);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, []);

  // Отслеживаем прогресс сессий в процессе и выполненные сессии
  useEffect(() => {
    if (!hasLoaded || sessions.length === 0) return;

    const inProgress = new Set<string>();
    const completed = new Set<string>();
    let completedCount = 0;

    sessions.forEach(session => {
      try {
        const savedStateStr = getProfileItem(`chat_state_${session.id}`);
        if (savedStateStr) {
          const savedState = JSON.parse(savedStateStr);
          if (savedState) {
            if (savedState.isComplete) {
              completed.add(session.id);
              completedCount++;
            } else if (savedState.messages && savedState.messages.length > 0) {
              inProgress.add(session.id);
            }
          }
        }
      } catch {
        // Ошибка чтения
      }
    });

    setInProgressSessions(inProgress);
    setCompletedSessions(completed);
    setCompletedSessionsCountToday(completedCount);
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
    
    // Сортируем новые слова по приоритету JLPT и собираем непересекающийся по кандзи батч
    const sortedNewWords = sortNewWordsByPriority(newWords);
    const wordsForWarmup = pickNonInterferingBatch(sortedNewWords, limit);

    const state: WarmupState = {
      words: wordsForWarmup,
      currentIndex: 0,
      step: 'sight',
      selectedAnswer: null,
      isCorrect: null,
    };
    setWarmup(state);
    setWarmupOptions([]);
    setWarmupTypedInput('');
  }, [localWords, dailyNewWordsLimit, dailyNewWordsCount]);

  const advanceWarmup = useCallback(() => {
    if (!warmup) return;
    const { step, currentIndex, words: wWords } = warmup;
    const currentWord = wWords[currentIndex];

    if (step === 'sight') {
      // Переход к kana check
      const options = generateOptions(currentWord.reading, currentWord, wWords, 'reading');
      setWarmupOptions(options);
      setWarmup({ ...warmup, step: 'kana', selectedAnswer: null, isCorrect: null });
      setWarmupTypedInput('');
    } else if (step === 'kana') {
      // Переход к translation check
      const options = generateOptions(currentWord.translation, currentWord, wWords, 'translation');
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

        const pId = getActiveProfileId();
        if (pId) {
          const savedLogStr = getProfileItem('activity_log', pId);
          let currentLog: Strand[] = [];
          if (savedLogStr) {
            try {
              currentLog = JSON.parse(savedLogStr);
            } catch {}
          }
          const updatedLog = recordActivity('structure', currentLog);
          setProfileItem('activity_log', JSON.stringify(updatedLog), pId);
          setActivityLog(updatedLog);
        }
      }
    }
  }, [warmup]);

  const handleWarmupSubmit = useCallback(() => {
    if (!warmup || warmup.selectedAnswer !== null || !warmupTypedInput.trim()) return;
    const currentWord = warmup.words[warmup.currentIndex];
    const correct = isAnswerAcceptable(warmupTypedInput, currentWord.reading);
    setWarmup({ ...warmup, selectedAnswer: warmupTypedInput, isCorrect: correct });
  }, [warmup, warmupTypedInput]);

  const handleWarmupShowAnswer = useCallback(() => {
    if (!warmup || warmup.selectedAnswer !== null) return;
    const currentWord = warmup.words[warmup.currentIndex];
    setWarmup({ ...warmup, selectedAnswer: currentWord.reading, isCorrect: false });
    setWarmupTypedInput(currentWord.reading);
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
    if (!isChatAllowed) return;
    setIsLoadingSessions(true);
    setError(null);
    setServiceError(null);
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
        // Сервис вернул структурный контракт {error, reason, retryable}
        setServiceError({
          message: data.error || 'ИИ-сервис временно недоступен. Попробуйте ещё раз позже.',
          retryable: data.retryable ?? true,
        });
      }
    } catch {
      // Сетевой сбой (fetch failed) — человеческое сообщение, повтор доступен
      setServiceError({
        message: 'Не удалось связаться с ИИ-сервисом. Проверьте подключение и попробуйте ещё раз.',
        retryable: true,
      });
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const startSession = (session: GeneratedSession) => {
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

  const launchMedia = useCallback((item: MediaItem) => {
    setActiveMedia(item);
    
    const pId = getActiveProfileId();
    if (pId) {
      const savedLogStr = getProfileItem('activity_log', pId);
      let currentLog: Strand[] = [];
      if (savedLogStr) {
        try {
          currentLog = JSON.parse(savedLogStr);
        } catch {}
      }
      const updatedLog = recordActivity('immersion', currentLog);
      setProfileItem('activity_log', JSON.stringify(updatedLog), pId);
      setActivityLog(updatedLog);
    }
  }, []);

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
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Введите чтение:</span>
                <ScienceTip tipId="typed_answer" />
              </div>
              <input
                type="text"
                className={
                  styles.warmupInput + 
                  (warmup.selectedAnswer !== null 
                    ? warmup.isCorrect 
                      ? ` ${styles.warmupInputCorrect}` 
                      : ` ${styles.warmupInputWrong}`
                    : '')
                }
                value={warmupTypedInput}
                onChange={e => setWarmupTypedInput(e.target.value)}
                disabled={warmup.selectedAnswer !== null}
                placeholder="Введите чтение (можно ромадзи)..."
                onKeyDown={e => {
                  if (e.key === 'Enter' && warmupTypedInput.trim()) {
                    handleWarmupSubmit();
                  }
                }}
                autoFocus
              />
              {/* Предпросмотр каны при вводе ромадзи (не мутирует поле) */}
              {warmup.selectedAnswer === null && /[a-zA-Z]/.test(warmupTypedInput) && (
                <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  → {romajiToHiragana(warmupTypedInput)}
                </div>
              )}
              {warmup.selectedAnswer === null && (
                <button
                  type="button"
                  className="btn-3d btn-gray"
                  onClick={handleWarmupShowAnswer}
                  style={{ marginTop: 8 }}
                >
                  Показать ответ
                </button>
              )}
              {warmup.selectedAnswer !== null && !warmup.isCorrect && (
                <div style={{ color: 'var(--color-red)', fontWeight: 700, marginTop: '8px' }}>
                  Правильное чтение: {currentWord.reading}
                </div>
              )}
              {warmup.selectedAnswer !== null && warmup.isCorrect && (
                <div style={{ color: 'var(--color-green-shadow)', fontWeight: 700, marginTop: '8px' }}>
                  Верно!
                </div>
              )}
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

  const handleAddMediaUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrlInput.trim() || isAddingUrl) return;
    setIsAddingUrl(true);
    setImportError(null);
    try {
      const item = await addCustomUrl(customUrlInput.trim());
      if (item) {
        setCustomUrlInput('');
        // Автоматически запускаем воспроизведение импортированного видео
        launchMedia(item);
      } else {
        setImportError(mediaError || 'Не удалось импортировать видео по ссылке. Проверьте правильность URL.');
      }
    } catch (e) {
      setImportError((e instanceof Error ? e.message : '') || 'Ошибка импорта.');
    } finally {
      setIsAddingUrl(false);
    }
  };

  const renderMediaTab = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
        
        {/* Поиск видео на YouTube */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 800 }}>Поиск видео на YouTube</h4>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="input-friendly"
              placeholder="Найти обучающие видео (например: заказать суши, в аэропорту, разговорный)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleMediaSearch(false); }}
              style={{ flex: 1, minWidth: '250px' }}
              disabled={isSearching}
            />
            <button
              onClick={() => handleMediaSearch(false)}
              disabled={isSearching || !searchQuery.trim()}
              className="btn-3d btn-blue"
              style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {isSearching ? <RefreshCw size={16} className={styles.spin} /> : null}
              Найти
            </button>
            {activeSearchQuery && (
              <button
                onClick={handleResetSearch}
                className="btn-3d btn-gray"
                style={{ padding: '10px 20px' }}
              >
                Сбросить
              </button>
            )}
          </div>
        </div>

        {/* Панель импорта ссылки (прежний функционал) */}
        {!activeSearchQuery && (
          <form onSubmit={handleAddMediaUrl} className={styles.mediaImportForm} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="input-friendly"
              placeholder="Вставьте ссылку на YouTube для импорта (например, https://www.youtube.com/watch?v=...)"
              value={customUrlInput}
              onChange={(e) => setCustomUrlInput(e.target.value)}
              style={{ flex: 1, minWidth: '250px' }}
              disabled={isAddingUrl}
            />
            <button
              type="submit"
              disabled={isAddingUrl || !customUrlInput.trim()}
              className="btn-3d btn-green"
              style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {isAddingUrl ? (
                <>
                  <RefreshCw size={16} className={styles.spin} />
                  Импорт...
                </>
              ) : (
                'Импортировать'
              )}
            </button>
          </form>
        )}

        {importError && !activeSearchQuery && (
          <div className={styles.errorAlert} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <AlertCircle size={16} />
            <p style={{ margin: 0 }}>{importError}</p>
          </div>
        )}

        {searchError && (
          <div className={styles.errorAlert} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <AlertCircle size={16} />
            <p style={{ margin: 0 }}>{searchError}</p>
          </div>
        )}

        {/* Основной контент вкладки */}
        {activeSearchQuery ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                Результаты поиска по запросу «{activeSearchQuery}»
              </h3>
              {searchResults.length > 0 && (
                <button
                  onClick={() => handleMediaSearch(true)}
                  disabled={isSearching}
                  className="btn-3d btn-purple"
                  style={{ padding: '8px 16px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <RefreshCw size={14} className={isSearching ? styles.spin : ''} />
                  Обновить выдачу
                </button>
              )}
            </div>

            {isSearching && searchResults.length === 0 ? (
              <div className={styles.loadingText} style={{ padding: '48px 24px' }}>
                <RefreshCw size={28} className={styles.spin} style={{ margin: '0 auto 16px auto', color: 'var(--color-blue)', display: 'block' }} />
                <p style={{ margin: 0, fontWeight: 700, fontSize: '16px' }}>Ищем подходящие видео и анализируем их субтитры...</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className={styles.emptyState}>
                <XCircle size={48} className={styles.emptyIcon} />
                <p>По вашему запросу не найдено подходящих видео с японскими субтитрами.</p>
              </div>
            ) : (
              <div>
                <div className={styles.mediaGrid}>
                  {searchResults.map((item) => {
                    const cr = item.comprehensionRate || 0;
                    // Низкий процент знакомых слов — нейтрально (для новичка 0% это норма, не ошибка)
                    let barColor = 'var(--text-secondary)';
                    let textColor = 'var(--text-secondary)';
                    if (cr >= 85) {
                      barColor = 'var(--color-green)';
                      textColor = 'var(--color-green)';
                    } else if (cr >= 70) {
                      barColor = 'var(--color-yellow-shadow)';
                      textColor = 'var(--color-yellow-shadow)';
                    } else if (cr >= 50) {
                      barColor = 'var(--color-orange)';
                      textColor = 'var(--color-orange)';
                    }

                    return (
                      <div key={item.id} className={`${styles.mediaCard} card-friendly`}>
                        <div className={styles.mediaCardHeader}>
                          <span className={`${styles.platformBadge} ${styles.ytBadge}`}>
                            YouTube
                          </span>
                          {item.trackKind === 'manual' && (
                            <span className={styles.overlapBadge} style={{ backgroundColor: 'var(--color-blue)', color: 'white' }}>
                              ✍️ Ручные субтитры
                            </span>
                          )}
                        </div>

                        <h4 className={styles.mediaCardTitle}>{item.title}</h4>
                        <p className={styles.mediaCardDesc}>{item.description}</p>

                        <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px', fontWeight: 800 }}>
                            <span>Степень понимания:</span>
                            <span style={{ color: textColor }}>{cr}% знакомых слов</span>
                          </div>
                          <div style={{ width: '100%', height: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '5px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                            <div style={{ width: `${cr}%`, height: '100%', backgroundColor: barColor, transition: 'width 0.3s ease' }} />
                          </div>
                          {cr >= 80 && (
                            <p style={{ margin: '8px 0 0 0', fontSize: '11px', fontWeight: 700, color: 'var(--color-green)' }}>
                              🎯 Рекомендуется как Comprehensible Input
                            </p>
                          )}
                        </div>

                        <button
                          onClick={() => launchMedia(item)}
                          className="btn-3d btn-blue"
                          style={{ marginTop: '16px', width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px' }}
                        >
                          <Play size={14} />
                          Смотреть и учить
                        </button>
                      </div>
                    );
                  })}
                </div>

                {searchContinuation && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
                    <button
                      onClick={() => handleMediaSearch(false, searchContinuation)}
                      disabled={isSearching}
                      className="btn-3d btn-green"
                      style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      {isSearching ? <RefreshCw size={16} className={styles.spin} /> : null}
                      Показать еще
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 800 }}>Рекомендованный медиаконтент</h3>
            
            {isMediaLoading && mediaRecommendations.length === 0 ? (
              <div className={styles.loadingText} style={{ padding: '48px 24px' }}>
                <RefreshCw size={28} className={styles.spin} style={{ margin: '0 auto 16px auto', color: 'var(--color-blue)', display: 'block' }} />
                <p style={{ margin: 0, fontWeight: 700, fontSize: '16px' }}>Анализируем ваш лексический профиль и подбираем Comprehensible Input...</p>
              </div>
            ) : mediaRecommendations.length === 0 ? (
              <div className={styles.emptyState}>
                <XCircle size={48} className={styles.emptyIcon} />
                <p>Медиаконтент не найден. Попробуйте найти обучающие видео по поиску выше.</p>
              </div>
            ) : (
              <div className={styles.mediaGrid}>
                {mediaRecommendations.map((item) => {
                  const cr = item.comprehensionRate || 0;
                  // Низкий процент знакомых слов — нейтрально (для новичка 0% это норма, не ошибка)
                  let barColor = 'var(--text-secondary)';
                  let textColor = 'var(--text-secondary)';
                  if (cr >= 85) {
                    barColor = 'var(--color-green)';
                    textColor = 'var(--color-green)';
                  } else if (cr >= 70) {
                    barColor = 'var(--color-yellow-shadow)';
                    textColor = 'var(--color-yellow-shadow)';
                  } else if (cr >= 50) {
                    barColor = 'var(--color-orange)';
                    textColor = 'var(--color-orange)';
                  }

                  return (
                    <div key={item.id} className={`${styles.mediaCard} card-friendly`}>
                      <div className={styles.mediaCardHeader}>
                        <span className={`${styles.platformBadge} ${item.platform === 'youtube' ? styles.ytBadge : styles.podcastBadge}`}>
                          {item.platform === 'youtube' ? 'YouTube' : 'Подкаст'}
                        </span>
                        {item.dueOverlapCount !== undefined && item.dueOverlapCount > 0 && (
                          <span className={styles.overlapBadge}>
                            ✨ Повторение: {item.dueOverlapCount} слов
                          </span>
                        )}
                      </div>

                      <h4 className={styles.mediaCardTitle}>{item.title}</h4>
                      <p className={styles.mediaCardDesc}>{item.description}</p>

                      <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px', fontWeight: 800 }}>
                          <span>Степень понимания:</span>
                          <span style={{ color: textColor }}>{cr}% знакомых слов</span>
                        </div>
                        <div style={{ width: '100%', height: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '5px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                          <div style={{ width: `${cr}%`, height: '100%', backgroundColor: barColor, transition: 'width 0.3s ease' }} />
                        </div>
                        {cr >= 80 && (
                          <p style={{ margin: '8px 0 0 0', fontSize: '11px', fontWeight: 700, color: 'var(--color-green)' }}>
                            🎯 Рекомендуется как Comprehensible Input
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => launchMedia(item)}
                        className="btn-3d btn-blue"
                        style={{ marginTop: '16px', width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px' }}
                      >
                        <Play size={14} />
                        Смотреть и учить
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
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
            <p>Пока в работе {priorityWordsCount} слов(а) — для диалога это немного, поэтому они могут повторяться. Чем больше слов вы добавите в изучение, тем разнообразнее станут темы.</p>
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
                        `Можно изучить ещё сегодня: ${Math.max(0, dailyNewWordsLimit - dailyNewWordsCount)}`
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

                  {/* Подсказка для свежего профиля: разминка недоступна, пока не пройдена диагностика */}
                  {!isLocalInitialized && (
                    <p data-testid="warmup-init-hint" style={{ margin: '12px 0 0', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {t('Список ещё не инициализирован — ', 'リストはまだ初期化されていません — ')}
                      <Link href="/settings" style={{ color: 'var(--color-blue)', fontWeight: 700, textDecoration: 'underline' }}>
                        {t('пройдите диагностику', '診断を受けてください')}
                      </Link>
                      {t(', чтобы открыть разминку.', '。ウォームアップが解放されます。')}
                    </p>
                  )}
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
                        t(`У вас есть ${dueActiveWordsCount} слов(а), готовых к повторению по расписанию.`, `復習の予定になっている単語が${dueActiveWordsCount}個あります。`)
                      ) : words.some(w => w.status === 'review' || w.status === 'learning') ? (
                        t('Все активные слова повторены! Отличная работа.', 'すべての単語の復習が完了しています！')
                      ) : (
                        t('Повторений пока нет — начните с разминки слева, и слова появятся здесь по расписанию.', 'まだ復習はありません。左のウォームアップから始めましょう。単語は予定に従ってここに表示されます。')
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

            {serviceError && (
              <div style={{ marginTop: '12px' }}>
                <ServiceUnavailable
                  message={serviceError.message}
                  retryable={serviceError.retryable}
                  onRetry={serviceError.retryable ? generateSessions : undefined}
                  whatWorks="Слова и повторение работают офлайн — можно продолжить разминку или квиз."
                />
              </div>
            )}

            {/* Сетка сессий / дорожка грамматики */}
            <div className="card-friendly" style={{ minHeight: '300px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '24px', borderBottom: '3px solid var(--border-color)', paddingBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setActiveTab('words')}
                    className={`btn-3d ${activeTab === 'words' ? 'btn-blue' : ''}`}
                    style={{ padding: '8px 16px', fontSize: '14px', textTransform: 'none' }}
                  >
                    Карта слов
                  </button>
                  <button
                    onClick={() => setActiveTab('grammar')}
                    className={`btn-3d ${activeTab === 'grammar' ? 'btn-blue' : ''}`}
                    style={{ padding: '8px 16px', fontSize: '14px', textTransform: 'none' }}
                  >
                    Карта грамматики
                  </button>
                  <button
                    onClick={() => setActiveTab('media')}
                    className={`btn-3d ${activeTab === 'media' ? 'btn-blue' : ''}`}
                    style={{ padding: '8px 16px', fontSize: '14px', textTransform: 'none' }}
                  >
                    Рекомендации медиа
                  </button>
                </div>
                
                  {activeTab === 'words' && sessions.length === 0 && words.length > 0 && isChatAllowed && (
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
              
              {activeTab === 'words' && (
                <>
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
                  ) : !isChatAllowed ? (
                    <div className={styles.emptyState}>
                      <AlertCircle size={48} className={styles.emptyIcon} style={{ color: 'var(--color-orange)' }} />
                      <p style={{ fontWeight: 800, fontSize: '18px', color: 'var(--text-primary)', marginBottom: '8px' }}>
                        Разговорная практика заблокирована
                      </p>
                      <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        Для доступа к чату с ИИ необходимо иметь хотя бы 5 слов в процессе изучения (в статусе «Изучение» или «Повторение»). Изучите новые слова в блоке разминки слева или пройдите тест повторения.
                      </p>
                      <button
                        onClick={() => {
                          const element = document.querySelector(`.${styles.leftColumn}`);
                          if (element) element.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="btn-3d btn-blue"
                        style={{ padding: '10px 20px', fontSize: '14px' }}
                      >
                        Перейти к изучению
                      </button>
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

                  {!isLoadingSessions && isChatAllowed && sessions.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
                      <LearningTrack profile={macroLadderProfile} />

                      {/* Список текущих сессий для навигации */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                          Сценарии сегодня
                        </h3>
                        {sessions.map((session: GeneratedSession) => {
                          const isCompleted = completedSessions.has(session.id);
                          const isInProgress = inProgressSessions.has(session.id);
                          return (
                            <div
                              key={session.id}
                              title={session.title}
                              style={{
                                background: 'var(--bg-primary)',
                                border: '2px solid var(--border-color)',
                                borderRadius: '14px',
                                padding: '14px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '12px',
                                opacity: isCompleted ? 0.7 : 1
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px' }}>
                                  {session.title}
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                  {session.description}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                {isCompleted ? (
                                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-green)' }}>✅ Готово</span>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className="btn-3d btn-green"
                                      style={{ padding: '6px 14px', fontSize: '12px' }}
                                      onClick={() => startSession(session)}
                                    >
                                      {isInProgress ? 'Продолжить' : 'Начать практику'}
                                    </button>
                                    {isInProgress && (
                                      <button
                                        type="button"
                                        className="btn-3d btn-red"
                                        style={{ padding: '6px 10px', fontSize: '12px' }}
                                        onClick={() => handleDiscardSession(session.id)}
                                      >
                                        Сброс
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
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
                </>
              )}

              {activeTab === 'grammar' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setSelectedGrammarLevel('N5')}
                        className={`btn-3d ${selectedGrammarLevel === 'N5' ? 'btn-blue' : ''}`}
                        style={{ padding: '6px 14px', fontSize: '13px' }}
                      >
                        N5
                      </button>
                      <button
                        onClick={() => setSelectedGrammarLevel('N4')}
                        className={`btn-3d ${selectedGrammarLevel === 'N4' ? 'btn-blue' : ''}`}
                        style={{ padding: '6px 14px', fontSize: '13px' }}
                      >
                        N4
                      </button>
                    </div>
                    <ScienceTip tipId="grammar_explicit" />
                  </div>
                  <GrammarTrack
                    level={selectedGrammarLevel}
                    grammarProgress={grammarProgress}
                    onSelectRule={(ruleId) => setActiveGrammarRuleId(ruleId)}
                  />
                </div>
              )}

              {activeTab === 'media' && renderMediaTab()}
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

            {/* Виджет баланса структура-иммерсия */}
            <BalanceWidget
              level={macroLadderProfile.activeLevelId}
              log={activityLog}
            />

            {/* Ежедневные квесты */}
            <div className={styles.questsCard}>
              <h3 className={styles.questsTitle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Trophy size={20} style={{ color: 'var(--color-yellow-shadow)' }} />
                  <span>{t('Ежедневные квесты', 'デイリークエスト')}</span>
                </div>
                <ScienceTip tipId="no_streaks" />
              </h3>
              <div className={styles.questList}>
                {!hasStudyContext ? (
                  <p className={styles.questDesc} style={{ padding: '8px 4px', lineHeight: 1.5 }}>
                    Ежедневные задания появятся, когда вы начнёте заниматься — пройдите разминку и квиз слева.
                  </p>
                ) : quests.map((quest) => {
                  const percent = Math.min(100, (quest.current / quest.target) * 100);
                  return (
                    <div key={quest.id} className={styles.questItem}>
                      <div className={styles.questHeader}>
                        <div className={styles.questInfo}>
                          <h4 className={styles.questItemTitle}>{quest.title}</h4>
                          <p className={styles.questDesc}>{quest.description}</p>
                        </div>
                      </div>
                      
                      <div className={styles.questProgressContainer}>
                        <div className={styles.questProgressTrack}>
                          <div 
                            className={`${styles.questProgressFill} ${quest.completed ? styles.questProgressFillCompleted : ''}`} 
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className={styles.questProgressText}>
                          {quest.current} / {quest.target}
                        </span>
                      </div>

                      {quest.completed && (
                        <div style={{ marginTop: '6px', textAlign: 'right' }}>
                          <span className={styles.claimedLabel}>
                            <CheckCircle size={14} />
                            {t('Выполнено ✓', '達成 ✓')}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Виджет советов по FSRS */}
            <div className="card-friendly" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={18} style={{ color: 'var(--color-yellow-shadow)' }} />
                  <span>Интервальные повторения</span>
                </div>
                <ScienceTip tipId="spacing" />
              </h3>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.5', color: 'var(--text-secondary)', fontWeight: 600 }}>
                YomuMogu использует двухкритериальный алгоритм FSRS для раздельного отслеживания навыков чтения (пассивный) и письма (активный).
              </p>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.5', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Старайтесь регулярно проходить разминки и общаться в чате с ИИ, чтобы поддерживать стабильность вашей памяти на высоком уровне.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Warm-up оверлей */}
      {renderWarmup()}

      {/* Grammar trainer modal */}
      {activeGrammarRuleId && (
        <GrammarTrainer
          ruleId={activeGrammarRuleId}
          onClose={() => setActiveGrammarRuleId(null)}
          onComplete={async () => {
            const rule = grammarRules.find(r => r.id === activeGrammarRuleId);
            if (rule) {
              // Создаем сессию грамматического фокуса
              const grammarSession = {
                id: `grammar_${rule.id}`,
                title: `Грамматика: ${rule.construction}`,
                description: `Свободный диалог с фокусом на: ${rule.topic}`,
                scenario: `Мы ведем практический диалог. Главная задача пользователя — использовать в диалоге грамматическую конструкцию "${rule.construction}" (${rule.topic}: ${rule.translation}). Вы помогаете пользователю практиковаться и отвечаете вежливо на японском.`,
                targetWords: [],
                grammarFocus: {
                  id: rule.id,
                  construction: rule.construction,
                  topic: rule.topic,
                  explanation: rule.explanation
                }
              };
              setProfileItem('active_session', JSON.stringify(grammarSession));
              removeProfileItem(`chat_state_grammar_${rule.id}`);
              
              // Записываем начальный статус в IndexedDB
              const pId = getActiveProfileId();
              if (pId) {
                const savedLogStr = getProfileItem('activity_log', pId);
                let currentLog: Strand[] = [];
                if (savedLogStr) {
                  try {
                    currentLog = JSON.parse(savedLogStr);
                  } catch {}
                }
                const updatedLog = recordActivity('structure', currentLog);
                setProfileItem('activity_log', JSON.stringify(updatedLog), pId);
                setActivityLog(updatedLog);

                const progress = await db.grammar_progress.get([pId, rule.id]);
                if (!progress) {
                  await db.grammar_progress.put({
                    profileId: pId,
                    ruleId: rule.id,
                    stepIndex: 0,
                    due: Date.now(),
                    status: 'new'
                  });
                }
              }
              
              router.push('/chat');
            }
            setActiveGrammarRuleId(null);
          }}
        />
      )}

      {activeMedia && (
        <MediaInteractivePlayer
          url={activeMedia.url}
          title={activeMedia.title}
          onClose={() => {
            setActiveMedia(null);
            refreshMediaFeed();
          }}
        />
      )}
    </div>
  );
}
