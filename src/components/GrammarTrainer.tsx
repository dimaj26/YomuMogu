'use client';

import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Loader2, Play, Volume2, HelpCircle } from 'lucide-react';
import grammarRules from '@/resources/grammar_rules.json';
import { sanitizeHtml } from '@/lib/sanitize';
import styles from './GrammarTrainer.module.css';

interface GrammarTrainerProps {
  ruleId: string;
  onClose: () => void;
  onComplete: () => void;
}

// Компонент маскота чашечки чая 🍵
const Mascot: React.FC<{ state: 'idle' | 'happy' | 'worried' | 'cheering' }> = ({ state }) => {
  return (
    <div className={`${styles.mascotWidget} ${styles[state]}`} data-state={state}>
      <div className={styles.mascotImageContainer}>
        <svg className={styles.mascotSvg} viewBox="0 0 100 100" width="70" height="70">
          <g className={styles.steamGroup}>
            <path d="M45,25 Q48,15 45,5" stroke="var(--text-light, #9ca3af)" strokeWidth="2" strokeLinecap="round" fill="none" className={styles.steamLine1} />
            <path d="M55,25 Q58,15 55,5" stroke="var(--text-light, #9ca3af)" strokeWidth="2" strokeLinecap="round" fill="none" className={styles.steamLine2} />
          </g>
          <path d="M 25 55 Q 12 50 15 42 Q 18 42 24 49 Z" fill="#3b82f6" stroke="var(--border-color, #e5e7eb)" strokeWidth="2" />
          <path d="M 75 48 C 88 48 88 68 75 68" fill="none" stroke="var(--border-color, #e5e7eb)" strokeWidth="4" strokeLinecap="round" />
          <circle cx="50" cy="58" r="26" fill="#3b82f6" stroke="var(--border-color, #e5e7eb)" strokeWidth="3" />
          <ellipse cx="50" cy="33" rx="18" ry="4" fill="#1e3a8a" stroke="var(--border-color, #e5e7eb)" strokeWidth="2" />
          <circle cx="50" cy="28" r="5" fill="#f59e0b" stroke="var(--border-color, #e5e7eb)" strokeWidth="2" />
          
          {state === 'idle' && (
            <g>
              <path d="M 40 55 Q 44 58 48 55" stroke="var(--border-color, #e5e7eb)" strokeWidth="2" fill="none" strokeLinecap="round" />
              <path d="M 52 55 Q 56 58 60 55" stroke="var(--border-color, #e5e7eb)" strokeWidth="2" fill="none" strokeLinecap="round" />
              <path d="M 48 64 Q 50 67 52 64" stroke="var(--border-color, #e5e7eb)" strokeWidth="2" fill="none" strokeLinecap="round" />
            </g>
          )}
          {state === 'happy' && (
            <g>
              <path d="M 38 58 Q 43 52 48 58" stroke="var(--border-color, #e5e7eb)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <path d="M 52 58 Q 57 52 62 58" stroke="var(--border-color, #e5e7eb)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <path d="M 46 64 Q 50 72 54 64 Z" fill="#f59e0b" stroke="var(--border-color, #e5e7eb)" strokeWidth="1.5" />
              <circle cx="34" cy="62" r="3" fill="rgba(239, 68, 68, 0.4)" />
              <circle cx="66" cy="62" r="3" fill="rgba(239, 68, 68, 0.4)" />
            </g>
          )}
          {state === 'worried' && (
            <g>
              <path d="M 40 56 Q 44 52 48 56" stroke="var(--border-color, #e5e7eb)" strokeWidth="2" fill="none" strokeLinecap="round" />
              <path d="M 52 56 Q 56 52 60 56" stroke="var(--border-color, #e5e7eb)" strokeWidth="2" fill="none" strokeLinecap="round" />
              <path d="M 47 67 Q 50 63 53 67" stroke="var(--border-color, #e5e7eb)" strokeWidth="2" fill="none" strokeLinecap="round" />
              <path d="M 32 50 C 32 50 30 55 32 57 C 34 57 34 55 34 50 Z" fill="#60a5fa" />
            </g>
          )}
          {state === 'cheering' && (
            <g>
              <path d="M 38 58 Q 43 52 48 58" stroke="var(--border-color, #e5e7eb)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <path d="M 52 58 L 62 55" stroke="var(--border-color, #e5e7eb)" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M 46 63 Q 50 68 54 63" stroke="var(--border-color, #e5e7eb)" strokeWidth="2" fill="none" strokeLinecap="round" />
              <circle cx="34" cy="62" r="3" fill="rgba(239, 68, 68, 0.4)" />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};

export const GrammarTrainer: React.FC<GrammarTrainerProps> = ({ ruleId, onClose, onComplete }) => {
  const rule = grammarRules.find(r => r.id === ruleId);

  // Стейты песочницы предложений
  const [tone, setTone] = useState<'polite' | 'plain' | 'dropped'>('polite');
  const [polarity, setPolarity] = useState<'affirmative' | 'negative'>('affirmative');
  const [activeTooltip, setActiveTooltip] = useState<'wa' | 'desu' | null>(null);

  // Стейт активной вкладки справочника
  const [activeTab, setActiveTab] = useState<'sandbox' | 'secrets' | 'verify'>('sandbox');

  // Состояния свободного ввода и проверки ИИ
  const [userInput, setUserInput] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<{ isCorrect: boolean; correction: string; explanation: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Состояние маскота
  const [mascotState, setMascotState] = useState<'idle' | 'happy' | 'worried' | 'cheering'>('idle');

  // Реагируем на переключения тумблеров песочницы анимацией маскота
  useEffect(() => {
    setMascotState('cheering');
    const timer = setTimeout(() => setMascotState('idle'), 800);
    return () => clearTimeout(timer);
  }, [tone, polarity]);

  if (!rule) {
    return (
      <div className={styles.overlay}>
        <div className={styles.modalCard}>
          <div className={styles.modalHeader}>
            <h3>Ошибка</h3>
            <button onClick={onClose} className={styles.closeBtn}><X size={20} /></button>
          </div>
          <p>Грамматическое правило не найдено.</p>
        </div>
      </div>
    );
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isChecking) return;

    setIsChecking(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/gemini/grammar-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId, userInput: userInput.trim() }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Не удалось проверить предложение.');
      }

      const data = await res.json();
      setResult(data);
      if (data.isCorrect) {
        setMascotState('happy');
      } else {
        setMascotState('worried');
      }
    } catch (err: any) {
      setError(err.message || 'Произошла непредвиденная ошибка.');
      setMascotState('worried');
    } finally {
      setIsChecking(false);
    }
  };

  const handleSuggestionClick = (sampleAnswer: string) => {
    setUserInput(sampleAnswer);
    setResult(null);
    setError(null);
    setActiveTab('verify');
  };

  const playTTS = (text: string) => {
    const cleanText = text.replace(/<rt>[\s\S]*?<\/rt>/gi, '').replace(/<\/?[^>]+(>|$)/g, '').trim();
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q=${encodeURIComponent(cleanText)}`;
    const audio = new Audio(url);
    audio.play().catch(() => {});
  };

  // Метод динамического рендеринга предложения в песочнице
  const renderSandboxSentence = () => {
    const isPolite = tone === 'polite';
    const isPlain = tone === 'plain';
    const isDropped = tone === 'dropped';
    const isAffirmative = polarity === 'affirmative';

    // Формируем частицы и связки
    let subject = isPlain ? '俺 (оре)' : '私 (ватаси)';
    if (isDropped) subject = '私'; // Разговорное опускание
    
    return (
      <div className={styles.sandboxSentence}>
        {/* Субъект */}
        <div className={styles.sandboxCard} title="Тема предложения">
          <span className={styles.sandboxWord}>{subject}</span>
          <span className={styles.sandboxLabel}>Я</span>
        </div>

        {/* Тематическая частица は */}
        {!isDropped && (
          <button 
            type="button" 
            onClick={() => setActiveTooltip(activeTooltip === 'wa' ? null : 'wa')}
            className={`${styles.sandboxCard} ${styles.particle} ${activeTooltip === 'wa' ? styles.activeCard : ''}`}
          >
            <span className={styles.sandboxWord}>は</span>
            <span className={styles.sandboxLabel}>тема (ва)</span>
          </button>
        )}

        {/* Объект (Студент) */}
        <div className={styles.sandboxCard} title="Описание темы">
          <span className={styles.sandboxWord}>学生</span>
          <span className={styles.sandboxLabel}>студент</span>
        </div>

        {/* Грамматическая связка です / だ */}
        {!isDropped && (
          <button 
            type="button" 
            onClick={() => setActiveTooltip(activeTooltip === 'desu' ? null : 'desu')}
            className={`${styles.sandboxCard} ${styles.copula} ${activeTooltip === 'desu' ? styles.activeCard : ''}`}
          >
            <span className={styles.sandboxWord}>
              {isPolite ? (isAffirmative ? 'です' : 'ではありません') : (isAffirmative ? 'だ' : 'じゃない')}
            </span>
            <span className={styles.sandboxLabel}>
              {isAffirmative ? 'есть' : 'не есть'}
            </span>
          </button>
        )}

        {isDropped && !isAffirmative && (
          <button 
            type="button" 
            onClick={() => setActiveTooltip(activeTooltip === 'desu' ? null : 'desu')}
            className={`${styles.sandboxCard} ${styles.copula} ${activeTooltip === 'desu' ? styles.activeCard : ''}`}
          >
            <span className={styles.sandboxWord}>じゃない</span>
            <span className={styles.sandboxLabel}>не есть</span>
          </button>
        )}
      </div>
    );
  };

  const getTooltipContent = () => {
    if (activeTooltip === 'wa') {
      return {
        title: 'Частица は (тема)',
        text: rule.sandbox?.explanationTips?.wa || 'Выделяет тему высказывания. В устной дружеской речи часто заменяется паузой.'
      };
    }
    if (activeTooltip === 'desu') {
      return {
        title: 'Связка です / だ (быть)',
        text: rule.sandbox?.explanationTips?.desu || 'Склеивает тему и описание в предложении. です — вежливо, だ — дружески, опускание — разговорный стиль.'
      };
    }
    return null;
  };

  const tooltip = getTooltipContent();

  return (
    <div className={styles.overlay}>
      <div className={styles.modalCard} style={{ maxWidth: '800px' }}>
        {/* HEADER */}
        <div className={styles.modalHeader}>
          <div>
            <span className={styles.ruleTopic}>{rule.topic}</span>
            <h2 className={styles.ruleConstruction}>{rule.construction}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Mascot state={mascotState} />
            <button onClick={onClose} className={styles.closeBtn} title="Закрыть">
              <X size={22} />
            </button>
          </div>
        </div>

        <div className={styles.modalContent} style={{ padding: 0, flexDirection: 'row', gap: 0, overflow: 'hidden' }}>
          
          {/* ЛЕВАЯ КОЛОНКА: СТЕНД-ПЕСОЧНИЦА */}
          <div className={styles.leftColumn}>
            <div className={styles.columnTitle}>Лаборатория предложений</div>
            
            {/* Рендеринг песочницы */}
            <div className={styles.sandboxArea}>
              {renderSandboxSentence()}
            </div>

            {/* Подсказки к карточкам (Интерактивные поповеры) */}
            {tooltip && (
              <div className={styles.popoverTooltip}>
                <div className={styles.popoverTooltipHeader}>
                  <HelpCircle size={14} className={styles.tooltipIcon} />
                  <span className={styles.popoverTooltipTitle}>{tooltip.title}</span>
                </div>
                <p className={styles.popoverTooltipText}>{tooltip.text}</p>
              </div>
            )}

            {/* Пульт управления тумблерами */}
            <div className={styles.sandboxControls}>
              <div className={styles.controlGroup}>
                <span className={styles.controlLabel}>Тон общения:</span>
                <div className={styles.pillContainer}>
                  <button 
                    type="button" 
                    onClick={() => { setTone('polite'); setActiveTooltip(null); }}
                    className={`${styles.pillBtn} ${tone === 'polite' ? styles.pillBtnActive : ''}`}
                  >
                    Вежливо
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setTone('plain'); setActiveTooltip(null); }}
                    className={`${styles.pillBtn} ${tone === 'plain' ? styles.pillBtnActive : ''}`}
                  >
                    Дружески
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setTone('dropped'); setActiveTooltip(null); }}
                    className={`${styles.pillBtn} ${tone === 'dropped' ? styles.pillBtnActive : ''}`}
                  >
                    Устный пропуск
                  </button>
                </div>
              </div>

              <div className={styles.controlGroup}>
                <span className={styles.controlLabel}>Полярность:</span>
                <div className={styles.pillContainer}>
                  <button 
                    type="button" 
                    onClick={() => { setPolarity('affirmative'); setActiveTooltip(null); }}
                    className={`${styles.pillBtn} ${polarity === 'affirmative' ? styles.pillBtnActive : ''}`}
                  >
                    Утверждение (+)
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setPolarity('negative'); setActiveTooltip(null); }}
                    className={`${styles.pillBtn} ${polarity === 'negative' ? styles.pillBtnActive : ''}`}
                  >
                    Отрицание (-)
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.sandboxInstruction}>
              💡 Кликайте по элементам предложения выше (например, на <strong>は</strong> или <strong>です</strong>), чтобы открыть секреты живого японского языка.
            </div>
          </div>

          {/* ПРАВАЯ КОЛОНКА: СВЕДЕНИЯ И ИИ-ПРОВЕРКА */}
          <div className={styles.rightColumn}>
            
            {/* Навигация вкладок */}
            <div className={styles.tabHeader}>
              <button 
                type="button" 
                onClick={() => setActiveTab('sandbox')}
                className={`${styles.tabBtn} ${activeTab === 'sandbox' ? styles.tabBtnActive : ''}`}
              >
                Как устроено
              </button>
              <button 
                type="button" 
                onClick={() => setActiveTab('secrets')}
                className={`${styles.tabBtn} ${activeTab === 'secrets' ? styles.tabBtnActive : ''}`}
              >
                Секреты устной речи
              </button>
              <button 
                type="button" 
                onClick={() => setActiveTab('verify')}
                className={`${styles.tabBtn} ${activeTab === 'verify' ? styles.tabBtnActive : ''}`}
              >
                ИИ-Проверка
              </button>
            </div>

            <div className={styles.tabContent}>
              
              {/* ВКЛАДКА 1: КАК ЭТО УСТРОЕНО */}
              {activeTab === 'sandbox' && (
                <div className={styles.tabPane}>
                  <div className={styles.sectionTheory}>
                    <p className={styles.explanation}>{rule.explanation}</p>
                    <div className={styles.conjugationCard}>
                      <span className={styles.cardTitle}>Базовый шаблон сборки:</span>
                      <code className={styles.conjugationCode}>{rule.conjugationGuide}</code>
                    </div>
                  </div>

                  <div className={styles.sectionSuggestions}>
                    <h4 className={styles.subTitle}>Примеры и подсказки (кликните, чтобы использовать):</h4>
                    <div className={styles.suggestionsGrid}>
                      {rule.suggestions.map((s, idx) => (
                        <div key={idx} className={styles.suggestionCard} style={{ padding: '8px 12px' }}>
                          <div className={styles.suggestionHeader}>
                            <span className={styles.suggestionHint}>{s.hint}</span>
                            <button 
                              type="button" 
                              onClick={() => handleSuggestionClick(s.sampleAnswer)} 
                              className={styles.useBtn}
                            >
                              Использовать
                            </button>
                          </div>
                          <div className={styles.suggestionWords}>{s.baseWords}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ВКЛАДКА 2: РАЗГОВОРНЫЕ СЕКРЕТЫ */}
              {activeTab === 'secrets' && (
                <div className={styles.tabPane}>
                  <div className={styles.secretsCard}>
                    <h4 className={styles.secretsTitle}>🤫 Секреты устного языка: Опускание частиц</h4>
                    <p className={styles.secretsText}>
                      Японцы в реальной разговорной речи стремятся сократить любые длинные фразы. Именно поэтому тематическую частицу <strong>は (ва)</strong> и связку <strong>です (дэсу)</strong> практически всегда опускают в диалогах с друзьями. 
                      Вместо <em>«Корэ ва мидзу дэсу»</em> (Это вода) японец скажет просто: <strong>«Корэ, мидзу»</strong> (Это, вода).
                    </p>
                  </div>

                  <div className={styles.secretsCard} style={{ marginTop: '12px' }}>
                    <h4 className={styles.secretsTitle}>👥 Местоимения «Я»</h4>
                    <p className={styles.secretsText}>
                      В зависимости от вежливости и вашего пола слово «Я» меняется:
                      <br />• <strong>私 (ватаси)</strong> — нейтрально, вежливо для всех.
                      <br />• <strong>俺 (орэ)</strong> — грубое мужское «Я» в кругу друзей.
                      <br />• <strong>僕 (боку)</strong> — скромное мужское «Я», часто используется парнями.
                    </p>
                  </div>
                </div>
              )}

              {/* ВКЛАДКА 3: ИИ-ПРОВЕРКА */}
              {activeTab === 'verify' && (
                <div className={styles.tabPane}>
                  <form onSubmit={handleVerify} className={styles.inputForm}>
                    <label htmlFor="userInput" className={styles.inputLabel}>
                      Напишите собственное предложение на японском:
                    </label>
                    <div className={styles.inputWrapper}>
                      <input
                        id="userInput"
                        type="text"
                        value={userInput}
                        onChange={(e) => {
                          setUserInput(e.target.value);
                          if (result) setResult(null);
                        }}
                        placeholder="Пример: 私は学生です。"
                        className={styles.textInput}
                        disabled={isChecking}
                        autoComplete="off"
                      />
                      <button
                        type="submit"
                        className={`btn-3d btn-blue ${styles.verifyBtn}`}
                        disabled={isChecking || !userInput.trim()}
                      >
                        {isChecking ? <Loader2 className={styles.spinner} size={18} /> : 'Проверить'}
                      </button>
                    </div>
                  </form>

                  {error && (
                    <div className={`${styles.resultBanner} ${styles.errorBanner}`} style={{ marginTop: '12px' }}>
                      <AlertCircle size={20} className={styles.icon} />
                      <span>{error}</span>
                    </div>
                  )}

                  {result && (
                    <div className={`${styles.resultCard} ${result.isCorrect ? styles.correct : styles.incorrect}`} style={{ marginTop: '12px' }}>
                      <div className={styles.resultHeader}>
                        {result.isCorrect ? (
                          <>
                            <CheckCircle size={24} className={styles.successIcon} />
                            <span className={styles.resultTitle}>Правильно!</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle size={24} className={styles.errorIcon} />
                            <span className={styles.resultTitle}>Требуется исправление</span>
                          </>
                        )}
                      </div>

                      {!result.isCorrect && result.correction && (
                        <div className={styles.correctionWrapper}>
                          <span className={styles.correctionLabel}>Корректный вариант:</span>
                          <div className={styles.correctionSentence}>
                            <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(result.correction) }} />
                            <button 
                              type="button" 
                              onClick={() => playTTS(result.correction)}
                              className={styles.audioBtn}
                              title="Прослушать"
                            >
                              <Volume2 size={16} />
                            </button>
                          </div>
                        </div>
                      )}

                      {!result.isCorrect && result.explanation && (
                        <p className={styles.explanationText}>{result.explanation}</p>
                      )}

                      {result.isCorrect && (
                        <div className={styles.successActions}>
                          <p className={styles.successText}>Грамматика правильная. Вы готовы применить это в практике!</p>
                          <button
                            type="button"
                            onClick={onComplete}
                            className="btn-3d btn-green"
                            style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px', margin: '8px auto 0' }}
                          >
                            <Play size={18} />
                            Начать диалог с ИИ
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
