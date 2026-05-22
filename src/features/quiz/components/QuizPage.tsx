import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageShell, PageHeader } from '@/components/patterns';

export function QuizPage() {
  const navigate = useNavigate();

  return (
    <PageShell>
      <PageHeader title="Quiz Mode" />
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
        </div>
        <h2 className="text-base font-semibold mb-1">Coming Soon</h2>
        <p className="text-xs text-muted-foreground max-w-xs mb-4">
          Quiz mode is under development. Practice dictation in the meantime to
          build your listening skills!
        </p>
        <Button size="sm" variant="outline" onClick={() => navigate('/library')} className="gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Library
        </Button>
      </div>
    </PageShell>
  );
}
