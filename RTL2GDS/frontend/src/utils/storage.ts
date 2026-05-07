import { Configuration } from '../types';

const CONFIG_KEY = 'rtlgds_configuration';

export const saveConfiguration = (config: Configuration): void => {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
};

export const loadConfiguration = (): Configuration | null => {
  const stored = localStorage.getItem(CONFIG_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
};

