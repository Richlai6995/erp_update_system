import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Plus, Trash2, Save, RefreshCw, Key } from 'lucide-react';

interface DBUser {
    id: string;
    username: string;
    description: string;
    password?: string; // Optional for UI (empty = no change)
}

export const DBUserManagement: React.FC = () => {
    const [users, setUsers] = useState<DBUser[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const res = await api.get('/admin/settings/db-users');
            setUsers(res.data || []);
            setHasChanges(false);
        } catch (e) {
            console.error("Fetch failed", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddUser = () => {
        const newUser: DBUser = {
            id: Date.now().toString(),
            username: '',
            description: '',
            password: ''
        };
        setUsers([...users, newUser]);
        setHasChanges(true);
    };

    const handleChange = (id: string, field: keyof DBUser, value: string) => {
        setUsers(users.map(u => u.id === id ? { ...u, [field]: value } : u));
        setHasChanges(true);
    };

    const handleDelete = (id: string) => {
        if (!confirm('確認刪除此連線設定?')) return;
        setUsers(users.filter(u => u.id !== id));
        setHasChanges(true);
    };

    const handleSave = async () => {
        // Validation
        const invalid = users.some(u => !u.username);
        if (invalid) return alert('使用者名稱為必填');

        setIsLoading(true);
        try {
            await api.post('/admin/settings/db-users', users);
            alert('設定已儲存');
            fetchUsers(); // Refresh to ensure clean state
        } catch (e: any) {
            alert('儲存失敗: ' + (e.response?.data?.error || e.message));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="text-sm text-slate-500">
                    管理可用於 SQL Terminal 連線的資料庫帳號與密碼。密碼欄位留空表示不修改。
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={fetchUsers}>
                        <RefreshCw size={16} className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} /> 重新整理
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={!hasChanges || isLoading}>
                        <Save size={16} className="mr-2" /> 儲存變更
                    </Button>
                </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b text-slate-600 font-medium">
                        <tr>
                            <th className="px-4 py-3 w-48">Username</th>
                            <th className="px-4 py-3 w-48">Password</th>
                            <th className="px-4 py-3">Description</th>
                            <th className="px-4 py-3 w-20 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {users.map(user => (
                            <tr key={user.id} className="hover:bg-slate-50">
                                <td className="px-4 py-2">
                                    <Input
                                        value={user.username}
                                        onChange={e => handleChange(user.id, 'username', e.target.value)}
                                        placeholder="Username (e.g. apps)"
                                        className="h-8 text-sm"
                                    />
                                </td>
                                <td className="px-4 py-2 relative">
                                    <div className="relative">
                                        <Key size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <Input
                                            type="password"
                                            value={user.password || ''}
                                            onChange={e => handleChange(user.id, 'password', e.target.value)}
                                            placeholder="Change Password..."
                                            className="h-8 text-sm pl-8"
                                        />
                                    </div>
                                </td>
                                <td className="px-4 py-2">
                                    <Input
                                        value={user.description}
                                        onChange={e => handleChange(user.id, 'description', e.target.value)}
                                        placeholder="Description"
                                        className="h-8 text-sm"
                                    />
                                </td>
                                <td className="px-4 py-2 text-right">
                                    <button onClick={() => handleDelete(user.id)} className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr><td colSpan={4} className="text-center py-8 text-slate-400">尚無設定</td></tr>
                        )}
                    </tbody>
                </table>
                <div className="p-3 bg-slate-50 border-t border-slate-200">
                    <Button variant="ghost" size="sm" onClick={handleAddUser} className="text-brand-600 hover:bg-brand-50 w-full justify-center">
                        <Plus size={16} className="mr-2" /> 新增帳號 (Add DB User)
                    </Button>
                </div>
            </div>
        </div>
    );
};
