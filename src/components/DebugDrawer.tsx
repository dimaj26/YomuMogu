'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Terminal, Settings, Search, Database, User, X, RefreshCw, Flame } from 'lucide-react';
import { db, LocalWord } from '@/core/db';
import { 
  getActiveProfileId, 
  getProfilesList, 
  setActiveProfileId, 
  getProfileItem, 
  setProfileItem 
} from '@/lib/profile';
import { LOCAL_DECK_NAME, retagAllWords } from '@/core/localDeckService';
import styles from './DebugDrawer.module.css';

interface LocalStorageKeyValue {
  key: string;
  value: string;
}

export function DebugDrawer() {
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'entities' | 'prompts' | 'profile'>('entities');
  
  // Данные для вкладки сущностей
  const [studiedToday, setStudiedToday] = useState<string[]>([]);
  const [dueWords, setDueWords] = useState<LocalWord[]>([]);
  const [allWords, setAllWords] = useState<LocalWord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWord, setSelectedWord] = useState<LocalWord | null>(null);

  // Данные для вкладки промптов
  const [lastPrompt, setLastPrompt] = useState<any>(null);

  // Данные для вкладки профиля
  const [profileId, setProfileId] = useState('default');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [profileKeys, setProfileKeys] = useState<LocalStorageKeyValue[]>([]);

  // Исключаем рендеринг в продакшн сборке (разрешаем в dev и test)
  const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const loadData = useCallback(async () => {
    if (typeof window === 'undefined') return;
    
    const activePid = getActiveProfileId();
    setProfileId(activePid);
    setProfiles(getProfilesList());

    // 1. Загрузка изученных сегодня слов (с 4:00 утра текущего дня)
    const now = new Date();
    const boundary = new Date(now);
    boundary.setHours(4, 0, 0, 0);
    if (now.getHours() < 4) {
      boundary.setDate(boundary.getDate() - 1);
    }
    const startTimestamp = boundary.getTime();

    try {
      const reviews = await db.reviews
        .where('profileId')
        .equals(activePid)
        .filter(r => r.timestamp >= startTimestamp)
        .toArray();
      
      const cardIds = Array.from(new Set(reviews.map(r => r.cardId)));
      const words = await db.words
        .where('profileId')
        .equals(activePid)
        .filter(w => cardIds.includes(w.id))
        .toArray();
      
      setStudiedToday(words.map(w => w.word));
    } catch (e) {
      console.error('Ошибка загрузки изученных сегодня слов:', e);
    }

    // 2. Загрузка из IndexedDB слов на повторении (due, исключая новые)
    try {
      const nowMs = Date.now();
      const loadedWords = await db.words
        .where('profileId')
        .equals(activePid)
        .toArray();
      
      const due = loadedWords.filter(w => 
        w.active && w.passive &&
        w.active.status !== 'new' && 
        w.passive.status !== 'new' && 
        (w.active.due <= nowMs || w.passive.due <= nowMs)
      );
      setDueWords(due);
      setAllWords(loadedWords);
    } catch (e) {
      console.error('Ошибка загрузки слов из БД:', e);
    }

    // 3. Загрузка последнего промпта из sessionStorage
    try {
      const promptStr = sessionStorage.getItem('yomumogu_last_gemini_prompt');
      if (promptStr) {
        setLastPrompt(JSON.parse(promptStr));
      } else {
        setLastPrompt(null);
      }
    } catch (e) {
      console.error('Ошибка чтения последнего промпта:', e);
    }

    // 4. Загрузка ключей localStorage для активного профиля
    const keys: LocalStorageKeyValue[] = [];
    const prefix = `yomumogu_profile_${activePid}_`;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const shortKey = key.replace(prefix, '');
        keys.push({ key: shortKey, value: localStorage.getItem(key) || '' });
      }
    }
    setProfileKeys(keys);
  }, []);

  useEffect(() => {
    if (isOpen && isMounted) {
      loadData();
    }
  }, [isOpen, isMounted, loadData]);

  const handleProfileChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPid = e.target.value;
    setActiveProfileId(newPid);
    loadData();
    window.location.reload();
  };

  const handleResetDb = async () => {
    if (!confirm('Вы уверены, что хотите сбросить FSRS-прогресс и IndexedDB для текущего профиля? Все локальные настройки будут сброшены.')) {
      return;
    }
    try {
      const activePid = getActiveProfileId();
      await db.words.where('profileId').equals(activePid).delete();
      await db.reviews.where('profileId').equals(activePid).delete();
      await db.ui_words.where('profileId').equals(activePid).delete();
      
      // Очищаем ключи лимитов в localStorage
      const keysToRemove: string[] = [];
      const prefix = `yomumogu_profile_${activePid}_`;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix) && (key.includes('daily_new_words') || key.includes('sessions') || key.includes('active_session') || key.includes('chat_state_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));

      alert('База данных успешно сброшена!');
      window.location.reload();
    } catch (e) {
      console.error('Ошибка очистки БД:', e);
      alert('Ошибка при очистке БД.');
    }
  };

  const handleAddXp = () => {
    const activePid = getActiveProfileId();
    const jStateStr = getProfileItem('japanification', activePid);
    if (jStateStr) {
      try {
        const jState = JSON.parse(jStateStr);
        jState.points = (jState.points || 0) + 20;
        
        // Перерасчет уровня
        // Порог: normal L1=20, L2=50, L3=100, L4=170, L5=280, L6=420
        const pts = jState.points;
        let newLevel = 0;
        if (pts >= 420) newLevel = 6;
        else if (pts >= 280) newLevel = 5;
        else if (pts >= 170) newLevel = 4;
        else if (pts >= 100) newLevel = 3;
        else if (pts >= 50) newLevel = 2;
        else if (pts >= 20) newLevel = 1;
        
        jState.level = newLevel;
        setProfileItem('japanification', JSON.stringify(jState), activePid);
        loadData();
        window.location.reload();
      } catch (e) {
        console.error('Ошибка обновления XP:', e);
      }
    }
  };

  const handleRetagAll = async () => {
    try {
      const activePid = getActiveProfileId();
      const updatedCount = await retagAllWords(activePid);
      alert(`Синхронизация тегов завершена! Обновлено слов: ${updatedCount}`);
      loadData();
    } catch (e) {
      console.error('Ошибка переразметки тегов:', e);
      alert('Ошибка при переразметке тегов.');
    }
  };

  if (!isMounted || !isDev) {
    return null;
  }

  const filteredWords = allWords.filter(
    w => w.word.toLowerCase().includes(searchQuery.toLowerCase()) || 
         w.translation.toLowerCase().includes(searchQuery.toLowerCase()) ||
         w.reading.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <button className={styles.triggerBtn} onClick={() => setIsOpen(true)}>
        <Terminal size={16} />
        🛠️ Debug
      </button>

      <div className={`${styles.drawer} ${isOpen ? styles.open : ''}`}>
        <div className={styles.header}>
          <h3>
            <Database size={20} />
            YomuMogu Debug HUD
          </h3>
          <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.tabs}>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'entities' ? styles.active : ''}`}
            onClick={() => setActiveTab('entities')}
          >
            <Database size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            Сущности
          </button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'prompts' ? styles.active : ''}`}
            onClick={() => setActiveTab('prompts')}
          >
            <Terminal size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            Промпты Gemini
          </button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'profile' ? styles.active : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            Состояние
          </button>
        </div>

        <div className={styles.content}>
          {activeTab === 'entities' && (
            <div>
              <div className={styles.section}>
                <h4>Изучено сегодня</h4>
                {studiedToday.length > 0 ? (
                  <div className={styles.badgeList}>
                    {studiedToday.map((word, idx) => (
                      <span key={idx} className={styles.simpleBadge}>
                        {word}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className={styles.emptyText}>Сегодня новые слова еще не изучались.</p>
                )}
              </div>

              <div className={styles.section}>
                <h4>Слова на повторении ({dueWords.length})</h4>
                {dueWords.length > 0 ? (
                  <div className={styles.badgeList}>
                    {dueWords.map((word) => (
                      <span 
                        key={word.id} 
                        className={`${styles.simpleBadge} ${styles.clickableBadge}`}
                        onClick={() => setSelectedWord(word)}
                      >
                        {word.word}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className={styles.emptyText}>Нет слов, требующих повторения по FSRS.</p>
                )}
              </div>

              <div className={styles.section}>
                <h4>Инспектор FSRS (Поиск в БД)</h4>
                <input 
                  type="text"
                  className={styles.searchInput}
                  placeholder="Поиск по иероглифу / чтению / переводу..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                
                <div className={styles.wordsInspectorList}>
                  {filteredWords.slice(0, 50).map((word) => {
                    const status = word.active.status;
                    let statusClass = styles.statusNew;
                    if (status === 'learning') statusClass = styles.statusLearning;
                    if (status === 'review') statusClass = styles.statusReview;
                    if (status === 'mature') statusClass = styles.statusMature;

                    return (
                      <div 
                        key={word.id} 
                        className={`${styles.inspectItem} ${selectedWord?.id === word.id ? styles.selected : ''}`}
                        onClick={() => setSelectedWord(word)}
                      >
                        <div>
                          <span className={styles.wordMain}>{word.word}</span>
                          <span className={styles.wordReading}>[{word.reading}]</span>
                        </div>
                        <span className={`${styles.wordStatus} ${statusClass}`}>{status}</span>
                      </div>
                    );
                  })}
                  {filteredWords.length > 50 && (
                    <p className={styles.emptyText}>Показано 50 из {filteredWords.length} слов...</p>
                  )}
                  {filteredWords.length === 0 && (
                    <p className={styles.emptyText}>Слова не найдены в БД.</p>
                  )}
                </div>
              </div>

              {selectedWord && (
                <div className={styles.detailBox}>
                  <div className={styles.detailHeader}>
                    <div>
                      <span className={styles.detailTitle}>{selectedWord.word}</span>
                      <span style={{ marginLeft: '8px', color: '#94a3b8', fontSize: '12px' }}>
                        ID: {selectedWord.id}
                      </span>
                    </div>
                    <span className={styles.detailTranslation}>{selectedWord.translation}</span>
                  </div>

                  <div className={styles.curvesContainer}>
                    <div className={styles.curveBlock}>
                      <h5>Passive FSRS (Чтение)</h5>
                      <div className={styles.statsGrid}>
                        <span className={styles.statsLabel}>Stability:</span>
                        <span className={styles.statsVal}>{selectedWord.passive.stability.toFixed(2)}</span>
                        
                        <span className={styles.statsLabel}>Difficulty:</span>
                        <span className={styles.statsVal}>{selectedWord.passive.difficulty.toFixed(2)}</span>
                        
                        <span className={styles.statsLabel}>Interval:</span>
                        <span className={styles.statsVal}>{selectedWord.passive.interval} дн.</span>
                        
                        <span className={styles.statsLabel}>Reps/Lapses:</span>
                        <span className={styles.statsVal}>{selectedWord.passive.reps} / {selectedWord.passive.lapses}</span>

                        <span className={styles.statsLabel}>Due:</span>
                        <span className={styles.statsVal} style={{ fontSize: '10px' }}>
                          {new Date(selectedWord.passive.due).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className={styles.curveBlock}>
                      <h5>Active FSRS (Письмо)</h5>
                      <div className={styles.statsGrid}>
                        <span className={styles.statsLabel}>Stability:</span>
                        <span className={styles.statsVal}>{selectedWord.active.stability.toFixed(2)}</span>
                        
                        <span className={styles.statsLabel}>Difficulty:</span>
                        <span className={styles.statsVal}>{selectedWord.active.difficulty.toFixed(2)}</span>
                        
                        <span className={styles.statsLabel}>Interval:</span>
                        <span className={styles.statsVal}>{selectedWord.active.interval} дн.</span>
                        
                        <span className={styles.statsLabel}>Reps/Lapses:</span>
                        <span className={styles.statsVal}>{selectedWord.active.reps} / {selectedWord.active.lapses}</span>

                        <span className={styles.statsLabel}>Due:</span>
                        <span className={styles.statsVal} style={{ fontSize: '10px' }}>
                          {new Date(selectedWord.active.due).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'prompts' && (
            <div>
              <div className={styles.section}>
                <h4>Последний промпт Gemini (Чат / Подсказки)</h4>
                {lastPrompt ? (
                  <div>
                    <p className={styles.formLabel} style={{ color: '#f8fafc', marginBottom: '8px' }}>
                      System Instruction:
                    </p>
                    <div className={styles.codePanel} style={{ marginBottom: '16px' }}>
                      {lastPrompt.systemInstruction}
                    </div>

                    <p className={styles.formLabel} style={{ color: '#f8fafc', marginBottom: '8px' }}>
                      Диалог и контекст (contents):
                    </p>
                    <div className={styles.codePanel}>
                      {JSON.stringify(lastPrompt.contents, null, 2)}
                    </div>
                  </div>
                ) : (
                  <p className={styles.emptyText}>
                    Запросы еще не отправлялись. Начните чат-сессию для фиксации промптов.
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div>
              <div className={styles.section}>
                <h4>Выбор профиля</h4>
                <label className={styles.formLabel}>Текущий профиль:</label>
                <select 
                  className={styles.selectInput}
                  value={profileId}
                  onChange={handleProfileChange}
                >
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                  ))}
                </select>
              </div>

              <div className={styles.section}>
                <h4>Хранилище профиля (localStorage)</h4>
                <div className={styles.metaGrid}>
                  {profileKeys.map((item, idx) => (
                    <div key={idx} className={styles.metaItem}>
                      <span className={styles.metaKey}>{item.key}</span>
                      <span className={styles.metaVal}>{item.value}</span>
                    </div>
                  ))}
                  {profileKeys.length === 0 && (
                    <p className={styles.emptyText}>В хранилище профиля нет записей.</p>
                  )}
                </div>
              </div>

              <div className={styles.section}>
                <h4>Управление и тестирование</h4>
                <div className={styles.btnGroup}>
                  <button className={`${styles.actionBtn} ${styles.btnSuccess}`} onClick={handleAddXp}>
                    <Flame size={16} />
                    Добавить +20 XP (Погружение)
                  </button>
                  <button className={styles.actionBtn} style={{ backgroundColor: '#a855f7', color: 'white' }} onClick={handleRetagAll}>
                    <Settings size={16} />
                    Переразметить теги JLPT
                  </button>
                  <button className={`${styles.actionBtn} ${styles.btnDanger}`} onClick={handleResetDb}>
                    <RefreshCw size={16} />
                    Сбросить FSRS и БД профиля
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
