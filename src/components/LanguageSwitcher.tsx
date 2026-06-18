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
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

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
    { value: 'ru', label: 'Русский', description: 'Весь интерфейс на русском.' },
    { value: 'smart', label: 'Smart', description: 'Интерфейс постепенно становится японским по мере изучения. Сбросить прогресс можно в Настройках.' },
    { value: 'ja', label: '日本語', description: 'Только японский — для продвинутых.' },
  ] as const;

  const currentLabel = modes.find(m => m.value === state.uiMode)?.label || 'Smart';

  // Синхронизируем focusedIndex при открытии
  useEffect(() => {
    if (isOpen) {
      const activeIdx = modes.findIndex(m => m.value === state.uiMode);
      setFocusedIndex(activeIdx >= 0 ? activeIdx : 0);
    } else {
      setFocusedIndex(-1);
    }
  }, [isOpen, state.uiMode]);

  // Фокусируем активный элемент
  useEffect(() => {
    if (isOpen && focusedIndex >= 0) {
      itemRefs.current[focusedIndex]?.focus();
    }
  }, [isOpen, focusedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => (prev + 1) % modes.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        setFocusedIndex(prev => (prev - 1 + modes.length) % modes.length);
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      default:
        break;
    }
  };

  const handleItemKeyDown = (e: React.KeyboardEvent, index: number) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((index + 1) % modes.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((index - 1 + modes.length) % modes.length);
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      case 'Tab':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div className={styles.container} ref={dropdownRef} onKeyDown={handleKeyDown}>
      <button 
        ref={triggerRef}
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
          {modes.map((mode, index) => (
            <li key={mode.value} role="option" aria-selected={state.uiMode === mode.value}>
              <button
                ref={el => { itemRefs.current[index] = el; }}
                type="button"
                className={`${styles.dropdownItem} ${state.uiMode === mode.value ? styles.activeItem : ''}`}
                onClick={() => {
                  setUiMode(mode.value);
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
                onKeyDown={(e) => handleItemKeyDown(e, index)}
              >
                <span className={styles.itemTextBlock}>
                  <span className={styles.itemLabel}>{mode.label}</span>
                  <span className={styles.itemDescription}>{mode.description}</span>
                </span>
                {state.uiMode === mode.value && <Check size={16} className={styles.checkIcon} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
