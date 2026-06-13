'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send, Lightbulb, X, Check, Loader2, ChevronDown, ChevronUp, RefreshCw, AlertCircle, Plus, BookOpen } from 'lucide-react';
import { useJapanification } from '@/hooks/useJapanification';
import { useQuests } from '@/hooks/useQuests';
import { getProfileItem, setProfileItem, removeProfileItem, getActiveProfileId } from '@/lib/profile';
import { db, addLocalReview, syncLocalDatabaseWithAnki, updateGrammarProgress } from '@/core/db';
import { recordExposure, getMiningCandidates } from '@/core/exposureService';
import type { ExposureEntry } from '@/core/types';
import { sanitizeHtml } from '@/lib/sanitize';
import Link from 'next/link';
import { calculateNextFsrsState, createDefaultFsrsState, alignPassiveToActiveState, isGoodContextExample } from '@/core/scheduler';
import { incrementDailyNewWordsCount } from '@/core/localDeckService';
import { applyGradualFurigana } from '@/lib/chat/furigana';
import { getAllowedScope } from '@/lib/grammar/promptScope';
import grammarRules from '@/resources/grammar_rules.json';
import { buildCompetencyProfile, getPresetAdvice } from '@/lib/competency/profile';
import type { SessionStat, CompetencyProfile, PresetAdvice } from '@/lib/competency/profile';
import {
  getTurnLimit,
  buildFluencyReplaySession,
  filterScopeForFluency,
  computeFluencyStats,
  type FluencyTurn
} from '@/lib/chat/fluency';
import styles from './chat.module.css';
import { COMPETENCY_SESSION_CAP } from '@/core/intervals';
import { ScienceTip } from '@/components/ScienceTip';
import { recordActivity, type Strand } from '@/lib/balance/balance';

interface TargetWord {
  word: string;
  translation: string;
}

interface GrammarFeedback {
  isCorrect: boolean;
  correction: string;
  explanation: string;
  shortNote?: string;
}

interface ChatMessageData {
  id: string;
  role: 'user' | 'model';
  text: string;
  translation?: string;
  grammarFeedback?: GrammarFeedback;
  wordsDetected?: string[];
}

interface KeywordInfo {
  word: string;
  translation: string;
}

interface HintVariant {
  level: 'easy' | 'medium' | 'advanced';
  keywords: KeywordInfo[];
  patternHint: string;
}

interface SessionData {
  id: string;
  title: string;
  description: string;
  scenario: string;
  targetWords: TargetWord[];
  grammarFocus?: {
    id: string;
    construction: string;
    topic: string;
    explanation: string;
  };
  fluencyMode?: boolean;
  fluencyRound?: 1 | 2 | 3;
}

interface SavedChatState {
  messages: ChatMessageData[];
  collectedWords: string[];
  isComplete: boolean;
  showBonusTest?: boolean;
  unusedTargetWords: TargetWord[];
  currentBonusIndex?: number;
  bonusInput?: string;
  bonusChecked?: boolean;
  bonusFeedback?: { isCorrect: boolean; message: string } | null;
  showSummaryScreen: boolean;
  analyzedWords: AnalyzedWord[];
  selectedSyncCards: number[];
  selectedAddWords: string[];
  syncCardGrades?: Record<number, number>;
  showExitConfirm?: boolean;
  fluencyTurns?: FluencyTurn[];
  passiveTurns?: Array<{ ms: number }>;
  closingDone?: boolean;
}

interface AnalyzedWord {
  word: string;
  reading: string;
  translation: string;
  definitionHtml: string;
  inAnki: boolean;
  cardId?: number;
  cardIds?: number[];
  status?: 'new' | 'learning' | 'review' | 'mature';
  isDue: boolean;
}

const stripRuby = (html: string) => {
  const withoutRt = html.replace(/<rt>[\s\S]*?<\/rt>/gi, '');
  return withoutRt.replace(/<\/?[^>]+(>|$)/g, '').trim();
};

