import React from 'react';
import { motion } from 'framer-motion';
import { Construction, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PlaceholderPage({ title, description, icon: Icon = Construction }) {
  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto w-full min-w-0 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex flex-col gap-4">
            <Link
              to="/"
              className="inline-flex w-fit items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{title}</h1>
              <p className="mt-2 text-gray-600">{description}</p>
            </div>
          </div>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center"
        >
          <div className="max-w-md mx-auto">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-6">
              <Icon className="h-6 w-6 text-yellow-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Coming Soon</h3>
            <p className="text-gray-500 mb-6">
              This feature is currently under development and will be available soon. We're working hard to bring you the best experience.
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                <span>Development in progress</span>
              </div>
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <span>Testing phase</span>
              </div>
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                <span>Quality assurance</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-8"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/dashboard"
              className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              to="/clients"
              className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              Customers
            </Link>
            <Link
              to="/payments"
              className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              Payments
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
