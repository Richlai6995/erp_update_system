import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { UploadCloud, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import api from '../lib/api';

interface LogEntry {
    timestamp: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
}

interface DeploymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    requestId: string | undefined;
    onComplete?: () => void;
}

export function DeploymentModal({ isOpen, onClose, requestId, onComplete }: DeploymentModalProps) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isDeploying, setIsDeploying] = useState(false);
    const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            setLogs([]);
            setStatus('idle');
        }
    }, [isOpen]);

    const scrollToBottom = () => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [logs]);

    const startDeployment = async () => {
        if (!requestId) return;
        setIsDeploying(true);
        setStatus('running');
        setLogs([{ timestamp: new Date().toLocaleTimeString(), message: 'Initializing deployment...', type: 'info' }]);

        try {
            const res = await api.post(`/deploy/${requestId}`);
            // The backend returns the full logs at the end currently. 
            // For real-time streaming, we'd need WebSockets or SSE, but simpler is just showing the result logs.
            // Or the user might want to see progress? The backend implementation I wrote just returns logs at the end.
            // I will simulate "Connecting" then show the result logs.

            if (res.data.success) {
                // Append backend logs
                const backendLogs = res.data.logs || [];
                setLogs(prev => [...prev, ...backendLogs]);
                setStatus('completed');
                if (onComplete) onComplete();
            } else {
                setLogs(prev => [...prev, ...res.data.logs, { timestamp: new Date().toLocaleTimeString(), message: res.data.error || 'Deployment failed', type: 'error' }]);
                setStatus('failed');
            }
        } catch (error: any) {
            const errMsg = error.response?.data?.error || error.message || 'Network Error';
            const backendLogs = error.response?.data?.logs || [];
            setLogs(prev => [...prev, ...backendLogs, { timestamp: new Date().toLocaleTimeString(), message: `Deployment failed: ${errMsg}`, type: 'error' }]);
            setStatus('failed');
        } finally {
            setIsDeploying(false);
        }
    };

    // Auto-start when opened? Or Manual? User said "Button... show log window". 
    // Usually manual start is safer.

    return (
        <Modal isOpen={isOpen} onClose={status === 'running' ? () => { } : onClose} title="檔案佈署 (Deployment)" className="max-w-5xl w-full">
            <div className="space-y-4">
                <div className="h-[500px] bg-slate-900 rounded-lg p-4 overflow-y-auto font-mono text-sm leading-relaxed">
                    {logs.length === 0 && (
                        <div className="text-slate-500 italic text-center mt-20">點擊 "開始佈署" 以啟動上傳作業</div>
                    )}
                    {logs.map((log, idx) => (
                        <div key={idx} className={`flex gap-3 mb-1 ${log.type === 'error' ? 'text-red-400' :
                            log.type === 'success' ? 'text-green-400' :
                                log.type === 'warning' ? 'text-yellow-400' : 'text-slate-300'
                            }`}>
                            <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                            <span>{log.message}</span>
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    {status === 'idle' && (
                        <Button className="bg-brand-600 hover:bg-brand-700" onClick={startDeployment} disabled={isDeploying}>
                            <UploadCloud size={16} className="mr-2" /> 開始佈署 (Start Deploy)
                        </Button>
                    )}

                    {status === 'running' && (
                        <Button disabled className="bg-slate-100 text-slate-400">
                            <Loader2 size={16} className="mr-2 animate-spin" /> 佈署中...
                        </Button>
                    )}

                    {(status === 'completed' || status === 'failed') && (
                        <>
                            <Button variant="secondary" onClick={() => { setStatus('idle'); setLogs([]); startDeployment(); }}>
                                <UploadCloud size={16} className="mr-2" /> 重新佈署
                            </Button>
                            <Button variant="secondary" onClick={onClose}>
                                關閉
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </Modal>
    );
}
