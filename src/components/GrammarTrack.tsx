'use client';

import React, { useState } from 'react';
import { Lock, Check, BookOpen } from 'lucide-react';
import grammarRules from '@/resources/grammar_rules.json';
import { useJapanification } from '@/hooks/useJapanification';
import type { GrammarProgress } from '@/core/db';
import styles from './GrammarTrack.module.css';

interface GrammarTrackProps {
  grammarProgress: Record<string, GrammarProgress>;
  onSelectRule: (ruleId: string) => void;
}

const placeholders = [
  {
    id: 'g_n5_06',
    construction: '〜ながら',
    topic: 'Одновременность',
    translation: 'Делая одновременно...',
    explanation: 'Используется для описания двух действий, совершаемых одновременно одним лицом (V-masu + ながら).',
    isPlaceholder: true,
  },
  {
    id: 'g_n5_07',
    construction: '〜たことがある',
    topic: 'Опыт в прошлом',
    translation: 'Приходилось делать...',
    explanation: 'Используется для выражения опыта совершения какого-либо действия в прошлом (V-ta + ことがある).',
    isPlaceholder: true,
  },
  {
    id: 'g_n5_08',
    construction: '〜つもり',
    topic: 'Намерения',
    translation: 'Собираюсь сделать...',
    explanation: 'Выражает намерение или план совершить действие в будущем (V-plain + つもり).',
    isPlaceholder: true,
  },
  {
    id: 'g_n5_09',
    construction: '〜ほうがいい',
    topic: 'Совет / Рекомендация',
    translation: 'Лучше сделать...',
    explanation: 'Используется для того, чтобы дать совет или порекомендовать действие собеседнику.',
    isPlaceholder: true,
  },
  {
    id: 'g_n5_10',
    construction: 'JLPT N5 Финал',
    topic: 'Аттестация',
    translation: 'Итоговый экзамен',
    explanation: 'Комплексный экзамен на знание всей грамматики и лексики уровня N5.',
    isPlaceholder: true,
  },
];

const getCoords = (id: string) => {
  switch (id) {
    case 'g_n5_01': return { x: 250, y: 80 };
    case 'g_n5_02': return { x: 130, y: 200 };
    case 'g_n5_04': return { x: 130, y: 320 };
    case 'g_n5_03': return { x: 370, y: 200 };
    case 'g_n5_05': return { x: 370, y: 320 };
    case 'g_n5_06': return { x: 250, y: 440 };
    case 'g_n5_07': return { x: 250, y: 560 };
    case 'g_n5_08': return { x: 130, y: 680 };
    case 'g_n5_09': return { x: 370, y: 680 };
    case 'g_n5_10': return { x: 250, y: 800 };
    default: return { x: 250, y: 80 };
  }
};

const connections = [
  { from: 'g_n5_01', to: 'g_n5_02', d: 'M 250 80 C 250 140, 130 140, 130 200' },
  { from: 'g_n5_02', to: 'g_n5_04', d: 'M 130 200 L 130 320' },
  { from: 'g_n5_01', to: 'g_n5_03', d: 'M 250 80 C 250 140, 370 140, 370 200' },
  { from: 'g_n5_03', to: 'g_n5_05', d: 'M 370 200 L 370 320' },
  { from: 'g_n5_04', to: 'g_n5_06', d: 'M 130 320 C 130 380, 250 380, 250 440' },
  { from: 'g_n5_05', to: 'g_n5_06', d: 'M 370 320 C 370 380, 250 380, 250 440' },
  { from: 'g_n5_06', to: 'g_n5_07', d: 'M 250 440 L 250 560' },
  { from: 'g_n5_07', to: 'g_n5_08', d: 'M 250 560 C 250 620, 130 620, 130 680' },
  { from: 'g_n5_07', to: 'g_n5_09', d: 'M 250 560 C 250 620, 370 620, 370 680' },
  { from: 'g_n5_08', to: 'g_n5_10', d: 'M 130 680 C 130 740, 250 740, 250 800' },
  { from: 'g_n5_09', to: 'g_n5_10', d: 'M 370 680 C 370 740, 250 740, 250 800' },
];

