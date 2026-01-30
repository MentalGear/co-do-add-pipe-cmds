/**
 * Terminal Component
 * Provides a CLI interface for executing file system tools
 *
 * Users can type commands like:
 *   ls              - List files
 *   cat file.txt    - Display file contents
 *   grep pattern    - Search for pattern
 *   etc.
 */

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { opfsFileSystem } from './opfsFileSystem';

// Import xterm CSS - Vite will handle this
import '@xterm/xterm/css/xterm.css';

/**
 * Command result type
 */
interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
}

/**
 * Available commands and their descriptions
 */
/**
 * Command aliases that map tool names to their implementations
 * This allows using both Unix-style names (ls, rm) and tool names (list_files, delete_file)
 */
const COMMAND_ALIASES: Record<string, string> = {
  // Tool name -> Unix command mapping
  list_files: 'ls',
  open_file: 'cat',
  create_file: 'touch',
  delete_file: 'rm',
  move_file: 'mv',
  rename_file: 'mv',
  head_file: 'head',
  tail_file: 'tail',
  write_file: 'write',
};

const COMMANDS: Record<string, string> = {
  help: 'Show available commands',
  ls: 'List files and directories [path] (alias: list_files)',
  cat: 'Display file contents <path> (alias: open_file)',
  mkdir: 'Create directory <path>',
  touch: 'Create empty file <path> (alias: create_file)',
  rm: 'Remove file <path> (alias: delete_file)',
  rmdir: 'Remove directory <path>',
  mv: 'Move/rename file <source> <dest> (alias: move_file, rename_file)',
  cp: 'Copy file <source> <dest>',
  pwd: 'Print working directory',
  cd: 'Change directory <path>',
  clear: 'Clear terminal',
  tree: 'Show directory tree [path]',
  head: 'Show first N lines <path> [lines] (alias: head_file)',
  tail: 'Show last N lines <path> [lines] (alias: tail_file)',
  grep: 'Search pattern in file <pattern> <path>',
  wc: 'Count lines/words/chars <path>',
  diff: 'Compare two files <file1> <file2>',
  sort: 'Sort lines of a file <path>',
  uniq: 'Filter duplicate lines <path>',
  echo: 'Print text [text...]',
  write: 'Write content to file <path> <content> (alias: write_file)',
  import: 'Import files from computer',
  export: 'Export file to download <path>',
  storage: 'Show storage usage',
  reset: 'Clear all files in OPFS',
  debug: 'Toggle debug mode (show tool input/output)',
};

/**
 * Terminal Manager class
 */
export class TerminalManager {
  private terminal: Terminal;
  private fitAddon: FitAddon;
  private resizeObserver: ResizeObserver | null = null;
  private currentLine: string = '';
  private commandHistory: string[] = [];
  private historyIndex: number = -1;
  private currentDirectory: string = '';
  private debugMode: boolean = false;

