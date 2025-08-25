import React, { useState } from 'react';
import { testApiConnection } from '../../utils/api';
import { API_ENDPOINTS } from '../../config/api';
import toast from 'react-hot-toast';

export default function ConnectionTest() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const testConnection = async () => {
    setTesting(true);
    setResult(null);

    try {
      const response = await testApiConnection();
      setResult(response);
      
      if (response.success) {
        toast.success('Backend connection successful!');
      } else {
        toast.error(`Connection failed: ${response.error}`);
      }
    } catch (error) {
      setResult({ success: false, error: error.message });
      toast.error('Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">API Connection Test</h3>
      
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">
          Backend URL: <code className="bg-gray-200 px-2 py-1 rounded">{API_ENDPOINTS.TEST}</code>
        </p>
        
        <button
          onClick={testConnection}
          disabled={testing}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
      </div>

      {result && (
        <div className={`p-3 rounded ${result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          <strong>{result.success ? 'Success:' : 'Error:'}</strong> {result.error || 'Connection successful'}
        </div>
      )}
    </div>
  );
}