export const GrammarTrack: React.FC<GrammarTrackProps> = ({ grammarProgress, onSelectRule }) => {
  const { t } = useJapanification();
  const [activePopover, setActivePopover] = useState<number | null>(null);

  const intervals = [1, 3, 7, 14, 30];

  // Создаем единый список узлов
  const allRules = [
    ...grammarRules.map(r => ({ ...r, isPlaceholder: false })),
    ...placeholders
  ];

  const nodes = allRules.map((rule) => {
    const progress = grammarProgress[rule.id];
    let isLocked = false;

    // Условия разблокировки ветвей:
    if (rule.id === 'g_n5_02') {
      const p1 = grammarProgress['g_n5_01'];
      isLocked = !p1 || p1.status === 'new';
    } else if (rule.id === 'g_n5_04') {
      const p2 = grammarProgress['g_n5_02'];
      isLocked = !p2 || p2.status === 'new';
    } else if (rule.id === 'g_n5_03') {
      const p1 = grammarProgress['g_n5_01'];
      isLocked = !p1 || p1.status === 'new';
    } else if (rule.id === 'g_n5_05') {
      const p3 = grammarProgress['g_n5_03'];
      isLocked = !p3 || p3.status === 'new';
    } else if (rule.isPlaceholder) {
      isLocked = true;
    }

    let status: 'locked' | 'new' | 'learning' | 'review' | 'mature' = 'locked';
    if (!isLocked) {
      if (!progress) {
        status = 'new';
      } else {
        status = progress.status;
      }
    }

    return {
      ...rule,
      status,
      isLocked,
      progress,
      coords: getCoords(rule.id),
    };
  });

  const handleNodeClick = (idx: number, isLocked: boolean) => {
    if (isLocked) return;
    setActivePopover(activePopover === idx ? null : idx);
  };

  const getStatusText = (status: string, stepIndex?: number) => {
    if (status === 'locked') return t('Заблокировано', 'ロックされています');
    if (status === 'new') return t('Не изучено', '未学習');
    const step = stepIndex !== undefined ? stepIndex + 1 : 1;
    if (status === 'mature') return t(`Изучено (Шаг ${step}/5)`, `習得済 (ステップ ${step}/5)`);
    return t(`На изучении (Шаг ${step}/5)`, `学習中 (ステップ ${step}/5)`);
  };

  const isConnectionActive = (toId: string) => {
    const toProgress = grammarProgress[toId];
    return toProgress && toProgress.status !== 'new';
  };

  return (
    <div className={styles.trackContainer}>
      <div className={styles.nodeList} style={{ width: '500px', height: '900px' }}>
        {/* SVG Соединительные линии на фоне */}
        <svg className={styles.svgConnector} viewBox="0 0 500 900">
          {connections.map((conn, cIdx) => {
            const active = isConnectionActive(conn.to);
            return (
              <g key={cIdx}>
                {/* Dashed base line (gray) */}
                <path d={conn.d} className={styles.connectorLineDashed} />
                {/* Active progress line (green) */}
                {active && <path d={conn.d} className={styles.connectorLine} />}
              </g>
            );
          })}
        </svg>

        {/* Узлы на дорожке */}
        {nodes.map((node, idx) => {
          const isLocked = node.isLocked;
          const isCompleted = node.status === 'mature';
          const isNew = node.status === 'new';
          const isLearning = node.status === 'learning' || node.status === 'review';

          let nodeClass = styles.trackNode;
          if (isLocked) nodeClass += ` ${styles.locked}`;
          else if (isCompleted) nodeClass += ` ${styles.completed}`;
          else if (isLearning) nodeClass += ` ${styles.learning}`;
          else nodeClass += ` ${styles.new}`;

          const isPopoverLeft = node.coords.x < 200;
          const popoverClassName = isPopoverLeft 
            ? `${styles.popoverCard} ${styles.popoverLeft}`
            : `${styles.popoverCard} ${styles.popoverRight}`;

          return (
            <div
              key={node.id}
              className={`${styles.nodeWrapper} ${activePopover === idx ? styles.activeWrapper : ''}`}
              style={{ left: node.coords.x, top: node.coords.y }}
            >
              <button
                type="button"
                onClick={() => handleNodeClick(idx, isLocked)}
                className={nodeClass}
                disabled={isLocked}
                title={node.topic}
              >
                <div className={styles.nodeInner}>
                  {isLocked ? (
                    <Lock size={20} />
                  ) : isCompleted ? (
                    <Check size={22} className={styles.checkIcon} />
                  ) : (
                    <span className={styles.nodeNumber}>{idx + 1}</span>
                  )}
                </div>
              </button>
              {/* Текст под узлом */}
              <span className={styles.nodeLabel}>{node.construction}</span>

              {/* POPOVER DETAIL CARD */}
              {activePopover === idx && (
                <div className={popoverClassName}>
                  <div className={styles.popoverHeader}>
                    <h4 className={styles.popoverTitle}>{node.construction}</h4>
                    <span className={styles.popoverTopic}>{node.topic}</span>
                  </div>
                  
                  <div className={styles.popoverContent}>
                    <p className={styles.popoverDesc}>{node.explanation}</p>
                    <div className={styles.popoverStatus}>
                      <span className={styles.statusLabel}>{t('Статус:', 'ステータс:')}</span>
                      <span className={`${styles.statusVal} ${styles[node.status]}`}>
                        {getStatusText(node.status, node.progress?.stepIndex)}
                      </span>
                    </div>
                    {node.progress && node.progress.due && (
                      <div className={styles.popoverStatus}>
                        <span className={styles.statusLabel}>{t('Повторение через:', '次回の復習:')}</span>
                        <span className={styles.statusVal}>
                          {intervals[node.progress.stepIndex]} {t('дн.', '日')}
                          {node.progress.due <= Date.now() && ` (${t('Доступно!', '今すぐ!')})`}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className={styles.popoverActions}>
                    <button
                      type="button"
                      onClick={() => {
                        setActivePopover(null);
                        onSelectRule(node.id);
                      }}
                      className="btn-3d btn-green"
                      style={{ width: '100%', padding: '10px 0', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <BookOpen size={16} />
                      {isNew ? t('Начать изучение', '学習を始める') : t('Перейти к тренировке', '練習する')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
