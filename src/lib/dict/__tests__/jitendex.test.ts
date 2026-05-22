import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lookupWord } from '../jitendex';
import child_process from 'child_process';

vi.mock('child_process', () => {
  const fn = vi.fn();
  return {
    execFile: fn,
    default: {
      execFile: fn,
    },
  };
});

describe('JitenDex wrapper', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should resolve and return the parsed stdout json on success', async () => {
    const mockOutput = {
      word: '相手',
      entry: '@jitendex-1401000',
      definition: '<div>Definition</div>',
    };

    const spy = vi.spyOn(child_process, 'execFile').mockImplementation(
      // @ts-ignore
      (file, args, options, callback) => {
        // @ts-ignore
        callback(null, { stdout: JSON.stringify(mockOutput), stderr: '' });
      }
    );

    const result = await lookupWord('相手');
    expect(result).toEqual(mockOutput);
    expect(spy).toHaveBeenCalled();
    const [file, args, options] = spy.mock.calls[0];
    expect(file).toBe('python');
    expect(args[0]).toContain('lookup.py');
    expect(args[1]).toBe('相手');
    expect(options).toEqual({ encoding: 'utf8' });
  });

  it('should return error on lookup failure', async () => {
    vi.spyOn(child_process, 'execFile').mockImplementation(
      // @ts-ignore
      (file, args, options, callback) => {
        // @ts-ignore
        callback(new Error('Process failed'), { stdout: '', stderr: 'stderr output' });
      }
    );

    const result = await lookupWord('相手');
    expect(result.error).toContain('Process failed');
  });
});
