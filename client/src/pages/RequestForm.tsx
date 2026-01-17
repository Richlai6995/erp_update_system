import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ArrowLeft, Upload, X, File, Save, CheckCircle, Send, Clock, User, MessageSquare, ThumbsUp, ThumbsDown, Globe, Edit3, UploadCloud, GripVertical } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/ui/Modal';
import { DeploymentModal } from '../components/DeploymentModal';
import CompilationModal from '../components/CompilationModal';
import { Terminal } from 'lucide-react';
import { Reorder } from 'framer-motion';

interface Module { id: number; name: string; code: string; }
interface FileItem {
    id?: number;
    sequence?: number;
    filename: string;
    original_name: string;
    description: string;
    file_path?: string;
    db_object_type?: string;
    file_version?: string; // 'new' | 'update'
    db_object_name?: string;
    db_schema_name?: string;
    is_backup?: number; // 0 or 1
    backup_file_path?: string;
    compiled_at?: string;
    compile_status?: string;
    deployed_at?: string;
    deploy_status?: string;
    uploaded_at?: string;
    backup_at?: string;
}
interface DBObjectType { id: number; name: string; }
interface ReviewLog { id: number; reviewer_name: string; action: string; comment: string; reviewed_at: string; }

interface NewFileItem {
    file: File;
    description: string;
    versionType: 'new' | 'update';
    dbObjectType: string;
    dbObjectName: string;
    dbSchemaName: string;
    isBackup: boolean;
    backupFilePath?: string;
    fileVersion?: string; // legacy support for selector if needed, but we use versionType
}

