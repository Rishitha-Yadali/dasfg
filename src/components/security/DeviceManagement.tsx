import React, { useState, useEffect } from 'react';
import { 
  Monitor, 
  Smartphone, 
  Tablet, 
  MapPin, 
  Clock, 
  Shield, 
  AlertTriangle, 
  Trash2, 
  CheckCircle,
  Globe,
  Activity,
  LogOut,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import { deviceTrackingService, UserDevice, UserSession, ActivityLog } from '../../services/deviceTrackingService';
import { useAuth } from '../../contexts/AuthContext';

export const DeviceManagement: React.FC = () => {
  const { user } = useAuth();
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'devices' | 'sessions' | 'activity'>('devices');
  const [showDetails, setShowDetails] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const [devicesData, sessionsData, activityData] = await Promise.all([
        deviceTrackingService.getUserDevices(user.id),
        deviceTrackingService.getUserSessions(user.id),
        deviceTrackingService.getUserActivityLogs(user.id, 20)
      ]);

      setDevices(devicesData);
      setSessions(sessionsData);
      setActivityLogs(activityData);
    } catch (error) {
      console.error('Error loading device data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTrustDevice = async (deviceId: string) => {
    const success = await deviceTrackingService.trustDevice(deviceId);
    if (success) {
      await loadData();
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    if (confirm('Are you sure you want to remove this device? All sessions will be ended.')) {
      const success = await deviceTrackingService.removeDevice(deviceId);
      if (success) {
        await loadData();
      }
    }
  };

  const handleEndSession = async (sessionId: string) => {
    const success = await deviceTrackingService.endSpecificSession(sessionId);
    if (success) {
      await loadData();
    }
  };

  const handleEndAllOtherSessions = async () => {
    if (confirm('Are you sure you want to end all other sessions? You will remain logged in on this device.')) {
      // Get current session token (you'll need to implement this)
      const currentSessionToken = 'current-session-token'; // Replace with actual current session
      const success = await deviceTrackingService.endAllOtherSessions(user!.id, currentSessionToken);
      if (success) {
        await loadData();
      }
    }
  };

  const toggleDetails = (id: string) => {
    const newShowDetails = new Set(showDetails);
    if (newShowDetails.has(id)) {
      newShowDetails.delete(id);
    } else {
      newShowDetails.add(id);
    }
    setShowDetails(newShowDetails);
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile': return <Smartphone className="w-5 h-5" />;
      case 'tablet': return <Tablet className="w-5 h-5" />;
      default: return <Monitor className="w-5 h-5" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getRiskColor = (score: number) => {
    if (score >= 70) return 'text-red-600 bg-red-100';
    if (score >= 40) return 'text-orange-600 bg-orange-100';
    return 'text-green-600 bg-green-100';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
          <span className="text-gray-600">Loading device information...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="bg-blue-600 w-12 h-12 rounded-full flex items-center justify-center mr-4">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Device & Session Management</h2>
              <p className="text-gray-600">Monitor and manage your account security across all devices</p>
            </div>
          </div>
          <button
            onClick={loadData}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6">
          {[
            { id: 'devices', label: 'Devices', count: devices.length },
            { id: 'sessions', label: 'Active Sessions', count: sessions.length },
            { id: 'activity', label: 'Recent Activity', count: activityLogs.length }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'devices' && (
          <div className="space-y-4">
            {devices.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No devices found
              </div>
            ) : (
              devices.map((device) => (
                <div key={device.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="text-gray-600">
                        {getDeviceIcon(device.deviceType)}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {device.deviceName || `${device.browserName} on ${device.osName}`}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            Last seen: {formatDate(device.lastSeenAt)}
                          </span>
                          {device.lastLocation && (
                            <span className="flex items-center">
                              <MapPin className="w-4 h-4 mr-1" />
                              {device.lastLocation.city}, {device.lastLocation.country}
                            </span>
                          )}
                          <span className="flex items-center">
                            <Activity className="w-4 h-4 mr-1" />
                            {device.activeSessions} active session{device.activeSessions !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {device.isTrusted ? (
                        <span className="flex items-center text-green-600 text-sm">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Trusted
                        </span>
                      ) : (
                        <button
                          onClick={() => handleTrustDevice(device.id)}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors"
                        >
                          Trust Device
                        </button>
                      )}
                      <button
                        onClick={() => toggleDetails(device.id)}
                        className="text-gray-400 hover:text-gray-600 p-1"
                      >
                        {showDetails.has(device.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleRemoveDevice(device.id)}
                        className="text-red-600 hover:text-red-700 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {showDetails.has(device.id) && (
                    <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Device Type:</span>
                        <span className="ml-2 text-gray-600">{device.deviceType}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Browser:</span>
                        <span className="ml-2 text-gray-600">{device.browserName}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Operating System:</span>
                        <span className="ml-2 text-gray-600">{device.osName}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Status:</span>
                        <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                          device.isTrusted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {device.isTrusted ? 'Trusted' : 'Untrusted'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'sessions' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Active Sessions</h3>
              <button
                onClick={handleEndAllOtherSessions}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
              >
                <LogOut className="w-4 h-4" />
                <span>End All Other Sessions</span>
              </button>
            </div>
            
            {sessions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No active sessions found
              </div>
            ) : (
              sessions.map((session) => (
                <div key={session.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="text-gray-600">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          Session from {session.ipAddress}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            Started: {formatDate(session.createdAt)}
                          </span>
                          <span className="flex items-center">
                            <Activity className="w-4 h-4 mr-1" />
                            Last activity: {formatDate(session.lastActivityAt)}
                          </span>
                          {session.location && (
                            <span className="flex items-center">
                              <MapPin className="w-4 h-4 mr-1" />
                              {session.location.city}, {session.location.country}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="flex items-center text-green-600 text-sm">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Active
                      </span>
                      <button
                        onClick={() => handleEndSession(session.id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
                      >
                        End Session
                      </button>
                    </div>
                  </div>
                  
                  {showDetails.has(session.id) && (
                    <div className="mt-4 pt-4 border-t border-gray-200 text-sm">
                      <div className="grid grid-cols-1 gap-2">
                        <div>
                          <span className="font-medium text-gray-700">User Agent:</span>
                          <span className="ml-2 text-gray-600 break-all">{session.userAgent}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Expires:</span>
                          <span className="ml-2 text-gray-600">{formatDate(session.expiresAt)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
            
            {activityLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No recent activity found
              </div>
            ) : (
              activityLogs.map((log) => (
                <div key={log.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="text-gray-600">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 capitalize">
                          {log.activityType.replace('_', ' ')}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            {formatDate(log.createdAt)}
                          </span>
                          {log.ipAddress && (
                            <span className="flex items-center">
                              <Globe className="w-4 h-4 mr-1" />
                              {log.ipAddress}
                            </span>
                          )}
                          {log.location && (
                            <span className="flex items-center">
                              <MapPin className="w-4 h-4 mr-1" />
                              {log.location.city}, {log.location.country}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(log.riskScore)}`}>
                        Risk: {log.riskScore}%
                      </span>
                      {log.riskScore >= 70 && (
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                  </div>
                  
                  {log.activityDetails && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                        {JSON.stringify(log.activityDetails, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};