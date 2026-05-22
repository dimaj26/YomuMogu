'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send, Lightbulb, X, Check, Loader2, ChevronDown, ChevronUp, RefreshCw, AlertCircle, Plus } from 'lucide-react';
import { useJapanification } from '@/hooks/useJapanification';
import { getProfileItem, setProfileItem, removeProfileItem, getActiveProfileId } from '@/lib/profile';
import { db, addLocalReview } from '@/lib/db';
import { calculateNextFsrsState } from '@/lib/anki/fsrs';
import styles from './chat.module.css';

interface TargetWord {
  word: string;
  translation: string;
}

interface GrammarFeedback {
  isCorrect: boolean;
  correction: string;
  explanation: string;
}

interface ChatMessageData {
  id: string;
  role: 'user' | 'model';
  text: string;
  translation?: string;
  grammarFeedback?: GrammarFeedback;
  wordsDetected?: string[];
}

interface HintVariant {
  level: string;
  japanese: string;
  translation: string;
}

interface SessionData {
  id: string;
  title: string;
  description: string;
  scenario: string;
  targetWords: TargetWord[];
}

interface SavedChatState {
  messages: ChatMessageData[];
  collectedWords: string[];
  isComplete: boolean;
  showBonusTest: boolean;
  unusedTargetWords: TargetWord[];
  currentBonusIndex: number;
  bonusInput: string;
  bonusChecked: boolean;
  bonusFeedback: { isCorrect: boolean; message: string } | null;
  showSummaryScreen: boolean;
  analyzedWords: AnalyzedWord[];
  selectedSyncCards: number[];
  selectedAddWords: string[];
  syncCardGrades?: Record<number, number>;
  showExitConfirm?: boolean;
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
  const { t, state, shouldShowTranslation, shouldGrammarBeJapanese, addPoints, trackWordUsed, completeSession } = useJapanification();

  const [session, setSession] = useState<SessionData | null>(null);
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [collectedWords, setCollectedWords] = useState<Set<string>>(new Set());
  const [showTranslationFor, setShowTranslationFor] = useState<Set<string>>(new Set());
  const [expandedGrammar, setExpandedGrammar] = useState<Set<string>>(new Set());
  const [hints, setHints] = useState<HintVariant[]>([]);
  const [isLoadingHints, setIsLoadingHints] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  // States for Bonus Test and Results Summary flow
  const [showBonusTest, setShowBonusTest] = useState(false);
  const [unusedTargetWords, setUnusedTargetWords] = useState<TargetWord[]>([]);
  const [currentBonusIndex, setCurrentBonusIndex] = useState(0);
  const [bonusInput, setBonusInput] = useState('');
  const [bonusChecked, setBonusChecked] = useState(false);
  const [bonusFeedback, setBonusFeedback] = useState<{ isCorrect: boolean; message: string } | null>(null);

