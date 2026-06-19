'use client';

import { useState, useRef, useLayoutEffect } from 'react';
import styles from './PhonosemanticHint.module.css';

// Типы данных из phonosemantics.json
export interface PhonosemanticRelative {
  kanji: string;    // Родственный кандзи: 晴
  reading: string;  // Чтение: せい
  meaning: string;  // Перевод на русский: ясная погода
}

export interface PhonosemanticData {
  key: string;       // Иероглиф-ключ: 青
  reading: string;   // Чтение ключа: せい
  relatives: PhonosemanticRelative[];
}

interface PhonosemanticHintProps {
  data: PhonosemanticData;
}

/**
 * Компонент фоносемантической подсказки (Accordion).
 * Свёрнут по умолчанию — пользователь сначала пытается вспомнить сам,
 * затем может открыть подсказку для структурного понимания чтения.
 */
export function PhonosemanticHint({ data }: PhonosemanticHintProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [maxHeight, setMaxHeight] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Высоту контента измеряем после рендера: читать scrollHeight прямо в JSX нельзя
  // (на первом открытии ref ещё не стабилен и вернёт 0). useLayoutEffect снимает мерцание.
  useLayoutEffect(() => {
    if (isOpen && bodyRef.current) {
      setMaxHeight(bodyRef.current.scrollHeight);
    } else {
      setMaxHeight(0);
    }
  }, [isOpen]);

  const toggle = () => setIsOpen(prev => !prev);

  return (
    <div className={styles.wrapper}>
      {/* Триггер */}
      <button
        className={styles.trigger}
        onClick={toggle}
        aria-expanded={isOpen}
        type="button"
      >
        🔍 Фонетический ключ
        <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>▾</span>
      </button>

      {/* Тело accordion */}
      <div
        ref={bodyRef}
        className={styles.body}
        style={{ maxHeight: isOpen ? maxHeight : 0 }}
        aria-hidden={!isOpen}
      >
        <div className={styles.infoText}>
          Иероглифы с общим фонетическим ключом часто имеют одинаковое или близкое онное чтение (音読み). Групповое запоминание помогает легче читать родственные слова.
        </div>
        <div className={styles.inner}>
          {/* Блок ключа */}
          <div className={styles.keyBlock}>
            <span className={styles.keyKanji}>{data.key}</span>
            <span className={styles.keyReading}>{data.reading}</span>
          </div>

          {/* Стрелка */}
          <span className={styles.arrow}>→</span>

          {/* Родственные кандзи */}
          <div className={styles.relatives}>
            {data.relatives.map(rel => (
              <div key={rel.kanji} className={styles.chip}>
                <span className={styles.chipKanji}>{rel.kanji}</span>
                <span className={styles.chipReading}>{rel.reading}</span>
                <span className={styles.chipMeaning}>{rel.meaning}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
