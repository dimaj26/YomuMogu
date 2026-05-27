'use client';

import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle, Loader2, Play, Volume2 } from 'lucide-react';
import grammarRules from '@/resources/grammar_rules.json';
import { sanitizeHtml } from '@/lib/sanitize';
import styles from './GrammarTrainer.module.css';

interface GrammarTrainerProps {
  ruleId: string;
  onClose: () => void;
  onComplete: () => void;
}

export const GrammarTrainer: React.FC<GrammarTrainerProps> = ({ ruleId, onClose, onComplete }) => {
  const rule = grammarRules.find(r => r.id === ruleId);
  const [userInput, setUserInput] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<{ isCorrect: boolean; correction: string; explanation: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          {/* THEORY SECTION */}
          <div className={styles.sectionTheory}>
            <p className={styles.explanation}>{rule.explanation}</p>
            <div className={styles.conjugationCard}>
              <span className={styles.cardTitle}>Как образуется:</span>
              <code className={styles.conjugationCode}>{rule.conjugationGuide}</code>
            </div>
          </div>

          {/* SUGGESTIONS/SCAFFOLDING SECTION */}
          <div className={styles.sectionSuggestions}>
            <h4 className={styles.subTitle}>Подсказки для конструирования:</h4>
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

          {/* INPUT FORM */}
          <form onSubmit={handleVerify} className={styles.inputForm}>
            <label htmlFor="userInput" className={styles.inputLabel}>
              Напишите своё предложение на японском:
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

          {/* RESULTS CARD */}
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
                  <p className={styles.successText}>Предложение составлено верно. Вы готовы закрепить это правило в диалоге с ИИ!</p>
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
      </div>
    </div>
  );
};
