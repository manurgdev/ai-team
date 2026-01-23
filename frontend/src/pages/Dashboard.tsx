import { useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { RecentTasks } from '../components/dashboard/RecentTasks';
import { ExportHistory } from '../components/export/ExportHistory';
import { AppHeader } from '../components/layout/AppHeader';

export function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Welcome to AI Team!</CardTitle>
              <CardDescription>
                Your virtual team of AI agents is ready to collaborate on technical tasks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm sm:text-base">
                Create teams of specialized AI agents (Tech Lead, Product Owner, Frontend, Backend,
                DevOps, QA) to work together on your projects. Export results directly to GitHub.
              </p>
              <div className="space-y-3">
                <Button onClick={() => navigate('/tasks/new')} className="w-full sm:w-auto">
                  Create New Task
                </Button>
                <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Configure API keys and GitHub token from the Settings icon in the header
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <RecentTasks />
              <ExportHistory />
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Team Members</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    6 specialized AI agents available
                  </p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <span>🏗️</span>
                      <span>Technical Lead</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span>📋</span>
                      <span>Product Owner</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span>💻</span>
                      <span>Frontend Developer</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span>⚙️</span>
                      <span>Backend Developer</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span>🚀</span>
                      <span>DevOps Engineer</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span>🧪</span>
                      <span>QA Engineer</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Available Agents</span>
                      <span className="font-medium">6</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">AI Providers</span>
                      <span className="font-medium">3</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Execution Modes</span>
                      <span className="font-medium">2</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
