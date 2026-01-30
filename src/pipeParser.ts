/**
 * Pipe Command Parser
 *
 * Parses Unix-style pipe commands and converts them to the pipe tool format.
 * Supports commands like: cat file.txt | grep pattern | sort
 */

/**
 * Command definition for the pipe tool
 */
export interface PipeCommand {
  tool: string;
  args: Record<string, unknown>;
}

/**
 * Result of parsing a pipe command string
 */
export interface ParseResult {
  isPipeCommand: boolean;
  commands: PipeCommand[];
  error?: string;
}

/**
 * Supported pipeable commands and their argument patterns
 */
const COMMAND_PATTERNS: Record<string, {
  toolName: string;
  parseArgs: (args: string[]) => Record<string, unknown>;
}> = {
  cat: {
    toolName: 'cat',
    parseArgs: (args) => {
      if (args.length === 0) return {};
      if (args.length === 1) return { path: args[0] };
      return { paths: args };
    },
  },
  grep: {
    toolName: 'grep',
    parseArgs: (args) => {
      const result: Record<string, unknown> = {};
      let i = 0;

      // Parse flags
      while (i < args.length && args[i]?.startsWith('-')) {
        const flag = args[i];
        if (flag === '-i') {
          result.caseInsensitive = true;
        } else if (flag === '-v') {
          result.invertMatch = true;
        }
        i++;
      }

      // Pattern is required (first non-flag argument)
      if (i < args.length) {
        result.pattern = args[i];
        i++;
      }

      // Optional path
      if (i < args.length) {
        result.path = args[i];
      }

      return result;
    },
  },
  sort: {
    toolName: 'sort',
    parseArgs: (args) => {
      const result: Record<string, unknown> = {};
      let i = 0;

      while (i < args.length) {
        const arg = args[i];
        if (arg === '-r' || arg === '--reverse') {
          result.reverse = true;
        } else if (arg === '-n' || arg === '--numeric') {
          result.numeric = true;
        } else if (arg === '-u' || arg === '--unique') {
          result.unique = true;
        } else if (arg === '-f' || arg === '--ignore-case') {
          result.ignoreCase = true;
        } else if (!arg?.startsWith('-')) {
          result.path = arg;
        }
        i++;
      }

      return result;
    },
  },
  uniq: {
    toolName: 'uniq',
    parseArgs: (args) => {
      const result: Record<string, unknown> = {};
      let i = 0;

      while (i < args.length) {
        const arg = args[i];
        if (arg === '-c' || arg === '--count') {
          result.count = true;
        } else if (arg === '-d' || arg === '--repeated') {
          result.duplicatesOnly = true;
        } else if (arg === '-u' || arg === '--unique') {
          result.uniqueOnly = true;
        } else if (arg === '-i' || arg === '--ignore-case') {
          result.ignoreCase = true;
        } else if (!arg?.startsWith('-')) {
          result.path = arg;
        }
        i++;
      }

      return result;
    },
  },
  head: {
    toolName: 'head',
    parseArgs: (args) => {
      const result: Record<string, unknown> = {};
      let i = 0;

      while (i < args.length) {
        const arg = args[i];
        if (arg === '-n' && i + 1 < args.length) {
          result.lines = parseInt(args[i + 1] || '10', 10);
          i++;
        } else if (arg?.match(/^-\d+$/)) {
          // Handle -N syntax (e.g., -5 for 5 lines)
          result.lines = parseInt(arg.slice(1), 10);
        } else if (!arg?.startsWith('-')) {
          result.path = arg;
        }
        i++;
      }

      return result;
    },
  },
  tail: {
    toolName: 'tail',
    parseArgs: (args) => {
      const result: Record<string, unknown> = {};
      let i = 0;

      while (i < args.length) {
        const arg = args[i];
        if (arg === '-n' && i + 1 < args.length) {
          result.lines = parseInt(args[i + 1] || '10', 10);
          i++;
        } else if (arg?.match(/^-\d+$/)) {
          // Handle -N syntax
          result.lines = parseInt(arg.slice(1), 10);
        } else if (!arg?.startsWith('-')) {
          result.path = arg;
        }
        i++;
      }

      return result;
    },
  },
  wc: {
    toolName: 'wc',
    parseArgs: (args) => {
      const result: Record<string, unknown> = {};
      let hasSpecificFlags = false;

      for (const arg of args) {
        if (arg === '-l' || arg === '--lines') {
          result.countLines = true;
          result.countWords = false;
          result.countChars = false;
          hasSpecificFlags = true;
        } else if (arg === '-w' || arg === '--words') {
          result.countWords = true;
          if (!hasSpecificFlags) {
            result.countLines = false;
            result.countChars = false;
          }
          hasSpecificFlags = true;
        } else if (arg === '-c' || arg === '--chars' || arg === '-m') {
          result.countChars = true;
          if (!hasSpecificFlags) {
            result.countLines = false;
            result.countWords = false;
          }
          hasSpecificFlags = true;
        } else if (!arg?.startsWith('-')) {
          result.path = arg;
        }
      }

      return result;
    },
  },
  read_file: {
    toolName: 'read_file',
    parseArgs: (args) => {
      if (args.length > 0) {
        return { path: args[0] };
      }
      return {};
    },
  },
  write_file: {
    toolName: 'write_file',
    parseArgs: (args) => {
      // write_file needs a path, and optionally content
      // In a pipe context, content usually comes from stdin
      if (args.length > 0) {
        const result: Record<string, unknown> = { path: args[0] };
        if (args.length > 1) {
          result.content = args.slice(1).join(' ');
        }
        return result;
      }
      return {};
    },
  },
};

