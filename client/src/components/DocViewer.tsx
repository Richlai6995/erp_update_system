import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import api from '../lib/api';
import { Book, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface DocViewerProps {
    isOpen: boolean;
    onClose: () => void;
}

// Simple Markdown Renderer
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
    if (!content) return null;

    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let listBuffer: React.ReactNode[] = [];

    const flushList = (keyPrefix: string) => {
        if (listBuffer.length > 0) {
            elements.push(<ul key={`${keyPrefix}-ul`} className="list-disc pl-5 mb-4 space-y-1">{[...listBuffer]}</ul>);
            listBuffer = [];
        }
    };

    lines.forEach((line, idx) => {
        const key = `line-${idx}`;

        // Header
        if (line.startsWith('# ')) {
            flushList(key);
            elements.push(<h1 key={key} className="text-2xl font-bold text-slate-900 mt-6 mb-4 pb-2 border-b border-slate-200">{line.replace('# ', '')}</h1>);
            return;
        }
        if (line.startsWith('## ')) {
            flushList(key);
            elements.push(<h2 key={key} className="text-xl font-bold text-slate-800 mt-5 mb-3">{line.replace('## ', '')}</h2>);
            return;
        }
        if (line.startsWith('### ')) {
            flushList(key);
            elements.push(<h3 key={key} className="text-lg font-bold text-slate-700 mt-4 mb-2">{line.replace('### ', '')}</h3>);
            return;
        }
        if (line.startsWith('#### ')) {
            flushList(key);
            elements.push(<h4 key={key} className="text-md font-bold text-slate-700 mt-3 mb-1">{line.replace('#### ', '')}</h4>);
            return;
        }

        // Horizontal Rule
        if (line.trim() === '---') {
            flushList(key);
            elements.push(<hr key={key} className="my-6 border-slate-200" />);
            return;
        }

        // List Item
        if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
            const text = line.trim().substring(2);
            // Process bold
            const parts = text.split(/(\*\*.*?\*\*)/g).map((part, pIdx) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
                }
                return part;
            });

            listBuffer.push(<li key={key} className="text-slate-700">{parts}</li>);
            return;
        }

        // Blockquote
        if (line.startsWith('> ')) {
            flushList(key);
            elements.push(
                <blockquote key={key} className="border-l-4 border-blue-500 bg-blue-50 p-3 my-4 text-slate-700 italic rounded-r">
                    {line.replace('> ', '')}
                </blockquote>
            );
            return;
        }

        // Normal Paragraph (flush list first)
        flushList(key);
        if (line.trim() === '') {
            // elements.push(<div key={key} className="h-2" />); // Spacer
            return;
        }

        // Process bold & inline code for normal text
        const processedLine = line.split(/(\*\*.*?\*\*|`.*?`)/g).map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={pIdx} className="text-slate-900">{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('`') && part.endsWith('`')) {
                return <code key={pIdx} className="bg-slate-100 px-1 py-0.5 rounded text-red-500 font-mono text-sm">{part.slice(1, -1)}</code>;
            }
            return part;
        });

        elements.push(<p key={key} className="mb-2 text-slate-600 leading-relaxed">{processedLine}</p>);
    });

    flushList('final'); // Flush any remaining list items

    return <div className="markdown-body p-2">{elements}</div>;
};

export const DocViewer: React.FC<DocViewerProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'user' | 'admin'>('user');
    const [content, setContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchDoc(activeTab);
        }
    }, [isOpen, activeTab]);

    const fetchDoc = async (type: 'user' | 'admin') => {
        setIsLoading(true);
        try {
            const { data } = await api.get(`/docs/${type}`);
            setContent(data.content);
        } catch (e) {
            setContent('# 無法載入文件\n請稍後再試。');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            className="max-w-4xl" // Widen the modal
            title={
                <div className="flex items-center gap-2">
                    <Book size={20} className="text-blue-600" />
                    <span>系統使用手冊</span>
                </div>
            }
            footer={<Button variant="ghost" onClick={onClose}>關閉</Button>}
        >
            <div className="flex flex-col h-[75vh]">
                <div className="flex gap-2 border-b border-slate-200 mb-4 pb-2 items-center">
                    <button
                        onClick={() => setActiveTab('user')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'user' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}
                    >
                        使用者手冊
                    </button>

                    <button
                        onClick={() => {
                            if (user?.role === 'admin') setActiveTab('admin');
                        }}
                        disabled={user?.role !== 'admin'}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 
                            ${activeTab === 'admin' ? 'bg-purple-50 text-purple-700' : 'text-slate-500'}
                            ${user?.role === 'admin' ? 'hover:bg-slate-100 cursor-pointer' : 'opacity-50 cursor-not-allowed'}
                        `}
                        title={user?.role === 'admin' ? '' : '僅限系統管理員閱覽'}
                    >
                        <ShieldAlert size={14} />
                        系統管理員手冊
                    </button>
                    <div className="flex-1" />
                </div>

                <div className="flex-1 overflow-y-auto bg-white rounded-lg border border-slate-100 p-8 shadow-inner">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full text-slate-400">
                            載入中...
                        </div>
                    ) : (
                        <MarkdownRenderer content={content} />
                    )}
                </div>
            </div>
        </Modal>
    );
};
