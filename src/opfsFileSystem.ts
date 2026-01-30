/**
 * Origin Private File System (OPFS) Manager
 * Provides a sandboxed filesystem for LLM code manipulation
 *
 * OPFS is a private, origin-scoped filesystem that:
 * - Requires no user permission prompts
 * - Is immediately available on page load
 * - Persists data in the browser
 * - Is isolated from the user's real filesystem
 */

// Types are defined locally to avoid dependency on native filesystem types

/**
 * OPFS-specific entry types (without native handles for serialization)
 */
export interface OPFSFileEntry {
  name: string;
  path: string;
  kind: 'file';
}

export interface OPFSDirectoryEntry {
  name: string;
  path: string;
  kind: 'directory';
}

export type OPFSEntry = OPFSFileEntry | OPFSDirectoryEntry;

export class OPFSFileSystem {
  private rootHandle: FileSystemDirectoryHandle | null = null;
  private fileCache: Map<string, OPFSEntry> = new Map();
  private initialized: boolean = false;

  /**
   * Check if OPFS is supported
   */
  isSupported(): boolean {
    return 'storage' in navigator && 'getDirectory' in navigator.storage;
  }

  /**
   * Initialize OPFS - get the root directory handle
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    if (!this.isSupported()) {
      throw new Error('Origin Private File System is not supported in this browser');
    }

    this.rootHandle = await navigator.storage.getDirectory();
    this.initialized = true;
  }

  /**
   * Ensure OPFS is initialized before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }

  /**
   * Get the root directory handle
   */
  getRootHandle(): FileSystemDirectoryHandle | null {
    return this.rootHandle;
  }

  /**
   * Get the root path (always "/" for OPFS)
   */
  getRootPath(): string {
    return '/';
  }

  /**
   * Check if a directory has been selected (always true for OPFS after init)
   */
  hasDirectory(): boolean {
    return this.initialized && this.rootHandle !== null;
  }

  /**
   * List all files and directories (recursive)
   */
  async listFiles(
    directoryHandle?: FileSystemDirectoryHandle,
    basePath: string = ''
  ): Promise<OPFSEntry[]> {
    await this.ensureInitialized();

    const handle = directoryHandle || this.rootHandle!;
    const entries: OPFSEntry[] = [];

    for await (const [name, childHandle] of handle.entries()) {
      const path = basePath ? `${basePath}/${name}` : name;

      if (childHandle.kind === 'file') {
        const entry: OPFSFileEntry = {
          name,
          path,
          kind: 'file',
        };
        entries.push(entry);
        this.fileCache.set(path, entry);
      } else if (childHandle.kind === 'directory') {
        const entry: OPFSDirectoryEntry = {
          name,
          path,
          kind: 'directory',
        };
        entries.push(entry);
        this.fileCache.set(path, entry);

        // Recursively list subdirectory contents
        const subEntries = await this.listFiles(
          childHandle as FileSystemDirectoryHandle,
          path
        );
        entries.push(...subEntries);
      }
    }

    return entries;
  }

  /**
   * Get a file handle by path
   */
  private async getFileHandleByPath(path: string): Promise<FileSystemFileHandle> {
    await this.ensureInitialized();

    const pathParts = path.split('/').filter(p => p.length > 0);
    const fileName = pathParts.pop();

    if (!fileName) {
      throw new Error(`Invalid file path: ${path}`);
    }

    let dirHandle = this.rootHandle!;

    // Navigate to the directory
    for (const part of pathParts) {
      dirHandle = await dirHandle.getDirectoryHandle(part);
    }

    return await dirHandle.getFileHandle(fileName);
  }

  /**
   * Read file contents
   */
  async readFile(path: string): Promise<string> {
    const fileHandle = await this.getFileHandleByPath(path);
    const file = await fileHandle.getFile();
    return await file.text();
  }

