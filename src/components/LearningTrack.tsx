'use client';

import React, { useState } from 'react';
import { Lock, Check, X } from 'lucide-react';
import styles from './LearningTrack.module.css';
import { LADDER_COMPLETE_LEX_COVERAGE, LADDER_COMPLETE_GRAMMAR_COVERAGE } from '../core/intervals';

export type JlptLevelId = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export interface LevelCoverage {
  lexCoverage: number;    // 0..1
  grammarCoverage: number; // 0..1
}

// Компетентностный профиль, передаётся родительским компонентом
export interface MacroLadderProfile {
  activeLevelId: JlptLevelId; // текущий активный уровень (v1: всегда 'N5')
  coverages: Partial<Record<JlptLevelId, LevelCoverage>>;
}

interface LearningTrackProps {
  profile: MacroLadderProfile;
}

// Описания уровней JLPT на русском (краткие)
const LEVEL_DESCRIPTIONS: Record<JlptLevelId, string> = {
  N5: 'Базовый уровень. Простые фразы, повседневная лексика (около 710 слов).',
  N4: 'Начальный уровень. Базовые темы в знакомой обстановке (около 663 слов).',
  N3: 'Средний уровень. Материалы повседневной жизни, частично понятные тексты (около 2078 слов).',
  N2: 'Выше среднего. Статьи о широком спектре тем, почти беглая речь (около 1790 слов).',
  N1: 'Высший уровень. Сложные тексты, новости, литература (около 2655 слов).',
};

