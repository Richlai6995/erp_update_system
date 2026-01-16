
import React, { useState, useEffect, useRef } from 'react';
import { Terminal, X, Play, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from './ui/Alert';

interface CompilationModalProps {
    isOpen: boolean;
    onClose: () => void;
    requestId: number;
    files: any[];
    onSuccess?: () => void;
}

interface LogEntry {
    timestamp: string;
    message: string;
    type: 'info' | 'error' | 'success' | 'warning';
}

export default function CompilationModal({ isOpen, onClose, requestId, files, onSuccess }: CompilationModalProps) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [status, setStatus] = useState<'idle' | 'compiling' | 'success' | 'error'>('idle');
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom of logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    // Reset state when opened
    useEffect(() => {
        console.log('CompilationModal isOpen changed:', isOpen);
        if (isOpen) {
            setLogs([]);
            setStatus('idle');
        }
    }, [isOpen]);

    const handleCompile = async () => {
        setStatus('compiling');
        setLogs([{ timestamp: new Date().toLocaleTimeString(), message: 'Starting compilation...', type: 'info' }]);

        try {
            const token = sessionStorage.getItem('token');
            const res = await fetch(`/api/compile/${requestId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await res.json();

            if (data.logs) {
                setLogs(prev => [...prev, ...data.logs]);
            }

            if (data.success) {
                setStatus('success');
                setLogs(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), message: 'Compilation Completed Successfully.', type: 'success' }]);
                if (onSuccess) onSuccess();
            } else {
                setStatus('error');
                setLogs(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), message: `Compilation Failed: ${data.error}`, type: 'error' }]);
            }

        } catch (error: any) {
            setStatus('error');
            setLogs(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), message: `Network Error: ${error.message}`, type: 'error' }]);
        }
    };

    if (!isOpen) return null;

    const hasCompilableFiles = files.some(f =>
        f.original_name.toLowerCase().endsWith('.fmb') ||
        f.original_name.toLowerCase().endsWith('.pll')
    );

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <div className="flex items-center gap-2">
                        <div className="bg-purple-100 p-2 rounded-lg">
                            <Terminal size={20} className="text-purple-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">遠端編譯 (Remote Compilation)</h3>
                            <p className="text-xs text-slate-500">於 ERP 主機執行 .fmb (Form) 或 .pll (Library) 編譯作業</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-hidden flex flex-col gap-4">

                    {!hasCompilableFiles && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                此申請單中未發現可編譯的檔案 (.fmb 或 .pll)。
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Log Window */}
                    <div className="flex-1 bg-slate-950 rounded-lg p-4 font-mono text-sm overflow-y-auto min-h-[300px]">
                        {logs.length === 0 && (
                            <div className="text-slate-500 italic text-center mt-20">
                                準備就緒，請點擊下方按鈕開始編譯。
                            </div>
                        )}
                        {logs.map((log, idx) => (
                            <div key={idx} className={`mb-1 ${log.type === 'error' ? 'text-red-400' :
                                log.type === 'success' ? 'text-green-400' :
                                    log.type === 'warning' ? 'text-yellow-400' : 'text-slate-300'
                                }`}>
                                <span className="opacity-50 mr-2">[{log.timestamp}]</span>
                                {log.message}
                            </div>
                        ))}
                        <div ref={logsEndRef} />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t bg-slate-50 flex justify-between items-center rounded-b-lg">
                    <div className="flex gap-2 items-center">
                        {status === 'compiling' && <span className="text-xs text-blue-600 animate-pulse">正在執行編譯作業...</span>}
                        {status === 'success' && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle size={14} /> 編譯完成 (Success)</span>}
                        {status === 'error' && <span className="text-xs text-red-600 flex items-center gap-1"><AlertCircle size={14} /> 編譯失敗 (Failed)</span>}
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                        >
                            關閉
                        </button>

                        {(status === 'idle' || status === 'error' || status === 'success') && hasCompilableFiles && (
                            <button
                                onClick={handleCompile}
                                disabled={status === 'compiling'}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {status === 'idle' ? <Play size={16} /> : <RefreshCw size={16} />}
                                {status === 'idle' ? '開始編譯 (Compile)' : '重新編譯 (Re-Compile)'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
