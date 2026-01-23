import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { io, Socket } from 'socket.io-client';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import 'xterm/css/xterm.css';

interface SQLPlusTerminalModalProps {
    isOpen: boolean;
    onClose: () => void;
    requestId: number;
    dbUser: string;
}

export default function SQLPlusTerminalModal({ isOpen, onClose, requestId, dbUser }: SQLPlusTerminalModalProps) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const socketRef = useRef<Socket | null>(null);
    const xtermRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const [isMaximized, setIsMaximized] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');

    useEffect(() => {
        if (!isOpen) return;

        // Initialize xterm
        const term = new XTerm({
            cursorBlink: true,
            theme: {
                background: '#1e1e1e',
                foreground: '#f0f0f0',
                cursor: '#ffffff'
            },
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            fontSize: 16 // SQLPlus terminal font size
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        if (terminalRef.current) {
            term.open(terminalRef.current);
            fitAddon.fit();
            term.focus();
        }

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Connect to Socket.IO
        const token = sessionStorage.getItem('token');
        const newSocket = io('/terminal', {
            auth: { token },
            transports: ['websocket']
        });

        socketRef.current = newSocket;

        newSocket.on('connect', () => {
            setConnectionStatus('connected');
            term.writeln('\x1b[32mConsidering connection established...\x1b[0m');
            // Start Session
            newSocket.emit('start-session', { requestId, dbUser });
        });

        newSocket.on('output', (data: string) => {
            term.write(data);
        });

        newSocket.on('error', (err: string) => {
            term.writeln(`\r\n\x1b[31mError: ${err}\x1b[0m`);
            setConnectionStatus('error');
        });

        newSocket.on('disconnect', () => {
            setConnectionStatus('disconnected');
            term.writeln('\r\n\x1b[33mConnection closed.\x1b[0m');
        });

        // Handle Input
        term.onData((data) => {
            if (newSocket.connected) {
                newSocket.emit('input', data);
            }
        });

        // Handle Resize
        const handleResize = () => {
            fitAddon.fit();
            if (connectionStatus === 'connected') {
                const { cols, rows } = term;
                newSocket.emit('resize', { cols, rows });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            // Cleanup
            newSocket.disconnect();
            term.dispose();
            window.removeEventListener('resize', handleResize);
            socketRef.current = null;
            xtermRef.current = null;
        };

    }, [isOpen, requestId, dbUser]); // Re-run if these change, though usually just isOpen toggles

    // Re-fit on maximize toggle
    useEffect(() => {
        if (isOpen && fitAddonRef.current) {
            setTimeout(() => fitAddonRef.current?.fit(), 100);
        }
    }, [isMaximized, isOpen]);


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className={`bg-slate-900 rounded-lg shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${isMaximized ? 'w-[98vw] h-[95vh]' : 'w-full max-w-5xl h-[80vh]'}`}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-800">
                    <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : connectionStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                        <h3 className="text-slate-200 font-mono text-sm">SQL*Plus - {dbUser}@{requestId}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsMaximized(!isMaximized)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                        >
                            {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-red-900/50 rounded transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Terminal Container */}
                <div className="flex-1 overflow-hidden relative" style={{ backgroundColor: '#1e1e1e' }}>
                    <div ref={terminalRef} className="absolute inset-2" />
                </div>
            </div>
        </div>
    );
}