  const [showSummaryScreen, setShowSummaryScreen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedWords, setAnalyzedWords] = useState<AnalyzedWord[]>([]);
  const [selectedSyncCards, setSelectedSyncCards] = useState<Set<number>>(new Set());
  const [syncCardGrades, setSyncCardGrades] = useState<Record<number, number>>({});
  const [selectedAddWords, setSelectedAddWords] = useState<Set<string>>(new Set());
  const [expandedDefinitions, setExpandedDefinitions] = useState<Set<string>>(new Set());
  const [isSubmittingSync, setIsSubmittingSync] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ success: boolean; message: string } | null>(null);

  const [isStateLoaded, setIsStateLoaded] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

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
          setShowBonusTest(savedState.showBonusTest || false);
          setUnusedTargetWords(savedState.unusedTargetWords || []);
          setCurrentBonusIndex(savedState.currentBonusIndex || 0);
          setBonusInput(savedState.bonusInput || '');
          setBonusChecked(savedState.bonusChecked || false);
          setBonusFeedback(savedState.bonusFeedback);
          setShowSummaryScreen(savedState.showSummaryScreen || false);
          setAnalyzedWords(savedState.analyzedWords || []);
          setSelectedSyncCards(new Set(savedState.selectedSyncCards || []));
          setSyncCardGrades(savedState.syncCardGrades || {});
          setSelectedAddWords(new Set(savedState.selectedAddWords || []));
          setShowExitConfirm(savedState.showExitConfirm || false);
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
        showBonusTest,
        unusedTargetWords,
        currentBonusIndex,
        bonusInput,
        bonusChecked,
        bonusFeedback,
        showSummaryScreen,
        analyzedWords,
        selectedSyncCards: Array.from(selectedSyncCards),
        selectedAddWords: Array.from(selectedAddWords),
        syncCardGrades,
        showExitConfirm,
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
    showBonusTest,
    unusedTargetWords,
    currentBonusIndex,
    bonusInput,
    bonusChecked,
    bonusFeedback,
    showSummaryScreen,
    analyzedWords,
    selectedSyncCards,
    selectedAddWords,
    syncCardGrades,
    showExitConfirm
  ]);

  // Проверка завершения (80% слов собрано)
  useEffect(() => {
    if (session && !isComplete) {
      const threshold = Math.ceil(session.targetWords.length * 0.8);
      if (collectedWords.size >= threshold) {
        setIsComplete(true);
        completeSession();
      }
    }
  }, [collectedWords, session, isComplete, completeSession]);

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
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: session.scenario,
          targetWords: session.targetWords,
          history: [],
          message: '__START__',
          level: state.chatLevel,
          grammarInJapanese: shouldGrammarBeJapanese()
        })
      });
      const data = await res.json();
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
          grammarInJapanese: shouldGrammarBeJapanese()
        })
      });
      const data = await res.json();
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

        // Начисляем очки
        if (newWordsCount > 0) {
          trackWordUsed(newWordsCount);
        }
        if (data.grammarFeedback?.isCorrect) {
          addPoints(1); // Бонус за правильную грамматику
        }

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
      }
    } catch {
      // Ошибка отправки
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const requestHints = async () => {
    if (!session || isLoadingHints) return;

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
      if (res.ok) {
        setHints(data.hints || []);
      }
    } catch {
      // Ошибка генерации подсказок
    } finally {
      setIsLoadingHints(false);
    }
  };

  const selectHint = (hint: HintVariant) => {
    setInputText(stripRuby(hint.japanese));
    setShowHints(false);
    inputRef.current?.focus();
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
    router.push('/settings');
  };

  const handleConfirmExit = () => {
    setShowExitConfirm(false);
    handleStartCompletion();
  };

  const handleStartCompletion = () => {
    if (!session) return;
    const unused = session.targetWords.filter(tw => !collectedWords.has(tw.word));
    if (unused.length > 0) {
      setUnusedTargetWords(unused);
      setCurrentBonusIndex(0);
      setBonusInput('');
      setBonusChecked(false);
      setBonusFeedback(null);
      setShowBonusTest(true);
    } else {
      startAnalysis();
    }
  };

  const handleCheckBonus = () => {
    if (unusedTargetWords.length === 0) return;
    const currentWord = unusedTargetWords[currentBonusIndex];
    const isCorrect = bonusInput.trim() === currentWord.word;

    if (isCorrect) {
      addPoints(1);
      setBonusFeedback({
        isCorrect: true,
        message: t('Правильно! +1 XP', '正解！+1 XP')
      });
    } else {
      setBonusFeedback({
        isCorrect: false,
        message: t(`Неверно. Правильный ответ: ${currentWord.word}`, `不正解。正しい答え: ${currentWord.word}`)
      });
    }
    setBonusChecked(true);
  };

  const handleNextBonus = () => {
    if (currentBonusIndex < unusedTargetWords.length - 1) {
      setCurrentBonusIndex(prev => prev + 1);
      setBonusInput('');
      setBonusChecked(false);
      setBonusFeedback(null);
    } else {
      setShowBonusTest(false);
      startAnalysis();
    }
  };

  const handleSkipBonus = () => {
    handleNextBonus();
  };

  const handleSkipAllBonus = () => {
    setShowBonusTest(false);
    startAnalysis();
  };

  const startAnalysis = async () => {
    if (!session) return;
    setShowSummaryScreen(true);
    setIsAnalyzing(true);
    setSyncStatus(null);
    try {
      const deckName = getProfileItem('selected_deck') || 'Japanese';
      const frontField = getProfileItem('front_field') || 'Front';
      const backField = getProfileItem('back_field') || 'Back';

      const res = await fetch('/api/chat/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: messages.map(m => ({ role: m.role, text: m.text })),
          deckName,
          frontField,
          backField
        })
      });
      if (!res.ok) {
        throw new Error(t('Не удалось проанализировать диалог', '対話の分析に失敗しました'));
      }
      const data = await res.json();
      const words: AnalyzedWord[] = data.words || [];
      setAnalyzedWords(words);

      // Auto-select due/learning cards for syncing
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

  const handleSyncAndAdd = async () => {
    if (!session || isSubmittingSync) return;
    setIsSubmittingSync(true);
    setSyncStatus(null);

    const deckName = getProfileItem('selected_deck') || 'Japanese';
    const frontField = getProfileItem('front_field') || 'Front';
    const backField = getProfileItem('back_field') || 'Back';
    const profileId = getActiveProfileId();

    try {
      // 1. Синхронизируем карточки (повторение) через локальную БД и FSRS
      if (selectedSyncCards.size > 0) {
        for (const cardId of Array.from(selectedSyncCards)) {
          const wordObj = analyzedWords.find(w => w.cardId === cardId || (w.cardIds && w.cardIds.includes(cardId)));
          const ease = syncCardGrades[cardId] || 3;
          
          if (wordObj) {
            const targetIds = wordObj.cardIds && wordObj.cardIds.length > 0 ? wordObj.cardIds : [cardId];
            for (const cid of targetIds) {
              let localWord = await db.words.get({ profileId, id: cid });
              
              if (!localWord) {
                localWord = {
                  profileId,
                  id: cid,
                  word: wordObj.word,
                  reading: wordObj.reading,
                  translation: wordObj.translation,
                  status: wordObj.status || 'new',
                  deckName,
                  stability: 0,
                  difficulty: 0,
                  interval: 0,
                  due: Date.now(),
                  reps: 0,
                  lapses: 0
                };
              }
              
              const { updatedWord, newInterval, lastInterval } = calculateNextFsrsState(localWord, ease);
              await db.words.put(updatedWord);
              
              await addLocalReview({
                profileId,
                cardId: cid,
                ease,
                interval: newInterval,
                lastInterval,
                duration: 0,
                timestamp: Date.now(),
                synced: 0
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
            const addRes = await fetch('/api/anki/add', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                deckName,
                frontField,
                backField,
                word: w.word,
                reading: w.reading,
                translation: w.translation,
                definitionHtml: w.definitionHtml,
                history: messages.map(m => ({ role: m.role, text: m.text }))
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
      const syncRes = await fetch('/api/anki/sync-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          deckName
        })
      });
      if (!syncRes.ok) {
        const errData = await syncRes.json();
        throw new Error(errData.error || t('Ошибка при синхронизации с Anki', 'Ankiとの同期中にエラーが発生しました'));
      }

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

  const totalWords = session.targetWords.length;
  const collectedCount = collectedWords.size;
  const progressPercent = totalWords > 0 ? Math.round((collectedCount / totalWords) * 100) : 0;

  if (showBonusTest && unusedTargetWords.length > 0) {
    const currentWord = unusedTargetWords[currentBonusIndex];
    return (
      <div className={styles.chatContainer}>
        {/* HEADER */}
        <header className={styles.chatHeader}>
          <div className={styles.headerLeft}>
            <button onClick={handleSkipAllBonus} className={styles.backButton} title={t('Пропустить всё', 'すべてスキップ')}>
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className={styles.scenarioTitle}>{t('Бонусный тест', 'ボーнаステスト')}</h1>
              <p className={styles.scenarioSubtitle}>
                {t('Переведите слова, которые не встретились в диалоге', '会話で使わなかった単語を翻訳しましょう')}
              </p>
            </div>
          </div>
          <div className={styles.progressBarContainer}>
            <span className={styles.progressText}>
              {currentBonusIndex + 1} / {unusedTargetWords.length}
            </span>
          </div>
        </header>

        {/* TEST BODY */}
        <div className={styles.messageArea} style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div className={styles.bonusCard}>
            <div className={styles.bonusQuestion}>
              <span className={styles.bonusLabel}>{t('Как переводится:', '翻訳してください:')}</span>
              <h2 className={styles.bonusRussianWord}>{currentWord.translation}</h2>
            </div>

            <div className={styles.bonusInputGroup}>
              <input
                type="text"
                className="input-friendly"
                value={bonusInput}
                onChange={e => setBonusInput(e.target.value)}
                placeholder={t('Введите слово на японском...', '日本語で入力...')}
                disabled={bonusChecked}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (!bonusChecked) {
                      if (bonusInput.trim()) handleCheckBonus();
                    } else {
                      handleNextBonus();
                    }
                  }
                }}
                autoFocus
              />
            </div>

            {bonusFeedback && (
              <div className={`${styles.bonusFeedback} ${bonusFeedback.isCorrect ? styles.correct : styles.incorrect}`}>
                {bonusFeedback.isCorrect ? <Check size={20} /> : <AlertCircle size={20} />}
                <span>{bonusFeedback.message}</span>
              </div>
            )}

            <div className={styles.bonusActions}>
              {!bonusChecked ? (
                <>
                  <button
                    onClick={handleSkipBonus}
                    className="btn-3d"
                    style={{ flex: 1 }}
                  >
                    {t('Пропустить', 'スキップ')}
                  </button>
                  <button
                    onClick={handleCheckBonus}
                    className="btn-3d btn-green"
                    disabled={!bonusInput.trim()}
                    style={{ flex: 1 }}
                  >
                    {t('Проверить', '確認')}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleNextBonus}
                  className="btn-3d btn-blue"
                  style={{ width: '100%' }}
                >
                  {currentBonusIndex < unusedTargetWords.length - 1 ? t('Следующее слово', '次の単語') : t('Показать результаты', '結果を見る')}
                </button>
              )}
            </div>
          </div>

          <button
            onClick={handleSkipAllBonus}
            className={styles.skipAllLink}
          >
            {t('Пропустить тест и перейти к результатам', 'テストをスキップして結果へ')}
          </button>
        </div>
      </div>
    );
  }

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
                        const canSync = w.status === 'learning' || w.isDue;
                        const isChecked = w.cardId ? selectedSyncCards.has(w.cardId) : false;
                        return (
                          <div key={idx} className={styles.syncWordBlock}>
                            <div className={`${styles.wordRow} ${w.inAnki ? styles.existingWord : ''}`}>
                              <div className={styles.wordRowLeft}>
                                {canSync ? (
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
                              </div>
                            </div>
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
                            {isExpanded && w.definitionHtml && (
                              <div className={styles.dictContent}>
                                <div 
                                  className={styles.jitendexHtml}
                                  dangerouslySetInnerHTML={{ __html: w.definitionHtml }} 
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
                  <p>{t('В диалоге не найдено новых слов уровня N4+.', '対話の中にN4以上の新しい単語は見つかりませんでした。')}</p>
                </div>
              )}

              {/* ACTION BUTTONS */}
              <div className={styles.summaryActions}>
                <button
                  onClick={endSession}
                  className="btn-3d"
                  disabled={isSubmittingSync}
                >
                  {t('Вернуться в настройки', '設定に戻る')}
                </button>
                {analyzedWords.length > 0 && (
                  <button
                    onClick={handleSyncAndAdd}
                    className="btn-3d btn-green"
                    disabled={isSubmittingSync || (selectedSyncCards.size === 0 && selectedAddWords.size === 0)}
                  >
                    {isSubmittingSync ? (
                      <>
                        <Loader2 className={styles.spinner} size={16} style={{ marginRight: 8 }} />
                        {t('Синхронизация...', '同期中...')}
                      </>
                    ) : (
                      t('Синхронизировать с Anki', 'Ankiと同期する')
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
            <h1 className={styles.scenarioTitle}>{session.title}</h1>
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
                    <span dangerouslySetInnerHTML={{ __html: msg.text }} />
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
                    onClick={() => toggleGrammarExpand(msg.id)}
                    title={t('Нажмите для подробностей', '詳細を見る')}
                  >
                    <img
                      src="/images/cat-sensei.png"
                      alt="Подсказка"
                      className={styles.grammarCatIcon}
                    />
                    <div className={styles.grammarBody}>
                      {msg.grammarFeedback.correction && (
                        <span className={styles.grammarCorrection}>
                          → <span dangerouslySetInnerHTML={{ __html: msg.grammarFeedback.correction }} />
                        </span>
                      )}
                      {!msg.grammarFeedback.correction && msg.grammarFeedback.explanation && (
                        <span className={styles.grammarCorrection}>
                          ⚠️ {t('Внимание', '注意')}
                        </span>
                      )}
                      {(expandedGrammar.has(msg.id) || !msg.grammarFeedback.correction) && msg.grammarFeedback.explanation && (
                        <span
                          className={styles.grammarExplanation}
                          dangerouslySetInnerHTML={{ __html: msg.grammarFeedback.explanation }}
                        />
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
              <div key={idx} className={styles.hintOption} onClick={() => selectHint(hint)}>
                <span className={`${styles.hintLevel} ${styles[hint.level] || ''}`}>
                  {hint.level === 'easy' ? '🟢' : hint.level === 'medium' ? '🟡' : '🔴'} {hint.level}
                </span>
                <span className={styles.hintText} dangerouslySetInnerHTML={{ __html: hint.japanese }} />
                <span className={styles.hintTranslation}>{hint.translation}</span>
              </div>
            ))
          )}
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
                  "Вы хотите завершить диалог прямо сейчас? Не собранные целевые слова будут перенесены в бонусный тест.",
                  "今すぐ対話を終了しますか？まだ集めていない目標単語はボーナステストに出題されます。"
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
