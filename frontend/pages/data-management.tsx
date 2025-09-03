import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { 
  Database,
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  Shield,
  FileText,
  Calendar,
  HardDrive,
  RefreshCw,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

interface DataSummary {
  overview: {
    totalProducts: number;
    totalStores: number;
    totalAuditRecords: number;
    estimatedSizeBytes: number;
    estimatedSizeMB: number;
  };
  auditBreakdown: {
    stockAudits: number;
    syncAudits: number;
  };
  recentActivity: {
    stockAuditsLast7Days: number;
    syncAuditsLast7Days: number;
  };
}

interface BackupStats {
  counts: {
    products: number;
    stockAudits: number;
    syncAudits: number;
    stores: number;
    totalAuditRecords: number;
  };
  dateRanges: {
    stockAudits: {
      oldest: string | null;
      newest: string | null;
    };
    syncAudits: {
      oldest: string | null;
      newest: string | null;
    };
  };
}

export default function DataManagement() {
  const [loading, setLoading] = useState(true);
  const [dataSummary, setDataSummary] = useState<DataSummary | null>(null);
  const [backupStats, setBackupStats] = useState<BackupStats | null>(null);
  const [importing, setImporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [summaryRes, statsRes] = await Promise.all([
        axios.get('/api/data-management/summary'),
        axios.get('/api/data-management/backup-stats')
      ]);

      setDataSummary(summaryRes.data.data);
      setBackupStats(statsRes.data.data);
    } catch (error: any) {
      toast.error('Failed to fetch data management information');
      console.error('Data management fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const response = await axios.get('/api/data-management/backup', {
        responseType: 'blob'
      });

      // Create download link
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `inventory_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('✅ Backup exported successfully');
    } catch (error: any) {
      toast.error('❌ Failed to export backup');
      console.error('Export error:', error);
    } finally {
      setExporting(false);
    }
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.json')) {
      toast.error('Please select a valid JSON backup file');
      return;
    }

    // Confirm import
    const confirm = window.confirm(
      `⚠️ IMPORT BACKUP DATA\n\n` +
      `This will import audit history from the backup file.\n` +
      `File: ${file.name}\n` +
      `Size: ${(file.size / 1024 / 1024).toFixed(2)} MB\n\n` +
      `Are you sure you want to continue?`
    );

    if (!confirm) {
      event.target.value = ''; // Reset file input
      return;
    }

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('backupFile', file);

      const response = await axios.post('/api/data-management/import-backup', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success(`✅ Backup imported: ${response.data.importedRecords.totalImported} records`);
      fetchData(); // Refresh data
    } catch (error: any) {
      toast.error(`❌ Import failed: ${error.response?.data?.message || 'Unknown error'}`);
      console.error('Import error:', error);
    } finally {
      setImporting(false);
      event.target.value = ''; // Reset file input
    }
  };

  const handleResetAuditData = async () => {
    // First confirmation
    const firstConfirm = window.confirm(
      `🚨 DANGER: RESET ALL AUDIT DATA 🚨\n\n` +
      `This will permanently delete:\n` +
      `• All stock audit history (${backupStats?.counts.stockAudits || 0} records)\n` +
      `• All sync audit history (${backupStats?.counts.syncAudits || 0} records)\n` +
      `• All reports history data\n\n` +
      `PRESERVED:\n` +
      `• Product inventory (${dataSummary?.overview.totalProducts || 0} products)\n` +
      `• Store connections (${dataSummary?.overview.totalStores || 0} stores)\n\n` +
      `⚠️ This action CANNOT be undone!\n\n` +
      `Are you sure you want to continue?`
    );

    if (!firstConfirm) return;

    // Second confirmation
    const secondConfirm = window.confirm(
      `🔥 FINAL WARNING 🔥\n\n` +
      `You are about to delete ${dataSummary?.overview.totalAuditRecords || 0} audit records.\n\n` +
      `This will reset all history but keep your:\n` +
      `✅ Product inventory\n` +
      `✅ Store connections\n\n` +
      `❌ All audit trails will be lost\n\n` +
      `Type "RESET" and click OK to confirm this dangerous operation.`
    );

    if (!secondConfirm) return;

    setResetting(true);
    try {
      const response = await axios.post('/api/data-management/reset-audit-data', {
        confirmReset: true
      });

      toast.success(`✅ Reset completed: ${response.data.deletedRecords.totalDeleted} records deleted`);
      fetchData(); // Refresh data
    } catch (error: any) {
      toast.error(`❌ Reset failed: ${error.response?.data?.message || 'Unknown error'}`);
      console.error('Reset error:', error);
    } finally {
      setResetting(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Database className="h-8 w-8 text-purple-600" />
              Data Management
            </h1>
            <p className="text-gray-600 mt-1">Backup, restore, and manage your inventory data</p>
          </div>
          
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-purple-600" />
            <span className="ml-2 text-gray-600">Loading data information...</span>
          </div>
        ) : (
          <>
            {/* Data Overview */}
            {dataSummary && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-lg shadow border">
                  <div className="flex items-center">
                    <FileText className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Records</p>
                      <p className="text-2xl font-bold text-gray-900">{formatNumber(dataSummary.overview.totalAuditRecords)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border">
                  <div className="flex items-center">
                    <HardDrive className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Estimated Size</p>
                      <p className="text-2xl font-bold text-gray-900">{dataSummary.overview.estimatedSizeMB} MB</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border">
                  <div className="flex items-center">
                    <Calendar className="h-8 w-8 text-orange-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Recent Activity</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatNumber(dataSummary.recentActivity.stockAuditsLast7Days + dataSummary.recentActivity.syncAuditsLast7Days)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border">
                  <div className="flex items-center">
                    <Shield className="h-8 w-8 text-purple-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Protected Data</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatNumber(dataSummary.overview.totalProducts + dataSummary.overview.totalStores)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Export Backup */}
              <div className="bg-white p-6 rounded-lg shadow border">
                <div className="flex items-center mb-4">
                  <Download className="h-6 w-6 text-blue-600" />
                  <h3 className="text-lg font-medium text-gray-900 ml-2">Export Backup</h3>
                </div>
                <p className="text-gray-600 mb-4">
                  Create a comprehensive backup of all audit data, sync history, and reports data.
                </p>
                <div className="space-y-2 mb-4 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Stock Audits:</span>
                    <span className="font-medium">{formatNumber(backupStats?.counts.stockAudits || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sync Audits:</span>
                    <span className="font-medium">{formatNumber(backupStats?.counts.syncAudits || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Records:</span>
                    <span className="font-medium">{formatNumber(backupStats?.counts.totalAuditRecords || 0)}</span>
                  </div>
                </div>
                <button
                  onClick={handleExportBackup}
                  disabled={exporting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                >
                  <Download className={`h-4 w-4 ${exporting ? 'animate-pulse' : ''}`} />
                  {exporting ? 'Exporting...' : 'Export Backup'}
                </button>
              </div>

              {/* Import Backup */}
              <div className="bg-white p-6 rounded-lg shadow border">
                <div className="flex items-center mb-4">
                  <Upload className="h-6 w-6 text-green-600" />
                  <h3 className="text-lg font-medium text-gray-900 ml-2">Import Backup</h3>
                </div>
                <p className="text-gray-600 mb-4">
                  Restore audit data from a previously exported backup file.
                </p>
                <div className="space-y-2 mb-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-500" />
                    <span>Imports audit history only</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Safe operation (no data loss)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-purple-500" />
                    <span>Accepts JSON backup files</span>
                  </div>
                </div>
                <label className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 cursor-pointer">
                  <Upload className={`h-4 w-4 ${importing ? 'animate-pulse' : ''}`} />
                  {importing ? 'Importing...' : 'Select Backup File'}
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportBackup}
                    disabled={importing}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Reset Data */}
              <div className="bg-white p-6 rounded-lg shadow border border-red-200">
                <div className="flex items-center mb-4">
                  <Trash2 className="h-6 w-6 text-red-600" />
                  <h3 className="text-lg font-medium text-gray-900 ml-2">Reset Audit Data</h3>
                </div>
                <p className="text-gray-600 mb-4">
                  Permanently delete all audit history while preserving products and stores.
                </p>
                <div className="space-y-2 mb-4 text-sm">
                  <div className="flex items-center gap-2 text-red-600">
                    <XCircle className="h-4 w-4" />
                    <span>Deletes all audit history</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>Preserves inventory & stores</span>
                  </div>
                  <div className="flex items-center gap-2 text-orange-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Cannot be undone</span>
                  </div>
                </div>
                <button
                  onClick={handleResetAuditData}
                  disabled={resetting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400"
                >
                  <Trash2 className={`h-4 w-4 ${resetting ? 'animate-pulse' : ''}`} />
                  {resetting ? 'Resetting...' : 'Reset All Data'}
                </button>
              </div>
            </div>

            {/* Detailed Statistics */}
            {backupStats && (
              <div className="bg-white rounded-lg shadow border">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Data Statistics</h3>
                  <p className="text-sm text-gray-600">Detailed breakdown of your data</p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-md font-medium text-gray-900 mb-3">Record Counts</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Products:</span>
                          <span className="font-medium">{formatNumber(backupStats.counts.products)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Stores:</span>
                          <span className="font-medium">{formatNumber(backupStats.counts.stores)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Stock Audits:</span>
                          <span className="font-medium">{formatNumber(backupStats.counts.stockAudits)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Sync Audits:</span>
                          <span className="font-medium">{formatNumber(backupStats.counts.syncAudits)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="text-gray-900 font-medium">Total Audit Records:</span>
                          <span className="font-bold">{formatNumber(backupStats.counts.totalAuditRecords)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-md font-medium text-gray-900 mb-3">Date Ranges</h4>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Stock Audits</p>
                          <div className="text-sm text-gray-600">
                            <div>Oldest: {formatDate(backupStats.dateRanges.stockAudits.oldest)}</div>
                            <div>Newest: {formatDate(backupStats.dateRanges.stockAudits.newest)}</div>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">Sync Audits</p>
                          <div className="text-sm text-gray-600">
                            <div>Oldest: {formatDate(backupStats.dateRanges.syncAudits.oldest)}</div>
                            <div>Newest: {formatDate(backupStats.dateRanges.syncAudits.newest)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
