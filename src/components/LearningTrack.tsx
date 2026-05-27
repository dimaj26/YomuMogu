'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Play, BookOpen, Lock, Check, X } from 'lucide-react';
import { useJapanification } from '@/hooks/useJapanification';
import styles from './LearningTrack.module.css';

interface TargetWord {
  word: string;
  translation: string;
}

interface GeneratedSession {
  id: string;
  title: string;
  description: string;
  scenario: string;
  targetWords: TargetWord[];
}

interface LearningTrackProps {
  sessions: GeneratedSession[];
  inProgressSessions: Set<string>;
  completedSessions: Set<string>;
  dueReviewsCount: number;
  completedSessionsCountToday: number;
  onStartSession: (session: GeneratedSession) => void;
  onDiscardSession: (sessionId: string) => void;
}

export function LearningTrack({
  sessions,
  inProgressSessions,
  completedSessions,
  dueReviewsCount,
  completedSessionsCountToday,
  onStartSession,
  onDiscardSession,
}: LearningTrackProps) {
  const router = useRouter();
  const { t } = useJapanification();
  const [activePopover, setActivePopover] = useState<number | null>(null);

  // Определение координат узлов на сетке 500x700
  const coordinates = [
    { x: 250, y: 80 },  // Узел 1 (Сессия 1)
    { x: 130, y: 220 }, // Узел 2 (Сессия 2)
    { x: 370, y: 360 }, // Узел 3 (Сессия 3)
    { x: 250, y: 500 }, // Узел 4 (Марафон повторений)
    { x: 250, y: 620 }, // Узел 5 (Бонус-викторина)
  ];

  // Вычисление статусов каждого узла
  const nodes = [
    // Узел 1: Сессия 1
    {
      type: 'session',
      title: sessions[0]?.title || t('Сессия 1', 'セッション 1'),
      description: sessions[0]?.description || t('Разговорная практика слов', '単語の会話練習'),
      status: sessions[0]
        ? completedSessions.has(sessions[0].id)
          ? 'completed'
          : inProgressSessions.has(sessions[0].id)
          ? 'in-progress'
          : 'available'
        : 'locked',
      sessionData: sessions[0],
    },
    // Узел 2: Сессия 2
    {
      type: 'session',
      title: sessions[1]?.title || t('Сессия 2', 'セッション 2'),
      description: sessions[1]?.description || t('Разговорная практика слов', '単語の会話練習'),
      status: sessions[1]
        ? completedSessions.has(sessions[0]?.id)
          ? completedSessions.has(sessions[1].id)
            ? 'completed'
            : inProgressSessions.has(sessions[1].id)
            ? 'in-progress'
            : 'available'
          : 'locked'
        : 'locked',
      sessionData: sessions[1],
    },
    // Узел 3: Сессия 3
    {
      type: 'session',
      title: sessions[2]?.title || t('Сессия 3', 'セッション 3'),
      description: sessions[2]?.description || t('Разговорная практика слов', '単語の会話練習'),
      status: sessions[2]
        ? completedSessions.has(sessions[1]?.id)
          ? completedSessions.has(sessions[2].id)
            ? 'completed'
            : inProgressSessions.has(sessions[2].id)
            ? 'in-progress'
            : 'available'
          : 'locked'
        : 'locked',
      sessionData: sessions[2],
    },
    // Узел 4: Марафон повторений ( reviews )
    {
      type: 'review',
      title: t('Марафон повторения', '復習マラソン'),
      description: t('Активное FSRS-повторение накопленных слов в квизе.', 'Quizでこれまでに学んだ単語の復習をします。'),
      status: completedSessions.has(sessions[2]?.id) || sessions.length === 0
        ? dueReviewsCount > 0
          ? 'available'
          : 'completed'
        : 'locked',
      count: dueReviewsCount,
    },
    // Узел 5: Бонус-викторина
    {
      type: 'quiz',
      title: t('Бонусная викторина', 'ボーナスクイズ'),
      description: t('Финальное закрепление. Откроется после завершения хотя бы одной сессии сегодня.', '今日セッションをクリアするとアンロックされます。'),
      status: completedSessionsCountToday > 0 ? 'available' : 'locked',
    },
  ];

  return (
    <div className={styles.trackContainer}>
      <div className={styles.nodeList} style={{ width: '500px' }}>
        {/* SVG Соединительные линии на фоне */}
        <svg className={styles.svgConnector} viewBox="0 0 500 700">
          <path
            d="M 250 80 C 250 150, 130 150, 130 220 C 130 290, 370 290, 370 360 C 370 430, 250 430, 250 500 L 250 620"
            className={styles.connectorLineDashed}
          />
          {/* Линия пройденного прогресса (закрашивается сплошным цветом) */}
          <path
            d="M 250 80 C 250 150, 130 150, 130 220 C 130 290, 370 290, 370 360 C 370 430, 250 430, 250 500 L 250 620"
            className={styles.connectorLine}
            strokeDasharray="700"
            strokeDashoffset={
              nodes[4].status === 'available' || nodes[4].status === 'completed'
                ? '0'
                : nodes[2].status === 'completed'
                ? '150'
                : nodes[1].status === 'completed'
                ? '350'
                : nodes[0].status === 'completed'
                ? '520'
                : '700'
            }
            style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
          />
        </svg>

        {/* Интерактивные узлы */}
        {nodes.map((node, idx) => {
          const coord = coordinates[idx];
          const isPopoverActive = activePopover === idx;
          
          let btnClass = styles.nodeBtn;
          if (node.status === 'completed') btnClass += ` ${styles.nodeCompleted}`;
          else if (node.status === 'in-progress') btnClass += ` ${styles.nodeInProgress}`;
          else if (node.status === 'available') btnClass += ` ${styles.nodeAvailable}`;
          else btnClass += ` ${styles.nodeLocked}`;

          const isPopoverLeft = coord.x < 200;
          const popoverClassName = isPopoverLeft 
            ? `${styles.popover} ${styles.popoverLeft}`
            : `${styles.popover} ${styles.popoverRight}`;

          return (
            <div
              key={idx}
              className={`${styles.trackNodeWrapper} ${isPopoverActive ? styles.activeWrapper : ''}`}
              style={{ left: `${coord.x}px`, top: `${coord.y}px` }}
            >
              <button
                type="button"
                className={btnClass}
                disabled={node.status === 'locked'}
                onClick={() => setActivePopover(isPopoverActive ? null : idx)}
                title={node.title}
              >
                {node.status === 'completed' ? (
                  <Check size={28} />
                ) : node.status === 'locked' ? (
                  <Lock size={24} />
                ) : node.type === 'session' ? (
                  <Play size={24} style={{ marginLeft: '4px' }} />
                ) : node.type === 'review' ? (
                  <BookOpen size={24} />
                ) : (
                  <Sparkles size={24} />
                )}
              </button>
              <span className={styles.nodeLabel}>{node.title}</span>

              {/* Рендер всплывающего окна (Popover) */}
              {isPopoverActive && (
                <div className={popoverClassName}>
                  <div className={styles.popoverHeader}>
                    <h5 className={styles.popoverTitle}>{node.title}</h5>
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
                  <p className={styles.popoverDesc}>{node.description}</p>

                  {/* Целевые слова для разговорных сессий */}
                  {node.type === 'session' && node.sessionData && (
                    <>
                      <div className={styles.wordsTitle}>{t('Целевые слова:', '目標単語:')}</div>
                      <div className={styles.wordBadgeList}>
                        {node.sessionData.targetWords.map((w, wIdx) => (
                          <span key={wIdx} className={styles.wordBadge}>
                            {w.translation}
                          </span>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Кнопки действий */}
                  <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                    {node.type === 'session' && node.sessionData && (
                      node.status === 'in-progress' ? (
                        <>
                          <button
                            type="button"
                            className="btn-3d btn-blue"
                            style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }}
                            onClick={() => onStartSession(node.sessionData!)}
                          >
                            {t('Продолжить', '続ける')}
                          </button>
                          <button
                            type="button"
                            className="btn-3d btn-red"
                            style={{ padding: '8px 12px', fontSize: '13px' }}
                            onClick={() => {
                              onDiscardSession(node.sessionData!.id);
                              setActivePopover(null);
                            }}
                          >
                            {t('Сброс', 'リセット')}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn-3d btn-green"
                          style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
                          onClick={() => onStartSession(node.sessionData!)}
                        >
                          {t('Начать практику', '練習開始')}
                        </button>
                      )
                    )}

                    {node.type === 'review' && (
                      <button
                        type="button"
                        className="btn-3d btn-orange"
                        style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
                        disabled={node.count === 0}
                        onClick={() => {
                          router.push('/practice/quiz?mode=review');
                          setActivePopover(null);
                        }}
                      >
                        {t('Повторить', '復習する')} ({node.count})
                      </button>
                    )}

                    {node.type === 'quiz' && (
                      <button
                        type="button"
                        className="btn-3d btn-green"
                        style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
                        onClick={() => {
                          router.push('/practice/quiz?mode=new');
                          setActivePopover(null);
                        }}
                      >
                        {t('Начать квиз', 'クиз開始')}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
