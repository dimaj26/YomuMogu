'use client';

import React, { useState } from 'react';
import { Lock, Check, BookOpen } from 'lucide-react';
import grammarRules from '@/resources/grammar_rules.json';
import { useJapanification } from '@/hooks/useJapanification';
import type { GrammarProgress } from '@/core/db';
import { isNodeUnlocked, getEdges, GrammarGraphNode } from '@/lib/grammar/graph';
import styles from './GrammarTrack.module.css';
import { GRAMMAR_LEITNER_INTERVALS_DAYS } from '@/core/intervals';

interface GrammarTrackProps {
  grammarProgress: Record<string, GrammarProgress>;
  onSelectRule: (ruleId: string) => void;
}

// Метки для нумерации ступеней (1.1, 1.2, 2, 3, 4, 5, 6)
const STEP_LABELS: Record<string, string> = {
  'g_n5_s1_1': '1.1',
  'g_n5_s1_2': '1.2',
  'g_n5_s2':   '2',
  'g_n5_s3':   '3',
  'g_n5_s4':   '4',
  'g_n5_s5':   '5',
  'g_n5_s6':   '6',
};

interface ExtendedGrammarNode extends GrammarGraphNode {
  construction: string;
  topic: string;
  translation: string;
  explanation: string;
  coords: { x: number; y: number };
}

export const GrammarTrack: React.FC<GrammarTrackProps> = ({ grammarProgress, onSelectRule }) => {
  const { t } = useJapanification();
  const [activePopover, setActivePopover] = useState<number | null>(null);

  const intervals = GRAMMAR_LEITNER_INTERVALS_DAYS;

  const allRules = grammarRules as ExtendedGrammarNode[];

  // Генерируем пути рёбер программно на основе пререквизитов и координат из JSON
  const edges = getEdges(allRules);
  const connections = edges.map(edge => {
    const fromNode = allRules.find(n => n.id === edge.from);
    const toNode = allRules.find(n => n.id === edge.to);
    const fromCoords = fromNode?.coords || { x: 250, y: 80 };
    const toCoords = toNode?.coords || { x: 250, y: 80 };

    // Формула пути: M x1 y1 C x1 (y1+60), x2 (y2-60), x2 y2
    const d = `M ${fromCoords.x} ${fromCoords.y} C ${fromCoords.x} ${fromCoords.y + 60}, ${toCoords.x} ${toCoords.y - 60}, ${toCoords.x} ${toCoords.y}`;
    return {
      from: edge.from,
      to: edge.to,
      d
    };
  });

  const nodes = allRules.map((rule) => {
    const progress = grammarProgress[rule.id];
    const isLocked = !isNodeUnlocked(rule.id, allRules, grammarProgress);

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
      coords: rule.coords || { x: 250, y: 80 },
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
      <div className={styles.nodeList} style={{ width: '500px', height: '940px' }}>
        {/* SVG Соединительные линии на фоне */}
        <svg className={styles.svgConnector} viewBox="0 0 500 940">
          {connections.map((conn, cIdx) => {
            const active = isConnectionActive(conn.to);
            return (
              <g key={cIdx}>
                {/* Пунктирная базовая линия (серая) */}
                <path d={conn.d} className={styles.connectorLineDashed} />
                {/* Активная линия прогресса (зелёная) */}
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

          // Определяем метку узла: для активных ступеней — номер ступени, иначе порядковый индекс
          const stepLabel = STEP_LABELS[node.id];

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
                    <span className={styles.nodeNumber}>{stepLabel || (idx + 1)}</span>
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
