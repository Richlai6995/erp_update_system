import React, { useState, useEffect } from 'react';
import { ArrowLeft, Edit, Save, Trash2, CheckCircle, XCircle, Clock, FileText, Download, RotateCcw, Send, Play, Paperclip, Terminal, Upload, CheckSquare, AlertCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import api from '../lib/api';

interface RequestDetailViewProps {
    project: any;
    user: any;
    onUpdate: () => void;
}

export const RequestDetailView: React.FC<RequestDetailViewProps> = ({ project, user, onUpdate }) => {
    const [files, setFiles] = useState<any[]>([]);
    const [approvals, setApprovals] = useState<any[]>([]);
    const [description, setDescription] = useState(''); // File description
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
    const [actionComment, setActionComment] = useState('');
    const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
    const [dbaComment, setDbaComment] = useState(project.dba_comment || '');

    useEffect(() => {
        if (project?.id) {
            fetchDetails();
        }
    }, [project]);

    const fetchDetails = async () => {
        try {
            // Get Files
            const resFiles = await api.get(`/files/project/${project.id}`);
            setFiles(resFiles.data);

            // Get Metadata (Approvals) -- Assuming project prop might be stale or incomplete
            const resMeta = await api.get(`/projects/${project.id}`);
            setApprovals(resMeta.data.approvals || []);
            setDbaComment(resMeta.data.dba_comment || '');
        } catch (e) {
            console.error(e);
        }
    };

    const handleFileUpload = async () => {
        if (!uploadFile) return;
        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('projectId', project.id);
        formData.append('description', description);

        try {
            await api.post('/files/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setIsUploadModalOpen(false);
            setUploadFile(null);
            setDescription('');
            fetchDetails();
        } catch (e) {
            alert('上傳失敗');
        }
    };

    const handleDeleteFile = async (fileId: number) => {
        if (!confirm('確認刪除此檔案?')) return;
        try {
            await api.delete(`/files/${fileId}`);
            fetchDetails();
        } catch (e) {
            alert('刪除失敗');
        }
    };

    const handleSubmit = async () => {
        if (!confirm('確認送出簽核? 送出後無法修改檔案。')) return;
        try {
            await api.post(`/projects/${project.id}/submit`);
            alert('已送出簽核');
            onUpdate();
        } catch (e: any) {
            alert('送出失敗: ' + (e.response?.data?.error || e.message));
        }
    };

    const handleApprovalAction = async () => {
        if (!actionType) return;
        try {
            await api.post(`/projects/${project.id}/approve`, {
                action: actionType,
                comment: actionComment
            });
            setIsApprovalModalOpen(false);
            alert(actionType === 'approve' ? '已核准' : '已退回');
            onUpdate();
        } catch (e: any) {
            alert('操作失敗: ' + (e.response?.data?.error || e.message));
        }
    };

    const handleDbaUpdate = async (status?: string) => {
        try {
            await api.put(`/projects/${project.id}/dba`, {
                dba_comment: dbaComment,
                status: status
            });
            if (status) alert('狀態已更新');
            onUpdate();
        } catch (e: any) {
            alert('更新失敗: ' + (e.response?.data?.error || e.message));
        }
    };

    // Calculate Progress
    const steps = ['Draft', 'Review', 'Approved', 'Deployed'];
    const currentStepIndex =
        project.status === 'draft' ? 0 :
            project.status === 'review' ? 1 :
                project.status === 'approved' ? 2 :
                    project.status === 'deployed' ? 3 :
                        project.status === 'rejected' ? 1 : 0; // Rejected stays at review visually or red?

    const getStatusColor = (index: number) => {
        if (project.status === 'rejected' && index === 1) return 'bg-red-500';
        if (index < currentStepIndex) return 'bg-green-500';
        if (index === currentStepIndex) return 'bg-blue-600';
        return 'bg-gray-300';
    };

    // Check if current user is an approver & it's their turn
    const isMyTurn = project.status === 'review' && approvals.some(a => a.user_id === user.id && a.status === 'pending' && (
        // It's checked by backend, but for UI visibility:
        // We can just check if I am the FIRST pending one.
        a.id === approvals.filter(x => x.status === 'pending').sort((p, q) => p.step_order - q.step_order)[0]?.id
    ));

    return (
        <div className="h-full flex flex-col bg-white">
            {/* Header / Status Bar */}
            <div className="p-6 border-b">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            {project.code}
                            <span className="text-sm font-normal px-2 py-1 bg-slate-100 rounded text-slate-600 border">
                                {project.program_type}
                            </span>
                        </h1>
                        <p className="text-slate-500 mt-1">{project.description}</p>
                    </div>
                    {/* Status Steps */}
                    <div className="flex items-center gap-2">
                        {steps.map((step, idx) => (
                            <React.Fragment key={step}>
                                <div className={`px-4 py-2 rounded-full text-white text-sm font-medium ${getStatusColor(idx)}`}>
                                    {step === 'Review' && project.status === 'rejected' ? 'Rejected' : step}
                                </div>
                                {idx < steps.length - 1 && <div className="w-8 h-1 bg-gray-200" />}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Main Info Grid */}
                <div className="grid grid-cols-4 gap-4 text-sm bg-slate-50 p-4 rounded-lg border">
                    <div>
                        <label className="block text-slate-500 mb-1">申請者</label>
                        <div className="font-medium">{project.manager_name}</div>
                    </div>
                    <div>
                        <label className="block text-slate-500 mb-1">模組</label>
                        <div className="font-medium">{project.module_code} - {project.module_name}</div>
                    </div>
                    <div>
                        <label className="block text-slate-500 mb-1">申請日期</label>
                        <div className="font-medium">{new Date(project.created_at).toLocaleDateString()}</div>
                    </div>
                    <div>
                        <label className="block text-slate-500 mb-1">目前狀態</label>
                        <div className="font-medium uppercase">{project.status}</div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex">
                {/* Left: File List */}
                <div className="flex-1 p-6 overflow-y-auto border-r">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <FileText size={20} /> 申請檔案
                        </h3>
                        {project.status === 'draft' && (user.id === project.manager_id || user.role === 'admin') && (
                            <Button size="sm" onClick={() => setIsUploadModalOpen(true)}>
                                <Upload size={16} className="mr-2" /> 新增檔案
                            </Button>
                        )}

                        {/* Terminal Access Button */}
                        {project.program_type === 'Terminal Access' && project.status === 'approved' && (
                            <Button onClick={() => window.open(`/terminal/${project.id}`, '_blank')} className="bg-black hover:bg-slate-800 text-white">
                                <Terminal size={16} className="mr-2" /> 開啟終端機 (SQL Web Terminal)
                            </Button>
                        )}
                    </div>

                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-100 text-left text-sm text-slate-600">
                                <th className="p-3 border-b">檔案名稱</th>
                                <th className="p-3 border-b">說明</th>
                                <th className="p-3 border-b w-32">大小</th>
                                <th className="p-3 border-b w-24">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {files.map(f => (
                                <tr key={f.id} className="border-b hover:bg-slate-50">
                                    <td className="p-3">
                                        <div className="font-medium text-blue-600 underline cursor-pointer" onClick={() => window.open(api.getUri() + `/files/${f.id}/download`, '_blank')}>
                                            {f.original_name}
                                        </div>
                                    </td>
                                    <td className="p-3 text-sm text-slate-600">{f.description}</td>
                                    <td className="p-3 text-sm text-slate-500">{(f.size / 1024).toFixed(1)} KB</td>
                                    <td className="p-3">
                                        {project.status === 'draft' && (
                                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDeleteFile(f.id)}>
                                                <Trash2 size={16} />
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {files.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-slate-400">尚無檔案</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Right: Actions & Metadata */}
                <div className="w-80 bg-slate-50 p-6 overflow-y-auto flex flex-col gap-6">

                    {/* Actions */}
                    <div className="space-y-3">
                        <h3 className="font-bold text-slate-700">操作</h3>

                        {/* Applicant Actions */}
                        {project.status === 'draft' && (user.id === project.manager_id || user.role === 'admin') && (
                            <Button className="w-full" onClick={handleSubmit}>
                                <Send size={16} className="mr-2" /> 送出簽核
                            </Button>
                        )}

                        {/* Approver Actions */}
                        {isMyTurn && (
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="font-medium text-blue-800 mb-2">輪到您簽核</div>
                                <div className="flex gap-2">
                                    <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => { setActionType('approve'); setIsApprovalModalOpen(true); }}>
                                        核准
                                    </Button>
                                    <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={() => { setActionType('reject'); setIsApprovalModalOpen(true); }}>
                                        退回
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* DBA Actions */}
                        {user.role === 'admin' && project.status === 'approved' && (
                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <div className="font-medium text-yellow-800 mb-2">DBA 操作</div>
                                <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={() => handleDbaUpdate('deployed')}>
                                    <CheckSquare size={16} className="mr-2" /> 設定為已上線
                                </Button>
                            </div>
                        )}
                        {user.role === 'admin' && project.status === 'deployed' && (
                            <div className="text-center text-green-600 font-bold border p-2 bg-green-50 rounded">
                                已上線
                            </div>
                        )}
                    </div>

                    {/* Approval Status */}
                    <div>
                        <h3 className="font-bold text-slate-700 mb-3">簽核狀態</h3>
                        <div className="space-y-3">
                            {approvals.map((app, idx) => (
                                <div key={app.id} className={`p-3 rounded border text-sm relative ${app.status === 'pending' ? 'bg-white' : app.status === 'approved' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                    <div className="flex justify-between font-medium">
                                        <span>{app.username}</span>
                                        <span className={`px-2 py-0.5 rounded text-xs ${app.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                            app.status === 'approved' ? 'bg-green-200 text-green-800' :
                                                'bg-red-200 text-red-800'
                                            }`}>{app.status}</span>
                                    </div>
                                    {app.comment && (
                                        <div className="mt-2 text-slate-600 bg-white p-2 rounded border border-slate-100 italic">
                                            "{app.comment}"
                                        </div>
                                    )}
                                    {app.updated_at && (
                                        <div className="text-xs text-slate-400 mt-1 text-right">
                                            {new Date(app.updated_at).toLocaleString()}
                                        </div>
                                    )}
                                    <div className="absolute -left-3 top-3 w-6 h-6 rounded-full flex items-center justify-center bg-white border text-xs text-slate-500 font-bold">
                                        {idx + 1}
                                    </div>
                                </div>
                            ))}
                            {approvals.length === 0 && <div className="text-slate-400 text-sm italic">尚無簽核資料 (Draft)</div>}
                        </div>
                    </div>

                    {/* DBA Comment */}
                    <div>
                        <h3 className="font-bold text-slate-700 mb-2">DBA 意見</h3>
                        {user.role === 'admin' ? (
                            <div className="flex flex-col gap-2">
                                <textarea
                                    className="w-full p-2 border rounded text-sm h-24"
                                    placeholder="輸入 DBA 意見..."
                                    value={dbaComment}
                                    onChange={e => setDbaComment(e.target.value)}
                                    onBlur={() => handleDbaUpdate()} // Auto save on blur
                                />
                                <div className="text-xs text-slate-400 text-right">離開輸入框即自動儲存</div>
                            </div>
                        ) : (
                            <div className="p-3 bg-slate-100 rounded text-sm text-slate-700 min-h-[60px] whitespace-pre-wrap">
                                {dbaComment || '無'}
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {/* Upload Modal */}
            <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} title="新增檔案">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">選擇檔案</label>
                        <Input type="file" onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUploadFile(e.target.files?.[0] || null)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">檔案說明 (選填)</label>
                        <Input value={description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)} placeholder="例如: 規格書 v1.0" />
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="ghost" onClick={() => setIsUploadModalOpen(false)}>取消</Button>
                        <Button onClick={handleFileUpload} disabled={!uploadFile}>上傳</Button>
                    </div>
                </div>
            </Modal>

            {/* Approval Modal */}
            <Modal isOpen={isApprovalModalOpen} onClose={() => setIsApprovalModalOpen(false)} title={actionType === 'approve' ? "核准" : "退回"}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">簽核意見 (必填)</label>
                        <textarea
                            className="w-full p-2 border rounded"
                            rows={4}
                            value={actionComment}
                            onChange={e => setActionComment(e.target.value)}
                        />
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="ghost" onClick={() => setIsApprovalModalOpen(false)}>取消</Button>
                        <Button
                            variant={actionType === 'approve' ? 'primary' : 'danger'}
                            onClick={handleApprovalAction}
                            disabled={!actionComment.trim()}
                        >
                            確認{actionType === 'approve' ? "核准" : "退回"}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
