import { useState, useEffect } from 'react';
import { 
    Grid, 
    Paper, 
    Typography, 
    Box, 
    List,
    ListItem,
    ListItemText,
    FormControl, 
    Select, 
    MenuItem, 
    CircularProgress, 
    ButtonBase,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Divider,
    TableContainer,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    IconButton,
    Collapse,
    Alert, // Added for ConversationRow
    TextareaAutosize // Added for ConversationRow
} from '@mui/material';
import { 
    KeyboardArrowDown as KeyboardArrowDownIcon, 
    KeyboardArrowUp as KeyboardArrowUpIcon,
    Check as CheckIcon,
    FiberManualRecord as UnreadIcon,
    Refresh as RefreshIcon,
    AutoAwesome as AiIcon,
    Send as SendIcon // Added for ConversationRow
} from '@mui/icons-material';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import AssistantPicker from '../components/AssistantPicker';
import { useUser } from '../contexts/UserContext';
import { Link } from 'react-router-dom';

// This is a new component for a single expandable row in our table
function ConversationRow(props) {
    const { row, assistantId, refreshThreads, isMobile} = props;
    const [open, setOpen] = useState(false);
    const [details, setDetails] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [aiReply, setAiReply] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSending, setIsSending] = useState(false); // <-- New state for sending
    const [sendStatus, setSendStatus] = useState(''); // 'success' or 'error'
    const [extractedData, setExtractedData] = useState(null);

    const fetchThreadDetails = async () => {
        if (open) {
            setOpen(false);
            return;
        }
        setIsLoading(true);
        try {
            const response = await fetch(
              `${import.meta.env.VITE_API_URL}/api/thread/${assistantId}/${row.id}`,
              { credentials: 'include' }
            );
            if (response.ok) {
                const data = await response.json();
                setDetails(data);
                setOpen(true);
            }
        } catch (error) {
            console.error("Failed to fetch thread details:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // fetches thread messages without toggling open
    const fetchThreadMessages = async () => {
        try {
            const response = await fetch(
              `${import.meta.env.VITE_API_URL}/api/thread/${assistantId}/${row.id}`,
              { credentials: 'include' }
            );
            if (response.ok) {
                const data = await response.json();
                setDetails(data);
                refreshThreads();
            }
        } catch (error) {
            console.error("Failed to fetch thread messages:", error);
        }
    };

    // poll messages every 30s when expanded
    /* useEffect(() => {
        if (!open) return;
        fetchThreadMessages();  // initial load when opened
        const interval = setInterval(fetchThreadMessages, 90000);
        return () => clearInterval(interval);
    }, [open, assistantId, row.id]); */

     // The standard reply generator
    const handleGenerateReply = async () => {
        setIsGenerating(true);
        setAiReply('');
        setExtractedData(null);
        const conversationText = details.map(m => `From: ${m.from}\n\n${m.body}`).join('\n\n---\n\n');
        try {
            const replyRes = await fetch(`${import.meta.env.VITE_API_URL}/api/generate-reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ conversation: conversationText, assistantId: assistantId }),
            });
            if (replyRes.ok) setAiReply((await replyRes.json()).reply);
        } catch (error) { console.error("AI reply error:", error); } 
        finally { setIsGenerating(false); }
    };

    const handleScanAndReply = async () => {
        setIsGenerating(true);
        setAiReply('');
        setExtractedData(null);
        const lastMessage = details[details.length - 1];
        if (!lastMessage) return setIsGenerating(false);

        try {
            // Step 1: Extract Data
            const extractRes = await fetch(`${import.meta.env.VITE_API_URL}/api/extract-data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ text: lastMessage.body }),
            });
            const extracted = await extractRes.json();
            if (!extractRes.ok) throw new Error(extracted.message);
            setExtractedData(extracted);

            // Step 2: Generate Reply using a more informed prompt
            const conversationText = details.map(m => `From: ${m.from}\n\n${m.body}`).join('\n\n---\n\n');
            const replyPrompt = `A potential customer named '${extracted.name || 'this person'}' (email: ${extracted.email || 'unknown'}) sent an inquiry. Based on the full conversation thread below, draft a professional reply. \n\nCONVERSATION:\n"""${conversationText}"""`;

            const replyRes = await fetch(`${import.meta.env.VITE_API_URL}api/generate-reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ conversation: replyPrompt, assistantId: assistantId }),
            });
            if (replyRes.ok) setAiReply((await replyRes.json()).reply);
            
        } catch (error) { console.error("Scan and reply error:", error); } 
        finally { setIsGenerating(false); }
    };

    const handleSendReply = async () => {
        setIsSending(true);
        setSendStatus('');
        try {
            const finalRecipient = extractedData?.email || row.from; // Use extracted email if available
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/send-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ assistantId, threadId: row.id, replyText: aiReply, recipient: finalRecipient }),
            });
            if (!response.ok) throw new Error('Failed to send');
            setSendStatus('success');
            refreshThreads();
        } catch (error) { setSendStatus('error'); } 
        finally { setIsSending(false); }
    };

    if (isMobile) {
        return (
            <Paper variant="outlined" sx={{ mb: 1 }}>
                <ListItem button onClick={fetchThreadDetails} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ overflow: 'hidden', flexGrow: 1, pr: 1 }}>
                        <ListItemText
                            primary={row.subject}
                            secondary={`From: ${row.from}`}
                            primaryTypographyProps={{ fontWeight: 'bold', overflowWrap: 'break-word' }}
                        />
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, overflowWrap: 'break-word' }}>{row.snippet}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pl: 1 }}>
                         {isLoading ? <CircularProgress size={20} /> : (open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />)}
                        {row.status === 'unread' && <Tooltip title="Unread"><UnreadIcon color="primary" sx={{ fontSize: '14px', mt: 1 }} /></Tooltip>}
                        {row.status === 'opened' && <Tooltip title="Opened"><CheckIcon color="success" sx={{ fontSize: '18px', mt: 1 }} /></Tooltip>}
                    </Box>
                </ListItem>
                <Collapse in={open} timeout="auto" unmountOnExit>
                    {/* This is the same detailed view content from the original component */}
                    <Box sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.12)' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="h6" gutterBottom component="div">Conversation History</Typography>
                            <Box sx={{display: 'flex', gap: 1}}>
                                <Button variant="outlined" size="small" startIcon={<AiIcon />} disabled={isGenerating} onClick={handleGenerateReply}>{isGenerating ? 'Generating...' : 'Generate Reply'}</Button>
                                <Button variant="contained" size="small" startIcon={<AiIcon />} disabled={isGenerating} onClick={handleScanAndReply}>{isGenerating ? 'Scanning...' : 'Scan Form & Reply'}</Button>
                            </Box>
                        </Box>
                        {extractedData && <Paper variant="outlined" sx={{ p: 2, my: 2, bgcolor: '#e3f2fd' }}><Typography variant="subtitle2" sx={{ mb: 1 }}>Extracted Data:</Typography><Typography component="pre" sx={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>{JSON.stringify(extractedData, null, 2)}</Typography></Paper>}
                        {aiReply && <Paper variant="outlined" sx={{ p: 2, my: 2 }}><Typography variant="subtitle2" sx={{ mb: 1 }}>Suggested Reply:</Typography><TextareaAutosize minRows={5} style={{ width: '100%', padding: '8px' }} value={aiReply} onChange={(e) => setAiReply(e.target.value)} /><Box sx={{ mt: 1, display: 'flex', gap: 1 }}><Button variant="contained" color="primary" startIcon={<SendIcon />} disabled={isSending} onClick={handleSendReply}>{isSending ? 'Sending...' : 'Send Email'}</Button></Box>{sendStatus === 'success' && <Alert severity="success" sx={{mt:1}}>Email sent successfully!</Alert>}{sendStatus === 'error' && <Alert severity="error" sx={{mt:1}}>Failed to send email.</Alert>}</Paper>}
                        {details.map((message) => <Paper key={message.id} variant="outlined" sx={{ p: 2, mb: 2 }}><Typography variant="subtitle2" component="div"><strong>From:</strong> {message.from}</Typography><Divider sx={{ my: 1 }} /><Typography component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.9rem' }}>{message.body}</Typography></Paper>)}
                    </Box>
                </Collapse>
            </Paper>
        );
    }

    return (
        <>
            <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
                <TableCell>
                    <IconButton aria-label="expand row" size="small" onClick={fetchThreadDetails}>
                        {isLoading ? <CircularProgress size={20} /> : (open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />)}
                    </IconButton>
                </TableCell>
                <TableCell component="th" scope="row">{row.from}</TableCell>
                <TableCell>{row.subject}</TableCell>
                <TableCell>{row.snippet}</TableCell>
                <TableCell align="right" sx={{width: '60px'}}>
                    {/* --- THIS IS THE NEW STATUS LOGIC --- */}
                    {row.status === 'unread' && (
                        <Tooltip title="Unread">
                            <UnreadIcon color="primary" sx={{ fontSize: '14px' }} />
                        </Tooltip>
                        )}
                        {row.status === 'opened' && (
                        <Tooltip title="Opened">
                            <CheckIcon color="success" sx={{ fontSize: '18px' }} />
                        </Tooltip>
                    )}
                </TableCell>
            </TableRow>
            <TableRow>
                <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
                    <Collapse in={open} timeout="auto" unmountOnExit>
                        <Box sx={{ margin: 1, p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="h6" gutterBottom component="div">Conversation History</Typography>
                                {/* --- NEW: Two distinct buttons --- */}
                                <Box sx={{display: 'flex', gap: 1}}>
                                    <Button variant="outlined" size="small" startIcon={<AiIcon />} disabled={isGenerating} onClick={handleGenerateReply}>
                                        {isGenerating ? 'Generating...' : 'Generate Reply'}
                                    </Button>
                                    <Button variant="contained" size="small" startIcon={<AiIcon />} disabled={isGenerating} onClick={handleScanAndReply}>
                                        {isGenerating ? 'Scanning...' : 'Scan Form & Reply'}
                                    </Button>
                                </Box>
                            </Box>
                            {extractedData && <Paper variant="outlined" sx={{ p: 2, my: 2, bgcolor: '#e3f2fd' }}><Typography variant="subtitle2" sx={{ mb: 1 }}>Extracted Data:</Typography><Typography component="pre" sx={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>{JSON.stringify(extractedData, null, 2)}</Typography></Paper>}
                            {aiReply && <Paper variant="outlined" sx={{ p: 2, my: 2 }}><Typography variant="subtitle2" sx={{ mb: 1 }}>Suggested Reply:</Typography><TextareaAutosize minRows={5} style={{ width: '100%', padding: '8px' }} value={aiReply} onChange={(e) => setAiReply(e.target.value)} /><Box sx={{ mt: 1, display: 'flex', gap: 1 }}><Button variant="contained" color="primary" startIcon={<SendIcon />} disabled={isSending} onClick={handleSendReply}>{isSending ? 'Sending...' : 'Send Email'}</Button></Box>{sendStatus === 'success' && <Alert severity="success" sx={{mt:1}}>Email sent successfully!</Alert>}{sendStatus === 'error' && <Alert severity="error" sx={{mt:1}}>Failed to send email.</Alert>}</Paper>}
                            {details.map((message) => <Paper key={message.id} variant="outlined" sx={{ p: 2, mb: 2 }}><Typography variant="subtitle2" component="div"><strong>From:</strong> {message.from}</Typography><Divider sx={{ my: 1 }} /><Typography component="div" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.9rem', wordBreak: 'break-all' }}>{message.body}</Typography></Paper>)}
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
        </>
    );
}

// StatCard component
const StatCard = ({ title, value, description, children, onClick, titleColor = 'primary.main', descColor = 'text.secondary' }) => (
    <ButtonBase
        onClick={onClick}
        sx={{
            width: '100%',
            height: '100%',
            minHeight: { xs: 280, sm: 320, lg: 380 },
            minWidth: { xs: 340, sm: 380, lg: 500 },
            textAlign: 'left',
            p: 0,
            ml: 1,
            borderRadius: 3,
            '&:hover': {
                transform: 'translateY(-6px)',
                boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
            },
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
    >
        <Paper 
            elevation={0}
            sx={{ 
                p: { xs: 3, sm: 4 }, 
                display: 'flex', 
                flexDirection: 'column', 
                height: '100%', 
                width: '100%', 
                borderRadius: 3,
                bgcolor: 'background.paper',
                border: '1px solid #7cf4f871',
                cursor: 'pointer',
                '&:hover': {
                    bgcolor: 'action.hover',
                }
            }}
        >
            <Typography 
                component="h2" 
                variant="h6" 
                gutterBottom
                sx={{ 
                    fontSize: { xs: '1.1rem', sm: '1.25rem' },
                    fontWeight: 600,
                    mb: 2,
                    color: titleColor,
                    textShadow: '0 0 8px rgba(124,244,248,.45)'
                }}
            >
                {title}
            </Typography>
            {children ? (
                <Box sx={{ flexGrow: 1, pt: 1 }}>{children}</Box>
            ) : (
                <>
                    <Typography 
                        component="p" 
                        variant="h4" 
                        fontWeight="bold"
                        sx={{ 
                            fontSize: { xs: '2.5rem', sm: '3rem' },
                            color: 'primary.main',
                            mb: 2,
                            textShadow: '0 0 8px rgba(124,244,248,.45)'
                        }}
                    >
                        {value}
                    </Typography>
                    <Typography 
                        sx={{ 
                            flexGrow: 1, 
                            fontSize: { xs: '1rem', sm: '1.1rem' },
                            lineHeight: 1.6,
                            color: descColor
                        }}
                    >
                        {description}
                    </Typography>
                </>
            )}
        </Paper>
    </ButtonBase>
);

// Modal component
const DetailModal = ({ open, onClose, title, content }) => (
    <Dialog 
        open={open} 
        onClose={onClose} 
        maxWidth={title === 'Conversation Inbox' ? 'lg' : 'md'}
        fullWidth
        PaperProps={{
            sx: {
                borderRadius: 3,
                bgcolor: '#494963ff',
                color: '#7cdff8e3',
                backgroundImage: 'none',
                boxShadow: 6,
                maxHeight: '90vh'
            }
        }}
    >
        <DialogTitle sx={{ pb: 1 }}>
            <Typography variant="h5" component="h2">
                {title}
            </Typography>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3 }}>
            {content}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
            <Button onClick={onClose} variant="contained" color="primary">
                Close
            </Button>
        </DialogActions>
    </Dialog>
);

function DashboardPage() {
    const [assistants, setAssistants] = useState([]);
    const [selectedAssistant, setSelectedAssistant] = useState('');
    const [stats, setStats] = useState(null);
    const [dailyChartData, setDailyChartData] = useState([]);
    const [hourlyChartData, setHourlyChartData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [trackingStats, setTrackingStats] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState({ title: '', content: null });
    const { user } = useUser();
    const hasPlan = ['active', 'cancelled_grace_period'].includes(user?.subscriptionStatus);
    const [timeFilter, setTimeFilter] = useState('today');
    const [filteredRepliesCount, setFilteredRepliesCount] = useState(0);
    const [isFilterLoading, setIsFilterLoading] = useState(false);
    
    // New states for email tracking
    const [trackingTimeFilter, setTrackingTimeFilter] = useState('all');
    const [filteredTrackingStats, setFilteredTrackingStats] = useState(null);
    const [isTrackingFilterLoading, setIsTrackingFilterLoading] = useState(false);
    const [threads, setThreads] = useState([]);
    const [isThreadsLoading, setIsThreadsLoading] = useState(false);

    // Fetch assistants
    useEffect(() => {
        const fetchAssistants = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL}/api/assistants`, { credentials: 'include' });
                if (response.ok) {
                    const data = await response.json();
                    const fallbackAvatars = ['/avatars/avatar1.png', '/avatars/avatar2.png', '/avatars/avatar3.png', '/avatars/avatar4.png'];
                    const withPics = data.map((a, i) => ({
                        ...a,
                        avatarUrl: a.avatarUrl || fallbackAvatars[i % fallbackAvatars.length]
                    }));
                    setAssistants(withPics);
                    if (withPics.length > 0) setSelectedAssistant(withPics[0].id);
                    else setIsLoading(false);
                }
            } catch (error) { 
                setIsLoading(false); 
            }
        };
        fetchAssistants();
    }, []);

    // Fetch dashboard data
    useEffect(() => {
        if (!selectedAssistant) return;
        const fetchDashboardData = async () => {
            setIsLoading(true);
            try {
                const [statsRes, dailyChartRes, hourlyChartRes, trackingRes] = await Promise.all([
                    fetch(`${import.meta.env.VITE_API_URL}/api/stats/${selectedAssistant}`, { credentials: 'include' }),
                    fetch(`${import.meta.env.VITE_API_URL}/api/stats/chart/${selectedAssistant}`, { credentials: 'include' }),
                    fetch(`${import.meta.env.VITE_API_URL}/api/stats/hourly/${selectedAssistant}`, { credentials: 'include' }),
                    fetch(`${import.meta.env.VITE_API_URL}/api/stats/tracking/${selectedAssistant}`, { credentials: 'include' })
                ]);
                if (statsRes.ok) setStats(await statsRes.json());
                if (dailyChartRes.ok) setDailyChartData(await dailyChartRes.json());
                if (hourlyChartRes.ok) setHourlyChartData(await hourlyChartRes.json());
                if (trackingRes.ok) {
                    const data = await trackingRes.json();
                    setTrackingStats(data);
                    setFilteredTrackingStats(data);
                }
            } catch (error) { 
                console.error("Failed to fetch dashboard data:", error); 
            } finally { 
                setIsLoading(false); 
            }
        };
        fetchDashboardData();
    }, [selectedAssistant]);

    // Fetch filtered replies
    useEffect(() => {
        if (!selectedAssistant) return;
        const fetchFilteredReplies = async () => {
            setIsFilterLoading(true);
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL}/api/stats/${selectedAssistant}?period=${timeFilter}`, { credentials: 'include' });
                if (response.ok) {
                    const data = await response.json();
                    setFilteredRepliesCount(data.count);
                }
            } catch (error) {
                console.error("Failed to fetch filtered replies:", error);
                setFilteredRepliesCount(0);
            } finally {
                setIsFilterLoading(false);
            }
        };
        fetchFilteredReplies();
    }, [selectedAssistant, timeFilter]);

    // Fetch filtered tracking stats
    useEffect(() => {
        if (!selectedAssistant) return;
        const fetchFilteredTrackingStats = async () => {
            setIsTrackingFilterLoading(true);
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL}/api/stats/tracking/${selectedAssistant}?period=${trackingTimeFilter}`, { credentials: 'include' });
                if (response.ok) {
                    const data = await response.json();
                    setFilteredTrackingStats(data);
                }
            } catch (error) {
                console.error("Failed to fetch filtered tracking stats:", error);
            } finally {
                setIsTrackingFilterLoading(false);
            }
        };
        fetchFilteredTrackingStats();
    }, [selectedAssistant, trackingTimeFilter]);

    // Fetch threads
    const fetchThreads = async () => {
        if (!selectedAssistant) return;
        setIsThreadsLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/threads/${selectedAssistant}`, { credentials: 'include' });
            if (res.ok) setThreads(await res.json());
        } catch (e) {
            console.error("Failed to fetch threads:", e);
        } finally {
            setIsThreadsLoading(false);
        }
    };

    const emailTrackingData = [
        { name: 'Opened', value: filteredTrackingStats?.totalOpened ?? 0 },
        { name: 'Unopened', value: (filteredTrackingStats?.totalSent ?? 0) - (filteredTrackingStats?.totalOpened ?? 0) },
    ];

    const COLORS = ['#7e57c2', '#e0e0e0'];

    // Modal handlers
    const handleCardClick = async (cardType) => {
        let title = '';
        let content = null;

        switch (cardType) {
            case 'total':
                title = 'Total Replies Sent Details';
                content = (
                    <Box>
                        <Typography variant="h4" gutterBottom>{stats?.totalEmailsHandled ?? 0}</Typography>
                        <Typography variant="body1" color="text.secondary" paragraph>
                            This represents the total number of email replies your assistant has sent since it was created.
                        </Typography>
                    </Box>
                );
                break;
            case 'week':
                title = 'Last 7 Days Activity';
                content = (
                    <Box>
                        <Typography variant="h4" gutterBottom>{stats?.emailsLast7Days ?? 0}</Typography>
                        <Typography variant="body1" color="text.secondary" paragraph>
                            Email replies sent in the past 7 days
                        </Typography>
                        <Box sx={{ mt: 2, height: 300 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dailyChartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="emails" fill="#7e57c2" />
                                </BarChart>
                            </ResponsiveContainer>
                        </Box>
                    </Box>
                );
                break;
            case 'today':
                title = 'Today\'s Activity';
                content = (
                    <Box>
                        <Typography variant="h4" gutterBottom>{stats?.emailsToday ?? 0}</Typography>
                        <Typography variant="body1" color="text.secondary" paragraph>
                            Email replies sent since midnight today
                        </Typography>
                    </Box>
                );
                break;
            case 'engagement':
                await fetchThreads();
                const assistant = assistants.find(a => a.id === selectedAssistant);
                title = 'Conversation Inbox';
                content = (
                    <Box sx={{ minHeight: '500px' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6">
                                {assistant?.name ? `${assistant.name}'s Inbox` : 'Conversation Inbox'}
                            </Typography>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<RefreshIcon />}
                                onClick={fetchThreads}
                            >
                                Refresh
                            </Button>
                        </Box>
                        {isThreadsLoading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                <CircularProgress />
                            </Box>
                        ) : threads.length > 0 ? (
                            <TableContainer component={Paper} variant="outlined">
                                <Table aria-label="collapsible table">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell />
                                            <TableCell>From</TableCell>
                                            <TableCell>Subject</TableCell>
                                            <TableCell>Snippet</TableCell>
                                            <TableCell />
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {threads.map((row) => (
                                            <ConversationRow key={row.id} row={row} assistantId={selectedAssistant} refreshThreads={fetchThreads} />
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        ) : (
                            <Typography variant="body2" color="text.secondary">
                                No conversation threads found.
                            </Typography>
                        )}
                    </Box>
                );
                break;
            case 'daily':
                title = 'Daily Activity Pattern';
                content = (
                    <Box>
                        <Typography variant="body1" color="text.secondary" paragraph>
                            Your assistant's activity over the past 7 days
                        </Typography>
                        <Box sx={{ mt: 2, height: 400 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dailyChartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="emails" fill="#7e57c2" />
                                </BarChart>
                            </ResponsiveContainer>
                        </Box>
                    </Box>
                );
                break;
            case 'hourly':
                title = 'Peak Hours Analysis';
                content = (
                    <Box>
                        <Typography variant="body1" color="text.secondary" paragraph>
                            Hours when your assistant is most active
                        </Typography>
                        <Box sx={{ mt: 2, height: 400 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={hourlyChartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="hour" />
                                    <YAxis />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="emails" stroke="#8884d8" strokeWidth={2} />
                                </LineChart>
                            </ResponsiveContainer>
                        </Box>
                    </Box>
                );
                break;
        }

        setModalContent({ title, content });
        setModalOpen(true);
    };

    return (
        <Box>
           <Box sx={{ mb: {sm: 2, lg: 5.7}, mt: {lg: 3}, textAlign: 'center', display: 'flex', flexDirection: 'column',justifyContent: 'center', position: { sm: 'relative', lg: 'relative'} }}>
                <Typography variant="h3" fontWeight="bold" sx={{  mb: 1, background: '#7cdff8e3', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Dashboard</Typography>
                <Box sx={{ position: { lg: 'absolute' }, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {assistants.length > 0 && (
                        <AssistantPicker
                            assistants={assistants}
                            value={selectedAssistant}
                            onChange={setSelectedAssistant}
                        />
                    )}
                </Box>
            </Box>

            {isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <CircularProgress />
                </Box>
            ) : !selectedAssistant ? (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                    {hasPlan ? (
                        <>
                        <Typography variant="h6" gutterBottom>
                            To view analytics, add your first assistant.
                        </Typography>
                        <Button component={Link} to="/assistants" variant="contained" sx={{ mt: 2 }}>
                            Create an Assistant
                        </Button>
                        </>
                    ) : (
                        <>
                        <Typography variant="h6" gutterBottom>
                            To view analytics, you'll need to add an assistant — but first, choose a plan.
                        </Typography>
                        <Button component={Link} to="/billing" variant="contained" sx={{ mt: 2 }}>
                            Go to Billing
                        </Button>
                        </>
                    )}
                </Paper>
            ) : (
                <Grid container spacing={4} sx={{ minHeight: '80vh' }}>
                    {/* Top Row - 3 cards */}
                    <Grid item xs={12} sm={6} lg={4} sx={{ display: 'flex' }}>
                        <StatCard title="Replies Sent" onClick={() => handleCardClick('total')}>
                            <FormControl variant="standard" size="small" sx={{ position: 'absolute', top: 24, right: 24, minWidth: 120, zIndex: 10 }} onClick={(e) => e.stopPropagation()}>
                                <Select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)} MenuProps={{ PaperProps: { sx: { bgcolor: 'background.paper', backgroundImage: 'none' }}}}>
                                    <MenuItem value="today">Today</MenuItem>
                                    <MenuItem value="week">Last 7 Days</MenuItem>
                                    <MenuItem value="4weeks">Last 4 Weeks</MenuItem>
                                    <MenuItem value="3months">Last 3 Months</MenuItem>
                                    <MenuItem value="6months">Last 6 Months</MenuItem>
                                    <MenuItem value="year">Last Year</MenuItem>
                                    <MenuItem value="all">All Time</MenuItem>
                                </Select>
                            </FormControl>
                            <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {isFilterLoading ? (
                                    <CircularProgress />
                                ) : (
                                    <Typography component="p" variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '2.5rem', sm: '3rem' }, color: 'primary.main', textShadow: '0 0 8px rgba(124,244,248,.45)' }}>
                                        {filteredRepliesCount}
                                    </Typography>
                                )}
                            </Box>
                        </StatCard>
                    </Grid>
                    <Grid item xs={12} sm={6} lg={4} sx={{ display: 'flex' }}>
                        <StatCard title="Replies (Last 7 Days)" value={stats?.emailsLast7Days ?? 0} description="In the past week" onClick={() => handleCardClick('week')} />
                    </Grid>
                    <Grid item xs={12} sm={6} lg={4} sx={{ display: 'flex' }}>
                        <StatCard title="Replies Today" value={stats?.emailsToday ?? 0} description="Since midnight" onClick={() => handleCardClick('today')} />
                    </Grid>
                    
                    {/* Bottom Row - 3 cards */}
                    <Grid item xs={12} sm={6} lg={4} sx={{ display: 'flex' }}>
                        <StatCard title="Daily Activity" description="Past 7 days" descColor="#7cf4f8cc" onClick={() => handleCardClick('daily')}>
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={dailyChartData} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" fontSize={12} tick={{ fill: '#7cf4f8' }} />
                                    <YAxis allowDecimals={false} fontSize={12} tick={{ fill: '#7cf4f8' }} />
                                    <Tooltip wrapperStyle={{ zIndex: 1000 }} contentStyle={{ borderRadius: 8, boxShadow: '2px 2px 10px rgba(0,0,0,0.1)' }}/>
                                    <Bar dataKey="emails" name="Replies" fill="#7e57c2" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </StatCard>
                    </Grid>
                    <Grid item xs={12} sm={6} lg={4} sx={{ display: 'flex' }}>
                        <StatCard title="Peak Reply Hours" description="Based on all activity" descColor="#7cf4f8cc" onClick={() => handleCardClick('hourly')}>
                            <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={hourlyChartData} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="hour" fontSize={12} tick={{ fill: '#7cf4f8' }} />
                                    <YAxis allowDecimals={false} fontSize={12} tick={{ fill: '#7cf4f8' }} />
                                    <Tooltip wrapperStyle={{ zIndex: 1000 }} contentStyle={{ borderRadius: 8, boxShadow: '2px 2px 10px rgba(0,0,0,0.1)' }} />
                                    <Line type="monotone" dataKey="emails" name="Replies" stroke="#8884d8" strokeWidth={2} />
                                </LineChart>
                            </ResponsiveContainer>
                        </StatCard>
                    </Grid>
                    <Grid item xs={12} sm={6} lg={4} sx={{ display: 'flex' }}>
                        <StatCard title="Email Tracking" onClick={() => handleCardClick('engagement')}>
                            <FormControl variant="standard" size="small" sx={{ position: 'absolute', top: 24, right: 24, minWidth: 120, zIndex: 10 }} onClick={(e) => e.stopPropagation()}>
                                <Select value={trackingTimeFilter} onChange={(e) => setTrackingTimeFilter(e.target.value)} MenuProps={{ PaperProps: { sx: { bgcolor: 'background.paper', backgroundImage: 'none' }}}}>
                                    <MenuItem value="today">Today</MenuItem>
                                    <MenuItem value="week">Last 7 Days</MenuItem>
                                    <MenuItem value="month">Last 4 Weeks</MenuItem>
                                    <MenuItem value="3months">Last 3 Months</MenuItem>
                                    <MenuItem value="6months">Last 6 Months</MenuItem>
                                    <MenuItem value="year">Last Year</MenuItem>
                                    <MenuItem value="all">All Time</MenuItem>
                                </Select>
                            </FormControl>
                            
                            {isTrackingFilterLoading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                                    <CircularProgress />
                                </Box>
                            ) : (
                                <Grid container spacing={2} alignItems="center" sx={{height: '100%'}}>
                                    <Grid item xs={12} md={4}>
                                        <Box sx={{ height: 200 }}>
                                            <ResponsiveContainer>
                                                <PieChart>
                                                    <Pie data={emailTrackingData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={70} >
                                                        {emailTrackingData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                                    </Pie>
                                                    <RechartsTooltip />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} md={4} sx={{ textAlign: 'center' }}>
                                         <Typography variant="h2" fontWeight="bold">{filteredTrackingStats?.openRate ?? 0}%</Typography>
                                         <Typography color="text.secondary" variant="h6">Open Rate</Typography>
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <List>
                                            <ListItem>
                                                <ListItemText primary={<Typography fontWeight="bold">{filteredTrackingStats?.totalOpened ?? 0} / {filteredTrackingStats?.totalSent ?? 0}</Typography>} secondary="Total Opened" />
                                            </ListItem>
                                            <Divider component="li" />
                                            <ListItem>
                                                <ListItemText primary={<Typography fontWeight="bold">{filteredTrackingStats?.regularOpened ?? 0}</Typography>} secondary="Regular Opened" />
                                            </ListItem>
                                            <Divider component="li" />
                                            <ListItem>
                                                <ListItemText primary={<Typography fontWeight="bold">{filteredTrackingStats?.followUpsOpened ?? 0}</Typography>} secondary="Follow-ups Opened" />
                                            </ListItem>
                                        </List>
                                    </Grid>
                                </Grid>
                            )}
                        </StatCard>
                    </Grid>
                </Grid>
            )}

            {/* Detail Modal */}
            <DetailModal 
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title={modalContent.title}
                content={modalContent.content}
            />
        </Box>
    );
}

export default DashboardPage;