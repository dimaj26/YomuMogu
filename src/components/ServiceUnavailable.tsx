'use client';

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import styles from './ServiceUnavailable.module.css';

interface ServiceUnavailableProps {
  // Человеческое сообщение (русский). Сырой error.message сюда не передаём.
  message: string;
  // Подлежит ли повтору (из контракта роута). Кнопка показывается только при retryable && onRetry.
  retryable?: boolean;
  onRetry?: () => void;
  // Опциональная подсказка «что пока работает» (например, офлайн-функции).
  whatWorks?: string;
  className?: string;
}

/**
 * Переиспользуемый блок «сервис недоступно»: человеческий заголовок, сообщение,
 * опциональная подсказка о доступных офлайн-возможностях и опциональная кнопка «Повторить».
 */
export function ServiceUnavailable({ message, retryable, onRetry, whatWorks, className = '' }: ServiceUnavailableProps) {
  return (
    <div className={`${styles.container} ${className}`} role="alert">
      <AlertCircle size={22} className={styles.icon} />
      <div className={styles.body}>
        <p className={styles.message}>{message}</p>
        {whatWorks && <p className={styles.hint}>{whatWorks}</p>}
        {retryable && onRetry && (
          <button type="button" onClick={onRetry} className={`btn-3d ${styles.retryBtn}`}>
            <RefreshCw size={16} style={{ marginRight: 6 }} />
            Повторить
          </button>
        )}
      </div>
    </div>
  );
}
