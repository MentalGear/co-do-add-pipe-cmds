/**
 * Main entry point for the Co-do application
 */

import './styles.css';
import { UIManager } from './ui';
import { preferencesManager } from './preferences';
import { terminalManager } from './terminal';
import { opfsFileSystem } from './opfsFileSystem';

// Version checking constants
const VERSION_STORAGE_KEY = 'co-do-app-version';
const VERSION_CHECK_INTERVAL = 60000; // 60 seconds

interface VersionInfo {
  version: string;
  buildTime: string;
  commitHash: string | null;
  commitShortHash: string | null;
  repositoryUrl: string | null;
}

/**
 * Fetches the current version from the server
 * Uses cache-busting to ensure we always get the latest version
 */
async function fetchVersion(): Promise<VersionInfo | null> {
  try {
    const response = await fetch(
      `${import.meta.env.BASE_URL}version.json?t=${Date.now()}`,
      {
        cache: 'no-store',
      }
    );
    if (!response.ok) {
      console.warn('Failed to fetch version.json:', response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn('Error fetching version:', error);
    return null;
  }
}

/**
 * Shows the update notification to the user
 * @param versionInfo - The new version information from the server
 */
function showUpdateNotification(versionInfo: VersionInfo): void {
  const notification = document.getElementById('update-notification');
  const reloadBtn = document.getElementById('update-reload-btn');
  const dismissBtn = document.getElementById('update-dismiss-btn');
  const changelogLink = document.getElementById(
    'update-changelog-link'
  ) as HTMLAnchorElement | null;

  if (notification && reloadBtn && dismissBtn) {
    // Update changelog link if repository and commit info is available
    if (changelogLink && versionInfo.repositoryUrl && versionInfo.commitHash) {
      changelogLink.href = `${versionInfo.repositoryUrl}/commit/${versionInfo.commitHash}`;
      changelogLink.title = `View commit ${versionInfo.commitShortHash || versionInfo.commitHash.substring(0, 7)}`;
      changelogLink.hidden = false;
    } else if (changelogLink && versionInfo.repositoryUrl) {
      // Fall back to changelog file
      changelogLink.href = `${versionInfo.repositoryUrl}/blob/main/CHANGELOG.md`;
      changelogLink.title = 'View changelog';
      changelogLink.hidden = false;
    }

    notification.hidden = false;
    // Trigger animation after a brief delay
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        notification.classList.add('show');
      });
    });

    // Handle reload button click
    const handleReload = () => {
      // Clear stored version so after reload we pick up the new version
      localStorage.removeItem(VERSION_STORAGE_KEY);
      window.location.reload();
    };

    // Handle dismiss button click
    const handleDismiss = () => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.hidden = true;
      }, 300);
    };

    // Remove existing listeners to prevent duplicates
    reloadBtn.replaceWith(reloadBtn.cloneNode(true));
    dismissBtn.replaceWith(dismissBtn.cloneNode(true));

    // Re-query and add listeners
    document.getElementById('update-reload-btn')?.addEventListener('click', handleReload);
    document.getElementById('update-dismiss-btn')?.addEventListener('click', handleDismiss);
  }
}

/**
 * Checks for application updates by comparing version.json
 */
async function checkForUpdates(): Promise<void> {
  console.log('Checking for application updates...');

  const serverVersion = await fetchVersion();
  if (!serverVersion) {
    return; // Couldn't fetch version, try again later
  }

  // Skip update checks in development mode
  if (serverVersion.version === 'development') {
    console.log('Development mode - skipping version check');
    return;
  }

  const storedVersion = localStorage.getItem(VERSION_STORAGE_KEY);

  if (!storedVersion) {
    // First visit or cleared storage - store current version
    localStorage.setItem(VERSION_STORAGE_KEY, serverVersion.version);
    console.log('Stored initial version:', serverVersion.version);
    return;
  }

  if (storedVersion !== serverVersion.version) {
    console.log(`New version available! Current: ${storedVersion}, New: ${serverVersion.version}`);
    showUpdateNotification(serverVersion);
  }
}

