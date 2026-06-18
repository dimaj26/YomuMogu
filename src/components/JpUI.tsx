'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useJapanification } from '../hooks/useJapanification';
import { useJpUI } from './JpUIProvider';
import styles from './JpUI.module.css';
import { FURIGANA_FADE_FROM_DAYS, FURIGANA_HIDE_FROM_DAYS } from '../core/intervals';

interface JpUIProps {
  id: string; // Уникальный строковый ID элемента
  ru: string; // Русский текст по умолчанию
  ja: string; // Японский перевод (Кандзи/Кана)
  reading?: string; // Хирагана чтение (над кандзи)
  className?: string; // Внешний CSS класс
  interactive?: boolean; // Флаг интерактивности (по умолчанию true)
  kind?: 'chrome' | 'content'; // 'chrome' — служебный интерфейс (навигация и пр.), не японизируется в smart
}

export function JpUI({ id, ru, ja, reading, className = '', interactive = true, kind = 'content' }: JpUIProps) {
  const { state: jState } = useJapanification();
  const { uiMode } = jState;

  const {
    uiWords,
    upgradedThisSession,
    revertedIds,
    isLoaded,
    upgradeWord,
    revertWord,
    confirmWord
  } = useJpUI();

  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const wordState = uiWords[id];

  // Регистрация и автоматический апгрейд слова в режиме smart
  useEffect(() => {
    if (
      uiMode === 'smart' &&
      kind !== 'chrome' && // служебный интерфейс не «изучается» и не пишется в БД
      isLoaded &&
      !wordState &&
      !upgradedThisSession &&
      !revertedIds.has(id)
    ) {
      // Инициируем апгрейд этого слова в текущей сессии
      upgradeWord(id, ru, ja, reading);
    }
  }, [id, ru, ja, reading, uiMode, kind, isLoaded, wordState, upgradedThisSession, revertedIds, upgradeWord]);

  // Закрытие тултипа при клике вне элемента
  useEffect(() => {
    if (!isTooltipOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsTooltipOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTooltipOpen]);

  // Определяем, какую локализацию рендерить
  if (uiMode === 'ru') {
    return <span className={className}>{ru}</span>;
  }

  if (uiMode === 'ja') {
    // В режиме "Только японский" рендерим строго японский без фуриганы
    return <span className={className}>{ja}</span>;
  }

  // Служебный интерфейс (навигация и пр.) в режиме 'smart' никогда не японизируется:
  // нулевой новичок не должен видеть 設定/プロフィール по-японски без своего выбора.
  if (kind === 'chrome') {
    return <span className={className}>{ru}</span>;
  }

  // Режим 'smart' (Умная японизация)
  // Если состояние еще не загрузилось из БД, временно рендерим русский, чтобы избежать layout shift
  if (!isLoaded) {
    return <span className={className}>{ru}</span>;
  }

  const isReverted = revertedIds.has(id);
  const isUpgraded = wordState && wordState.reps > 0 && !isReverted;

  if (!isUpgraded) {
    return <span className={className}>{ru}</span>;
  }

  // Слово изучено (японизировано). Рендерим на японском с интерактивным тултипом
  const justUpgraded = upgradedThisSession === id;
  const hasReading = !!reading;

  // Вычисляем класс прозрачности фуриганы на основе FSRS интервала
  let furiganaClass = styles.furiganaFull;
  if (wordState) {
    const ivl = wordState.interval || 0;
    if (ivl < FURIGANA_FADE_FROM_DAYS) {
      furiganaClass = styles.furiganaFull;
    } else if (ivl < FURIGANA_HIDE_FROM_DAYS) {
      furiganaClass = styles.furiganaReview;
    } else {
      furiganaClass = styles.furiganaMature;
    }
  }

  if (!interactive) {
    return (
      <span
        className={`${styles.jpWord} ${justUpgraded ? styles.justUpgraded : ''} ${className}`}
        title={`Перевод: ${ru}${reading ? ` (Чтение: ${reading})` : ''}`}
      >
        {hasReading ? (
          <ruby>
            {ja}
            <rt className={furiganaClass}>{reading}</rt>
          </ruby>
        ) : (
          ja
        )}
      </span>
    );
  }

  const handleWordClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsTooltipOpen(prev => !prev);
  };

  const handleRevert = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsTooltipOpen(false);
    await revertWord(id);
  };

  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsTooltipOpen(false);
    await confirmWord(id);
  };

  return (
    <span ref={wrapperRef} className={`${styles.wrapper} ${className}`}>
      <span
        onClick={handleWordClick}
        className={`${styles.jpWord} ${justUpgraded ? styles.justUpgraded : ''}`}
        title="Нажми, чтобы увидеть русский перевод"
      >
        {hasReading ? (
          <ruby>
            {ja}
            <rt className={furiganaClass}>{reading}</rt>
          </ruby>
        ) : (
          ja
        )}
      </span>

      {isTooltipOpen && (
        <span className={styles.tooltip}>
          <span>
            Перевод: <span className={styles.tooltipTranslation}>{ru}</span>
          </span>
          {reading && (
            <span className={styles.tooltipInstruction}>
              Чтение: {reading}
            </span>
          )}
          <span className={styles.tooltipButtons}>
            <button
              type="button"
              onClick={handleRevert}
              className={`${styles.tooltipBtn} ${styles.revertBtn}`}
              title="Забыли слово? Вернуть его на русский и повторить позже"
            >
              Забыл (Рус)
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className={`${styles.tooltipBtn} ${styles.confirmBtn}`}
              title="Помню это слово!"
            >
              Знаю
            </button>
          </span>
        </span>
      )}
    </span>
  );
}
