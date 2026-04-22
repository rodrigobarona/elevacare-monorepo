'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { Globe, Loader2, Palette } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'es' | 'pt' | 'br';
}

interface SecurityPreferencesFormProps {
  className?: string;
}

export function SecurityPreferencesForm({ className }: SecurityPreferencesFormProps) {
  const { user, loading } = useAuth();
  const isLoaded = !loading;
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [lastSavedPreferences, setLastSavedPreferences] = useState<UserPreferences | null>(null);

  // Load current preferences
  const loadPreferences = useCallback(async () => {
    try {
      setIsLoadingPrefs(true);
      const response = await fetch('/api/user/security-preferences');
      if (!response.ok) {
        throw new Error('Failed to fetch preferences');
      }

      const data = await response.json();
      setPreferences(data.preferences);
      setLastSavedPreferences(data.preferences);
    } catch (error) {
      console.error('Error loading preferences:', error);
      toast.error('Failed to load preferences');
    } finally {
      setIsLoadingPrefs(false);
    }
  }, []);

  useEffect(() => {
    if (isLoaded && user) {
      loadPreferences();
    }
  }, [isLoaded, user, loadPreferences]);

  // Save preferences with debounce
  const savePreferences = useCallback(async () => {
    if (!preferences || !lastSavedPreferences) return;

    // Check if there are actual changes
    if (JSON.stringify(preferences) === JSON.stringify(lastSavedPreferences)) {
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/user/security-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences }),
      });

      if (!response.ok) {
        throw new Error('Failed to save preferences');
      }

      const data = await response.json();
      setLastSavedPreferences(data.preferences);
      toast.success('Preferences saved');
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  }, [preferences, lastSavedPreferences]);

  // Auto-save when preferences change
  useEffect(() => {
    if (preferences && lastSavedPreferences) {
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set new timeout for auto-save
      saveTimeoutRef.current = setTimeout(() => {
        savePreferences();
      }, 1000); // 1 second debounce
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [preferences, lastSavedPreferences, savePreferences]);

  const updatePreference = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      setPreferences((prev) => (prev ? { ...prev, [key]: value } : prev));
    },
    [],
  );

  if (!isLoaded || isLoadingPrefs) {
    return (
      <Card className={className}>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </Card>
    );
  }

  if (!user || !preferences) {
    return (
      <Card className={className}>
        <div className="p-6">
          <Alert variant="destructive">
            <AlertDescription>Failed to load user preferences</AlertDescription>
          </Alert>
        </div>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <div className="p-6">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-2xl font-bold tracking-tight">UI Preferences</h2>
            <p className="text-sm text-muted-foreground">
              Customize your interface appearance and language
            </p>
            {saving && (
              <p className="mt-2 text-xs text-muted-foreground">
                <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                Saving...
              </p>
            )}
          </div>

          {/* Theme Selection */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Palette className="h-5 w-5 text-gray-500" />
              <Label htmlFor="theme" className="text-sm font-medium">
                Theme
              </Label>
            </div>
            <Select
              value={preferences.theme}
              onValueChange={(value: any) => updatePreference('theme', value)}
            >
              <SelectTrigger id="theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Choose your preferred color scheme</p>
          </div>

          {/* Language Selection */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Globe className="h-5 w-5 text-gray-500" />
              <Label htmlFor="language" className="text-sm font-medium">
                Language
              </Label>
            </div>
            <Select
              value={preferences.language}
              onValueChange={(value: any) => updatePreference('language', value)}
            >
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="pt">Português</SelectItem>
                <SelectItem value="br">Português (Brasil)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select your preferred interface language
            </p>
          </div>

          {/* Info Alert */}
          <Alert>
            <AlertDescription className="text-xs">
              <strong>Note:</strong> Security and notification preferences are managed automatically
              by WorkOS and Novu. Critical security alerts are always enabled.
            </AlertDescription>
          </Alert>

          {/* Auto-save info */}
          <div className="border-t pt-4">
            <p className="text-center text-xs text-muted-foreground">
              Changes are automatically saved
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
