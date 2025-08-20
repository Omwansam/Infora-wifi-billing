import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bug, Plus, MessageSquare } from 'lucide-react';

const BugReportPage = () => {
  const [reports] = useState([
    { id: 1, type: 'Bug', title: 'Login page not loading', status: 'Open', priority: 'High', date: '2024-01-15' },
    { id: 2, type: 'Feature', title: 'Add dark mode support', status: 'In Progress', priority: 'Medium', date: '2024-01-14' }
  ]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Bug className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Features & Bug Reports</h1>
                <p className="text-gray-600 mt-1">Report bugs and request new features</p>
              </div>
            </div>
            <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Plus className="h-4 w-4 mr-2" />
              New Report
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Recent Reports</h2>
          <div className="space-y-4">
            {reports.map((report) => (
              <div key={report.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{report.title}</h3>
                    <p className="text-sm text-gray-500">Type: {report.type} • Priority: {report.priority}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      report.status === 'Open' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {report.status}
                    </span>
                    <span className="text-sm text-gray-500">{report.date}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default BugReportPage;
