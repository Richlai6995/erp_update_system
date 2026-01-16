import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { Button } from './ui/Button';
import { Folder, File, Download, RefreshCw, FileText, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '../lib/utils';

interface FileItem {
    name: string;
    type: string; // 'd' | '-' | 'l'
    size: number;
    modifyTime: string;
    rawModifyTime: number;
}

interface Module {
    id: number;
    name: string;
    code: string;
}

export default function FileBrowser() {
    // Selection States
    const [modules, setModules] = useState<Module[]>([]);
    const [selectedModuleId, setSelectedModuleId] = useState<string>('');
    const [selectedType, setSelectedType] = useState<string>('Form');
    const [selectedSubtype, setSelectedSubtype] = useState<string>('fmb');

    // Data States
    const [currentPath, setCurrentPath] = useState('');
    const [files, setFiles] = useState<FileItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [sortConfig, setSortConfig] = useState<{ key: keyof FileItem; direction: 'asc' | 'desc' } | null>(null);

    useEffect(() => {
        fetchModules();
    }, []);

    const fetchModules = async () => {
        try {
            const res = await api.get('/erp-modules');
            setModules(res.data);
            if (res.data.length > 0) {
                // Optional: Select first by default
                // setSelectedModuleId(res.data[0].id.toString());
            }
        } catch (error) {
            console.error('Failed to fetch modules', error);
        }
    };

    const fetchFiles = async () => {
        if (!selectedModuleId) return;

        setIsLoading(true);
        try {
            const res = await api.post('/file-browser/list', {
                moduleId: selectedModuleId,
                type: selectedType,
                subtype: selectedSubtype
            });
            if (res.data.success) {
                setFiles(res.data.files);
                setCurrentPath(res.data.currentPath);
            }
        } catch (error) {
            console.error('Failed to list files:', error);
            alert('Failed to load files: ' + (error as any).message);
        } finally {
            setIsLoading(false);
            setSelected(new Set()); // Reset selection on change
        }
    };

    const handleSort = (key: keyof FileItem) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedFiles = React.useMemo(() => {
        if (!sortConfig) return files;
        return [...files].sort((a, b) => {
            let aValue = a[sortConfig.key];
            let bValue = b[sortConfig.key];

            if (sortConfig.key === 'modifyTime') {
                aValue = a.rawModifyTime;
                bValue = b.rawModifyTime;
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [files, sortConfig]);

    const toggleSelection = (name: string) => {
        const newSelected = new Set(selected);
        if (newSelected.has(name)) newSelected.delete(name);
        else newSelected.add(name);
        setSelected(newSelected);
    };

    const toggleSelectAll = () => {
        if (selected.size === files.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(files.map(f => f.name)));
        }
    };

    const handleDownload = () => {
        if (selected.size === 0) return;

        const filesToDownload = Array.from(selected);

        const query = new URLSearchParams();
        query.append('path', currentPath); // Still need path for download
        filesToDownload.forEach(f => query.append('files', f));

        window.open(`${api.defaults.baseURL || '/api'}/file-browser/download?${query.toString()}`, '_blank');
    };

    const handleExportCsv = () => {
        const headers = ['Name', 'Size', 'Type', 'Last Modified'];
        const rows = sortedFiles.map(f => [
            f.name,
            f.size,
            f.type === 'd' ? 'Directory' : f.type === '-' ? 'File' : 'Link',
            f.modifyTime
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `file_list_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-100 flex flex-col gap-3 bg-slate-50">
                <div className="flex flex-wrap gap-4 items-end">
                    {/* Module Select */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">模組 (Module)</label>
                        <select
                            value={selectedModuleId}
                            onChange={(e) => setSelectedModuleId(e.target.value)}
                            className="bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-brand-500 focus:border-brand-500 block w-48 p-2.5"
                        >
                            <option value="">選擇模組...</option>
                            {modules.map(m => (
                                <option key={m.id} value={m.id}>{m.code} - {m.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Type Select */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">程式類型 (Program Type)</label>
                        <select
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value)}
                            className="bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-brand-500 focus:border-brand-500 block w-40 p-2.5"
                        >
                            <option value="Form">Form</option>
                            <option value="Report">Report</option>
                            <option value="SQL">SQL</option>
                            <option value="Library">Library</option>
                        </select>
                    </div>

                    {/* Subtype Select (Only for Form) */}
                    {selectedType === 'Form' && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">檔案類型 (File Type)</label>
                            <select
                                value={selectedSubtype}
                                onChange={(e) => setSelectedSubtype(e.target.value)}
                                className="bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-brand-500 focus:border-brand-500 block w-32 p-2.5"
                            >
                                <option value="fmb">fmb (Source)</option>
                                <option value="fmx">fmx (Exec)</option>
                            </select>
                        </div>
                    )}

                    <Button
                        variant="primary"
                        onClick={fetchFiles}
                        disabled={!selectedModuleId || isLoading}
                        className="mb-[1px]"
                    >
                        <RefreshCw size={18} className={cn("mr-2", isLoading && "animate-spin")} />
                        Go
                    </Button>
                </div>

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200">
                    <div className="text-xs text-slate-500 font-mono">
                        {currentPath ? `Current Path: ${currentPath}` : '請選擇模組並點擊 Go'}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="primary"
                            disabled={selected.size === 0}
                            onClick={handleDownload}
                            className="gap-2 h-9 text-sm"
                        >
                            <Download size={16} />
                            下載 ({selected.size})
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={handleExportCsv}
                            className="gap-2 h-9 text-sm"
                        >
                            <FileText size={16} />
                            匯出 CSV
                        </Button>
                    </div>
                </div>
            </div>

            {/* File Table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 w-10">
                                <input
                                    type="checkbox"
                                    checked={files.length > 0 && selected.size === files.length}
                                    onChange={toggleSelectAll}
                                    className="rounded border-slate-300"
                                />
                            </th>
                            <th
                                className="px-4 py-3 font-medium text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors"
                                onClick={() => handleSort('name')}
                            >
                                <div className="flex items-center gap-1">
                                    檔案名稱
                                    {sortConfig?.key === 'name' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                </div>
                            </th>
                            <th
                                className="px-4 py-3 font-medium text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors w-32"
                                onClick={() => handleSort('size')}
                            >
                                <div className="flex items-center gap-1">
                                    大小
                                    {sortConfig?.key === 'size' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                </div>
                            </th>
                            <th
                                className="px-4 py-3 font-medium text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors w-32"
                                onClick={() => handleSort('type')}
                            >
                                <div className="flex items-center gap-1">
                                    類型
                                    {sortConfig?.key === 'type' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                </div>
                            </th>
                            <th
                                className="px-4 py-3 font-medium text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors w-64 whitespace-nowrap"
                                onClick={() => handleSort('modifyTime')}
                            >
                                <div className="flex items-center gap-1">
                                    最後修改時間
                                    {sortConfig?.key === 'modifyTime' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {sortedFiles.map(file => (
                            <tr key={file.name} className={cn("hover:bg-slate-50 transition-colors", selected.has(file.name) ? "bg-brand-50 hover:bg-brand-50" : "")}>
                                <td className="px-4 py-3">
                                    <input
                                        type="checkbox"
                                        checked={selected.has(file.name)}
                                        onChange={() => toggleSelection(file.name)}
                                        className="rounded border-slate-300"
                                    />
                                </td>
                                <td className="px-4 py-3 max-w-md truncate" title={file.name}>
                                    <div className="flex items-center gap-2 text-slate-900 truncate">
                                        {file.type === 'd' ? <Folder size={18} className="text-yellow-500 fill-yellow-500 flex-shrink-0" /> : <File size={18} className="text-slate-400 flex-shrink-0" />}
                                        <span className="font-medium truncate">
                                            {file.name}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-slate-600 tabular-nums">
                                    {file.type === 'd' ? '-' : formatSize(file.size)}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                    {file.type === 'd' ? '資料夾' : file.name.split('.').pop()?.toUpperCase() || '檔案'}
                                </td>
                                <td className="px-4 py-3 text-slate-600 tabular-nums whitespace-nowrap">
                                    {file.modifyTime}
                                </td>
                            </tr>
                        ))}
                        {files.length === 0 && !isLoading && (
                            <tr>
                                <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                                    {currentPath ? '目錄為空' : '請選擇模組並點擊 Go'}
                                </td>
                            </tr>
                        )}
                        {isLoading && (
                            <tr>
                                <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                                    載入中...
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer / Status Bar */}
            <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 text-xs text-slate-500 flex justify-between">
                <span>Total Items: {files.length}</span>
                <span>Selected: {selected.size}</span>
            </div>
        </div>
    );
}
