'use client';

import React from 'react';
import type { JlptLevelId } from '../lib/competency/profile';
import { getBalanceHint, Strand } from '../lib/balance/balance';
import { ScienceTip } from './ScienceTip';
import styles from './BalanceWidget.module.css';

interface BalanceWidgetProps {
  level: JlptLevelId;
  log: Strand[];
}

/**
 * Виджет баланса «Структура vs Иммерсия».
 * Показывает рекомендованное соотношение занятий для текущего уровня обучения
 * и фактическое соотношение на основе лога активности последних действий.
 */
export function BalanceWidget({ level, log }: BalanceWidgetProps) {
  const { recommended, actual, message } = getBalanceHint(level, log);

  const recommendedPct = Math.round(recommended * 100);
  const actualPct = actual !== null ? Math.round(actual * 100) : null;

  return (
    <div className={`${styles.widget} card-friendly`}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          ⚖️ Баланс обучения ({level})
          <ScienceTip tipId="balance" />
        </h3>
      </div>

      <div className={styles.barsContainer}>
        {/* Рекомендованный баланс */}
        <div className={styles.barRow}>
          <div className={styles.barLabel}>
            <span>Рекомендованная структура (теория / правила):</span>
            <span>{recommendedPct}%</span>
          </div>
          <div className={styles.barTrack}>
            <div
              className={`${styles.barFill} ${styles.fillRecommended}`}
              style={{ width: `${recommendedPct}%` }}
              data-testid="recommended-bar-fill"
            />
          </div>
        </div>

        {/* Фактический баланс */}
        <div className={styles.barRow}>
          <div className={styles.barLabel}>
            <span>Фактическая структура (твои действия):</span>
            <span>{actualPct !== null ? `${actualPct}%` : '—'}</span>
          </div>
          <div className={styles.barTrack}>
            {actualPct !== null ? (
              <div
                className={`${styles.barFill} ${styles.fillActual}`}
                style={{ width: `${actualPct}%` }}
                data-testid="actual-bar-fill"
              />
            ) : (
              <span className={styles.barEmptyText}>Недостаточно данных (нужно ≥6 действий)</span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.message}>
        {message}
      </div>
    </div>
  );
}
