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
    InputLabel, 
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
    Avatar
} from '@mui/material';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend  } from 'recharts';
import AssistantPicker from '../components/AssistantPicker';
import { useUser } from './contexts/UserContext';
import { Link } from 'react-router-dom';


// Enhanced StatCard component with better sizing and interactions
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
                //color="text.secondary" 
                gutterBottom
                sx={{ 
                    fontSize: { xs: '1.1rem', sm: '1.25rem' },
                    fontWeight: 600,
                    mb: 2,
                    color: titleColor,
                    textShadow: '0 0 8px rgba(124,244,248,.45)' // optional glow
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

// Modal component for detailed views
const DetailModal = ({ open, onClose, title, content }) => (
    <Dialog 
        open={open} 
        onClose={onClose} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
            sx: { borderRadius: 3 }
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

    // All data fetching logic remains the same
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
if (withPics.length > 0) setSelectedAssistant(withPics[0].id);
                    else setIsLoading(false);
                }
            } catch (error) { setIsLoading(false); }
        };
        fetchAssistants();
    }, []);

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
                if (trackingRes.ok) setTrackingStats(await trackingRes.json());
            } catch (error) { console.error("Failed to fetch dashboard data:", error); } 
            finally { setIsLoading(false); }
        };
        fetchDashboardData();
    }, [selectedAssistant]);

    const emailTrackingData = [
        { name: 'Opened', value: trackingStats?.totalOpened ?? 0 },
        { name: 'Unopened', value: (trackingStats?.totalSent ?? 0) - (trackingStats?.totalOpened ?? 0) },
    ];

    const COLORS = ['#7e57c2', '#e0e0e0'];

    // Modal handlers for each card
    const handleCardClick = (cardType) => {
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
                        <Typography variant="body2">
                            • Average replies per day: {stats?.totalEmailsHandled ? Math.round(stats.totalEmailsHandled / 30) : 0}
                        </Typography>
                        <Typography variant="body2">
                            • Performance trend: {stats?.totalEmailsHandled > 50 ? 'High activity' : 'Getting started'}
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
                        <Typography variant="body2">
                            • Current time: {new Date().toLocaleTimeString()}
                        </Typography>
                        <Typography variant="body2">
                            • Status: {stats?.emailsToday > 0 ? 'Active today' : 'No activity yet today'}
                        </Typography>
                    </Box>
                );
                break;
            case 'engagement':
                title = 'Email Engagement Details';
                content = (
                    <Box>
                        <Typography variant="body1" color="text.secondary" paragraph>
                            This chart shows the ratio of sent emails that were opened by recipients.
                        </Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                            Note: Due to privacy features in some email clients, open tracking is an estimate and may not be 100% accurate.
                        </Typography>
                        <Box sx={{ mt: 2, height: 300, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                             <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={emailTrackingData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill="#8884d8" paddingAngle={5} label>
                                        {emailTrackingData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </Box>
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
                            To view analytics, you’ll need to add an assistant — but first, choose a plan.
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
                        <StatCard 
                            title="Total Replies Sent" 
                            value={stats?.totalEmailsHandled ?? 0} 
                            description="Since assistant creation" 
                            onClick={() => handleCardClick('total')} 
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} lg={4} sx={{ display: 'flex' }}>
                        <StatCard 
                            title="Replies (Last 7 Days)" 
                            value={stats?.emailsLast7Days ?? 0} 
                            description="In the past week" 
                            onClick={() => handleCardClick('week')} 
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} lg={4} sx={{ display: 'flex' }}>
                        <StatCard 
                            title="Replies Today" 
                            value={stats?.emailsToday ?? 0} 
                            description="Since midnight" 
                            onClick={() => handleCardClick('today')} 
                        />
                    </Grid>
                    
                    {/* Bottom Row - 3 cards */}
                    <Grid item xs={12} sm={6} lg={4} sx={{ display: 'flex' }}>
                        <StatCard 
                            title="Daily Activity" 
                            description="Past 7 days"
                            descColor="#7cf4f8cc"
                            onClick={() => handleCardClick('daily')}
                        >
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
                        <StatCard 
                            title="Peak Reply Hours" 
                            description="Based on all activity"
                            descColor="#7cf4f8cc"
                            onClick={() => handleCardClick('hourly')}
                        >
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
                            <Grid container spacing={2} alignItems="center" sx={{height: '100%'}}>
                                <Grid item xs={12} md={4}>
                                    <Box sx={{ height: 200 }}>
                                        <ResponsiveContainer>
                                            <PieChart>
                                                <Pie data={emailTrackingData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={70} >
                                                    {emailTrackingData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                                </Pie>
                                                <Tooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </Box>
                                </Grid>
                                <Grid item xs={12} md={4} sx={{ textAlign: 'center' }}>
                                     <Typography variant="h2" fontWeight="bold">{trackingStats?.openRate ?? 0}%</Typography>
                                     <Typography color="text.secondary" variant="h6">Open Rate</Typography>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <List>
                                        <ListItem>
                                            <ListItemText primary={<Typography fontWeight="bold">{trackingStats?.totalOpened ?? 0} / {trackingStats?.totalSent ?? 0}</Typography>} secondary="Total Opened" />
                                        </ListItem>
                                        <Divider component="li" />
                                        <ListItem>
                                            <ListItemText primary={<Typography fontWeight="bold">{trackingStats?.openedToday ?? 0}</Typography>} secondary="Opened Today" />
                                        </ListItem>
                                        <Divider component="li" />
                                        <ListItem>
                                            <ListItemText primary={<Typography fontWeight="bold">{trackingStats?.openedLast7Days ?? 0}</Typography>} secondary="Opened Last 7 Days" />
                                        </ListItem>
                                    </List>
                                </Grid>
                            </Grid>
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