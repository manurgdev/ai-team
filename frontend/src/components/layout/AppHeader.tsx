import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/button';
import { SettingsPanel } from '../config/SettingsPanel';
import { ArrowLeft } from 'lucide-react';

interface AppHeaderProps {
  showBackButton?: boolean;
  backTo?: string;
  backLabel?: string;
  rightContent?: React.ReactNode;
}

export function AppHeader({
  showBackButton = false,
  backTo = '/dashboard',
  backLabel = 'Back to Dashboard',
  rightContent,
}: AppHeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="border-b sticky top-0 bg-background z-10">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left side */}
          <div className="flex items-center gap-4">
            {showBackButton ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(backTo)}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">{backLabel}</span>
              </Button>
            ) : (
              <h1 className="text-xl sm:text-2xl font-bold truncate">
                AI Team Collaboration
              </h1>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 sm:gap-3">
            {rightContent}
            <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline-block truncate max-w-[150px] sm:max-w-none">
              {user?.name || user?.email}
            </span>
            <SettingsPanel />
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
