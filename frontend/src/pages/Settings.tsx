import { AppHeader } from '../components/layout/AppHeader';
import { ApiKeyManager } from '../components/config/ApiKeyManager';

export function Settings() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        showBackButton
        backTo="/dashboard"
        backLabel="Back to Dashboard"
      />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <ApiKeyManager />
        </div>
      </main>
    </div>
  );
}
