import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import api from '../lib/api';

interface ScheduleLogsModalProps {
    isOpen: boolean;
    onClose: () => void;
    scheduleId: number;
    scheduleName: string; // or template name
}

export const ScheduleLogsModal: React.FC<ScheduleLogsModalProps> = ({ isOpen, onClose, scheduleId, scheduleName }) => {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && scheduleId) {
            fetchLogs();
        }
    }, [isOpen, scheduleId]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/mail/logs/schedule/${scheduleId}`);
            setLogs(res.data || []);
        } catch (e) {
            console.error("Failed to fetch logs", e);
            setLogs([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`執行紀錄 - ${scheduleName || 'Schedule #' + scheduleId}`}
            footer={<Button onClick={onClose}>關閉</Button>}
            className="max-w-4xl w-full"
        >
            <div className="bg-white border rounded-lg overflow-hidden flex flex-col h-[500px]">
                <div className="bg-slate-50 px-4 py-2 border-b font-medium text-sm text-slate-700 flex justify-between items-center flex-shrink-0">
                    <span>寄信紀錄 (由新到舊)</span>
                    <Button size="sm" variant="ghost" onClick={fetchLogs} isLoading={loading}>重新整理</Button>
                </div>
                <div className="overflow-auto flex-1">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-slate-50 border-b sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-2 w-32">時間</th>
                                <th className="px-4 py-2 w-32">結果</th>
                                <th className="px-4 py-2">訊息</th>
                                <th className="px-4 py-2 w-48">收件人</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {logs.map((log: any) => (
                                <tr key={log.id}>
                                    <td className="px-4 py-2 text-slate-500 text-xs">
                                        {new Date(log.created_at.endsWith('Z') ? log.created_at : log.created_at + 'Z').toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2">
                                        <span className={`px-2 py-0.5 rounded text-xs ${log.status === 'success' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                            {log.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-slate-600 max-w-[300px] truncate" title={log.message}>
                                        {log.message}
                                    </td>
                                    <td className="px-4 py-2 text-slate-500 text-xs max-w-[200px] truncate" title={log.recipient}>
                                        {log.recipient}
                                    </td>
                                </tr>
                            ))}
                            {!loading && logs.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="text-center py-8 text-slate-400">
                                        此排程尚無寄信紀錄。
                                    </td>
                                </tr>
                            )}
                            {loading && logs.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="text-center py-8 text-slate-400">
                                        載入中...
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Modal>
    );
};
