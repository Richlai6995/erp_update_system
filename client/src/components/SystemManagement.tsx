import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import type { ERPModule } from '../types';
import { Package, Edit, PlusCircle, Database, Save, Play, Download, Trash2, Upload, AlertTriangle, RefreshCw, Mail, Lock, Server, Users } from 'lucide-react';
import { Input } from './ui/Input';

interface SystemManagementProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SystemManagement: React.FC<SystemManagementProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<'db' | 'departments' | 'db-objects' | 'mail' | 'erp' | 'env'>('departments');

    // ERP Modules State
    const [modules, setModules] = useState<ERPModule[]>([]);
    const [editingModule, setEditingModule] = useState<ERPModule | null>(null);
    const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
    const [moduleForm, setModuleForm] = useState({
        name: '', code: '', path_code: ''
    });
    const [globalPaths, setGlobalPaths] = useState({ form_base: '', report_base: '', sql_base: '', library_base: '' });

    // DB / Backup State
    const [isImporting, setIsImporting] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [backupPath, setBackupPath] = useState('');
    const [backupSchedule, setBackupSchedule] = useState({ frequency: 'manual', time: '02:00', enabled: false });
    const [backups, setBackups] = useState<any[]>([]);
    const [backupLoading, setBackupLoading] = useState(false);

    // Mail State
    const [mailLogs, setMailLogs] = useState<any[]>([]);
    const [isMailServerEnabled, setIsMailServerEnabled] = useState(true);
    const [mailLoading, setMailLoading] = useState(false);
    const [retentionDays, setRetentionDays] = useState('30');
    const [cleanupDate, setCleanupDate] = useState('');
    const [exportStart, setExportStart] = useState('');
    const [exportEnd, setExportEnd] = useState('');

    // Departments State
    const [departments, setDepartments] = useState<any[]>([]);
    const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
    const [editingDept, setEditingDept] = useState<any | null>(null);
    const [deptForm, setDeptForm] = useState({ name: '', code: '', description: '', active: true });

    // Dept Approvers State
    const [isApproverModalOpen, setIsApproverModalOpen] = useState(false);
    const [selectedDeptForApprovers, setSelectedDeptForApprovers] = useState<any | null>(null);
    const [approvers, setApprovers] = useState<any[]>([]); // Current editing list

    // DB Object Types State
    const [dbObjectTypes, setDbObjectTypes] = useState<any[]>([]);
    const [newDbObjType, setNewDbObjType] = useState('');

    // Users List for Approver Selection
    const [users, setUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Environment Vars State
    const [envSettings, setEnvSettings] = useState<any>({});
    const [envLoading, setEnvLoading] = useState(false);

    // Effects
    useEffect(() => {
        if (isOpen) {
            if (activeTab === 'departments') { fetchDepartments(); fetchUsers(); }
            if (activeTab === 'db-objects') fetchDbObjectTypes();
            if (activeTab === 'mail') fetchMailData();
            if (activeTab === 'db') fetchBackupData();
            if (activeTab === 'erp') {
                fetchModules();
                fetchGlobalPaths();
            }
            if (activeTab === 'env') fetchEnvSettings();
        }
    }, [isOpen, activeTab]);

    const fetchUsers = async () => {
        try {
            const res = await api.get('/users');
            setUsers(res.data);
        } catch (e) { console.error(e); }
    };

    // --- Department Functions ---
    const fetchDepartments = async () => {
        try {
            const res = await api.get('/departments');
            setDepartments(res.data);
        } catch (e) {
            console.error("Fetch departments failed", e);
        }
    };

    const handleOpenDeptModal = (dept?: any) => {
        if (dept) {
            setEditingDept(dept);
            setDeptForm({ name: dept.name, code: dept.code, description: dept.description, active: dept.active === 1 });
        } else {
            setEditingDept(null);
            setDeptForm({ name: '', code: '', description: '', active: true });
        }
        setIsDeptModalOpen(true);
    };

    const handleSaveDept = async () => {
        if (!deptForm.name) return alert('名稱為必填');
        try {
            if (editingDept) {
                await api.put(`/departments/${editingDept.id}`, deptForm);
            } else {
                await api.post('/departments', deptForm);
            }
            setIsDeptModalOpen(false);
            fetchDepartments();
        } catch (e: any) {
            alert('儲存失敗: ' + (e.response?.data?.error || e.message));
        }
    };

    const handleDeleteDept = async (id: number) => {
        if (!confirm('確認刪除此部門?')) return;
        try {
            await api.delete(`/departments/${id}`);
            fetchDepartments();
        } catch (e: any) {
            alert('刪除失敗: ' + (e.response?.data?.error || e.message));
        }
    };

    const handleOpenApproverModal = async (dept: any) => {
        setIsLoading(true);
        try {
            setSelectedDeptForApprovers(dept);
            // Fetch full details including approvers
            const res = await api.get(`/departments/${dept.id}`);
            const existingApprovers = res.data.approvers || [];
            setApprovers(existingApprovers);
            setIsApproverModalOpen(true);
        } catch (e) {
            alert('載入失敗');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddApproverRow = () => {
        // Add a new empty row
        const newStep = approvers.length > 0 ? Math.max(...approvers.map((a: any) => a.step_order)) + 1 : 1;
        setApprovers([...approvers, { step_order: newStep, user_id: '', username: '', notify: true, active: true }]);
    };

    const handleRemoveApproverRow = (index: number) => {
        const newApps = [...approvers];
        newApps.splice(index, 1);
        setApprovers(newApps);
    };

    const handleApproverChange = (index: number, field: string, value: any) => {
        const newApps = [...approvers];
        newApps[index] = { ...newApps[index], [field]: value };
        // If user_id changed, update username lookup
        if (field === 'user_id') {
            const u = users.find(u => u.id === parseInt(value));
            if (u) newApps[index].username = u.username;
        }
        setApprovers(newApps);
    };

    const handleSaveApprovers = async () => {
        if (!selectedDeptForApprovers) return;
        try {
            if (approvers.some((a: any) => !a.user_id)) return alert('請為每一階選擇簽核人員');
            await api.post(`/departments/${selectedDeptForApprovers.id}/approvers`, { approvers });
            alert('簽核流程已儲存');
            setIsApproverModalOpen(false);
        } catch (e: any) {
            alert('儲存失敗');
        }
    };

    // --- DB Object Types Functions ---
    const fetchDbObjectTypes = async () => {
        try {
            const res = await api.get('/admin/settings/db-object-types');
            setDbObjectTypes(res.data || []);
        } catch (e) { console.error(e); }
    };

    const handleAddDbObjectType = async () => {
        if (!newDbObjType) return;
        try {
            await api.post('/admin/settings/db-object-types', { name: newDbObjType });
            setNewDbObjType('');
            fetchDbObjectTypes();
        } catch (e: any) { alert('新增失敗'); }
    };

    const handleDeleteDbObjectType = async (id: number) => {
        if (!confirm('確認刪除?')) return;
        try {
            await api.delete(`/admin/settings/db-object-types/${id}`);
            fetchDbObjectTypes();
        } catch (e) { alert('刪除失敗'); }
    };

    // Global Path Functions
    const fetchGlobalPaths = async () => {
        try {
            const res = await api.get('/admin/settings/erp-paths');
            setGlobalPaths(res.data);
        } catch (e) {
            console.error("Fetch global paths failed", e);
        }
    };

    const handleSaveGlobalPaths = async () => {
        try {
            await api.post('/admin/settings/erp-paths', globalPaths);
            alert('全域路徑設定已儲存');
        } catch (e) {
            alert('儲存失敗');
        }
    };

    // ERP Functions
    const fetchModules = async () => {
        try {
            const res = await api.get('/erp-modules');
            setModules(res.data || []);
        } catch (e) {
            console.error("Fetch modules failed", e);
        }
    };

    const handleOpenModuleModal = (module?: ERPModule) => {
        if (module) {
            setEditingModule(module);
            setModuleForm({
                name: module.name,
                code: module.code,
                path_code: module.path_code || ''
            });
        } else {
            setEditingModule(null);
            setModuleForm({ name: '', code: '', path_code: '' });
        }
        setIsModuleModalOpen(true);
    };

    const handleSaveModule = async () => {
        if (!moduleForm.name || !moduleForm.code || !moduleForm.path_code) return alert('所有欄位皆為必填');
        const form_path = globalPaths.form_base.replace('*', moduleForm.path_code);
        const report_path = globalPaths.report_base.replace('*', moduleForm.path_code);
        const payload = { ...moduleForm, form_path, report_path };

        try {
            if (editingModule) {
                await api.put(`/erp-modules/${editingModule.id}`, payload);
            } else {
                await api.post('/erp-modules', payload);
            }
            setIsModuleModalOpen(false);
            fetchModules();
        } catch (e: any) {
            alert('儲存失敗: ' + (e.response?.data?.error || e.message));
        }
    };

    const handleDeleteModule = async (id: number) => {
        if (!confirm('確認刪除此模組設定?')) return;
        try {
            await api.delete(`/erp-modules/${id}`);
            fetchModules();
        } catch (e) {
            alert('刪除失敗');
        }
    };

    // Backup Functions
    const fetchBackupData = async () => {
        setBackupLoading(true);
        try {
            const [configRes, filesRes] = await Promise.all([
                api.get('/admin/backup/config'),
                api.get('/admin/backup/files')
            ]);
            setBackupPath(configRes.data.path);
            setBackupSchedule(configRes.data.schedule);
            setBackups(filesRes.data || []);
        } catch (e) {
            console.error("Fetch backup data failed", e);
        } finally {
            setBackupLoading(false);
        }
    };

    const handleSaveBackupConfig = async () => {
        try {
            await api.post('/admin/backup/config', {
                ...backupSchedule,
                enabled: backupSchedule.frequency !== 'manual'
            });
            alert('備份設定已儲存');
            fetchBackupData();
        } catch (e) {
            alert('儲存失敗');
        }
    };

    const handleManualBackupTrigger = async () => {
        try {
            await api.post('/admin/backup/run');
            alert('手動備份成功！');
            fetchBackupData();
        } catch (e) {
            alert('備份失敗');
        }
    };

    const handleDeleteBackup = async (filename: string) => {
        if (!confirm(`確定要刪除備份檔 ${filename}?`)) return;
        try {
            await api.delete(`/admin/backup/files/${filename}`);
            fetchBackupData();
        } catch (e) {
            alert('刪除失敗');
        }
    };

    const handleRestoreBackup = async (filename: string, force: boolean) => {
        const msg = force
            ? `⚠️ 危險：這將「強制覆蓋」目前資料庫為 ${filename} 的內容。\n目前資料將會遺失！\n確定要繼續？`
            : `確認還原 ${filename}? 此操作會覆蓋目前資料庫。`;

        if (!confirm(msg)) return;

        try {
            await api.post('/admin/backup/restore', { filename });
            alert('還原成功，系統重新整理中...');
            window.location.reload();
        } catch (e: any) {
            alert('還原失敗: ' + (e.response?.data?.error || e.message));
        }
    };

    const handleDownloadBackup = (filename: string) => {
        api.get(`/admin/backup/download/${filename}`, { responseType: 'blob' })
            .then(res => {
                const url = window.URL.createObjectURL(new Blob([res.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', filename);
                document.body.appendChild(link);
                link.click();
                link.parentNode?.removeChild(link);
            })
            .catch(() => alert('下載失敗'));
    };

    const handleExport = async () => {
        try {
            const response = await api.get('/admin/db/export', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `system_backup_${new Date().toISOString().split('T')[0]}.db`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } catch (error) {
            console.error("Export failed", error);
            alert("匯出失敗，請檢查權限或伺服器狀態。");
        }
    };

    const handleImport = async () => {
        if (!importFile) return;
        if (!confirm("⚠️ 警告：匯入資料庫將會「完全覆蓋」目前的系統資料。\n\n此操作無法復原！\n\n請問您確定要繼續嗎？")) return;
        setIsImporting(true);
        const formData = new FormData();
        formData.append('dbFile', importFile);
        try {
            const res = await api.post('/admin/db/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert(res.data.message || "匯入成功！系統將重新整理。");
            window.location.reload();
        } catch (error: any) {
            console.error("Import failed", error);
            alert("匯入失敗: " + (error.response?.data?.error || "未知錯誤"));
        } finally {
            setIsImporting(false);
        }
    };

    const handleGlobalSync = async () => {
        setIsSyncing(true);
        try {
            const res = await api.post('/admin/sync-global');
            alert(`全域同步完成。共掃描專案: ${res.data.count}`);
        } catch (e: any) {
            alert('同步失敗: ' + (e.response?.data?.error || e.message));
        } finally {
            setIsSyncing(false);
        }
    };

    // Env Functions
    const fetchEnvSettings = async () => {
        setEnvLoading(true);
        try {
            const res = await api.get('/admin/settings/env');
            setEnvSettings(res.data);
        } catch (e) {
            console.error("Fetch env failed", e);
        } finally {
            setEnvLoading(false);
        }
    };

    const handleSaveEnvSettings = async () => {
        try {
            await api.post('/admin/settings/env', envSettings);
            alert('環境設定已儲存。請注意：若修改了連線資訊，您需要手動重新啟動後端伺服器才能生效。');
        } catch (e: any) {
            alert('儲存失敗: ' + (e.response?.data?.error || e.message));
        }
    };

    const handleEnvChange = (key: string, value: string) => {
        setEnvSettings({ ...envSettings, [key]: value });
    };

    const renderEnvInput = (label: string, key: string, type: 'text' | 'password' | 'number' = 'text') => (
        <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 uppercase">{label}</label>
            <div className="relative">
                <Input
                    type={type}
                    value={envSettings[key] || ''}
                    onChange={e => handleEnvChange(key, e.target.value)}
                    className={type === 'password' ? 'pr-8 font-mono' : 'font-mono'}
                    placeholder={type === 'password' ? '********' : ''}
                />
            </div>
        </div>
    );

    // Mail Functions
    const fetchMailData = async () => {
        setMailLoading(true);
        try {
            const [logsRes, statusRes, retentionRes] = await Promise.all([
                api.get('/mail/logs'),
                api.get('/mail/status'),
                api.get('/mail/settings/retention')
            ]);
            setMailLogs(logsRes.data || []);
            setIsMailServerEnabled(statusRes.data.enabled);
            if (retentionRes.data.days !== undefined) setRetentionDays(retentionRes.data.days.toString());
        } catch (e) {
            console.error("Fetch mail data failed", e);
        } finally {
            setMailLoading(false);
        }
    };

    const handleToggleMail = async () => {
        const newVal = !isMailServerEnabled;
        try {
            await api.post('/mail/toggle', { enabled: newVal });
            setIsMailServerEnabled(newVal);
        } catch (e) {
            alert('切換失敗');
        }
    };

    const handleSaveRetention = async () => {
        try {
            await api.post('/mail/settings/retention', { days: retentionDays });
            alert('設定已儲存');
        } catch (e) {
            alert('儲存失敗');
        }
    };

    const handleExportLogs = async () => {
        try {
            const params = new URLSearchParams();
            if (exportStart) params.append('startDate', exportStart);
            if (exportEnd) params.append('endDate', exportEnd);
            const response = await api.get(`/mail/logs/export?${params.toString()}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const disposition = response.headers['content-disposition'];
            let filename = `mail_logs_${new Date().toISOString().split('T')[0]}.csv`;
            if (disposition && disposition.indexOf('attachment') !== -1) {
                const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                const matches = filenameRegex.exec(disposition);
                if (matches != null && matches[1]) {
                    filename = matches[1].replace(/['"]/g, '');
                }
            }
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } catch (e) {
            alert('匯出失敗');
        }
    };

    const handleClearLogsBefore = async () => {
        if (!cleanupDate) return alert('請選擇日期');
        if (!confirm(`確定要清除 ${cleanupDate} 之前的日誌嗎?`)) return;
        try {
            const res = await api.delete('/mail/logs', { data: { beforeDate: cleanupDate } });
            alert(`已清除 ${res.data.deleted} 筆紀錄`);
            fetchMailData();
        } catch (e) {
            alert('清除失敗');
        }
    };

    const handleClearAllLogs = async () => {
        if (!confirm('確定要清除所有日誌嗎? 此操作無法復原!')) return;
        try {
            const res = await api.delete('/mail/logs', { data: { beforeDate: null } });
            alert(`已清除所有紀錄 (${res.data.deleted} 筆)`);
            fetchMailData();
        } catch (e) {
            alert('清除失敗');
        }
    };

    return (
        <React.Fragment>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title="系統設定與維護"
                footer={<Button variant="ghost" onClick={onClose}>關閉</Button>}
                className="max-w-6xl w-full"
            >
                <div className="flex border-b border-slate-200 mb-4 overflow-x-auto">
                    <button
                        className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${activeTab === 'departments' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
                        onClick={() => setActiveTab('departments')}
                    >
                        部門設定 (Departments)
                    </button>
                    <button
                        className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${activeTab === 'erp' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
                        onClick={() => setActiveTab('erp')}
                    >
                        ERP 模組設定
                    </button>
                    <button
                        className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${activeTab === 'db-objects' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
                        onClick={() => setActiveTab('db-objects')}
                    >
                        DB 物件類別
                    </button>
                    <button
                        className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${activeTab === 'db' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
                        onClick={() => setActiveTab('db')}
                    >
                        資料庫維護
                    </button>
                    <button
                        className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${activeTab === 'mail' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
                        onClick={() => setActiveTab('mail')}
                    >
                        郵件伺服器管理
                    </button>
                    <button
                        className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${activeTab === 'env' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
                        onClick={() => setActiveTab('env')}
                    >
                        環境變數 (Env)
                    </button>
                </div>

                {activeTab === 'departments' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-2">
                            <div className="text-sm text-slate-500">
                                建立部門並設定各部門的簽核流程 (多階簽核)。
                            </div>
                            <Button onClick={() => handleOpenDeptModal()}>
                                <PlusCircle size={16} className="mr-2" /> 新增部門
                            </Button>
                        </div>

                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b text-slate-600 font-medium">
                                    <tr>
                                        <th className="px-4 py-3 w-32">代碼 (Code)</th>
                                        <th className="px-4 py-3 w-48">部門名稱</th>
                                        <th className="px-4 py-3">描述</th>
                                        <th className="px-4 py-3 w-24">狀態</th>
                                        <th className="px-4 py-3 w-40 text-right">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {departments.map(dept => (
                                        <tr key={dept.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">{dept.code}</td>
                                            <td className="px-4 py-3 font-medium">{dept.name}</td>
                                            <td className="px-4 py-3 text-slate-500">{dept.description}</td>
                                            <td className="px-4 py-3">
                                                {dept.active ?
                                                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">有效</span> :
                                                    <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-xs">無效</span>
                                                }
                                            </td>
                                            <td className="px-4 py-3 text-right flex justify-end gap-2">
                                                <Button size="sm" variant="secondary" onClick={() => handleOpenApproverModal(dept)} className="h-7 text-xs">
                                                    簽核設定
                                                </Button>
                                                <button onClick={() => handleOpenDeptModal(dept)} className="p-1 text-slate-400 hover:text-brand-600">
                                                    <Edit size={16} />
                                                </button>
                                                <button onClick={() => handleDeleteDept(dept.id)} className="p-1 text-slate-400 hover:text-red-600">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {departments.length === 0 && (
                                        <tr><td colSpan={5} className="text-center py-8 text-slate-400">尚無部門設定</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'db-objects' && (
                    <div className="space-y-4">
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-xs text-blue-800">
                            設定申請單「DB Object」類型時，可供選擇的物件類別 (Table, View, Procedure 等)。
                        </div>

                        <div className="flex gap-2">
                            <input
                                className="flex-1 px-3 py-2 border rounded text-sm"
                                placeholder="輸入物件類別名稱, 例如 Package"
                                value={newDbObjType}
                                onChange={e => setNewDbObjType(e.target.value)}
                            />
                            <Button size="sm" onClick={handleAddDbObjectType}>新增</Button>
                        </div>

                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {dbObjectTypes.map((type, idx) => (
                                <div key={type.id} className="flex items-center justify-between p-3 bg-white border rounded shadow-sm">
                                    <span className="text-sm font-bold text-slate-700">{type.name}</span>
                                    <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDeleteDbObjectType(type.id)}>移除</Button>
                                </div>
                            ))}
                            {dbObjectTypes.length === 0 && <div className="text-center text-slate-400 py-4 text-sm">尚未設定任何類別</div>}
                        </div>
                    </div>
                )}

                {activeTab === 'erp' && (
                    <div className="space-y-4">
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <Database size={16} /> 全域路徑設定 (Global Base Paths)
                            </h3>
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Form Base Path (* will be replaced by path code)</label>
                                    <div className="flex gap-2">
                                        <input
                                            className="flex-1 px-3 py-2 border rounded text-sm font-mono"
                                            value={globalPaths.form_base}
                                            onChange={e => setGlobalPaths({ ...globalPaths, form_base: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Report Base Path (* will be replaced by path code)</label>
                                    <div className="flex gap-2">
                                        <input
                                            className="flex-1 px-3 py-2 border rounded text-sm font-mono"
                                            value={globalPaths.report_base}
                                            onChange={e => setGlobalPaths({ ...globalPaths, report_base: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase">SQL Base Path (* will be replaced by path code)</label>
                                    <div className="flex gap-2">
                                        <input
                                            className="flex-1 px-3 py-2 border rounded text-sm font-mono"
                                            value={globalPaths.sql_base}
                                            onChange={e => setGlobalPaths({ ...globalPaths, sql_base: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Library Base Path (* will be replaced by path code)</label>
                                    <div className="flex gap-2">
                                        <input
                                            className="flex-1 px-3 py-2 border rounded text-sm font-mono"
                                            value={globalPaths.library_base}
                                            onChange={e => setGlobalPaths({ ...globalPaths, library_base: e.target.value })}
                                        />
                                        <Button size="sm" onClick={handleSaveGlobalPaths}><Save size={16} className="mr-1" /> 儲存全域設定</Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center mb-2 pt-4 border-t border-slate-100">
                            <div className="text-sm text-slate-500">
                                模組列表 (顯示自動計算後的路徑)
                            </div>
                            <Button onClick={() => handleOpenModuleModal()}>
                                <PlusCircle size={16} className="mr-2" /> 新增模組
                            </Button>
                        </div>

                        <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b text-slate-600 font-medium">
                                    <tr>
                                        <th className="px-4 py-3 w-24">Code</th>
                                        <th className="px-4 py-3 w-24">Path Code</th>
                                        <th className="px-4 py-3 w-40">模組名稱</th>
                                        <th className="px-4 py-3 whitespace-nowrap">Forms 路徑</th>
                                        <th className="px-4 py-3 whitespace-nowrap">Reports 路徑</th>
                                        <th className="px-4 py-3 whitespace-nowrap">SQL 路徑</th>
                                        <th className="px-4 py-3 whitespace-nowrap">Library 路徑</th>
                                        <th className="px-4 py-3 w-24 text-right">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {modules.map(mod => (
                                        <tr key={mod.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">{mod.code}</td>
                                            <td className="px-4 py-3 font-mono text-xs text-blue-600">{mod.path_code || '-'}</td>
                                            <td className="px-4 py-3 font-medium">{mod.name}</td>
                                            <td className="px-4 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                                                {globalPaths.form_base.replace('*', mod.path_code || '')}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                                                {globalPaths.report_base.replace('*', mod.path_code || '')}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                                                {globalPaths.sql_base?.replace('*', mod.path_code || '') || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                                                {globalPaths.library_base?.replace('*', mod.path_code || '') || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right flex justify-end gap-2">
                                                <button onClick={() => handleOpenModuleModal(mod)} className="p-1 text-slate-400 hover:text-brand-600">
                                                    <Edit size={16} />
                                                </button>
                                                <button onClick={() => handleDeleteModule(mod.id)} className="p-1 text-slate-400 hover:text-red-600">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {modules.length === 0 && (
                                        <tr><td colSpan={6} className="text-center py-8 text-slate-400">尚無模組設定</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div >
                )}


                {activeTab === 'db' && (
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-lg border border-indigo-100 shadow-sm">
                            <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2 mb-4">
                                <Database size={20} className="text-indigo-600" />
                                系統自動備份設定
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">備份路徑 (Server Path)</label>
                                    <input
                                        readOnly
                                        className="w-full px-3 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded text-sm"
                                        value={backupPath}
                                    />
                                    <p className="text-xs text-slate-400">此路徑設定於 config/system.yaml，無法在此變更。</p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">自動備份頻率</label>
                                    <div className="flex gap-2">
                                        <select
                                            className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm outline-none focus:border-indigo-500"
                                            value={backupSchedule.frequency}
                                            onChange={e => setBackupSchedule({ ...backupSchedule, frequency: e.target.value })}
                                        >
                                            <option value="manual">不自動備份 (僅手動)</option>
                                            <option value="daily">每天 (02:00)</option>
                                            <option value="weekly">每週 (Sunday 02:00)</option>
                                            <option value="monthly">每月 (1st 02:00)</option>
                                        </select>
                                        <Button
                                            variant="secondary"
                                            onClick={handleSaveBackupConfig}
                                            className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                        >
                                            <Save size={16} className="mr-1" /> 儲存設定
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end mb-4">
                                <Button
                                    onClick={handleManualBackupTrigger}
                                    className="bg-purple-600 hover:bg-purple-700 text-white"
                                >
                                    <Play size={16} className="mr-1" /> 立即手動備份
                                </Button>
                            </div>

                            <div className="border rounded-lg overflow-hidden">
                                <div className="bg-slate-50 px-4 py-2 border-b font-medium text-sm text-slate-700">備份檔案列表 (Server Path)</div>
                                <div className="max-h-[300px] overflow-y-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 border-b sticky top-0">
                                            <tr>
                                                <th className="px-4 py-2 text-slate-600 font-medium">檔名</th>
                                                <th className="px-4 py-2 text-slate-600 font-medium">日期</th>
                                                <th className="px-4 py-2 text-slate-600 font-medium">大小</th>
                                                <th className="px-4 py-2 text-right text-slate-600 font-medium">動作</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {backups.map((bk) => (
                                                <tr key={bk.name} className="hover:bg-slate-50">
                                                    <td className="px-4 py-2 text-slate-700 font-mono text-xs">{bk.name}</td>
                                                    <td className="px-4 py-2 text-slate-500 text-xs">{new Date(bk.created_at).toLocaleString()}</td>
                                                    <td className="px-4 py-2 text-slate-500 text-xs">{bk.size}</td>
                                                    <td className="px-4 py-2 flex justify-end gap-2">
                                                        <Button size="sm" variant="secondary" onClick={() => handleDownloadBackup(bk.name)} className="h-7 px-2 text-xs">
                                                            <Download size={12} className="mr-1" /> 下載
                                                        </Button>
                                                        <Button size="sm" variant="secondary" onClick={() => handleRestoreBackup(bk.name, false)} className="h-7 px-2 text-xs border-orange-200 text-orange-700 hover:bg-orange-50">
                                                            一般還原
                                                        </Button>
                                                        <Button size="sm" variant="danger" onClick={() => handleRestoreBackup(bk.name, true)} className="h-7 px-2 text-xs">
                                                            強制還原
                                                        </Button>
                                                        <button onClick={() => handleDeleteBackup(bk.name)} className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {backups.length === 0 && (
                                                <tr><td colSpan={4} className="text-center py-4 text-slate-400">目前沒有備份檔案</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                            <h3 className="text-sm font-bold text-red-800 flex items-center gap-2 mb-2">
                                <Upload size={16} className="text-red-600" />
                                系統還原 (匯入)
                            </h3>
                            <div className="flex items-start gap-2 mb-4 bg-white p-2 rounded border border-red-100">
                                <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-slate-600">
                                    注意：匯入操作會<strong>強制覆蓋</strong>目前的所有資料（使用者、專案、檔案紀錄）。
                                    請務必確認您上傳的是正確的備份檔案。
                                </p>
                            </div>

                            <div className="space-y-3">
                                <input
                                    type="file"
                                    accept=".db"
                                    onChange={(e) => setImportFile(e.target.files ? e.target.files[0] : null)}
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-red-100 file:text-red-700 hover:file:bg-red-200"
                                />
                                <Button
                                    onClick={handleImport}
                                    disabled={!importFile || isImporting}
                                    className={`w-full ${isImporting ? 'opacity-50' : ''} bg-red-600 hover:bg-red-700 text-white border-transparent`}
                                >
                                    {isImporting ? '還原中...' : '確認還原資料庫'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'mail' && (
                    <div className="space-y-6">
                        <div className={`p-4 rounded-lg flex items-center justify-between border ${isMailServerEnabled ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isMailServerEnabled ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
                                    <Mail size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900">郵件伺服器狀態</h3>
                                    <p className="text-sm text-slate-500">{isMailServerEnabled ? "目前運作中 (Enabled)" : "目前已暫停 (Disabled)"}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-700">{isMailServerEnabled ? "ON" : "OFF"}</span>
                                <button
                                    onClick={handleToggleMail}
                                    className={`w-12 h-6 rounded-full transition-colors relative ${isMailServerEnabled ? "bg-green-500" : "bg-slate-300"}`}
                                >
                                    <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${isMailServerEnabled ? "left-7" : "left-1"}`} />
                                </button>
                            </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                            <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                <Database size={16} className="text-slate-500" />
                                日誌維護 (Log Maintenance)
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">自動保留天數 (Retention Days)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            className="flex-1 px-3 py-2 border rounded text-sm"
                                            value={retentionDays}
                                            onChange={e => setRetentionDays(e.target.value)}
                                            placeholder="例如: 30"
                                        />
                                        <Button onClick={handleSaveRetention} size="sm" variant="secondary">儲存設定</Button>
                                    </div>
                                    <p className="text-xs text-slate-500">設定為 0 則不自動清除。系統會在每次寄信時自動檢查並清除過期日誌。</p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">手動清除 (Manual Cleanup)</label>
                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="date"
                                            className="px-3 py-2 border rounded text-sm w-40"
                                            value={cleanupDate}
                                            onChange={e => setCleanupDate(e.target.value)}
                                        />
                                        <Button onClick={handleClearLogsBefore} size="sm" variant="danger">清除此日期前</Button>
                                        <div className="border-l border-slate-300 h-6 mx-2"></div>
                                        <Button onClick={handleClearAllLogs} size="sm" variant="danger">清除全部</Button>
                                    </div>
                                    <p className="text-xs text-slate-500">清除操作無法復原，請謹慎使用。</p>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-slate-200">
                                <label className="text-sm font-medium text-slate-700 block mb-2">匯出日誌 (Export Logs)</label>
                                <div className="flex flex-wrap gap-2 items-center">
                                    <span className="text-xs text-slate-500">從:</span>
                                    <input
                                        type="date"
                                        className="px-3 py-2 border rounded text-sm"
                                        value={exportStart}
                                        onChange={e => setExportStart(e.target.value)}
                                    />
                                    <span className="text-xs text-slate-500">到:</span>
                                    <input
                                        type="date"
                                        className="px-3 py-2 border rounded text-sm"
                                        value={exportEnd}
                                        onChange={e => setExportEnd(e.target.value)}
                                    />
                                    <Button onClick={handleExportLogs} size="sm" variant="secondary" className="ml-2">
                                        <Download size={14} className="mr-1" /> 匯出 CSV
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border rounded-lg overflow-hidden flex flex-col h-[400px]">
                            <div className="bg-slate-50 px-4 py-2 border-b font-medium text-sm text-slate-700 flex-shrink-0">寄信紀錄 (Logs)</div>
                            <div className="overflow-auto flex-1 resize-y">
                                <table className="w-full text-sm text-left whitespace-nowrap">
                                    <thead className="bg-slate-50 border-b sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-2 w-32">時間</th>
                                            <th className="px-4 py-2 w-24">執行人</th>
                                            <th className="px-4 py-2 w-32">申請單單號</th>
                                            <th className="px-4 py-2 w-24">郵件類別</th>
                                            <th className="px-4 py-2 w-32">程式類別</th>
                                            <th className="px-4 py-2 w-48">收件人</th>
                                            <th className="px-4 py-2 w-20">狀態</th>
                                            <th className="px-4 py-2">訊息</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {mailLogs.map((log: any) => (
                                            <tr key={log.id}>
                                                <td className="px-4 py-2 text-slate-500 text-xs">{new Date(log.created_at.endsWith('Z') ? log.created_at : log.created_at + 'Z').toLocaleString()}</td>
                                                <td className="px-4 py-2">{log.executor}</td>
                                                <td className="px-4 py-2">{log.project_name || '-'}</td>
                                                <td className="px-4 py-2">{log.path_info || '-'}</td>
                                                <td className="px-4 py-2" title={log.file_name}>{log.file_name || '-'}</td>
                                                <td className="px-4 py-2 max-w-[150px] truncate" title={log.recipient}>{log.recipient}</td>
                                                <td className="px-4 py-2">
                                                    <span className={`px-2 py-0.5 rounded text-xs ${log.status === 'success' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                                        {log.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-slate-500 text-xs max-w-[200px] truncate" title={log.message}>{log.message}</td>
                                            </tr>
                                        ))}
                                        {mailLogs.length === 0 && <tr><td colSpan={9} className="text-center py-4 text-slate-400">尚無紀錄</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'env' && (
                    <div className="space-y-6">
                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-sm text-yellow-800 flex items-start gap-3">
                            <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold">注意：修改這些設定可能會影響系統運作。</p>
                                <p>修改資料庫或連線設定後，您必須<b>重新啟動後端伺服器</b> (pm2 restart or docker restart) 才能生效。</p>
                                <p className="mt-1 text-yellow-700">密碼欄位若顯示為 ******** 代表已設定。若不修改密碼，請保留 ******** 不動。</p>
                            </div>
                        </div>

                        <div className="flex justify-end sticky top-[60px] z-10">
                            <Button onClick={handleSaveEnvSettings} disabled={envLoading}>
                                <Save size={16} className="mr-2" /> 儲存環境設定
                            </Button>
                        </div>

                        {envLoading ? <div className="text-center p-8 text-slate-500">載入中...</div> : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
                                {/* SMTP Config */}
                                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
                                    <h3 className="font-bold text-slate-700 flex items-center gap-2 border-b pb-2">
                                        <Mail size={18} /> SMTP 郵件伺服器設定
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">{renderEnvInput('SMTP Server Host', 'SMTP_SERVER')}</div>
                                        {renderEnvInput('Port', 'SMTP_PORT', 'number')}
                                        {renderEnvInput('Username', 'SMTP_USERNAME')}
                                        {renderEnvInput('Password', 'SMTP_PASSWORD', 'password')}
                                        <div className="col-span-2">{renderEnvInput('From Address (System)', 'FROM_ADDRESS')}</div>
                                        <div className="col-span-2">{renderEnvInput('Sender Address (Default)', 'SENDER_ADDRESS')}</div>
                                    </div>
                                </div>

                                {/* LDAP Config */}
                                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
                                    <h3 className="font-bold text-slate-700 flex items-center gap-2 border-b pb-2">
                                        <Users size={18} /> LDAP 認證設定
                                    </h3>
                                    <div className="grid grid-cols-1 gap-4">
                                        {renderEnvInput('LDAP URL', 'LDAP_URL')}
                                        {renderEnvInput('Base DN', 'LDAP_BASE_DN')}
                                        {renderEnvInput('Manager DN', 'LDAP_MANAGER_DN')}
                                        {renderEnvInput('Manager Password', 'LDAP_MANAGER_PASSWORD', 'password')}
                                    </div>
                                </div>

                                {/* ERP SSH & FTP */}
                                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
                                    <h3 className="font-bold text-slate-700 flex items-center gap-2 border-b pb-2">
                                        <Server size={18} /> ERP 連線設定 (SSH / FTP)
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2 text-xs font-bold text-brand-600 bg-brand-50 p-1">SSH Configuration (For Compile)</div>
                                        {renderEnvInput('Host', 'ERP_SSH_HOST')}
                                        {renderEnvInput('Port', 'ERP_SSH_PORT', 'number')}
                                        {renderEnvInput('Username', 'ERP_SSH_USERNAME')}
                                        {renderEnvInput('Password', 'ERP_SSH_PASSWORD', 'password')}

                                        <div className="col-span-2 text-xs font-bold text-brand-600 bg-brand-50 p-1 mt-2">FTP Configuration (For Upload)</div>
                                        {renderEnvInput('Host', 'ERP_FTP_HOST')}
                                        {renderEnvInput('Port', 'ERP_FTP_PORT', 'number')}
                                        {renderEnvInput('Username', 'ERP_FTP_USERNAME')}
                                        {renderEnvInput('Password', 'ERP_FTP_PASSWORD', 'password')}
                                    </div>
                                </div>

                                {/* Compile & DB */}
                                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
                                    <h3 className="font-bold text-slate-700 flex items-center gap-2 border-b pb-2">
                                        <Database size={18} /> ERP 資料庫 & 編譯設定
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2 text-xs font-bold text-brand-600 bg-brand-50 p-1">Compile Credentials</div>
                                        {renderEnvInput('Username', 'ERP_COMPILE_USER')}
                                        {renderEnvInput('Password', 'ERP_COMPILE_PASSWORD', 'password')}

                                        <div className="col-span-2 text-xs font-bold text-brand-600 bg-brand-50 p-1 mt-2">Oracle DB (Read Only)</div>
                                        {renderEnvInput('Host', 'ERP_DB_HOST')}
                                        {renderEnvInput('Port', 'ERP_DB_PORT', 'number')}
                                        {renderEnvInput('Service Name', 'ERP_DB_SERVICE_NAME')}
                                        {renderEnvInput('Instance Name', 'ERP_DB_INSTANCE_NAME')}
                                        {renderEnvInput('Username', 'ERP_DB_USER')}
                                        {renderEnvInput('Password', 'ERP_DB_USER_PASSWORD', 'password')}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Department Modal */}
            <Modal
                isOpen={isDeptModalOpen}
                onClose={() => setIsDeptModalOpen(false)}
                title={editingDept ? "編輯部門" : "新增部門"}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setIsDeptModalOpen(false)}>取消</Button>
                        <Button onClick={handleSaveDept}>儲存</Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-slate-700">部門代碼</label>
                        <input
                            className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                            value={deptForm.code}
                            onChange={e => setDeptForm({ ...deptForm, code: e.target.value })}
                            placeholder="例如: IT"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700">部門名稱</label>
                        <input
                            className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            value={deptForm.name}
                            onChange={e => setDeptForm({ ...deptForm, name: e.target.value })}
                            placeholder="例如: 資訊部"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700">描述</label>
                        <input
                            className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            value={deptForm.description}
                            onChange={e => setDeptForm({ ...deptForm, description: e.target.value })}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            className="rounded"
                            checked={deptForm.active}
                            onChange={e => setDeptForm({ ...deptForm, active: e.target.checked })}
                        />
                        <label className="text-sm font-medium text-slate-700">啟用</label>
                    </div>
                </div>
            </Modal>

            {/* Approvers Modal */}
            <Modal
                isOpen={isApproverModalOpen}
                onClose={() => setIsApproverModalOpen(false)}
                title={`簽核流程設定 - ${selectedDeptForApprovers?.name || ''}`}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setIsApproverModalOpen(false)}>取消</Button>
                        <Button onClick={handleSaveApprovers}>儲存流程</Button>
                    </>
                }
                className="max-w-2xl w-full"
            >
                <div>
                    <div className="mb-4 text-sm text-slate-500">
                        設定此部門的簽核順序。系統將依照順序進行簽核通知。
                    </div>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {approvers.map((app, index) => (
                            <div key={index} className="flex gap-2 items-end border p-3 rounded bg-slate-50">
                                <div className="w-16">
                                    <label className="text-xs font-bold text-slate-500 block mb-1">順序</label>
                                    <input
                                        type="number"
                                        className="w-full px-2 py-1 border rounded text-center text-sm"
                                        value={app.step_order}
                                        onChange={(e) => handleApproverChange(index, 'step_order', parseInt(e.target.value))}
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-slate-500 block mb-1">簽核人員</label>
                                    <select
                                        className="w-full px-2 py-1 border rounded text-sm"
                                        value={app.user_id || ''}
                                        onChange={(e) => handleApproverChange(index, 'user_id', e.target.value)}
                                    >
                                        <option value="">請選擇人員...</option>
                                        {users.map(u => (
                                            <option key={u.id} value={u.id}>{u.username} ({u.name})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex flex-col items-center px-2">
                                    <label className="text-xs font-bold text-slate-500 block mb-1">通知</label>
                                    <input
                                        type="checkbox"
                                        checked={app.notify}
                                        onChange={(e) => handleApproverChange(index, 'notify', e.target.checked)}
                                    />
                                </div>
                                <div className="flex flex-col items-center px-2">
                                    <label className="text-xs font-bold text-slate-500 block mb-1">有效</label>
                                    <input
                                        type="checkbox"
                                        checked={app.active !== 0 && app.active !== false}
                                        onChange={(e) => handleApproverChange(index, 'active', e.target.checked)}
                                    />
                                </div>
                                <Button size="sm" variant="ghost" className="text-red-500 mb-0.5" onClick={() => handleRemoveApproverRow(index)}>
                                    <Trash2 size={16} />
                                </Button>
                            </div>
                        ))}
                    </div>
                    <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={handleAddApproverRow}>
                        <PlusCircle size={14} className="mr-1" /> 新增簽核關卡
                    </Button>
                </div>
            </Modal>

            {/* Module Edit Modal */}
            <Modal
                isOpen={isModuleModalOpen}
                onClose={() => setIsModuleModalOpen(false)}
                title={editingModule ? "編輯模組" : "新增模組"}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setIsModuleModalOpen(false)}>取消</Button>
                        <Button onClick={handleSaveModule}>儲存</Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-slate-700">模組名稱 (Name)</label>
                            <input
                                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                value={moduleForm.name}
                                onChange={e => setModuleForm({ ...moduleForm, name: e.target.value })}
                                placeholder="例如: Check Manage"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">模組代碼 (Code)</label>
                            <input
                                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                value={moduleForm.code}
                                onChange={e => setModuleForm({ ...moduleForm, code: e.target.value.toUpperCase() })}
                                placeholder="例如: CE"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-slate-700">路徑代碼 (Path Code)</label>
                        <input
                            className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                            value={moduleForm.path_code}
                            onChange={e => setModuleForm({ ...moduleForm, path_code: e.target.value })}
                            placeholder="例如: ce (會替換 Base Path 中的 *)"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            將會自動生成路徑。
                        </p>
                    </div>

                    <div className="bg-slate-50 p-3 rounded border border-slate-200">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">預覽生成路徑 (Preview)</label>
                        <div className="space-y-2">
                            <div>
                                <span className="text-xs text-slate-400 block">Forms:</span>
                                <code className="text-xs font-mono text-slate-700 break-all">
                                    {globalPaths.form_base.replace('*', moduleForm.path_code || '???')}
                                </code>
                            </div>
                            <div>
                                <span className="text-xs text-slate-400 block">Reports:</span>
                                <code className="text-xs font-mono text-slate-700 break-all">
                                    {globalPaths.report_base.replace('*', moduleForm.path_code || '???')}
                                </code>
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>
        </React.Fragment >
    );
};
