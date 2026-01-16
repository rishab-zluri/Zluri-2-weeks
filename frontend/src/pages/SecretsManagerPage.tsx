import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Download,
  Key,
  Info,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import secretsService from '@/services/secretsService';
import { Loading, EmptyState } from '@/components/common';
import toast from 'react-hot-toast';

const SecretsManagerPage: React.FC = () => {
  // Data state
  const [secrets, setSecrets] = useState<string[]>([]);
  const [filteredSecrets, setFilteredSecrets] = useState<string[]>([]);
  const [selectedSecret, setSelectedSecret] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Loading state
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // Fetch secrets
  const fetchSecrets = useCallback(async () => {
    try {
      const response = await secretsService.getSecrets();
      const secretsList = response.data?.secrets || [];
      setSecrets(secretsList);
      setFilteredSecrets(secretsList);
    } catch (error) {
      console.error('Error fetching secrets:', error);
      toast.error('Failed to load secrets');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchSecrets();
  }, [fetchSecrets]);

  // Filter secrets based on search
  useEffect(() => {
    if (!searchQuery) {
      setFilteredSecrets(secrets);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = secrets.filter((secret) =>
        secret.toLowerCase().includes(query)
      );
      setFilteredSecrets(filtered);
    }
  }, [searchQuery, secrets]);

  // Handle secret selection
  const handleSelectSecret = (secret: string) => {
    setSelectedSecret(secret === selectedSecret ? null : secret);
  };

  // Download secret
  const handleDownload = async () => {
    if (!selectedSecret) {
      toast.error('Please select a secret first');
      return;
    }

    setDownloading(true);
    try {
      await secretsService.downloadSecret(selectedSecret);
      toast.success('Secret downloaded successfully');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download secret');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading text="Loading secrets..." />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Secrets Manager</h1>
        <p className="text-gray-500 mt-1">Browse and download AWS Secrets Manager secrets</p>
      </div>

      {/* Main Card */}
      <div className="card">
        {/* Search */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search Secrets
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type to search secrets..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 
                       focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Found {filteredSecrets.length} secrets
          </p>
        </div>

        {/* Secret Name Label */}
        <div className="mb-2">
          <label className="text-sm font-medium text-gray-700">
            Secret Name <span className="text-red-500">*</span>
          </label>
        </div>

        {/* Secrets List */}
        {filteredSecrets.length === 0 ? (
          <EmptyState
            icon={Key}
            title="No secrets found"
            description={searchQuery ? 'Try a different search query' : 'No secrets available'}
          />
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
            {filteredSecrets.map((secret, index) => (
              <div
                key={secret}
                onClick={() => handleSelectSecret(secret)}
                className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors
                  ${selectedSecret === secret
                    ? 'bg-purple-50 border-l-4 border-purple-500'
                    : 'hover:bg-gray-50 border-l-4 border-transparent'
                  }
                  ${index !== filteredSecrets.length - 1 ? 'border-b border-gray-100' : ''}
                `}
              >
                <span className="text-sm font-mono text-gray-700 truncate pr-4">
                  {secret}
                </span>
                {selectedSecret === secret && (
                  <CheckCircle2 className="w-5 h-5 text-purple-600 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Download Button */}
        <button
          onClick={handleDownload}
          disabled={!selectedSecret || downloading}
          className="w-full mt-6 btn-primary flex items-center justify-center gap-2"
        >
          {downloading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Downloading...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Download Secret
            </>
          )}
        </button>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">About Secrets Manager</h4>
              <p className="text-sm text-blue-700 mt-1">
                This interface allows you to browse and download secrets from AWS Secrets Manager.
                Use the search box to filter secrets by name, select the desired secret, and click
                the download button to retrieve it.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecretsManagerPage;
