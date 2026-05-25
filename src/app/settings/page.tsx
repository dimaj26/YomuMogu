'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RefreshCw, CheckCircle, XCircle, BookOpen, Settings as SettingsIcon, AlertCircle, Sparkles, User, Trophy, Zap, BarChart2, Trash2 } from 'lucide-react';
import styles from './settings.module.css';
import { AnkiWord } from '@/plugins/anki/filter';
import { useJapanification } from '@/hooks/useJapanification';
import { useJpUI } from '@/components/JpUIProvider';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { getProfileItem, setProfileItem, removeProfileItem, getProfilesList, setActiveProfileId, getActiveProfileId, createProfile, deleteProfile, ProfileInfo } from '@/lib/profile';
import { 
  LOCAL_DECK_NAME,
  isLocalDeckInitialized,
  importStarterDeck,
  getDailyNewWordsCount,
  incrementDailyNewWordsCount,
  getDailyActivePool,
  getLocalDeckStats,
  getDailyNewWordsLimit
} from '@/core/localDeckService';
import { db } from '@/core/db';

export default function SettingsPage() {
  const router = useRouter();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [decks, setDecks] = useState<string[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<string>('__all__');
  const [frontField, setFrontField] = useState<string>('Front');
  const [backField, setBackField] = useState<string>('Back');
  const [audioField, setAudioField] = useState<string>('');
  const [imageField, setImageField] = useState<string>('');
  const [deckMode, setDeckMode] = useState<'standard' | 'custom' | 'local'>('standard');
  const [words, setWords] = useState<AnkiWord[]>([]);
  const [deckMappings, setDeckMappings] = useState<Record<string, { frontField: string; backField: string; audioField?: string; imageField?: string }>>({});

  const handleDeckChange = (newDeckName: string) => {
    setSelectedDeck(newDeckName);
    
    // Если есть сохраненные настройки для этой колоды, загружаем их
    if (newDeckName !== '__all__' && deckMappings[newDeckName]) {
      const mapping = deckMappings[newDeckName];
      setFrontField(mapping.frontField || 'Front');
      setBackField(mapping.backField || 'Back');
      setAudioField(mapping.audioField || '');
      setImageField(mapping.imageField || '');
    } else {
      // Если настроек нет или это '__all__', сбрасываем на дефолты
      setFrontField('Front');
      setBackField('Back');
      setAudioField('');
      setImageField('');
    }
  };
  
  const [isLoadingConnection, setIsLoadingConnection] = useState<boolean>(false);
  const [isLoadingDecks, setIsLoadingDecks] = useState<boolean>(false);
  const [isLoadingWords, setIsLoadingWords] = useState<boolean>(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(false);
  
  const [error, setError] = useState<string | null>(null);
  const [wordLoadSuccess, setWordLoadSuccess] = useState<boolean>(false);
  const [sessions, setSessions] = useState<any[]>([]);

  // Локальный автономный режим
  const [isLocalInitialized, setIsLocalInitialized] = useState<boolean>(false);
  const [dailyNewWordsCount, setDailyNewWordsCount] = useState<number>(0);
  const [quotaPreset, setQuotaPreset] = useState<'easy' | 'standard' | 'hard' | 'custom'>('standard');
  const [customQuotaLimit, setCustomQuotaLimit] = useState<number>(10);
  const [isAssessmentOpen, setIsAssessmentOpen] = useState<boolean>(false);
  const [checkedNewWordIds, setCheckedNewWordIds] = useState<Set<number>>(new Set());
  const [localWordStates, setLocalWordStates] = useState<Record<number, string>>({});
  const [currentLevelTab, setCurrentLevelTab] = useState<'N5' | 'N4' | 'Conversational'>('N5');
  const [starterDeckData, setStarterDeckData] = useState<any[]>([]);

  const [hasLoaded, setHasLoaded] = useState(false);
  const { state: jState, setUiMode, setChatLevel, resetProgress } = useJapanification();
  const { resetUiProgress } = useJpUI();

  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [activeProfileId, setActiveProfileIdState] = useState<string>('default');
  const [newProfileName, setNewProfileName] = useState<string>('');
  const [showAddProfile, setShowAddProfile] = useState<boolean>(false);
  const [inProgressSessions, setInProgressSessions] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'profile' | 'anki' | 'cloud'>('anki');

  useEffect(() => {
    const checkHash = () => {
      if (window.location.hash === '#profile') {
        setActiveTab('profile');
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  useEffect(() => {
    setProfiles(getProfilesList());
    setActiveProfileIdState(getActiveProfileId());
  }, []);

  const handleSwitchProfile = (profileId: string) => {
    setActiveProfileId(profileId);
    setActiveProfileIdState(profileId);
    window.location.reload();
  };

  const handleCreateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;
    const cleanName = newProfileName.trim();
    const generatedId = 'prof_' + Date.now();
    createProfile(generatedId, cleanName);
    setProfiles(getProfilesList());
    setNewProfileName('');
    setShowAddProfile(false);
    handleSwitchProfile(generatedId);
  };

  const handleDeleteProfile = (profileId: string, profileName: string) => {
    if (profileId === 'default') return;
    if (window.confirm(`Вы уверены, что хотите удалить профиль "${profileName}" и все его данные? Это действие необратимо.`)) {
      deleteProfile(profileId);
      const list = getProfilesList();
      setProfiles(list);
      if (activeProfileId === profileId) {
        handleSwitchProfile('default');
      }
    }
  };

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
          setError('Колода не инициализирована или пуста. Пройдите оценку знаний.');
        } else {
          setError('Список слов пуст. Импортируйте слова.');
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
        setSessions(data.sessions || []);
        
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

  // Начать конкретную сессию
  const startSession = (session: any) => {
    setProfileItem('active_session', JSON.stringify(session));
    router.push('/chat');
  };

  // Настройка стандартной колоды YomuMogu в Anki
  const setupStandardDeck = async () => {
    setIsLoadingDecks(true);
    try {
      const res = await fetch('/api/anki/setup-deck', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deckName: 'YomuMogu',
          modelName: 'YomuMoguModel',
        }),
      });
      if (res.ok) {
        setSelectedDeck('YomuMogu');
        setFrontField('Word');
        setBackField('Meaning');
        // Загружаем список колод заново, чтобы увидеть новую колоду в списке
        await loadDecks();
      } else {
        const data = await res.json();
        setError(data.error || 'Не удалось автоматически настроить колоду YomuMogu');
      }
    } catch (err) {
      setError('Ошибка при автоматическом создании стандартной колоды YomuMogu.');
    } finally {
      setIsLoadingDecks(false);
    }
  };

  // Проверить подключение к Anki
  const checkConnection = async () => {
    setIsLoadingConnection(true);
    setError(null);
    try {
      const res = await fetch('/api/anki/connect');
      const data = await res.json();
      if (data.connected) {
        setIsConnected(true);
        await loadDecks();
        
        const savedMode = getProfileItem('deck_mode') || deckMode;
        if (savedMode === 'standard') {
          await setupStandardDeck();
        }
      } else {
        setIsConnected(false);
        setError(data.error || 'Не удалось подключиться к AnkiConnect');
      }
    } catch (err) {
      setIsConnected(false);
      setError('Anki не запущен. Пожалуйста, запустите Anki с установленным плагином AnkiConnect.');
    } finally {
      setIsLoadingConnection(false);
    }
  };

  // Загрузить список колод
  const loadDecks = async () => {
    setIsLoadingDecks(true);
    try {
      const resDecks = await fetch('/api/anki/decks');
      if (resDecks.ok) {
        const data = await resDecks.json();
        setDecks(data.decks || []);
        if (data.decks && data.decks.length > 0) {
          // Выберем все колоды по умолчанию, если ничего не выбрано
          if (!selectedDeck) {
            setSelectedDeck('__all__');
          }
        }
      } else {
        const data = await resDecks.json();
        setError(data.error || 'Ошибка загрузки колод');
      }
    } catch (err) {
      setError('Не удалось получить список колод из Anki');
    } finally {
      setIsLoadingDecks(false);
    }
  };

  // Загрузить слова из колоды
  const loadWords = async () => {
    if (deckMode === 'local') {
      setIsLoadingWords(true);
      setError(null);
      setWordLoadSuccess(false);
      try {
        const localWords = await db.words
          .where('profileId')
          .equals(activeProfileId)
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
      } catch (err) {
        setError('Не удалось загрузить локальные слова');
      } finally {
        setIsLoadingWords(false);
      }
      return;
    }

    if (!selectedDeck) return;
    setIsLoadingWords(true);
    setError(null);
    setWordLoadSuccess(false);
    try {
      let url = `/api/anki/words?deck=${encodeURIComponent(selectedDeck)}&frontField=${encodeURIComponent(frontField)}&backField=${encodeURIComponent(backField)}`;
      if (Object.keys(deckMappings).length > 0) {
        url += `&mappings=${encodeURIComponent(JSON.stringify(deckMappings))}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setWords(data.words || []);
        setWordLoadSuccess(true);
      } else {
        setError(data.error || 'Ошибка загрузки слов');
      }
    } catch (err) {
      setError('Не удалось загрузить слова');
    } finally {
      setIsLoadingWords(false);
    }
  };

  // Проверяем подключение при первой загрузке страницы
  useEffect(() => {
    checkConnection();
  }, []);

  // Загружаем данные профиля из localStorage при монтировании
  useEffect(() => {
    try {
      const savedDeck = getProfileItem('selected_deck');
      if (savedDeck) setSelectedDeck(savedDeck);
      
      const savedFront = getProfileItem('front_field');
      if (savedFront) setFrontField(savedFront);
      
      const savedBack = getProfileItem('back_field');
      if (savedBack) setBackField(savedBack);

      const savedAudio = getProfileItem('audio_field');
      if (savedAudio) setAudioField(savedAudio);

      const savedImage = getProfileItem('image_field');
      if (savedImage) setImageField(savedImage);

      const savedMode = getProfileItem('deck_mode');
      if (savedMode) setDeckMode(savedMode as 'standard' | 'custom' | 'local');
      
      const savedWords = getProfileItem('words');
      if (savedWords) setWords(JSON.parse(savedWords));
      
      const savedSessions = getProfileItem('sessions');
      if (savedSessions) setSessions(JSON.parse(savedSessions));

      const savedQuotaPreset = getProfileItem('quota_preset');
      if (savedQuotaPreset) {
        setQuotaPreset(savedQuotaPreset as 'easy' | 'standard' | 'hard' | 'custom');
      }

      const savedQuotaLimit = getProfileItem('daily_new_words_limit');
      if (savedQuotaLimit) {
        const parsed = parseInt(savedQuotaLimit, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 50) {
          setCustomQuotaLimit(parsed);
        }
      }

      const savedMappings = getProfileItem('deck_mappings');
      if (savedMappings) {
        try {
          setDeckMappings(JSON.parse(savedMappings));
        } catch (e) {
          console.error('Failed to parse deck mappings', e);
        }
      }
    } catch (e) {
      console.error('Failed to load profile data', e);
    } finally {
      setHasLoaded(true);
    }
  }, []);

  // Сохраняем данные при изменении
  useEffect(() => {
    if (!hasLoaded) return;
    setProfileItem('deck_mappings', JSON.stringify(deckMappings));
  }, [deckMappings, hasLoaded]);

  useEffect(() => {
    if (!hasLoaded) return;
    setProfileItem('selected_deck', selectedDeck);
  }, [selectedDeck, hasLoaded]);

  useEffect(() => {
    if (!hasLoaded) return;
    setProfileItem('front_field', frontField);
  }, [frontField, hasLoaded]);

  useEffect(() => {
    if (!hasLoaded) return;
    setProfileItem('back_field', backField);
  }, [backField, hasLoaded]);

  useEffect(() => {
    if (!hasLoaded) return;
    setProfileItem('audio_field', audioField);
  }, [audioField, hasLoaded]);

  useEffect(() => {
    if (!hasLoaded) return;
    setProfileItem('image_field', imageField);
  }, [imageField, hasLoaded]);

  useEffect(() => {
    if (!hasLoaded) return;
    setProfileItem('quota_preset', quotaPreset);
  }, [quotaPreset, hasLoaded]);

  useEffect(() => {
    if (!hasLoaded) return;
    setProfileItem('daily_new_words_limit', customQuotaLimit.toString());
  }, [customQuotaLimit, hasLoaded]);

  // Проверяем статус инициализации локальной колоды
  const checkLocalDeckStatus = async () => {
    if (!activeProfileId) return;
    const initialized = await isLocalDeckInitialized(activeProfileId);
    setIsLocalInitialized(initialized);
    if (initialized) {
      setDailyNewWordsCount(getDailyNewWordsCount(activeProfileId));
    }
  };

  useEffect(() => {
    if (hasLoaded) {
      checkLocalDeckStatus();
    }
  }, [activeProfileId, hasLoaded]);

  useEffect(() => {
    if (!hasLoaded) return;
    const isAnkiEnabled = process.env.NEXT_PUBLIC_ANKI_ENABLED === 'true';
    if (!isAnkiEnabled && deckMode !== 'local') {
      setDeckMode('local');
      return;
    }
    
    setProfileItem('deck_mode', deckMode);

    if (deckMode === 'standard' && isConnected) {
      setupStandardDeck();
    }
    loadWords();
    checkLocalDeckStatus();
  }, [deckMode, hasLoaded, isConnected]);

  // Ленивая загрузка данных стартовой колоды для диагностического модального окна
  useEffect(() => {
    if (isAssessmentOpen && starterDeckData.length === 0) {
      import('@/resources/starter_deck.json').then((module) => {
        setStarterDeckData(module.default);
      });
    }
  }, [isAssessmentOpen, starterDeckData.length]);

  // Функции для диагностического модального окна
  const openAssessmentModal = async () => {
    try {
      const existingWords = await db.words
        .where('profileId')
        .equals(activeProfileId)
        .filter(w => w.deckName === LOCAL_DECK_NAME)
        .toArray();

      const states: Record<number, string> = {};
      const checkedIds = new Set<number>();

      existingWords.forEach(w => {
        states[w.id] = w.status;
        if (w.status === 'mature') {
          checkedIds.add(w.id);
        }
      });

      setLocalWordStates(states);
      setCheckedNewWordIds(checkedIds);
      setIsAssessmentOpen(true);
    } catch (err) {
      setError('Не удалось загрузить статус слов для диагностики');
    }
  };

  const handleToggleWord = (wordId: number) => {
    const status = localWordStates[wordId];
    if (status && status !== 'new') return; // защищаем прогресс (learning, review, mature в БД)

    setCheckedNewWordIds(prev => {
      const next = new Set(prev);
      if (next.has(wordId)) {
        next.delete(wordId);
      } else {
        next.add(wordId);
      }
      return next;
    });
  };

  const handleSelectAllForTab = () => {
    const tabWords = starterDeckData.filter(w => w.level === currentLevelTab);
    setCheckedNewWordIds(prev => {
      const next = new Set(prev);
      tabWords.forEach(w => {
        const status = localWordStates[w.id];
        if (!status || status === 'new') {
          next.add(w.id);
        }
      });
      return next;
    });
  };

  const handleDeselectAllForTab = () => {
    const tabWords = starterDeckData.filter(w => w.level === currentLevelTab);
    setCheckedNewWordIds(prev => {
      const next = new Set(prev);
      tabWords.forEach(w => {
        const status = localWordStates[w.id];
        if (!status || status === 'new') {
          next.delete(w.id);
        }
      });
      return next;
    });
  };

  const handleSaveAssessment = async () => {
    setIsLoadingWords(true);
    try {
      await importStarterDeck(activeProfileId, checkedNewWordIds);
      setIsLocalInitialized(true);
      setIsAssessmentOpen(false);
      await loadWords();
      setDailyNewWordsCount(getDailyNewWordsCount(activeProfileId));
    } catch (err) {
      setError('Не удалось сохранить результаты диагностики');
    } finally {
      setIsLoadingWords(false);
    }
  };

  useEffect(() => {
    if (!hasLoaded) return;
    setProfileItem('words', JSON.stringify(words));
  }, [words, hasLoaded]);

  useEffect(() => {
    if (!hasLoaded) return;
    setProfileItem('sessions', JSON.stringify(sessions));
  }, [sessions, hasLoaded]);

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
        // Ошибка чтения или парсинга состояния сессии
      }
    });
    setInProgressSessions(inProgress);
  }, [sessions, activeProfileId, hasLoaded]);

  const handleResetProgress = async () => {
    if (window.confirm('Вы уверены, что хотите сбросить весь прогресс, настройки и импортированные слова?')) {
      resetProgress();
      await resetUiProgress();
      setWords([]);
      setSessions([]);
      setSelectedDeck('__all__');
      setFrontField('Front');
      setBackField('Back');
      removeProfileItem('selected_deck');
      removeProfileItem('front_field');
      removeProfileItem('back_field');
      removeProfileItem('words');
      removeProfileItem('sessions');
      removeProfileItem('active_session');
      removeProfileItem('deck_mappings');
      setDeckMappings({});
    }
  };

  const handleResetUiProgress = async () => {
    if (window.confirm('Вы уверены, что хотите сбросить прогресс перевода интерфейса? Все выученные элементы интерфейса вернутся на русский, а их FSRS параметры будут сброшены.')) {
      await resetUiProgress();
      alert('Прогресс перевода элементов интерфейса успешно сброшен!');
    }
  };

  const handleDiscardSessionInSettings = (sessionId: string) => {
    if (window.confirm('Вы действительно хотите сбросить прогресс этой сессии диалога? Весь несинхронизированный прогресс будет потерян.')) {
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


  // Статистика слов
  const stats = {
    total: words.length,
    new: words.filter(w => w.status === 'new').length,
    learning: words.filter(w => w.status === 'learning').length,
    review: words.filter(w => w.status === 'review').length,
    mature: words.filter(w => w.status === 'mature').length,
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
        <h1 className={styles.title}>Настройки</h1>
        
        {/* Вкладки навигации */}
        <div className={styles.tabBar}>
          <button
            onClick={() => setActiveTab('profile')}
            className={`${styles.tabBtn} ${activeTab === 'profile' ? styles.tabBtnActive : ''}`}
          >
            <User size={18} />
            <span>Профиль</span>
          </button>
          <button
            onClick={() => setActiveTab('anki')}
            className={`${styles.tabBtn} ${activeTab === 'anki' ? styles.tabBtnActive : ''}`}
          >
            <BookOpen size={18} />
            <span>Импорт & Anki</span>
          </button>
          <button
            onClick={() => setActiveTab('cloud')}
            className={`${styles.tabBtn} ${activeTab === 'cloud' ? styles.tabBtnActive : ''}`}
          >
            <Zap size={18} />
            <span>Облако</span>
          </button>
        </div>

        {/* Содержимое вкладок */}
        <div className={styles.tabContent}>
          {activeTab === 'profile' && (
            <div className={styles.tabPanel} style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px', width: '100%' }}>
              {/* Карточка профиля */}
              <div className={styles.profileCard}>
                <div className={styles.profileHeader}>
                  <div className={styles.profileAvatar}>
                    <User size={24} />
                  </div>
                  <div className={styles.profileTitleInfo}>
                    <h3>{profiles.find(p => p.id === activeProfileId)?.name || 'Мой профиль'}</h3>
                    <p>Активный профиль: {activeProfileId}</p>
                  </div>
                </div>

                {/* Управление профилями */}
                <div className={styles.profileSelectorGroup}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label className={styles.profileSelectLabel}>Выбор профиля</label>
                    <button 
                      type="button" 
                      onClick={() => setShowAddProfile(!showAddProfile)} 
                      className="btn-3d"
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                    >
                      {showAddProfile ? 'Отмена' : '+ Создать'}
                    </button>
                  </div>

                  {!showAddProfile ? (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select
                        className="input-friendly"
                        value={activeProfileId}
                        onChange={(e) => handleSwitchProfile(e.target.value)}
                        style={{ flex: 1, padding: '8px 12px', fontSize: '14px' }}
                      >
                        {profiles.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.id === 'default' ? '(Основной)' : ''}
                          </option>
                        ))}
                      </select>
                      {activeProfileId !== 'default' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteProfile(activeProfileId, profiles.find(p => p.id === activeProfileId)?.name || '')}
                          className="btn-3d btn-red"
                          style={{ padding: '8px 12px', minWidth: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Удалить этот профиль"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <form onSubmit={handleCreateProfile} style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        className="input-friendly"
                        value={newProfileName}
                        onChange={(e) => setNewProfileName(e.target.value)}
                        placeholder="Имя нового профиля"
                        style={{ flex: 1, padding: '8px 12px', fontSize: '14px' }}
                        required
                      />
                      <button
                        type="submit"
                        className="btn-3d btn-green"
                        style={{ padding: '8px 16px', fontSize: '13px' }}
                      >
                        ОК
                      </button>
                    </form>
                  )}
                </div>

                <div className={styles.profileStats}>
                  <div className={styles.profileStatRow}>
                    <span className={styles.profileStatLabel}>
                      <Trophy size={16} style={{ color: 'var(--color-blue)' }} /> Режим интерфейса:
                    </span>
                    <span className={styles.profileStatValue}>
                      {jState.uiMode === 'ru' && 'Русский'}
                      {jState.uiMode === 'smart' && 'Smart'}
                      {jState.uiMode === 'ja' && '日本語'}
                    </span>
                  </div>
                  <div className={styles.profileStatRow}>
                    <span className={styles.profileStatLabel}>
                      <Zap size={16} style={{ color: 'var(--color-yellow-shadow)' }} /> Очки опыта (XP):
                    </span>
                    <span className={styles.profileStatValue}>{jState.points} XP</span>
                  </div>
                  <div className={styles.profileStatRow}>
                    <span className={styles.profileStatLabel}>
                      <BookOpen size={16} style={{ color: 'var(--color-green-shadow)' }} /> Использовано слов:
                    </span>
                    <span className={styles.profileStatValue}>{jState.totalWordsUsed}</span>
                  </div>
                  <div className={styles.profileStatRow}>
                    <span className={styles.profileStatLabel}>
                      <BarChart2 size={16} style={{ color: 'var(--color-blue-shadow)' }} /> Пройдено сессий:
                    </span>
                    <span className={styles.profileStatValue}>{jState.sessionsCompleted}</span>
                  </div>
                </div>

                {/* Выбор режима японизации */}
                <div className={styles.speedSelectorGroup}>
                  <label>Язык интерфейса</label>
                  <div className={styles.speedButtons}>
                    {(['ru', 'smart', 'ja'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setUiMode(mode)}
                        className={`btn-3d ${jState.uiMode === mode ? 'btn-blue' : ''} ${styles.speedButton}`}
                      >
                        {mode === 'ru' ? 'Русский' : mode === 'smart' ? 'Smart' : '日本語'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Сложность японского в чате */}
                <div className={styles.chatLevelSelectorGroup}>
                  <label>Сложность японского в чате</label>
                  <div className={styles.chatLevelSelector}>
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setChatLevel(lvl)}
                        className={`btn-3d ${jState.chatLevel === lvl ? 'btn-green' : ''} ${styles.levelBtn}`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                  <div className={styles.chatLevelDescription}>
                    <div className={styles.levelDescTitle}>
                      {jState.chatLevel === 1 && 'Уровень 1: Детский'}
                      {jState.chatLevel === 2 && 'Уровень 2: Элементарный'}
                      {jState.chatLevel === 3 && 'Уровень 3: Разговорный'}
                      {jState.chatLevel === 4 && 'Уровень 4: Продвинутый'}
                      {jState.chatLevel === 5 && 'Уровень 5: Свободный'}
                    </div>
                    <div className={styles.levelDescText}>
                      {jState.chatLevel === 1 && 'Сверхпростые короткие фразы, много хираганы. ИИ пишет фуригану для ВСЕХ кандзи через <ruby>.'}
                      {jState.chatLevel === 2 && 'Простые предложения, базовая грамматика. ИИ пишет фуригану для ВСЕХ кандзи.'}
                      {jState.chatLevel === 3 && 'Повседневный японский. ИИ пишет фуригану только для сложных кандзи (уровня N3 и выше).'}
                      {jState.chatLevel === 4 && 'Развернутые сложные предложения, без фуриганы. Полноценная речь.'}
                      {jState.chatLevel === 5 && 'Естественная беглая речь носителя языка, без фуриганы. Максимальная сложность.'}
                    </div>
                  </div>
                </div>

                {/* Дневная норма новых слов */}
                <div className={styles.quotaSelectorGroup}>
                  <label>Дневной лимит новых слов</label>
                  <div className={styles.quotaButtons}>
                    {(['easy', 'standard', 'hard', 'custom'] as const).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setQuotaPreset(preset)}
                        className={`btn-3d ${quotaPreset === preset ? 'btn-green' : ''} ${styles.quotaButton}`}
                      >
                        {preset === 'easy' && 'Мало (5)'}
                        {preset === 'standard' && 'Стандарт (10)'}
                        {preset === 'hard' && 'Много (20)'}
                        {preset === 'custom' && 'Вручную'}
                      </button>
                    ))}
                  </div>

                  {quotaPreset === 'custom' && (
                    <div className={styles.customQuotaInputWrapper}>
                      <span>Укажите лимит:</span>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={customQuotaLimit}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) {
                            const clamped = Math.max(1, Math.min(50, val));
                            setCustomQuotaLimit(clamped);
                          } else {
                            setCustomQuotaLimit(1);
                          }
                        }}
                        className={styles.customQuotaInput}
                      />
                      <span style={{ fontSize: '12px', fontWeight: 'normal' }}>(от 1 до 50)</span>
                    </div>
                  )}
                </div>

                <div className={styles.resetBtnContainer} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={handleResetUiProgress}
                    className="btn-3d btn-orange"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <Trash2 size={16} /> Сбросить FSRS интерфейса
                  </button>
                  <button
                    type="button"
                    onClick={handleResetProgress}
                    className="btn-3d btn-red"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <Trash2 size={16} /> Сбросить весь прогресс
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'anki' && (
            <div className={styles.tabPanel} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div className={styles.grid}>
                {/* Левая колонка: Настройки подключения */}
                <div className="card-friendly" style={{ width: '100%' }}>
                  <h2 className={styles.cardTitle}>
                    <SettingsIcon size={20} /> Источник слов и режим обучения
                  </h2>

                  {/* Переключатель режима колоды */}
                  <div className={styles.modeSelector}>
                    {process.env.NEXT_PUBLIC_ANKI_ENABLED === 'true' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setDeckMode('standard')}
                          className={`btn-3d ${deckMode === 'standard' ? 'btn-blue' : ''} ${styles.modeButton}`}
                        >
                          Стандартная Anki
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeckMode('custom')}
                          className={`btn-3d ${deckMode === 'custom' ? 'btn-blue' : ''} ${styles.modeButton}`}
                        >
                          Своя Anki
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeckMode('local')}
                      className={`btn-3d ${deckMode === 'local' ? 'btn-blue' : ''} ${styles.modeButton}`}
                    >
                      Локальная колода
                    </button>
                  </div>

                  {deckMode === 'local' ? (
                    <div className={styles.form}>
                      <div className={styles.infoCard}>
                        <strong>Локальный автономный режим.</strong> Изучение встроенного стартового списка из 500 японских слов офлайн через IndexedDB.
                        <br />• Диагностика начальных знаний
                        <br />• Интервальное повторение (FSRS)
                        <br />• Дневной лимит новых слов: {getDailyNewWordsLimit(activeProfileId)}
                      </div>

                      <div className={styles.statusBox}>
                        <span className={styles.statusLabel}>Статус:</span>
                        {isLocalInitialized ? (
                          <span className={`${styles.statusValue} ${styles.connected}`}>
                            <CheckCircle size={16} /> Инициализирована
                          </span>
                        ) : (
                          <span className={`${styles.statusValue} ${styles.disconnected}`}>
                            <XCircle size={16} /> Требуется диагностика
                          </span>
                        )}
                        
                        <button
                          onClick={openAssessmentModal}
                          className="btn-3d btn-green"
                          style={{ padding: '6px 12px', fontSize: '13px', marginLeft: 'auto' }}
                        >
                          {isLocalInitialized ? 'Редактировать' : 'Пройти диагностику'}
                        </button>
                      </div>

                      {isLocalInitialized && (
                        <div className={styles.statusBox} style={{ marginTop: 0 }}>
                          <span className={styles.statusLabel}>Новых слов сегодня:</span>
                          <span className={styles.statusValue} style={{ color: 'var(--color-blue)' }}>
                            {dailyNewWordsCount} / {getDailyNewWordsLimit(activeProfileId)}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className={styles.statusBox}>
                        <span className={styles.statusLabel}>Статус:</span>
                        {isConnected === null ? (
                          <span className={styles.statusValue}>Проверка...</span>
                        ) : isConnected ? (
                          <span className={`${styles.statusValue} ${styles.connected}`}>
                            <CheckCircle size={16} /> Подключено
                          </span>
                        ) : (
                          <span className={`${styles.statusValue} ${styles.disconnected}`}>
                            <XCircle size={16} /> Нет связи
                          </span>
                        )}
                        
                        <button 
                          onClick={checkConnection} 
                          disabled={isLoadingConnection}
                          className="btn-3d" 
                          style={{ padding: '6px 12px', minWidth: '40px', display: 'inline-flex', marginLeft: 'auto' }}
                          title="Переподключиться"
                        >
                          <RefreshCw size={14} className={isLoadingConnection ? styles.spin : ''} />
                        </button>
                      </div>

                      {error && (
                        <div className={styles.errorAlert}>
                          <AlertCircle size={18} />
                          <p>{error}</p>
                        </div>
                      )}

                      {isConnected && (
                        <div className={styles.form}>
                          {deckMode === 'standard' ? (
                            <div>
                              <div className={styles.infoCard}>
                                Будет автоматически создана колода <span className={styles.infoCardStrong}>YomuMogu</span> с оптимальным шаблоном карточек и преднастроенными полями: 
                                <br />• <strong>Word</strong> (Кандзи/слово)
                                <br />• <strong>Furigana</strong> (Чтение слов)
                                <br />• <strong>Meaning</strong> (Перевод)
                                <br />• <strong>Audio</strong> (Озвучка от ИИ)
                                <br />• <strong>Image</strong> (Иллюстрации)
                                <br />• <strong>Context</strong> (Контекстное предложение)
                              </div>
                              
                              <button
                                onClick={async () => {
                                  await setupStandardDeck();
                                  await loadWords();
                                }}
                                disabled={isLoadingDecks || isLoadingWords}
                                className="btn-3d btn-green"
                                style={{ width: '100%' }}
                              >
                                {isLoadingWords ? 'Загрузка слов...' : 'Настроить и импортировать слова'}
                              </button>
                            </div>
                          ) : (
                            <div>
                              {/* Своя колода - Field Mapper UI */}
                              <div className={styles.formGroup} style={{ marginBottom: '16px' }}>
                                <label htmlFor="deck-select">Выберите колоду Anki</label>
                                {isLoadingDecks ? (
                                  <div className={styles.loadingText}>Загрузка колод...</div>
                                ) : (
                                  <select
                                    id="deck-select"
                                    className="input-friendly"
                                    value={selectedDeck}
                                    onChange={(e) => handleDeckChange(e.target.value)}
                                  >
                                    <option value="__all__">Все колоды (совместно)</option>
                                    {decks.map((deck) => (
                                      <option key={deck} value={deck}>
                                        {deck}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>

                              <div className={styles.formRow} style={{ marginBottom: '16px' }}>
                                <div className={styles.formGroup}>
                                  <label htmlFor="field-front">Поле слова (Японский)</label>
                                  <input
                                    id="field-front"
                                    type="text"
                                    className="input-friendly"
                                    value={frontField}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setFrontField(val);
                                      if (selectedDeck !== '__all__') {
                                        setDeckMappings(prev => ({
                                          ...prev,
                                          [selectedDeck]: {
                                            frontField: val,
                                            backField: prev[selectedDeck]?.backField || backField,
                                            audioField: prev[selectedDeck]?.audioField || audioField,
                                            imageField: prev[selectedDeck]?.imageField || imageField,
                                          }
                                        }));
                                      }
                                    }}
                                    placeholder="Front"
                                  />
                                </div>
                                <div className={styles.formGroup}>
                                  <label htmlFor="field-back">Поле перевода (Русский)</label>
                                  <input
                                    id="field-back"
                                    type="text"
                                    className="input-friendly"
                                    value={backField}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setBackField(val);
                                      if (selectedDeck !== '__all__') {
                                        setDeckMappings(prev => ({
                                          ...prev,
                                          [selectedDeck]: {
                                            frontField: prev[selectedDeck]?.frontField || frontField,
                                            backField: val,
                                            audioField: prev[selectedDeck]?.audioField || audioField,
                                            imageField: prev[selectedDeck]?.imageField || imageField,
                                          }
                                        }));
                                      }
                                    }}
                                    placeholder="Back"
                                  />
                                </div>
                              </div>

                              <div className={styles.formRow} style={{ marginBottom: '16px' }}>
                                <div className={styles.formGroup}>
                                  <label htmlFor="field-audio">Поле аудио (Опционально)</label>
                                  <input
                                    id="field-audio"
                                    type="text"
                                    className="input-friendly"
                                    value={audioField}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setAudioField(val);
                                      if (selectedDeck !== '__all__') {
                                        setDeckMappings(prev => ({
                                          ...prev,
                                          [selectedDeck]: {
                                            frontField: prev[selectedDeck]?.frontField || frontField,
                                            backField: prev[selectedDeck]?.backField || backField,
                                            audioField: val,
                                            imageField: prev[selectedDeck]?.imageField || imageField,
                                          }
                                        }));
                                      }
                                    }}
                                    placeholder="Audio (или пусто)"
                                  />
                                </div>
                                <div className={styles.formGroup}>
                                  <label htmlFor="field-image">Поле изображения (Опционально)</label>
                                  <input
                                    id="field-image"
                                    type="text"
                                    className="input-friendly"
                                    value={imageField}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setImageField(val);
                                      if (selectedDeck !== '__all__') {
                                        setDeckMappings(prev => ({
                                          ...prev,
                                          [selectedDeck]: {
                                            frontField: prev[selectedDeck]?.frontField || frontField,
                                            backField: prev[selectedDeck]?.backField || backField,
                                            audioField: prev[selectedDeck]?.audioField || audioField,
                                            imageField: val,
                                          }
                                        }));
                                      }
                                    }}
                                    placeholder="Image (или пусто)"
                                  />
                                </div>
                              </div>

                              <button
                                onClick={loadWords}
                                disabled={isLoadingWords || !selectedDeck}
                                className="btn-3d btn-green"
                                style={{ width: '100%', marginTop: '12px' }}
                              >
                                {isLoadingWords ? 'Загрузка слов...' : 'Импортировать слова'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Правая колонка: Статистика и список слов */}
                <div className="card-friendly">
                  <h2 className={styles.cardTitle}>
                    <BookOpen size={20} /> Импортированные слова
                  </h2>

                  {words.length === 0 ? (
                    <div className={styles.emptyState}>
                      <BookOpen size={48} className={styles.emptyIcon} />
                      {deckMode === 'local' ? (
                        <>
                          <p>Слова еще не загружены. Пожалуйста, пройдите диагностику знаний для инициализации локальной колоды.</p>
                          <button
                            onClick={openAssessmentModal}
                            className="btn-3d btn-green"
                            style={{ marginTop: '12px', padding: '8px 16px', fontSize: '14px' }}
                          >
                            Пройти диагностику
                          </button>
                        </>
                      ) : (
                        <p>Слова еще не загружены. Выберите колоду и нажмите кнопку «Импортировать слова».</p>
                      )}
                    </div>
                  ) : (
                    <div className={styles.wordListContainer}>
                      {wordLoadSuccess && (
                        <div className={styles.successAlert}>
                          Успешно загружено карточек: {words.length}
                        </div>
                      )}
                      
                      {/* Панель статистики */}
                      <div className={styles.statsGrid}>
                        <div className={styles.statCard}>
                          <span className={styles.statNum}>{stats.total}</span>
                          <span className={styles.statLabel}>Всего</span>
                        </div>
                        <div className={styles.statCard}>
                          <span className={`${styles.statNum} ${styles.statNew}`}>{stats.new}</span>
                          <span className={styles.statLabel}>Новые</span>
                        </div>
                        <div className={styles.statCard}>
                          <span className={`${styles.statNum} ${styles.statLearning}`}>{stats.learning}</span>
                          <span className={styles.statLabel}>Изучаемые</span>
                        </div>
                        <div className={styles.statCard}>
                          <span className={`${styles.statNum} ${styles.statReview}`}>{stats.review}</span>
                          <span className={styles.statLabel}>Повторение</span>
                        </div>
                        <div className={styles.statCard}>
                          <span className={`${styles.statNum} ${styles.statMature}`}>{stats.mature}</span>
                          <span className={styles.statLabel}>Изученные</span>
                        </div>
                      </div>

                      {/* Генерация сессий с Gemini */}
                      <div className={styles.sessionSection}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                          <h3 className={styles.sessionSectionTitle}>
                            <Sparkles size={20} style={{ color: 'var(--color-blue)' }} /> Разговорные сессии с Gemini ИИ
                          </h3>
                          {sessions.length === 0 && (
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
                          <div className={styles.loadingText} style={{ padding: '32px' }}>
                            <RefreshCw size={24} className={`${styles.spin}`} style={{ margin: '0 auto 12px auto', color: 'var(--color-blue)', display: 'block' }} />
                            <p style={{ margin: 0, fontWeight: 700 }}>ИИ анализирует ваши слова и подбирает лучшие сценарии...</p>
                          </div>
                        )}

                        {sessions.length > 0 && (
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
                                      onClick={() => handleDiscardSessionInSettings(session.id)}
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
                        )}

                        {sessions.length > 0 && (
                          <button
                            onClick={generateSessions}
                            disabled={isLoadingSessions}
                            className="btn-3d"
                            style={{ padding: '8px 16px', fontSize: '14px', alignSelf: 'center' }}
                          >
                            {isLoadingSessions ? 'Обновление...' : 'Перегенерировать другие темы'}
                          </button>
                        )}
                      </div>

                      {/* Таблица слов */}
                      <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Слово (Японский)</th>
                              <th>Перевод</th>
                              <th>Интервал (дней)</th>
                              <th>Статус</th>
                            </tr>
                          </thead>
                          <tbody>
                            {words.slice(0, 100).map((word) => (
                              <tr key={word.id}>
                                <td className={styles.wordCell}>{word.word}</td>
                                <td className={styles.translationCell}>{word.translation}</td>
                                <td>{word.interval} дн.</td>
                                <td>
                                  {word.status === 'new' && <span className="badge-status badge-new">Новое</span>}
                                  {word.status === 'learning' && <span className="badge-status badge-learning">Изучение</span>}
                                  {word.status === 'review' && <span className="badge-status badge-review">Повторение</span>}
                                  {word.status === 'mature' && <span className="badge-status badge-mature">Изучено</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {words.length > 100 && (
                          <div className={styles.limitText}>
                            Показано первых 100 слов из {words.length}. Все слова будут доступны в сессиях Gemini.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cloud' && (
            <div className={styles.tabPanel} style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
              <div className="card-friendly" style={{ 
                padding: '40px', 
                textAlign: 'center', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                gap: '20px',
                background: 'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%)',
                borderColor: 'var(--color-blue)',
                boxShadow: '0 8px 0 var(--border-color)'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-blue)',
                  border: 'var(--border-width) solid var(--border-color)',
                  marginBottom: '10px'
                }}>
                  <Zap size={40} className={styles.spin} style={{ animationDuration: '3s' }} />
                </div>
                <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Синхронизация с облаком
                </h2>
                <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '400px', margin: 0, fontWeight: 600 }}>
                  В будущем вы сможете сохранять свой прогресс в облаке, синхронизировать его между устройствами и делиться им со своими друзьями.
                </p>
                <div style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 800,
                  color: 'var(--color-blue-shadow)',
                  textTransform: 'uppercase',
                  border: '1px solid var(--border-color)'
                }}>
                  В разработке
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {isAssessmentOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>Диагностика знаний</h2>
              <button
                type="button"
                onClick={() => setIsAssessmentOpen(false)}
                className="btn-3d btn-red"
                style={{ padding: '6px 12px', fontSize: '13px' }}
              >
                Закрыть
              </button>
            </div>

            <div className={styles.modalBody}>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Отметьте слова, которые вы уже хорошо знаете. Они получат статус «Изучено» (mature) и будут отложены. 
                Остальные слова будут появляться как новые карточки.
              </p>

              <div className={styles.tabsContainer}>
                {(['N5', 'N4', 'Conversational'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setCurrentLevelTab(lvl)}
                    className={`${styles.tabButton} ${currentLevelTab === lvl ? styles.tabButtonActive : ''}`}
                  >
                    {lvl === 'Conversational' ? 'Разговорный слой' : lvl}
                  </button>
                ))}
              </div>

              {starterDeckData.length === 0 ? (
                <div className={styles.loadingText}>Загрузка стартовой колоды...</div>
              ) : (
                <>
                  <div className={styles.modalControls}>
                    <button
                      type="button"
                      className="btn-3d btn-blue"
                      onClick={handleSelectAllForTab}
                      style={{ padding: '6px 12px', fontSize: '13px' }}
                    >
                      Выбрать все в {currentLevelTab === 'Conversational' ? 'разговорных' : currentLevelTab}
                    </button>
                    <button
                      type="button"
                      className="btn-3d"
                      onClick={handleDeselectAllForTab}
                      style={{ padding: '6px 12px', fontSize: '13px' }}
                    >
                      Снять все в {currentLevelTab === 'Conversational' ? 'разговорных' : currentLevelTab}
                    </button>
                  </div>

                  {['Существительные', 'Глаголы', 'Прилагательные', 'Выражения'].map((cat) => {
                    const catWords = starterDeckData.filter(
                      w => w.level === currentLevelTab && w.category === cat
                    );
                    if (catWords.length === 0) return null;

                    return (
                      <div key={cat} className={styles.categorySection}>
                        <div className={styles.categoryTitle}>{cat}</div>
                        <div className={styles.wordGrid}>
                          {catWords.map((w) => {
                            const isChecked = checkedNewWordIds.has(w.id);
                            const status = localWordStates[w.id];
                            const isDisabled = !!(status && status !== 'new');

                            return (
                              <div
                                key={w.id}
                                onClick={() => !isDisabled && handleToggleWord(w.id)}
                                className={`${styles.wordCard} ${
                                  isChecked ? styles.wordCardSelected : ''
                                } ${isDisabled ? styles.wordCardDisabled : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={isDisabled}
                                  onChange={() => handleToggleWord(w.id)}
                                  className={styles.wordCheckbox}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div className={styles.wordInfo}>
                                  <div className={styles.wordText} title={w.word}>
                                    {w.word}
                                  </div>
                                  <div className={styles.wordReading} title={w.reading}>
                                    {w.reading}
                                  </div>
                                  <div className={styles.wordTranslation} title={w.translation}>
                                    {w.translation}
                                  </div>
                                </div>
                                {status && status !== 'new' && (
                                  <span className={styles.progressBadge}>
                                    {status === 'mature' ? 'Изучено' : 'В работе'}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                onClick={() => setIsAssessmentOpen(false)}
                className="btn-3d"
                style={{ padding: '8px 16px', fontSize: '14px' }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSaveAssessment}
                disabled={starterDeckData.length === 0}
                className="btn-3d btn-green"
                style={{ padding: '8px 16px', fontSize: '14px' }}
              >
                Сохранить и начать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
