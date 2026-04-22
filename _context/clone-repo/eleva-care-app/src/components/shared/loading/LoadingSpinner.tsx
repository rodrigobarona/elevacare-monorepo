import { LoaderCircle } from 'lucide-react';

export function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="text-center text-xl font-medium text-muted-foreground">Loading...</div>
      <LoaderCircle className="size-8 animate-spin text-muted-foreground" />
    </div>
  );
}