  constructor() {
    this.terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"Fira Code", "Cascadia Code", Consolas, monospace',
      theme: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#f5e0dc',
        cursorAccent: '#1e1e2e',
        selectionBackground: '#585b70',
        black: '#45475a',
        red: '#f38ba8',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        blue: '#89b4fa',
        magenta: '#f5c2e7',
        cyan: '#94e2d5',
        white: '#bac2de',
        brightBlack: '#585b70',
        brightRed: '#f38ba8',
        brightGreen: '#a6e3a1',
        brightYellow: '#f9e2af',
        brightBlue: '#89b4fa',
        brightMagenta: '#f5c2e7',
        brightCyan: '#94e2d5',
        brightWhite: '#a6adc8',
      },
    });

    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
  }

  /**
   * Mount terminal to a container element
   */
  async mount(container: HTMLElement): Promise<void> {
    this.terminal.open(container);
    this.fitAddon.fit();

    // Initialize OPFS
    await opfsFileSystem.init();

    // Set up input handling
    this.terminal.onData(this.handleInput.bind(this));

    // Handle container resize with ResizeObserver
    this.resizeObserver = new ResizeObserver(() => {
      this.fitAddon.fit();
    });
    this.resizeObserver.observe(container);

    // Also handle window resize as fallback
    window.addEventListener('resize', () => {
      this.fitAddon.fit();
    });

    // Show welcome message
    this.showWelcome();
    this.prompt();
  }

  /**
   * Show welcome message
   */
  private showWelcome(): void {
    this.terminal.writeln('\x1b[1;34m╔════════════════════════════════════════╗\x1b[0m');
    this.terminal.writeln('\x1b[1;34m║\x1b[0m  \x1b[1;32mCo-do OPFS Terminal\x1b[0m                   \x1b[1;34m║\x1b[0m');
    this.terminal.writeln('\x1b[1;34m║\x1b[0m  Type \x1b[1;33mhelp\x1b[0m for commands, \x1b[1;33mdebug\x1b[0m for logs \x1b[1;34m║\x1b[0m');
    this.terminal.writeln('\x1b[1;34m╚════════════════════════════════════════╝\x1b[0m');
    this.terminal.writeln('');
  }

  /**
   * Show command prompt
   */
  private prompt(): void {
    const dir = this.currentDirectory || '/';
    this.terminal.write(`\x1b[1;36m${dir}\x1b[0m \x1b[1;32m$\x1b[0m `);
  }

  /**
   * Handle terminal input
   */
  private handleInput(data: string): void {
    // Handle special keys
    if (data === '\r') {
      // Enter
      this.terminal.writeln('');
      this.executeCommand(this.currentLine.trim());
      this.currentLine = '';
      return;
    }

    if (data === '\x7f') {
      // Backspace
      if (this.currentLine.length > 0) {
        this.currentLine = this.currentLine.slice(0, -1);
        this.terminal.write('\b \b');
      }
      return;
    }

    if (data === '\x1b[A') {
      // Up arrow - history
      if (this.historyIndex < this.commandHistory.length - 1) {
        this.historyIndex++;
        this.replaceCurrentLine(this.commandHistory[this.commandHistory.length - 1 - this.historyIndex] || '');
      }
      return;
    }

    if (data === '\x1b[B') {
      // Down arrow - history
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.replaceCurrentLine(this.commandHistory[this.commandHistory.length - 1 - this.historyIndex] || '');
      } else if (this.historyIndex === 0) {
        this.historyIndex = -1;
        this.replaceCurrentLine('');
      }
      return;
    }

    if (data === '\x03') {
      // Ctrl+C
      this.terminal.writeln('^C');
      this.currentLine = '';
      this.prompt();
      return;
    }

    if (data === '\x0c') {
      // Ctrl+L - clear
      this.terminal.clear();
      this.prompt();
      return;
    }

    // Regular character input
    if (data >= ' ' && data <= '~') {
      this.currentLine += data;
      this.terminal.write(data);
    }
  }

  /**
   * Replace current line with new text
   */
  private replaceCurrentLine(newLine: string): void {
    // Clear current line
    this.terminal.write('\x1b[2K\r');
    this.prompt();
    this.currentLine = newLine;
    this.terminal.write(newLine);
  }

  /**
   * Execute a command
   */
  private async executeCommand(input: string): Promise<void> {
    if (!input) {
      this.prompt();
      return;
    }

    // Add to history
    this.commandHistory.push(input);
    this.historyIndex = -1;

    // Parse command and arguments
    const parts = this.parseCommand(input);
    const command = parts[0]?.toLowerCase() || '';
    const args = parts.slice(1);

    try {
      const result = await this.runCommand(command, args);

      if (result.output) {
        this.terminal.writeln(result.output);
      }

      if (result.error) {
        this.terminal.writeln(`\x1b[1;31mError:\x1b[0m ${result.error}`);
      }
    } catch (error) {
      this.terminal.writeln(`\x1b[1;31mError:\x1b[0m ${(error as Error).message}`);
    }

    this.prompt();
  }

  /**
   * Parse command string into parts (respects quotes)
   */
  private parseCommand(input: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';

    for (const char of input) {
      if ((char === '"' || char === "'") && !inQuote) {
        inQuote = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuote) {
        inQuote = false;
        quoteChar = '';
      } else if (char === ' ' && !inQuote) {
        if (current) {
          parts.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      parts.push(current);
    }

    return parts;
  }

  /**
   * Resolve path relative to current directory
   */
  private resolvePath(path: string): string {
    if (!path || path === '.') {
      return this.currentDirectory;
    }

    if (path.startsWith('/')) {
      return path.slice(1); // Remove leading slash for OPFS
    }

    if (path === '..') {
      const parts = this.currentDirectory.split('/').filter(p => p);
      parts.pop();
      return parts.join('/');
    }

    if (path.startsWith('./')) {
      path = path.slice(2);
    }

    return this.currentDirectory ? `${this.currentDirectory}/${path}` : path;
  }

  /**
   * Run a command and return result
   */
  private async runCommand(command: string, args: string[]): Promise<CommandResult> {
    // Resolve command aliases (tool names -> Unix commands)
    const resolvedCommand = COMMAND_ALIASES[command] || command;

    switch (resolvedCommand) {
      case 'help':
        return this.cmdHelp();

      case 'ls':
        return this.cmdLs(args[0]);

      case 'cat':
        return this.cmdCat(args[0]);

      case 'mkdir':
        return this.cmdMkdir(args[0]);

      case 'touch':
        return this.cmdTouch(args[0]);

      case 'rm':
        return this.cmdRm(args[0]);

      case 'rmdir':
        return this.cmdRmdir(args[0]);

      case 'mv':
        return this.cmdMv(args[0], args[1]);

      case 'cp':
        return this.cmdCp(args[0], args[1]);

      case 'pwd':
        return this.cmdPwd();

      case 'cd':
        return this.cmdCd(args[0]);

      case 'clear':
        this.terminal.clear();
        return { success: true, output: '' };

      case 'tree':
        return this.cmdTree(args[0]);

      case 'head':
        return this.cmdHead(args[0], parseInt(args[1] || '10') || 10);

      case 'tail':
        return this.cmdTail(args[0], parseInt(args[1] || '10') || 10);

      case 'grep':
        return this.cmdGrep(args[0], args[1]);

      case 'wc':
        return this.cmdWc(args[0]);

      case 'diff':
        return this.cmdDiff(args[0], args[1]);

      case 'sort':
        return this.cmdSort(args[0]);

      case 'uniq':
        return this.cmdUniq(args[0]);

      case 'echo':
        return { success: true, output: args.join(' ') };

      case 'write':
        return this.cmdWrite(args[0], args.slice(1).join(' '));

      case 'import':
        return this.cmdImport();

      case 'export':
        return this.cmdExport(args[0]);

      case 'storage':
        return this.cmdStorage();

      case 'reset':
        return this.cmdReset();

      case 'debug':
        return this.cmdDebug();

      default:
        return {
          success: false,
          output: '',
          error: `Unknown command: ${command}. Type 'help' for available commands.`,
        };
    }
  }

  // Command implementations

  private cmdHelp(): CommandResult {
    const lines = ['\x1b[1;33mAvailable Commands:\x1b[0m', ''];

    for (const [cmd, desc] of Object.entries(COMMANDS)) {
      lines.push(`  \x1b[1;32m${cmd.padEnd(12)}\x1b[0m ${desc}`);
    }

    return { success: true, output: lines.join('\n') };
  }

  private async cmdLs(path?: string): Promise<CommandResult> {
    const resolvedPath = path ? this.resolvePath(path) : this.currentDirectory;
    const entries = await opfsFileSystem.listFiles();

    const filtered = entries.filter(e => {
      if (!resolvedPath) {
        return !e.path.includes('/');
      }
      return e.path.startsWith(resolvedPath + '/') &&
        !e.path.slice(resolvedPath.length + 1).includes('/');
    });

    if (filtered.length === 0) {
      return { success: true, output: '\x1b[2m(empty)\x1b[0m' };
    }

    const lines = filtered.map(e => {
      const name = e.name;
      if (e.kind === 'directory') {
        return `\x1b[1;34m${name}/\x1b[0m`;
      }
      return name;
    });

    return { success: true, output: lines.join('  ') };
  }

  private async cmdCat(path?: string): Promise<CommandResult> {
    if (!path) {
      return { success: false, output: '', error: 'Usage: cat <path>' };
    }

    const resolvedPath = this.resolvePath(path);
    const content = await opfsFileSystem.readFile(resolvedPath);
    return { success: true, output: content };
  }

  private async cmdMkdir(path?: string): Promise<CommandResult> {
    if (!path) {
      return { success: false, output: '', error: 'Usage: mkdir <path>' };
    }

    const resolvedPath = this.resolvePath(path);
    await opfsFileSystem.createDirectory(resolvedPath);
    return { success: true, output: `Created directory: ${resolvedPath}` };
  }

  private async cmdTouch(path?: string): Promise<CommandResult> {
    if (!path) {
      return { success: false, output: '', error: 'Usage: touch <path>' };
    }

    const resolvedPath = this.resolvePath(path);
    await opfsFileSystem.createFile(resolvedPath, '');
    return { success: true, output: `Created file: ${resolvedPath}` };
  }

  private async cmdRm(path?: string): Promise<CommandResult> {
    if (!path) {
      return { success: false, output: '', error: 'Usage: rm <path>' };
    }

    const resolvedPath = this.resolvePath(path);
    await opfsFileSystem.deleteFile(resolvedPath);
    return { success: true, output: `Removed: ${resolvedPath}` };
  }

  private async cmdRmdir(path?: string): Promise<CommandResult> {
    if (!path) {
      return { success: false, output: '', error: 'Usage: rmdir <path>' };
    }

    const resolvedPath = this.resolvePath(path);
    await opfsFileSystem.deleteDirectory(resolvedPath);
    return { success: true, output: `Removed directory: ${resolvedPath}` };
  }

  private async cmdMv(source?: string, dest?: string): Promise<CommandResult> {
    if (!source || !dest) {
      return { success: false, output: '', error: 'Usage: mv <source> <dest>' };
    }

    const resolvedSource = this.resolvePath(source);
    const resolvedDest = this.resolvePath(dest);
    await opfsFileSystem.renameFile(resolvedSource, resolvedDest);
    return { success: true, output: `Moved: ${resolvedSource} -> ${resolvedDest}` };
  }

  private async cmdCp(source?: string, dest?: string): Promise<CommandResult> {
    if (!source || !dest) {
      return { success: false, output: '', error: 'Usage: cp <source> <dest>' };
    }

    const resolvedSource = this.resolvePath(source);
    const resolvedDest = this.resolvePath(dest);
    await opfsFileSystem.copyFile(resolvedSource, resolvedDest);
    return { success: true, output: `Copied: ${resolvedSource} -> ${resolvedDest}` };
  }

  private cmdPwd(): CommandResult {
    return { success: true, output: '/' + this.currentDirectory };
  }

  private async cmdCd(path?: string): Promise<CommandResult> {
    if (!path || path === '/') {
      this.currentDirectory = '';
      return { success: true, output: '' };
    }

    const resolvedPath = this.resolvePath(path);

    if (resolvedPath && !opfsFileSystem.isDirectory(resolvedPath)) {
      // Try to list files to update cache
      await opfsFileSystem.listFiles();

      if (!opfsFileSystem.isDirectory(resolvedPath)) {
        return { success: false, output: '', error: `Not a directory: ${resolvedPath}` };
      }
    }

    this.currentDirectory = resolvedPath;
    return { success: true, output: '' };
  }

  private async cmdTree(path?: string): Promise<CommandResult> {
    const resolvedPath = path ? this.resolvePath(path) : this.currentDirectory;
    const entries = await opfsFileSystem.listFiles();

    const filtered = entries.filter(e => {
      if (!resolvedPath) return true;
      return e.path === resolvedPath || e.path.startsWith(resolvedPath + '/');
    });

    if (filtered.length === 0) {
      return { success: true, output: '\x1b[2m(empty)\x1b[0m' };
    }

    // Build tree structure
    interface TreeNode {
      name: string;
      kind: 'file' | 'directory';
      children: Map<string, TreeNode>;
    }

    const root: TreeNode = { name: '', kind: 'directory', children: new Map() };

    for (const entry of filtered) {
      const relativePath = resolvedPath
        ? entry.path.slice(resolvedPath.length + 1) || entry.name
        : entry.path;
      const parts = relativePath.split('/').filter(p => p.length > 0);

      let current = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]!;
        if (!current.children.has(part)) {
          const isLast = i === parts.length - 1;
          current.children.set(part, {
            name: part,
            kind: isLast ? entry.kind : 'directory',
            children: new Map(),
          });
        }
        current = current.children.get(part)!;
      }
    }

    // Generate tree string
    const lines: string[] = [resolvedPath || '/'];

    const renderTree = (node: TreeNode, prefix: string, isLast: boolean, isRoot: boolean): void => {
      if (!isRoot) {
        const connector = isLast ? '└── ' : '├── ';
        if (node.kind === 'directory') {
          lines.push(`${prefix}${connector}\x1b[1;34m${node.name}/\x1b[0m`);
        } else {
          lines.push(`${prefix}${connector}${node.name}`);
        }
      }

      const children = Array.from(node.children.values()).sort((a, b) => {
        // Directories first, then alphabetical
        if (a.kind !== b.kind) {
          return a.kind === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      children.forEach((child, index) => {
        const isChildLast = index === children.length - 1;
        const newPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ');
        renderTree(child, newPrefix, isChildLast, false);
      });
    };

    renderTree(root, '', true, true);

    return { success: true, output: lines.join('\n') };
  }

  private async cmdHead(path?: string, lines: number = 10): Promise<CommandResult> {
    if (!path) {
      return { success: false, output: '', error: 'Usage: head <path> [lines]' };
    }

    const resolvedPath = this.resolvePath(path);
    const content = await opfsFileSystem.readFile(resolvedPath);
    const allLines = content.split('\n');
    const headLines = allLines.slice(0, lines);

    return { success: true, output: headLines.join('\n') };
  }

  private async cmdTail(path?: string, lines: number = 10): Promise<CommandResult> {
    if (!path) {
      return { success: false, output: '', error: 'Usage: tail <path> [lines]' };
    }

    const resolvedPath = this.resolvePath(path);
    const content = await opfsFileSystem.readFile(resolvedPath);
    const allLines = content.split('\n');
    const tailLines = allLines.slice(-lines);

    return { success: true, output: tailLines.join('\n') };
  }

  private async cmdGrep(pattern?: string, path?: string): Promise<CommandResult> {
    if (!pattern || !path) {
      return { success: false, output: '', error: 'Usage: grep <pattern> <path>' };
    }

    const resolvedPath = this.resolvePath(path);
    const content = await opfsFileSystem.readFile(resolvedPath);
    const regex = new RegExp(pattern, 'gi');
    const lines = content.split('\n');

    const matches = lines
      .map((line, i) => ({ line, num: i + 1 }))
      .filter(({ line }) => regex.test(line))
      .map(({ line, num }) => {
        // Highlight matches
        const highlighted = line.replace(regex, match => `\x1b[1;31m${match}\x1b[0m`);
        return `\x1b[1;33m${num}:\x1b[0m ${highlighted}`;
      });

    if (matches.length === 0) {
      return { success: true, output: '\x1b[2m(no matches)\x1b[0m' };
    }

    return { success: true, output: matches.join('\n') };
  }

  private async cmdWc(path?: string): Promise<CommandResult> {
    if (!path) {
      return { success: false, output: '', error: 'Usage: wc <path>' };
    }

    const resolvedPath = this.resolvePath(path);
    const content = await opfsFileSystem.readFile(resolvedPath);

    const lines = (content.match(/\n/g) || []).length;
    const words = content.split(/\s+/).filter(w => w.length > 0).length;
    const chars = content.length;

    return {
      success: true,
      output: `  ${lines.toString().padStart(6)} ${words.toString().padStart(6)} ${chars.toString().padStart(6)} ${path}`,
    };
  }

  private async cmdDiff(path1?: string, path2?: string): Promise<CommandResult> {
    if (!path1 || !path2) {
      return { success: false, output: '', error: 'Usage: diff <file1> <file2>' };
    }

    const resolvedPath1 = this.resolvePath(path1);
    const resolvedPath2 = this.resolvePath(path2);

    try {
      const content1 = await opfsFileSystem.readFile(resolvedPath1);
      const content2 = await opfsFileSystem.readFile(resolvedPath2);

      const lines1 = content1.split('\n');
      const lines2 = content2.split('\n');

      if (content1 === content2) {
        return { success: true, output: '\x1b[2m(files are identical)\x1b[0m' };
      }

      // Simple line-by-line diff
      const output: string[] = [];
      const maxLines = Math.max(lines1.length, lines2.length);

      for (let i = 0; i < maxLines; i++) {
        const line1 = lines1[i];
        const line2 = lines2[i];

        if (line1 === undefined) {
          output.push(`\x1b[32m+ ${line2}\x1b[0m`);
        } else if (line2 === undefined) {
          output.push(`\x1b[31m- ${line1}\x1b[0m`);
        } else if (line1 !== line2) {
          output.push(`\x1b[31m- ${line1}\x1b[0m`);
          output.push(`\x1b[32m+ ${line2}\x1b[0m`);
        }
      }

      return { success: true, output: output.join('\n') };
    } catch {
      return { success: false, output: '', error: 'Failed to read one or both files' };
    }
  }

  private async cmdSort(path?: string): Promise<CommandResult> {
    if (!path) {
      return { success: false, output: '', error: 'Usage: sort <path>' };
    }

    const resolvedPath = this.resolvePath(path);
    const content = await opfsFileSystem.readFile(resolvedPath);

    const lines = content.split('\n');
    const sorted = lines.sort((a, b) => a.localeCompare(b));

    return { success: true, output: sorted.join('\n') };
  }

  private async cmdUniq(path?: string): Promise<CommandResult> {
    if (!path) {
      return { success: false, output: '', error: 'Usage: uniq <path>' };
    }

    const resolvedPath = this.resolvePath(path);
    const content = await opfsFileSystem.readFile(resolvedPath);

    const lines = content.split('\n');
    const unique = lines.filter((line, index, arr) => index === 0 || line !== arr[index - 1]);

    return { success: true, output: unique.join('\n') };
  }

  private async cmdWrite(path?: string, content?: string): Promise<CommandResult> {
    if (!path) {
      return { success: false, output: '', error: 'Usage: write <path> <content>' };
    }

    const resolvedPath = this.resolvePath(path);

    if (opfsFileSystem.exists(resolvedPath)) {
      await opfsFileSystem.writeFile(resolvedPath, content || '');
    } else {
      await opfsFileSystem.createFile(resolvedPath, content || '');
    }

    return { success: true, output: `Written to: ${resolvedPath}` };
  }

  private async cmdImport(): Promise<CommandResult> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;

      input.onchange = async () => {
        if (input.files && input.files.length > 0) {
          const entries = await opfsFileSystem.importFiles(input.files, this.currentDirectory);
          resolve({
            success: true,
            output: `Imported ${entries.length} file(s):\n${entries.map(e => `  ${e.path}`).join('\n')}`,
          });
        } else {
          resolve({ success: false, output: '', error: 'No files selected' });
        }
      };

      input.oncancel = () => {
        resolve({ success: false, output: '', error: 'Import cancelled' });
      };

      input.click();
    });
  }

  private async cmdExport(path?: string): Promise<CommandResult> {
    if (!path) {
      return { success: false, output: '', error: 'Usage: export <path>' };
    }

    const resolvedPath = this.resolvePath(path);
    const content = await opfsFileSystem.readFile(resolvedPath);
    const blob = new Blob([content], { type: 'text/plain' });

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = path.split('/').pop() || 'file.txt';
    a.click();

    URL.revokeObjectURL(a.href);

    return { success: true, output: `Exported: ${resolvedPath}` };
  }

  private async cmdStorage(): Promise<CommandResult> {
    const info = await opfsFileSystem.getStorageInfo();

    if (!info) {
      return { success: false, output: '', error: 'Storage info not available' };
    }

    const usedMB = (info.used / 1024 / 1024).toFixed(2);
    const quotaMB = (info.quota / 1024 / 1024).toFixed(2);
    const percent = ((info.used / info.quota) * 100).toFixed(1);

    return {
      success: true,
      output: `Storage: ${usedMB} MB / ${quotaMB} MB (${percent}%)`,
    };
  }

  private async cmdReset(): Promise<CommandResult> {
    await opfsFileSystem.clearAll();
    this.currentDirectory = '';
    return { success: true, output: '\x1b[1;33mOPFS cleared. All files removed.\x1b[0m' };
  }

  private cmdDebug(): CommandResult {
    this.debugMode = !this.debugMode;
    const status = this.debugMode ? 'enabled' : 'disabled';
    const color = this.debugMode ? '\x1b[1;32m' : '\x1b[1;31m';
    return {
      success: true,
      output: `${color}Debug mode ${status}\x1b[0m`,
    };
  }

  /**
   * Check if debug mode is enabled
   */
  isDebugMode(): boolean {
    return this.debugMode;
  }

  /**
   * Log debug output for tool calls
   */
  logToolCall(toolName: string, input: unknown, output: unknown): void {
    if (!this.debugMode) return;

    this.terminal.writeln('');
    this.terminal.writeln('\x1b[1;35m┌─ Tool Call ─────────────────────────────\x1b[0m');
    this.terminal.writeln(`\x1b[1;35m│\x1b[0m \x1b[1;36mTool:\x1b[0m ${toolName}`);
    this.terminal.writeln('\x1b[1;35m│\x1b[0m \x1b[1;36mInput:\x1b[0m');

    const inputStr = JSON.stringify(input, null, 2);
    for (const line of inputStr.split('\n')) {
      this.terminal.writeln(`\x1b[1;35m│\x1b[0m   ${line}`);
    }

    this.terminal.writeln('\x1b[1;35m│\x1b[0m \x1b[1;36mOutput:\x1b[0m');
    const outputStr = JSON.stringify(output, null, 2);
    for (const line of outputStr.split('\n')) {
      this.terminal.writeln(`\x1b[1;35m│\x1b[0m   ${line}`);
    }

    this.terminal.writeln('\x1b[1;35m└──────────────────────────────────────────\x1b[0m');
    this.terminal.writeln('');
  }

  /**
   * Write text to terminal (for external use)
   */
  write(text: string): void {
    this.terminal.write(text);
  }

  /**
   * Write line to terminal (for external use)
   */
  writeln(text: string): void {
    this.terminal.writeln(text);
  }

  /**
   * Focus the terminal
   */
  focus(): void {
    this.terminal.focus();
  }

  /**
   * Dispose of the terminal
   */
  dispose(): void {
    this.terminal.dispose();
  }
}

// Export singleton
export const terminalManager = new TerminalManager();
