import { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { 
    Box, Paper, Typography, Button, Grid, CircularProgress, List, ListItem, 
    ListItemIcon, Card, Alert, Divider, ListItemText, 
    LinearProgress, Chip, Avatar, IconButton, Tooltip, CardContent,
    Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Switch, FormControlLabel
} from '@mui/material';
import {
    CheckCircle as CheckCircleIcon,
    CreditCard as CreditCardIcon,
    SmartToy as SmartToyIcon,
    Security as SecurityIcon,
    Download as DownloadIcon,
    Star as StarIcon,
    Upgrade as UpgradeIcon,
    Settings as SettingsIcon,
    History as HistoryIcon,
    Receipt as ReceiptIcon,
    Shield as ShieldIcon,
    Speed as SpeedIcon,
    Support as SupportIcon,
    AutoAwesome as AutoAwesomeIcon,
    Diamond as DiamondIcon,
    Workspaces as WorkspaceIcon,
    Event as EventIcon,
    TrendingUp as TrendingUpIcon,
    Assignment as AssignmentIcon,
    Schedule as ScheduleIcon,
    Payment as PaymentIcon,
    CalendarMonth as CalendarMonthIcon,
    Remove as RemoveIcon,
    Add as AddIcon
} from '@mui/icons-material';

const calculateSubscriptionDuration = (subscriptionStartDate) => {
    if (!subscriptionStartDate) return 'Unknown duration';
    
    const start = new Date(subscriptionStartDate);
    const now = new Date();
    
    // Calculate the difference in milliseconds
    const diffMs = now - start;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) {
        return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
    } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return months === 1 ? '1 month ago' : `${months} months ago`;
    } else {
        const years = Math.floor(diffDays / 365);
        const remainingMonths = Math.floor((diffDays % 365) / 30);
        
        if (years === 1 && remainingMonths === 0) {
            return '1 year ago';
        } else if (years === 1) {
            return `1 year, ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''} ago`;
        } else if (remainingMonths === 0) {
            return `${years} years ago`;
        } else {
            return `${years} years, ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''} ago`;
        }
    }
};

