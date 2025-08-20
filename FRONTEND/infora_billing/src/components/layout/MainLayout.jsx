import React from 'react';
import AppSidebar from '../auth/AppSidebar';
import Header from './Header';

const MainLayout = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <AppSidebar />
      <div className="flex-1 lg:ml-64">
        <Header />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
