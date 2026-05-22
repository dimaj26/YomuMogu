'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { useJapanification } from '@/hooks/useJapanification';
import styles from './LanguageSwitcher.module.css';

/**
 * Компонент переключения языка интерфейса (Русский / Smart / 日本語)
 * Интегрируется в шапку (navbar) для компактного управления уровнем погружения.
 */
export function LanguageSwitcher() {
  const { state, setUiMode } = useJapanification();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Закрываем выпадающий список при клике вне его области
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const modes = [
    { value: 'ru', label: 'Русский' },
    { value: 'smart', label: 'Smart' },
    { value: 'ja', label: '日本語' },
  ] as const;

  const currentLabel = modes.find(m => m.value === state.uiMode)?.label || 'Smart';

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button 
        type="button" 
        onClick={() => setIsOpen(!isOpen)} 
        className={styles.triggerButton}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <Globe size={18} className={styles.globeIcon} />
        <span className={styles.labelText}>{currentLabel}</span>
        <ChevronDown size={14} className={`${styles.chevronIcon} ${isOpen ? styles.chevronOpen : ''}`} />
      </button>

      {isOpen && (
        <ul className={styles.dropdownMenu} role="listbox">
          {modes.map(mode => (
            <li key={mode.value} role="option" aria-selected={state.uiMode === mode.value}>
              <button
                type="button"
                className={`${styles.dropdownItem} ${state.uiMode === mode.value ? styles.activeItem : ''}`}
                onClick={() => {
                  setUiMode(mode.value);
                  setIsOpen(false);
                }}
              >
                <span>{mode.label}</span>
                {state.uiMode === mode.value && <Check size={16} className={styles.checkIcon} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