const JLPT_LEVELS: JlptLevelId[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

// Координаты узлов — точно такие же, как у старого LearningTrack
const COORDINATES = [
  { x: 250, y: 80 },  // N5
  { x: 130, y: 220 }, // N4
  { x: 370, y: 360 }, // N3
  { x: 250, y: 500 }, // N2
  { x: 250, y: 620 }, // N1
];

// Уровень считается завершённым если lex >= LADDER_COMPLETE_LEX_COVERAGE AND grammar = LADDER_COMPLETE_GRAMMAR_COVERAGE
function isLevelCompleted(coverage?: LevelCoverage): boolean {
  if (!coverage) return false;
  return coverage.lexCoverage >= LADDER_COMPLETE_LEX_COVERAGE && coverage.grammarCoverage >= LADDER_COMPLETE_GRAMMAR_COVERAGE;
}

export function LearningTrack({ profile }: LearningTrackProps) {
  const [activePopover, setActivePopover] = useState<number | null>(null);

  // Определяем статусы узлов:
  // - Найдём первый незавершённый уровень — он 'active'
  // - Все, которые до него — 'completed'
  // - Все после — 'locked'
  const firstNonCompleted = JLPT_LEVELS.findIndex(
    (levelId) => !isLevelCompleted(profile.coverages[levelId])
  );

  function getNodeStatus(index: number): 'completed' | 'active' | 'locked' {
    if (firstNonCompleted === -1) {
      // Все уровни пройдены
      return 'completed';
    }
    if (index < firstNonCompleted) return 'completed';
    if (index === firstNonCompleted) return 'active';
    return 'locked';
  }

  return (
    <div className={styles.trackContainer}>
      <div className={styles.nodeList} style={{ width: '500px' }}>
        {/* SVG Соединительные линии на фоне */}
        <svg className={styles.svgConnector} viewBox="0 0 500 700">
          <path
            d="M 250 80 C 250 150, 130 150, 130 220 C 130 290, 370 290, 370 360 C 370 430, 250 430, 250 500 L 250 620"
            className={styles.connectorLineDashed}
          />
          {/* Линия пройденного прогресса */}
          <path
            d="M 250 80 C 250 150, 130 150, 130 220 C 130 290, 370 290, 370 360 C 370 430, 250 430, 250 500 L 250 620"
            className={styles.connectorLine}
            strokeDasharray="700"
            strokeDashoffset={
              firstNonCompleted === -1 ? '0'
              : firstNonCompleted === 0 ? '700'
              : firstNonCompleted === 1 ? '520'
              : firstNonCompleted === 2 ? '350'
              : firstNonCompleted === 3 ? '150'
              : '0'
            }
            style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
          />
        </svg>

        {/* Интерактивные узлы */}
        {JLPT_LEVELS.map((levelId, idx) => {
          const coord = COORDINATES[idx];
          const status = getNodeStatus(idx);
          const coverage = profile.coverages[levelId];
          const isPopoverActive = activePopover === idx;

          const progressPct = coverage
            ? Math.round(50 * coverage.lexCoverage + 50 * coverage.grammarCoverage)
            : 0;

          let btnClass = styles.nodeBtn;
          if (status === 'completed') btnClass += ` ${styles.nodeCompleted}`;
          else if (status === 'active') btnClass += ` ${styles.nodeInProgress}`;
          else btnClass += ` ${styles.nodeLocked}`;

          const isPopoverLeft = coord.x < 200;
          const popoverClassName = isPopoverLeft
            ? `${styles.popover} ${styles.popoverLeft}`
            : `${styles.popover} ${styles.popoverRight}`;

          return (
            <div
              key={levelId}
              className={`${styles.trackNodeWrapper} ${isPopoverActive ? styles.activeWrapper : ''}`}
              style={{ left: `${coord.x}px`, top: `${coord.y}px` }}
            >
              <button
                type="button"
                className={btnClass}
                disabled={status === 'locked'}
                onClick={() => setActivePopover(isPopoverActive ? null : idx)}
                title={levelId}
                data-testid={`level-node-${levelId}`}
                aria-label={`Уровень ${levelId}: ${status}`}
              >
                {status === 'completed' ? (
                  <Check size={28} />
                ) : status === 'locked' ? (
                  <Lock size={24} />
                ) : (
                  /* Активный узел: процент прогресса */
                  <span style={{ fontSize: '13px', fontWeight: 900 }}>{progressPct}%</span>
                )}
              </button>
              <span className={styles.nodeLabel}>{levelId}</span>

              {/* Всплывающее окно с покрытием */}
              {isPopoverActive && (
                <div className={popoverClassName}>
                  <div className={styles.popoverHeader}>
                    <h5 className={styles.popoverTitle}>Уровень {levelId}</h5>
                    <button
                      type="button"
                      className={styles.closeBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePopover(null);
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <p className={styles.popoverDesc}>{LEVEL_DESCRIPTIONS[levelId]}</p>

                  {/* Полосы покрытия */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                        <span>Лексика</span>
                        <span>{Math.round((coverage?.lexCoverage ?? 0) * 100)}%</span>
                      </div>
                      <div style={{ height: '8px', borderRadius: '4px', background: 'var(--bg-tertiary)' }}>
                        <div
                          style={{
                            height: '100%',
                            borderRadius: '4px',
                            background: 'var(--color-blue)',
                            width: `${Math.round((coverage?.lexCoverage ?? 0) * 100)}%`,
                            transition: 'width 0.5s ease'
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                        <span>Грамматика</span>
                        <span>{Math.round((coverage?.grammarCoverage ?? 0) * 100)}%</span>
                      </div>
                      <div style={{ height: '8px', borderRadius: '4px', background: 'var(--bg-tertiary)' }}>
                        <div
                          style={{
                            height: '100%',
                            borderRadius: '4px',
                            background: 'var(--color-green)',
                            width: `${Math.round((coverage?.grammarCoverage ?? 0) * 100)}%`,
                            transition: 'width 0.5s ease'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {status === 'locked' && (
                    <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      🔒 Завершите предыдущий уровень, чтобы разблокировать.
                    </p>
                  )}
                  {status === 'completed' && (
                    <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--color-green)', fontWeight: 700 }}>
                      ✅ Уровень завершён!
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
