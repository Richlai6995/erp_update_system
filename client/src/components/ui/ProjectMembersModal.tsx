import React, { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import api from '../../lib/api';
import type { User } from '../../types';
import { Trash2, UserPlus, Shield } from 'lucide-react';

interface Member {
    id: number;
    username: string;
    name: string;
    permission_level?: string;
    permissions?: Record<string, boolean>;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    projectId: number;
    canEdit: boolean;
    projectManagerId?: number;
}

export const ProjectMembersModal = ({ isOpen, onClose, projectId, canEdit, projectManagerId }: Props) => {
    const [members, setMembers] = useState<Member[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]); // For selection
    const [selectedUserId, setSelectedUserId] = useState<string>('');

    // Granular Permissions State
    const [permissions, setPermissions] = useState({
        view: true,
        upload: false,
        edit: false,
        delete: false,
        download: false
    });

    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchMembers();
            fetchUsers();
            // Reset state
            setPermissions({ view: true, upload: false, edit: false, delete: false, download: false });
            setSelectedUserId('');
        }
    }, [isOpen, projectId]);

    const fetchMembers = async () => {
        try {
            const { data } = await api.get(`/projects/${projectId}/members`);
            setMembers(data);
        } catch (e) {
            console.error(e);
        }
    };

    const fetchUsers = async () => {
        try {
            const { data } = await api.get('/users');
            setAllUsers(data);
        } catch (e) { }
    };

    const handlePermissionChange = (key: keyof typeof permissions) => {
        setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSelectAll = () => {
        const allSelected = Object.values(permissions).every(v => v);
        if (allSelected) {
            setPermissions({ view: true, upload: false, edit: false, delete: false, download: false });
        } else {
            setPermissions({ view: true, upload: true, edit: true, delete: true, download: true });
        }
    };

    const handleAddMember = async () => {
        if (!selectedUserId) return;
        try {
            await api.post(`/projects/${projectId}/members`, {
                user_id: parseInt(selectedUserId),
                permissions: permissions, // Send full object
                action: 'add'
            });
            fetchMembers();
            // Reset
            setSelectedUserId('');
            setPermissions({ view: true, upload: false, edit: false, delete: false, download: false });
        } catch (e) {
            alert('Failed to add member');
        }
    };

    const handleRemoveMember = async (userId: number) => {
        if (!confirm('Remove member?')) return;
        try {
            await api.post(`/projects/${projectId}/members`, {
                user_id: userId,
                action: 'remove'
            });
            fetchMembers();
        } catch (e) {
            alert('Failed to remove');
        }
    };

    // Helper to render badges
    const renderPermissionBadges = (perms: Record<string, boolean> | undefined) => {
        if (!perms) return <span className="text-gray-400">-</span>;

        // If all true
        if (Object.values(perms).every(Boolean)) return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">完全控制</span>;

        const labels: Record<string, string> = { view: '檢視', upload: '上傳', edit: '編輯', delete: '刪除', download: '下載' };
        return (
            <div className="flex flex-wrap gap-1">
                {Object.entries(perms).map(([key, val]) => {
                    if (!val) return null;
                    return (
                        <span key={key} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                            {labels[key] || key}
                        </span>
                    );
                })}
            </div>
        );
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="專案成員管理"
            footer={
                <Button variant="ghost" onClick={onClose}>關閉</Button>
            }
        >
            <div className="space-y-6">
                {/* Add Member Section - Only visible if canEdit */}
                {canEdit && (
                    <div className="bg-slate-50 p-4 rounded-lg space-y-3 border border-slate-100">
                        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <UserPlus size={16} /> 新增成員
                        </h3>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-500">選擇使用者</label>
                            <select
                                className="w-full h-9 rounded-md border-slate-300 text-sm focus:ring-brand-500 focus:border-brand-500"
                                value={selectedUserId}
                                onChange={e => setSelectedUserId(e.target.value)}
                            >
                                <option value="">請選擇...</option>
                                {allUsers.filter(u => !members.find(m => m.id === u.id)).map(u => (
                                    <option key={u.id} value={u.id}>{u.name} ({u.username})</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-medium text-slate-500">設定權限</label>
                                <button onClick={handleSelectAll} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                                    全選 / 取消
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { k: 'view', l: '檢視 (View)' },
                                    { k: 'upload', l: '上傳 (Upload)' },
                                    { k: 'download', l: '下載 (Download)' },
                                    { k: 'edit', l: '編輯 (Edit)' },
                                    { k: 'delete', l: '刪除 (Delete)' }
                                ].map(({ k, l }) => (
                                    <label key={k} className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded border border-slate-200 hover:border-brand-300 transition-colors cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={permissions[k as keyof typeof permissions]}
                                            onChange={() => handlePermissionChange(k as keyof typeof permissions)}
                                            className="w-3.5 h-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                        />
                                        <span className="text-xs text-slate-700">{l}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="pt-1 flex justify-end">
                            <Button size="sm" onClick={handleAddMember} disabled={!selectedUserId}>
                                加入專案
                            </Button>
                        </div>
                    </div>
                )}

                {/* Member List */}
                <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b">
                            <tr>
                                <th className="px-4 py-2 text-left font-medium text-slate-600">姓名</th>
                                <th className="px-4 py-2 text-left font-medium text-slate-600">擁有權限</th>
                                <th className="px-4 py-2 text-right font-medium text-slate-600">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {members.map(m => (
                                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-slate-800">{m.name}</div>
                                        <div className="text-xs text-slate-400">{m.username}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {/* Display Badges */}
                                        {renderPermissionBadges(m.permissions)}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {canEdit && (
                                            <button
                                                onClick={() => handleRemoveMember(m.id)}
                                                disabled={m.id === projectManagerId}
                                                className={`p-1.5 rounded transition-colors ${m.id === projectManagerId ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                                                title={m.id === projectManagerId ? "專案管理者不能被移除" : "移除成員"}
                                            >
                                                {m.id === projectManagerId ? <Shield size={16} /> : <Trash2 size={16} />}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {members.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-4 py-8 text-center text-slate-400 text-xs">
                                        此專案尚無其他成員
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