const EnhancedStatCard = ({ title, value, icon, gradient, textColor = "white", subtitle }) => (
    <Card
        elevation={0}
        sx={{
            background: gradient,
            borderRadius: 3,
            p: 3,
            height: '120px',
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            cursor: 'pointer',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            '&:hover': {
                transform: 'translateY(-8px) scale(1.02)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
            },
            '&::before': {
                content: '""',
                position: 'absolute',
                top: '-50%',
                right: '-20%',
                width: '140px',
                height: '140px',
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '50%',
                transition: 'all 0.6s ease',
            },
            '&:hover::before': {
                transform: 'scale(1.3)',
            },
            '&::after': {
                content: '""',
                position: 'absolute',
                bottom: '-30%',
                left: '-10%',
                width: '80px',
                height: '80px',
                background: 'rgba(255, 255, 255, 0.06)',
                borderRadius: '50%',
            }
        }}
    >
        <Box sx={{ 
            position: 'relative', 
            zIndex: 2, 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between' 
        }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography 
                    variant="overline" 
                    sx={{ 
                        color: textColor, 
                        opacity: 0.9, 
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        letterSpacing: 1.2,
                        textTransform: 'uppercase',
                        mt: -2
                    }}
                >
                    {title}
                </Typography>
                <Box sx={{ 
                    p: 0, 
                    borderRadius: '50%', 
                    background: 'rgba(255, 255, 255, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    {icon}
                </Box>
            </Box>
            
            <Box sx={{ mt: 0 }}>
                <Typography 
                    variant="h4" 
                    fontWeight="800" 
                    sx={{ 
                        color: textColor,
                        fontSize: '1.2rem', 
                        textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        lineHeight: 1.2,
                        mb: subtitle ? 0.5 : 0
                    }}
                >
                    {value}
                </Typography>
                {subtitle && (
                    <Typography 
                        variant="body2" 
                        sx={{ 
                            color: textColor, 
                            opacity: 0.8, 
                            fontSize: '0.8rem',
                            fontWeight: 500,
                            mt: 0.5
                        }}
                    >
                        {subtitle}
                    </Typography>
                )}
            </Box>
        </Box>
    </Card>
);

const PlanCard = ({ plan, isSelected, onSelect, isCurrentPlan = false, onUpgrade, currentPlanName = '', planRank = {} }) => (
    <Card
        elevation={isCurrentPlan ? 12 : isSelected ? 0 : 0}
        sx={{
            height: '100%',
            width: '380px',
            borderRadius: 3,
            border: '1px solid #7cf4f886',
            borderColor: isCurrentPlan ? 'success.main' : isSelected ? '#7cf4f8ff' : '#7cf4f886',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: isCurrentPlan ? 'scale(1.02)' : isSelected ? 'scale(1.05)' : 'scale(1)',
            background: isCurrentPlan 
                ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.05) 0%, rgba(129, 199, 132, 0.05) 100%)'
                : 'background.paper',
            position: 'relative',
            overflow: 'visible',
            display: 'flex', 
            flexDirection: 'column'
        }}
    >
        {isCurrentPlan && (
            <Chip
                label="Current Plan"
                color="success"
                size="small"
                sx={{
                    position: 'absolute',
                    top: -10,
                    right: 16,
                    zIndex: 1,
                    fontWeight: 600,
                    background: 'linear-gradient(45deg, #4CAF50 30%, #66BB6A 90%)',
                }}
            />
        )}
        {plan.id === 'platinum' && !isCurrentPlan && (
            <Chip
                label="Most Popular"
                color="primary"
                size="small"
                icon={<StarIcon />}
                sx={{
                    position: 'absolute',
                    top: -10,
                    right: 16,
                    zIndex: 1,
                    fontWeight: 600,
                    background: 'linear-gradient(45deg, #2196F3 30%, #42A5F5 90%)',
                }}
            />
        )}
        
        <Box 
            onClick={() => !isCurrentPlan && onSelect(plan.id)} 
            sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                cursor: isCurrentPlan ? 'default' : 'pointer',
                '&:hover': !isCurrentPlan ? {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)'
                } : {}
            }}
        >
            <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar 
                        sx={{ 
                            mr: 2, 
                            bgcolor: plan.id === 'platinum' ? 'primary.main' : plan.id === 'gold' ? 'warning.main' : 'info.main',
                            width: 40,
                            height: 40
                        }}
                    >
                        {plan.id === 'platinum' ? <DiamondIcon /> : 
                         plan.id === 'gold' ? <AutoAwesomeIcon /> : 
                         <WorkspaceIcon />}
                    </Avatar>
                    <Typography variant="h5" component="h2" fontWeight="bold" color="text.primary">
                        {plan.name}
                    </Typography>
                </Box>
                
                <Box sx={{ mb: 3, display: 'flex', alignItems: 'baseline' }}>
                    <Typography variant="h3" component="span" fontWeight="bold" color="primary.main">
                        ${plan.price}
                    </Typography>
                    <Typography variant="subtitle1" color="text.secondary" sx={{ ml: 1 }}>
                        /month
                    </Typography>
                </Box>
                
                <List sx={{ flexGrow: 1, p: 0 }}>
                    {plan.features.map((feature, index) => (
                        <ListItem key={index} disableGutters sx={{ py: 0.5 }}>
                            <ListItemIcon sx={{ minWidth: '32px' }}>
                                <CheckCircleIcon color="success" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText 
                                primary={feature} 
                                primaryTypographyProps={{ fontSize: '0.9rem' }}
                            />
                        </ListItem>
                    ))}
                </List>
                
                {!isCurrentPlan && (
                    <Button
                        variant={isSelected ? "contained" : "outlined"}
                        fullWidth
                        sx={{ 
                            mt: 'auto',
                            py: 1.5,
                            borderRadius: 2,
                            textTransform: 'none',
                            fontWeight: 600
                        }}
                        onClick={(e) => {
                            e.stopPropagation(); 
                            onUpgrade(plan.id);
                        }}
                    >
                        {(() => {
                        const targetRank = planRank?.[plan.name] ?? 0;
                        const currentRank = planRank?.[currentPlanName?.toUpperCase()] ?? 0;
                        if (targetRank > currentRank) return 'Upgrade';
                        if (targetRank < currentRank) return 'Downgrade';
                        return isSelected ? 'Select Plan' : 'Select Plan';
                        })()}
                    </Button>
                )}
            </CardContent>
        </Box>
    </Card>
);

