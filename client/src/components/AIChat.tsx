import React, { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Send, X, Bot, User, RefreshCw, File, Folder, ChevronRight, ChevronDown, Download, FileSpreadsheet, FileImage, FileVideo, Music, FileCode, Check, Copy, FileText } from 'lucide-react';

interface AIChatProps {
    projectId: number;
    projectName: string;
    onClose: () => void;
}

interface Message {
    role: 'user' | 'ai';
    content: string;
    timestamp: string;
    files?: Array<{ name: string; url: string }>;
}

interface ChatSession {
    id: string;
    lastMessage: string;
    updatedAt: string;
}

interface ProjectFile {
    id: number;
    filename: string;
    folder_id: number | null;
}

interface ProjectFolder {
    id: number;
    name: string;
    parent_id: number | null;
}

const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'pdf':
            return <FileText size={14} className="text-red-500" />;
        case 'xls':
        case 'xlsx':
        case 'csv':
            return <FileSpreadsheet size={14} className="text-green-600" />;
        case 'doc':
        case 'docx':
            return <FileText size={14} className="text-blue-600" />;
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'svg':
        case 'webp':
            return <FileImage size={14} className="text-purple-600" />;
        case 'mp4':
        case 'mov':
        case 'avi':
            return <FileVideo size={14} className="text-orange-500" />;
        case 'mp3':
        case 'wav':
            return <Music size={14} className="text-pink-500" />;
        case 'js':
        case 'ts':
        case 'jsx':
        case 'tsx':
        case 'html':
        case 'css':
        case 'json':
            return <FileCode size={14} className="text-yellow-600" />;
        default:
            return <File size={14} className="text-slate-400" />;
    }
};

