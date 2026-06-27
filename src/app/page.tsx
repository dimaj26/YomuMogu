'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Settings, User, HelpCircle, X, Award, BarChart2 } from 'lucide-react';
import { db } from '@/core/db';
import { useJapanification } from '@/hooks/useJapanification';
import { getProfileItem, removeProfileItem, getProfilesList, getActiveProfileId, setActiveProfileId, ProfileInfo } from '@/lib/profile';
import { isLocalDeckInitialized, getPriorityWordsCount, LOCAL_DECK_NAME } from '@/core/localDeckService';
import { JpUI } from '@/components/JpUI';
import { AssessmentModal } from '@/components/AssessmentModal';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import styles from './page.module.css';
import { sanitizeHtml } from '@/lib/sanitize';

// Возвращает пороги очков для уровней на нормальной скорости (дефолтная скорость для отображения в профиле)
const NORMAL_THRESHOLDS = [0, 20, 50, 100, 170, 280, 420];

export const MASCOT_PHRASES = [
  { ja: "頑張って！", reading: "がんばって", ru: "Постарайся! / Удачи!" },
  { ja: "お茶をどうぞ！", reading: "おちゃをどうぞ", ru: "Пожалуйста, выпей чаю!" },
  { ja: "日本語は面白いですね！", reading: "にほんごはおもしろいですね", ru: "Японский язык интересный, не правда ли?" },
  { ja: "一歩一歩進みましょう！", reading: "いっぽいっぽすすみましょう", ru: "Давай продвигаться шаг за шагом!" },
  { ja: "今日も素晴らしい日です！", reading: "きょうもすばらしいひです", ru: "Сегодня тоже отличный день!" }
];

