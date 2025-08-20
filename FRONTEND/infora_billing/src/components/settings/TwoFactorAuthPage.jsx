import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, CheckCircle, AlertCircle } from 'lucide-react';

const TwoFactorAuthPage = () => {
  const [isEnabled, setIsEnabled] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Shield className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Two-Factor Authentication</h1>
              <p className="text-gray-600 mt-1">Secure your account with an extra layer of protection</p>
            </div>
          </div>
        </motion.div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Current Status</h2>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              isEnabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {isEnabled ? 'Enabled' : 'Disabled'}
            </div>
          </div>
          
          {!isEnabled ? (
            <div className="space-y-4">
              <p className="text-gray-600">
                Two-factor authentication adds an extra layer of security to your account by requiring a verification code in addition to your password.
              </p>
              <button
                onClick={() => setIsEnabled(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Shield className="h-4 w-4 mr-2" />
                Enable 2FA
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Your account is protected with 2FA</span>
              </div>
              <button
                onClick={() => setIsEnabled(false)}
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Disable 2FA
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TwoFactorAuthPage;