export const AIChat: React.FC<AIChatProps> = ({ projectId, projectName, onClose }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [model, setModel] = useState(() => localStorage.getItem('selected_ai_model') || 'gemini-3-pro-preview');

    // State for Copy Feedback
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    const handleCopy = (text: string, index: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    useEffect(() => {
        localStorage.setItem('selected_ai_model', model);
    }, [model]);

    // Context Selection
    const [availableFiles, setAvailableFiles] = useState<ProjectFile[]>([]);
    const [availableFolders, setAvailableFolders] = useState<ProjectFolder[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<ProjectFile[]>([]);

    // Collapsible State (Default Collapsed = Set is empty)
    const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());

    const toggleFolder = (folderId: number) => {
        const newSet = new Set(expandedFolders);
        if (newSet.has(folderId)) {
            newSet.delete(folderId);
        } else {
            newSet.add(folderId);
        }
        setExpandedFolders(newSet);
    };

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchSessions();
        fetchProjectStructure();
    }, [projectId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchSessions = async () => {
        try {
            const { data } = await api.get(`/ai/history/${projectId}`);
            setSessions(data);
        } catch (e) {
            console.error("Failed to fetch sessions", e);
        }
    };

    const fetchProjectStructure = async () => {
        try {
            const { data: files } = await api.get(`/files/project/${projectId}?all=true`);
            const { data: folders } = await api.get(`/folders/${projectId}?all=true`);

            setAvailableFiles(files);
            setAvailableFolders(folders);
        } catch (e) {
            console.error("Failed to fetch files", e);
        }
    };

    const loadSession = async (sessionId: string) => {
        try {
            const { data } = await api.get(`/ai/session/${projectId}/${sessionId}`);
            setMessages(data);
            setCurrentSessionId(sessionId);
        } catch (e) {
            console.error("Failed to load session", e);
        }
    };

    const startNewChat = () => {
        setMessages([]);
        setCurrentSessionId(null);
        setSelectedFiles([]);
    };

    const handleSendMessage = async () => {
        if (!input.trim() && selectedFiles.length === 0) return;

        const userMsg = input;
        setInput('');
        const newMessages: Message[] = [...messages, { role: 'user', content: userMsg, timestamp: new Date().toISOString() }];
        setMessages(newMessages);
        setIsLoading(true);

        try {
            const { data } = await api.post('/ai/chat', {
                projectId,
                message: userMsg,
                model,
                sessionId: currentSessionId,
                contextFiles: selectedFiles.map(f => f.id)
            });

            if (data.sessionId) {
                setCurrentSessionId(data.sessionId);
                // Update session list if new
                if (!sessions.find(s => s.id === data.sessionId)) {
                    fetchSessions();
                }
            }

            setMessages(prev => [...prev, {
                role: 'ai',
                content: data.response,
                timestamp: new Date().toISOString(),
                files: data.createdFiles
            }]);

            // If files created, maybe show a system message or just let them appear in the list?
            if (data.createdFiles && data.createdFiles.length > 0) {
                // Refresh file list
                fetchProjectStructure();
            }

            // DO NOT AUTO CLEAR SELECTED FILES (Keep Context)
            // setSelectedFiles([]); 

        } catch (e: any) {
            console.error(e);
            setMessages(prev => [...prev, { role: 'ai', content: `錯誤: ${e.response?.data?.error || e.message || "無法取得回應"}`, timestamp: new Date().toISOString() }]);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleFileSelection = (file: ProjectFile) => {
        if (selectedFiles.find(f => f.id === file.id)) {
            setSelectedFiles(prev => prev.filter(f => f.id !== file.id));
        } else {
            setSelectedFiles(prev => [...prev, file]);
        }
    };

    // Helper to render file tree
    const renderFileTree = (parentId: number | null = null, depth = 0) => {
        const currentFolders = availableFolders.filter(f => f.parent_id === parentId);
        const currentFiles = availableFiles.filter(f => f.folder_id === parentId);

        return (
            <div style={{ paddingLeft: depth * 12 }}>
                {currentFolders.map(folder => {
                    const isExpanded = expandedFolders.has(folder.id);
                    return (
                        <div key={`folder-${folder.id}`}>
                            <div
                                className="flex items-center gap-1 py-1 text-slate-600 text-sm font-medium cursor-pointer hover:bg-slate-100 rounded px-1"
                                onClick={() => toggleFolder(folder.id)}
                            >
                                {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                                <Folder size={14} className="text-yellow-500" />
                                <span className="truncate select-none">{folder.name}</span>
                            </div>
                            {isExpanded && renderFileTree(folder.id, depth + 1)}
                        </div>
                    );
                })}
                {currentFiles.map(file => (
                    <div
                        key={`file-${file.id}`}
                        className={`flex items-center gap-2 py-1 px-2 text-sm cursor-pointer rounded ${selectedFiles.find(f => f.id === file.id) ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
                        onClick={() => toggleFileSelection(file)}
                    >
                        <input
                            type="checkbox"
                            checked={!!selectedFiles.find(f => f.id === file.id)}
                            onChange={() => { }}
                            className="rounded border-slate-300"
                        />
                        {getFileIcon(file.filename)}
                        <span className="truncate">{file.filename}</span>
                    </div>
                ))}
            </div>
        );
    };

    const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        if (!confirm('確定要刪除此對話紀錄?')) return;

        try {
            await api.delete(`/ai/session/${projectId}/${sessionId}`);
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            if (currentSessionId === sessionId) {
                setCurrentSessionId(null);
                setMessages([]);
            }
        } catch (err) {
            console.error("Failed to delete session", err);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex overflow-hidden">

                {/* Sidebar - History & Context */}
                <div className="w-80 bg-slate-50 border-r border-slate-200 flex flex-col">
                    <div className="p-4 border-b border-slate-200 bg-white space-y-3">
                        <div className="flex justify-between items-center">
                            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                                <Bot size={20} className="text-brand-600" />
                                AI 智慧助手
                            </h2>
                            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full text-slate-500">
                                <X size={20} />
                            </button>
                        </div>
                        <Button
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                            onClick={() => {
                                setCurrentSessionId(null);
                                setMessages([]);
                                setInput('');
                                setSelectedFiles([]);
                            }}
                        >
                            <RefreshCw size={16} />
                            新對話
                        </Button>
                    </div>

                    {/* Chat History - Limited Height (e.g., 30%) */}
                    <div className="h-[30%] border-b border-slate-200 flex flex-col bg-slate-50">
                        <div className="px-4 pt-3 pb-2 text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <span className="bg-slate-200 w-full h-[1px]"></span>
                            <span className="whitespace-nowrap">歷史紀錄</span>
                            <span className="bg-slate-200 w-full h-[1px]"></span>
                        </div>
                        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
                            {sessions.map(session => (
                                <div
                                    key={session.id}
                                    onClick={() => loadSession(session.id)}
                                    className={`group p-2.5 rounded-md text-sm cursor-pointer border transition-all relative ${currentSessionId === session.id
                                        ? 'bg-white border-blue-200 shadow-sm text-blue-700'
                                        : 'bg-transparent border-transparent hover:bg-white hover:border-slate-200 hover:shadow-sm text-slate-600'
                                        }`}
                                >
                                    <div className="font-medium truncate pr-6">{session.lastMessage || '新對話'}</div>
                                    <div className="text-[10px] text-slate-400 mt-0.5 flex justify-between items-center">
                                        <span>{new Date(session.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <button
                                        onClick={(e) => handleDeleteSession(e, session.id)}
                                        className="absolute right-2 top-2.5 p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="刪除紀錄"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                            {sessions.length === 0 && (
                                <div className="text-center text-xs text-slate-300 py-4 italic">無歷史紀錄</div>
                            )}
                        </div>
                    </div>

                    {/* Context Files - Expands to fill rest */}
                    <div className="flex-1 flex flex-col bg-white min-h-0">
                        <div className="px-4 pt-3 pb-2 text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between items-center bg-slate-50 border-b border-slate-100">
                            <span>專案檔案</span>
                            <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                                {selectedFiles.length}
                            </span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            {renderFileTree(null)}
                        </div>
                    </div>
                </div>


                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col">
                    {/* Chat Header */}
                    <div className="h-14 border-b border-slate-200 flex items-center justify-between px-6 bg-white">
                        <div className="flex items-center gap-2">
                            <Bot className="text-brand-600" />
                            <span className="font-bold text-slate-700">{projectName} 助手</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-md text-sm px-2 py-1 outline-none focus:border-brand-500"
                            >
                                <option value="gemini-3-pro-preview">Gemini 3 Pro (Preview)</option>
                                <option value="gemini-3-flash-preview">Gemini 3 Flash (Fast & Smart)</option>
                            </select>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
                        {messages.length === 0 && (
                            <div className="text-center text-slate-400 mt-20">
                                <Bot size={48} className="mx-auto mb-4 opacity-20" />
                                <p>請從側邊欄選擇檔案並開始提問！</p>
                            </div>
                        )}
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex gap-4 group/message ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-slate-200' : 'bg-brand-100 text-brand-600'}`}>
                                    {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                                </div>
                                <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm whitespace-pre-wrap relative ${msg.role === 'user' ? 'bg-brand-600 text-white rounded-tr-none' : 'bg-white border border-slate-100 rounded-tl-none'}`}>
                                    {msg.content}

                                    {/* Copy Button */}
                                    <button
                                        onClick={() => handleCopy(msg.content, idx)}
                                        className={`absolute top-2 ${msg.role === 'user' ? 'left-2 text-white/50 hover:text-white' : 'right-2 text-slate-300 hover:text-slate-500'} opacity-0 group-hover/message:opacity-100 transition-opacity p-1`}
                                        title="複製文字"
                                    >
                                        {copiedIndex === idx ? <Check size={14} /> : <Copy size={14} />}
                                    </button>

                                    {msg.files && msg.files.map((file, fIdx) => (
                                        <div key={fIdx} className="mt-3 pt-3 border-t border-slate-100">
                                            <div className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-200">
                                                <div className="flex items-center gap-2 text-slate-700 text-sm font-medium">
                                                    <File size={16} className="text-blue-500" />
                                                    {file.name}
                                                </div>
                                                <a
                                                    href={file.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center gap-1 text-xs bg-white border border-slate-300 px-2 py-1 rounded hover:bg-slate-50 text-slate-600"
                                                >
                                                    <Download size={12} /> 下載
                                                </a>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex gap-4">
                                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center flex-shrink-0">
                                    <Bot size={16} />
                                </div>
                                <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-none p-4 shadow-sm animate-pulse">
                                    思考中...
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 bg-white border-t border-slate-200">
                        {selectedFiles.length > 0 && (
                            <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
                                {selectedFiles.map(f => (
                                    <div key={f.id} className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs whitespace-nowrap">
                                        <FileText size={12} />
                                        {f.filename}
                                        <button onClick={() => toggleFileSelection(f)} className="hover:text-blue-900"><X size={12} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex gap-2">
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                                placeholder="詢問關於專案檔案的問題..."
                                className="flex-1"
                            />
                            <Button onClick={handleSendMessage} disabled={isLoading || (!input && selectedFiles.length === 0)}>
                                <Send size={18} />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
