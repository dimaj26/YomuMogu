'use client';

import React from 'react';
import styles from './ErrorFallback.module.css';

interface ErrorFallbackProps {
  error: Error;
  reset: () => void;
}

export function ErrorFallback({ error, reset }: ErrorFallbackProps) {
  return (
    <div className={styles.container}>
      <div className={styles.iconContainer}>⚠️</div>
      <h2 className={styles.title}>Что-то пошло не так</h2>
      <p className={styles.subtitle}>
        Произошла непредвиденная ошибка при обработке интерфейса. Попробуйте нажать кнопку ниже, чтобы сбросить состояние и восстановить работу.
      </p>
      {error.message && (
        <div className={styles.details}>
          <strong>Детали ошибки:</strong>
          <pre>{error.message}</pre>
        </div>
      )}
      <div className={styles.actions}>
        <button 
          onClick={reset} 
          className="btn-3d btn-blue"
          type="button"
        >
          Попробовать снова
        </button>
      </div>
    </div>
  );
}
