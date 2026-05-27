'use client';

import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle, Loader2, Play, Volume2, ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import grammarRules from '@/resources/grammar_rules.json';
import { sanitizeHtml } from '@/lib/sanitize';
import styles from './GrammarTrainer.module.css';

interface GrammarTrainerProps {
  ruleId: string;
  onClose: () => void;
  onComplete: () => void;
}

// Вспомогательная функция для перемешивания токенов
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const GrammarTrainer: React.FC<GrammarTrainerProps> = ({ ruleId, onClose, onComplete }) => {
  const rule = grammarRules.find(r => r.id === ruleId);
  const hasSubSteps = rule && rule.subSteps && rule.subSteps.length > 0;

  const [step, setStep] = useState<'theory' | 'tokens' | 'free-writing'>(
    hasSubSteps ? 'theory' : 'free-writing'
  );

  // Состояние слайдера теории
  const [subStepIdx, setSubStepIdx] = useState(0);

  // Состояние конструктора токенов
  const targetSuggestion = rule?.suggestions && rule.suggestions[0];
  const targetTokens = targetSuggestion && 'tokens' in targetSuggestion ? (targetSuggestion.tokens as string[]) : [];
  const [shuffledTokens, setShuffledTokens] = useState<string[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenSuccess, setTokenSuccess] = useState(false);

  // Состояние свободного ввода
  const [userInput, setUserInput] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<{ isCorrect: boolean; correction: string; explanation: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Перемешиваем токены при входе на шаг квиза
  const startTokensStep = () => {
    if (targetTokens && targetTokens.length > 0) {
      setShuffledTokens(shuffleArray(targetTokens));
    }
    setSelectedIndices([]);
    setTokenError(null);
    setTokenSuccess(false);
    setStep('tokens');
  };

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
    } catch (err: any) {
      setError(err.message || 'Произошла непредвиденная ошибка.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleSuggestionClick = (sampleAnswer: string) => {
    setUserInput(sampleAnswer);
    setResult(null);
    setError(null);
  };

  const playTTS = (text: string) => {
    const cleanText = text.replace(/<rt>[\s\S]*?<\/rt>/gi, '').replace(/<\/?[^>]+(>|$)/g, '').trim();
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q=${encodeURIComponent(cleanText)}`;
    const audio = new Audio(url);
    audio.play().catch(() => {});
  };

  // Логика токен-билдера
  const handleTokenClick = (idx: number) => {
    if (tokenSuccess) return;
    if (selectedIndices.includes(idx)) {
      setSelectedIndices(selectedIndices.filter(i => i !== idx));
    } else {
      setSelectedIndices([...selectedIndices, idx]);
    }
    setTokenError(null);
  };

  const resetTokens = () => {
    setSelectedIndices([]);
    setTokenError(null);
    setTokenSuccess(false);
    if (targetTokens && targetTokens.length > 0) {
      setShuffledTokens(shuffleArray(targetTokens));
    }
  };

  const checkTokens = () => {
    const built = selectedIndices.map(idx => shuffledTokens[idx]).join('');
    const cleanedBuilt = built.replace(/[\s\t\r\n\u3000。、？！・.?!,]/g, '');
    const cleanedTarget = targetSuggestion ? targetSuggestion.sampleAnswer.replace(/[\s\t\r\n\u3000。、？！・.?!,]/g, '') : '';

    if (cleanedBuilt === cleanedTarget) {
      setTokenSuccess(true);
      setTokenError(null);
    } else {
      setTokenError('Порядок слов неверный. Попробуйте еще раз!');
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modalCard}>
        {/* HEADER */}
        <div className={styles.modalHeader}>
          <div>
            <span className={styles.ruleTopic}>{rule.topic}</span>
            <h2 className={styles.ruleConstruction}>{rule.construction}</h2>
          </div>
          <button onClick={onClose} className={styles.closeBtn} title="Закрыть">
            <X size={22} />
          </button>
        </div>

        <div className={styles.modalContent}>
          {/* ШАГ 1: ПОШАГОВАЯ ТЕОРИЯ */}
          {step === 'theory' && rule.subSteps && (
            <div className={styles.stepContainer}>
              <div className={styles.progressHeader}>
                <span>Разбор теории</span>
                <span>{subStepIdx + 1} / {rule.subSteps.length}</span>
              </div>
              
              <div className={styles.progressDots}>
                {rule.subSteps.map((_, sIdx) => (
                  <div 
                    key={sIdx} 
                    className={`${styles.dot} ${sIdx === subStepIdx ? styles.activeDot : ''} ${sIdx < subStepIdx ? styles.passedDot : ''}`}
                  />
                ))}
              </div>

              <div className={styles.theorySlide}>
                {/* Кастинг полей step/title и detail/explanation для совместимости */}
                <h3 className={styles.slideTitle}>
                  {(rule.subSteps[subStepIdx] as any).title || (rule.subSteps[subStepIdx] as any).step}
                </h3>
                <p className={styles.slideText}>
                  {(rule.subSteps[subStepIdx] as any).explanation || (rule.subSteps[subStepIdx] as any).detail}
                </p>
              </div>

              <div className={styles.navigationBtns}>
                <button
                  type="button"
                  onClick={() => setSubStepIdx(subStepIdx - 1)}
                  disabled={subStepIdx === 0}
                  className={`btn-3d btn-blue ${styles.navBtn}`}
                >
                  <ArrowLeft size={16} /> Назад
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (subStepIdx < rule.subSteps!.length - 1) {
                      setSubStepIdx(subStepIdx + 1);
                    } else {
                      startTokensStep();
                    }
                  }}
                  className={`btn-3d btn-green ${styles.navBtn}`}
                >
                  {subStepIdx < rule.subSteps.length - 1 ? (
                    <>Далее <ArrowRight size={16} /></>
                  ) : (
                    <>К практике <Play size={16} /></>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ШАГ 2: ИНТЕРАКТИВНЫЙ КОНСТРУКТОР */}
          {step === 'tokens' && targetSuggestion && (
            <div className={styles.stepContainer}>
              <div className={styles.progressHeader}>
                <span>Шаг 2: Конструктор предложений</span>
                <span className={styles.badge}>Практика</span>
              </div>

              <div className={styles.instructionBox}>
                <span className={styles.instructionLabel}>Задание:</span>
                <p className={styles.instructionText}>{targetSuggestion.hint}</p>
                {targetSuggestion.baseWords && (
                  <span className={styles.baseWordsHint}>Опорные слова: {targetSuggestion.baseWords}</span>
                )}
              </div>

              {/* Зона сборки */}
              <div className={styles.workspace}>
                {selectedIndices.length === 0 ? (
                  <span className={styles.workspacePlaceholder}>Нажимайте на слова ниже, чтобы собрать фразу...</span>
                ) : (
                  <div className={styles.tokenList}>
                    {selectedIndices.map((idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleTokenClick(idx)}
                        className={`${styles.token} ${styles.selectedToken}`}
                      >
                        {shuffledTokens[idx]}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Зона выбора токенов */}
              <div className={styles.tokenPool}>
                {shuffledTokens.map((token, idx) => {
                  const isUsed = selectedIndices.includes(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleTokenClick(idx)}
                      className={`${styles.token} ${isUsed ? styles.usedToken : ''}`}
                      disabled={isUsed || tokenSuccess}
                    >
                      {token}
                    </button>
                  );
                })}
              </div>

              {tokenError && (
                <div className={`${styles.resultBanner} ${styles.errorBanner}`}>
                  <AlertCircle size={20} className={styles.icon} />
                  <span>{tokenError}</span>
                </div>
              )}

              {tokenSuccess && (
                <div className={`${styles.resultBanner} ${styles.successBanner}`}>
                  <CheckCircle size={20} className={styles.icon} />
                  <span>Отлично! Предложение собрано верно.</span>
                </div>
              )}

              <div className={styles.constructorControls}>
                <button
                  type="button"
                  onClick={resetTokens}
                  className={`btn-3d btn-red ${styles.controlBtn}`}
                  disabled={tokenSuccess}
                >
                  <RotateCcw size={16} /> Сбросить
                </button>

                {tokenSuccess ? (
                  <button
                    type="button"
                    onClick={() => setStep('free-writing')}
                    className={`btn-3d btn-green ${styles.controlBtn}`}
                  >
                    Далее <ArrowRight size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={checkTokens}
                    className={`btn-3d btn-blue ${styles.controlBtn}`}
                    disabled={selectedIndices.length === 0}
                  >
                    Проверить
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ШАГ 3: СВОБОДНОЕ КОНСТРУИРОВАНИЕ (Gemini) */}
          {step === 'free-writing' && (
            <div className={styles.stepContainer}>
              {hasSubSteps && (
                <div className={styles.progressHeader}>
                  <span>Шаг 3: Свободное конструирование</span>
                  <span className={styles.badge}>ИИ-Анализ</span>
                </div>
              )}

              <div className={styles.sectionTheory}>
                <p className={styles.explanation}>{rule.explanation}</p>
                <div className={styles.conjugationCard}>
                  <span className={styles.cardTitle}>Как образуется:</span>
                  <code className={styles.conjugationCode}>{rule.conjugationGuide}</code>
                </div>
              </div>

              <div className={styles.sectionSuggestions}>
                <h4 className={styles.subTitle}>Примеры и подсказки:</h4>
                <div className={styles.suggestionsGrid}>
                  {rule.suggestions.map((s, idx) => (
                    <div key={idx} className={styles.suggestionCard}>
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

              <form onSubmit={handleVerify} className={styles.inputForm}>
                <label htmlFor="userInput" className={styles.inputLabel}>
                  Составьте собственное предложение на японском:
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
                    placeholder="Пример: 本を読んでください。"
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
                <div className={`${styles.resultBanner} ${styles.errorBanner}`}>
                  <AlertCircle size={20} className={styles.icon} />
                  <span>{error}</span>
                </div>
              )}

              {result && (
                <div className={`${styles.resultCard} ${result.isCorrect ? styles.correct : styles.incorrect}`}>
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
                      <p className={styles.successText}>Вы полностью освоили это правило! Оно готово для отработки в диалогах.</p>
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
  );
};
