// client/src/pages/ChatPage.jsx

import { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Box, 
    Paper, 
    Typography, 
    TextField, 
    Button, 
    Select, 
    MenuItem, 
    FormControl, 
    InputLabel, 
    CircularProgress, 
    List, 
    ListItemButton, 
    ListItemText, 
    Divider,
    useTheme,
    useMediaQuery,
    IconButton,
    Avatar,
    Tooltip,
    Alert,
    Chip
} from '@mui/material';
import { Send as SendIcon, Add as AddIcon, ArrowBack as ArrowBackIcon, SmartToy as SmartToyIcon, Edit as EditIcon } from '@mui/icons-material';
import AssistantPicker from '../components/AssistantPicker';
import { keyframes } from '@emotion/react';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'; // optional icon

function ChatPage() {
    const [assistants, setAssistants] = useState([]);
    const [selectedAssistant, setSelectedAssistant] = useState('');
    const [chatThreads, setChatThreads] = useState([]);
    const [currentThread, setCurrentThread] = useState({ id: null, messages: [] });
    const [currentMessage, setCurrentMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [view, setView] = useState('history');
    const [editingThreadId, setEditingThreadId] = useState(null);
    const [editingTitle, setEditingTitle] = useState('');
    const [usage, setUsage] = useState(null); // { plan, monthKey, limit, used, remaining }

    const activeAssistant = useMemo(
        () => assistants.find(a => a.id === selectedAssistant),
        [assistants, selectedAssistant]
    );

    const assistantAvatar28 = useMemo(() => {
        if (!activeAssistant?.avatarUrl) return null;
        const fileName = activeAssistant.avatarUrl.split('/').pop() || '';
        const ida = fileName.replace('.png', '');
        const size = 28; // match the chat bubble avatar size
        return `/avatars/${ida}-72.png`;
    }, [activeAssistant]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    };

    const blink = keyframes`
        0% { opacity: .2; transform: translateY(0); }
        20% { opacity: 1; transform: translateY(-1px); }
        100% { opacity: .2; transform: translateY(0); }
    `;

    function ThinkingDots({ label = 'Thinking' }) {
        return (
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>{label}</Typography>
            <Box sx={{ display: 'inline-flex', gap: 0.5 }}>
                <Box component="span" sx={{ animation: `${blink} 1s infinite 0s` }}>•</Box>
                <Box component="span" sx={{ animation: `${blink} 1s infinite 0.2s` }}>•</Box>
                <Box component="span" sx={{ animation: `${blink} 1s infinite 0.4s` }}>•</Box>
            </Box>
            </Box>
        );
    }

    const fetchUsage = async () => {
        try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/usage`, { credentials: 'include' });
        if (res.ok) setUsage(await res.json());
        } catch (e) {
        console.error('Failed to fetch chat usage:', e);
        }
    };

    useEffect(() => { fetchUsage(); }, []);

    // All handler functions and useEffect hooks remain the same
    useEffect(() => {
        const fetchAssistants = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL}/api/assistants`, { credentials: 'include' });
                if (response.ok) {
                    const data = await response.json();
                    const fallbackAvatars = [
                        '/avatars/avatar1.png',
                        '/avatars/avatar2.png',
                        '/avatars/avatar3.png',
                        '/avatars/avatar4.png'
                    ];
                    const withPics = data.map((a, i) => ({
                        ...a,
                        avatarUrl: a.avatarUrl || fallbackAvatars[i % fallbackAvatars.length]
                    }));
                    setAssistants(withPics);
                    }
            } catch (error) { console.error("Failed to fetch assistants:", error); }
        };
        fetchAssistants();
    }, []);

    useEffect(() => {
        if (!selectedAssistant) return;
        const fetchThreads = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/threads/${selectedAssistant}`, { credentials: 'include' });
                if (response.ok) setChatThreads(await response.json());
            } catch (error) { console.error("Failed to fetch threads:", error); }
        };
        fetchThreads();
        handleNewChat();
    }, [selectedAssistant]);

    useEffect(() => {
        scrollToBottom();
    }, [currentThread.messages]);

    const handleNewChat = () => {
        setCurrentThread({ id: null, messages: [] });
        if (isMobile) setView('chat');
    };

    const handleRenameThread = async (threadId) => {
        if (!editingTitle.trim()) return;
        try {
            const res = await fetch(
            `${import.meta.env.VITE_API_URL}/api/chat/thread/${threadId}`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ title: editingTitle })
            }
            );
            if (res.ok) {
            // update local state
            setChatThreads((prev) =>
                prev.map(t =>
                t.openaiThreadId === threadId ? { ...t, title: editingTitle } : t
                )
            );
            }
        } catch (err) {
            console.error(err);
        } finally {
            setEditingThreadId(null);
        }
    };

    const handleSelectThread = async (thread) => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/thread/${thread.openaiThreadId}`, { credentials: 'include' });
            if (response.ok) {
                const messages = await response.json();
                setCurrentThread({ id: thread.openaiThreadId, messages: messages });
                if (isMobile) setView('chat');
            }
        } catch (error) { console.error("Failed to load thread history:", error); }
    };
    
    const handleSendMessage = async () => {
        if (!currentMessage.trim() || !selectedAssistant) return;
        if (usage && usage.remaining <= 0) {
            // hard stop if out of messages
            return;
        }

        const userMessage = { role: 'user', content: currentMessage };
        setCurrentThread(prev => ({ ...prev, messages: [...prev.messages, userMessage] }));
        const messageToSend = currentMessage;
        setCurrentMessage('');
        setIsLoading(true);

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ assistantId: selectedAssistant, message: messageToSend, threadId: currentThread.id }),
            });
            const data = await response.json();
            if (response.ok) {
                setCurrentThread(prev => ({ id: data.threadId, messages: [...prev.messages, { role: 'assistant', content: data.reply }] }));
                if (data.usage) setUsage(data.usage); else fetchUsage();
                if (!currentThread.id) { // If it was a new chat, refresh history
                    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/threads/${selectedAssistant}`, { credentials: 'include' });
                    if (res.ok) setChatThreads(await res.json());
                }
                } else if (data?.limitReached) {
                // revert the optimistic user message if the server rejected due to cap
                setCurrentThread(prev => ({ ...prev, messages: prev.messages.slice(0, -1) }));
                if (data.usage) setUsage(data.usage); else fetchUsage();
            }
        } catch (error) { console.error("Chat error:", error); } 
        finally { setIsLoading(false); }
    };

    const historySidebar = (
        <Paper elevation={2} sx={{ border: '1px solid #7cf4f871', width: { xs: '100%', md: '300px' }, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Chat History</Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={handleNewChat}>New</Button>
            </Box>
            <Divider />
            <List sx={{ overflowY: 'auto', flexGrow: 1 }}>
                {chatThreads.map(thread => (
                    <ListItemButton
                        key={thread.id}
                        selected={currentThread.id === thread.openaiThreadId}
                        onClick={() => handleSelectThread(thread)}
                    >
                        {editingThreadId === thread.openaiThreadId ? (
                        <TextField
                            value={editingTitle}
                            onChange={e => setEditingTitle(e.target.value)}
                            onBlur={() => handleRenameThread(thread.openaiThreadId)}
                            onKeyDown={e => {
                            if (e.key === 'Enter') {
                                handleRenameThread(thread.openaiThreadId);
                            }
                            }}
                            size="small"
                            autoFocus
                        />
                        ) : (
                        <>
                            <ListItemText
                            primary={thread.title}
                            primaryTypographyProps={{
                                noWrap: true,
                                style: { overflow: 'hidden', textOverflow: 'ellipsis' }
                            }}
                            secondary={new Date(thread.createdAt).toLocaleString()}
                            />
                            <IconButton
                            edge="end"
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                setEditingThreadId(thread.openaiThreadId);
                                setEditingTitle(thread.title);
                            }}
                            >
                            <EditIcon fontSize="small" />
                            </IconButton>
                        </>
                        )}
                    </ListItemButton>
                ))}
            </List>
        </Paper>
    );

    const chatWindow = (
        <Paper elevation={2} sx={{ border: '1px solid #7cf4f871', flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
            {isMobile && (
                <Box sx={{p: 1, borderBottom: '1px solid', borderColor: 'divider'}}>
                    <Button startIcon={<ArrowBackIcon />} onClick={() => setView('history')}>Back to History</Button>
                </Box>
            )}

            {isLoading && (
                <Box
                    sx={{
                    px: 2,
                    py: 1,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                    }}
                >
                    <Chip
                    size="small"
                    icon={<MoreHorizIcon fontSize="small" />}
                    label="Generating"
                    variant="outlined"
                    />
                    <Typography variant="caption" color="text.secondary">
                    Your assistant is composing a reply…
                    </Typography>
                </Box>
            )}
            
            {/* --- THIS IS THE SCROLLABLE CHAT AREA --- */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column' }}>
                {usage && usage.remaining <= 0 && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    You’ve reached your monthly chat limit ({usage.limit} messages for {usage.plan}).
                  </Alert>
                )}
                {/* --- THIS IS THE NEW LOGIC --- */}
                {currentThread.messages.length === 0 ? (
                    // Show this welcome message if the chat is empty
                    <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'text.secondary' }}>
                        <SmartToyIcon sx={{ fontSize: '4rem', mb: 2 }} color="primary" />
                        <Typography variant="h5">New Chat</Typography>
                        <Typography>How can I help you today?</Typography>
                    </Box>
                ) : (
                    // Otherwise, show the messages
                    <>
                        {currentThread.messages.map((msg, index) => (
                            <Box key={index} sx={{ mb: 2, display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                <Paper
                                    elevation={1}
                                    sx={{
                                        p: 1.5,
                                        borderRadius: 2,
                                        maxWidth: '80%',
                                        bgcolor: msg.role === 'user' ? 'primary.main' : 'background.paper',
                                        color: msg.role === 'user' ? 'primary.contrastText' : 'text.primary',
                                    }}
                                >
                                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                        {msg.content}
                                    </Typography>
                                </Paper>
                            </Box>
                        ))}
                    </>
                )}
                {isLoading && (
                    <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5 }}>
                        {/* Assistant avatar to match your chat UI */}
                        <Avatar src={assistantAvatar28} sx={{ width: 38, height: 38, '& img': { objectFit: 'cover' } }}>A</Avatar>

                        {/* Bubble */}
                        <Box
                        sx={{
                            px: 1.5,
                            py: 1,
                            borderRadius: 2,
                            bgcolor: 'action.hover',
                            border: '1px solid',
                            borderColor: 'divider',
                            maxWidth: '75%'
                        }}
                        >
                        <ThinkingDots label="Thinking" />
                        </Box>
                    </Box>
                    )}
                <div ref={messagesEndRef} />
            </Box>

            <Box component="form" sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }} onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}>
                <TextField fullWidth variant="outlined" placeholder="Enter your message..." value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)} disabled={isLoading || (usage && usage.remaining <= 0)} />
                <Button type="submit" variant="contained" endIcon={<SendIcon />} disabled={isLoading || (usage && usage.remaining <= 0)} sx={{ mt: 1 }}>Send</Button>
            </Box>
        </Paper>
    );

    return (
        <Box sx={{ height: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ mb: {sm: 3.5, lg: 5}, textAlign: 'center', display: 'flex', flexDirection: 'column',justifyContent: 'center', position: { sm: 'relative', lg: 'relative'} }}>
                <Typography variant="h3" fontWeight="bold" sx={{ background: '#7cdff8e3', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Chat</Typography>
                <Box sx={{mt:3.5, position: { sm: 'absolute', lg: 'absolute' }, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {/* <AssistantPicker
                        assistants={assistants}
                        value={selectedAssistant}
                        onChange={setSelectedAssistant}
                        onAddClick={() => window.location.href = '/assistants'} // or open your create flow
                    /> */}
                </Box>
            </Box>
            
            {!selectedAssistant ? (
                // ————————————————————————
                // Assistants “gallery” view
                <Box
                    sx={{
                    flexGrow: 1,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 4,
                    justifyContent: 'center',
                    alignItems: 'center',
                    p: 4
                    }}
                >
                    {assistants.map(a => {
                    const fileName = a.avatarUrl.split('/').pop();
                    const ida       = fileName.replace('.png','');
                    const size = 180;
                    const overlap = 20;

                    return(
                        <Box
                            key={a.id}
                            onClick={() => setSelectedAssistant(a.id)}
                            sx={{
                            textAlign: 'center',
                            cursor: 'pointer'
                            }}
                        >
                            <Avatar
                            src={`/avatars/${ida}-${size}.png`}
                            sx={{ width: size, height: size, border: '2px solid #7cf4f8', cursor: 'pointer', clipPath: `inset(-${overlap}px 0 0 0 round 50%)`,
                            // keep bottom edge flush
                            position: 'relative',  overflow: 'visible',
                            '& img': {
                                // lift the image up by the same amount
                                position: 'relative',
                                top: `-9px`,         
                                bottom: `-${overlap}px`,        
                                width: `calc(100% + ${overlap * 2}px)`,  
                                height: `auto`,  
                                minHeight: '100%',  
                                objectFit: 'cover',
                                clipPath: `inset(-${overlap}px 0 0 0 round 50%)`,
                            } }}
                            />
                            <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="body2" sx={{ mt: 0.5, textAlign: 'center', fontSize: '1rem', fontWeight: 550 }}>
                                {a.name}
                                </Typography>
                                {a.role && (
                                    <Typography variant="body1" color="textSecondary" sx={{ display: 'block' }}>
                                    ({a.role})
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    )
                    })}
                </Box>
                ) : (
                <>
                    {/* ————————————————————————————————————————————————————— */}
                    {/* Assistant picker dropdown, only visible once an assistant is selected */}
                    <Box
                    sx={{
                        mt: -16,
                        mb: -2,
                        mr: -3,
                        py: 1,
                        px: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'end'
                    }}
                    >
                        <Box sx={{display: 'flex', flexDirection: 'column'}}>
                            <AssistantPicker
                                assistants={assistants}
                                value={selectedAssistant}
                                onChange={setSelectedAssistant}
                            />
                        </Box>
                    </Box>

                    {/* ————————————————————————————————————————————————————— */}
                    {/* Your existing two‑column layout */}
                    <Box sx={{ display: 'flex', flexGrow: 1, gap: 2, overflow: 'hidden' }}>
                    {isMobile ? (
                        view === 'history' ? historySidebar : chatWindow
                    ) : (
                        <>
                        {historySidebar}
                        {chatWindow}
                        </>
                    )}
                    </Box>
                </>
                )}
            
        </Box>
    );
}

export default ChatPage;