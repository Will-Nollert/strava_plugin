// src/services/settingsService.js
import CONFIG from "../config.js";

/**
 * Get user settings from storage, with defaults applied
 * @returns {Promise<Object>} The user settings
 */
export async function getSettings() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([CONFIG.SETTINGS_KEY], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        // Merge with default settings to ensure all properties exist
        const settings = {
          ...CONFIG.DEFAULT_SETTINGS,
          ...(result[CONFIG.SETTINGS_KEY] || {}),
        };
        resolve(settings);
      }
    });
  });
}

/**
 * Save settings to storage
 * @param {Object} settings - The settings to save
 * @returns {Promise<void>}
 */
export async function saveSettings(settings) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [CONFIG.SETTINGS_KEY]: settings }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Update a specific setting
 * @param {string} key - Setting key
 * @param {any} value - Setting value
 * @returns {Promise<Object>} The updated settings
 */
export async function updateSetting(key, value) {
  const settings = await getSettings();
  settings[key] = value;
  await saveSettings(settings);
  return settings;
}

/**
 * Reset settings to defaults
 * @returns {Promise<Object>} The default settings
 */
export async function resetSettings() {
  await saveSettings(CONFIG.DEFAULT_SETTINGS);
  return CONFIG.DEFAULT_SETTINGS;
}
