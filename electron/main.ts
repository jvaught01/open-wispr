import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  clipboard,
} from 'electron';
import { exec } from 'child_process';
import path from 'path';
import Store from 'electron-store';

// Disable GPU acceleration to prevent crashes
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-gpu-sandbox');

const store = new Store();

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isRecording = false;

const DIST = path.join(__dirname, '../dist');
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

function getAssetPath(...paths: string[]): string {
  // In production, assets are in resources/assets
  // In development, assets are in ../assets relative to dist-electron
  const isProd = app.isPackaged;
  if (isProd) {
    return path.join(process.resourcesPath, 'assets', ...paths);
  }
  return path.join(__dirname, '../assets', ...paths);
}

function createWindow() {
  // Load app icon from assets folder - use .ico on Windows for proper taskbar icon
  const iconPath = process.platform === 'win32'
    ? getAssetPath('windows', 'icon.ico')
    : getAssetPath('icon.png');

  let appIcon: Electron.NativeImage;

  try {
    console.log('Loading app icon from:', iconPath);
    appIcon = nativeImage.createFromPath(iconPath);
    if (appIcon.isEmpty()) {
      // Try 256x256 PNG as fallback
      const fallbackPath = getAssetPath('windows', '256x256.png');
      console.log('Icon empty, trying fallback:', fallbackPath);
      appIcon = nativeImage.createFromPath(fallbackPath);

      if (appIcon.isEmpty()) {
        throw new Error('Icon is empty');
      }
    }
    console.log('App icon loaded successfully');
  } catch (err) {
    console.error('Failed to load app icon:', err);
    // Fallback to embedded icon
    appIcon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAABz0lEQVR4nO2WP0/CQBjGf1cSBhcTEwcHFwc/gJuDk5OjLo4OfgAHJ0dHBwcnBwcXFyeJiYuJiYmJiYmJBgfBhIQESwp3vXJte6UV+CdP0pB77+593vZ6F/jvKACjwDTgBZIAG7gBPoDd6Av8HT4OnAAHwAtwBpQDbYFWQC+gL3AEvAJuZx8gEnkEtgAn8QMIrSUPCXCAFsARUGDa4hCYBIrRAA7SLGQF3gG3sSNTCBVSsAPPgNusgLXAEbAvBRZTYBB4ABZCAeyDDmIvUAxMAQumA3OJ1QKLgBNwABMfA/4BIJsGlRZIZigKHMP/+wJDHgE1wCYwL+EsA65MC4Kqfx74lQrSLfRDk6wbJAUSvv8bKl5vqh/qCviHl4EC0z1AAQwFtgFHwHKKRUfBEnCgxwHHpgN/AQWmPRALtHkKZCGPAGPhCiJxigNeCB1F7wGHfAJqgQrCXcJ0tGACuAJ8wBIZ1a8TKAJawbQPqAPKgY3AG5CWIjWACqAqHmAbmJMCUiB7AJhVAyQFToB7II8GTAE3wJTM3ZLENdAIPGYIUAcUAjlqgOUUtMGKJO4ECoCS+CfRLZJ0ACvADHCTRoB/S+sHoP6lSZBYD9YAAAAASUVORK5CYII='
    );
  }

  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    frame: true,
    transparent: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    resizable: true,
    backgroundColor: '#000000',
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Center the window
  mainWindow.center();

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(DIST, 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createOverlayWindow() {
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const overlayWidth = 280;
  const overlayHeight = 96;

  overlayWindow = new BrowserWindow({
    width: overlayWidth,
    height: overlayHeight,
    x: Math.round((width - overlayWidth) / 2),
    y: height - overlayHeight, // Position at bottom of screen
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Keep it always on top at the highest level
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');

  // Allow mouse events but don't take focus
  overlayWindow.setIgnoreMouseEvents(false);

  if (VITE_DEV_SERVER_URL) {
    overlayWindow.loadURL(`${VITE_DEV_SERVER_URL}#overlay`);
  } else {
    overlayWindow.loadFile(path.join(DIST, 'index.html'), { hash: 'overlay' });
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

function createTray() {
  let trayIcon: Electron.NativeImage;

  if (process.platform === 'darwin') {
    // macOS: Load the app icon and resize for menu bar
    // NOT using template mode since our icon is colorful/white
    try {
      trayIcon = nativeImage.createFromPath(getAssetPath('icon.png'));

      if (trayIcon.isEmpty()) {
        throw new Error('Icon file not found');
      }

      // Resize to 18x18 for macOS menu bar
      trayIcon = trayIcon.resize({ width: 18, height: 18 });

      // Don't set as template - our icon is already designed for visibility
      console.log('macOS tray icon ready, size:', trayIcon.getSize());
    } catch (err) {
      console.error('Failed to load macOS tray icon:', err);
      // Fallback to embedded icon
      trayIcon = nativeImage.createFromDataURL(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAABDklEQVR4nGNgGAWjAAYYmJiYGP7//8/AwMDAICUlxfD//38GBgYGBkZGRob///8ziIuLM/z584fh379/DH///mVgYGBgYGZmZpCQkGD4/fs3w58/fxj+/v3LwMDAwMDCwsIgJibG8OvXL4bfv38z/Pnzh4GBgYGBhYWFQVRUlOHnz58Mv379Yvjz5w8DAwMDA8u/f/8YRERE/v/48YPh58+fDL9//2b4//8/AwMDAwPL379/GYSFRT78+PGD4efPnwy/fv1i+PfvHwMDAwMDy+/fvxmEhIQ+fP/+neHHjx8MP3/+ZPj9+zcDAwMDA8uvX78YBAUFPzAwMDB8//6d4cePHww/f/5k+P37NwMDAwMD4ygAAOuhQYJwNjcnAAAAAElFTkSuQmCC'
      );
    }
  } else {
    // Windows/Linux: Use regular colored icon
    const trayIconPath = process.platform === 'win32'
      ? getAssetPath('windows', '16x16.png')
      : getAssetPath('icon.png');

    try {
      console.log('Loading tray icon from:', trayIconPath);
      trayIcon = nativeImage.createFromPath(trayIconPath);

      if (trayIcon.isEmpty()) {
        const fallbackPath = getAssetPath('icon.png');
        console.log('Tray icon empty, trying fallback:', fallbackPath);
        trayIcon = nativeImage.createFromPath(fallbackPath);

        if (trayIcon.isEmpty()) {
          throw new Error('Both icon paths failed');
        }

        if (process.platform === 'win32') {
          trayIcon = trayIcon.resize({ width: 16, height: 16 });
        }
      }

      console.log('Tray icon loaded, size:', trayIcon.getSize());
    } catch (err) {
      console.error('Failed to load tray icon:', err);
      // Fallback to embedded white microphone icon
      trayIcon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAABDklEQVR4nGNgGAWjAAYYmJiYGP7//8/AwMDAICUlxfD//38GBgYGBkZGRob///8ziIuLM/z584fh379/DH///mVgYGBgYGZmZpCQkGD4/fs3w58/fxj+/v3LwMDAwMDCwsIgJibG8OvXL4bfv38z/Pnzh4GBgYGBhYWFQVRUlOHnz58Mv379Yvjz5w8DAwMDA8u/f/8YRERE/v/48YPh58+fDL9//2b4//8/AwMDAwPL379/GYSFRT78+PGD4efPnwy/fv1i+PfvHwMDAwMDy+/fvxmEhIQ+fP/+neHHjx8MP3/+ZPj9+zcDAwMDA8uvX78YBAUFPzAwMDB8//6d4cePHww/f/5k+P37NwMDAwMD4ygAAOuhQYJwNjcnAAAAAElFTkSuQmCC');
    }
  }

  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show/Hide',
      click: () => {
        if (mainWindow?.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow?.show();
        }
      },
    },
    {
      label: 'Settings',
      click: () => {
        mainWindow?.webContents.send('open-settings');
        mainWindow?.show();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Open Wispr - Voice Coding');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
    }
  });
}

function registerHotkeys() {
  let hotkey = (store.get('hotkey') as string) || 'CommandOrControl+Shift+Space';

  // Sanitize hotkey for current platform
  if (process.platform === 'darwin') {
    // On macOS, convert Super to Command (Super is Windows key, not valid on Mac)
    hotkey = hotkey.replace(/Super/g, 'Command');
  }

  console.log('Registering hotkey:', hotkey);

  globalShortcut.unregisterAll();

  // Try to register the hotkey
  const success = globalShortcut.register(hotkey, () => {
    console.log('Hotkey triggered!');
    if (!isRecording) {
      isRecording = true;
      overlayWindow?.webContents.send('recording-start');
      updateTrayIcon(true);

      // Poll for key release
      // Parse which modifiers are in the hotkey
      const hotkeyLower = hotkey.toLowerCase();
      const hasCtrl = hotkeyLower.includes('control') || hotkeyLower.includes('commandorcontrol');
      const hasShift = hotkeyLower.includes('shift');
      const hasAlt = hotkeyLower.includes('alt') || hotkeyLower.includes('option');
      const hasWin = hotkeyLower.includes('super') || hotkeyLower.includes('meta');
      const hasCmd = hotkeyLower.includes('command') || hotkeyLower.includes('commandorcontrol');

      if (process.platform === 'win32') {
        const checkKeys = () => {
          if (!isRecording) return;

          // Check all relevant modifier keys
          const psCommand = `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Control]::ModifierKeys"`;
          exec(psCommand, (error, stdout) => {
            if (error) {
              setTimeout(checkKeys, 100);
              return;
            }

            const modifiers = stdout.trim();

            // Check if the required modifiers are still held
            let stillHeld = false;
            if (hasCtrl && modifiers.includes('Control')) stillHeld = true;
            if (hasShift && modifiers.includes('Shift')) stillHeld = true;
            if (hasAlt && modifiers.includes('Alt')) stillHeld = true;
            // Windows key is harder to detect via ModifierKeys, use a simpler approach
            if (hasWin) stillHeld = true; // For Win key combos, use timeout instead

            if (!stillHeld || (hasWin && !hasCtrl && !hasShift && !hasAlt)) {
              // For Win key only combos, use a fixed timeout
              if (hasWin && !hasCtrl && !hasShift && !hasAlt) {
                setTimeout(() => {
                  if (isRecording) {
                    isRecording = false;
                    overlayWindow?.webContents.send('recording-stop');
                    updateTrayIcon(false);
                  }
                }, 500);
                return;
              }

              if (isRecording) {
                isRecording = false;
                overlayWindow?.webContents.send('recording-stop');
                updateTrayIcon(false);
              }
            } else {
              setTimeout(checkKeys, 100);
            }
          });
        };

        setTimeout(checkKeys, 300);
      } else if (process.platform === 'darwin') {
        // macOS: Use JXA (JavaScript for Automation) to query NSEvent.modifierFlags
        const checkKeysMac = () => {
          if (!isRecording) return;

          // Use osascript with JXA to get current modifier key state
          const script = `osascript -l JavaScript -e '
            ObjC.import("Cocoa");
            var flags = $.NSEvent.modifierFlags;
            var shift = (flags & $.NSEventModifierFlagShift) !== 0;
            var control = (flags & $.NSEventModifierFlagControl) !== 0;
            var command = (flags & $.NSEventModifierFlagCommand) !== 0;
            var option = (flags & $.NSEventModifierFlagOption) !== 0;
            JSON.stringify({shift: shift, control: control, command: command, option: option});
          '`;

          exec(script, (error, stdout) => {
            if (error) {
              setTimeout(checkKeysMac, 100);
              return;
            }

            try {
              const modifiers = JSON.parse(stdout.trim());

              // Check if the required modifiers are still held
              let stillHeld = false;
              if (hasCmd && modifiers.command) stillHeld = true;
              if (hasCtrl && modifiers.control) stillHeld = true;
              if (hasShift && modifiers.shift) stillHeld = true;
              if (hasAlt && modifiers.option) stillHeld = true;

              if (!stillHeld) {
                if (isRecording) {
                  isRecording = false;
                  overlayWindow?.webContents.send('recording-stop');
                  updateTrayIcon(false);
                }
              } else {
                setTimeout(checkKeysMac, 100);
              }
            } catch {
              setTimeout(checkKeysMac, 100);
            }
          });
        };

        setTimeout(checkKeysMac, 300);
      }
    }
  });

  if (success) {
    console.log('Hotkey registered successfully:', hotkey);
  } else {
    console.error('Failed to register hotkey:', hotkey);
    // Try with a fallback hotkey
    const fallback = 'CommandOrControl+Shift+Space';
    if (hotkey !== fallback) {
      console.log('Trying fallback hotkey:', fallback);
      globalShortcut.register(fallback, () => {
        if (!isRecording) {
          isRecording = true;
          overlayWindow?.webContents.send('recording-start');
          updateTrayIcon(true);
        }
      });
    }
  }
}

function updateTrayIcon(recording: boolean) {
  if (!tray) {
    console.warn('updateTrayIcon called but tray is null');
    return;
  }
  console.log('updateTrayIcon:', recording ? 'recording' : 'idle');

  if (process.platform === 'darwin') {
    // macOS: Use template image (black on transparent)
    // Same icon for both states - recording state shown in overlay
    const blackMicrophoneIcon =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAA' +
      'AQCAYAAAAf8/9hAAAABGdBTUEAALGPC/xhBQAAAAlwSFlzAAAO' +
      'wwAADsMBx2+oZAAAABl0RVh0U29mdHdhcmUAcGFpbnQubmV0ID' +
      'QuMC4xMkMEa+wAAADISURBVDhPrZLBDYMwDEV/OkQ3YAPYoBu0' +
      'G7BBN+gGsAEbdINu0A3aDegGpL+Rk5AEVKkn/QTB/s+O7QRJDJ' +
      'mZE+AKwMnMggVnYGNmhwQ4BWBrZqEBiTGzSII1sEOGJBJYA1tk' +
      'aEBiDGyQIQEr4Bb+TDewBFbIMBNYAzfAfwNWwBIZZgJr4AY4AE' +
      'tgCdySYSqwBm7A36rAAlgiw1RgBdyA+0uwABbAEhkmAmvgBvyt' +
      'IZgDC2AJLIBbMkwE1sANuP8Ec2ABLIAFcEuGfwOSL/uTXDqp97' +
      '/hAAAAAElFTkSuQmCC';

    try {
      let icon = nativeImage.createFromDataURL(blackMicrophoneIcon);
      if (!icon.isEmpty()) {
        icon.setTemplateImage(true);
        tray.setImage(icon);
      }
    } catch (err) {
      console.error('Failed to update tray icon:', err);
    }
  } else {
    // Windows/Linux: Use colored icons
    // White icon for normal, red for recording
    const normalIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAABDklEQVR4nGNgGAWjAAYYmJiYGP7//8/AwMDAICUlxfD//38GBgYGBkZGRob///8ziIuLM/z584fh379/DH///mVgYGBgYGZmZpCQkGD4/fs3w58/fxj+/v3LwMDAwMDCwsIgJibG8OvXL4bfv38z/Pnzh4GBgYGBhYWFQVRUlOHnz58Mv379Yvjz5w8DAwMDA8u/f/8YRERE/v/48YPh58+fDL9//2b4//8/AwMDAwPL379/GYSFRT78+PGD4efPnwy/fv1i+PfvHwMDAwMDy+/fvxmEhIQ+fP/+neHHjx8MP3/+ZPj9+zcDAwMDA8uvX78YBAUFPzAwMDB8//6d4cePHww/f/5k+P37NwMDAwMD4ygAAOuhQYJwNjcnAAAAAElFTkSuQmCC';

    // Red-tinted icon for recording state
    const recordingIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA+klEQVR4nGNgGAWjAAYYWFhYGP7//8/AwMDAIC0tzfD//38GBgYGBiYmJob///8zSEhIMPz584fh379/DH///mVgYGBgYGFhYZCUlGT4/fs3w58/fxj+/v3LwMDAwMDKysogLi7O8OvXL4bfv38z/PnzhwEZsLKyMoiJiTH8/PmT4devXwx//vxhQAasrKwMIiIiH378+MHw8+dvht+/fzP8//+fARmwsrIyCAkJffj+/TvDjx8/GH7+/Mnw+/dvBmTAysrKICAg8IGBgYHh+/fvDD9+/GD4+fMnw+/fvxmQASsrKwM/P/8HBgYGhm/fvjH8+PGD4efPnwy/f/9mYBwFAAB9jzyOMv9j8QAAAABJRU5ErkJggg==';

    try {
      let icon = nativeImage.createFromDataURL(recording ? recordingIcon : normalIcon);
      if (!icon.isEmpty()) {
        // Ensure icon is 16x16 on Windows for proper tray display
        if (process.platform === 'win32') {
          icon = icon.resize({ width: 16, height: 16 });
        }
        tray.setImage(icon);
      } else {
        console.error('Created empty tray icon, skipping update');
      }
    } catch (err) {
      console.error('Failed to update tray icon:', err);
    }
  }
}

// Default settings
const DEFAULT_SETTINGS = {
  apiKey: '',
  whisperModel: 'whisper-large-v3-turbo',
  hotkey: 'CommandOrControl+Shift+Space',
  outputMode: 'type',
  autoLaunch: false,
  showPill: true,
  pillVisibility: 'always',
  language: 'en',
  aiPostProcessing: false,
  removeFillerWords: true,
  removeFalseStarts: true,
  fixPunctuation: true,
  fixGrammar: false,
  preferredMicrophone: 'default',
  incognitoMode: false,
  autoUpdate: true,
  onboardingComplete: false,
};

// IPC Handlers
ipcMain.handle('get-settings', () => {
  return {
    apiKey: store.get('apiKey') || DEFAULT_SETTINGS.apiKey,
    whisperModel: store.get('whisperModel') || DEFAULT_SETTINGS.whisperModel,
    hotkey: store.get('hotkey') || DEFAULT_SETTINGS.hotkey,
    outputMode: store.get('outputMode') || DEFAULT_SETTINGS.outputMode,
    autoLaunch: store.get('autoLaunch') ?? DEFAULT_SETTINGS.autoLaunch,
    showPill: store.get('showPill') ?? DEFAULT_SETTINGS.showPill,
    pillVisibility: store.get('pillVisibility') || DEFAULT_SETTINGS.pillVisibility,
    language: store.get('language') || DEFAULT_SETTINGS.language,
    aiPostProcessing: store.get('aiPostProcessing') ?? DEFAULT_SETTINGS.aiPostProcessing,
    removeFillerWords: store.get('removeFillerWords') ?? DEFAULT_SETTINGS.removeFillerWords,
    removeFalseStarts: store.get('removeFalseStarts') ?? DEFAULT_SETTINGS.removeFalseStarts,
    fixPunctuation: store.get('fixPunctuation') ?? DEFAULT_SETTINGS.fixPunctuation,
    fixGrammar: store.get('fixGrammar') ?? DEFAULT_SETTINGS.fixGrammar,
    preferredMicrophone: store.get('preferredMicrophone') || DEFAULT_SETTINGS.preferredMicrophone,
    incognitoMode: store.get('incognitoMode') ?? DEFAULT_SETTINGS.incognitoMode,
    autoUpdate: store.get('autoUpdate') ?? DEFAULT_SETTINGS.autoUpdate,
    onboardingComplete: store.get('onboardingComplete') ?? DEFAULT_SETTINGS.onboardingComplete,
  };
});

ipcMain.handle('get-word-stats', () => {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;
  const storedMonth = store.get('wordCountMonth') as string;

  // Reset monthly count if we're in a new month
  if (storedMonth !== currentMonth) {
    store.set('wordCountMonth', currentMonth);
    store.set('wordsThisMonth', 0);
  }

  return {
    wordsThisMonth: (store.get('wordsThisMonth') as number) || 0,
    wordsTotal: (store.get('wordsTotal') as number) || 0,
  };
});

ipcMain.handle('add-words', (_, wordCount: number) => {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;
  const storedMonth = store.get('wordCountMonth') as string;

  // Reset monthly count if we're in a new month
  if (storedMonth !== currentMonth) {
    store.set('wordCountMonth', currentMonth);
    store.set('wordsThisMonth', 0);
  }

  const currentMonthly = (store.get('wordsThisMonth') as number) || 0;
  const currentTotal = (store.get('wordsTotal') as number) || 0;

  store.set('wordsThisMonth', currentMonthly + wordCount);
  store.set('wordsTotal', currentTotal + wordCount);

  return {
    wordsThisMonth: currentMonthly + wordCount,
    wordsTotal: currentTotal + wordCount,
  };
});

ipcMain.handle('save-settings', (_, settings) => {
  // Save all provided settings
  const settingKeys = [
    'apiKey', 'whisperModel', 'hotkey', 'outputMode', 'autoLaunch', 'showPill',
    'pillVisibility', 'language', 'aiPostProcessing', 'removeFillerWords',
    'removeFalseStarts', 'fixPunctuation', 'fixGrammar', 'preferredMicrophone',
    'incognitoMode', 'autoUpdate', 'onboardingComplete'
  ];

  for (const key of settingKeys) {
    if (settings[key] !== undefined) {
      store.set(key, settings[key]);
    }
  }

  // Re-register hotkeys if changed
  if (settings.hotkey !== undefined) {
    registerHotkeys();
  }

  // Handle auto-launch setting
  if (settings.autoLaunch !== undefined) {
    app.setLoginItemSettings({
      openAtLogin: settings.autoLaunch,
    });
  }

  // Notify overlay of pill visibility changes
  if (settings.showPill !== undefined || settings.pillVisibility !== undefined) {
    overlayWindow?.webContents.send('settings-changed', {
      showPill: store.get('showPill'),
      pillVisibility: store.get('pillVisibility'),
    });
  }

  return true;
});

ipcMain.handle('copy-to-clipboard', (_, text: string) => {
  clipboard.writeText(text);
  return true;
});

ipcMain.handle('type-text', async (_, text: string) => {
  try {
    // Copy text to clipboard
    clipboard.writeText(text);

    // Blur the overlay window to ensure focus returns to the previous app
    if (overlayWindow) {
      overlayWindow.blur();
    }

    // Delay to let focus settle back to the target application
    await new Promise(resolve => setTimeout(resolve, 100));

    if (process.platform === 'win32') {
      return new Promise((resolve) => {
        // Use PowerShell to simulate Ctrl+V paste
        // Use -WindowStyle Hidden to prevent PowerShell window flash
        // Add small delay after assembly load to ensure it's ready
        const psCommand = `powershell -NoProfile -WindowStyle Hidden -Command "Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 50; [System.Windows.Forms.SendKeys]::SendWait('^v')"`;
        exec(psCommand, { windowsHide: true }, (error, stdout, stderr) => {
          if (error) {
            console.error('Paste failed:', error.message);
            if (stderr) console.error('stderr:', stderr);
          }
          resolve(!error);
        });
      });
    } else if (process.platform === 'darwin') {
      return new Promise((resolve) => {
        // Use AppleScript to simulate Cmd+V paste
        const script = `osascript -e 'tell application "System Events" to keystroke "v" using command down'`;
        exec(script, (error, stdout, stderr) => {
          if (error) {
            console.error('Paste failed:', error.message);
            if (stderr) console.error('stderr:', stderr);
          }
          resolve(!error);
        });
      });
    } else {
      // Linux fallback - just return true, clipboard is already set
      return true;
    }
  } catch (error) {
    console.error('type-text error:', error);
    return false;
  }
});

ipcMain.on('recording-stopped', () => {
  isRecording = false;
  updateTrayIcon(false);
});

ipcMain.on('hide-window', () => {
  mainWindow?.hide();
});

// History IPC handlers
interface TranscriptionRecord {
  id: string;
  text: string;
  timestamp: number;
  wordCount: number;
}

ipcMain.handle('get-history', () => {
  return (store.get('history') as TranscriptionRecord[]) || [];
});

ipcMain.handle('add-to-history', (_, record: TranscriptionRecord) => {
  const history = (store.get('history') as TranscriptionRecord[]) || [];
  // Keep only last 100 entries
  const newHistory = [record, ...history].slice(0, 100);
  store.set('history', newHistory);
  return newHistory;
});

ipcMain.handle('clear-history', () => {
  store.set('history', []);
});

ipcMain.handle('delete-history-item', (_, id: string) => {
  const history = (store.get('history') as TranscriptionRecord[]) || [];
  const newHistory = history.filter(item => item.id !== id);
  store.set('history', newHistory);
  return newHistory;
});

// Dictionary IPC handlers
interface DictionaryEntry {
  id: string;
  original: string;
  corrected: string;
  caseSensitive: boolean;
  enabled: boolean;
  createdAt: number;
}

ipcMain.handle('get-dictionary', () => {
  return (store.get('dictionary') as DictionaryEntry[]) || [];
});

ipcMain.handle('add-dictionary-entry', (_, entry: Omit<DictionaryEntry, 'id' | 'createdAt'>) => {
  const dictionary = (store.get('dictionary') as DictionaryEntry[]) || [];
  const newEntry: DictionaryEntry = {
    ...entry,
    id: Date.now().toString(),
    createdAt: Date.now(),
  };
  const newDictionary = [newEntry, ...dictionary];
  store.set('dictionary', newDictionary);
  return newDictionary;
});

ipcMain.handle('update-dictionary-entry', (_, id: string, updates: Partial<DictionaryEntry>) => {
  const dictionary = (store.get('dictionary') as DictionaryEntry[]) || [];
  const newDictionary = dictionary.map(entry =>
    entry.id === id ? { ...entry, ...updates } : entry
  );
  store.set('dictionary', newDictionary);
  return newDictionary;
});

ipcMain.handle('delete-dictionary-entry', (_, id: string) => {
  const dictionary = (store.get('dictionary') as DictionaryEntry[]) || [];
  const newDictionary = dictionary.filter(entry => entry.id !== id);
  store.set('dictionary', newDictionary);
  return newDictionary;
});

ipcMain.handle('clear-all-data', () => {
  store.clear();
  return true;
});

ipcMain.handle('test-api-key', async (_, apiKey: string) => {
  // Simple validation - just check if it looks like a valid Groq API key
  if (!apiKey || !apiKey.startsWith('gsk_')) {
    return false;
  }
  // For now, just validate format. Real validation would require an API call.
  return apiKey.length > 20;
});

// Sound playback
function playSound(type: 'start' | 'stop' | 'error') {
  if (process.platform === 'win32') {
    // Use PowerShell to play a system beep
    const frequency = type === 'start' ? 800 : type === 'stop' ? 600 : 400;
    const duration = type === 'error' ? 200 : 80;
    const psCommand = `powershell -Command "[console]::beep(${frequency}, ${duration})"`;
    exec(psCommand, () => {});
  } else if (process.platform === 'darwin') {
    // Use macOS system sounds
    const sound = type === 'start' ? 'Tink' : type === 'stop' ? 'Pop' : 'Basso';
    exec(`afplay /System/Library/Sounds/${sound}.aiff`, () => {});
  }
}

ipcMain.on('play-sound', (_, type: 'start' | 'stop' | 'error') => {
  playSound(type);
});

// App lifecycle
app.whenReady().then(() => {
  // Remove menu bar
  Menu.setApplicationMenu(null);

  createWindow();
  createOverlayWindow();
  createTray();
  registerHotkeys();

  // Enable F12 to open dev tools in main window
  if (mainWindow) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12') {
        mainWindow?.webContents.toggleDevTools();
        event.preventDefault();
      }
    });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
