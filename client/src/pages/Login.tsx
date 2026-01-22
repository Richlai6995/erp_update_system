import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import api from '../lib/api';
import { Cloud } from 'lucide-react';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [info, setInfo] = useState('');
    const [warning, setWarning] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();

    const navigate = useNavigate();
    const location = useLocation();

    // Type assertion for state
    const from = (location.state as any)?.from?.pathname || '/requests';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setInfo('');
        setWarning('');

        try {
            const { data } = await api.post('/auth/login', { username, password });
            login(data.token, data.user);
            navigate(from, { replace: true });
        } catch (err: any) {
            const msg = err.response?.data?.error || '登入失敗';
            if (msg.includes('第一次登入成功')) {
                setInfo(msg);
            } else if (msg.includes('失效') || msg.includes('停用')) {
                setWarning(msg);
            } else {
                setError(msg);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F0F4F9] p-4">
            <div className="w-full max-w-[420px]">
                <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-10 space-y-8">
                    <div className="text-center space-y-3">
                        <img src="/oracle_logo.png" alt="Oracle ERP" className="h-7 mb-2" />
                        <div className="space-y-1">
                            <h1 className="text-xl font-bold text-slate-800 tracking-tight">ORACLE ERP程式更新管理系統</h1>
                            <p className="text-slate-500 text-xs">使用AD帳號登入，無AD者請使用本系統申請帳號登入</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <Input
                            label="帳號"
                            value={username}
                            onChange={(e) => setUsername(e.target.value.toUpperCase())}
                            placeholder="請輸入帳號"
                            className="bg-white border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-11"
                            required
                        />
                        <Input
                            label="密碼"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="請輸入密碼"
                            className="bg-white border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-11"
                            required
                        />

                        {error && (
                            <div className="text-red-600 text-sm bg-red-50 border border-red-100 p-3 rounded-lg text-center flex items-center justify-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                {error}
                            </div>
                        )}
                        {info && (
                            <div className="text-green-600 text-sm bg-green-50 border border-green-100 p-3 rounded-lg text-center">
                                {info}
                            </div>
                        )}
                        {warning && (
                            <div className="text-amber-600 text-sm bg-amber-50 border border-amber-100 p-3 rounded-lg text-center">
                                {warning}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 rounded-lg shadow-lg shadow-blue-600/20 font-medium tracking-wide transition-all active:scale-[0.98]"
                            size="lg"
                            isLoading={isLoading}
                        >
                            登入系統
                        </Button>
                    </form>
                </div>
                <p className="text-center text-slate-400 mt-6 text-xs font-medium tracking-wider">
                    版本v1.0.0
                </p>
            </div>
        </div>
    );
}