export default function HomePage() {
  const router = useRouter();
  const { state: jState, t } = useJapanification();

  // Состояния для сессии
  const [activeSession, setActiveSession] = useState<{ id: string; title: string } | null>(null);
  const [hasActiveChat, setHasActiveChat] = useState<boolean>(false);
  const [collectedWordsCount, setCollectedWordsCount] = useState<number>(0);
  const [totalWordsCount, setTotalWordsCount] = useState<number>(0);

  // Состояния для профилей
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [activeProfileId, setActiveProfileIdState] = useState<string>('default');

  // Состояния для модальных окон
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [helpTab, setHelpTab] = useState<'about' | 'rules' | 'japanification'>('about');

  const [hasLoaded, setHasLoaded] = useState<boolean>(false);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [customBubbleText, setCustomBubbleText] = useState<string | null>(null);
  const [heatmapCells, setHeatmapCells] = useState<Array<{ status: string; isDue: boolean; avgStability: number }>>([]);
  const [deckWordCount, setDeckWordCount] = useState<number>(0);

  // Сигналы состояния локальной колоды для адаптивного CTA (читаются из localDeckService)
  const [deckMode, setDeckMode] = useState<string>('local');
  const [isLocalInit, setIsLocalInit] = useState<boolean>(false);
  const [dueReviewCount, setDueReviewCount] = useState<number>(0);
  const [priorityCount, setPriorityCount] = useState<number>(0);
  const [deckLoaded, setDeckLoaded] = useState<boolean>(false);
  const [showAssessment, setShowAssessment] = useState<boolean>(false);

  // Загрузка сигналов колоды: режим, инициализация, число due-повторений и приоритетных слов
  const loadDeckSignals = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const mode = getProfileItem('deck_mode') || 'local';
    const initialized = await isLocalDeckInitialized(activeProfileId);
    const priority = await getPriorityWordsCount(activeProfileId, LOCAL_DECK_NAME);

    // Число due-повторений считаем отдельно, чтобы отличить «вернувшегося» от «новичка»
    const words = await db.words
      .where('profileId')
      .equals(activeProfileId)
      .filter(w => w.category === LOCAL_DECK_NAME)
      .toArray();
    const now = Date.now();
    const due = words.filter(w =>
      w.active.status !== 'new' && w.active.due <= now
    ).length;

    setDeckMode(mode);
    setIsLocalInit(initialized);
    setPriorityCount(priority);
    setDueReviewCount(due);
    setDeckLoaded(true);
  }, [activeProfileId]);

  useEffect(() => {
    loadDeckSignals().catch(err => console.error('Ошибка загрузки сигналов колоды', err));
  }, [loadDeckSignals]);

  // Загружаем слова из базы данных для тепловой карты памяти при изменении активного профиля
  useEffect(() => {
    if (typeof window === 'undefined') return;

    db.words
      .where('profileId')
      .equals(activeProfileId)
      .toArray()
      .then((words) => {
        // Динамический размер корзины: 50 ячеек покрывают ВСЮ колоду, а не только первые 500.
        const bucket = Math.max(1, Math.ceil(words.length / 50));
        const cells = Array.from({ length: 50 }, (_, cellIndex) => {
          const startIdx = cellIndex * bucket;
          const group = words.slice(startIdx, startIdx + bucket);
          
          if (group.length === 0) {
            return { status: 'new', isDue: false, avgStability: 0 };
          }
          
          let newCount = 0;
          let learningCount = 0;
          let reviewCount = 0;
          let matureCount = 0;
          let dueCount = 0;
          let totalStability = 0;
          const now = Date.now();
          
          group.forEach(w => {
            const activeState = w.active || w;
            const status = activeState.status || 'new';
            const due = activeState.due || now;
            const stability = activeState.stability || 0;
            
            totalStability += stability;
            
            if (status === 'new') newCount++;
            else if (status === 'learning') learningCount++;
            else if (status === 'review') reviewCount++;
            else if (status === 'mature') matureCount++;
            
            if (due <= now && status !== 'new') {
              dueCount++;
            }
          });
          
          let dominantStatus = 'new';
          let maxCount = newCount;
          if (learningCount > maxCount) {
            dominantStatus = 'learning';
            maxCount = learningCount;
          }
          if (reviewCount > maxCount) {
            dominantStatus = 'review';
            maxCount = reviewCount;
          }
          if (matureCount > maxCount) {
            dominantStatus = 'mature';
            maxCount = matureCount;
          }
          
          return {
            status: dominantStatus,
            isDue: dueCount > 0,
            avgStability: totalStability / group.length
          };
        });
        setHeatmapCells(cells);
        setDeckWordCount(words.length);
      })
      .catch((err) => {
        console.error('Ошибка загрузки слов для тепловой карты', err);
      });
  }, [activeProfileId]);

  // Обработчик клика на маскота
  const handleMascotClick = () => {
    if (isAnimating) return;
    setIsAnimating(true);

    const phrase = MASCOT_PHRASES[Math.floor(Math.random() * MASCOT_PHRASES.length)];
    const htmlText = `<ruby>${phrase.ja}<rt>${phrase.reading}</rt></ruby> — ${phrase.ru}`;
    setCustomBubbleText(htmlText);

    setTimeout(() => {
      setCustomBubbleText(null);
    }, 4000);
  };

  // Загружаем данные профиля и сессии при монтировании (защита от несовпадений гидратации SSR)
  useEffect(() => {
    try {
      // 1. Профили
      setProfiles(getProfilesList());
      setActiveProfileIdState(getActiveProfileId());

      // 2. Активная сессия
      const activeStr = getProfileItem('active_session');
      if (activeStr) {
        const parsed = JSON.parse(activeStr);
        if (parsed && parsed.id && parsed.title) {
          setActiveSession(parsed);
          if (parsed.targetWords) {
            setTotalWordsCount(parsed.targetWords.length);
          }

          // Проверяем сохраненное состояние чата
          const savedStateStr = getProfileItem(`chat_state_${parsed.id}`);
          if (savedStateStr) {
            const savedState = JSON.parse(savedStateStr);
            if (savedState && savedState.messages && savedState.messages.length > 0) {
              setHasActiveChat(true);
              if (savedState.collectedWords) {
                setCollectedWordsCount(savedState.collectedWords.length);
              }
            }
          }
        }
      }
    } catch {
      // Ошибки парсинга локального хранилища
    } finally {
      setHasLoaded(true);
    }
  }, []);

  const handleSwitchProfile = (profileId: string) => {
    setActiveProfileId(profileId);
    setActiveProfileIdState(profileId);
    window.location.reload();
  };

  const handleDiscardSession = () => {
    if (window.confirm(t(
      "Вы действительно хотите сбросить текущую сессию диалога? Весь несинхронизированный прогресс будет потерян.",
      "現在のセッションをリセットしますか？未同期の進捗は失われます。",
      2
    ))) {
      removeProfileItem('active_session');
      if (activeSession?.id) {
        removeProfileItem(`chat_state_${activeSession.id}`);
      }
      setActiveSession(null);
      setHasActiveChat(false);
    }
  };


  // Возвращает текст облачка речи в зависимости от уровня японизации и статуса сессии
  const getMascotBubbleHtml = (state: DashState): { __html: string } => {
    if (customBubbleText) {
      return { __html: customBubbleText };
    }
    const level = jState.level;

    if (hasActiveChat && activeSession) {
      const title = activeSession.title;
      if (level === 0) {
        return { __html: `У тебя остался незавершенный диалог! Давай продолжим практику "${title}"?` };
      }
      if (level === 1 || level === 2) {
        return { __html: `<ruby>前<rt>まえ</rt></ruby>の<ruby>対話<rt>たいわ</rt></ruby>がまだ<ruby>終<rt>お</rt></ruby>わっていないよ！「${title}」を<ruby>続<rt>つづ</rt></ruby>けよう！` };
      }
      return { __html: `<ruby>前<rt>まえ</rt></ruby>の会話がまだ終わっていないよ！「${title}」を続けよう！` };
    }

    // Обычное приветствие
    switch (level) {
      case 0: {
        // Маскот подсказывает тот же следующий шаг, что и адаптивная кнопка (dashState).
        switch (state) {
          case 'first-run':
            return { __html: "Привет! Начни с диагностики — я подберу слова под тебя." };
          case 'newbie':
            return { __html: "Готов? Нажми «Начать разминку» — разомнёмся!" };
          case 'returning':
            return { __html: "С возвращением! Тебя ждут повторения — продолжим?" };
          case 'all-done':
            return { __html: "Отлично! На сегодня всё повторено. Можно отдохнуть 🍵" };
          default:
            return { __html: "Привет! Готов сегодня попрактиковаться?" };
        }
      }
      case 1:
      case 2:
        return { __html: "こんにちは！<ruby>今日<rt>きょう</rt></ruby>も<ruby>練習<rt>れんしゅう</rt></ruby>しましょう！" };
      default:
        return { __html: "こんにちは！今日も練習しましょう！" };
    }
  };

  // Вычисляем XP для текущего уровня на нормальной скорости (демонстрация в профиле)
  const getLevelXpRange = () => {
    const level = jState.level;
    const speed = jState.speed;
    
    // Вспомогательный расчет порогов на основе скорости
    const speedThresholds = {
      slow:   [0, 30, 80, 150, 250, 400, 600],
      normal: [0, 20, 50, 100, 170, 280, 420],
      fast:   [0, 10, 25,  50,  85, 140, 210],
    };
    
    const thresholds = speedThresholds[speed] || speedThresholds['normal'];
    
    if (level >= 6) {
      const current = thresholds[6];
      return { current, next: current, percent: 100, progress: current, total: current };
    }

    const current = thresholds[level];
    const next = thresholds[level + 1];
    const progress = jState.points - current;
    const total = next - current;
    const percent = Math.max(0, Math.min(100, Math.round((progress / total) * 100)));

    return { current, next, percent, progress, total };
  };

  const xpStats = getLevelXpRange();

  // Определяем состояние дневного хаба для адаптивного CTA.
  // Приоритет: незавершённый чат → (local) первый запуск / повторения / новые / всё сделано → Anki-режим.
  type DashState = 'resume' | 'first-run' | 'returning' | 'newbie' | 'all-done' | 'anki';
  let dashState: DashState;
  if (hasActiveChat && activeSession) {
    dashState = 'resume';
  } else if (deckMode === 'local') {
    if (!isLocalInit) dashState = 'first-run';
    else if (dueReviewCount > 0) dashState = 'returning';
    else if (priorityCount > 0) dashState = 'newbie';
    else dashState = 'all-done';
  } else {
    dashState = 'anki';
  }

  if (!hasLoaded) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-secondary)', alignItems: 'center', justifyContent: 'center' }}>
        <div className="btn-3d" style={{ pointerEvents: 'none' }}>Загрузка...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'transparent' }}>
      {/* HEADER */}
      <header className="navbar">
        <Link href="/" className="logo-container" style={{ textDecoration: 'none' }}>
          <BookOpen size={32} className="logo-text" />
          <span className="logo-text">YomuMogu</span>
        </Link>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <LanguageSwitcher />
          <button 
            onClick={() => setShowProfileModal(true)} 
            className="btn-3d btn-blue" 
            style={{ padding: '8px 12px', fontSize: '14px', textTransform: 'none' }}
          >
            <User size={18} style={{ marginRight: 6 }} />
            {profiles.find(p => p.id === activeProfileId)?.name || 'Профиль'}
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className={styles.dashboardContainer}>
        {/* MASCOT & SPEECH BUBBLE */}
        <div className={styles.mascotSection}>
          <div 
            className={`${styles.mascotContainer} ${isAnimating ? styles.mascotAnimated : ''}`} 
            title={t("Кликни меня!", "クリックしてね！", 2)}
            onClick={handleMascotClick}
            onAnimationEnd={() => setIsAnimating(false)}
          >
            🍵
          </div>
          <div className={styles.speechBubble}>
            <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(getMascotBubbleHtml(dashState).__html) }} />
          </div>
        </div>

        {/* ВСТРОЕННЫЙ ВИДЖЕТ ПРОГРЕССА И СТАТИСТИКИ */}
        <div className={styles.progressWidgetCard}>
          <div className={styles.widgetHeader}>
            <div className={styles.widgetTitle}>
              <Award size={18} style={{ color: 'var(--color-yellow)', marginRight: 6 }} />
              <span style={{ fontWeight: 800 }}>{t(`Уровень погружения: ${jState.level}`, `没入レベル: ${jState.level}`, 2)}</span>
            </div>
            <span className={styles.widgetXpText}>{jState.level >= 6 ? 'MAX' : `${jState.points} / ${xpStats.next} XP`}</span>
          </div>
          
          <div className={styles.widgetBarContainer}>
            <div 
              className={styles.widgetBarFill} 
              style={{ width: `${xpStats.percent}%` }}
            />
          </div>

          <div className={styles.widgetStatsRow}>
            <div className={styles.widgetStatItem}>
              <span className={styles.widgetStatVal}>{jState.totalWordsUsed}</span>
              <span className={styles.widgetStatLbl}>{t("слов использовано", "使用した単語数", 2)}</span>
            </div>
            <div className={styles.widgetDivider} />
            <div className={styles.widgetStatItem}>
              <span className={styles.widgetStatVal}>{jState.sessionsCompleted}</span>
              <span className={styles.widgetStatLbl}>{t("сессий завершено", "完了セッション数", 2)}</span>
            </div>
            <div className={styles.widgetDivider} />
            <div className={styles.widgetStatItem}>
              <span className={styles.widgetStatVal}>{jState.chatLevel}</span>
              <span className={styles.widgetStatLbl}>{t("сложность чата", "チャット難易度", 2)}</span>
            </div>
          </div>
        </div>

        {/* АДАПТИВНЫЙ ЗАГОЛОВОК: маркетинговый — только в первом запуске, иначе компактный по состоянию */}
        {dashState === 'first-run' ? (
          <>
            <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px', lineHeight: '1.2' }}>
              {t("Превратите ваши слова в живую речь!", "あなたの単語を生きた言葉に！", 2)}
            </h1>
            <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '32px', maxWidth: '600px', lineHeight: '1.6' }}>
              {t(
                "YomuMogu даёт встроенную колоду японских слов и помогает практиковать их в диалоге с ИИ-тьютором. Любите Anki — подключите свою колоду в настройках.",
                "YomuMoguには日本語の単語帳が内蔵されており、AI先生との対話で練習できます。Ankiをお使いの方は設定から連携できます。",
                2
              )}
            </p>
          </>
        ) : (
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '24px', lineHeight: '1.2' }}>
            {dashState === 'newbie'
              ? t("Начнём с разминки!", "ウォームアップから始めましょう！", 2)
              : dashState === 'all-done'
                ? t("Отличная работа!", "お疲れさまでした！", 2)
                : t("С возвращением!", "おかえりなさい！", 2)}
          </h1>
        )}

        {/* PRIMARY ACTION: адаптивный CTA по состоянию дня */}
        <div className={styles.primaryActionContainer}>
          {!(dashState === 'resume' || deckLoaded) ? null : dashState === 'resume' && activeSession ? (
            <>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <Link href="/chat" className="btn-3d btn-blue" style={{ fontSize: '20px', padding: '16px 32px' }}>
                  {t(`Продолжить: ${activeSession.title}`, `続ける: ${activeSession.title}`, 2)}
                </Link>
                <button
                  onClick={handleDiscardSession}
                  className="btn-3d btn-red"
                  style={{ fontSize: '20px', padding: '16px 24px' }}
                >
                  {t("Сбросить", "リセット", 2)}
                </button>
              </div>
              <span className={styles.resumeProgressText}>
                {t(
                  `Собрано целевых слов: ${collectedWordsCount} из ${totalWordsCount}`,
                  `目標単語の獲得: ${totalWordsCount}語中${collectedWordsCount}語`,
                  2
                )}
              </span>
            </>
          ) : dashState === 'first-run' ? (
            <button
              onClick={() => setShowAssessment(true)}
              className="btn-3d btn-green"
              style={{ fontSize: '20px', padding: '16px 32px' }}
            >
              {t("Пройти диагностику (5 мин)", "診断テスト（5分）", 2)}
            </button>
          ) : dashState === 'returning' ? (
            <>
              <Link href="/practice" className="btn-3d btn-green" style={{ fontSize: '20px', padding: '16px 32px' }}>
                {t("Продолжить обучение", "学習を続ける", 2)}
              </Link>
              <span className={styles.resumeProgressText}>
                {t(`${dueReviewCount} слов(а) к повторению`, `復習: ${dueReviewCount}語`, 2)}
              </span>
            </>
          ) : dashState === 'newbie' ? (
            <Link href="/practice" className="btn-3d btn-green" style={{ fontSize: '20px', padding: '16px 32px' }}>
              {t("Начать разминку", "ウォームアップ開始", 2)}
            </Link>
          ) : dashState === 'all-done' ? (
            <span className={styles.resumeProgressText} style={{ fontSize: '16px' }}>
              {t("На сегодня всё — можно посмотреть медиа.", "今日はおしまい — メディアを見てみましょう。", 2)}{' '}
              <Link href="/practice" style={{ color: 'var(--color-blue)', fontWeight: 800 }}>
                {t("Открыть медиа", "メディアへ", 2)}
              </Link>
            </span>
          ) : (
            <Link href="/practice" className="btn-3d btn-green" style={{ fontSize: '20px', padding: '16px 32px' }}>
              {t("Начать практику", "練習を開始する", 2)}
            </Link>
          )}
        </div>

        {/* MEMORY DECAY HEATMAP */}
        <MemoryDecayHeatmap cells={heatmapCells} isLocalInit={isLocalInit} totalWords={deckWordCount} />

        {/* SECONDARY CONTROL GRID */}
        <div className={styles.secondaryGrid}>
          <Link href="/settings" className={`btn-3d ${styles.secondaryBtn}`}>
            <Settings size={20} />
            <span className={styles.btnLabel}>
              <JpUI id="btn_settings" ru="Настройки" ja="設定" reading="せってい" kind="chrome" interactive={false} />
            </span>
          </Link>
          <button onClick={() => setShowProfileModal(true)} className={`btn-3d ${styles.secondaryBtn}`}>
            <User size={20} />
            <span className={styles.btnLabel}>
              <JpUI id="btn_profile" ru="Профиль" ja="プロフィール" reading="ぷろふぃーる" kind="chrome" interactive={false} />
            </span>
          </button>
          <button onClick={() => { setShowHelpModal(true); setHelpTab('about'); }} className={`btn-3d ${styles.secondaryBtn}`}>
            <HelpCircle size={20} />
            <span className={styles.btnLabel}>
              <JpUI id="btn_help" ru="Справка" ja="ヘルプ" reading="へるぷ" kind="chrome" interactive={false} />
            </span>
          </button>
        </div>
      </main>

      {/* FOOTER */}
      <footer style={{ padding: '24px', textAlign: 'center', color: 'var(--text-light)', borderTop: '2px solid var(--border-color)', backgroundColor: 'white', fontSize: '14px', fontWeight: 600 }}>
        YomuMogu © {new Date().getFullYear()} — {t("Сделано с заботой о вашем японском 🇯🇵", "日本語学習を応援します 🇯🇵", 2)}
      </footer>

      {/* PROFILE & STATS MODAL OVERLAY */}
      {showProfileModal && (
        <div className={styles.modalOverlay} onClick={() => setShowProfileModal(false)}>
          <div className={`${styles.modalContent} card-friendly`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                <Award size={24} style={{ color: 'var(--color-yellow)' }} />
                <span>{t("Профиль и прогресс", "プロフィールと進捗", 2)}</span>
              </h2>
              <button className={styles.closeButton} onClick={() => setShowProfileModal(false)}>
                <X size={24} />
              </button>
            </div>

            {/* Выбор профиля */}
            <div className={styles.profileSelectorArea}>
              <span className={styles.profileSelectorLabel}>{t("Активный профиль:", "現在のプロフィール:", 2)}</span>
              <select
                className={styles.selectProfile}
                value={activeProfileId}
                onChange={(e) => handleSwitchProfile(e.target.value)}
              >
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.id === 'default' ? '(Основной)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Прогресс уровня XP */}
            <div className={styles.xpProgressSection}>
              <div className={styles.levelTitleRow}>
                <span>{t(`Уровень: ${jState.level}`, `レベル: ${jState.level}`, 2)}</span>
                <span>{jState.level >= 6 ? 'MAX' : `${jState.points} / ${xpStats.next} XP`}</span>
              </div>
              <div className={styles.xpBarContainer}>
                <div 
                  className={styles.xpBarFill} 
                  style={{ width: `${xpStats.percent}%` }}
                />
              </div>
            </div>

            {/* Сетка характеристик */}
            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <div className={styles.statVal}>{jState.totalWordsUsed}</div>
                <div className={styles.statLbl}>{t("Слов использовано", "使用した単語数", 2)}</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statVal}>{jState.sessionsCompleted}</div>
                <div className={styles.statLbl}>{t("Сессий завершено", "完了したセッション数", 2)}</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statVal}>{jState.points}</div>
                <div className={styles.statLbl}>{t("Всего XP", "獲得XP合計", 2)}</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statVal}>{jState.chatLevel}</div>
                <div className={styles.statLbl}>{t("Сложность чата", "チャット難易度", 2)}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn-3d btn-green" onClick={() => { setShowProfileModal(false); router.push('/settings#profile'); }}>
                {t("Управление профилями", "プロフィール管理", 2)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HELP & DOCUMENTATION MODAL OVERLAY */}
      {showHelpModal && (
        <div className={styles.modalOverlay} onClick={() => setShowHelpModal(false)}>
          <div className={`${styles.modalContent} card-friendly`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                <HelpCircle size={24} style={{ color: 'var(--color-blue)' }} />
                <span>{t("Справка YomuMogu", "YomuMogu ヘルプ", 2)}</span>
              </h2>
              <button className={styles.closeButton} onClick={() => setShowHelpModal(false)}>
                <X size={24} />
              </button>
            </div>

            {/* Вкладки справки */}
            <div className={styles.tabHeader}>
              <button 
                className={`${styles.tabBtn} ${helpTab === 'about' ? styles.tabBtnActive : ''}`}
                onClick={() => setHelpTab('about')}
              >
                {t("О методе", "メソッド", 2)}
              </button>
              <button 
                className={`${styles.tabBtn} ${helpTab === 'rules' ? styles.tabBtnActive : ''}`}
                onClick={() => setHelpTab('rules')}
              >
                {t("Правила", "ルール", 2)}
              </button>
              <button 
                className={`${styles.tabBtn} ${helpTab === 'japanification' ? styles.tabBtnActive : ''}`}
                onClick={() => setHelpTab('japanification')}
              >
                {t("Погружение", "没入", 2)}
              </button>
            </div>

            {/* Содержимое вкладок */}
            <div className={styles.tabContent}>
              {helpTab === 'about' && (
                <div>
                  <h4>{t("Превращение пассивного словаря в активный", "パッシブ語彙をアクティブに", 2)}</h4>
                  <p>
                    {t(
                      "Классические приложения часто тренируют пассивное узнавание. YomuMogu предлагает активную генерацию речи. ИИ Gemini вовлекает вас в контекстную беседу, вынуждая вспоминать и использовать целевые слова на японском языке.",
                      "一般的なアプリは受動的な記憶力を鍛えます。YomuMoguは能動的なアウトプットを促します。Gemini AIが目標単語を使うように自然と会話を誘導します。",
                      2
                    )}
                  </p>
                  <p>
                    {t(
                      "Вы общаетесь в рамках сгенерированных сценариев, получаете мгновенный разбор грамматических ошибок и копите XP для повышения уровня.",
                      "設定されたシチュエーションで会話をし、リアルタイムの文法チェックを受け、経験値（XP）を貯めてレベルアップします。",
                      2
                    )}
                  </p>
                </div>
              )}

              {helpTab === 'rules' && (
                <div>
                  <h4>{t("Использование Cyrillic Placeholders", "ロシア語プレースホルダーの使用", 2)}</h4>
                  <p>
                    {t(
                      "Забыли японское слово в середине предложения? Не беда! Вы можете вставить русское слово прямо в японский текст, например:",
                      "文の途中で日本語の単語を忘れても大丈夫！ロシア語の単語をプレースホルダーとして直接挿入できます：",
                      2
                    )}
                  </p>
                  <span className={styles.codeExample}>Стулの座って</span>
                  <p>
                    {t(
                      "ИИ распознает ошибку, исправит предложение на японском, добавит перевод и объяснит правило:",
                      "AIはそれを文法ミスとして検知し、日本語に翻訳した正しい文を作成して文法カードで説明します：",
                      2
                    )}
                  </p>
                  <span className={styles.codeExample}>椅子に座って</span>
                  
                  <h4 style={{ marginTop: '16px' }}>{t("Правила ИИ-собеседника", "AI対話のルール", 2)}</h4>
                  <ul>
                    <li>{t("ИИ не раскрывает целевые слова в первых двух репликах, стимулируя ваше собственное воспоминание.", "最初の2ターンは、AIは目標単語を使用または翻訳しません。自力で思い出すよう促します。", 2)}</li>
                    <li>{t("Каждая реплика содержит конкретный вопрос, сужающий тему, чтобы вам было легче ответить.", "AIは抽象的な質問を避け、具体的な問いかけをして会話のキャッチボールを続けます。", 2)}</li>
                  </ul>
                </div>
              )}

              {helpTab === 'japanification' && (
                <div>
                  <h4>{t("Система языкового погружения (Immersion)", "言語浸透システム（イマージョン）", 2)}</h4>
                  <p>
                    {t(
                      "Перевод элементов интерфейса на японский язык полностью управляется алгоритмом интервального повторения FSRS на основе вашей памяти:",
                      "インターフェースの日本語翻訳は、記憶に基づいたFSRS間隔反復アルゴリズムによって完全に管理されています：",
                      2
                    )}
                  </p>
                  <ul>
                    <li>
                      <strong>{t("Умный перевод элементов UI:", "UI要素のスマート翻訳:", 2)}</strong>{' '}
                      {t(
                        "В режиме Smart интерфейс постепенно наполняется японскими словами. Кликнув на любое переведенное слово, вы увидите всплывающую подсказку.",
                        "Smartモードでは、インターフェースが徐々に日本語で表示されます。翻訳された単語をクリックすると、ツールチップが表示されます。",
                        2
                      )}
                    </li>
                    <li>
                      <strong>{t("Интерактивная обратная связь:", "インタラクティブなフィードバック:", 2)}</strong>{' '}
                      {t(
                        "Кнопка «Знаю» повышает стабильность слова, и оно будет реже беспокоить вас. Кнопка «Забыл» сбрасывает прогресс и мгновенно возвращает русский перевод.",
                        "「わかる（Знаю）」ボタンは単語の安定度を高め、出現頻度を下げます。「忘れた（Забыл）」ボタンは進捗をリセットし、ロシア語に戻します。",
                        2
                      )}
                    </li>
                    <li>
                      <strong>{t("Очки опыта (XP) и Уровни:", "経験値（XP）とレベル:", 2)}</strong>{' '}
                      {t(
                        "Накапливаемые вами XP и виртуальные уровни (L0–L6) сейчас служат декоративным показателем вашего прогресса на будущее.",
                        "獲得するXPと仮想レベル（L0〜L6）は、将来の開発に向けた装飾的な進捗指標として機能しています。",
                        2
                      )}
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', borderTop: '2px solid var(--border-color)', paddingTop: '16px' }}>
              <button className="btn-3d btn-blue" onClick={() => setShowHelpModal(false)}>
                {t("Закрыть", "閉じる", 2)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛ ДИАГНОСТИКИ (онбординг прямо на дашборде, без редиректа в настройки) */}
      <AssessmentModal
        isOpen={showAssessment}
        profileId={activeProfileId}
        onClose={() => setShowAssessment(false)}
        onSaved={async () => {
          setShowAssessment(false);
          await loadDeckSignals();
        }}
      />
    </div>
  );
}

function MemoryDecayHeatmap({ cells, isLocalInit, totalWords }: { cells: Array<{ status: string; isDue: boolean; avgStability: number }>; isLocalInit: boolean; totalWords: number }) {
  const { t } = useJapanification();

  if (cells.length === 0) return null;

  return (
    <div className={styles.heatmapCard}>
      <h3 className={styles.heatmapTitle}>
        <BarChart2 size={20} />
        <span>{t("Очаги памяти (Сетка Кумико)", "記憶の格子（組子格子）", 2)}</span>
      </h3>
      <p className={styles.heatmapDescription}>
        {isLocalInit
          ? t(
              `50 ячеек отображают состояние ${totalWords} слов вашей стартовой колоды. Цвета отражают уровень стабильности памяти. Пульсация означает остывание памяти и необходимость повторения.`,
              `50の格子がスターターデッキの${totalWords}語の状態を表します。色は記憶の安定性を示し、点滅は復習が必要なシグナルです。`,
              2
            )
          : t(
              "Колода ещё не инициализирована. Пройдите диагностику в настройках, чтобы засеять 500 слов стартовой колоды — и сетка оживёт.",
              "デッキはまだ初期化されていません。設定で診断を受けてスターターデッキの500語を準備すると、格子が動き出します。",
              2
            )}
      </p>
      <div className={styles.heatmapSvgContainer}>
        <svg 
          data-testid="kumiko-grid" 
          viewBox="0 0 500 250" 
          className={styles.kumikoSvg}
        >
          {cells.map((cell, idx) => {
            const col = idx % 10;
            const row = Math.floor(idx / 10);
            const cellSize = 50;
            const x = col * cellSize;
            const y = row * cellSize;
            
            // Выбираем цвет фона в зависимости от статуса ячейки
            let fillColor = '#faf8f5'; // new / washi paper
            let statusLabel = 'Новые';
            if (cell.status === 'learning') {
              fillColor = '#fef3c7'; // pale warm amber
              statusLabel = 'Изучаемые';
            } else if (cell.status === 'review') {
              fillColor = '#d1fae5'; // minty green
              statusLabel = 'Повторяемые';
            } else if (cell.status === 'mature') {
              fillColor = '#f59e0b'; // rich golden yellow
              statusLabel = 'Усвоенные';
            }

            const cellTitle = `Группа ${idx + 1}: ${statusLabel}${cell.isDue ? ' (Требует повторения)' : ''}, Стабильность: ${cell.avgStability.toFixed(1)}дн`;

            return (
              <g 
                key={idx} 
                className={`${styles.kumikoCell} ${cell.isDue ? styles.dueCell : ''}`}
              >
                <title>{cellTitle}</title>
                {/* Фоновая ячейка */}
                <rect 
                  x={x} 
                  y={y} 
                  width={cellSize} 
                  height={cellSize} 
                  fill={fillColor} 
                  stroke="#a27b5c" 
                  strokeWidth="1.5" 
                  className={styles.cellRect}
                />
                
                {/* Геометрический орнамент Кумико */}
                {/* Ромб внутри */}
                <path 
                  d={`M ${x} ${y + cellSize/2} L ${x + cellSize/2} ${y} L ${x + cellSize} ${y + cellSize/2} L ${x + cellSize/2} ${y + cellSize} Z`} 
                  stroke="rgba(162, 123, 92, 0.25)" 
                  strokeWidth="1" 
                  fill="none" 
                />
                {/* Диагонали */}
                <line x1={x} y1={y} x2={x + cellSize} y2={y + cellSize} stroke="rgba(162, 123, 92, 0.15)" strokeWidth="0.5" />
                <line x1={x + cellSize} y1={y} x2={x} y2={y + cellSize} stroke="rgba(162, 123, 92, 0.15)" strokeWidth="0.5" />
              </g>
            );
          })}
        </svg>
      </div>
      
      {/* Легенда тепловой карты */}
      <div className={styles.legendRow}>
        <div className={styles.legendItem}>
          <span className={styles.legendColor} style={{ backgroundColor: '#faf8f5', border: '1px solid #a27b5c' }} />
          <span>{t("Новые (0%)", "新規 (0%)", 2)}</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendColor} style={{ backgroundColor: '#fef3c7', border: '1px solid #a27b5c' }} />
          <span>{t("Изучаемые", "学習中", 2)}</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendColor} style={{ backgroundColor: '#d1fae5', border: '1px solid #a27b5c' }} />
          <span>{t("Повторяемые", "復習中", 2)}</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendColor} style={{ backgroundColor: '#f59e0b', border: '1px solid #a27b5c' }} />
          <span>{t("Усвоенные", "修得済", 2)}</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendColor} ${styles.legendDuePulse}`} style={{ border: '1.5px dashed var(--color-orange, #f97316)' }} />
          <span>{t("Требует повторения", "復習が必要", 2)}</span>
        </div>
      </div>
    </div>
  );
}
