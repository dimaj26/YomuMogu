'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/core/db';
import { importStarterDeck, LOCAL_DECK_NAME } from '@/core/localDeckService';
import styles from './AssessmentModal.module.css';

interface AssessmentModalProps {
  isOpen: boolean;
  profileId: string;
  onClose: () => void;
  // Вызывается после успешного сохранения (родитель обновляет состояние/навигацию)
  onSaved: () => void | Promise<void>;
  // Опциональный обработчик ошибок (родитель показывает сообщение)
  onError?: (message: string) => void;
}

/**
 * Модал диагностики знаний. Позволяет отметить уже известные слова стартовой
 * колоды (получат статус «Изучено» и будут отложены) и инициализировать
 * локальный список через importStarterDeck. Переиспользуется на /settings и /.
 */
export function AssessmentModal({ isOpen, profileId, onClose, onSaved, onError }: AssessmentModalProps) {
  const [localWordStates, setLocalWordStates] = useState<Record<number, string>>({});
  const [currentLevelTab, setCurrentLevelTab] = useState<'N5' | 'N4' | 'Conversational'>('N5');
  const [starterDeckData, setStarterDeckData] = useState<any[]>([]);
  const [checkedNewWordIds, setCheckedNewWordIds] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // При открытии подгружаем текущие статусы слов профиля (mature — уже отмечены)
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    (async () => {
      try {
        const existingWords = await db.words
          .where('profileId')
          .equals(profileId)
          .filter(w => w.category === LOCAL_DECK_NAME)
          .toArray();

        const states: Record<number, string> = {};
        const checkedIds = new Set<number>();

        existingWords.forEach(w => {
          states[w.id] = w.active.status;
          if (w.active.status === 'mature') {
            checkedIds.add(w.id);
          }
        });

        if (!cancelled) {
          setLocalWordStates(states);
          setCheckedNewWordIds(checkedIds);
        }
      } catch (err) {
        onError?.('Не удалось загрузить статус слов для диагностики');
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen, profileId, onError]);

  // Ленивая загрузка данных стартовой колоды для модального окна
  useEffect(() => {
    if (isOpen && starterDeckData.length === 0) {
      import('@/resources/starter_deck.json').then((module) => {
        setStarterDeckData(module.default);
      });
    }
  }, [isOpen, starterDeckData.length]);

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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await importStarterDeck(profileId, checkedNewWordIds);
      await onSaved();
    } catch (err) {
      onError?.('Не удалось сохранить результаты диагностики');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>Диагностика знаний</h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-3d btn-red"
            style={{ padding: '6px 12px', fontSize: '13px' }}
          >
            Закрыть
          </button>
        </div>

        <div className={styles.modalBody}>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Отметьте слова, которые вы уже хорошо знаете. Они получат статус «Изучено» и будут отложены.
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
            onClick={onClose}
            className="btn-3d"
            style={{ padding: '8px 16px', fontSize: '14px' }}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={starterDeckData.length === 0 || isSaving}
            className="btn-3d btn-green"
            style={{ padding: '8px 16px', fontSize: '14px' }}
          >
            Сохранить и начать
          </button>
        </div>
      </div>
    </div>
  );
}
