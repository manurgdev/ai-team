export interface Provider {
  id: string;
  name: string;
  description: string;
  models: string[];
}

export interface ApiKey {
  id: string;
  provider: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaveApiKeyDto {
  provider: string;
  apiKey: string;
}
