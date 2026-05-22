'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RefreshCw, CheckCircle, XCircle, BookOpen, Settings as SettingsIcon, AlertCircle, Sparkles, User, Trophy, Zap, BarChart2, Trash2 } from 'lucide-react';
import styles from './settings.module.css';
import { AnkiWord } from '@/lib/anki/filter';
import { useJapanification } from '@/hooks/useJapanification';
import { getProfileItem, setProfileItem, removeProfileItem, getProfilesList, setActiveProfileId, getActiveProfileId, createProfile, deleteProfile, ProfileInfo } from '@/lib/profile';

export default function SettingsPage() {
  const router = useRouter();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [decks, setDecks] = useState<string[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<string>('__all__');
  const [frontField, setFrontField] = useState<string>('Front');
  const [backField, setBackField] = useState<string>('Back');
  const [audioField, setAudioField] = useState<string>('');
  const [imageField, setImageField] = useState<string>('');
  const [deckMode, setDeckMode] = useState<'standard' | 'custom'>('standard');
  const [words, setWords] = useState<AnkiWord[]>([]);
  
  const [isLoadingConnection, setIsLoadingConnection] = useState<boolean>(false);
  const [isLoadingDecks, setIsLoadingDecks] = useState<boolean>(false);
  const [isLoadingWords, setIsLoadingWords] = useState<boolean>(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(false);
  
  const [error, setError] = useState<string | null>(null);
  const [wordLoadSuccess, setWordLoadSuccess] = useState<boolean>(false);
  const [sessions, setSessions] = useState<any[]>([]);

  const [hasLoaded, setHasLoaded] = useState(false);
  const { state: jState, setSpeed, setChatLevel, resetProgress } = useJapanification();

  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [activeProfileId, setActiveProfileIdState] = useState<string>('default');
  const [newProfileName, setNewProfileName] = useState<string>('');
  const [showAddProfile, setShowAddProfile] = useState<boolean>(false);
  const [inProgressSessions, setInProgressSessions] = useState<Set<string>>(new Set());

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
    if (words.length === 0) return;
    setIsLoadingSessions(true);
    setError(null);
    try {
      const response = await fetch('/api/gemini/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ words }),
      });
      const data = await response.json();
      if (response.ok) {
        setSessions(data.sessions || []);
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
    if (!selectedDeck) return;
    setIsLoadingWords(true);
    setError(null);
    setWordLoadSuccess(false);
    try {
      const url = `/api/anki/words?deck=${encodeURIComponent(selectedDeck)}&frontField=${encodeURIComponent(frontField)}&backField=${encodeURIComponent(backField)}`;
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
      if (savedMode) setDeckMode(savedMode as 'standard' | 'custom');
      
      const savedWords = getProfileItem('words');
      if (savedWords) setWords(JSON.parse(savedWords));
      
      const savedSessions = getProfileItem('sessions');
      if (savedSessions) setSessions(JSON.parse(savedSessions));
    } catch (e) {
      console.error('Failed to load profile data', e);
    } finally {
      setHasLoaded(true);
    }
  }, []);

  // Сохраняем данные при изменении
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
    setProfileItem('deck_mode', deckMode);

    if (deckMode === 'standard' && isConnected) {
      setupStandardDeck();
    }
  }, [deckMode, hasLoaded, isConnected]);

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

  const handleResetProgress = () => {
    if (window.confirm('Вы уверены, что хотите сбросить весь прогресс, настройки и импортированные слова?')) {
      resetProgress();
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
        <div className="logo-container">
          <BookOpen size={32} className="logo-text" />
          <span className="logo-text">YomuMogu <span className="logo-sub">Anki</span></span>
        </div>
        <div className={styles.navLinks}>
          <Link href="/chat" className="btn-3d btn-blue" style={{ padding: '8px 16px', fontSize: '14px' }}>
            В чат
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        <h1 className={styles.title}>Настройки интеграции с Anki</h1>
        
        <div className={styles.grid}>
          {/* Левая колонка: Профиль и Настройки подключения */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', width: '100%' }}>
            
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
                    <Trophy size={16} style={{ color: 'var(--color-blue)' }} /> Уровень прогресса:
                  </span>
                  <span className={styles.profileStatValue}>{jState.level} / 6</span>
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

              {/* Скорость японификации */}
              <div className={styles.speedSelectorGroup}>
                <label>Скорость японификации</label>
                <div className={styles.speedButtons}>
                  {(['slow', 'normal', 'fast'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSpeed(s)}
                      className={`btn-3d ${jState.speed === s ? 'btn-blue' : ''} ${styles.speedButton}`}
                    >
                      {s === 'slow' ? 'Медленно' : s === 'normal' ? 'Обычная' : 'Быстрая'}
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

              <div className={styles.resetBtnContainer}>
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

            {/* Настройки подключения */}
            <div className="card-friendly" style={{ width: '100%' }}>
              <h2 className={styles.cardTitle}>
                <SettingsIcon size={20} /> Подключение к Anki
              </h2>
              
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
                  {/* Переключатель режима колоды */}
                  <div className={styles.modeSelector}>
                    <button
                      type="button"
                      onClick={() => setDeckMode('standard')}
                      className={`btn-3d ${deckMode === 'standard' ? 'btn-blue' : ''} ${styles.modeButton}`}
                    >
                      Стандартная колода
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeckMode('custom')}
                      className={`btn-3d ${deckMode === 'custom' ? 'btn-blue' : ''} ${styles.modeButton}`}
                    >
                      Своя колода
                    </button>
                  </div>

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
                            onChange={(e) => setSelectedDeck(e.target.value)}
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
                            onChange={(e) => setFrontField(e.target.value)}
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
                            onChange={(e) => setBackField(e.target.value)}
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
                            onChange={(e) => setAudioField(e.target.value)}
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
                            onChange={(e) => setImageField(e.target.value)}
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
          </div>

          {/* Правая колонка: Статистика и список слов */}
          <div className="card-friendly">
            <h2 className={styles.cardTitle}>
              <BookOpen size={20} /> Импортированные слова
            </h2>

            {words.length === 0 ? (
              <div className={styles.emptyState}>
                <BookOpen size={48} className={styles.emptyIcon} />
                <p>Слова еще не загружены. Выберите колоду и нажмите кнопку «Импортировать слова».</p>
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
                          <button
                            onClick={() => startSession(session)}
                            className={`btn-3d ${inProgressSessions.has(session.id) ? 'btn-blue' : 'btn-green'}`}
                            style={{ width: '100%', marginTop: 'auto', padding: '8px 16px', fontSize: '14px' }}
                          >
                            {inProgressSessions.has(session.id) ? 'Продолжить практику' : 'Начать практику'}
                          </button>
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
      </main>
    </div>
  );
}
