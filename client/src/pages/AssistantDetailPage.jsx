import { useState, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { 
    Box, 
    Paper, 
    Typography, 
    CircularProgress, 
    Button, 
    Divider, 
    List, 
    ListItem, 
    ListItemIcon, 
    ListItemText, 
    TextField, 
    IconButton, 
    Table, 
    TableBody, 
    TableCell, 
    TableContainer, 
    TableHead, 
    TableRow, 
    Collapse,
    TextareaAutosize,
    Alert,
    Avatar,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Tooltip
} from '@mui/material';
import { 
    Article as ArticleIcon, 
    Link as LinkIcon, 
    LinkOff as LinkOffIcon, 
    Edit as EditIcon, 
    Delete as DeleteIcon, 
    Save as SaveIcon, 
    Cancel as CancelIcon, 
    Add as AddIcon, 
    ArrowBack as ArrowBackIcon, 
    KeyboardArrowDown as KeyboardArrowDownIcon, 
    KeyboardArrowUp as KeyboardArrowUpIcon, 
    AutoAwesome as AiIcon,
    Send as SendIcon,
    FiberManualRecord as UnreadIcon,
    Check as CheckIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import AvatarGridPicker from '../components/AvatarGridPicker';
import availableAvatars from '../constants/availableAvatars';

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
              `http://localhost:3001/api/thread/${assistantId}/${row.id}`,
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
              `http://localhost:3001/api/thread/${assistantId}/${row.id}`,
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


function AssistantDetailPage() {
    const { id } = useParams();
    const [assistantData, setAssistantData] = useState(null);
    const [threads, setThreads] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [error, setError] = useState('');
    const [editName, setEditName] = useState('');
    const [editInstructions, setEditInstructions] = useState('');
    const [editAvatar, setEditAvatar] = useState('');
    const [showDelete, setShowDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [editRole, setEditRole] = useState('');

    const fetchAssistantData = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`http://localhost:3001/api/assistant/${id}`, { credentials: 'include' });
            if (!response.ok) throw new Error('Assistant not found');
            const result = await response.json();
            setAssistantData(result);
        } catch (err) {
            console.error("Failed to fetch assistant data:", err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAssistantData();
    }, [id]);


    const fetchThreads = async () => {
        if (!assistantData?.assistant.googleTokens) return;
        try {
            const res = await fetch(
              `http://localhost:3001/api/threads/${id}`,
              { credentials: 'include' }
            );
            if (res.ok) setThreads(await res.json());
        } catch (e) {
            console.error("Failed to fetch threads:", e);
        }
    };

    useEffect(() => {
        // initial load + poll every 30s
        fetchThreads();
        // const intervalId = setInterval(fetchThreads, 180000);
        // return () => clearInterval(intervalId);
    }, [assistantData, id]);


    const handleEditClick = () => {
        if (assistantData && assistantData.assistant) {
            setEditName(assistantData.assistant.name);
            setEditInstructions(assistantData.assistant.instructions);
            setEditAvatar(assistantData.assistant.avatarUrl || '/avatars/avatar1.png');
            setEditRole(assistant.role || '');
            setIsEditing(true);
        }
    };

    const handleCancelClick = () => {
        setIsEditing(false);
        setError('');
    };

    const handleSaveClick = async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await fetch(`http://localhost:3001/api/assistant/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name: editName, instructions: editInstructions, avatarUrl: editAvatar, role: editRole }),
            });
            
            const json = await response.json();                // <--- read once
        if (!response.ok) throw new Error(json.message || 'Failed to update');

        // --- instantly reflect the new data locally (no stale avatar) ---
        setAssistantData(prev => ({
            ...prev,
            assistant: {
                ...prev.assistant,
                ...(json.assistant || json),               // if API returns {assistant:{...}}
                name: editName,
                instructions: editInstructions,
                avatarUrl: editAvatar
            }
        }));

        setIsEditing(false);
        // OPTIONAL: if you prefer refetching from server, keep this:
        //await fetchAssistantData();
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleFileAdd = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        try {
            await fetch(`http://localhost:3001/api/assistant/${id}/files`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });
            fetchAssistantData(); // Refresh data to show the new file
        } catch (error) {
            console.error('Error uploading new file:', error);
        }
    };

    const handleFileRemove = async (fileId) => {
        if (window.confirm('Are you sure you want to remove this file from the assistant’s knowledge?')) {
            try {
                await fetch(`http://localhost:3001/api/assistant/${id}/files/${fileId}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                fetchAssistantData(); // Refresh to show the file is gone
            } catch (error) {
                console.error('Error removing file:', error);
            }
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await fetch(`http://localhost:3001/api/assistant/${assistant.id}`, {
            method: 'DELETE',
            credentials: 'include'
            });
            // go back to assistants list
            window.location.href = '/assistants';
        } catch (e) {
            console.error(e);
        } finally {
            setDeleting(false);
        }
    };

    const handleGoogleDisconnect = async () => {
        if (window.confirm('Are you sure you want to disconnect this Gmail account?')) {
            try {
                await fetch(`http://localhost:3001/auth/google/disconnect/${id}`, {
                    method: 'POST',
                    credentials: 'include'
                });
                fetchAssistantData();
            } catch (error) {
                console.error("Failed to disconnect Google account:", error);
            }
        }
    };

    if (isLoading && !assistantData) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
    }

    if (error || !assistantData || !assistantData.assistant) {
        return <Typography sx={{ p: 3 }}>{error || "Assistant not found."} Go back to the <RouterLink to="/assistants">assistants list</RouterLink>.</Typography>;
    }

    const { assistant, files } = assistantData;

    const fileName = assistant.avatarUrl.split('/').pop();
    const ida       = fileName.replace('.png','');
    const size = 130;
    const overlap = 20;

    return (
        <Box>
            <Button component={RouterLink} to="/assistants" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
                Back to All Assistants
            </Button>
            <Paper elevation={3} sx={{ p: 3, borderRadius: 2, position: 'relative' }}>
                {isLoading && <CircularProgress sx={{ position: 'absolute', top: '50%', left: '50%', mt: '-20px', ml: '-20px' }} />}
                <Box sx={{ opacity: isLoading ? 0.5 : 1 }}>
                    {!isEditing ? (
                        <>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0, mt: -2, flexWrap: 'wrap', gap: 2 }}>
                                <Box sx={{display: 'flex', justifyContent: 'center', flexDirection: 'column', textAlign: 'center'}}>
                                    <Typography variant="h4" component="h1">{assistant.name}</Typography>
                                    {assistant.role && (
                                        <Typography variant="h5" color="textSecondary">
                                            ({assistant.role})
                                        </Typography>
                                    )}
                                </Box>
                                <Avatar
                                    src={`/avatars/${ida}-${size}.png`}
                                    alt={assistant.name}
                                    sx={{ width: size, height: size, border: '2px solid #00e5ff' , mt: 0, clipPath: `inset(-${overlap}px 0 0 0 round 50%)`,
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
                                    }}}
                                >
                                    {assistant?.name?.[0]}
                                </Avatar>
                                <Box sx={{display: 'flex', flexDirection: 'column', justifyContent: 'space-between'}}>
                                    <Button variant="outlined" startIcon={<EditIcon />} onClick={handleEditClick} sx={{margin: 0.5, mr: 0, fontSize: 20}}>Edit</Button>
                                    <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={()=>setShowDelete(true)} sx={{margin: 0.5, mr: 0, fontSize: 20}}>Delete
                                    </Button>
                                </Box>
                                <Dialog open={showDelete} onClose={()=>setShowDelete(false)} PaperProps={{
                                    sx: {
                                    backgroundColor: '#1a2c3bff', boxShadow: 6, border: '1px solid #00e5ffa4', backgroundImage: 'none'
                                    }
                                }}>
                                    <DialogTitle>Delete Assistant?</DialogTitle>
                                    <DialogContent>
                                        This cannot be undone and will free up a slot.
                                    </DialogContent>
                                    <DialogActions>
                                        <Button onClick={()=>setShowDelete(false)}>Cancel</Button>
                                        <Button color="error" onClick={handleDelete} disabled={deleting}>
                                        {deleting ? 'Deleting…' : 'Delete'}
                                        </Button>
                                    </DialogActions>
                                </Dialog>
                            </Box>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="h6" gutterBottom>Instructions</Typography>
                            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', bgcolor: '#f5f5f5', p: 2, borderRadius: 1, maxHeight: '200px', overflowY: 'auto' }}>
                                {assistant.instructions}
                            </Typography>
                        </>
                    ) : (
                        <>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="h4" component="h1">Editing Assistant</Typography>
                                <Box>
                                    <Button variant="contained" startIcon={<SaveIcon />} sx={{ mr: 1 }} onClick={handleSaveClick}>Save Changes</Button>
                                    <Button variant="outlined" color="error" startIcon={<CancelIcon />} onClick={handleCancelClick}>Cancel</Button>
                                </Box>
                            </Box>
                            <Divider sx={{ my: 2 }} />
                            <TextField fullWidth label="Assistant Name" defaultValue={assistant.name} onChange={(e) => setEditName(e.target.value)} sx={{ mb: 2 }} />
                            <TextField fullWidth label="Instructions" multiline rows={8} defaultValue={assistant.instructions} onChange={(e) => setEditInstructions(e.target.value)} />
                                <TextField
                                    fullWidth
                                    label="Role"
                                    value={editRole}
                                    onChange={e => setEditRole(e.target.value)}
                                    sx={{ mb: 2, mt: 2 }}
                                />
                            <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>Avatar</Typography>
                            <AvatarGridPicker
                            images={availableAvatars}
                            value={editAvatar}
                            onChange={setEditAvatar}
                            size={130}
                            />
                        </>
                    )}

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="h6" gutterBottom>Gmail Connection</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                        {assistant.googleTokens ? (
                            <>
                                <Button variant="contained" color="success" startIcon={<LinkIcon />}>Connected</Button>
                                <Button variant="outlined" color="#beacdbff" size="small" onClick={handleGoogleDisconnect}>Disconnect</Button>
                            </>
                        ) : (
                            <Button variant="contained" startIcon={<LinkIcon />} href={`http://localhost:3001/auth/google?assistantId=${assistant.id}`}>Connect Gmail</Button>
                        )}
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="h6">Knowledge Files</Typography>
                        <Button variant="contained" component="label" size="small" startIcon={<AddIcon />}>
                            Add File
                            <input type="file" hidden onChange={handleFileAdd} />
                        </Button>
                    </Box>

                    {files && files.length > 0 ? (
                        <List>
                            {files.map(file => (
                                <ListItem key={file.id} secondaryAction={ <IconButton edge="end" aria-label="delete" onClick={() => handleFileRemove(file.id)}><DeleteIcon color="error" /></IconButton> }>
                                    <ListItemIcon><ArticleIcon /></ListItemIcon>
                                    <ListItemText primary={file.filename} secondary={`${(file.bytes / 1024).toFixed(2)} KB`} />
                                </ListItem>
                            ))}
                        </List>
                    ) : (
                        <Typography variant="body2" color="text.secondary">No knowledge files uploaded.</Typography>
                    )}

                    <Divider sx={{ my: 2 }} />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
                            Conversation Inbox
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
                    {assistant.googleTokens ? (
                        threads.length > 0 ? (
                           <>
                                {/* --- TABLE FOR MEDIUM SCREENS AND UP --- */}
                                <TableContainer 
                                    component={Paper} 
                                    variant="outlined" 
                                    sx={{ display: { xs: 'none', md: 'block' } }} // Hide on small screens, show on medium+
                                >
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
                                            {threads.map((row) => (<ConversationRow key={row.id} row={row} assistantId={assistant.id} refreshThreads={fetchThreads} />))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>

                                {/* --- STACKED LIST FOR SMALL SCREENS --- */}
                                <Box sx={{ display: { xs: 'block', md: 'none' } }}> {/* Show on small screens, hide on medium+ */}
                                    <List sx={{ p: 0 }}>
                                        {threads.map((row) => (
                                            <ConversationRow 
                                                key={row.id} 
                                                row={row} 
                                                assistantId={assistant.id} 
                                                refreshThreads={fetchThreads} 
                                                isMobile={true} 
                                            />
                                        ))}
                                    </List>
                                </Box>
                            </>
                        ) : (
                            <Typography variant="body2" color="text.secondary">No recent conversation threads found.</Typography>
                        )
                    ) : (
                        <Typography variant="body2" color="text.secondary">Connect Gmail to see conversations.</Typography>
                    )}
                </Box>
            </Paper>
        </Box>
    );
}

export default AssistantDetailPage;