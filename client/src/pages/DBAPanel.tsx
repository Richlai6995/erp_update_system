import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Play, Server, FileCode, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import api from '../lib/api';

interface DBAPanelProps {
    projectId: number;
    projectCode?: string;
}

interface LogEntry {
    timestamp: string;
    message: string;
    type: 'info' | 'error' | 'success';
}

export const DBAPanel: React.FC<DBAPanelProps> = ({ projectId, projectCode }) => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isExecuting, setIsExecuting] = useState(false);
    const [deploymentStatus, setDeploymentStatus] = useState({
        dev: 'pending', // pending, success, error
        test: 'pending',
        prod: 'pending'
    });
    const logsEndRef = useRef<HTMLDivElement>(null);

    const addLog = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
        setLogs(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), message, type }]);
    };

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const handleAction = async (action: string, target?: string) => {
        if (isExecuting) return;
        setIsExecuting(true);
        addLog(`Starting ${action}...`, 'info');

        try {
            const res = await api.post(`/projects/${projectId}/deploy`, { action, target });

            // Simulation of streaming logs would ideally use a WebSocket or SSE
            // Here we just display the returned logs/result
            if (res.data.logs) {
                res.data.logs.forEach((log: string) => addLog(log, 'info'));
            }

            addLog(`${action} completed successfully.`, 'success');

            if (action === 'upload' && target) {
                setDeploymentStatus(prev => ({ ...prev, [target]: 'success' }));
            }

        } catch (error: any) {
            addLog(`Error: ${error.response?.data?.error || error.message}`, 'error');
            if (action === 'upload' && target) {
                setDeploymentStatus(prev => ({ ...prev, [target]: 'error' }));
            }
        } finally {
            setIsExecuting(false);
        }
    };

    return (
        <div className="bg-slate-900 text-slate-200 rounded-xl overflow-hidden flex flex-col h-[600px] shadow-2xl border border-slate-700">
            {/* Header */}
            <div className="bg-slate-800 p-4 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-lg">
                        <Terminal size={20} className="text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-lg">DBA Execution Panel</h3>
                        <p className="text-xs text-slate-400 font-mono">Project: {projectCode || `ID #${projectId}`}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="text-xs flex items-center gap-1.5 bg-slate-700 px-3 py-1.5 rounded-full">
                        <div className={`w-2 h-2 rounded-full ${isExecuting ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`}></div>
                        {isExecuting ? 'Processing...' : 'Ready'}
                    </div>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Controls Sidebar */}
                <div className="w-64 bg-slate-800/50 p-4 border-r border-slate-700 flex flex-col gap-6 overflow-y-auto">

                    {/* Deployment Section */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <Server size={14} /> Deployment
                        </h4>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between bg-slate-800 p-2 rounded border border-slate-700">
                                <span className="text-sm">Dev Server</span>
                                {deploymentStatus.dev === 'success' && <CheckCircle size={14} className="text-green-500" />}
                                {deploymentStatus.dev === 'error' && <XCircle size={14} className="text-red-500" />}
                            </div>
                            <Button
                                variant="secondary"
                                size="sm"
                                className="w-full justify-start text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600"
                                onClick={() => handleAction('upload', 'dev')}
                                disabled={isExecuting}
                            >
                                <Play size={12} className="mr-2" /> Upload to Dev
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between bg-slate-800 p-2 rounded border border-slate-700">
                                <span className="text-sm">Test Server</span>
                                {deploymentStatus.test === 'success' && <CheckCircle size={14} className="text-green-500" />}
                                {deploymentStatus.test === 'error' && <XCircle size={14} className="text-red-500" />}
                            </div>
                            <Button
                                variant="secondary"
                                size="sm"
                                className="w-full justify-start text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600"
                                onClick={() => handleAction('upload', 'test')}
                                disabled={isExecuting}
                            >
                                <Play size={12} className="mr-2" /> Upload to Test
                            </Button>
                        </div>
                    </div>

                    <div className="h-px bg-slate-700"></div>

                    {/* Compilation Section */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <FileCode size={14} /> Compilation
                        </h4>
                        <Button
                            variant="secondary"
                            size="sm"
                            className="w-full justify-start text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600"
                            onClick={() => handleAction('compile', 'form')}
                            disabled={isExecuting}
                        >
                            <Play size={12} className="mr-2" /> Compile Forms (fmx)
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            className="w-full justify-start text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600"
                            onClick={() => handleAction('compile', 'report')}
                            disabled={isExecuting}
                        >
                            <Play size={12} className="mr-2" /> Compile Reports (rep)
                        </Button>
                    </div>

                    <div className="mt-auto pt-4 border-t border-slate-700">
                        <div className="p-3 bg-blue-900/20 border border-blue-800/50 rounded-lg">
                            <div className="flex items-start gap-2">
                                <AlertTriangle size={14} className="text-blue-400 mt-0.5" />
                                <p className="text-[10px] text-blue-300 leading-relaxed">
                                    Performing these actions will modify files on the remote server. Ensure you have backups.
                                </p>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Log Output Area */}
                <div className="flex-1 bg-black p-4 font-mono text-sm overflow-y-auto">
                    {logs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600">
                            <Terminal size={48} className="mb-4 opacity-20" />
                            <p>Ready for execution. Logs will appear here.</p>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {logs.map((log, index) => (
                                <div key={index} className="flex items-start gap-3 hover:bg-white/5 p-1 rounded transition-colors">
                                    <span className="text-xs text-slate-500 shrink-0 select-none">{log.timestamp}</span>
                                    <span className={`break-all ${log.type === 'error' ? 'text-red-400' :
                                            log.type === 'success' ? 'text-green-400' :
                                                'text-slate-300'
                                        }`}>
                                        {log.type === 'success' && <span className="mr-2">✓</span>}
                                        {log.type === 'error' && <span className="mr-2">✗</span>}
                                        {log.type === 'info' && <span className="mr-2 text-blue-400">➜</span>}
                                        {log.message}
                                    </span>
                                </div>
                            ))}
                            <div ref={logsEndRef} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
