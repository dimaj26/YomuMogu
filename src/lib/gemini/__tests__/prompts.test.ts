import { describe, it, expect } from 'vitest';
import { getChatSystemInstruction, LEVEL_INSTRUCTIONS, getHintSystemInstruction } from '../prompts';

describe('getChatSystemInstruction', () => {
  const options = {
    scenario: 'Test Scenario',
    targetWordsList: '猫 (кошка), 犬 (собака)',
    unusedWordsList: '猫 (кошка)',
    usedWordsList: '犬 (собака)',
    levelInstruction: 'LEVEL 1 RULES',
    grammarLang: 'Russian',
    isStart: false,
    modelTurnCount: 3,
  };

  it('should include scenario description and target words', () => {
    const prompt = getChatSystemInstruction(options);
    expect(prompt).toContain('Test Scenario');
    expect(prompt).toContain('猫 (кошка), 犬 (собака)');
  });

  it('should include CONVERSATIONAL COHERENCE rules', () => {
    const prompt = getChatSystemInstruction(options);
    expect(prompt).toContain('CONVERSATIONAL COHERENCE');
    expect(prompt).toContain('answer that question in character first');
  });

  it('should include RESPOND TO INTENDED MEANING rules', () => {
    const prompt = getChatSystemInstruction(options);
    expect(prompt).toContain('RESPOND TO INTENDED MEANING');
    expect(prompt).toContain('base it on the *intended and corrected* meaning');
  });

  it('should include hybrid and Russian placeholder correction rules', () => {
    const prompt = getChatSystemInstruction(options);
    expect(prompt).toContain('Hybrid Input (Cyrillic Placeholders)');
    expect(prompt).toContain('Entirely Russian Input');
    expect(prompt).toContain('Furigana in Correction');
  });

  it('should include shortNote instructions in system prompt', () => {
    const prompt = getChatSystemInstruction(options);
    expect(prompt).toContain('shortNote');
    expect(prompt).toContain('«категория: неверное → верное»');
  });

  it('closingTurn-блок промпта требует финальную реплику без вопроса', () => {
    const prompt = getChatSystemInstruction({
      ...options,
      closingTurn: true,
    });
    expect(prompt).toContain('closingTurn');
    expect(prompt).toContain('NO question');
  });
});

describe('getHintSystemInstruction', () => {
  it('should contain ready-sentence ban and new scaffolding instructions in hint prompt', () => {
    const prompt = getHintSystemInstruction({
      scenario: 'Test Scenario',
      targetWordsList: '猫 (кошка)',
      unusedWordsList: '猫 (кошка)',
      rubyInstruction: 'ruby rules'
    });
    expect(prompt).toContain('СТРОГО ЗАПРЕЩЕНО');
    expect(prompt).toContain('keywords');
    expect(prompt).toContain('patternHint');
  });
});

describe('LEVEL_INSTRUCTIONS', () => {
  it('should specify corrections field in levels rules', () => {
    expect(LEVEL_INSTRUCTIONS[1]).toContain('grammarFeedback.correction');
    expect(LEVEL_INSTRUCTIONS[2]).toContain('grammarFeedback.correction');
    expect(LEVEL_INSTRUCTIONS[3]).toContain('grammarFeedback.correction');
    expect(LEVEL_INSTRUCTIONS[4]).toContain('grammarFeedback.correction');
    expect(LEVEL_INSTRUCTIONS[5]).toContain('grammarFeedback.correction');
  });

  it('все уровни LEVEL_INSTRUCTIONS требуют полную ruby-разметку', () => {
    for (let level = 1; level <= 5; level++) {
      expect(LEVEL_INSTRUCTIONS[level]).toContain('EVERY single kanji word');
      expect(LEVEL_INSTRUCTIONS[level]).toContain('MUST be wrapped in HTML ruby tags');
    }
  });
});

