import React from 'react';
import { motion } from 'framer-motion';
import AppSidebar from '../auth/AppSidebar';
import Header from './Header';
import { SidebarProvider, useSidebar } from '../../contexts/SidebarContext';

function MainLayoutContent({ children }) {
  const { width } = useSidebar();

  return (
    <div className="flex min-h-screen min-w-0 bg-slate-50 dark:bg-slate-950">
      <AppSidebar />
      <motion.div
        className="flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden"
        animate={{ marginLeft: width }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      >
        <Header />
        <main className="min-w-0 flex-1">{children}</main>
      </motion.div>
    </div>
  );
}

const MainLayout = ({ children }) => (
  <SidebarProvider>
    <MainLayoutContent>{children}</MainLayoutContent>
  </SidebarProvider>
);

export default MainLayout;
