'use client';

import React, { useState } from 'react';
import { Lock, Check, Play, BookOpen } from 'lucide-react';
import grammarRules from '@/resources/grammar_rules.json';
import { useJapanification } from '@/hooks/useJapanification';
import type { GrammarProgress } from '@/core/db';
import styles from './GrammarTrack.module.css';

interface GrammarTrackProps {
  grammarProgress: Record<string, GrammarProgress>;
  onSelectRule: (ruleId: string) => void;
}

export const GrammarTrack: React.FC<GrammarTrackProps> = ({ grammarProgress, onSelectRule }) => {
  const { t } = useJapanification();
  const [activePopover, setActivePopover] = useState<number | null>(null);

  // Определение координат узлов на сетке 500x700
  const coordinates = [
    { x: 250, y: 80 },  // Узел 1 (g_n5_01)
    { x: 130, y: 220 }, // Узел 2 (g_n5_02)
    { x: 370, y: 360 }, // Узел 3 (g_n5_03)
    { x: 130, y: 500 }, // Узел 4 (g_n5_04)
    { x: 250, y: 620 }, // Узел 5 (g_n5_05)
  ];

  const intervals = [1, 3, 7, 14, 30];

  // Вычисление статусов и построение узлов
  const nodes = grammarRules.map((rule, idx) => {
    const progress = grammarProgress[rule.id];
    
    // Правило 1 разблокировано по умолчанию
    let isLocked = false;
    if (idx > 0) {
      const prevRule = grammarRules[idx - 1];
      const prevProgress = grammarProgress[prevRule.id];
      // Разблокировано если у предыдущего есть прогресс и он не new
      isLocked = !prevProgress || prevProgress.status === 'new';
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
      coords: coordinates[idx] || { x: 250, y: 80 },
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

  // Подсчет пройденного прогресса для отображения закрашенной линии
  const getProgressOffset = () => {
    let completedCount = 0;
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].status !== 'locked' && nodes[i].status !== 'new') {
        completedCount++;
      } else {
        break;
      }
    }
    
    // Возвращаем strokeDashoffset для SVG линии прогресса
    if (completedCount === 5) return '0';
    if (completedCount === 4) return '150';
    if (completedCount === 3) return '330';
    if (completedCount === 2) return '510';
    if (completedCount === 1) return '690';
    return '850';
  };

  return (
    <div className={styles.trackContainer}>
      <div className={styles.nodeList} style={{ width: '500px' }}>
        {/* SVG Соединительные линии на фоне */}
        <svg className={styles.svgConnector} viewBox="0 0 500 700">
          <path
            d="M 250 80 C 250 150, 130 150, 130 220 C 130 290, 370 290, 370 360 C 370 430, 130 430, 130 500 C 130 570, 250 570, 250 620"
            className={styles.connectorLineDashed}
          />
          {/* Линия пройденного прогресса */}
          <path
            d="M 250 80 C 250 150, 130 150, 130 220 C 130 290, 370 290, 370 360 C 370 430, 130 430, 130 500 C 130 570, 250 570, 250 620"
            className={styles.connectorLine}
            strokeDasharray="850"
            strokeDashoffset={getProgressOffset()}
            style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
          />
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
                {/* Текст под узлом */}
                <span className={styles.nodeLabel}>{node.construction}</span>
              </button>

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
                      <span className={styles.statusLabel}>{t('Статус:', 'ステータス:')}</span>
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
