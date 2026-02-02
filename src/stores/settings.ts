import { create } from 'zustand';

export interface Settings {
  apiKey: string;
  hotkey: string;
  outputMode: 'clipboard' | 'type';
}

interface SettingsStore extends Settings {
  setApiKey: (key: string) => void;
  setHotkey: (hotkey: string) => void;
  setOutputMode: (mode: 'clipboard' | 'type') => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  apiKey: '',
  hotkey: 'CommandOrControl+Shift+Space',
  outputMode: 'clipboard',

  setApiKey: (apiKey) => set({ apiKey }),
  setHotkey: (hotkey) => set({ hotkey }),
  setOutputMode: (outputMode) => set({ outputMode }),

  loadSettings: async () => {
    if (window.electron) {
      const settings = await window.electron.getSettings();
      set({
        apiKey: settings.apiKey || '',
        hotkey: settings.hotkey || 'CommandOrControl+Shift+Space',
        outputMode: settings.outputMode || 'clipboard',
      });
    }
  },

  saveSettings: async () => {
    if (window.electron) {
      const { apiKey, hotkey, outputMode } = get();
      await window.electron.saveSettings({ apiKey, hotkey, outputMode });
    }
  },
}));