// Initialize the application
async function init() {
  console.log('Co-do - AI File System Manager (OPFS Mode)');
  console.log('Initializing application...');

  // Check for OPFS support
  if (!('storage' in navigator) || !('getDirectory' in navigator.storage)) {
    alert(
      'Your browser does not support the Origin Private File System.\n\n' +
        'Please use Chrome 86+, Edge 86+, or another Chromium-based browser.\n\n' +
        'For the best experience, use the latest version of Chrome.'
    );
    return;
  }

  // Initialize preferences manager (includes storage migration)
  try {
    await preferencesManager.init();
    console.log('Preferences manager initialized');
  } catch (error) {
    console.error('Failed to initialize preferences manager:', error);
  }

  // Initialize OPFS
  try {
    await opfsFileSystem.init();
    console.log('OPFS initialized');

    // Update storage info display
    updateStorageInfo();
  } catch (error) {
    console.error('Failed to initialize OPFS:', error);
    alert('Failed to initialize the file system. Please refresh the page.');
    return;
  }

  // Initialize terminal
  const terminalContainer = document.getElementById('terminal-container');
  if (terminalContainer) {
    try {
      await terminalManager.mount(terminalContainer);
      console.log('Terminal initialized');
    } catch (error) {
      console.error('Failed to initialize terminal:', error);
    }
  }

  // Initialize UI
  new UIManager();

  // Set up import buttons
  setupImportButtons();

  // Register Service Worker for PWA support (caching only)
  if ('serviceWorker' in navigator) {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;

    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        console.log('Service Worker registered successfully:', registration.scope);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  }

  // Set up version-based update checking
  // Check for updates periodically
  setInterval(checkForUpdates, VERSION_CHECK_INTERVAL);

  // Check when page becomes visible (user returns to tab)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForUpdates();
    }
  });

  // Check immediately on load
  checkForUpdates();

  console.log('Application initialized successfully');
}

/**
 * Update storage info display
 */
async function updateStorageInfo(): Promise<void> {
  const storageInfoEl = document.getElementById('storage-info');
  if (!storageInfoEl) return;

  const info = await opfsFileSystem.getStorageInfo();
  if (info) {
    const usedMB = (info.used / 1024 / 1024).toFixed(1);
    const quotaMB = (info.quota / 1024 / 1024).toFixed(0);
    storageInfoEl.textContent = `Storage: ${usedMB} MB / ${quotaMB} MB`;
  }
}

/**
 * Set up import buttons
 */
function setupImportButtons(): void {
  const importFilesBtn = document.getElementById('import-files-btn');
  const importFolderBtn = document.getElementById('import-folder-btn');

  // Import files button
  if (importFilesBtn) {
    importFilesBtn.addEventListener('click', async () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;

      input.onchange = async () => {
        if (input.files && input.files.length > 0) {
          try {
            const entries = await opfsFileSystem.importFiles(input.files);
            console.log(`Imported ${entries.length} file(s)`);
            terminalManager.writeln(`\n\x1b[1;32mImported ${entries.length} file(s)\x1b[0m`);
            for (const entry of entries) {
              terminalManager.writeln(`  ${entry.path}`);
            }
            terminalManager.writeln('');
            updateStorageInfo();
          } catch (error) {
            console.error('Import failed:', error);
            terminalManager.writeln(`\n\x1b[1;31mImport failed: ${(error as Error).message}\x1b[0m\n`);
          }
        }
      };

      input.click();
    });
  }

  // Import folder button
  if (importFolderBtn) {
    importFolderBtn.addEventListener('click', async () => {
      try {
        // Use showDirectoryPicker for folder import
        if (!('showDirectoryPicker' in window)) {
          terminalManager.writeln('\n\x1b[1;31mFolder import not supported in this browser\x1b[0m\n');
          return;
        }

        const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
        const entries = await opfsFileSystem.importDirectory(dirHandle);

        console.log(`Imported ${entries.length} item(s) from folder`);
        terminalManager.writeln(`\n\x1b[1;32mImported ${entries.length} item(s) from "${dirHandle.name}"\x1b[0m`);
        updateStorageInfo();
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Folder import failed:', error);
          terminalManager.writeln(`\n\x1b[1;31mFolder import failed: ${(error as Error).message}\x1b[0m\n`);
        }
      }
    });
  }
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
