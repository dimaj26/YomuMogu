import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSendMessage = vi.fn();
const mockGenerateHints = vi.fn();
const mockWarn = vi.fn();

// Мокаем ChatService
vi.mock('@/lib/gemini/chat', () => ({
  chatService: {
    sendMessage: (...args: any[]) => mockSendMessage(...args),
    generateHints: (...args: any[]) => mockGenerateHints(...args),
  }
}));

// Мокаем Logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: (...args: any[]) => mockWarn(...args),
    debug: vi.fn()
  }
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';

function createRequest(body: any): NextRequest {
  return new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('API Route POST /api/chat', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
  });

  it('should return 500 if GEMINI_API_KEY is not defined', async () => {
    delete process.env.GEMINI_API_KEY;
    const req = createRequest({
      scenario: 'test',
      targetWords: [],
      history: [],
      message: 'hello'
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('GEMINI_API_KEY');
  });

  it('should return 400 if required fields are missing', async () => {
    const req = createRequest({ scenario: 'test' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should return 400 if message is empty', async () => {
    const req = createRequest({
      scenario: 'test',
      targetWords: [{ word: '猫', translation: 'кошка' }],
      history: [],
      message: ''
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should successfully return chat response', async () => {
    const mockResponse = {
      reply: 'こんにちは！',
      translation: 'Привет!',
      grammarFeedback: { isCorrect: true, correction: '', explanation: '' },
      wordsDetected: ['猫']
    };
    mockSendMessage.mockResolvedValue(mockResponse);

    const req = createRequest({
      scenario: 'В кафе',
      targetWords: [{ word: '猫', translation: 'кошка' }],
      history: [],
      message: '猫が好きです'
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.reply).toBe('こんにちは！');
    expect(data.wordsDetected).toContain('猫');
    expect(mockSendMessage).toHaveBeenCalledOnce();
  });

  it('should handle __START__ message correctly', async () => {
    const mockResponse = {
      reply: 'いらっしゃいませ！',
      translation: 'Добро пожаловать!',
      grammarFeedback: { isCorrect: true, correction: '', explanation: '' },
      wordsDetected: []
    };
    mockSendMessage.mockResolvedValue(mockResponse);

    const req = createRequest({
      scenario: 'В кафе',
      targetWords: [{ word: '水', translation: 'вода' }],
      history: [],
      message: '__START__'
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.reply).toBe('いらっしゃいませ！');
  });

  it('should handle hybrid input (Cyrillic placeholders) correctly', async () => {
    const mockResponse = {
      reply: '椅子に座りましょう。',
      translation: 'Давайте сядем на стул.',
      grammarFeedback: {
        isCorrect: false,
        correction: '<ruby>椅子<rt>いす</rt></ruby>に座って',
        explanation: 'Использован русский плейсхолдер Стул, правильный перевод 椅子.'
      },
      wordsDetected: []
    };
    mockSendMessage.mockResolvedValue(mockResponse);

    const req = createRequest({
      scenario: 'В кафе',
      targetWords: [{ word: '水', translation: 'вода' }],
      history: [],
      message: 'Стулの座って'
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.grammarFeedback.isCorrect).toBe(false);
    expect(data.grammarFeedback.correction).toBe('<ruby>椅子<rt>いす</rt></ruby>に座って');
    expect(mockSendMessage).toHaveBeenCalledOnce();
  });

  it('should pass grammarScopeInstruction to chatService when grammarScope is provided', async () => {
    const mockResponse = {
      reply: 'こんにちは！',
      translation: 'Привет!',
      grammarFeedback: { isCorrect: true, correction: '', explanation: '' },
      wordsDetected: [],
      usedConstructions: ['g_n5_s1_1']
    };
    mockSendMessage.mockResolvedValue(mockResponse);

    const req = createRequest({
      scenario: 'В кафе',
      targetWords: [],
      history: [],
      message: 'こんにちは',
      grammarScope: {
        allowedConstructions: [
          { id: 'g_n5_s1_1', construction: 'АはБです' }
        ],
        focus: { id: 'g_n5_s1_1', construction: 'АはБです' }
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.any(Array),
      expect.any(String),
      expect.any(Number),
      expect.any(Boolean),
      undefined,
      undefined,
      expect.stringContaining('CRITICAL GRAMMAR CONSTRAINT')
    );
  });

  it('should warn when Gemini uses construction outside allowed scope', async () => {
    mockWarn.mockClear();
    const mockResponse = {
      reply: 'ご飯を食べます。',
      translation: 'Я ем рис.',
      grammarFeedback: { isCorrect: true, correction: '', explanation: '' },
      wordsDetected: [],
      usedConstructions: ['g_n5_s3']
    };
    mockSendMessage.mockResolvedValue(mockResponse);

    const req = createRequest({
      scenario: 'В кафе',
      targetWords: [],
      history: [],
      message: 'こんにちは',
      grammarScope: {
        allowedConstructions: [
          { id: 'g_n5_s1_1', construction: 'АはБです' }
        ]
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining('[Grammar Scope Check] Нарушение ограничений грамматики ИИ')
    );
  });
});
