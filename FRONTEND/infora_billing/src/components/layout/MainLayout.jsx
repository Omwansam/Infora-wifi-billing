import React from 'react';
import { motion } from 'framer-motion';
import AppSidebar from '../auth/AppSidebar';
import Header from './Header';
import { SidebarProvider, useSidebar } from '../../contexts/SidebarContext';

function MainLayoutContent({ children }) {
  const { width } = useSidebar();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar />
      <motion.div
        className="flex min-h-screen flex-1 flex-col"
        animate={{ marginLeft: width }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      >
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </motion.div>
    </div>
  );
}

const MainLayout = ({ children }) => {
  return (
    <SidebarProvider>
      <MainLayoutContent>{children}</MainLayoutContent>
    </SidebarProvider>
  );
};

export default MainLayout;
