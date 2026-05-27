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

// Плейсхолдеры для конструкций, которые следуют ПОСЛЕ основной лестницы ступеней 1–6
const placeholders = [
  {
    id: 'g_n5_s7',
    construction: '〜た / 〜たことがある',
    topic: 'Прошедшее простое (た-форма)',
    translation: 'Делал / Приходилось делать...',
    explanation: 'Прошедшее простое время образуется по тем же правилам, что и て-форма, с заменой て→た, で→だ. Конструкция 〜たことがある выражает опыт в прошлом.',
    isPlaceholder: true,
  },
  {
    id: 'g_n5_s8',
    construction: '〜たり...たりする',
    topic: 'Перечисление действий',
    translation: 'Делать то одно, то другое',
    explanation: 'Конструкция для неисчерпывающего перечисления действий: V-た + り...V-た + りする.',
    isPlaceholder: true,
  },
  {
    id: 'g_n5_s9',
    construction: '〜ながら',
    topic: 'Одновременность',
    translation: 'Делая одновременно...',
    explanation: 'Используется для описания двух действий, совершаемых одновременно одним лицом (V-masu + ながら).',
    isPlaceholder: true,
  },
  {
    id: 'g_n5_exam',
    construction: 'JLPT N5 Финал',
    topic: 'Аттестация',
    translation: 'Итоговый экзамен',
    explanation: 'Комплексный экзамен на знание всей грамматики и лексики уровня N5.',
    isPlaceholder: true,
  },
];

// Координаты узлов на SVG-канвасе (змейковый маршрут)
const getCoords = (id: string) => {
  switch (id) {
    // Активные ступени (1.1 → 1.2 → 2 → 3 → 4 → 5 → 6) — змейка
    case 'g_n5_s1_1': return { x: 250, y: 80 };    // Центр — старт
    case 'g_n5_s1_2': return { x: 130, y: 200 };    // Влево
    case 'g_n5_s2':   return { x: 370, y: 320 };    // Вправо
    case 'g_n5_s3':   return { x: 130, y: 440 };    // Влево
    case 'g_n5_s4':   return { x: 370, y: 560 };    // Вправо
    case 'g_n5_s5':   return { x: 130, y: 680 };    // Влево
    case 'g_n5_s6':   return { x: 370, y: 800 };    // Вправо

    // Плейсхолдеры — продолжение змейки
    case 'g_n5_s7':   return { x: 250, y: 920 };    // Центр
    case 'g_n5_s8':   return { x: 130, y: 1040 };   // Влево
    case 'g_n5_s9':   return { x: 370, y: 1040 };   // Вправо
    case 'g_n5_exam': return { x: 250, y: 1160 };   // Центр — финал

    default: return { x: 250, y: 80 };
  }
};

// SVG-пути соединений между узлами (Безье-кривые для красивой змейки)
const connections = [
  // Основная лестница: линейная цепь 1.1 → 1.2 → 2 → 3 → 4 → 5 → 6
  { from: 'g_n5_s1_1', to: 'g_n5_s1_2', d: 'M 250 80 C 250 140, 130 140, 130 200' },
  { from: 'g_n5_s1_2', to: 'g_n5_s2',   d: 'M 130 200 C 130 260, 370 260, 370 320' },
  { from: 'g_n5_s2',   to: 'g_n5_s3',   d: 'M 370 320 C 370 380, 130 380, 130 440' },
  { from: 'g_n5_s3',   to: 'g_n5_s4',   d: 'M 130 440 C 130 500, 370 500, 370 560' },
  { from: 'g_n5_s4',   to: 'g_n5_s5',   d: 'M 370 560 C 370 620, 130 620, 130 680' },
  { from: 'g_n5_s5',   to: 'g_n5_s6',   d: 'M 130 680 C 130 740, 370 740, 370 800' },

  // Плейсхолдеры: 6 → 7 → (8, 9) → экзамен
  { from: 'g_n5_s6',   to: 'g_n5_s7',   d: 'M 370 800 C 370 860, 250 860, 250 920' },
  { from: 'g_n5_s7',   to: 'g_n5_s8',   d: 'M 250 920 C 250 980, 130 980, 130 1040' },
  { from: 'g_n5_s7',   to: 'g_n5_s9',   d: 'M 250 920 C 250 980, 370 980, 370 1040' },
  { from: 'g_n5_s8',   to: 'g_n5_exam', d: 'M 130 1040 C 130 1100, 250 1100, 250 1160' },
  { from: 'g_n5_s9',   to: 'g_n5_exam', d: 'M 370 1040 C 370 1100, 250 1100, 250 1160' },
];

// Строгая линейная цепь разблокировки: каждая ступень требует завершения предыдущей
const UNLOCK_CHAIN: Record<string, string> = {
  'g_n5_s1_2': 'g_n5_s1_1',  // 1.2 разблокируется после 1.1
  'g_n5_s2':   'g_n5_s1_2',  // 2 разблокируется после 1.2
  'g_n5_s3':   'g_n5_s2',    // 3 разблокируется после 2
  'g_n5_s4':   'g_n5_s3',    // 4 (ない) разблокируется после 3 (ます)
  'g_n5_s5':   'g_n5_s4',    // 5 (て) разблокируется после 4 (ない)
  'g_n5_s6':   'g_n5_s5',    // 6 (конструкции на て) разблокируется после 5 (て-форма)
};

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

export const GrammarTrack: React.FC<GrammarTrackProps> = ({ grammarProgress, onSelectRule }) => {
  const { t } = useJapanification();
  const [activePopover, setActivePopover] = useState<number | null>(null);

  const intervals = [1, 3, 7, 14, 30];

  // Создаем единый список узлов из правил + плейсхолдеров
  const allRules = [
    ...grammarRules.map(r => ({ ...r, isPlaceholder: false })),
    ...placeholders
  ];

  const nodes = allRules.map((rule) => {
    const progress = grammarProgress[rule.id];
    let isLocked = false;

    // Плейсхолдеры всегда заблокированы
    if (rule.isPlaceholder) {
      isLocked = true;
    } else {
      // Проверяем цепь разблокировки: предыдущая ступень должна быть начата
      const prerequisiteId = UNLOCK_CHAIN[rule.id];
      if (prerequisiteId) {
        const prerequisite = grammarProgress[prerequisiteId];
        isLocked = !prerequisite || prerequisite.status === 'new';
      }
      // g_n5_s1_1 — всегда разблокирован (нет пререквизита)
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
      <div className={styles.nodeList} style={{ width: '500px', height: '1260px' }}>
        {/* SVG Соединительные линии на фоне */}
        <svg className={styles.svgConnector} viewBox="0 0 500 1260">
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
