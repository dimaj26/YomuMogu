'use client';

import { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';
import { getTip } from '../lib/science/tips';
import styles from './ScienceTip.module.css';

interface ScienceTipProps {
  tipId: string;
}

// Запасная иконка на случай, если Info недоступен (напр. частичный мок lucide-react в тестах).
// Объявлена на уровне модуля, а не в рендере, чтобы не нарушать react-hooks/static-components.
function FallbackInfoIcon() {
  return <span>ⓘ</span>;
}

/**
 * Небольшой интерактивный компонент, который показывает научное обоснование
 * (почему YomuMogu делает именно так) при клике на иконку ⓘ.
 */
export function ScienceTip({ tipId }: ScienceTipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Закрытие по клику вне подсказки.
  // Хук объявлен до раннего return ниже — порядок хуков должен быть стабильным (rules-of-hooks).
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const tip = getTip(tipId);

  // Если подсказка с таким ID не найдена, ничего не рендерим (defensive)
  if (!tip) {
    return null;
  }

  const toggle = () => {
    setIsOpen(prev => !prev);
  };

  // Info — статический импорт. В тестах возможен частичный мок lucide-react, где сам
  // доступ к экспорту Info бросает ошибку, поэтому оборачиваем в try/catch с запасной иконкой.
  let InfoIcon: typeof Info;
  try {
    InfoIcon = Info ?? (FallbackInfoIcon as unknown as typeof Info);
  } catch {
    InfoIcon = FallbackInfoIcon as unknown as typeof Info;
  }

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <button
        type="button"
        className={`${styles.trigger} ${isOpen ? styles.triggerActive : ''}`}
        onClick={toggle}
        aria-expanded={isOpen}
        aria-label="Показать научное обоснование"
        title="Научное обоснование"
      >
        <InfoIcon size={16} />
      </button>

      {isOpen && (
        <div className={`${styles.popover} card-friendly`}>
          <div className={styles.title}>{tip.title}</div>
          <div className={styles.body}>{tip.body}</div>
          <div className={styles.source}>
            Исследование: {tip.source}
          </div>
        </div>
      )}
    </div>
  );
}
