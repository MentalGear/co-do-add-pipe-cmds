/**
 * Unit tests for the pipe command parser
 */
import { describe, it, expect } from 'vitest';
import { parsePipeCommand, isPipeCommandSyntax, formatPipeDescription } from '../../src/pipeParser';

describe('isPipeCommandSyntax', () => {
  it('returns true for commands with pipe operator', () => {
    expect(isPipeCommandSyntax('cat file.txt | grep pattern')).toBe(true);
    expect(isPipeCommandSyntax('cat a.txt | sort | uniq')).toBe(true);
  });

  it('returns true for single known commands', () => {
    expect(isPipeCommandSyntax('cat file.txt')).toBe(true);
    expect(isPipeCommandSyntax('grep pattern file.txt')).toBe(true);
    expect(isPipeCommandSyntax('sort data.txt')).toBe(true);
  });

  it('returns false for natural language with questions', () => {
    expect(isPipeCommandSyntax('What is in file.txt?')).toBe(false);
    expect(isPipeCommandSyntax('Can you grep the logs?')).toBe(false);
    expect(isPipeCommandSyntax('Please cat the file')).toBe(false);
  });

  it('returns false for unknown commands', () => {
    expect(isPipeCommandSyntax('unknown file.txt | grep pattern')).toBe(false);
    expect(isPipeCommandSyntax('ls -la')).toBe(false);
  });

  it('returns false for empty or whitespace', () => {
    expect(isPipeCommandSyntax('')).toBe(false);
    expect(isPipeCommandSyntax('   ')).toBe(false);
  });
});