export default function ChatPage() {
  const router = useRouter();
  const { t, state, shouldShowTranslation, shouldGrammarBeJapanese, addPoints, trackWordUsed, completeSession, setChatLevel } = useJapanification();
  const { incrementQuestProgress } = useQuests();

  const [session, setSession] = useState<SessionData | null>(null);
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [collectedWords, setCollectedWords] = useState<Set<string>>(new Set());
  const [showTranslationFor, setShowTranslationFor] = useState<Set<string>>(new Set());
  const [showCorrectionFor, setShowCorrectionFor] = useState<Set<string>>(new Set());
  const [expandedGrammar, setExpandedGrammar] = useState<Set<string>>(new Set());
  const [hints, setHints] = useState<HintVariant[]>([]);
  const [isLoadingHints, setIsLoadingHints] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  // States for Bonus Test and Results Summary flow
  const [unusedTargetWords, setUnusedTargetWords] = useState<TargetWord[]>([]);
  const [sessionExamples, setSessionExamples] = useState<Array<{ word: string; sentence: string; translation?: string; enabled: boolean }>>([]);

  const [showSummaryScreen, setShowSummaryScreen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedWords, setAnalyzedWords] = useState<AnalyzedWord[]>([]);
  const [selectedSyncCards, setSelectedSyncCards] = useState<Set<number>>(new Set());
  const [syncCardGrades, setSyncCardGrades] = useState<Record<number, number>>({});
  const [selectedAddWords, setSelectedAddWords] = useState<Set<string>>(new Set());
  const [expandedDefinitions, setExpandedDefinitions] = useState<Set<string>>(new Set());
  const [isSubmittingSync, setIsSubmittingSync] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [miningCandidates, setMiningCandidates] = useState<ExposureEntry[]>([]);

  // States for individual word sync/add progress
  const [syncCardStatus, setSyncCardStatus] = useState<Record<number, 'idle' | 'loading' | 'success' | 'error'>>({});
  const [addWordStatus, setAddWordStatus] = useState<Record<string, 'idle' | 'loading' | 'success' | 'error'>>({});
  const [individualErrors, setIndividualErrors] = useState<Record<string, string>>({});

  const [isStateLoaded, setIsStateLoaded] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [selectedGrammarGrade, setSelectedGrammarGrade] = useState<'forgot' | 'hard' | 'good'>('good');
  const [wordIntervalMap, setWordIntervalMap] = useState<Record<string, number>>({});
  const [fluencyTurns, setFluencyTurns] = useState<FluencyTurn[]>([]);
  const [passiveTurns, setPassiveTurns] = useState<Array<{ ms: number }>>([]);
  const [closingDone, setClosingDone] = useState<boolean>(false);
  const [timeLeftMs, setTimeLeftMs] = useState<number>(0);
  const turnStartTimeRef = useRef<number | null>(null);

  // Состояния советника по уровню сложности
  const [competencyProfile, setCompetencyProfile] = useState<CompetencyProfile | null>(null);
  const [advisorAdvice, setAdvisorAdvice] = useState<PresetAdvice | null>(null);
  const [advisorDismissed, setAdvisorDismissed] = useState(false);

  // Состояния для интерактивного маскота 🍵
  const [mascotState, setMascotState] = useState<'idle' | 'happy' | 'worried' | 'cheering'>('idle');
  const [mascotBubble, setMascotBubble] = useState<string | null>(null);
  const mascotTimerRef = useRef<any>(null);

  const triggerMascotReaction = (state: 'happy' | 'worried' | 'cheering', text: string) => {
    if (mascotTimerRef.current) {
      clearTimeout(mascotTimerRef.current);
    }
    setMascotState(state);
    setMascotBubble(text);
    mascotTimerRef.current = setTimeout(() => {
      setMascotState('idle');
      setMascotBubble(null);
    }, 4000);
  };

  useEffect(() => {
    return () => {
      if (mascotTimerRef.current) {
        clearTimeout(mascotTimerRef.current);
      }
    };
  }, []);

  const messageEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Загружаем сессию из localStorage
  useEffect(() => {
    try {
      const saved = getProfileItem('active_session');
      if (saved) {
        const parsed = JSON.parse(saved) as SessionData;
        setSession(parsed);
      }
    } catch {
      // Данные повреждены
    }
  }, []);

  // Инициализируем состояние чата из localStorage или запускаем новую сессию
  useEffect(() => {
    if (!session) return;

    try {
      const savedStateStr = getProfileItem(`chat_state_${session.id}`);
      if (savedStateStr) {
        const savedState = JSON.parse(savedStateStr) as SavedChatState;
        if (savedState.messages && savedState.messages.length > 0) {
          setMessages(savedState.messages);
          setCollectedWords(new Set(savedState.collectedWords || []));
          setIsComplete(savedState.isComplete || false);
          setUnusedTargetWords(savedState.unusedTargetWords || []);
          setShowSummaryScreen(savedState.showSummaryScreen || false);
          setAnalyzedWords(savedState.analyzedWords || []);
          setSelectedSyncCards(new Set(savedState.selectedSyncCards || []));
          setSyncCardGrades(savedState.syncCardGrades || {});
          setSelectedAddWords(new Set(savedState.selectedAddWords || []));
          setShowExitConfirm(savedState.showExitConfirm || false);
          setFluencyTurns(savedState.fluencyTurns || []);
          setPassiveTurns(savedState.passiveTurns || []);
          setClosingDone(savedState.closingDone || false);
          setIsStateLoaded(true);
          return;
        }
      }
    } catch (e) {
      // Ошибка парсинга или чтения состояния
    }

    // Если сохраненного состояния нет или оно пустое, запускаем новый диалог
    startConversation();
  }, [session]);

  // Загружаем интервалы повторений слов для постепенной фуриганы
  useEffect(() => {
    const loadIntervals = async () => {
      const profileId = getActiveProfileId();
      if (!profileId) return;
      try {
        const allWords = await db.words.where('profileId').equals(profileId).toArray();
        const map: Record<string, number> = {};
        allWords.forEach(w => {
          const clean = stripRuby(w.word).replace(/\[.*?\]/g, '').replace(/[\s\u3000]+/g, '');
          map[clean] = w.active?.interval ?? 0;
        });
        setWordIntervalMap(map);
      } catch (err) {
        console.error('Ошибка загрузки интервалов слов для чата:', err);
      }
    };
    if (isStateLoaded) {
      loadIntervals();
    }
  }, [isStateLoaded]);

  // Загружаем кандидатов для майнинга, когда открывается экран результатов
  useEffect(() => {
    if (showSummaryScreen) {
      const loadMiningCandidates = async () => {
        const profileId = getActiveProfileId();
        try {
          const candidates = await getMiningCandidates(profileId);
          setMiningCandidates(candidates);
        } catch (err) {
          console.error('Ошибка загрузки кандидатов для майнинга:', err);
        }
      };
      loadMiningCandidates();
    }
  }, [showSummaryScreen]);

  // Скролл вниз при новых сообщениях
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Сохраняем состояние при изменениях
  useEffect(() => {
    if (!session || !isStateLoaded) return;

    try {
      const stateToSave: SavedChatState = {
        messages,
        collectedWords: Array.from(collectedWords),
        isComplete,
        unusedTargetWords,
        showSummaryScreen,
        analyzedWords,
        selectedSyncCards: Array.from(selectedSyncCards),
        selectedAddWords: Array.from(selectedAddWords),
        syncCardGrades,
        showExitConfirm,
        fluencyTurns,
        passiveTurns,
        closingDone,
      };
      setProfileItem(`chat_state_${session.id}`, JSON.stringify(stateToSave));
    } catch (e) {
      // Ошибка сохранения состояния чата
    }
  }, [
    session,
    isStateLoaded,
    messages,
    collectedWords,
    isComplete,
    unusedTargetWords,
    showSummaryScreen,
    analyzedWords,
    selectedSyncCards,
    selectedAddWords,
    syncCardGrades,
    showExitConfirm,
    passiveTurns,
    closingDone
  ]);

  // Проверка завершения (80% слов собрано)
  useEffect(() => {
    if (session && !isComplete) {
      const threshold = Math.ceil(session.targetWords.length * 0.8);
      if (collectedWords.size >= threshold) {
        setIsComplete(true);
        completeSession();
        incrementQuestProgress('chats', 1);
      }
    }
  }, [collectedWords, session, isComplete, completeSession, incrementQuestProgress]);

  const getHistory = useCallback(() => {
    return messages.map(m => ({
      role: m.role,
      text: m.text
    }));
  }, [messages]);

  const startConversation = async () => {
    if (!session) return;
    setIsLoading(true);
    try {
      let grammarScope: any = undefined;
      const profileId = getActiveProfileId();
      if (profileId && process.env.NODE_ENV !== 'test') {
        try {
          const progressList = await db.grammar_progress.where('profileId').equals(profileId).toArray();
          const progressMap: Record<string, { status: string; due: number }> = {};
          for (const prog of progressList) {
            progressMap[prog.ruleId] = {
              status: prog.status,
              due: prog.due
            };
          }
          const normalScope = getAllowedScope(grammarRules, progressMap);
          if (session.fluencyMode) {
            const filtered = filterScopeForFluency(normalScope.allowedConstructions, progressMap);
            if (filtered.length > 0) {
              grammarScope = {
                allowedConstructions: filtered
              };
            } else {
              const fallbackNode = normalScope.allowedConstructions.find(n => n.id === 'g_n5_s1_1');
              grammarScope = {
                allowedConstructions: fallbackNode ? [fallbackNode] : [{ id: 'g_n5_s1_1', construction: 'АはБです' }]
              };
            }
          } else {
            grammarScope = normalScope;
          }
        } catch (dbErr) {
          console.error('Error loading grammar progress for startConversation:', dbErr);
        }
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: session.scenario,
          targetWords: session.targetWords,
          history: [],
          message: '__START__',
          level: state.chatLevel,
          grammarInJapanese: shouldGrammarBeJapanese(),
          grammarFocus: session.fluencyMode ? undefined : session.grammarFocus,
          grammarScope
        })
      });
      const data = await res.json();
      if (data && data._debug && typeof window !== 'undefined') {
        sessionStorage.setItem('yomumogu_last_gemini_prompt', JSON.stringify(data._debug));
      }
      if (res.ok) {
        const aiMsg: ChatMessageData = {
          id: `msg-${Date.now()}`,
          role: 'model',
          text: data.reply,
          translation: data.translation,
          grammarFeedback: data.grammarFeedback,
          wordsDetected: data.wordsDetected || []
        };
        setMessages([aiMsg]);
        setIsStateLoaded(true); // Отмечаем, что состояние инициализировано
      }
    } catch {
      // Ошибка стартового запроса
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!session || !inputText.trim() || isLoading) return;

    // Измеряем время ответа пользователя
    let turnDurationMs = 0;
    if (turnStartTimeRef.current) {
      turnDurationMs = Date.now() - turnStartTimeRef.current;
    }

    const userText = inputText.trim();
    setInputText('');
    setShowHints(false);
    setHints([]);

    const userMsg: ChatMessageData = {
      id: `msg-${Date.now()}`,
      role: 'user',
      text: userText
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      let grammarScope: any = undefined;
      const profileId = getActiveProfileId();
      if (profileId && process.env.NODE_ENV !== 'test') {
        try {
          const progressList = await db.grammar_progress.where('profileId').equals(profileId).toArray();
          const progressMap: Record<string, { status: string; due: number }> = {};
          for (const prog of progressList) {
            progressMap[prog.ruleId] = {
              status: prog.status,
              due: prog.due
            };
          }
          const normalScope = getAllowedScope(grammarRules, progressMap);
          if (session.fluencyMode) {
            const filtered = filterScopeForFluency(normalScope.allowedConstructions, progressMap);
            if (filtered.length > 0) {
              grammarScope = {
                allowedConstructions: filtered
              };
            } else {
              const fallbackNode = normalScope.allowedConstructions.find(n => n.id === 'g_n5_s1_1');
              grammarScope = {
                allowedConstructions: fallbackNode ? [fallbackNode] : [{ id: 'g_n5_s1_1', construction: 'АはБです' }]
              };
            }
          } else {
            grammarScope = normalScope;
          }
        } catch (dbErr) {
          console.error('Error loading grammar progress for sendMessage:', dbErr);
        }
      }

      const history = updatedMessages.map(m => ({ role: m.role, text: m.text }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: session.scenario,
          targetWords: session.targetWords,
          history: history.slice(0, -1), // История без текущего сообщения, оно передается отдельно
          message: userText,
          level: state.chatLevel,
          grammarInJapanese: shouldGrammarBeJapanese(),
          collectedWords: Array.from(collectedWords),
          grammarFocus: session.fluencyMode ? undefined : session.grammarFocus,
          grammarScope
        })
      });
      const data = await res.json();
      if (data && data._debug && typeof window !== 'undefined') {
        sessionStorage.setItem('yomumogu_last_gemini_prompt', JSON.stringify(data._debug));
      }
      if (res.ok) {
        // Обновляем собранные слова
        const newCollected = new Set(collectedWords);
        const detectedWords = data.wordsDetected || [];
        let newWordsCount = 0;
        detectedWords.forEach((w: string) => {
          if (!newCollected.has(w)) {
            newCollected.add(w);
            newWordsCount++;
          }
        });
        setCollectedWords(newCollected);

        // Сохраняем время хода
        const wasAllCollectedAlready = session.targetWords.length > 0 && session.targetWords.every(w => collectedWords.has(w.word));
        if (turnDurationMs > 0) {
          if (session.fluencyMode) {
            if (!wasAllCollectedAlready) {
              const limitSec = getTurnLimit(session.fluencyRound!, state.chatLevel);
              setFluencyTurns(prev => [...prev, { ms: turnDurationMs, limitMs: limitSec * 1000 }]);
            }
          } else {
            setPassiveTurns(prev => [...prev, { ms: turnDurationMs }]);
          }
        }

        // Начисляем очки
        if (newWordsCount > 0) {
          trackWordUsed(newWordsCount);
        }
        if (data.grammarFeedback?.isCorrect) {
          addPoints(1); // Бонус за правильную грамматику
        }

        // Определяем реакцию маскота
        let nextMascotState: 'happy' | 'worried' | 'cheering' = 'cheering';
        let bubbleText = t('Отличный ответ! Продолжай в том же духе! 🌟', '素晴らしい返事！その調子で続けましょう！ 🌟');

        const hasNewDetectedWords = detectedWords.some((w: string) => !collectedWords.has(w));
        const isGrammarCorrect = data.grammarFeedback?.isCorrect !== false;

        if (hasNewDetectedWords) {
          nextMascotState = 'happy';
          bubbleText = t('Ура! Новое слово успешно усвоено! 🎉', 'やった！新しい言葉をマスターしました！ 🎉');
        } else if (!isGrammarCorrect) {
          nextMascotState = 'worried';
          bubbleText = t('Хмм, тут есть грамматическая неточность. Обрати внимание на разбор! ⚠️', 'うーん、文法に誤りがあります。以下の解説を確認してください！ ⚠️');
        }

        triggerMascotReaction(nextMascotState, bubbleText);

        const aiMsg: ChatMessageData = {
          id: `msg-${Date.now() + 1}`,
          role: 'model',
          text: data.reply,
          translation: data.translation,
          grammarFeedback: data.grammarFeedback,
          wordsDetected: detectedWords
        };

        // Привязываем грамматический фидбек к сообщению пользователя
        const updatedUserMsg = {
          ...userMsg,
          grammarFeedback: data.grammarFeedback,
          wordsDetected: detectedWords
        };

        setMessages(prev => [
          ...prev.slice(0, -1),
          updatedUserMsg,
          aiMsg
        ]);

        const allCollected = session.targetWords.length > 0 && session.targetWords.every(w => newCollected.has(w.word));
        if (allCollected && !closingDone) {
          setClosingDone(true);
          
          const closingHistory = [...updatedMessages, aiMsg].map(m => ({ role: m.role, text: m.text }));
          
          setIsLoading(true);
          try {
            const closingRes = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                scenario: session.scenario,
                targetWords: session.targetWords,
                history: closingHistory,
                message: '',
                level: state.chatLevel,
                grammarInJapanese: shouldGrammarBeJapanese(),
                collectedWords: Array.from(newCollected),
                grammarFocus: session.fluencyMode ? undefined : session.grammarFocus,
                grammarScope,
                closingTurn: true
              })
            });
            const closingData = await closingRes.json();
            if (closingRes.ok) {
              const closingAiMsg: ChatMessageData = {
                id: `msg-${Date.now() + 2}`,
                role: 'model',
                text: closingData.reply,
                translation: closingData.translation,
                grammarFeedback: closingData.grammarFeedback,
                wordsDetected: closingData.wordsDetected || []
              };
              setMessages(prev => [...prev, closingAiMsg]);
            } else {
              console.warn('Closing turn request failed:', closingRes.statusText);
            }
          } catch (closingErr) {
            console.warn('Closing turn request failed with error:', closingErr);
          } finally {
            setIsLoading(false);
          }
        }
      }
    } catch (err) {
      console.error('Ошибка отправки сообщения:', err);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  // Таймер обратного отсчета для режима беглости и пассивный замер времени хода
  useEffect(() => {
    if (!session || showSummaryScreen) {
      return;
    }

    const lastMessage = messages[messages.length - 1];
    const isLastModel = lastMessage && lastMessage.role === 'model';

    if (isLastModel && !isLoading) {
      turnStartTimeRef.current = Date.now();
      
      const allCollected = session.targetWords.length > 0 && session.targetWords.every(w => collectedWords.has(w.word));
      if (session.fluencyMode && !allCollected) {
        const limitSeconds = getTurnLimit(session.fluencyRound!, state.chatLevel);
        const limitMs = limitSeconds * 1000;
        
        setTimeLeftMs(limitMs);

        const interval = setInterval(() => {
          const elapsed = Date.now() - turnStartTimeRef.current!;
          const remaining = Math.max(0, limitMs - elapsed);
          setTimeLeftMs(remaining);
        }, 100);

        return () => {
          clearInterval(interval);
        };
      }
    } else {
      turnStartTimeRef.current = null;
      setTimeLeftMs(0);
    }
  }, [messages, isLoading, session, state.chatLevel, showSummaryScreen, collectedWords]);

  const handleStartFluencyReplay = () => {
    if (!session) return;
    const isFluency = session.fluencyMode === true;
    const currentRound = session.fluencyRound || 0;
    const nextRound = isFluency ? (currentRound + 1) as 1 | 2 | 3 : 1;

    const newSession = buildFluencyReplaySession(session, nextRound);
    
    // Сохраняем в localStorage
    setProfileItem('active_session', JSON.stringify(newSession));
    
    // Сбрасываем состояния
    setSession(newSession);
    setMessages([]);
    setInputText('');
    setIsLoading(false);
    setCollectedWords(new Set());
    setShowTranslationFor(new Set());
    setShowCorrectionFor(new Set());
    setExpandedGrammar(new Set());
    setHints([]);
    setIsLoadingHints(false);
    setShowHints(false);
    setIsComplete(false);
    setUnusedTargetWords([]);
    setSessionExamples([]);
    setShowSummaryScreen(false);
    setAnalyzedWords([]);
    setSelectedSyncCards(new Set());
    setSyncCardGrades({});
    setSelectedAddWords(new Set());
    setExpandedDefinitions(new Set());
    setIsSubmittingSync(false);
    setSyncStatus(null);
    setSyncCardStatus({});
    setAddWordStatus({});
    setIndividualErrors({});
    setShowExitConfirm(false);
    setSelectedGrammarGrade('good');
    setMascotState('idle');
    setMascotBubble(null);
    setFluencyTurns([]);
    setPassiveTurns([]);
    setClosingDone(false);
  };

  const requestHints = async () => {
    if (!session || isLoadingHints) return;

    // В режиме беглости таймер не останавливается — это сделано намеренно для поддержания темпа (Four Strands / Fluency-First).
    if (showHints && hints.length > 0) {
      setShowHints(false);
      return;
    }

    setIsLoadingHints(true);
    setShowHints(true);

    try {
      const res = await fetch('/api/chat/hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: session.scenario,
          targetWords: session.targetWords,
          history: getHistory(),
          level: state.chatLevel
        })
      });
      const data = await res.json();
      if (data && data._debug && typeof window !== 'undefined') {
        sessionStorage.setItem('yomumogu_last_gemini_prompt', JSON.stringify(data._debug));
      }
      if (res.ok) {
        setHints(data.hints || []);
      }
    } catch {
      // Ошибка генерации подсказок
    } finally {
      setIsLoadingHints(false);
    }
  };

  const toggleShowCorrection = (msgId: string) => {
    setShowCorrectionFor(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  };

  const toggleTranslation = (msgId: string) => {
    setShowTranslationFor(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  };

  const toggleGrammarExpand = (msgId: string) => {
    setExpandedGrammar(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const endSession = () => {
    if (session) {
      removeProfileItem(`chat_state_${session.id}`);
      removeProfileItem('active_session');
    }
    if (session?.id?.startsWith('grammar_')) {
      router.push('/practice');
    } else {
      router.push('/settings');
    }
  };

  const handleForceDiscardSession = () => {
    removeProfileItem('active_session');
    if (session?.id) {
      removeProfileItem(`chat_state_${session.id}`);
    }
    if (session?.id?.startsWith('grammar_')) {
      router.push('/practice');
    } else {
      router.push('/settings');
    }
  };

  const handleConfirmExit = () => {
    setShowExitConfirm(false);
    handleStartCompletion();
  };

  const handleStartCompletion = () => {
    if (!session) return;
    const unused = session.targetWords.filter(tw => !collectedWords.has(tw.word));
    setUnusedTargetWords(unused);
    startAnalysis();
  };

  const startAnalysis = async () => {
    if (!session) return;

    if (!showSummaryScreen) {
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
      }
    }

    setShowSummaryScreen(true);
    setIsAnalyzing(true);
    setSyncStatus(null);
    try {
      const deckName = getProfileItem('selected_deck') || 'Japanese';
      const frontField = getProfileItem('front_field') || 'Front';
      const backField = getProfileItem('back_field') || 'Back';

      const deckMappingsStr = getProfileItem('deck_mappings');
      let deckMappings = undefined;
      if (deckMappingsStr) {
        try {
          deckMappings = JSON.parse(deckMappingsStr);
        } catch (e) {
          console.error('Ошибка парсинга deck_mappings:', e);
        }
      }

      const res = await fetch('/api/chat/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: messages.map(m => ({ role: m.role, text: m.text })),
          deckName,
          frontField,
          backField,
          deckMappings
        })
      });
      if (!res.ok) {
        throw new Error(t('Не удалось проанализировать диалог', '対話の分析に失敗しました'));
      }
      const data = await res.json();
      const words: AnalyzedWord[] = data.words || [];
      setAnalyzedWords(words);

      const profileId = getActiveProfileId();
      const extractedWordStrings = words.map(w => w.word);
      if (extractedWordStrings.length > 0) {
        try {
          await recordExposure(profileId, extractedWordStrings, 'chat');
        } catch (err) {
          console.error('Ошибка записи exposure log:', err);
        }
      }

      try {
        const candidates = await getMiningCandidates(profileId);
        setMiningCandidates(candidates);
      } catch (err) {
        console.error('Ошибка получения кандидатов для майнинга:', err);
      }

      // Инициализируем примеры предложений из сессии чата, подходящие под эвристики
      const examplesList: Array<{ word: string; sentence: string; translation?: string; enabled: boolean }> = [];
      words.forEach(w => {
        const isCollected = collectedWords.has(w.word);
        if (isCollected) {
          const userMessages = messages.filter(m => m.role === 'user' && m.text.includes(w.word));
          if (userMessages.length > 0) {
            const bestMessage = userMessages[userMessages.length - 1];
            if (isGoodContextExample(bestMessage.text, w.word)) {
              examplesList.push({
                word: w.word,
                sentence: bestMessage.text,
                translation: bestMessage.translation,
                enabled: true
              });
            }
          }
        }
      });
      setSessionExamples(examplesList);

      // Записываем статистику сессии в competency_sessions (макс. 10, нулевые сессии пропускаем)
      const turnCount = messages.filter(m => m.role === 'user').length;
      if (turnCount > 0) {
        const profileId = getActiveProfileId();
        const newStat: SessionStat = {
          date: Date.now(),
          chatLevel: state.chatLevel,
          userTurns: turnCount,
          correctTurns: words.filter(w => w.inAnki && (w.isDue || w.status === 'learning')).length
        };
        const rawSaved = getProfileItem('competency_sessions');
        const prevSessions: SessionStat[] = rawSaved ? JSON.parse(rawSaved) : [];
        const updatedSessions = [...prevSessions, newStat].slice(-COMPETENCY_SESSION_CAP);
        setProfileItem('competency_sessions', JSON.stringify(updatedSessions));

        // Вычисляем профиль компетентности и советника
        try {
          const progressList = await import('@/core/db').then(m => m.getGrammarProgressList(profileId));
          const progressMap: Record<string, import('@/core/db').GrammarProgress> = {};
          progressList.forEach((p: import('@/core/db').GrammarProgress) => { progressMap[p.ruleId] = p; });
          const allWords = await import('@/core/db').then(m => m.db.words.where('profileId').equals(profileId).toArray());
          const profile = buildCompetencyProfile(allWords as any, progressMap, updatedSessions);
          setCompetencyProfile(profile);
          const advice = getPresetAdvice(profile, state.chatLevel);
          setAdvisorAdvice(advice);
          setAdvisorDismissed(false);
        } catch (e) {
          console.error('Ошибка вычисления профиля компетентности:', e);
        }
      }


      const syncs = new Set<number>();
      const grades: Record<number, number> = {};
      words.forEach(w => {
        if (w.inAnki && w.cardId && (w.isDue || w.status === 'learning')) {
          syncs.add(w.cardId);
          grades[w.cardId] = 3; // По умолчанию Good (3)
        }
      });
      setSelectedSyncCards(syncs);
      setSyncCardGrades(grades);

      // Auto-select new words to add
      const adds = new Set<string>();
      words.forEach(w => {
        if (!w.inAnki) {
          adds.add(w.word);
        }
      });
      setSelectedAddWords(adds);
    } catch (err: any) {
      setSyncStatus({
        success: false,
        message: err.message || t('Ошибка связи с сервером', 'サーバー接続エラー')
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSyncSingleCard = async (cardId: number, ease: number, wordObj: AnalyzedWord) => {
    if (syncCardStatus[cardId] === 'loading') return;
    
    setSyncCardStatus(prev => ({ ...prev, [cardId]: 'loading' }));
    setIndividualErrors(prev => {
      const next = { ...prev };
      delete next[`card-${cardId}`];
      return next;
    });

    const deckName = getProfileItem('selected_deck') || 'Japanese';
    const profileId = getActiveProfileId();

    try {
      if (!profileId || typeof profileId !== 'string') {
        throw new Error(t('Неверный профиль', 'Invalid profile'));
      }

      // Определяем конкретную целевую колоду при selected_deck === '__all__'
      let targetDeckName = deckName;
      if (deckName === '__all__' && session && session.targetWords) {
        for (const tw of session.targetWords) {
          if (!tw.word || typeof tw.word !== 'string') continue;
          const localWord = await db.words.where('word').equals(tw.word).first();
          if (localWord && localWord.category && localWord.category !== '__all__') {
            targetDeckName = localWord.category;
            break;
          }
        }
        if (targetDeckName === '__all__') {
          const anyWord = await db.words.where('profileId').equals(profileId).first();
          if (anyWord && anyWord.category && anyWord.category !== '__all__') {
            targetDeckName = anyWord.category;
          } else {
            targetDeckName = 'Japanese';
          }
        }
      }

      const targetIds = (wordObj.cardIds && wordObj.cardIds.length > 0 ? wordObj.cardIds : [cardId])
        .filter((id): id is number => typeof id === 'number' && !isNaN(id));

      for (const cid of targetIds) {
        let localWord = await db.words.get([profileId, cid]);
        if (!localWord) {
          localWord = {
            profileId,
            id: cid,
            word: wordObj.word,
            reading: wordObj.reading,
            translation: wordObj.translation,
            category: targetDeckName,
            source: 'anki',
            passive: createDefaultFsrsState(Date.now()),
            active: createDefaultFsrsState(Date.now()),
            contextExamples: []
          };
        }

        const isCollected = collectedWords.has(wordObj.word);
        const type: 'passive' | 'active' = isCollected ? 'active' : 'passive';
        const isNew = localWord.active.status === 'new';

        const { updatedWord, newInterval, lastInterval } = calculateNextFsrsState(localWord, ease, type);
        let finalWord = updatedWord;

        // Если это успешное активное повторение, подтягиваем и пассивный стейт
        if (isCollected && ease > 1) {
          finalWord = alignPassiveToActiveState(finalWord);
        }

        // Сохраняем пример использования в диалоге
        if (isCollected) {
          const matchingExample = sessionExamples.find(ex => ex.word === wordObj.word && ex.enabled);
          if (matchingExample) {
            const examples = finalWord.contextExamples || [];
            if (!examples.some((ex: any) => ex.sentence === matchingExample.sentence)) {
              examples.push({
                sentence: matchingExample.sentence,
                translation: matchingExample.translation,
                timestamp: Date.now()
              });
              finalWord.contextExamples = examples;
            }
          }
        }

        await db.words.put(finalWord);

        if (isNew) {
          incrementDailyNewWordsCount(profileId, 1);
        }

        await addLocalReview({
          profileId,
          cardId: cid,
          ease,
          interval: newInterval,
          lastInterval,
          duration: 5000, // Разумная длительность для чат-практики (5 сек)
          timestamp: Date.now(),
          synced: 0,
          reviewType: type
        });
      }

      // Синхронизируем локальные отзывы с Anki с передачей sessionId
      const syncResult = await syncLocalDatabaseWithAnki(profileId, deckName, session?.id);
      if (!syncResult.success) {
        throw new Error(syncResult.message);
      }

      // Обновляем локальный стейт в памяти, чтобы UI сразу отреагировал
      let finalStatus: 'new' | 'learning' | 'review' | 'mature' = wordObj.status || 'learning';
      for (const cid of targetIds) {
        const localWord = await db.words.get([profileId, cid]);
        if (localWord) {
          finalStatus = localWord.active.status;
        }
      }

      setAnalyzedWords(prev =>
        prev.map(w => {
          if (w.cardId === cardId || (w.cardIds && w.cardIds.includes(cardId))) {
            return {
              ...w,
              isDue: false,
              status: finalStatus
            };
          }
          return w;
        })
      );

      setSyncCardStatus(prev => ({ ...prev, [cardId]: 'success' }));
      setSelectedSyncCards(prev => {
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
    } catch (err: any) {
      console.error('Ошибка индивидуальной синхронизации карточки:', err);
      setSyncCardStatus(prev => ({ ...prev, [cardId]: 'error' }));
      setIndividualErrors(prev => ({
        ...prev,
        [`card-${cardId}`]: err.message || t('Ошибка синхронизации', 'Sync error')
      }));
    }
  };

  const handleAddSingleWord = async (wordStr: string, wordObj: AnalyzedWord) => {
    if (addWordStatus[wordStr] === 'loading') return;

    setAddWordStatus(prev => ({ ...prev, [wordStr]: 'loading' }));
    setIndividualErrors(prev => {
      const next = { ...prev };
      delete next[`word-${wordStr}`];
      return next;
    });

    const deckName = getProfileItem('selected_deck') || 'Japanese';
    const frontField = getProfileItem('front_field') || 'Front';
    const backField = getProfileItem('back_field') || 'Back';
    const profileId = getActiveProfileId();

    const deckMappingsStr = getProfileItem('deck_mappings');
    let deckMappings = undefined;
    if (deckMappingsStr) {
      try {
        deckMappings = JSON.parse(deckMappingsStr);
      } catch (e) {
        console.error('Ошибка парсинга deck_mappings:', e);
      }
    }

    try {
      if (!profileId || typeof profileId !== 'string') {
        throw new Error(t('Неверный профиль', 'Invalid profile'));
      }

      // Определяем конкретную целевую колоду при selected_deck === '__all__'
      let targetDeckName = deckName;
      if (deckName === '__all__' && session && session.targetWords) {
        for (const tw of session.targetWords) {
          if (!tw.word || typeof tw.word !== 'string') continue;
          const localWord = await db.words.where('word').equals(tw.word).first();
          if (localWord && localWord.category && localWord.category !== '__all__') {
            targetDeckName = localWord.category;
            break;
          }
        }
        if (targetDeckName === '__all__') {
          const anyWord = await db.words.where('profileId').equals(profileId).first();
          if (anyWord && anyWord.category && anyWord.category !== '__all__') {
            targetDeckName = anyWord.category;
          } else {
            targetDeckName = 'Japanese';
          }
        }
      }

      let activeFrontField = frontField;
      let activeBackField = backField;
      if (deckMappings && deckMappings[targetDeckName]) {
        activeFrontField = deckMappings[targetDeckName].frontField || frontField;
        activeBackField = deckMappings[targetDeckName].backField || backField;
      }

      const addRes = await fetch('/api/anki/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deckName: targetDeckName,
          frontField: activeFrontField,
          backField: activeBackField,
          word: wordObj.word,
          reading: wordObj.reading,
          translation: wordObj.translation,
          definitionHtml: wordObj.definitionHtml,
          history: messages.map(m => ({ role: m.role, text: m.text })),
          sessionId: session?.id
        })
      });

      if (!addRes.ok) {
        const errData = await addRes.json();
        throw new Error(errData.error || t('Ошибка при добавлении карточки в Anki', 'Ankiへのカード追加中にエラーが発生しました'));
      }

      const data = await addRes.json();

      // Запускаем синхронизацию локальной БД, чтобы подтянуть новое слово в IndexedDB
      const syncResult = await syncLocalDatabaseWithAnki(profileId, deckName, session?.id);
      if (!syncResult.success) {
        console.warn('Фоновая синхронизация после добавления слова не удалась:', syncResult.message);
      }

      setAddWordStatus(prev => ({ ...prev, [wordStr]: 'success' }));
      setSelectedAddWords(prev => {
        const next = new Set(prev);
        next.delete(wordStr);
        return next;
      });

      // Обновляем локальный список analyzedWords, чтобы слово пометилось зеленым / перешло в Anki
      setAnalyzedWords(prev =>
        prev.map(w => {
          if (w.word === wordStr) {
            return {
              ...w,
              inAnki: true,
              cardId: data.noteId,
              status: 'learning',
              isDue: false
            };
          }
          return w;
        })
      );
    } catch (err: any) {
      console.error('Ошибка индивидуального добавления слова:', err);
      setAddWordStatus(prev => ({ ...prev, [wordStr]: 'error' }));
      setIndividualErrors(prev => ({
        ...prev,
        [`word-${wordStr}`]: err.message || t('Ошибка добавления', 'Add error')
      }));
    }
  };

  const handleSyncAndAdd = async () => {
    if (!session || isSubmittingSync) return;
    setIsSubmittingSync(true);
    setSyncStatus(null);

    const deckName = getProfileItem('selected_deck') || 'Japanese';
    const frontField = getProfileItem('front_field') || 'Front';
    const backField = getProfileItem('back_field') || 'Back';
    const profileId = getActiveProfileId();

    const deckMappingsStr = getProfileItem('deck_mappings');
    let deckMappings = undefined;
    if (deckMappingsStr) {
      try {
        deckMappings = JSON.parse(deckMappingsStr);
      } catch (e) {
        console.error('Ошибка парсинга deck_mappings:', e);
      }
    }

    try {
      // Определяем конкретную целевую колоду для добавления новых слов при selected_deck === '__all__'
      let targetDeckName = deckName;
      if (deckName === '__all__' && session && session.targetWords && session.targetWords.length > 0) {
        for (const tw of session.targetWords) {
          if (!tw.word || typeof tw.word !== 'string') continue;
          const localWord = await db.words.where('word').equals(tw.word).first();
          if (localWord && localWord.category && localWord.category !== '__all__') {
            targetDeckName = localWord.category;
            break;
          }
        }
        if (targetDeckName === '__all__') {
          const anyWord = await db.words.where('profileId').equals(profileId).first();
          if (anyWord && anyWord.category && anyWord.category !== '__all__') {
            targetDeckName = anyWord.category;
          } else {
            targetDeckName = 'Japanese';
          }
        }
      }

      // Обновляем прогресс по грамматике
      if (session.grammarFocus && profileId) {
        await updateGrammarProgress(profileId, session.grammarFocus.id, selectedGrammarGrade);
      }

      // 1. Синхронизируем карточки (повторение) через локальную БД и FSRS
      if (selectedSyncCards.size > 0) {
        for (const cardId of Array.from(selectedSyncCards)) {
          const wordObj = analyzedWords.find(w => w.cardId === cardId || (w.cardIds && w.cardIds.includes(cardId)));
          const ease = syncCardGrades[cardId] || 3;
          
          if (wordObj) {
            const targetIds = (wordObj.cardIds && wordObj.cardIds.length > 0 ? wordObj.cardIds : [cardId])
              .filter((id): id is number => typeof id === 'number' && !isNaN(id));
              
            for (const cid of targetIds) {
              if (!profileId || typeof profileId !== 'string') {
                continue;
              }
              let localWord = await db.words.get([profileId, cid]);
              
              if (!localWord) {
                localWord = {
                  profileId,
                  id: cid,
                  word: wordObj.word,
                  reading: wordObj.reading,
                  translation: wordObj.translation,
                  category: targetDeckName,
                  source: 'anki',
                  passive: createDefaultFsrsState(Date.now()),
                  active: createDefaultFsrsState(Date.now()),
                  contextExamples: []
                };
              }
              
              const isCollected = collectedWords.has(wordObj.word);
              const type: 'passive' | 'active' = isCollected ? 'active' : 'passive';
              const isNew = localWord.active.status === 'new';

              const { updatedWord, newInterval, lastInterval } = calculateNextFsrsState(localWord, ease, type);
              let finalWord = updatedWord;

              // Если это успешное активное повторение, подтягиваем и пассивный стейт
              if (isCollected && ease > 1) {
                finalWord = alignPassiveToActiveState(finalWord);
              }

              // Сохраняем пример использования в диалоге
              if (isCollected) {
                const matchingExample = sessionExamples.find(ex => ex.word === wordObj.word && ex.enabled);
                if (matchingExample) {
                  const examples = finalWord.contextExamples || [];
                  if (!examples.some((ex: any) => ex.sentence === matchingExample.sentence)) {
                    examples.push({
                      sentence: matchingExample.sentence,
                      translation: matchingExample.translation,
                      timestamp: Date.now()
                    });
                    finalWord.contextExamples = examples;
                  }
                }
              }

              await db.words.put(finalWord);

              if (isNew) {
                incrementDailyNewWordsCount(profileId, 1);
              }
              
              await addLocalReview({
                profileId,
                cardId: cid,
                ease,
                interval: newInterval,
                lastInterval,
                duration: 5000, // Разумная длительность для чат-практики (5 сек)
                timestamp: Date.now(),
                synced: 0,
                reviewType: type
              });
            }
          }
        }
      }

      // 2. Добавляем новые слова
      if (selectedAddWords.size > 0) {
        for (const wordStr of Array.from(selectedAddWords)) {
          const w = analyzedWords.find(item => item.word === wordStr);
          if (w) {
            let activeFrontField = frontField;
            let activeBackField = backField;
            if (deckMappings && deckMappings[targetDeckName]) {
              activeFrontField = deckMappings[targetDeckName].frontField || frontField;
              activeBackField = deckMappings[targetDeckName].backField || backField;
            }

            const addRes = await fetch('/api/anki/add', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                deckName: targetDeckName,
                frontField: activeFrontField,
                backField: activeBackField,
                word: w.word,
                reading: w.reading,
                translation: w.translation,
                definitionHtml: w.definitionHtml,
                history: messages.map(m => ({ role: m.role, text: m.text })),
                sessionId: session.id
              })
            });
            if (!addRes.ok) {
              const errData = await addRes.json();
              throw new Error(errData.error || t('Ошибка при добавлении карточек в Anki', 'Ankiへのカード追加中にエラーが発生しました'));
            }
          }
        }
      }

      // 3. Запускаем фоновую синхронизацию локальной БД с Anki
      const syncResult = await syncLocalDatabaseWithAnki(profileId, deckName, session.id);
      if (!syncResult.success) {
        throw new Error(syncResult.message || t('Ошибка при синхронизации с Anki', 'Ankiとの同期中にエラーが発生しました'));
      }

      // Обновляем локальный стейт в памяти для всех синхронизированных карточек
      const syncedCardIds = Array.from(selectedSyncCards);
      const nextCardStatuses: Record<number, 'new' | 'learning' | 'review' | 'mature'> = {};
      for (const cid of syncedCardIds) {
        const localWord = await db.words.get([profileId, cid]);
        if (localWord) {
          nextCardStatuses[cid] = localWord.active.status;
          setSyncCardStatus(prev => ({ ...prev, [cid]: 'success' }));
        }
      }

      setAnalyzedWords(prev =>
        prev.map(w => {
          const matchedId = w.cardIds
            ? w.cardIds.find(id => nextCardStatuses[id] !== undefined)
            : (w.cardId && nextCardStatuses[w.cardId] !== undefined ? w.cardId : undefined);
          
          if (matchedId !== undefined) {
            return {
              ...w,
              isDue: false,
              status: nextCardStatuses[matchedId]
            };
          }
          return w;
        })
      );

      setSelectedSyncCards(new Set());

      setSyncStatus({
        success: true,
        message: t('Синхронизация успешно выполнена! Все выбранные слова добавлены или обновлены в Anki.', '同期が完了しました！選択された単語がAnkiに追加/更新されました。')
      });
    } catch (err: any) {
      setSyncStatus({
        success: false,
        message: err.message || t('Не удалось связаться с AnkiConnect. Проверьте, запущено ли приложение Anki и включен ли плагин AnkiConnect.', 'AnkiConnectとの接続に失敗しました。Ankiが起動し、AnkiConnectが有効であることを確認してください。')
      });
    } finally {
      setIsSubmittingSync(false);
    }
  };

  const toggleSyncCard = (cardId: number) => {
    setSelectedSyncCards(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
        if (!syncCardGrades[cardId]) {
          setSyncCardGrades(current => ({ ...current, [cardId]: 3 }));
        }
      }
      return next;
    });
  };

  const handleSetGrade = (cardId: number, ease: number) => {
    setSyncCardGrades(prev => ({
      ...prev,
      [cardId]: ease
    }));
  };

  const toggleAddWord = (wordStr: string) => {
    setSelectedAddWords(prev => {
      const next = new Set(prev);
      if (next.has(wordStr)) {
        next.delete(wordStr);
      } else {
        next.add(wordStr);
      }
      return next;
    });
  };

  const toggleDefinitionExpand = (wordStr: string) => {
    setExpandedDefinitions(prev => {
      const next = new Set(prev);
      if (next.has(wordStr)) {
        next.delete(wordStr);
      } else {
        next.add(wordStr);
      }
      return next;
    });
  };

  // Нет активной сессии
  if (!session) {
    return (
      <div className={styles.chatContainer}>
        <div className={styles.messageArea} style={{ justifyContent: 'center', alignItems: 'center' }}>
          <img src="/images/cat-sensei.png" alt="Кот-сэнсей" style={{ width: 80, height: 80, borderRadius: '50%', marginBottom: 16 }} />
          <p style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-secondary)' }}>
            {t('Сессия не выбрана', 'セッションが選ばれていません')}
          </p>
          <button onClick={() => router.push('/settings')} className="btn-3d btn-green" style={{ marginTop: 16 }}>
            {t('Перейти в настройки', '設定へ')}
          </button>
        </div>
      </div>
    );
  }

  // Проверка на несовместимый/поврежденный формат сессии
  const isSessionInvalid = !session.id || 
                           !session.targetWords || 
                           !Array.isArray(session.targetWords) ||
                           !session.title ||
                           !session.scenario;

  if (isSessionInvalid) {
    return (
      <div className={styles.chatContainer}>
        <div className={styles.messageArea} style={{ justifyContent: 'center', alignItems: 'center', padding: '24px', textAlign: 'center' }}>
          <AlertCircle size={48} style={{ color: 'var(--color-red)', marginBottom: 16 }} />
          <h2 style={{ marginBottom: 12, color: 'var(--text-primary)' }}>
            {t('Обнаружена несовместимая сессия', '不適合なセッションが検出されました')}
          </h2>
          <p style={{ maxWidth: 500, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>
            {t(
              'Эта сессия была создана в предыдущей версии приложения и не может быть загружена из-за несовпадения структуры данных. Вы можете сбросить её и начать новую.',
              'このセッションは以前のバージョンで作成されたため、読み込めません。セッションをリセットして新しく開始してください。'
            )}
          </p>
          <button onClick={handleForceDiscardSession} className="btn-3d btn-red">
            {t('Сбросить сессию', 'セッションをリセット')}
          </button>
        </div>
      </div>
    );
  }

  const totalWords = session.targetWords.length;
  const collectedCount = collectedWords.size;
  const progressPercent = totalWords > 0 ? Math.round((collectedCount / totalWords) * 100) : 0;



  if (showSummaryScreen) {
    return (
      <div className={styles.chatContainer}>
        {/* HEADER */}
        <header className={styles.chatHeader}>
          <div className={styles.headerLeft}>
            <button onClick={endSession} className={styles.backButton} title={t('Выйти', '閉じる')}>
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className={styles.scenarioTitle}>{t('Итоги практики', '練習結果')}</h1>
              <p className={styles.scenarioSubtitle}>{session.title}</p>
            </div>
          </div>
        </header>

        <div className={styles.messageArea}>
          {isAnalyzing ? (
            <div className={styles.loaderContainer}>
              <div className={styles.loaderInner}>
                <Loader2 className={styles.spinner} size={48} />
                <img src="/images/cat-sensei.png" alt="Сэнсей" className={styles.loaderCat} />
              </div>
              <h3 className={styles.loaderTitle}>{t('Анализируем диалог...', '対話を分析中...')}</h3>
              <p className={styles.loaderSubtitle}>
                {t('Сэнсей выделяет интересные слова и сверяет их со словарём JitenDex и вашей базой Anki.', '先生が対話から面白い単語を選び、JitenDex辞書とAnkiのデータベースを確認しています。')}
              </p>
            </div>
          ) : (
            <div className={styles.summaryContainer}>
              {syncStatus && (
                <div className={`${styles.statusBanner} ${syncStatus.success ? styles.success : styles.error}`}>
                  {syncStatus.success ? <Check size={20} /> : <AlertCircle size={20} />}
                  <span>{syncStatus.message}</span>
                </div>
              )}

              {/* GRAMMAR MASTERY SECTION */}
              {session.grammarFocus && (
                <div className={styles.summarySection} style={{ border: '2.5px solid var(--color-blue)', backgroundColor: 'rgba(59, 130, 246, 0.04)', padding: '16px', borderRadius: '16px', marginBottom: '24px' }}>
                  <h3 className={styles.sectionTitle} style={{ color: 'var(--color-blue)', margin: '0 0 4px 0' }}>
                    Закрепление грамматики
                  </h3>
                  <p className={styles.sectionSubtitle} style={{ margin: '0 0 12px 0' }}>
                    Оцените, насколько хорошо вы запомнили конструкцию: <strong>{session.grammarFocus.construction}</strong> ({session.grammarFocus.topic})
                  </p>
                  <div className={styles.gradeSelector} style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedGrammarGrade('forgot')}
                      className={`${styles.gradeBtn} ${styles.again} ${selectedGrammarGrade === 'forgot' ? styles.active : ''}`}
                      disabled={isSubmittingSync}
                    >
                      Забыл
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedGrammarGrade('hard')}
                      className={`${styles.gradeBtn} ${styles.hard} ${selectedGrammarGrade === 'hard' ? styles.active : ''}`}
                      disabled={isSubmittingSync}
                    >
                      Плохо помню
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedGrammarGrade('good')}
                      className={`${styles.gradeBtn} ${styles.good} ${selectedGrammarGrade === 'good' ? styles.active : ''}`}
                      disabled={isSubmittingSync}
                    >
                      Хорошо помню
                    </button>
                  </div>
                </div>
              )}

              {/* STATS FOR FLUENCY MODE */}
              {session.fluencyMode && (
                <div
                  className={styles.summarySection}
                  style={{
                    border: '2.5px solid var(--color-blue)',
                    backgroundColor: 'rgba(59, 130, 246, 0.04)',
                    padding: '16px',
                    borderRadius: '16px',
                    marginBottom: '24px'
                  }}
                >
                  <h3 className={styles.sectionTitle} style={{ color: 'var(--color-blue)', margin: '0 0 8px 0' }}>
                    ⚡ Результаты раунда {session.fluencyRound}
                  </h3>
                  {(() => {
                    const stats = computeFluencyStats(fluencyTurns);
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontWeight: 600 }}>
                        <div>В лимите: {stats.within} из {stats.total} ходов ({stats.withinPct}%)</div>
                        <div>Среднее время ответа: {stats.avgSeconds} сек</div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* STATS FOR PASSIVE REPLY TIMING */}
              {!session.fluencyMode && passiveTurns && passiveTurns.length > 0 && (
                <div
                  className={styles.summarySection}
                  style={{
                    border: '2.5px solid var(--color-blue)',
                    backgroundColor: 'rgba(59, 130, 246, 0.04)',
                    padding: '16px',
                    borderRadius: '16px',
                    marginBottom: '24px'
                  }}
                >
                  <h3 className={styles.sectionTitle} style={{ color: 'var(--color-blue)', margin: '0 0 8px 0' }}>
                    ⏱️ Статистика времени
                  </h3>
                  {(() => {
                    const totalMs = passiveTurns.reduce((acc, t) => acc + t.ms, 0);
                    const avgSec = (totalMs / (passiveTurns.length * 1000)).toFixed(1);
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontWeight: 600 }}>
                        <div>Среднее время реплики: {avgSec} сек</div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ADVISOR CARD — совет по уровню сложности */}
              {advisorAdvice && !advisorDismissed && competencyProfile && advisorAdvice.suggestion !== 'stay' && (
                <div
                  data-testid="advisor-card"
                  className={styles.summarySection}
                  style={{
                    border: '2.5px solid var(--color-orange)',
                    backgroundColor: 'rgba(245, 158, 11, 0.06)',
                    padding: '16px',
                    borderRadius: '16px',
                    marginBottom: '24px'
                  }}
                >
                  <h3 className={styles.sectionTitle} style={{ color: 'var(--color-orange)', margin: '0 0 8px 0' }}>
                    📊 Компетентность: {competencyProfile.level}
                  </h3>

                  {/* Полосы прогресса */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '3px' }}>
                        <span>Лексика ({competencyProfile.level})</span>
                        <span>{Math.round(competencyProfile.lexCoverage * 100)}%</span>
                      </div>
                      <div style={{ height: '7px', borderRadius: '4px', background: 'var(--bg-tertiary)' }}>
                        <div style={{
                          height: '100%',
                          borderRadius: '4px',
                          background: 'var(--color-blue)',
                          width: `${Math.round(competencyProfile.lexCoverage * 100)}%`,
                          transition: 'width 0.5s ease'
                        }} />
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '3px' }}>
                        <span>Грамматика ({competencyProfile.level})</span>
                        <span>{Math.round(competencyProfile.grammarCoverage * 100)}%</span>
                      </div>
                      <div style={{ height: '7px', borderRadius: '4px', background: 'var(--bg-tertiary)' }}>
                        <div style={{
                          height: '100%',
                          borderRadius: '4px',
                          background: 'var(--color-green)',
                          width: `${Math.round(competencyProfile.grammarCoverage * 100)}%`,
                          transition: 'width 0.5s ease'
                        }} />
                      </div>
                    </div>
                  </div>

                  {/* Текст совета */}
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, margin: '0 0 12px 0', lineHeight: 1.5 }}>
                    {advisorAdvice.reason}
                  </p>

                  {/* Кнопки действий */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {advisorAdvice.suggestion === 'up' && (
                      <button
                        type="button"
                        className="btn-3d btn-orange"
                        style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }}
                        onClick={() => {
                          setChatLevel(state.chatLevel + 1);
                          setAdvisorDismissed(true);
                        }}
                        data-testid="advisor-accept-btn"
                      >
                        Принять (уровень {state.chatLevel + 1})
                      </button>
                    )}
                    {advisorAdvice.suggestion === 'down' && (
                      <button
                        type="button"
                        className="btn-3d btn-orange"
                        style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }}
                        onClick={() => {
                          setChatLevel(state.chatLevel - 1);
                          setAdvisorDismissed(true);
                        }}
                        data-testid="advisor-accept-btn"
                      >
                        Принять (уровень {state.chatLevel - 1})
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-3d"
                      style={{ padding: '8px 12px', fontSize: '13px' }}
                      onClick={() => setAdvisorDismissed(true)}
                      data-testid="advisor-dismiss-btn"
                    >
                      Не сейчас
                    </button>
                  </div>
                </div>
              )}

              {/* REPEAT WORDS SECTION */}
              {analyzedWords.some(w => w.inAnki) && (
                <div className={styles.summarySection}>
                  <h3 className={styles.sectionTitle}>
                    <RefreshCw size={18} /> {t('Повторение слов в Anki', 'Ankiの単語復習')}
                  </h3>
                  <p className={styles.sectionSubtitle}>
                    {t('Эти слова уже есть в вашей колоде. Вы можете отметить прохождение для due/learning карточек.', 'これらの単語はすでにデッキにあります。復習が必要なカードを同期できます。')}
                  </p>
                  <div className={styles.wordsList}>
                    {analyzedWords
                      .filter(w => w.inAnki)
                      .map((w, idx) => {
                        const isSynced = w.cardId ? syncCardStatus[w.cardId] === 'success' : false;
                        const canSync = (w.status === 'learning' || w.isDue) && !isSynced;
                        const isChecked = w.cardId ? selectedSyncCards.has(w.cardId) : false;
                        return (
                          <div key={idx} className={styles.syncWordBlock}>
                            <div className={`${styles.wordRow} ${w.inAnki ? styles.existingWord : ''}`}>
                              <div className={styles.wordRowLeft}>
                                {isSynced ? (
                                  <span className={styles.activeCheck} title={t('Синхронизировано', '同期済')}>✅</span>
                                ) : canSync ? (
                                  <input
                                    type="checkbox"
                                    className={styles.wordCheckbox}
                                    checked={isChecked}
                                    onChange={() => w.cardId && toggleSyncCard(w.cardId)}
                                    disabled={isSubmittingSync}
                                    id={`sync-card-${w.cardId}`}
                                  />
                                ) : (
                                  <span className={styles.passiveCheck} title={t('Интервал повторения ещё не истёк', '復習の時期ではありません')}>🔒</span>
                                )}
                                <label htmlFor={w.cardId ? `sync-card-${w.cardId}` : undefined} className={styles.wordInfoLabel}>
                                  <span className={styles.jpWord}>{w.word}</span>
                                  <span className={styles.jpReading}>【{w.reading}】</span>
                                  <span className={styles.ruTranslation}>{w.translation}</span>
                                </label>
                              </div>
                              <div className={styles.wordRowRight}>
                                <span className={`badge-status badge-${w.status || 'new'}`}>
                                  {w.status === 'new' ? t('новое', '新規') : 
                                   w.status === 'learning' ? t('изучается', '学習中') :
                                   w.status === 'review' ? t('повторение', '復習') : t('усвоено', '習得済')}
                                </span>
                                {w.isDue && <span className={styles.dueBadge}>{t('Срок!', '期限!')}</span>}
                                {canSync && w.cardId && (
                                  <button
                                    type="button"
                                    onClick={() => handleSyncSingleCard(w.cardId!, syncCardGrades[w.cardId!] || 3, w)}
                                    className={`${styles.individualBtn} btn-3d btn-blue`}
                                    disabled={isSubmittingSync || syncCardStatus[w.cardId] === 'loading' || syncCardStatus[w.cardId] === 'success'}
                                    title={t('Синхронизировать это слово', 'この単語を同期する')}
                                    style={{ marginLeft: 8 }}
                                  >
                                    {syncCardStatus[w.cardId] === 'loading' ? (
                                      <Loader2 className={styles.spinner} size={14} />
                                    ) : syncCardStatus[w.cardId] === 'success' ? (
                                      <Check size={14} />
                                    ) : (
                                      <RefreshCw size={14} />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                            {w.cardId && individualErrors[`card-${w.cardId}`] && (
                              <div className={styles.individualError}>
                                {individualErrors[`card-${w.cardId}`]}
                              </div>
                            )}
                            {canSync && isChecked && w.cardId && (
                              <div className={styles.gradeSelector}>
                                <button
                                  type="button"
                                  onClick={() => handleSetGrade(w.cardId!, 1)}
                                  className={`${styles.gradeBtn} ${styles.again} ${syncCardGrades[w.cardId] === 1 ? styles.active : ''}`}
                                  disabled={isSubmittingSync}
                                >
                                  {t('Снова', 'もう一度')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSetGrade(w.cardId!, 2)}
                                  className={`${styles.gradeBtn} ${styles.hard} ${syncCardGrades[w.cardId] === 2 ? styles.active : ''}`}
                                  disabled={isSubmittingSync}
                                >
                                  {t('Трудно', '難しい')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSetGrade(w.cardId!, 3)}
                                  className={`${styles.gradeBtn} ${styles.good} ${syncCardGrades[w.cardId] === 3 ? styles.active : ''}`}
                                  disabled={isSubmittingSync}
                                >
                                  {t('Хорошо', '普通')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSetGrade(w.cardId!, 4)}
                                  className={`${styles.gradeBtn} ${styles.easy} ${syncCardGrades[w.cardId] === 4 ? styles.active : ''}`}
                                  disabled={isSubmittingSync}
                                >
                                  {t('Легко', '簡単')}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* NEW WORDS SECTION */}
              {analyzedWords.some(w => !w.inAnki) && (
                <div className={styles.summarySection}>
                  <h3 className={styles.sectionTitle}>
                    <Plus size={18} /> {t('Новые интересные слова', '新しい興味深い単語')}
                  </h3>
                  <p className={styles.sectionSubtitle}>
                    {t('Эти слова встретились в диалоге. Добавьте их в Anki с определением из JitenDex.', 'これらの単語が会話に出てきました。JitenDexの定義付きでAnkiに追加できます。')}
                  </p>
                  <div className={styles.wordsList}>
                    {analyzedWords
                      .filter(w => !w.inAnki)
                      .map((w, idx) => {
                        const isExpanded = expandedDefinitions.has(w.word);
                        return (
                          <div key={idx} className={styles.newWordBlock}>
                            <div className={styles.wordRow}>
                              <div className={styles.wordRowLeft}>
                                <input
                                  type="checkbox"
                                  className={styles.wordCheckbox}
                                  checked={selectedAddWords.has(w.word)}
                                  onChange={() => toggleAddWord(w.word)}
                                  disabled={isSubmittingSync}
                                  id={`add-word-${idx}`}
                                />
                                <label htmlFor={`add-word-${idx}`} className={styles.wordInfoLabel}>
                                  <span className={styles.jpWord}>{w.word}</span>
                                  <span className={styles.jpReading}>【{w.reading}】</span>
                                  <span className={styles.ruTranslation}>{w.translation}</span>
                                </label>
                              </div>
                              <div className={styles.wordRowRight}>
                                <button
                                  type="button"
                                  onClick={() => handleAddSingleWord(w.word, w)}
                                  className={`${styles.individualBtn} btn-3d btn-green`}
                                  disabled={isSubmittingSync || addWordStatus[w.word] === 'loading' || addWordStatus[w.word] === 'success'}
                                  title={t('Добавить это слово в Anki', 'この単語をAnkiに追加する')}
                                  style={{ marginRight: 8 }}
                                >
                                  {addWordStatus[w.word] === 'loading' ? (
                                    <Loader2 className={styles.spinner} size={14} />
                                  ) : addWordStatus[w.word] === 'success' ? (
                                    <Check size={14} />
                                  ) : (
                                    <Plus size={14} />
                                  )}
                                </button>
                                {w.definitionHtml && (
                                  <button
                                    onClick={() => toggleDefinitionExpand(w.word)}
                                    className={styles.expandButton}
                                    title={t('Показать определение JitenDex', 'JitenDexの定義を見る')}
                                  >
                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    <span>{t('Словарь', '辞書')}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                            {individualErrors[`word-${w.word}`] && (
                              <div className={styles.individualError}>
                                {individualErrors[`word-${w.word}`]}
                              </div>
                            )}
                            {isExpanded && w.definitionHtml && (
                              <div className={styles.dictContent}>
                                <div 
                                  className={styles.jitendexHtml}
                                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(w.definitionHtml) }} 
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

               {analyzedWords.length === 0 && (
                <div className={styles.noWordsCard}>
                  <p>{t('В диалоге не найдено новых слов для изучения.', '対話の中に新しい単語は見つかりませんでした。')}</p>
                </div>
              )}

              {/* SENTENCE EXAMPLES SECTION */}
              {sessionExamples.length > 0 && (
                <div className={styles.summarySection}>
                  <h3 className={styles.sectionTitle}>
                    <BookOpen size={18} /> {t('Примеры предложений из диалога', '会話の例文')}
                  </h3>
                  <p className={styles.sectionSubtitle}>
                    {t('Сэнсей сохранил ваши фразы как примеры контекста для слов. Отметьте те, которые хотите сохранить.', '先生は会話のフレーズをコンテキストの例文として保存しました。保存したいものにチェックを入れてください。')}
                  </p>
                  <div className={styles.wordsList}>
                    {sessionExamples.map((ex, idx) => (
                      <div key={idx} className={styles.wordRow} style={{ padding: '12px 16px' }}>
                        <div className={styles.wordRowLeft}>
                          <input
                            type="checkbox"
                            className={styles.wordCheckbox}
                            checked={ex.enabled}
                            onChange={() => {
                              setSessionExamples(prev =>
                                prev.map((item, i) => i === idx ? { ...item, enabled: !item.enabled } : item)
                              );
                            }}
                            id={`example-check-${idx}`}
                          />
                          <label htmlFor={`example-check-${idx}`} className={styles.wordInfoLabel} style={{ cursor: 'pointer' }}>
                            <span className={styles.jpWord} style={{ fontSize: '15px' }}>{ex.word}</span>
                            <span style={{ fontSize: '14px', color: 'var(--text-primary)', marginLeft: '12px', display: 'block', marginTop: '4px' }}>
                              {ex.sentence}
                            </span>
                            {ex.translation && (
                              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                                {ex.translation}
                              </span>
                            )}
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* EXPOSURE MINING CANDIDATES CARD */}
              {miningCandidates.length > 0 && (
                <div className="card-friendly" style={{ border: '2px dashed var(--color-green-shadow)', backgroundColor: 'rgba(74, 222, 128, 0.05)', marginBottom: '24px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', textAlign: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--color-green)' }}>
                    {t('Часто встречались', 'よく使われた単語')}
                  </h3>
                  <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {t(
                      `Часто встречались: ${miningCandidates.map(c => c.word).join(', ')} — добавить в изучение?`,
                      `よく使われた単語: ${miningCandidates.map(c => c.word).join(', ')} — 学習に追加しますか？`
                    )}
                  </p>
                  <button
                    onClick={() => {
                      console.log('Пользователь выразил намерение добавить слова из exposure log:', miningCandidates.map(c => c.word));
                      alert(t(
                        'Намерение зафиксировано в логах. Автоматический импорт в колоду находится в разработке.',
                        '追加の意図がログに記録されました。自動インポート機能は開発中です。'
                      ));
                    }}
                    className="btn-3d btn-green"
                    style={{ padding: '10px 20px', fontSize: '15px' }}
                  >
                    {t('Добавить в изучение', '学習に追加')}
                  </button>
                </div>
              )}

              {/* UNUSED TARGET WORDS QUIZ OFFER */}
              {unusedTargetWords.length > 0 && (
                <div className="card-friendly" style={{ border: '2px dashed var(--color-orange-shadow)', backgroundColor: 'rgba(255, 150, 0, 0.05)', marginBottom: '24px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', textAlign: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--color-orange)' }}>
                    {t('Не все целевые слова использованы!', '目標単語がすべて使われていません！')}
                  </h3>
                  <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {t(
                      `Вы не успели применить ${unusedTargetWords.length} слов(а) в диалоге. Пройдите по ним быстрый квиз, чтобы закрепить их в активной памяти!`,
                      `会話で${unusedTargetWords.length}個の単語を使いませんでした。クイズで復習して記憶に定着させましょう！`
                    )}
                  </p>
                  <button
                    onClick={() => {
                      const wordsParam = unusedTargetWords.map(w => w.word).join(',');
                      router.push(`/practice/quiz?words=${encodeURIComponent(wordsParam)}`);
                    }}
                    className="btn-3d btn-orange"
                    style={{ padding: '10px 20px', fontSize: '15px' }}
                  >
                    {t(`Пройти быстрый тест по неиспользованным словам (${unusedTargetWords.length})`, `未使用単語のテストに進む (${unusedTargetWords.length})`)}
                  </button>
                </div>
              )}

              {/* ACTION BUTTONS */}
              <div className={styles.summaryActions}>
                {(() => {
                  const turnCount = messages.filter(m => m.role === 'user').length;
                  const isFluency = session.fluencyMode === true;
                  const currentRound = session.fluencyRound || 0;
                  const nextRound = isFluency ? (currentRound + 1) as 1 | 2 | 3 : 1;
                  const showReplayButton = turnCount >= 3 && (!isFluency || currentRound < 3);
                  
                  if (!showReplayButton) return null;
                  
                  return (
                    <button
                      onClick={handleStartFluencyReplay}
                      className="btn-3d btn-blue"
                      style={{ marginRight: 8 }}
                      disabled={isSubmittingSync}
                    >
                      {isFluency
                        ? `🔁 Раунд ${nextRound}: ещё быстрее`
                        : '🔁 Беглость: пройти сценарий быстрее'}
                    </button>
                  );
                })()}
                <button
                  onClick={endSession}
                  className="btn-3d"
                  disabled={isSubmittingSync}
                >
                  {t('Вернуться в настройки', '設定に戻る')}
                </button>
                {(analyzedWords.length > 0 || session.grammarFocus) && (
                  <button
                    onClick={handleSyncAndAdd}
                    className="btn-3d btn-green"
                    disabled={isSubmittingSync || (selectedSyncCards.size === 0 && selectedAddWords.size === 0 && !session.grammarFocus)}
                  >
                    {isSubmittingSync ? (
                      <>
                        <Loader2 className={styles.spinner} size={16} style={{ marginRight: 8 }} />
                        {t('Сохранение...', '保存中...')}
                      </>
                    ) : (
                      t('Сохранить прогресс', '進捗を保存')
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chatContainer}>
      {/* HEADER */}
      <header className={styles.chatHeader}>
        <div className={styles.headerLeft}>
          <button onClick={() => router.push('/')} className={styles.backButton} title={t('Назад', '戻る')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className={styles.scenarioTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {session.title}
              <ScienceTip tipId="furigana" />
            </h1>
            <p className={styles.scenarioSubtitle}>{session.description}</p>
          </div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.progressBarContainer}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
            </div>
            <span className={styles.progressText}>{collectedCount}/{totalWords}</span>
          </div>
          <button
            onClick={() => setShowExitConfirm(true)}
            className="btn-3d btn-orange"
            style={{ padding: '8px 12px', fontSize: '13px', textTransform: 'none' }}
          >
            {t('Завершить', '終了する')}
          </button>
        </div>
      </header>

      {/* WORD TRACKER */}
      {session.targetWords && session.targetWords.length > 0 && (
        <div className={styles.wordTracker}>
          <span className={styles.wordTrackerLabel}>{t('Цели:', '目標:')}</span>
          {session.targetWords.map((tw, idx) => {
            const isCollected = collectedWords.has(tw.word);
            return (
              <span
                key={idx}
                className={`${styles.wordChip} ${isCollected ? styles.collected : ''}`}
              >
                {isCollected ? `${tw.word} (${tw.translation})` : tw.translation}
                {isCollected && <span className={styles.wordChipCheck}>✓</span>}
              </span>
            );
          })}
        </div>
      )}

      {/* GRAMMAR TARGET BADGE */}
      {session.grammarFocus && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', backgroundColor: 'rgba(59, 130, 246, 0.08)', borderBottom: '2.5px solid var(--border-color)' }}>
          <span style={{ fontSize: '13px', fontWeight: 805, color: 'var(--color-blue)' }}>Грамматика:</span>
          <span className={styles.wordChip} style={{ border: '2.5px solid var(--color-blue-shadow)', backgroundColor: 'var(--card-bg)', cursor: 'default' }}>
            {session.grammarFocus.construction} ({session.grammarFocus.topic})
          </span>
        </div>
      )}

      {/* COMPLETION BANNER */}
      {isComplete && (
        <div className={styles.completionBanner}>
          <span style={{ fontSize: 24 }}>🎉</span>
          <span className={styles.completionText}>
            {t('Отлично! Все слова собраны!', 'すごい！全部の言葉を集めました！')}
          </span>
          <button onClick={handleStartCompletion} className="btn-3d btn-green" style={{ padding: '6px 14px', fontSize: 13 }}>
            {t('Завершить', '終了')}
          </button>
        </div>
      )}

      {/* MESSAGE AREA */}
      <div className={styles.messageArea}>
        {messages.map(msg => (
          <React.Fragment key={msg.id}>
            <div className={`${styles.messageRow} ${msg.role === 'user' ? styles.user : styles.ai}`}>
              <img
                src={msg.role === 'model' ? '/images/cat-sensei.png' : '/images/cat-student.png'}
                alt={msg.role === 'model' ? 'Сэнсей' : 'Ученик'}
                className={styles.avatar}
              />
              <div className={styles.messageContent}>
                <div className={`${styles.messageBubble} ${msg.role === 'user' ? styles.user : styles.ai}`}>
                  {msg.role === 'model' ? (
                    <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(applyGradualFurigana(msg.text, wordIntervalMap)) }} />
                  ) : (
                    msg.text
                  )}
                </div>

                {/* Translation toggle (for AI messages) */}
                {msg.role === 'model' && msg.translation && (
                  <>
                    {shouldShowTranslation() ? (
                      <div className={styles.translationText}>{msg.translation}</div>
                    ) : (
                      <>
                        <button
                          className={styles.translationToggle}
                          onClick={() => toggleTranslation(msg.id)}
                        >
                          {showTranslationFor.has(msg.id) ? '▲ ' + t('Скрыть перевод', '翻訳を隠す') : '▼ ' + t('Показать перевод', '翻訳を見る')}
                        </button>
                        {showTranslationFor.has(msg.id) && (
                          <div className={styles.translationText}>{msg.translation}</div>
                        )}
                      </>
                    )}
                  </>
                )}

                {/* Grammar feedback (for user messages) */}
                {msg.role === 'user' && msg.grammarFeedback && !msg.grammarFeedback.isCorrect && (msg.grammarFeedback.correction || msg.grammarFeedback.explanation) && (
                  <div
                    className={styles.grammarCard}
                    title={t('Подсказка сэнсея', '先生のヒント')}
                  >
                    <img
                      src="/images/cat-sensei.png"
                      alt="Подсказка"
                      className={styles.grammarCatIcon}
                    />
                    <div className={styles.grammarBody}>
                      {msg.grammarFeedback.shortNote && (
                        <div className={styles.grammarShortNote}>
                          {msg.grammarFeedback.shortNote}
                        </div>
                      )}
                      
                      {msg.grammarFeedback.explanation && (
                        <span
                          className={styles.grammarExplanation}
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.grammarFeedback.explanation) }}
                        />
                      )}

                      <div className={styles.grammarSelfRepairHint} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Попробуй исправить предложение сам и отправь снова — или открой правку.
                        <ScienceTip tipId="self_repair" />
                      </div>

                      {msg.grammarFeedback.correction && (
                        <div style={{ marginTop: '8px' }}>
                          {showCorrectionFor.has(msg.id) ? (
                            <span className={styles.grammarCorrection}>
                              → <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(applyGradualFurigana(msg.grammarFeedback.correction, wordIntervalMap)) }} />
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="btn-3d btn-orange"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleShowCorrection(msg.id);
                              }}
                              style={{ padding: '4px 12px', fontSize: '0.85em' }}
                            >
                              Показать правку
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Correct grammar indicator */}
                {msg.role === 'user' && msg.grammarFeedback && msg.grammarFeedback.isCorrect && (
                  <div className={`${styles.grammarCard} ${styles.correct}`}>
                    <img
                      src="/images/cat-sensei.png"
                      alt="Отлично"
                      className={styles.grammarCatIcon}
                    />
                    <div className={styles.grammarBody}>
                      <span className={styles.grammarCorrection}>
                        ✓ {t('Грамматика верна!', '文法は正しいです！')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </React.Fragment>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className={`${styles.messageRow} ${styles.ai}`}>
            <img src="/images/cat-sensei.png" alt="Сэнсей" className={styles.avatar} />
            <div className={styles.typingIndicator}>
              <div className={styles.typingDots}>
                <div className={styles.typingDot} />
                <div className={styles.typingDot} />
                <div className={styles.typingDot} />
              </div>
            </div>
          </div>
        )}

        <div ref={messageEndRef} />
      </div>

      {/* FLOATING INTERACTIVE MASCOT */}
      <div 
        data-testid="chat-mascot"
        data-state={mascotState}
        className={`${styles.mascotWidget} ${styles[mascotState]}`}
      >
        {mascotBubble && (
          <div className={styles.mascotSpeechBubble}>
            {mascotBubble}
          </div>
        )}
        <div className={styles.mascotImageContainer}>
          <svg className={styles.mascotSvg} viewBox="0 0 100 100" width="80" height="80">
            {/* Steam (always animated) */}
            <g className={styles.steamGroup}>
              <path d="M45,25 Q48,15 45,5" stroke="var(--text-light, #9ca3af)" strokeWidth="2" strokeLinecap="round" fill="none" className={styles.steamLine1} />
              <path d="M55,25 Q58,15 55,5" stroke="var(--text-light, #9ca3af)" strokeWidth="2" strokeLinecap="round" fill="none" className={styles.steamLine2} />
            </g>
            
            {/* Spout */}
            <path d="M 25 55 Q 12 50 15 42 Q 18 42 24 49 Z" fill="#3b82f6" stroke="var(--border-color, #e5e7eb)" strokeWidth="2" />
            
            {/* Handle */}
            <path d="M 75 48 C 88 48 88 68 75 68" fill="none" stroke="var(--border-color, #e5e7eb)" strokeWidth="4" strokeLinecap="round" />
            
            {/* Main Body (Teapot / Cup) */}
            <circle cx="50" cy="58" r="26" fill="#3b82f6" stroke="var(--border-color, #e5e7eb)" strokeWidth="3" />
            <ellipse cx="50" cy="33" rx="18" ry="4" fill="#1e3a8a" stroke="var(--border-color, #e5e7eb)" strokeWidth="2" />
            
            {/* Lid knob */}
            <circle cx="50" cy="28" r="5" fill="#f59e0b" stroke="var(--border-color, #e5e7eb)" strokeWidth="2" />
            
            {/* Face expressions */}
            {mascotState === 'idle' && (
              <g>
                <path d="M 40 55 Q 44 58 48 55" stroke="var(--border-color, #e5e7eb)" strokeWidth="2" fill="none" strokeLinecap="round" />
                <path d="M 52 55 Q 56 58 60 55" stroke="var(--border-color, #e5e7eb)" strokeWidth="2" fill="none" strokeLinecap="round" />
                <path d="M 48 64 Q 50 67 52 64" stroke="var(--border-color, #e5e7eb)" strokeWidth="2" fill="none" strokeLinecap="round" />
              </g>
            )}
            {mascotState === 'happy' && (
              <g>
                <path d="M 38 58 Q 43 52 48 58" stroke="var(--border-color, #e5e7eb)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                <path d="M 52 58 Q 57 52 62 58" stroke="var(--border-color, #e5e7eb)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                <path d="M 46 64 Q 50 72 54 64 Z" fill="#f59e0b" stroke="var(--border-color, #e5e7eb)" strokeWidth="1.5" />
                <circle cx="34" cy="62" r="3" fill="rgba(239, 68, 68, 0.4)" />
                <circle cx="66" cy="62" r="3" fill="rgba(239, 68, 68, 0.4)" />
              </g>
            )}
            {mascotState === 'worried' && (
              <g>
                <path d="M 40 56 Q 44 52 48 56" stroke="var(--border-color, #e5e7eb)" strokeWidth="2" fill="none" strokeLinecap="round" />
                <path d="M 52 56 Q 56 52 60 56" stroke="var(--border-color, #e5e7eb)" strokeWidth="2" fill="none" strokeLinecap="round" />
                <path d="M 47 67 Q 50 63 53 67" stroke="var(--border-color, #e5e7eb)" strokeWidth="2" fill="none" strokeLinecap="round" />
                <path d="M 32 50 C 32 50 30 55 32 57 C 34 57 34 55 34 50 Z" fill="#60a5fa" />
              </g>
            )}
            {mascotState === 'cheering' && (
              <g>
                <path d="M 38 58 Q 43 52 48 58" stroke="var(--border-color, #e5e7eb)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                <path d="M 52 58 L 62 55" stroke="var(--border-color, #e5e7eb)" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M 46 63 Q 50 68 54 63" stroke="var(--border-color, #e5e7eb)" strokeWidth="2" fill="none" strokeLinecap="round" />
                <circle cx="34" cy="62" r="3" fill="rgba(239, 68, 68, 0.4)" />
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* HINT PANEL */}
      {showHints && (
        <div className={styles.hintPanel}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className={styles.hintTitle}>💡 {t('Подсказки', 'ヒント')}</span>
            <button onClick={() => setShowHints(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <X size={16} color="var(--text-light)" />
            </button>
          </div>
          {isLoadingHints ? (
            <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {t('Генерация подсказок...', 'ヒントを生成中...')}
            </div>
          ) : (
            hints.map((hint, idx) => (
              <div key={idx} className={styles.hintOption}>
                <span className={`${styles.hintLevel} ${styles[hint.level] || ''}`}>
                  {hint.level === 'easy' ? '🟢' : hint.level === 'medium' ? '🟡' : '🔴'} {hint.level}
                </span>
                {hint.keywords && hint.keywords.length > 0 && (
                  <div className={styles.hintKeywords}>
                    {hint.keywords.map((kw, kwIdx) => (
                      <span key={kwIdx} className={styles.keywordChip}>
                        <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(kw.word) }} />
                        <span className={styles.keywordTranslation}> ({kw.translation})</span>
                      </span>
                    ))}
                  </div>
                )}
                <div className={styles.patternHintText}>{hint.patternHint}</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TIMER COUNTDOWN BAR */}
      {session.fluencyMode && !showSummaryScreen && !(session.targetWords.length > 0 && session.targetWords.every(w => collectedWords.has(w.word))) && (
        <div className={`${styles.timerBarContainer} ${timeLeftMs === 0 ? styles.expired : ''}`} data-testid="fluency-timer-bar">
          <div 
            className={`${styles.timerBarFill} ${
              (() => {
                const limitSec = getTurnLimit(session.fluencyRound!, state.chatLevel);
                const limitMs = limitSec * 1000;
                const timerPercent = limitMs > 0 ? (timeLeftMs / limitMs) * 100 : 0;
                return timerPercent > 50 
                  ? styles.timerGreen 
                  : timerPercent >= 20 
                  ? styles.timerOrange 
                  : styles.timerRed;
              })()
            }`}
            style={{
              width: `${(() => {
                const limitSec = getTurnLimit(session.fluencyRound!, state.chatLevel);
                const limitMs = limitSec * 1000;
                return limitMs > 0 ? (timeLeftMs / limitMs) * 100 : 0;
              })()}%`
            }}
          />
        </div>
      )}

      {/* BANNER FOR COMPLETED WORDS */}
      {session && session.targetWords && session.targetWords.length > 0 && 
        session.targetWords.every(w => collectedWords.has(w.word)) && !showSummaryScreen && (
          <div className={styles.completedBanner}>
            <span>{t('Все слова собраны! 🎉', 'すべての単語が集まりました！ 🎉')}</span>
            <button 
              className="btn-3d btn-green"
              onClick={handleStartCompletion}
              style={{ textTransform: 'none' }}
            >
              {t('К итогам', '結果へ')}
            </button>
          </div>
      )}

      {/* INPUT AREA */}
      <div className={styles.inputArea}>
        <button
          onClick={requestHints}
          className={`btn-3d ${styles.hintButton}`}
          disabled={isLoading || isLoadingHints}
          title={t('Подсказка', 'ヒント')}
        >
          <Lightbulb size={18} />
        </button>
        <textarea
          ref={inputRef}
          className={styles.chatInput}
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('Напишите на японском...', '日本語で書いてください...')}
          rows={1}
          disabled={isLoading}
        />
        <button
          onClick={sendMessage}
          className={`btn-3d btn-green ${styles.sendButton}`}
          disabled={isLoading || !inputText.trim()}
        >
          <Send size={16} /> {t('Отправить', '送信')}
        </button>
      </div>

      {/* EXIT CONFIRMATION MODAL */}
      {showExitConfirm && (
        <div className={styles.modalOverlay} onClick={() => setShowExitConfirm(false)}>
          <div className={`${styles.modalContent} card-friendly`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                <AlertCircle size={24} style={{ color: 'var(--color-orange)' }} />
                <span>{t("Завершить диалог?", "対話を終了しますか？")}</span>
              </h2>
              <button className={styles.closeButton} onClick={() => setShowExitConfirm(false)}>
                <X size={24} />
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 20px 0', lineHeight: '1.5' }}>
                {t(
                  "Вы хотите завершить диалог прямо сейчас? Не собранные целевые слова будут перенесены в быстрый квиз.",
                  "今すぐ対話を終了しますか？まだ集めていない目標単語はクイッククイズに出題されます。"
                )}
              </p>
            </div>

            <div className={styles.modalActions}>
              <button 
                className="btn-3d" 
                onClick={() => setShowExitConfirm(false)}
                style={{ flex: 1 }}
              >
                {t("Продолжить", "続ける")}
              </button>
              <button 
                className="btn-3d btn-orange" 
                onClick={handleConfirmExit}
                style={{ flex: 1 }}
              >
                {t("Завершить", "終了する")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