function BillingPage() {
    const { user, refetchUser } = useUser();
    const [isLoading, setIsLoading] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [error, setError] = useState('');
    const [billingDetails, setBillingDetails] = useState(null);
    const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
    const [upgradeTarget, setUpgradeTarget] = useState('');
    const [autoRenewal, setAutoRenewal] = useState(true);
    const [editableSlots, setEditableSlots] = useState(0);
    const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
    const [proratedPrice, setProratedPrice] = useState(null);
    const [isPurchasing, setIsPurchasing] = useState(false);
    const [scheduledPlanDowngrade, setScheduledPlanDowngrade] = useState(null); // { plan: 'gold', effectiveAt: '...' }
    

    useEffect(() => {
        const query = new URLSearchParams(window.location.search);
        if (query.get("success")) {
            refetchUser();
        }
        if (query.get("cancelled")) {
            setError("Subscription process was cancelled. Please try again.");
        }
    }, [refetchUser]);

    useEffect(() => {
  if (!user) return;

  const fetchBillingDetails = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/billing-details`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setBillingDetails(data);
      setEditableSlots(data.addOnSlots);
    } catch (err) {
      console.error("Failed to fetch billing details:", err);
      setError("Could not load your billing details.");
    } finally {
      setIsLoading(false);
    }
  };

  fetchBillingDetails();
}, [user]);

    const plans = [
        { 
            id: "basic", 
            name: "BASIC", 
            price: 39, 
            features: [
                "1 Assistant-Bot", 
                "Chat with Assistant (Token System)", 
                "Basic Analytics", 
                "AI Support",
                "Standard Response Time",
                "Community Support"
            ]
        },
        { 
            id: "gold", 
            name: "GOLD", 
            price: 79, 
            features: [
                "1 Assistant-Bot", 
                "Chat (300 msgs/month)", 
                "Extended Analytics", 
                "Email Tracker",
                "Priority Response Time",
                "24/7 Support",
                "Advanced Integrations"
            ]
        },
        { 
            id: "platinum", 
            name: "PLATINUM", 
            price: 139, 
            features: [
                "1 Assistant-Bot", 
                "Chat (1000 msgs/month)", 
                "Extended Analytics", 
                "Email Tracker",
                "Fastest Response Time",
                "VIP 24/7 Support",
                "Premium Integrations",
                "Custom Workflows",
                "API Access"
            ]
        }
    ];

    const planRank = { BASIC: 1, GOLD: 2, PLATINUM: 3 }; // used to compare tiers
    const targetPlanName = plans.find(p => p.id === upgradeTarget)?.name || '';
    const currentPlanName = billingDetails?.plan || '';
    const isUpgrade = targetPlanName && currentPlanName && planRank[targetPlanName] > planRank[currentPlanName];
    const isDowngrade = targetPlanName && currentPlanName && planRank[targetPlanName] < planRank[currentPlanName];
    const actionLabel = isUpgrade ? 'Upgrade' : isDowngrade ? 'Downgrade' : 'Confirm Change';


    const handlePlanChange = async (planId) => {
        if (!planId) {
            setError('No plan selected.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const isExistingSubscriber =
            user &&
            (user.subscriptionStatus === 'active' || user.subscriptionStatus === 'cancelled_grace_period');

            if (isExistingSubscriber) {
            // Change existing plan
            const resp = await fetch(`${import.meta.env.VITE_API_URL}/api/change-plan`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPlanIdentifier: planId }),
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.message || 'Failed to change plan.');

            if (data.pendingPlan) {
                setScheduledPlanDowngrade({
                    plan: data.pendingPlan.toUpperCase(),
                    effectiveAt: data.effectiveAt,
                });
                } else {
                // Immediate upgrade happened; clear any previous scheduled downgrade
                setScheduledPlanDowngrade(null);
            }

            // Refresh local state
            await refetchUser();
            // Re-fetch billing details manually so it updates immediately
            const billingResp = await fetch(`${import.meta.env.VITE_API_URL}/api/billing-details`, {
                method: 'GET',
                credentials: 'include',
            });
            if (billingResp.ok) {
                const updated = await billingResp.json();
                setBillingDetails(updated);
            }
            setSelectedPlan(planId);
            } else {
            // New subscription flow
            setSelectedPlan(planId);
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/create-checkout-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ planIdentifier: planId }),
            });
            const data = await response.json();
            if (response.ok) {
                window.location.href = data.url;
            } else {
                throw new Error(data.message || 'Failed to start checkout.');
            }
            }
        } catch (err) {
            console.error('Plan change error:', err);
            setError(err.message || 'Something went wrong changing the plan.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubscribeClick = async () => {
        if (!selectedPlan) {
            setError('Please select a plan first.');
            return;
        }
        const planIdentifier = selectedPlan;
        setIsLoading(true);
        setError('');
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/create-checkout-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ planIdentifier }),
            });
            const data = await response.json();
            if (response.ok) window.location.href = data.url;
            else throw new Error(data.message);
        } catch (err) {
            setError(err.message);
            setIsLoading(false);
        }
    };

    const handleUpgrade = (planId) => {
        setUpgradeTarget(planId);
        setShowUpgradeDialog(true);
    };

    const confirmUpgrade = async () => {
        setShowUpgradeDialog(false);
        await handlePlanChange(upgradeTarget);
    };

    const handleManageBillingClick = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/create-portal-session`, {
                method: 'POST',
                credentials: 'include',
            });
            const data = await response.json();
            if (response.ok) {
                window.location.href = data.url;
            } else {
                throw new Error(data.message || 'Could not open billing portal.');
            }
        } catch (error) {
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    // --- NEW: Function to update the number of paid slots ---
    const handleSlotUpdate = async () => {
        const currentSlots = billingDetails.addOnSlots;
        // If user is adding slots, trigger the purchase confirmation flow
        if (editableSlots > currentSlots) {
            setIsLoading(true);
            try {
                const response = await fetch(`http://localhost:3001/api/proration-preview/${editableSlots}`, {
                credentials: 'include'
                });

                if (!response.ok) throw new Error('Could not get price');
                const data = await response.json();
                setProratedPrice(data.proratedPrice);
                setShowPurchaseDialog(true); // Show purchase pop-up
            } catch (err) { setError('Could not fetch upgrade price.'); }
            finally { setIsLoading(false); }
        } else {
            // If user is removing slots, do it directly
            setIsLoading(true);
            try {
                await fetch(`${import.meta.env.VITE_API_URL}/api/manage-slots`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ newSlotCount: editableSlots }),
                });
                refetchUser(); // Refresh user data to reflect the change
            } catch (err) { setError('Failed to update your subscription.'); }
            finally { setIsLoading(false); }
        }
    };

    const cancelPendingDowngrade = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/cancel-pending-downgrade`, {
            method: 'POST',
            credentials: 'include',
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.message || 'Error cancelling downgrade');

            // Refresh UI to reflect change
            await refetchUser();
            setBillingDetails(prev => ({
            ...prev,
            pendingAddOnSlots: null,
            }));
        } catch (err) {
            console.error('Cancel downgrade failed:', err);
            setError(err.message || 'Could not cancel downgrade.');
        }
    };
    
    const handlePurchaseConfirm = async () => {
        setIsPurchasing(true);
        try {
            await fetch(`${import.meta.env.VITE_API_URL}/api/manage-slots`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ newSlotCount: editableSlots }),
            });
            setShowPurchaseDialog(false);
            refetchUser();
        } catch (error) { setError('Purchase failed. Please try again.'); }
        finally { setIsPurchasing(false); }
    };

    if (user && (user.subscriptionStatus === 'active' || user.subscriptionStatus === 'cancelled_grace_period')) {
        if (isLoading || !billingDetails) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                    <CircularProgress size={60} />
                </Box>
            );
        }

        const totalLimit = billingDetails.basePlanLimit + billingDetails.addOnSlots;
        const usagePercentage = (billingDetails.assistantCount / totalLimit) * 100;
        const slotsChanged = editableSlots !== billingDetails.addOnSlots;

        return (
            <Box sx={{ maxWidth: '1600px', mx: 'auto', p: 3, pt:0 }}>
                {/* Header */}
                <Box sx={{ mb: 3, textAlign: 'center' }}>
                    <Typography variant="h3" fontWeight="bold" sx={{ pb: 1, mb: 1, background: '#7cdff8e3', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Billing Dashboard
                    </Typography>
                    <Typography variant="h6" color="text.secondary">
                        Manage your subscription and monitor your usage
                    </Typography>
                </Box>

                {/* Main Content Grid */}
                <Grid container spacing={4}>
                    {/* Subscription Details Card */}
                    <Grid item xs={12} sx={{display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%'}}>
                        <Paper 
                            elevation={0}
                            sx={{ 
                                p: 4, 
                                borderRadius: 3,
                                background: 'background.paper',
                                border: '1px solid #7cf4f886',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center'
                            }}
                        >
                            <Typography variant="h5" fontWeight="bold" sx={{ mb: 4, display: 'flex', alignItems: 'center' }}>
                                <SettingsIcon sx={{ mr: 2 }} />
                                Subscription Management
                            </Typography>

                            {/* Enhanced Stats Cards */}
                            <Grid container spacing={3} sx={{ mb: 4 }}>
                                <Grid item xs={12} sm={6} md={3} sx={{width: '240px', height: '135px'}}>
                                    <EnhancedStatCard
                                        title="Current Plan"
                                        value={billingDetails.plan}
                                        icon={<DiamondIcon sx={{ color: 'white', fontSize: 24 }} />}
                                        gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6} md={3} sx={{width: '240px', height: '135px'}}>
                                    <EnhancedStatCard
                                        title="Status"
                                        value={
                                            billingDetails.status === 'cancelled_grace_period'
                                                ? `Cancelling on ${
                                                    billingDetails.subscriptionEndsAt
                                                    ? new Date(billingDetails.subscriptionEndsAt).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                        })
                                                    : 'Unknown Date'
                                                }`
                                                : 'Active'
                                        }
                                        /* subtitle={
                                            billingDetails.status === 'cancelled_grace_period'
                                                ? `Cancelling on ${
                                                    billingDetails.subscriptionEndsAt
                                                    ? new Date(billingDetails.subscriptionEndsAt).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                        })
                                                    : 'Unknown Date'
                                                }`
                                                : 'Active'
                                        } */
                                        icon={<ShieldIcon sx={{ color: 'white', fontSize: 24 }} />}
                                        gradient={
                                            billingDetails.status === 'cancelled_grace_period'
                                                ? 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)'
                                                : 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)'
                                        }
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6} md={3} sx={{width: '240px', height: '135px'}}>
                                    <EnhancedStatCard
                                         title="Next Billing"
                                        value={
                                            billingDetails.renewalDate
                                            ? new Date(billingDetails.renewalDate).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric'
                                                })
                                            : 'Unknown'
                                        }
                                        /* subtitle={
                                            billingDetails.renewalDate
                                            ? new Date(billingDetails.renewalDate).getFullYear()
                                            : ''
                                        } */
                                        icon={<EventIcon sx={{ color: 'white', fontSize: 24 }} />}
                                        gradient="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6} md={3} sx={{width: '240px', height: '135px'}}>
                                    <EnhancedStatCard
                                        title="Usage"
                                        value={`Assistants: ${billingDetails.assistantCount}/${billingDetails.assistantLimit}`}
                                        /* subtitle="Assistants"
                                        icon={<SmartToyIcon sx={{ color: 'white', fontSize: 24 }} />} */
                                        gradient="linear-gradient(135deg, #fa709a 0%, #fee140 100%)"
                                    />
                                </Grid>
                                
                            </Grid>

                            <Grid container spacing={4}>
                                <Grid item xs={12} md={6} lg={12}>
                                    <Paper sx={{
                                        background: 'background.paper',
                                        borderRadius: 3,
                                        border: '1px solid #7cf4f886',
                                        p: 3,
                                        height: '100%',
                                        width: { xs:'100%', sm: '510px', lg: '440px'},
                                        position: 'relative',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        '&::before': {
                                            content: '""',
                                            position: 'absolute',
                                            bottom: '-20%',
                                            left: '-10%',
                                            width: '100px',
                                            height: '100px',
                                            background: 'rgba(76, 175, 80, 0.05)',
                                            borderRadius: '50%',
                                        }
                                    }}>
                                        <Typography variant="h6" gutterBottom>Usage & Add-ons</Typography>
                                        <Divider sx={{ my: 1 }} />
                                        <Typography fontWeight="bold" sx={{ mt: 2 }}>Assistants: 1 Plan Slot + {totalLimit-1} Additional Slots</Typography>
                                        <LinearProgress variant="determinate" value={usagePercentage} sx={{ height: 8, borderRadius: 4, my: 0.5 }} />
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                            You are using {billingDetails.assistantCount} of {totalLimit} available slots in total.
                                        </Typography>
                                        {billingDetails.pendingAddOnSlots !== null &&
                                            billingDetails.pendingAddOnSlots < billingDetails.addOnSlots && (
                                            <Alert severity="info" sx={{ mt: 2 }}>
                                                Your add-on slots will reduce to <strong>{billingDetails.pendingAddOnSlots}</strong> at your next billing date.
                                                <br />
                                                <Button
                                                size="small"
                                                variant="outlined"
                                                onClick={cancelPendingDowngrade}
                                                sx={{ mt: 1 }}
                                                >
                                                Cancel Downgrade
                                                </Button>
                                            </Alert>
                                            )}

                                        <Divider sx={{ my: 2 }} />
                                        
                                        <Typography fontWeight="bold">Paid Add-on Slots</Typography>
                                       {billingDetails.status === 'cancelled_grace_period' && (
                                        <Alert severity="info" sx={{ my: 2, width: { xs:'100%', sm: '100%', lg: '100%'} }}>
                                            Your subscription is set to cancel on <strong>
                                            {billingDetails.subscriptionEndsAt
                                                ? new Date(billingDetails.subscriptionEndsAt).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })
                                                : 'Unknown Date'}
                                            </strong>
                                            <br />
                                            You cannot modify your assistant slots during the cancellation period.
                                        </Alert>
                                        )}
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, my: 1 }}>
                                            <IconButton size="small" onClick={() => setEditableSlots(Math.max(0, editableSlots - 1))} disabled={isLoading || billingDetails.status === 'cancelled_grace_period'}>
                                                <RemoveIcon />
                                            </IconButton>
                                            <Typography variant="h5" fontWeight="bold">{editableSlots}</Typography>
                                            <IconButton size="small" onClick={() => setEditableSlots(editableSlots + 1)} disabled={isLoading || billingDetails.status === 'cancelled_grace_period'}>
                                                <AddIcon />
                                            </IconButton>
                                            <Typography color="text.secondary" sx={{flexGrow: 1}}>
                                                slots at $19.00/month each
                                            </Typography>
                                        </Box>
                                        
                                        {slotsChanged && (
                                            <Button variant="contained" onClick={handleSlotUpdate} disabled={isLoading || billingDetails.status === 'cancelled_grace_period'} sx={{ mt: 2 }}>
                                                {isLoading ? 'Updating...' : `Update to ${editableSlots} Add-on Slots`}
                                            </Button>
                                        )}
                                    </Paper>
                                </Grid>
                                {/* --- Purchase Confirmation Dialog --- */}
                                <Dialog open={showPurchaseDialog} onClose={() => setShowPurchaseDialog(false)} PaperProps={{
                                    sx: {
                                    backgroundColor: '#1a2c3bff', boxShadow: 6, border: '1px solid #00e5ffa4', backgroundImage: 'none'
                                    }
                                }}>
                                    <DialogTitle fontWeight="bold">Confirm Add-on</DialogTitle>
                                    <DialogContent>
                                        <DialogContentText>
                                            You are about to add {editableSlots - billingDetails.addOnSlots} new assistant slot(s).<br/><br/>
                                            You will be charged an immediate, one-time prorated amount of <strong>${proratedPrice ?? '...'}</strong>. Your subscription will then renew at the new total on your next billing date.
                                        </DialogContentText>
                                    </DialogContent>
                                    <DialogActions sx={{ p: 2 }}>
                                        <Button onClick={() => setShowPurchaseDialog(false)}>Cancel</Button>
                                        <Button onClick={handlePurchaseConfirm} variant="contained" autoFocus disabled={isPurchasing}>{isPurchasing ? <CircularProgress size={24}/> : `Confirm and Pay $${proratedPrice}`}</Button>
                                    </DialogActions>
                                </Dialog>

                                {/* Enhanced Billing History */}
                                <Grid item xs={12} md={6} lg={12}>
                                    <Box sx={{
                                        background: 'background.paper',
                                        borderRadius: 3,
                                        border: '1px solid #7cf4f886',
                                        p: 3,
                                        height: '100%',
                                        width: { xs:'100%', sm: '160%', lg: '440px'},
                                        position: 'relative',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        '&::before': {
                                            content: '""',
                                            position: 'absolute',
                                            bottom: '-20%',
                                            left: '-10%',
                                            width: '100px',
                                            height: '100px',
                                            background: 'rgba(76, 175, 80, 0.05)',
                                            borderRadius: '50%',
                                        }
                                    }}>
                                        <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, position: 'relative', zIndex: 1 }}>
                                            Billing History
                                        </Typography>
                                        
                                        {/* Recent Payment */}
                                        <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 2, mb: 2, position: 'relative', zIndex: 1 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                    <PaymentIcon color="action" sx={{ mr: 2, fontSize: 20 }} />
                                                    <Box>
                                                        <Typography fontWeight="bold" variant="body2">Last Payment</Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {billingDetails.billingHistory[0].date}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                                <Box sx={{ textAlign: 'right' }}>
                                                    <Typography fontWeight="bold" color="success.main">
                                                        ${billingDetails.billingHistory[0].amount}
                                                    </Typography>
                                                    <Chip label="Paid" color="success" size="small" />
                                                </Box>
                                            </Box>
                                        </Box>

                                        {/* Subscription Info */}
                                        <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 2, mb: 2, position: 'relative', zIndex: 1 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                    <ScheduleIcon color="action" sx={{ mr: 2, fontSize: 20 }} />
                                                    <Box>
                                                        <Typography fontWeight="bold" variant="body2">Subscription Started</Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {billingDetails.subscriptionStart}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                                <Typography variant="body2" color="text.secondary">
                                                    {calculateSubscriptionDuration(billingDetails.subscriptionStart)}
                                                </Typography>
                                            </Box>
                                        </Box>

                                        {/* Total Spend */}
                                        <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 2, position: 'relative', zIndex: 1, mt: 'auto' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                    <TrendingUpIcon color="action" sx={{ mr: 2, fontSize: 20 }} />
                                                    <Box>
                                                        <Typography fontWeight="bold" variant="body2">Total Spend</Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            This year
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                                <Typography fontWeight="bold" color="primary.main" variant="h6">
                                                    ${billingDetails.totalSpent}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Box>
                                </Grid>
                                {/* Payment Method */}
                                <Grid item xs={12} md={6} lg={12} sx={{display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',}}>
                                    <Box sx={{
                                        background: 'background.paper',
                                        borderRadius: 3,
                                        border: '1px solid #7cf4f886',
                                        p: 3,
                                        height: '75%',
                                        width: { xs:'100%', sm: '137%', lg: '440px'},
                                        position: 'relative',
                                        overflow: 'hidden',
                                        '&::before': {
                                            content: '""',
                                            position: 'absolute',
                                            top: '-20%',
                                            right: '-10%',
                                            width: '100px',
                                            height: '100px',
                                            background: 'rgba(33, 150, 243, 0.05)',
                                            borderRadius: '50%',
                                        }
                                    }}>
                                        <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, position: 'relative', zIndex: 1 }}>
                                            Payment Information
                                        </Typography>
                                        {billingDetails.paymentMethod ? (
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, bgcolor: 'background.default', borderRadius: 2, position: 'relative', zIndex: 1 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                    <CreditCardIcon color="action" sx={{ fontSize: 40, mr: 2 }} />
                                                    <Box>
                                                        <Typography fontWeight="bold">
                                                            {billingDetails.paymentMethod.brand.toUpperCase()} •••• {billingDetails.paymentMethod.last4}
                                                        </Typography>
                                                        <Typography variant="body2" color="text.secondary">
                                                            Expires {billingDetails.paymentMethod.exp_month}/{billingDetails.paymentMethod.exp_year}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                                <FormControlLabel
                                                    control={
                                                        <Switch
                                                            checked={autoRenewal}
                                                            onChange={(e) => setAutoRenewal(e.target.checked)}
                                                            color="primary"
                                                        />
                                                    }
                                                    label="Auto-renewal"
                                                    labelPlacement="top"
                                                />
                                            </Box>
                                        ) : (
                                            <Alert severity="warning" sx={{ position: 'relative', zIndex: 1 }}>
                                                No payment method on file.
                                            </Alert>
                                        )}
                                    </Box>
                                    <Box sx={{ mt: 4, display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between', gap: 2, width: { xs:'100%', sm: '137%', lg: '440px'} }}>
                                        <Button 
                                            variant="contained" 
                                            onClick={handleManageBillingClick} 
                                            disabled={isLoading}
                                            startIcon={<SettingsIcon />}
                                            sx={{ px: 3, py: 1.5 }}
                                        >
                                            {isLoading ? 'Loading...' : 'Manage Subscription'}
                                        </Button>
                                        <Button 
                                            variant="outlined" 
                                            startIcon={<DownloadIcon />}
                                            sx={{ px: 3, py: 1.5 }}
                                        >
                                            Download Invoices
                                        </Button>
                                    </Box>
                                </Grid>
                                
                                
                                
                            </Grid>
                                
                            
                        </Paper>
                    </Grid>
                </Grid>

                {/* Manage Your Plan Section */}
                <Box sx={{ mt: 6 }}>
                    <Typography variant="h4" fontWeight="bold" sx={{ mb: 3, textAlign: 'center' }}>
                        Manage Your Plan
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 4, textAlign: 'center' }}>
                        You can upgrade or downgrade your plan at any time.
                    </Typography>
                    <Box sx={{display: 'flex', justifyContent: 'center'}}>
                        {(billingDetails?.pendingPlan || scheduledPlanDowngrade) && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                        {scheduledPlanDowngrade ? (
                        <>
                            Downgrade to <strong>{scheduledPlanDowngrade.plan}</strong> scheduled; it will take effect on{' '}
                            <strong>{new Date(scheduledPlanDowngrade.effectiveAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            })}</strong>.{' '}
                            <Button size="small" onClick={async () => {
                            // cancel pending plan downgrade
                            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/cancel-pending-plan-downgrade`, {
                                method: 'POST',
                                credentials: 'include',
                            });
                            if (res.ok) {
                                setScheduledPlanDowngrade(null);
                                await refetchUser();
                                const updated = await fetch(`${import.meta.env.VITE_API_URL}/api/billing-details`, { credentials: 'include' });
                                if (updated.ok) setBillingDetails(await updated.json());
                            } else {
                                const err = await res.json();
                                setError(err.message || 'Failed to cancel downgrade.');
                            }
                            }} variant="outlined" sx={{ ml: 1 }}>
                            Cancel Downgrade
                            </Button>
                        </>
                        ) : (
                        <>
                            Downgrade to <strong>{billingDetails.pendingPlan?.toUpperCase()}</strong> scheduled; it will take effect on{' '}
                            <strong>{billingDetails.renewalDate ? new Date(billingDetails.renewalDate).toLocaleDateString('en-US') : 'the next billing date'}</strong>.{' '}
                            <Button size="small" onClick={async () => {
                            await fetch(`${import.meta.env.VITE_API_URL}/api/cancel-pending-plan-downgrade`, { method: 'POST', credentials: 'include' });
                            await refetchUser();
                            const updated = await fetch(`${import.meta.env.VITE_API_URL}/api/billing-details`, { credentials: 'include' });
                            if (updated.ok) setBillingDetails(await updated.json());
                            }} variant="outlined" sx={{ ml: 1 }}>
                            Cancel Downgrade
                            </Button>
                        </>
                        )}
                        </Alert>
                        )}
                    </Box>
                    <Grid container spacing={4} justifyContent="center" alignItems="stretch">
                        {plans.map(plan => (
                            <Grid item key={plan.id} sx={{ display: 'flex', justifyContent: 'center' }}>
                                <PlanCard 
                                    plan={plan} 
                                    isSelected={selectedPlan === plan.id}
                                    onSelect={setSelectedPlan}
                                    onUpgrade={handleUpgrade}
                                    isCurrentPlan={plan.name === billingDetails.plan}
                                    currentPlanName={billingDetails.plan}
                                    planRank={planRank}
                                />
                            </Grid>
                        ))}
                    </Grid>
                </Box>

                {/* Dialogs and Alerts */}
                <Dialog open={showUpgradeDialog} onClose={() => setShowUpgradeDialog(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>Confirm Plan Change</DialogTitle>
                    <DialogContent>
                        <Typography variant="body1" sx={{ mb: 2 }}>
                            You're about to change from <strong>{billingDetails.plan}</strong> to{' '}
                            <strong>{plans.find(p => p.id === upgradeTarget)?.name}</strong>.
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {planRank[plans.find(p => p.id === upgradeTarget)?.name] >
                                planRank[billingDetails.plan] ? (
                                <span>
                                    You're upgrading from <strong>{billingDetails.plan}</strong> to <strong>{plans.find(p => p.id === upgradeTarget)?.name}</strong>. The change will take effect immediately and you'll be charged the prorated difference.
                                </span>
                                ) : (
                                <span>
                                    You're downgrading from <strong>{billingDetails.plan}</strong> to <strong>{plans.find(p => p.id === upgradeTarget)?.name}</strong>. The downgrade is scheduled at the end of your current billing period.
                                </span>
                            )}
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setShowUpgradeDialog(false)}>Cancel</Button>
                        <Button onClick={confirmUpgrade} variant="contained" autoFocus>
                            {actionLabel}
                        </Button>
                    </DialogActions>
                </Dialog>

                {error && (
                    <Alert 
                        severity="error" 
                        sx={{ mt: 3 }} 
                        onClose={() => setError('')}
                    >
                        {error}
                    </Alert>
                )}
            </Box>
        );
    }

    // Fallback for non-subscribers
    return (
        <Box sx={{ maxWidth: '1600px', mx: 'auto', p: 3 }}>
            <Box sx={{ textAlign: 'center', mb: 6 }}>
                <Typography 
                    variant="h3" 
                    fontWeight="bold" 
                    sx={{ mb: 2, background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                >
                    Choose Your Plan
                </Typography>
                <Typography variant="h6" color="text.secondary">
                    Unlock the full potential of AI assistants with our flexible pricing plans
                </Typography>
            </Box>

            <Grid container spacing={4} alignItems="stretch" justifyContent="center">
                {plans.map(plan => (
                    <Grid item key={plan.id} sx={{ display: 'flex', justifyContent: 'center' }}>
                        <PlanCard 
                            plan={plan} 
                            isSelected={selectedPlan === plan.id} 
                            onSelect={setSelectedPlan}
                            onUpgrade={handleSubscribeClick}
                            
                        />
                    </Grid>
                ))}
            </Grid>

            <Box sx={{ mt: 6, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {error && (
                    <Alert 
                        severity="error" 
                        sx={{ mb: 3, width: '100%', maxWidth: '600px' }} 
                        onClose={() => setError('')}
                    >
                        {error}
                    </Alert>
                )}
                <Button
                    variant="contained"
                    size="large"
                    disabled={!selectedPlan || isLoading}
                    onClick={() => handlePlanChange(selectedPlan)}
                    startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <UpgradeIcon />}
                    sx={{ 
                        py: 2, 
                        px: 6, 
                        fontSize: '1.1rem', 
                        minWidth: '280px',
                        borderRadius: 3,
                        background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                        '&:hover': {
                            background: 'linear-gradient(45deg, #1976D2 30%, #2196F3 90%)',
                        }
                    }}
                >
                    {isLoading ? 'Processing...' : 'Subscribe Now'}
                </Button>
            </Box>
        </Box>
    );
}

export default BillingPage;