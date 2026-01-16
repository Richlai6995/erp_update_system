// (Applying large update to AdminDashboard in one block for coherence)
// I will rewrite the component logic to simplify.

import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import type { User } from '../types'; // Removed Group
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { cn } from '../lib/utils';
import { Plus, Edit2, Trash2, LogOut, CheckCircle, XCircle, Users, Settings, Folder } from 'lucide-react';
import { SystemManagement } from '../components/SystemManagement';

// Hardcoded Departments for now, or fetch from 'groups' if we treat groups as departments


export default function AdminDashboard() {
    const { logout, user: currentUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);

    // User Modal State
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [userFormData, setUserFormData] = useState<Partial<User>>({
        username: '', name: '', role: 'user', is_active: true, department: ''
    });
    const [password, setPassword] = useState('');

    // System Modal State
    const [isSystemManagementOpen, setIsSystemManagementOpen] = useState(false);

    const [isLoading, setIsLoading] = useState(false);

    // Fetch Data
    const fetchData = async () => {
        try {
            const [usersRes, deptsRes] = await Promise.all([
                api.get('/users'),
                api.get('/departments')
            ]);
            setUsers(usersRes.data);
            setDepartments(deptsRes.data);
        } catch (error) {
            console.error('Failed to fetch data', error);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // --- User Handlers ---
    const handleOpenUserModal = (user?: User) => {
        if (user) {
            setEditingUser(user);
            setUserFormData({
                ...user,
                is_active: !!user.is_active
            });
            setPassword('');
        } else {
            setEditingUser(null);
            setUserFormData({ username: '', name: '', role: 'user', is_active: true, email: '', employee_id: '', department: '' });
            setPassword('');
        }
        setIsUserModalOpen(true);
    };

    const handleUserSubmit = async () => {
        // Validation
        if (!userFormData.username || !userFormData.name) {
            alert('請填寫帳號與姓名');
            return;
        }

        setIsLoading(true);
        try {
            const payload = {
                ...userFormData,
                password: password || undefined,
            };

            if (editingUser) {
                await api.put(`/users/${editingUser.id}`, payload);
            } else {
                await api.post('/users', { ...payload, password });
            }
            setIsUserModalOpen(false);
            fetchData();
        } catch (error) {
            alert('Operation failed: ' + (error as any).response?.data?.error || 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteUser = async (id: number) => {
        if (!confirm('確認刪除此使用者?')) return;
        try {
            await api.delete(`/users/${id}`);
            fetchData();
        } catch (error) {
            alert('Delete failed');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold">ERP</div>
                    <h1 className="text-xl font-bold text-slate-800">ERP 更新管理後台</h1>
                </div>
                <div className="flex items-center gap-4">
                    <Button variant="secondary" size="sm" onClick={() => window.location.href = '/requests'}>
                        <Folder size={16} className="mr-2" /> 回到申請單
                    </Button>
                    <span className="text-sm text-slate-600">Admin: {currentUser?.name}</span>
                    <Button variant="ghost" size="sm" onClick={logout}>
                        <LogOut size={16} className="mr-2" /> 登出
                    </Button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6 space-y-6">
                {/* Actions Bar */}
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-slate-800">使用者管理</h2>
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => setIsSystemManagementOpen(true)}>
                            <Settings size={18} className="mr-2" /> 系統設定
                        </Button>
                        <Button onClick={() => handleOpenUserModal()}>
                            <Plus size={18} className="mr-2" /> 新增使用者
                        </Button>
                    </div>
                </div>

                {/* Users Table */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left bg-white">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                            <tr>
                                <th className="px-6 py-4">ID</th>
                                <th className="px-6 py-4">使用者資訊</th>
                                <th className="px-6 py-4">角色 / 部門</th>
                                <th className="px-6 py-4">狀態</th>
                                <th className="px-6 py-4 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-slate-500">#{user.id}</td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-900">{user.name}</div>
                                        <div className="text-xs text-slate-500">{user.username}</div>
                                        {user.email && <div className="text-xs text-slate-400">{user.email}</div>}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1 items-start">
                                            <span className={cn("px-2 py-1 rounded-full text-xs font-medium", {
                                                'bg-purple-100 text-purple-700': user.role === 'admin',
                                                'bg-blue-100 text-blue-700': user.role === 'pm' || user.role === 'dba',
                                                'bg-slate-100 text-slate-700': user.role === 'user'
                                            })}>
                                                {user.role === 'admin' ? '系統管理員' : (user.role === 'pm' || user.role === 'dba') ? 'DBA' : '一般用戶'}
                                            </span>
                                            {user.department && (
                                                <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 border flex items-center gap-1">
                                                    <Users size={10} /> {user.department}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="space-y-1">
                                            {user.is_active ? (
                                                <div className="flex items-center text-green-600 text-sm"><CheckCircle size={14} className="mr-1" /> 啟用</div>
                                            ) : (
                                                <div className="flex items-center text-slate-400 text-sm"><XCircle size={14} className="mr-1" /> 停用</div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => handleOpenUserModal(user)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-brand-600 transition-colors">
                                                <Edit2 size={16} />
                                            </button>
                                            {user.username !== 'ADMIN' && (
                                                <button onClick={() => handleDeleteUser(user.id)} className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors">
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>

            {/* User Modal */}
            <Modal
                isOpen={isUserModalOpen}
                onClose={() => setIsUserModalOpen(false)}
                title={editingUser ? '編輯使用者' : '新增使用者'}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setIsUserModalOpen(false)}>取消</Button>
                        <Button onClick={handleUserSubmit} isLoading={isLoading}>儲存</Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="帳號 (Username)"
                            value={userFormData.username}
                            onChange={e => setUserFormData({ ...userFormData, username: e.target.value })}
                            disabled={!!editingUser}
                        />
                        <Input
                            label="密碼"
                            type="password"
                            placeholder={editingUser ? '若是修改請留空' : '請設定密碼'}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="姓名"
                            value={userFormData.name}
                            onChange={e => setUserFormData({ ...userFormData, name: e.target.value })}
                        />
                        <Input
                            label="工號"
                            value={userFormData.employee_id || ''}
                            onChange={e => setUserFormData({ ...userFormData, employee_id: e.target.value })}
                        />
                    </div>
                    <Input
                        label="Email"
                        value={userFormData.email || ''}
                        onChange={e => setUserFormData({ ...userFormData, email: e.target.value })}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700">角色權限</label>
                            <select
                                className="w-full h-10 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                                value={userFormData.role}
                                onChange={e => setUserFormData({ ...userFormData, role: e.target.value as any })}
                            >
                                <option value="user">一般使用者 (User)</option>
                                <option value="dba">DBA</option>
                                <option value="admin">系統管理員 (Admin)</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700">所屬部門 (Department)</label>
                            <select
                                className="w-full h-10 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                                value={userFormData.department || ''}
                                onChange={e => setUserFormData({ ...userFormData, department: e.target.value })}
                            >
                                <option value="">請選擇部門...</option>
                                {departments.map(d => (
                                    <option key={d.id} value={d.name}>{d.name} ({d.code})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-6 pt-2">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="isActive"
                                checked={!!userFormData.is_active}
                                onChange={e => setUserFormData({ ...userFormData, is_active: e.target.checked })}
                                className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                            />
                            <label htmlFor="isActive" className="text-sm text-slate-700">啟用帳號</label>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* System Management Modal */}
            <SystemManagement
                isOpen={isSystemManagementOpen}
                onClose={() => {
                    setIsSystemManagementOpen(false);
                    fetchData();
                }}
            />
        </div>
    );
}