  /**
   * Write content to a file
   */
  async writeFile(path: string, content: string): Promise<void> {
    const fileHandle = await this.getFileHandleByPath(path);
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  /**
   * Create a new file (and parent directories if needed)
   */
  async createFile(path: string, content: string = ''): Promise<OPFSFileEntry> {
    await this.ensureInitialized();

    const pathParts = path.split('/').filter(p => p.length > 0);
    const fileName = pathParts.pop();

    if (!fileName) {
      throw new Error(`Invalid file path: ${path}`);
    }

    let dirHandle = this.rootHandle!;
    let currentPath = '';

    // Navigate to the directory (create if needed)
    for (const part of pathParts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      dirHandle = await dirHandle.getDirectoryHandle(part, { create: true });

      // Cache the directory
      if (!this.fileCache.has(currentPath)) {
        this.fileCache.set(currentPath, {
          name: part,
          path: currentPath,
          kind: 'directory',
        });
      }
    }

    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });

    // Write initial content
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();

    const entry: OPFSFileEntry = {
      name: fileName,
      path,
      kind: 'file',
    };

    this.fileCache.set(path, entry);
    return entry;
  }

  /**
   * Delete a file
   */
  async deleteFile(path: string): Promise<void> {
    await this.ensureInitialized();

    const pathParts = path.split('/').filter(p => p.length > 0);
    const fileName = pathParts.pop();

    if (!fileName) {
      throw new Error(`Invalid file path: ${path}`);
    }

    let dirHandle = this.rootHandle!;

    // Navigate to the directory
    for (const part of pathParts) {
      dirHandle = await dirHandle.getDirectoryHandle(part);
    }

    await dirHandle.removeEntry(fileName);
    this.fileCache.delete(path);
  }

  /**
   * Delete a directory (and all contents)
   */
  async deleteDirectory(path: string): Promise<void> {
    await this.ensureInitialized();

    const pathParts = path.split('/').filter(p => p.length > 0);
    const dirName = pathParts.pop();

    if (!dirName) {
      throw new Error(`Invalid directory path: ${path}`);
    }

    let parentHandle = this.rootHandle!;

    // Navigate to the parent directory
    for (const part of pathParts) {
      parentHandle = await parentHandle.getDirectoryHandle(part);
    }

    await parentHandle.removeEntry(dirName, { recursive: true });

    // Remove from cache (and all children)
    for (const cachedPath of this.fileCache.keys()) {
      if (cachedPath === path || cachedPath.startsWith(path + '/')) {
        this.fileCache.delete(cachedPath);
      }
    }
  }

  /**
   * Rename/move a file
   */
  async renameFile(oldPath: string, newPath: string): Promise<void> {
    const content = await this.readFile(oldPath);
    await this.createFile(newPath, content);

    try {
      await this.deleteFile(oldPath);
    } catch (deleteError) {
      // Cleanup the new file if deletion fails
      try {
        await this.deleteFile(newPath);
      } catch {
        // Ignore cleanup errors
      }
      throw new Error(
        `Failed to complete rename: could not delete original file "${oldPath}". ` +
          `Error: ${(deleteError as Error).message}`
      );
    }
  }

  /**
   * Create a directory (and parent directories if needed)
   */
  async createDirectory(path: string): Promise<OPFSDirectoryEntry> {
    await this.ensureInitialized();

    const trimmedPath = path.trim();
    if (!trimmedPath) {
      throw new Error('Invalid directory path: path cannot be empty');
    }

    const pathParts = trimmedPath.split('/').filter(p => p.length > 0);
    if (pathParts.length === 0) {
      throw new Error('Invalid directory path: path contains only slashes');
    }

    let dirHandle = this.rootHandle!;
    let currentPath = '';

    for (const part of pathParts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      dirHandle = await dirHandle.getDirectoryHandle(part, { create: true });

      // Cache the directory
      if (!this.fileCache.has(currentPath)) {
        this.fileCache.set(currentPath, {
          name: part,
          path: currentPath,
          kind: 'directory',
        });
      }
    }

    return this.fileCache.get(trimmedPath) as OPFSDirectoryEntry;
  }

  /**
   * Copy a file
   */
  async copyFile(sourcePath: string, destinationPath: string): Promise<OPFSFileEntry> {
    const content = await this.readFile(sourcePath);
    return await this.createFile(destinationPath, content);
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(path: string): Promise<{
    name: string;
    size: number;
    lastModified: number;
    type: string;
  }> {
    const fileHandle = await this.getFileHandleByPath(path);
    const file = await fileHandle.getFile();

    return {
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      type: file.type,
    };
  }

  /**
   * Check if a path exists
   */
  exists(path: string): boolean {
    return this.fileCache.has(path);
  }

  /**
   * Check if a path is a directory
   */
  isDirectory(path: string): boolean {
    const entry = this.fileCache.get(path);
    return entry?.kind === 'directory';
  }

  /**
   * Check if a path is a file
   */
  isFile(path: string): boolean {
    const entry = this.fileCache.get(path);
    return entry?.kind === 'file';
  }

  /**
   * Get all cached entries
   */
  getAllEntries(): OPFSEntry[] {
    return Array.from(this.fileCache.values());
  }

  /**
   * Import a file from the user's filesystem into OPFS
   */
  async importFile(file: File, destinationPath?: string): Promise<OPFSFileEntry> {
    const path = destinationPath || file.name;
    const content = await file.text();
    return await this.createFile(path, content);
  }

  /**
   * Import multiple files from the user's filesystem into OPFS
   */
  async importFiles(files: FileList | File[], basePath: string = ''): Promise<OPFSFileEntry[]> {
    const entries: OPFSFileEntry[] = [];

    for (const file of files) {
      const path = basePath ? `${basePath}/${file.name}` : file.name;
      const entry = await this.importFile(file, path);
      entries.push(entry);
    }

    return entries;
  }

  /**
   * Import a directory from the user's filesystem into OPFS
   */
  async importDirectory(dirHandle: FileSystemDirectoryHandle, basePath: string = ''): Promise<OPFSEntry[]> {
    const entries: OPFSEntry[] = [];
    const currentPath = basePath ? `${basePath}/${dirHandle.name}` : dirHandle.name;

    // Create the directory in OPFS
    const dirEntry = await this.createDirectory(currentPath);
    entries.push(dirEntry);

    // Recursively import contents
    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind === 'file') {
        const fileHandle = handle as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        const content = await file.text();
        const filePath = `${currentPath}/${name}`;
        const entry = await this.createFile(filePath, content);
        entries.push(entry);
      } else if (handle.kind === 'directory') {
        const subEntries = await this.importDirectory(
          handle as FileSystemDirectoryHandle,
          currentPath
        );
        entries.push(...subEntries);
      }
    }

    return entries;
  }

  /**
   * Export a file from OPFS to a downloadable blob
   */
  async exportFile(path: string): Promise<Blob> {
    const content = await this.readFile(path);
    return new Blob([content], { type: 'text/plain' });
  }

  /**
   * Export all files as a downloadable zip (requires external library)
   * Returns a map of path -> content for manual handling
   */
  async exportAll(): Promise<Map<string, string>> {
    await this.listFiles(); // Ensure cache is populated

    const exports = new Map<string, string>();

    for (const entry of this.fileCache.values()) {
      if (entry.kind === 'file') {
        const content = await this.readFile(entry.path);
        exports.set(entry.path, content);
      }
    }

    return exports;
  }

  /**
   * Clear all files in OPFS (reset sandbox)
   */
  async clearAll(): Promise<void> {
    await this.ensureInitialized();

    // Get all top-level entries and delete them
    for await (const [name] of this.rootHandle!.entries()) {
      await this.rootHandle!.removeEntry(name, { recursive: true });
    }

    this.fileCache.clear();
  }

  /**
   * Get storage usage info
   */
  async getStorageInfo(): Promise<{ used: number; quota: number } | null> {
    if ('estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        quota: estimate.quota || 0,
      };
    }
    return null;
  }
}

// Export a singleton instance
export const opfsFileSystem = new OPFSFileSystem();
