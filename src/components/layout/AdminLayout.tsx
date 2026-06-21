import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopBar } from './AdminTopBar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-background">
      <div className="hidden shrink-0 lg:block">
        <AdminSidebar />
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 max-w-[86vw] gap-0 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Admin navigation</SheetTitle>
          </SheetHeader>
          <AdminSidebar mobile onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AdminTopBar onOpenSidebar={() => setMobileOpen(true)} />
        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="flex h-full min-h-0 w-full flex-col px-4 sm:px-5 xl:px-6">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