describe('parsePipeCommand', () => {
  describe('cat command', () => {
    it('parses cat with single file', () => {
      const result = parsePipeCommand('cat file.txt');
      expect(result.isPipeCommand).toBe(true);
      expect(result.commands).toHaveLength(1);
      expect(result.commands[0]).toEqual({
        tool: 'cat',
        args: { path: 'file.txt' },
      });
    });

    it('parses cat with multiple files', () => {
      const result = parsePipeCommand('cat file1.txt file2.txt');
      expect(result.isPipeCommand).toBe(true);
      expect(result.commands[0]).toEqual({
        tool: 'cat',
        args: { paths: ['file1.txt', 'file2.txt'] },
      });
    });

    it('handles quoted paths', () => {
      const result = parsePipeCommand('cat "my file.txt"');
      expect(result.commands[0]).toEqual({
        tool: 'cat',
        args: { path: 'my file.txt' },
      });
    });
  });

  describe('grep command', () => {
    it('parses grep with pattern and file', () => {
      const result = parsePipeCommand('grep error log.txt');
      expect(result.commands[0]).toEqual({
        tool: 'grep',
        args: { pattern: 'error', path: 'log.txt' },
      });
    });

    it('parses grep with -i flag', () => {
      const result = parsePipeCommand('grep -i error log.txt');
      expect(result.commands[0]).toEqual({
        tool: 'grep',
        args: { caseInsensitive: true, pattern: 'error', path: 'log.txt' },
      });
    });

    it('parses grep with -v flag', () => {
      const result = parsePipeCommand('grep -v debug log.txt');
      expect(result.commands[0]).toEqual({
        tool: 'grep',
        args: { invertMatch: true, pattern: 'debug', path: 'log.txt' },
      });
    });

    it('parses grep with multiple flags', () => {
      const result = parsePipeCommand('grep -i -v test file.txt');
      expect(result.commands[0]).toEqual({
        tool: 'grep',
        args: {
          caseInsensitive: true,
          invertMatch: true,
          pattern: 'test',
          path: 'file.txt',
        },
      });
    });
  });

  describe('sort command', () => {
    it('parses sort with no options', () => {
      const result = parsePipeCommand('sort data.txt');
      expect(result.commands[0]).toEqual({
        tool: 'sort',
        args: { path: 'data.txt' },
      });
    });

    it('parses sort with -r flag', () => {
      const result = parsePipeCommand('sort -r data.txt');
      expect(result.commands[0]).toEqual({
        tool: 'sort',
        args: { reverse: true, path: 'data.txt' },
      });
    });

    it('parses sort with -n flag', () => {
      const result = parsePipeCommand('sort -n numbers.txt');
      expect(result.commands[0]).toEqual({
        tool: 'sort',
        args: { numeric: true, path: 'numbers.txt' },
      });
    });

    it('parses sort with -u flag', () => {
      const result = parsePipeCommand('sort -u data.txt');
      expect(result.commands[0]).toEqual({
        tool: 'sort',
        args: { unique: true, path: 'data.txt' },
      });
    });

    it('parses sort with multiple flags', () => {
      const result = parsePipeCommand('sort -r -n -u data.txt');
      expect(result.commands[0]).toEqual({
        tool: 'sort',
        args: { reverse: true, numeric: true, unique: true, path: 'data.txt' },
      });
    });
  });

  describe('head command', () => {
    it('parses head with file', () => {
      const result = parsePipeCommand('head file.txt');
      expect(result.commands[0]).toEqual({
        tool: 'head',
        args: { path: 'file.txt' },
      });
    });

    it('parses head with -n flag', () => {
      const result = parsePipeCommand('head -n 5 file.txt');
      expect(result.commands[0]).toEqual({
        tool: 'head',
        args: { lines: 5, path: 'file.txt' },
      });
    });

    it('parses head with shorthand -N syntax', () => {
      const result = parsePipeCommand('head -20 file.txt');
      expect(result.commands[0]).toEqual({
        tool: 'head',
        args: { lines: 20, path: 'file.txt' },
      });
    });
  });

  describe('tail command', () => {
    it('parses tail with file', () => {
      const result = parsePipeCommand('tail log.txt');
      expect(result.commands[0]).toEqual({
        tool: 'tail',
        args: { path: 'log.txt' },
      });
    });

    it('parses tail with -n flag', () => {
      const result = parsePipeCommand('tail -n 20 log.txt');
      expect(result.commands[0]).toEqual({
        tool: 'tail',
        args: { lines: 20, path: 'log.txt' },
      });
    });
  });

  describe('uniq command', () => {
    it('parses uniq with file', () => {
      const result = parsePipeCommand('uniq data.txt');
      expect(result.commands[0]).toEqual({
        tool: 'uniq',
        args: { path: 'data.txt' },
      });
    });

    it('parses uniq with -c flag', () => {
      const result = parsePipeCommand('uniq -c data.txt');
      expect(result.commands[0]).toEqual({
        tool: 'uniq',
        args: { count: true, path: 'data.txt' },
      });
    });

    it('parses uniq with -d flag', () => {
      const result = parsePipeCommand('uniq -d data.txt');
      expect(result.commands[0]).toEqual({
        tool: 'uniq',
        args: { duplicatesOnly: true, path: 'data.txt' },
      });
    });
  });

  describe('wc command', () => {
    it('parses wc with file', () => {
      const result = parsePipeCommand('wc file.txt');
      expect(result.commands[0]).toEqual({
        tool: 'wc',
        args: { path: 'file.txt' },
      });
    });

    it('parses wc with -l flag', () => {
      const result = parsePipeCommand('wc -l file.txt');
      expect(result.commands[0]).toEqual({
        tool: 'wc',
        args: { countLines: true, countWords: false, countChars: false, path: 'file.txt' },
      });
    });
  });

  describe('pipe chaining', () => {
    it('parses simple pipe chain', () => {
      const result = parsePipeCommand('cat file.txt | grep error');
      expect(result.isPipeCommand).toBe(true);
      expect(result.commands).toHaveLength(2);
      expect(result.commands[0]).toEqual({
        tool: 'cat',
        args: { path: 'file.txt' },
      });
      expect(result.commands[1]).toEqual({
        tool: 'grep',
        args: { pattern: 'error' },
      });
    });

    it('parses multi-stage pipe chain', () => {
      const result = parsePipeCommand('cat data.txt | grep pattern | sort | uniq');
      expect(result.commands).toHaveLength(4);
      expect(result.commands[0]?.tool).toBe('cat');
      expect(result.commands[1]?.tool).toBe('grep');
      expect(result.commands[2]?.tool).toBe('sort');
      expect(result.commands[3]?.tool).toBe('uniq');
    });

    it('parses pipe chain with flags', () => {
      const result = parsePipeCommand('cat log.txt | grep -i error | sort -r | head -n 10');
      expect(result.commands).toHaveLength(4);
      expect(result.commands[1]).toEqual({
        tool: 'grep',
        args: { caseInsensitive: true, pattern: 'error' },
      });
      expect(result.commands[2]).toEqual({
        tool: 'sort',
        args: { reverse: true },
      });
      expect(result.commands[3]).toEqual({
        tool: 'head',
        args: { lines: 10 },
      });
    });

    it('handles grep reading from file in middle of pipe', () => {
      const result = parsePipeCommand('grep error logs.txt | sort | head -5');
      expect(result.commands[0]).toEqual({
        tool: 'grep',
        args: { pattern: 'error', path: 'logs.txt' },
      });
    });
  });

  describe('error handling', () => {
    it('returns error for unknown command in pipe', () => {
      const result = parsePipeCommand('cat file.txt | unknown | sort');
      expect(result.isPipeCommand).toBe(true);
      expect(result.error).toContain('Unknown command');
    });

    it('returns error when first command missing path', () => {
      const result = parsePipeCommand('cat | grep pattern');
      expect(result.isPipeCommand).toBe(true);
      expect(result.error).toContain('requires a file path');
    });

    it('does not return error for grep without file in pipe (receives stdin)', () => {
      const result = parsePipeCommand('cat file.txt | grep pattern');
      expect(result.error).toBeUndefined();
      expect(result.commands[1]).toEqual({
        tool: 'grep',
        args: { pattern: 'pattern' },
      });
    });
  });

  describe('aliases', () => {
    it('treats less as cat', () => {
      const result = parsePipeCommand('less file.txt');
      expect(result.commands[0]?.tool).toBe('cat');
    });

    it('treats more as cat', () => {
      const result = parsePipeCommand('more file.txt');
      expect(result.commands[0]?.tool).toBe('cat');
    });
  });
});

describe('formatPipeDescription', () => {
  it('formats a simple command', () => {
    const result = parsePipeCommand('cat file.txt');
    const desc = formatPipeDescription(result);
    expect(desc).toContain('cat');
    expect(desc).toContain('file.txt');
  });

  it('formats a pipe chain', () => {
    const result = parsePipeCommand('cat file.txt | grep error | sort');
    const desc = formatPipeDescription(result);
    expect(desc).toContain('cat');
    expect(desc).toContain('grep');
    expect(desc).toContain('sort');
    expect(desc).toContain('|');
  });

  it('returns empty string for non-pipe command', () => {
    const result = parsePipeCommand('not a command');
    const desc = formatPipeDescription(result);
    expect(desc).toBe('');
  });
});
