import { useState, useEffect } from 'react';
import { getAppSettings, updateAppSetting } from '../../services/middleware.service';
import { AppSetting } from '../../services/types';

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);

  const data = await getAppSettings();
  setSettings(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch app settings';
      setError(errorMessage);
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: string): Promise<void> => {
    try {
      await updateAppSetting(key, value);

      // Refresh settings after update
      await fetchSettings();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update setting';
      throw new Error(errorMessage);
    }
  };

  const closeError = () => {
    setShowError(false);
    setError(null);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return {
    settings,
    loading,
    error,
    showError,
    closeError,
    updateSetting,
    refetchSettings: fetchSettings,
  };
}
