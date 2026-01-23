import { create } from 'zustand';
import { Provider, ApiKey } from '../lib/types/config.types';

interface ConfigState {
  providers: Provider[];
  apiKeys: ApiKey[];
  selectedProvider: string | null;
  isLoading: boolean;

  setProviders: (providers: Provider[]) => void;
  setApiKeys: (apiKeys: ApiKey[]) => void;
  setSelectedProvider: (provider: string | null) => void;
  setLoading: (loading: boolean) => void;
  addApiKey: (apiKey: ApiKey) => void;
  removeApiKey: (provider: string) => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  providers: [],
  apiKeys: [],
  selectedProvider: null,
  isLoading: false,

  setProviders: (providers) => set({ providers }),

  setApiKeys: (apiKeys) => set({ apiKeys }),

  setSelectedProvider: (provider) => set({ selectedProvider: provider }),

  setLoading: (loading) => set({ isLoading: loading }),

  addApiKey: (apiKey) =>
    set((state) => {
      const existing = state.apiKeys.find((k) => k.provider === apiKey.provider);
      if (existing) {
        return {
          apiKeys: state.apiKeys.map((k) =>
            k.provider === apiKey.provider ? apiKey : k
          ),
        };
      }
      return { apiKeys: [...state.apiKeys, apiKey] };
    }),

  removeApiKey: (provider) =>
    set((state) => ({
      apiKeys: state.apiKeys.filter((k) => k.provider !== provider),
    })),
}));
