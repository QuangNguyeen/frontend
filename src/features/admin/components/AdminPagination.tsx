import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdminPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  isFetching?: boolean;
  onPageChange: (page: number) => void;
}

export function AdminPagination({
  page,
  totalPages,
  total,
  pageSize,
  isFetching,
  onPageChange,
}: AdminPaginationProps) {
  const safeTotalPages = Math.max(1, totalPages || 1);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex min-h-11 flex-col gap-2 border-t border-border bg-card px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-semibold text-muted-foreground">
        {from}-{to} of {total}
        {isFetching && <span className="ml-2">Updating...</span>}
      </p>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">Previous</span>
        </Button>
        <span className="min-w-20 text-center text-xs font-bold text-muted-foreground">
          {page} / {safeTotalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= safeTotalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