// Command aliases
const COMMAND_ALIASES: Record<string, string> = {
  less: 'cat',
  more: 'cat',
  type: 'cat',  // Windows-style
  find: 'grep', // Simplified alias
};

/**
 * Tokenize a command string, respecting quotes
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuote: string | null = null;

  for (let i = 0; i < input.length; i++) {
    const char = input[i]!;

    if (inQuote) {
      if (char === inQuote) {
        inQuote = null;
      } else {
        current += char;
      }
    } else if (char === '"' || char === "'") {
      inQuote = char;
    } else if (char === ' ' || char === '\t') {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Parse a single command (e.g., "grep -i pattern file.txt")
 */
function parseCommand(commandStr: string): PipeCommand | null {
  const tokens = tokenize(commandStr.trim());
  if (tokens.length === 0) return null;

  let cmdName = tokens[0]!.toLowerCase();
  const args = tokens.slice(1);

  // Check for aliases
  if (COMMAND_ALIASES[cmdName]) {
    cmdName = COMMAND_ALIASES[cmdName]!;
  }

  // Check if command is supported
  const pattern = COMMAND_PATTERNS[cmdName];
  if (!pattern) {
    return null;
  }

  return {
    tool: pattern.toolName,
    args: pattern.parseArgs(args),
  };
}

/**
 * Check if a string looks like a pipe command
 *
 * A pipe command must:
 * - Contain a pipe operator (|)
 * - OR start with a known command name
 */
export function isPipeCommandSyntax(input: string): boolean {
  const trimmed = input.trim();

  // Must contain a pipe OR start with a known command
  if (!trimmed.includes('|')) {
    // Check if it starts with a known command
    const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase();
    if (!firstWord) return false;

    const isKnownCommand = COMMAND_PATTERNS[firstWord] ||
      COMMAND_ALIASES[firstWord];

    // Only treat as pipe command if it's a simple command execution
    // (starts with a known command and has reasonable syntax)
    return !!isKnownCommand && !trimmed.includes('?') && !trimmed.includes('please');
  }

  // Has pipe - check if segments look like commands
  const segments = trimmed.split('|');
  if (segments.length < 2) return false;

  // Check first segment starts with a known command
  const firstCmd = segments[0]?.trim().split(/\s+/)[0]?.toLowerCase();
  if (!firstCmd) return false;

  return !!(COMMAND_PATTERNS[firstCmd] || COMMAND_ALIASES[firstCmd]);
}

/**
 * Parse a pipe command string into an array of commands
 */
export function parsePipeCommand(input: string): ParseResult {
  const trimmed = input.trim();

  // Check if this looks like a pipe command
  if (!isPipeCommandSyntax(trimmed)) {
    return {
      isPipeCommand: false,
      commands: [],
    };
  }

  // Split by pipe operator
  const segments = trimmed.split('|').map(s => s.trim()).filter(s => s.length > 0);

  if (segments.length === 0) {
    return {
      isPipeCommand: false,
      commands: [],
    };
  }

  const commands: PipeCommand[] = [];

  for (const segment of segments) {
    const cmd = parseCommand(segment);
    if (!cmd) {
      // Unknown command in pipe
      const cmdName = segment.split(/\s+/)[0];
      return {
        isPipeCommand: true,
        commands: [],
        error: `Unknown command: ${cmdName}`,
      };
    }
    commands.push(cmd);
  }

  // Validate: first command should have a source (path)
  // Unless it's receiving from a previous pipe (but since we're parsing user input,
  // the first command must have a source)
  if (commands.length > 0) {
    const firstCmd = commands[0]!;
    if (['cat', 'read_file', 'grep'].includes(firstCmd.tool)) {
      if (!firstCmd.args.path && !firstCmd.args.paths) {
        return {
          isPipeCommand: true,
          commands: [],
          error: `First command (${firstCmd.tool}) requires a file path`,
        };
      }
    }
  }

  return {
    isPipeCommand: true,
    commands,
  };
}

/**
 * Format a ParseResult as a human-readable description
 */
export function formatPipeDescription(result: ParseResult): string {
  if (!result.isPipeCommand || result.commands.length === 0) {
    return '';
  }

  const parts = result.commands.map(cmd => {
    const argsStr = Object.entries(cmd.args)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(', ');
    return `${cmd.tool}(${argsStr})`;
  });

  return parts.join(' | ');
}