export default function RequestForm() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    // Form State
    const [modules, setModules] = useState<Module[]>([]);
    const [dbObjectTypes, setDbObjectTypes] = useState<DBObjectType[]>([]);
    const [moduleId, setModuleId] = useState<number | ''>('');
    const [programType, setProgramType] = useState('Form');
    const [dbObjectType, setDbObjectType] = useState('Table'); // For main request (if applicable)
    const [description, setDescription] = useState('');
    const [agentFlowId, setAgentFlowId] = useState('');
    const [status, setStatus] = useState('draft');
    // Copy Modal State
    const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
    const [copyFormId, setCopyFormId] = useState('');
    const [copyOptions, setCopyOptions] = useState<string[]>([]);
    const [formId, setFormId] = useState('');
    const [dbaComment, setDbaComment] = useState('');
    const [applicantName, setApplicantName] = useState('');
    const [applyDate, setApplyDate] = useState('');
    const [existingFiles, setExistingFiles] = useState<FileItem[]>([]);
    const [newFiles, setNewFiles] = useState<NewFileItem[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [reviews, setReviews] = useState<ReviewLog[]>([]);

    // New State for Checked
    const [hasTested, setHasTested] = useState(false);
    const [canApprove, setCanApprove] = useState(false);

    // Inputs for Actions
    const [reviewComment, setReviewComment] = useState('');

    // UI State
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
    const [isCompileModalOpen, setIsCompileModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isReadOnly, setIsReadOnly] = useState(false);

    useEffect(() => {
        fetchBasicSettings();
        if (id) fetchRequest(id);
        else {
            setApplyDate(new Date().toISOString());
            if (user) setApplicantName(user.name);
        }
    }, [id, user]);

    const fetchBasicSettings = async () => {
        try {
            const mods = await api.get('/erp-modules');
            setModules(mods.data);
            const dbTypes = await api.get('/admin/settings/db-object-types');
            setDbObjectTypes(dbTypes.data || []);
        } catch (e) { console.error(e); }
    };

    const fetchRequest = async (reqId: string) => {
        try {
            const res = await api.get(`/requests/${reqId}`);
            const data = res.data;
            setModuleId(data.module_id);
            setProgramType(data.program_type);
            setDbObjectType(data.db_object_type || ''); // Type for whole request if consistent
            setDescription(data.description || '');
            setAgentFlowId(data.agent_flow_id || '');
            setFormId(data.form_id);
            setStatus(data.status);
            setDbaComment(data.dba_comment || '');
            setExistingFiles(data.files || []);
            setReviews(data.reviews || []);
            setApplicantName(data.applicant_name);
            setApplyDate(data.apply_date);
            setHasTested(data.has_tested === 1);
            setCanApprove(data.can_approve === true);

            if (data.status !== 'draft' && data.status !== 'manager_rejected' && data.status !== 'dba_rejected') setIsReadOnly(true);
            else setIsReadOnly(false);
        } catch (e) { console.error(e); navigate('/requests'); }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const added: NewFileItem[] = [];
            Array.from(e.target.files).forEach(f => added.push({
                file: f,
                description: '',
                versionType: 'update',
                dbObjectType: '', // Default empty, user must choose if DB Object
                dbObjectName: '',
                dbSchemaName: '',
                isBackup: false
            }));
            setNewFiles([...newFiles, ...added]);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleNewFileDescChange = (index: number, val: string) => {
        const copy = [...newFiles]; copy[index].description = val; setNewFiles(copy);
    };
    // Add Handler for Existing Files
    const handleExistingFileChange = (id: number, field: keyof FileItem, value: any) => {
        setExistingFiles(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
    };

    const removeNewFile = (idx: number) => {
        const copy = [...newFiles]; copy.splice(idx, 1); setNewFiles(copy);
    };
    const removeExistingFile = async (fileId: number) => {
        if (!confirm('確認刪除?')) return;
        try { await api.delete(`/uploads/${fileId}`); setExistingFiles(existingFiles.filter(f => f.id !== fileId)); } catch (e) { alert('Failed'); }
    };

    // Auto Backup Handler
    const handleAutoBackup = async (index: number) => {
        const item = newFiles[index];
        if (!item.dbObjectType || !item.dbObjectName || !item.dbSchemaName) {
            return alert('請填寫物件類別、物件名稱與 Schema 名稱');
        }
        setIsLoading(true);
        try {
            // alert(`Requesting backup: ${item.dbSchemaName}.${item.dbObjectName}`);
            const res = await api.post('/oracle/backup-ddl', {
                schemaName: item.dbSchemaName,
                objectName: item.dbObjectName,
                objectType: item.dbObjectType
            });

            if (res.data.success) {
                const copy = [...newFiles];
                copy[index].isBackup = true;
                copy[index].backupFilePath = res.data.filePath;
                setNewFiles(copy);
                alert('自動備份成功: ' + res.data.fileName);
            }
        } catch (e: any) {
            alert('備份失敗: ' + (e.response?.data?.error || e.message));
        } finally {
            setIsLoading(false);
        }
    };

    // Manual Backup Handler
    const handleManualBackup = async (index: number, backupFile: File) => {
        const formData = new FormData();
        formData.append('file', backupFile);
        setIsLoading(true);
        try {
            const res = await api.post('/oracle/manual-backup', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.success) {
                const copy = [...newFiles];
                copy[index].isBackup = true;
                copy[index].backupFilePath = res.data.filePath;
                setNewFiles(copy);
                alert('手動備份上傳成功');
            }
        } catch (e) {
            alert('上傳失敗');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveOrSubmit = async (action: 'save' | 'submit') => {
        if (!moduleId) return alert('請選擇模組');
        if (programType === 'DB Object') {
            // Check New Files
            const missingType = newFiles.some(f => !f.dbObjectType);
            if (missingType) return alert('當程式類別為 DB Object 時，所有上傳檔案都必須選擇物件類別 (Object Type)');

            const missingInfo = newFiles.some(f => !f.dbObjectName || !f.dbSchemaName);
            if (missingInfo) return alert('請完整填寫 Object 名稱與 Schema 名稱');

            // STRICT VALIDATION for "Update Old Program" -> Must have Backup
            // Check New Files
            const newFilesMissingBackup = newFiles.some(f => f.versionType === 'update' && !f.isBackup);
            // Check Existing Files
            const existingFilesMissingBackup = existingFiles.some(f => f.file_version === 'update' && f.is_backup !== 1);

            if (newFilesMissingBackup || existingFilesMissingBackup) {
                return alert('更新舊程式 務必備份完成才可送簽');
            }
        }
        if (action === 'submit' && !hasTested) return alert('請確認已在測試環境完成測試');

        setIsLoading(true);
        try {
            let reqId = id;
            const payload = {
                module_id: Number(moduleId),
                program_type: programType,
                db_object_type: programType === 'DB Object' ? dbObjectType : null, // Main type (legacy use) or specific?
                description,
                agent_flow_id: agentFlowId,
                has_tested: hasTested
            };

            if (!reqId) {
                const res = await api.post('/requests', payload);
                reqId = res.data.id;
            } else {
                await api.put(`/requests/${reqId}`, payload);
            }

            if (newFiles.length > 0 && reqId) {
                const formData = new FormData();
                newFiles.forEach((item) => {
                    formData.append('files', item.file);
                    formData.append('descriptions', item.description);
                    formData.append('dbObjectTypes', item.dbObjectType || '');
                    formData.append('fileVersions', item.versionType); // 'new' or 'update'
                    formData.append('dbObjectNames', item.dbObjectName || '');
                    formData.append('dbSchemaNames', item.dbSchemaName || '');
                    formData.append('isBackups', String(item.isBackup));
                    formData.append('backupFilePaths', item.backupFilePath || '');
                });
                await api.post(`/uploads/${reqId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                setNewFiles([]);
            }

            // Update existing files order/metadata
            if (existingFiles.length > 0 && reqId) {
                await api.put(`/requests/${reqId}/files`, {
                    files: existingFiles.map((f, index) => ({
                        ...f,
                        sequence: index + 1 // Ensure 1-based sequence
                    }))
                });
            }

            if (reqId) await fetchRequest(reqId);

            if (action === 'submit' && reqId) {
                if (confirm('確定要送出簽核嗎?')) {
                    await api.put(`/requests/${reqId}/status`, { action: 'submit' });
                    navigate('/requests');
                } else if (!id) navigate(`/requests/${reqId}`);
                else window.location.reload();
            } else {
                if (!id) navigate(`/requests/${reqId}`);
                else { setNewFiles([]); fetchRequest(reqId as string); alert('已儲存'); }
            }
        } catch (e) { alert('Operation failed'); } finally { setIsLoading(false); }
    };

    const handleReviewAction = async (action: 'approve' | 'reject' | 'online') => {
        if (!id) return;

        let comment = reviewComment;
        if (action === 'online') {
            if (!comment) return alert('請輸入回覆 (必要)');
        } else if (action === 'reject') {
            if (!comment) return alert('請輸入退回原因 (必要)');
        }

        setIsLoading(true);
        try {
            await api.put(`/requests/${id}/status`, { action, comment });
            alert('操作成功');
            window.location.reload();
        } catch (e) {
            alert('操作失敗');
        } finally {
            setIsLoading(false);
        }
    };

    // Implement Copy Logic
    const handleOpenCopyModal = async () => {
        try {
            const res = await api.get('/requests/options');
            setCopyOptions(res.data.form_ids || []);
            setIsCopyModalOpen(true);
        } catch (e) {
            alert('無法載入單據列表');
        }
    };

    const handleCopyRequest = async () => {
        if (!copyFormId) return alert('請選擇單據');
        setIsLoading(true);
        try {
            // Find ID from form_id? Wait, options only gave form_id. 
            // We need to find the ID. But /requests/options returns strings. 
            // Actually /requests API filter by form_id allows us to find it, or we iterate options if they had IDs.
            // Let's assume we search by form_id using the list API first to get ID, or better:
            // The user inputs a Form ID. We can use `GET /requests?form_id=...` to find it.
            const resSearch = await api.get(`/requests?form_id=${copyFormId}&page=1&limit=1`);
            // Check if response is array or object with data
            const target = Array.isArray(resSearch.data) ? resSearch.data[0] : resSearch.data?.data?.[0];
            if (!target) {
                alert('找不到該單據');
                setIsLoading(false);
                return;
            }

            // Fetch full details
            const res = await api.get(`/requests/${target.id}`);
            const data = res.data;

            // Populate Form
            setModuleId(data.module_id);
            setProgramType(data.program_type);
            setDbObjectType(data.db_object_type || (data.program_type === 'DB Object' ? 'Table' : ''));
            setDescription(data.description || '');
            setAgentFlowId(data.agent_flow_id || '');
            setHasTested(data.has_tested === 1);

            // Clear files is implicit as we ignore them.
            setNewFiles([]);
            setExistingFiles([]);

            setIsCopyModalOpen(false);
            alert('已複製單據內容 (不含檔案與簽核紀錄)');
        } catch (e) {
            console.error(e);
            alert('複製失敗');
        } finally {
            setIsLoading(false);
        }
    };

    // Helper
    const getStatusLabel = (s: string) => {
        const map: any = {
            draft: '開立 (Open)',
            reviewing: '簽核中 (Reviewing)',
            approved: '已核准 (Approved)',
            online: '已上線 (Online)',
            void: '已作廢 (Void)',
            manager_rejected: '主管退回 (Manager Rejected)',
            dba_rejected: 'DBA 退回 (DBA Rejected)'
        };
        return map[s] || s;
    };
    const getStatusColor = (s: string) => {
        const map: any = {
            draft: 'bg-slate-100 text-slate-600',
            reviewing: 'bg-blue-100 text-blue-700',
            approved: 'bg-purple-100 text-purple-700',
            online: 'bg-green-100 text-green-700',
            void: 'bg-gray-100 text-gray-400',
            manager_rejected: 'bg-red-100 text-red-700',
            dba_rejected: 'bg-red-100 text-red-700'
        };
        return map[s] || 'bg-slate-100';
    };

    const sortedReviews = [...reviews]
        .filter(r => r.action !== 'online') // Hide DBA actions
        .sort((a, b) => new Date(a.reviewed_at).getTime() - new Date(b.reviewed_at).getTime());

    return (
        <div className="max-w-4xl mx-auto p-6 pb-32">
            <div className="flex justify-between items-center mb-4">
                <Button variant="ghost" onClick={() => navigate('/requests')}>
                    <ArrowLeft size={16} className="mr-2" /> 返回列表
                </Button>
                {!id && (
                    <Button variant="secondary" onClick={handleOpenCopyModal}>
                        <File size={16} className="mr-2" /> 從舊單據複製...
                    </Button>
                )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-8">
                {/* Header Info */}
                <div className="border-b border-slate-100 pb-4 flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-2xl font-bold text-slate-900">
                                {id ? `申請單: ${formId}` : '建立新申請單'}
                            </h1>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(status)}`}>
                                {getStatusLabel(status)}
                            </span>
                        </div>
                        <div className="flex gap-6 text-sm text-slate-500">
                            <div className="flex items-center gap-1"><User size={14} /> 申請人: <span className="text-slate-900 font-medium">{applicantName || user?.name}</span></div>
                            <div className="flex items-center gap-1"><Clock size={14} /> 申請日期: <span className="text-slate-900 font-medium">{applyDate ? new Date(applyDate).toLocaleString('zh-TW', { hour12: false }) : new Date().toLocaleString('zh-TW', { hour12: false })}</span></div>
                        </div>
                    </div>
                    {/* Review Status Button */}
                    {id && status !== 'draft' && (
                        <Button variant="secondary" size="sm" onClick={() => setIsReviewModalOpen(true)}>
                            <CheckCircle size={16} className="mr-2 text-brand-600" /> 查看簽核狀態
                        </Button>
                    )}
                </div>

                {/* Main Form (Inputs) */}
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">模組 (Module)</label>
                        <select
                            disabled={isReadOnly}
                            className="w-full h-10 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm disabled:bg-slate-50"
                            value={moduleId}
                            onChange={(e) => setModuleId(e.target.value as any)}
                        >
                            <option value="">請選擇...</option>
                            {modules.map(m => <option key={m.id} value={m.id}>{m.code} - {m.name}</option>)}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">程式類別 (Type)</label>
                        <select
                            disabled={isReadOnly}
                            className="w-full h-10 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm disabled:bg-slate-50"
                            value={programType}
                            onChange={(e) => setProgramType(e.target.value)}
                        >
                            <option value="Form">Form</option>
                            <option value="Report">Report</option>
                            <option value="SQL">SQL</option>
                            <option value="Library">Library</option>
                            <option value="DB Object">DB Object</option>
                        </select>
                    </div>

                    <div className="col-span-2 space-y-1">
                        <label className="text-sm font-medium text-slate-700">Notes 單號 (Optional)</label>
                        <Input
                            disabled={isReadOnly}
                            placeholder="請輸入 Notes 單號..."
                            value={agentFlowId}
                            onChange={e => setAgentFlowId(e.target.value)}
                            maxLength={30}
                        />
                    </div>

                    <div className="col-span-2 space-y-1">
                        <label className="text-sm font-medium text-slate-700">申請說明</label>
                        <textarea
                            disabled={isReadOnly}
                            className="w-full min-h-[100px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm disabled:bg-slate-50"
                            placeholder="請輸入申請說明..."
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>
                </div>

                <div className="col-span-2">
                    <label className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            disabled={isReadOnly}
                            checked={hasTested}
                            onChange={e => setHasTested(e.target.checked)}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-slate-700">已經於測試環境完成測試 (Tested in Test Environment)</span>
                    </label>
                </div>

                {/* File Upload Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-slate-800">程式檔案 (Files)</h3>
                        {!isReadOnly && (
                            <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                                <Upload size={16} className="mr-2" /> 新增檔案
                            </Button>
                        )}
                        <input type="file" ref={fileInputRef} multiple className="hidden" onChange={handleFileSelect} />
                    </div>

                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                        <Reorder.Group axis="y" values={existingFiles} onReorder={setExistingFiles} className="space-y-0">
                            {existingFiles.map((file, index) => (
                                <Reorder.Item key={file.id} value={file} className="bg-slate-50 border-b last:border-0 border-slate-100 p-3">
                                    <div className="flex items-start gap-3">
                                        {!isReadOnly && (
                                            <div className="mt-2 text-slate-400 cursor-grab active:cursor-grabbing hover:text-slate-600">
                                                <GripVertical size={16} />
                                            </div>
                                        )}
                                        <div className="flex flex-col items-center mt-1 w-8">
                                            <span className="text-xs text-slate-500 font-mono">#{index + 1}</span>
                                            <File size={18} className="text-slate-500 mt-1" />
                                        </div>

                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-medium text-sm text-slate-900">{file.original_name}</span>
                                                {file.db_object_type && isReadOnly && (
                                                    <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
                                                        {file.db_object_type}
                                                    </span>
                                                )}
                                                {(status === 'draft' || status === 'manager_rejected' || status === 'dba_rejected' || !isReadOnly) && (
                                                    <button onClick={() => removeExistingFile(file.id!)} className="text-slate-400 hover:text-red-500 ml-auto">
                                                        <X size={16} />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap gap-2 items-center">
                                                {!isReadOnly ? (
                                                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full">
                                                        <select
                                                            className="flex-shrink-0 h-7 px-2 bg-white border border-slate-300 rounded text-xs focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none"
                                                            value={file.file_version || 'new'}
                                                            onChange={e => handleExistingFileChange(file.id!, 'file_version', e.target.value)}
                                                        >
                                                            <option value="new">新程式</option>
                                                            <option value="update">更新舊程式</option>
                                                        </select>
                                                        <input
                                                            className="flex-1 min-w-[150px] h-7 px-2 bg-white border border-slate-300 rounded text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                                                            placeholder="檔案說明"
                                                            value={file.description || ''}
                                                            onChange={e => handleExistingFileChange(file.id!, 'description', e.target.value)}
                                                        />
                                                        {programType === 'DB Object' && (
                                                            <>
                                                                <select
                                                                    className="flex-shrink-0 w-24 h-7 px-2 bg-white border border-slate-300 rounded text-xs focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none"
                                                                    value={file.db_object_type || ''}
                                                                    onChange={e => handleExistingFileChange(file.id!, 'db_object_type', e.target.value)}
                                                                >
                                                                    <option value="">類型...</option>
                                                                    {dbObjectTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                                                </select>
                                                                <input
                                                                    className="flex-shrink-0 w-32 h-7 px-2 bg-white border border-slate-300 rounded text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                                                                    placeholder="Object"
                                                                    value={file.db_object_name || ''}
                                                                    onChange={e => handleExistingFileChange(file.id!, 'db_object_name', e.target.value)}
                                                                />
                                                                <input
                                                                    className="flex-shrink-0 w-24 h-7 px-2 bg-white border border-slate-300 rounded text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                                                                    placeholder="Schema"
                                                                    value={file.db_schema_name || ''}
                                                                    onChange={e => handleExistingFileChange(file.id!, 'db_schema_name', e.target.value)}
                                                                />
                                                            </>
                                                        )}
                                                    </div>
                                                ) : (
                                                    // Read Only View - Horizontal Layout
                                                    <div className="flex flex-wrap items-center gap-3 text-xs">
                                                        <div className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{file.description || '無描述'}</div>
                                                        <span className={`px-2 py-0.5 rounded border ${file.file_version === 'update' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                                            {file.file_version === 'update' ? '更新舊程式' : '新程式'}
                                                        </span>
                                                        {file.db_object_name && <span className="text-slate-500 font-mono text-[10px] border border-slate-200 px-1 rounded">{file.db_schema_name}.{file.db_object_name}</span>}
                                                    </div>
                                                )}

                                                {/* Status Badges & Actions - Now Inline even with Read Only View if possible, or just next to it */}
                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    {file.is_backup === 1 && <span className="text-xs text-green-600 flex gap-1 items-center bg-green-50 px-2 py-0.5 rounded border border-green-200"><CheckCircle size={10} /> 已備份</span>}
                                                    {file.uploaded_at && <span className="text-[10px] text-slate-400">上傳: {new Date(file.uploaded_at).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>}

                                                    {file.compiled_at && (
                                                        <span className={`text-xs px-2 py-0.5 rounded border ${file.compile_status === 'success' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                            {file.compile_status === 'success' ? '已編譯' : '編譯失敗'}
                                                        </span>
                                                    )}
                                                    {file.deployed_at && (
                                                        <span className={`text-xs px-2 py-0.5 rounded border ${file.deploy_status === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                            {file.deploy_status === 'success' ? '已佈署' : '佈署失敗'}
                                                        </span>
                                                    )}

                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                const token = sessionStorage.getItem('token');
                                                                const res = await fetch(`/api/uploads/${file.id}/download`, { headers: { 'Authorization': `Bearer ${token}` } });
                                                                if (res.ok) {
                                                                    const blob = await res.blob();
                                                                    const url = window.URL.createObjectURL(blob);
                                                                    const a = document.createElement('a'); a.href = url; a.download = file.original_name; document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a);
                                                                } else { alert('下載失敗'); }
                                                            } catch (e) { alert('下載錯誤'); }
                                                        }}
                                                        className="text-xs text-blue-600 hover:text-blue-800 underline ml-1"
                                                    >
                                                        下載檔案
                                                    </button>
                                                    {file.backup_file_path && (
                                                        <>
                                                            <button
                                                                onClick={async () => {
                                                                    try {
                                                                        const token = sessionStorage.getItem('token');
                                                                        const res = await fetch(`/api/uploads/${file.id}/download-backup`, { headers: { 'Authorization': `Bearer ${token}` } });
                                                                        if (res.ok) {
                                                                            const blob = await res.blob();
                                                                            const url = window.URL.createObjectURL(blob);
                                                                            const a = document.createElement('a'); a.href = url; a.download = `backup_${file.db_object_name || 'object'}.sql`; document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a);
                                                                        } else { alert('下載失敗'); }
                                                                    } catch (e) { alert('下載錯誤'); }
                                                                }}
                                                                className="text-xs text-green-600 hover:text-green-800 underline ml-1"
                                                            >
                                                                下載備份
                                                            </button>
                                                            {file.backup_at && (
                                                                <span className="text-[10px] text-blue-500 ml-1">
                                                                    備份: {new Date(file.backup_at).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                                                                    {file.backup_file_path && ` (${file.backup_file_path.split(/[/\\]/).pop()?.replace(/^backup_\d+_/, 'backup_')})`}
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>


                                        </div>
                                    </div>
                                </Reorder.Item>
                            ))}
                        </Reorder.Group>
                        {newFiles.map((item, idx) => (
                            <div key={idx} className="p-4 bg-white border-b last:border-0 border-slate-100 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 font-medium text-sm text-slate-900">
                                        <div className="text-green-500"><File size={18} /></div>
                                        {item.file.name}
                                    </div>
                                    <button onClick={() => removeNewFile(idx)} className="text-slate-400 hover:text-red-500">
                                        <X size={16} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                    <select
                                        className="h-9 px-2 bg-white border border-slate-300 rounded text-xs w-full"
                                        value={item.versionType}
                                        onChange={e => {
                                            const copy = [...newFiles];
                                            copy[idx].versionType = e.target.value as any;
                                            setNewFiles(copy);
                                        }}
                                    >
                                        <option value="new">新程式</option>
                                        <option value="update">更新舊程式</option>
                                    </select>

                                    <Input
                                        placeholder="檔案說明 (可選)"
                                        value={item.description}
                                        onChange={e => handleNewFileDescChange(idx, e.target.value)}
                                        className="h-9 text-xs w-full"
                                    />

                                    {programType === 'DB Object' && (
                                        <select
                                            className="h-9 px-2 bg-white border border-slate-300 rounded text-xs w-full"
                                            value={item.dbObjectType}
                                            onChange={e => {
                                                const copy = [...newFiles];
                                                copy[idx].dbObjectType = e.target.value;
                                                setNewFiles(copy);
                                            }}
                                        >
                                            <option value="">請選擇物件類別...</option>
                                            {dbObjectTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                        </select>
                                    )}
                                </div>

                                {programType === 'DB Object' && (
                                    <div className="p-3 bg-slate-50 rounded-lg space-y-3 border border-slate-200">
                                        <div className="flex gap-3">
                                            <div className="flex-1">
                                                <label className="text-xs font-medium text-slate-500 mb-1 block">Object 名稱 <span className="text-red-500">*</span></label>
                                                <Input
                                                    className="h-8 text-xs bg-white w-full"
                                                    value={item.dbObjectName}
                                                    onChange={e => {
                                                        const copy = [...newFiles]; copy[idx].dbObjectName = e.target.value; setNewFiles(copy);
                                                    }}
                                                />
                                            </div>
                                            <div className="w-32">
                                                <label className="text-xs font-medium text-slate-500 mb-1 block">Schema <span className="text-red-500">*</span></label>
                                                <Input
                                                    className="h-8 text-xs bg-white w-full"
                                                    value={item.dbSchemaName}
                                                    onChange={e => {
                                                        const copy = [...newFiles]; copy[idx].dbSchemaName = e.target.value; setNewFiles(copy);
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-4">
                                            <label className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    checked={item.isBackup}
                                                    onChange={e => {
                                                        const copy = [...newFiles]; copy[idx].isBackup = e.target.checked; setNewFiles(copy);
                                                    }}
                                                    className="w-4 h-4 text-blue-600 rounded border-gray-300"
                                                />
                                                <span className="text-xs font-medium text-slate-700">已備份 (Backup Done)</span>
                                            </label>

                                            {/* Show buttons if Update, OR if user wants them available. User asked to "Add button", implying visibility. 
                                                    Let's show them but maybe warn if not update? 
                                                    Actually, standardized workflow usually implies backup for 'update'. 
                                                    The user's prompt listing buttons suggests they should be there. 
                                                    I'll output them always for DB Object to avoid "missing" confusion, 
                                                    but they are most relevant for Update. 
                                                 */}

                                            <Button size="sm" variant="secondary" className="h-7 text-xs bg-white border border-slate-300 hover:bg-slate-50" onClick={() => handleAutoBackup(idx)}>
                                                自動備份下載
                                            </Button>

                                            <div className="relative">
                                                <input
                                                    type="file"
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                    onChange={(e) => {
                                                        if (e.target.files?.[0]) handleManualBackup(idx, e.target.files[0]);
                                                    }}
                                                />
                                                <Button size="sm" variant="secondary" className="h-7 text-xs bg-white border border-slate-300 hover:bg-slate-50">手動備份上傳</Button>
                                            </div>

                                            {item.isBackup && item.backupFilePath && (
                                                <div className="flex items-center gap-2 bg-green-50 px-2 py-1 rounded border border-green-200">
                                                    <span className="text-xs text-green-700 font-medium flex items-center gap-1">
                                                        <CheckCircle size={12} /> 備份完成
                                                    </span>
                                                    <div className="h-3 w-[1px] bg-green-300"></div>
                                                    <button
                                                        onClick={async () => {
                                                            // Use a temporary link to download? 
                                                            // Or generic download route.
                                                            // Since it's a temp file locally before save, we might need a dedicated temp download or just show name.
                                                            // Backend returns `filePath`.
                                                            // For now just alert or implementation properly if needed.
                                                            // User asked for "Download and Delete".
                                                            alert("請儲存後再從列表下載，或重新上傳");
                                                        }}
                                                        className="text-[10px] text-green-700 hover:underline cursor-pointer"
                                                    >
                                                        下載
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const copy = [...newFiles];
                                                            copy[idx].isBackup = false;
                                                            copy[idx].backupFilePath = '';
                                                            setNewFiles(copy);
                                                        }}
                                                        className="text-green-700 hover:text-red-600"
                                                        title="刪除備份"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        {existingFiles.length === 0 && newFiles.length === 0 && (
                            <div className="p-6 text-center text-slate-400 text-sm">暫無上傳檔案</div>
                        )}
                    </div>
                </div>

                {/* Rejection/DBA Comments Display */}
                {(status === 'manager_rejected' || status === 'dba_rejected' || status === 'online') && (
                    <div className={`p-4 rounded-lg space-y-2 border ${status === 'online' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                        <h3 className={`text-sm font-bold flex items-center gap-2 ${status === 'online' ? 'text-green-800' : 'text-red-800'}`}>
                            <MessageSquare size={16} />
                            {status === 'manager_rejected' ? '主管退回意見 (Manager Rejected)' :
                                status === 'dba_rejected' ? 'DBA 退回意見 (DBA Rejected)' :
                                    'DBA 上線回覆 (DBA Comment)'}
                        </h3>
                        <div className={`text-sm whitespace-pre-wrap ${status === 'online' ? 'text-green-900' : 'text-red-900'}`}>
                            {status === 'online' ? (dbaComment || reviews.find(r => r.action === 'online')?.comment || '無回覆') :
                                (reviews.sort((a, b) => new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime()).find(r => r.action === 'reject')?.comment || '無退回原因')}
                        </div>
                    </div>
                )}

                {/* Reviewer Action Area: Comment Input */}
                {status === 'reviewing' && canApprove && (
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg space-y-2">
                        <h3 className="text-sm font-bold text-blue-800 flex items-center gap-2">
                            <Edit3 size={16} /> 簽核意見 (Review Comment)
                        </h3>
                        <textarea
                            className="w-full min-h-[80px] px-3 py-2 bg-white border border-blue-200 rounded text-sm text-slate-700 focus:border-blue-500 outline-none"
                            placeholder="請在此輸入簽核意見..."
                            value={reviewComment}
                            onChange={e => setReviewComment(e.target.value)}
                        />
                    </div>
                )}
                {/* DBA Action Area: Comment Input */}
                {status === 'approved' && (user?.role === 'admin' || user?.role === 'dba') && (
                    <div className="p-4 bg-purple-50 border border-purple-100 rounded-lg space-y-2">
                        <h3 className="text-sm font-bold text-purple-800 flex items-center gap-2">
                            <Edit3 size={16} /> 上線回覆 / DBA 意見
                        </h3>
                        <textarea
                            className="w-full min-h-[80px] px-3 py-2 bg-white border border-purple-200 rounded text-sm text-slate-700 focus:border-purple-500 outline-none"
                            placeholder="請在此輸入執行後回覆..."
                            value={reviewComment}
                            onChange={e => setReviewComment(e.target.value)}
                        />
                    </div>
                )}

            </div>

            {/* Footer Actions */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                <div className="max-w-4xl mx-auto flex items-center justify-end gap-3">
                    {(status === 'draft' && id) && (
                        <Button
                            variant="danger"
                            className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200 mr-auto"
                            onClick={async () => {
                                if (confirm('確定要作廢此申請單嗎? 作廢後將無法恢復。')) {
                                    await handleReviewAction('void' as any);
                                }
                            }}
                        >
                            作廢 (Void)
                        </Button>
                    )}

                    {!isReadOnly && (
                        <>
                            <Button variant="secondary" onClick={() => handleSaveOrSubmit('save')} isLoading={isLoading}>
                                <Save size={16} className="mr-2" /> 暫存 (Save)
                            </Button>
                            <Button onClick={() => handleSaveOrSubmit('submit')} isLoading={isLoading}>
                                <Send size={16} className="mr-2" /> 送出簽核 (Submit)
                            </Button>
                        </>
                    )}

                    {status === 'reviewing' && canApprove && (
                        <>
                            <Button variant="danger" onClick={() => handleReviewAction('reject')} isLoading={isLoading}>
                                <ThumbsDown size={16} className="mr-2" /> 退回 (Reject)
                            </Button>
                            <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleReviewAction('approve')} isLoading={isLoading}>
                                <ThumbsUp size={16} className="mr-2" /> 同意 (Approve)
                            </Button>
                        </>
                    )}

                    {status === 'approved' && (user?.role === 'admin' || user?.role === 'dba') && (
                        <>

                            <Button variant="danger" onClick={() => handleReviewAction('reject')} isLoading={isLoading} className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200">
                                <ThumbsDown size={16} className="mr-2" /> 退回 (Reject)
                            </Button>
                            {(programType === 'Form' || programType === 'Library') && (
                                <Button className="text-white hover:opacity-90" style={{ backgroundColor: '#daa520' }} onClick={() => {
                                    setIsCompileModalOpen(true);
                                }}>
                                    <Terminal size={16} className="mr-2" /> 程式編譯 (Compile)
                                </Button>
                            )}
                            <Button className="text-white hover:opacity-90" style={{ backgroundColor: '#1e90ff' }} onClick={() => setIsDeployModalOpen(true)}>
                                <UploadCloud size={16} className="mr-2" /> 程式佈署 (Deploy)
                            </Button>
                            <Button className="text-white hover:opacity-90" style={{ backgroundColor: '#00ced1' }} onClick={() => handleReviewAction('online')} isLoading={isLoading}>
                                <Globe size={16} className="mr-2" /> DBA 上線 (Online)
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Review Status Modal */}
            <Modal
                isOpen={isReviewModalOpen}
                onClose={() => setIsReviewModalOpen(false)}
                title="簽核狀態詳細資訊"
                className="max-w-2xl"
            >
                <div>
                    <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-600 mb-4">
                        目前狀態: <span className="font-bold text-brand-600">{getStatusLabel(status)}</span>
                    </div>
                    <div className="border rounded-lg overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 border-b text-slate-600">
                                <tr>
                                    <th className="px-4 py-2 w-16">序號</th>
                                    <th className="px-4 py-2 whitespace-nowrap">簽核主管</th>
                                    <th className="px-4 py-2 whitespace-nowrap">結果</th>
                                    <th className="px-4 py-2">意見</th>
                                    <th className="px-4 py-2 whitespace-nowrap">日期</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sortedReviews.map((log, index) => (
                                    <tr key={log.id}>
                                        <td className="px-4 py-2 text-center text-slate-500">{index + 1}</td>
                                        <td className="px-4 py-2 font-medium whitespace-nowrap">{log.reviewer_name}</td>
                                        <td className="px-4 py-2 whitespace-nowrap">{log.action === 'approve' ? '同意' : log.action === 'reject' ? '退回' : log.action}</td>
                                        <td className="px-4 py-2 min-w-[200px] max-w-[300px] break-all">{log.comment}</td>
                                        <td className="px-4 py-2 text-xs whitespace-nowrap">{new Date(log.reviewed_at).toLocaleString()}</td>
                                    </tr>
                                ))}
                                {sortedReviews.length === 0 && <tr><td colSpan={5} className="p-4 text-center">尚無紀錄</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Modal>

            {/* DeploymentModal */}
            <DeploymentModal
                isOpen={isDeployModalOpen}
                onClose={() => setIsDeployModalOpen(false)}
                requestId={id}
                onComplete={() => {
                    if (id) fetchRequest(id);
                }}
            />

            {/* Compilation Modal */}
            <CompilationModal
                isOpen={isCompileModalOpen}
                onClose={() => setIsCompileModalOpen(false)}
                requestId={Number(id)}
                files={existingFiles}
                onSuccess={() => { if (id) fetchRequest(id); }}
            />

            {/* Copy Request Modal */}
            <Modal
                isOpen={isCopyModalOpen}
                onClose={() => setIsCopyModalOpen(false)}
                title="從舊單據複製 (Copy From Request)"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setIsCopyModalOpen(false)}>取消</Button>
                        <Button onClick={handleCopyRequest} isLoading={isLoading}>確認複製</Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-600">
                        請選擇要複製的來源單據單號。系統將會複製該單據的模組、類別、說明等欄位。
                        <br />
                        <span className="text-red-500 text-xs">注意: 檔案清單、簽核紀錄與 DBA 回覆將不會被複製。</span>
                    </p>
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">來源單據單號</label>
                        <input
                            list="copy_options"
                            className="w-full px-3 py-2 border rounded text-sm"
                            placeholder="請輸入單號或選擇..."
                            value={copyFormId}
                            onChange={e => setCopyFormId(e.target.value)}
                        />
                        <datalist id="copy_options">
                            {copyOptions.map(opt => <option key={opt} value={opt} />)}
                        </datalist>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
