'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Settings, User, HelpCircle, X, Check, Award, BarChart2, BookOpen as BookIcon } from 'lucide-react';
import { useJapanification } from '@/hooks/useJapanification';
import { getProfileItem, removeProfileItem, getProfilesList, getActiveProfileId, setActiveProfileId, ProfileInfo } from '@/lib/profile';
import { JpUI } from '@/components/JpUI';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import styles from './page.module.css';
import { sanitizeHtml } from '@/lib/sanitize';

// Возвращает пороги очков для уровней на нормальной скорости (дефолтная скорость для отображения в профиле)
const NORMAL_THRESHOLDS = [0, 20, 50, 100, 170, 280, 420];

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
    } catch (e) {
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
  const getMascotBubbleHtml = (): { __html: string } => {
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
      case 0:
        return { __html: "Привет! Давай попрактикуемся сегодня? Перейди в раздел практики и выбери тему!" };
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

  if (!hasLoaded) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-secondary)', alignItems: 'center', justifyContent: 'center' }}>
        <div className="btn-3d" style={{ pointerEvents: 'none' }}>Загрузка...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--bg-secondary)' }}>
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
          <div className={styles.mascotContainer} title={t("Кликни меня!", "クリックしてね！", 2)}>
            🍵
          </div>
          <div className={styles.speechBubble}>
            <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(getMascotBubbleHtml().__html) }} />
          </div>
        </div>

        <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px', lineHeight: '1.2' }}>
          {t("Превратите ваши слова в живую речь!", "あなたの単語を生きた言葉に！", 2)}
        </h1>

        <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '32px', maxWidth: '600px', lineHeight: '1.6' }}>
          {t(
            "YomuMogu импортирует ваши японские карточки и помогает вам практиковать их в диалоге с ИИ-тьютором Gemini.",
            "YomuMoguは単語カードをインポートし、GeminiAI家庭教師との対話で練習するのを助けます。",
            2
          )}
        </p>

        {/* PRIMARY ACTION BUTTON */}
        <div className={styles.primaryActionContainer}>
          {hasActiveChat && activeSession ? (
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
          ) : (
            <Link href="/practice" className="btn-3d btn-green" style={{ fontSize: '20px', padding: '16px 32px' }}>
              {t("Начать практику", "練習を開始する", 2)}
            </Link>
          )}
        </div>

        {/* SECONDARY CONTROL GRID */}
        <div className={styles.secondaryGrid}>
          <Link href="/settings" className={`btn-3d ${styles.secondaryBtn}`}>
            <Settings size={20} />
            <span className={styles.btnLabel}>
              <JpUI id="btn_settings" ru="Настройки" ja="設定" reading="せってい" interactive={false} />
            </span>
          </Link>
          <button onClick={() => setShowProfileModal(true)} className={`btn-3d ${styles.secondaryBtn}`}>
            <User size={20} />
            <span className={styles.btnLabel}>
              <JpUI id="btn_profile" ru="Профиль" ja="プロフィール" reading="ぷろふぃーる" interactive={false} />
            </span>
          </button>
          <button onClick={() => { setShowHelpModal(true); setHelpTab('about'); }} className={`btn-3d ${styles.secondaryBtn}`}>
            <HelpCircle size={20} />
            <span className={styles.btnLabel}>
              <JpUI id="btn_help" ru="Справка" ja="ヘルプ" reading="へるぷ" interactive={false} />
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
    </div>
  );
}
