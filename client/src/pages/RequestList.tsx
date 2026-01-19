import React, { useEffect, useState } from 'react';
import { DocViewer } from '../components/DocViewer';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Button } from '../components/ui/Button';
import { Plus, FileText, LogOut, Settings, User as UserIcon, List, FolderOpen, Search, X, Download, Book as BookIcon } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import FileBrowser from '../components/FileBrowser';

interface Request {
    id: number;
    form_id: string;
    apply_date: string;
    status: string;
    applicant_name: string;
    module_code: string;
    description: string;
    program_type: string;
}

export default function RequestList() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [requests, setRequests] = useState<Request[]>([]);
    const [filter, setFilter] = useState('all');
    const [activeTab, setActiveTab] = useState<'requests' | 'files'>('requests');
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [isDocViewerOpen, setIsDocViewerOpen] = useState(false);

    // Search Options State
    const [formIdOptions, setFormIdOptions] = useState<string[]>([]);
    const [userOptions, setUserOptions] = useState<{ name: string, username: string }[]>([]);
    const [deptOptions, setDeptOptions] = useState<{ name: string }[]>([]);

    const [searchParams, setSearchParams] = useState({
        form_id: '',
        start_date: '',
        end_date: '',
        applicant: '',
        department: '',
        program_type: '',
        file_keyword: ''
    });

    useEffect(() => {
        // Fetch Search Options
        const fetchOptions = async () => {
            try {
                // 1. Form IDs
                const resForm = await api.get('/requests/options');
                setFormIdOptions(resForm.data.form_ids || []);

                // 2. Users (Basic Settings) - Exclude ADMIN
                const resUsers = await api.get('/users');
                // Filter out 'ADMIN' username (case insensitive check just in case)
                const validUsers = (resUsers.data || []).filter((u: any) => u.username?.toUpperCase() !== 'ADMIN');
                setUserOptions(validUsers);

                // 3. Departments (Basic Settings)
                const resDepts = await api.get('/departments');
                setDeptOptions(resDepts.data || []);
            } catch (e) {
                console.error("Failed to fetch search options", e);
            }
        };
        fetchOptions();
    }, []);

    useEffect(() => {
        if (activeTab === 'requests') {
            fetchRequests();
        }
    }, [activeTab]);

    const fetchRequests = async () => {
        try {
            // Remove empty keys
            const params: any = {};
            Object.keys(searchParams).forEach(key => {
                const k = key as keyof typeof searchParams;
                if (searchParams[k]) params[k] = searchParams[k];
            });

            const res = await api.get('/requests', { params });
            setRequests(res.data);
        } catch (error) {
            console.error('Failed to fetch requests', error);
        }
    };

    const handleSearch = () => {
        fetchRequests();
    };

    const handleClearSearch = () => {
        setSearchParams({
            form_id: '',
            start_date: '',
            end_date: '',
            applicant: '',
            department: '',
            program_type: '',
            file_keyword: ''
        });
        // We need to trigger fetch after state update, or just call fetch with empty params directly
        // Because setState is async, we can't just call fetchRequests() immediately if it depends on state.
        // Quick fix: call api directly here or use effect dependency (but we don't want auto-search on every keystroke).
        // Best: Pass empty to fetchRequests or force reload.
        // Simpler: Just reload page or duplicate fetch logic.
        // Or: set state and add a specialized useEffect for search trigger? No.

        // Actually, let's just use the api directly for clear.
        api.get('/requests').then(res => setRequests(res.data));
    };

    const handleExport = async () => {
        const params: any = {
            status: filter // Include current tab filter
        };
        Object.keys(searchParams).forEach(key => {
            const k = key as keyof typeof searchParams;
            if (searchParams[k]) params[k] = searchParams[k];
        });

        const queryString = new URLSearchParams(params as any).toString();
        const url = `/requests/export?${queryString}`;

        try {
            const res = await api.get(url, {
                responseType: 'blob'
            });

            // Configured in api.ts to use sessionStorage token via interceptor
            const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `requests_export_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
        } catch (e: any) {
            console.error(e);
            let errMsg = '匯出失敗';
            // If blob response, we might need to read it to get text error
            if (e.response?.data instanceof Blob) {
                try {
                    const text = await e.response.data.text();
                    errMsg += ': ' + text;
                } catch (err) { /* ignore */ }
            } else if (e.response?.data) {
                errMsg += ': ' + JSON.stringify(e.response.data);
            } else if (e.message) {
                errMsg += ': ' + e.message;
            }
            alert(errMsg);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'draft': return 'bg-slate-100 text-slate-600 border-slate-200';
            case 'reviewing': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'approved': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'online': return 'bg-green-100 text-green-700 border-green-200';
            case 'manager_rejected': return 'bg-red-100 text-red-700 border-red-200';
            case 'dba_rejected': return 'bg-red-100 text-red-700 border-red-200';
            case 'void': return 'bg-gray-100 text-gray-500 border-gray-200';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    const StatusBadge = ({ status, programType }: { status: string, programType?: string }) => {
        const labels: any = {
            draft: '開立 (Open)',
            reviewing: '簽核中 (Reviewing)',
            approved: '已核准 (Approved)',
            online: programType === 'Terminal Access' ? 'DBA 核准 (DBA Approved)' : '已上線 (Online)',
            manager_rejected: '主管退回 (Manager Rejected)',
            dba_rejected: 'DBA 退回 (DBA Rejected)',
            void: '已作廢 (Void)'
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(status)}`}>
                {labels[status] || status}
            </span>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold">ERP</div>
                    <h1 className="text-xl font-bold text-slate-800">ERP 程式更新申請</h1>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <UserIcon size={16} />
                        <span className="font-medium">{user?.name}</span>
                    </div>

                    {user?.role === 'admin' && (
                        <button
                            onClick={() => navigate('/admin')}
                            className="flex items-center gap-2 text-sm text-slate-600 hover:text-brand-600 transition-colors"
                        >
                            <Settings size={18} />
                            <span>系統管理</span>
                        </button>
                    )}

                    <button
                        onClick={() => setIsDocViewerOpen(true)}
                        className="flex items-center gap-2 text-sm text-slate-600 hover:text-brand-600 transition-colors mr-2"
                        title="系統使用手冊"
                    >
                        <BookIcon size={18} />
                        <span className="hidden md:inline">使用手冊</span>
                    </button>

                    <button
                        onClick={logout}
                        className="flex items-center gap-2 text-sm text-slate-600 hover:text-red-600 transition-colors"
                    >
                        <LogOut size={18} />
                        <span>登出</span>
                    </button>
                </div>
            </header>

            {/* Tabs */}
            <div className="bg-white border-b border-slate-200 px-6 flex gap-6">
                <button
                    onClick={() => setActiveTab('requests')}
                    className={cn(
                        "flex items-center gap-2 py-3 px-1 text-sm font-medium border-b-2 transition-colors",
                        activeTab === 'requests'
                            ? "border-brand-600 text-brand-600"
                            : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                    )}
                >
                    <List size={18} />
                    申請單列表
                </button>
                <button
                    onClick={() => setActiveTab('files')}
                    className={cn(
                        "flex items-center gap-2 py-3 px-1 text-sm font-medium border-b-2 transition-colors",
                        activeTab === 'files'
                            ? "border-brand-600 text-brand-600"
                            : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                    )}
                >
                    <FolderOpen size={18} />
                    ERP檔案查詢與下載
                </button>
            </div>

            {/* Main Content */}
            <main className="flex-1 w-full px-6 py-6 overflow-hidden flex flex-col">
                {activeTab === 'requests' ? (
                    <>
                        <div className="flex items-center justify-between mb-4 mt-2">
                            <div className="flex gap-2">
                                <Button
                                    variant={isSearchExpanded ? "primary" : "secondary"}
                                    onClick={() => setIsSearchExpanded(!isSearchExpanded)}
                                >
                                    <Search size={18} className="mr-2" /> 查詢條件
                                </Button>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="secondary" onClick={handleExport}>
                                    <Download className="mr-2" size={18} /> 匯出 CSV
                                </Button>
                                <Button onClick={() => navigate('/requests/new')}>
                                    <Plus className="mr-2" size={18} /> 建立申請單
                                </Button>
                            </div>
                        </div>

                        {/* Search Panel */}
                        {isSearchExpanded && (
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 transition-all duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1 block">申請單號</label>
                                        <input
                                            list="form_ids"
                                            className="w-full px-3 py-2 border rounded text-sm"
                                            placeholder="單號..."
                                            value={searchParams.form_id}
                                            onChange={e => setSearchParams({ ...searchParams, form_id: e.target.value })}
                                        />
                                        <datalist id="form_ids">
                                            {formIdOptions.map(id => <option key={id} value={id} />)}
                                        </datalist>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1 block">申請日期區間</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="date"
                                                className="w-full px-2 py-2 border rounded text-xs"
                                                value={searchParams.start_date}
                                                onChange={e => setSearchParams({ ...searchParams, start_date: e.target.value })}
                                            />
                                            <input
                                                type="date"
                                                className="w-full px-2 py-2 border rounded text-xs"
                                                value={searchParams.end_date}
                                                onChange={e => setSearchParams({ ...searchParams, end_date: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1 block">申請人</label>
                                        <input
                                            list="applicants"
                                            className="w-full px-3 py-2 border rounded text-sm"
                                            placeholder="姓名..."
                                            value={searchParams.applicant}
                                            onChange={e => setSearchParams({ ...searchParams, applicant: e.target.value })}
                                        />
                                        <datalist id="applicants">
                                            {userOptions.map(u => <option key={u.username} value={u.name}>{u.username}</option>)}
                                        </datalist>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1 block">申請部門</label>
                                        <input
                                            list="departments"
                                            className="w-full px-3 py-2 border rounded text-sm"
                                            placeholder="部門..."
                                            value={searchParams.department}
                                            onChange={e => setSearchParams({ ...searchParams, department: e.target.value })}
                                        />
                                        <datalist id="departments">
                                            {deptOptions.map(d => <option key={d.name} value={d.name} />)}
                                        </datalist>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1 block">程式類別 (Type)</label>
                                        <select
                                            className="w-full px-3 py-2 border rounded text-sm"
                                            value={searchParams.program_type}
                                            onChange={e => setSearchParams({ ...searchParams, program_type: e.target.value })}
                                        >
                                            <option value="">全部</option>
                                            <option value="Form">Form (畫面)</option>
                                            <option value="Report">Report (報表)</option>
                                            <option value="SQL">SQL</option>
                                            <option value="Library">Library</option>
                                            <option value="DB Object">DB Object</option>
                                        </select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-xs font-medium text-slate-500 mb-1 block">檔案/Object名稱 (File Name)</label>
                                        <input
                                            className="w-full px-3 py-2 border rounded text-sm"
                                            placeholder="輸入檔案名稱或 Object 名稱..."
                                            value={searchParams.file_keyword}
                                            onChange={e => setSearchParams({ ...searchParams, file_keyword: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex items-end gap-2">
                                        <Button onClick={handleSearch} className="flex-1">
                                            <Search size={16} className="mr-1" /> 查詢
                                        </Button>
                                        <Button variant="secondary" onClick={handleClearSearch}>
                                            <X size={16} />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden w-full">
                            {/* Filters */}
                            <div className="p-4 border-b border-slate-100 flex gap-2">
                                {[
                                    { key: 'all', label: '全部' },
                                    { key: 'draft', label: '開立' },
                                    { key: 'reviewing', label: '簽核中' },
                                    { key: 'approved', label: '已審核' },
                                    { key: 'online', label: '已上線' },
                                    { key: 'manager_rejected', label: '主管退回' },
                                    { key: 'dba_rejected', label: 'DBA退回' }
                                ].map(f => (
                                    <button
                                        key={f.key}
                                        onClick={() => setFilter(f.key)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                                            filter === f.key
                                                ? "bg-brand-50 text-brand-700"
                                                : "text-slate-600 hover:bg-slate-50"
                                        )}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>

                            {/* List */}
                            <div className="divide-y divide-slate-100">
                                {requests.filter(r => filter === 'all' || r.status === filter).map(request => (
                                    <div
                                        key={request.id}
                                        onClick={() => navigate(`/requests/${request.id}`)}
                                        className="p-4 hover:bg-slate-50 transition-colors cursor-pointer group"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                <span className="font-mono text-sm font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                                                    {request.form_id}
                                                </span>
                                                <StatusBadge status={request.status} programType={request.program_type} />
                                                <span className="text-xs text-slate-400">
                                                    {new Date(request.apply_date).toLocaleString('sv').replace(' ', ' ')}
                                                </span>
                                            </div>
                                            <div className="text-slate-400 group-hover:text-brand-600 transition-colors">
                                                <FileText size={18} />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-12 gap-4">
                                            <div className="col-span-8">
                                                <h3 className="font-medium text-slate-900 mb-1">
                                                    [{request.module_code}] {request.program_type}
                                                </h3>
                                                <p className="text-slate-500 text-sm line-clamp-1">
                                                    {request.description || '無詳細說明'}
                                                </p>
                                            </div>
                                            <div className="col-span-4 text-right">
                                                <span className="text-sm text-slate-600">
                                                    申請人: <span className="font-medium text-slate-900">{request.applicant_name}</span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {requests.length === 0 && (
                                    <div className="p-12 text-center text-slate-400">
                                        尚無申請資料
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="h-[calc(100vh-140px)]">
                        <FileBrowser />
                    </div>
                )}
            </main>
            <DocViewer isOpen={isDocViewerOpen} onClose={() => setIsDocViewerOpen(false)} />
        </div>
    );
}
