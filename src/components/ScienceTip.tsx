'use client';

import { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';
import { getTip } from '../lib/science/tips';
import styles from './ScienceTip.module.css';

interface ScienceTipProps {
  tipId: string;
}

/**
 * Небольшой интерактивный компонент, который показывает научное обоснование
 * (почему YomuMogu делает именно так) при клике на иконку ⓘ.
 */
export function ScienceTip({ tipId }: ScienceTipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  const tip = getTip(tipId);

  // Если подсказка с таким ID не найдена, ничего не рендерим (defensive)
  if (!tip) {
    return null;
  }

  // Закрытие по клику вне подсказки
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

  const toggle = () => {
    setIsOpen(prev => !prev);
  };

  let InfoIcon: any;
  try {
    InfoIcon = Info;
    if (!InfoIcon) {
      InfoIcon = () => <span>ⓘ</span>;
    }
  } catch (e) {
    InfoIcon = () => <span>ⓘ</span>;
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
