import { useState } from 'react';
import { Outlet } from 'react-router';
import { Sidebar } from '../components/layout/Sidebar.jsx';
import { Navbar } from '../components/layout/Navbar.jsx';

/** Layout principal: sidebar colapsable + navbar + contenido. Responsive desde 360 px. */
export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
