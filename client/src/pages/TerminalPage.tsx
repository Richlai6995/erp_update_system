import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import io, { Socket } from 'socket.io-client';
import 'xterm/css/xterm.css';
import { useAuth } from '../context/AuthContext';

export default function TerminalPage() {
    const { id } = useParams<{ id: string }>();
    const terminalRef = useRef<HTMLDivElement>(null);
    const socketRef = useRef<Socket | null>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    // const { token } = useAuth(); // AuthContext doesn't expose token
    const token = sessionStorage.getItem('token');
    const [status, setStatus] = useState('Connecting...');

    useEffect(() => {
        if (!id || !token || !terminalRef.current) return;

        // Init Terminal
        const term = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'Consolas, monospace',
            theme: {
                background: '#1e1e1e',
                foreground: '#f0f0f0'
            }
        });
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);

        // Fix: Wait for DOM render to populate dimensions
        // Increased timeout and added check to ensure terminal is visible
        setTimeout(() => {
            try {
                // simple check if element has width
                if (terminalRef.current && terminalRef.current.clientWidth > 0) {
                    fitAddon.fit();
                } else {
                    console.warn('Terminal container has 0 width, retrying fit...');
                    setTimeout(() => fitAddon.fit(), 500);
                }
            } catch (e) {
                console.warn('Xterm fit error:', e);
            }
        }, 200);

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Init Socket
        // Use relative path to leverage Vite Proxy (avoids mixed content / CORS / Port issues)
        const socket = io('/terminal', {
            auth: { token },
            transports: ['websocket', 'polling']
        });
        socketRef.current = socket;

        // Socket Events
        socket.on('connect', () => {
            console.log('[TerminalPage] Socket Connected:', socket.id);
            setStatus('Connected');
            term.write('\r\n\x1b[32m[System] Connected to Terminal Server.\x1b[0m\r\n');
            // Authenticate and Start
            socket.emit('start-session', {
                requestId: id,
                cols: term.cols,
                rows: term.rows
            });
        });

        socket.on('connect_error', (err) => {
            console.error('[TerminalPage] Connection Error:', err);
            setStatus('Connection Error');
            term.write(`\r\n\x1b[31m[System] Connection Failed: ${err.message}\x1b[0m\r\n`);
        });

        socket.on('disconnect', (reason) => {
            console.log('[TerminalPage] Disconnected:', reason);
            setStatus('Disconnected');
            term.write(`\r\n\x1b[31m[System] Disconnected: ${reason}\x1b[0m\r\n`);
        });

        socket.on('terminal-error', (msg: string) => {
            console.log('[TerminalPage] Server Error:', msg);
            term.write(`\r\n\x1b[31m[Error] ${msg}\x1b[0m\r\n`);
        });

        socket.on('output', (data: string) => {
            term.write(data);
        });

        socket.on('session-ended', () => {
            term.write('\r\n\x1b[33m[System] Session Ended.\x1b[0m\r\n');
            socket.disconnect();
        });

        // Terminal Events
        term.onData(data => {
            socket.emit('input', data);
        });

        term.onResize(size => {
            socket.emit('resize', { cols: size.cols, rows: size.rows });
        });

        // Window Resize
        const handleResize = () => fitAddon.fit();
        window.addEventListener('resize', handleResize);

        return () => {
            socket.disconnect();
            term.dispose();
            window.removeEventListener('resize', handleResize);
        };
    }, [id, token]);

    return (
        <div className="h-screen w-screen bg-[#1e1e1e] flex flex-col">
            <div className="h-8 bg-[#2d2d2d] flex items-center px-4 justify-between border-b border-[#3d3d3d]">
                <span className="text-gray-300 text-sm font-bold">SQL*Plus Web Terminal - Request #{id}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${status === 'Connected' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                    {status}
                </span>
            </div>
            <div className="flex-1 p-2 overflow-hidden" ref={terminalRef} id="terminal-container"></div>
        </div>
    );
}
