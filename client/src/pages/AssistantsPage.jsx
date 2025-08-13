// client/src/pages/AssistantsPage.jsx (Fixed Version)

import { useState, useEffect, useRef } from 'react';
import { useUser } from '../contexts/UserContext';
import { Link, useLocation } from 'react-router-dom';
import { Box, Paper, Typography, CircularProgress, Button, Grid, IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Snackbar, Alert, Avatar, Tooltip } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import CreateAssistantPage from '../CreateAssistantPage';

function AssistantsPage() {
  const { user, refetchUser } = useUser();
  const location = useLocation();
  const shouldShowCreateForm = useRef(false);
  const [assistants, setAssistants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [proratedPrice, setProratedPrice] = useState(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const fetchAssistants = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/assistants', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        const fallbackAvatars = [
          '/avatars/avatar1.png',
          '/avatars/avatar2.png',
          '/avatars/avatar3.png',
          '/avatars/avatar4.png'
        ];
        setAssistants(
          data.map((a, i) => {
            const hasReal = a.avatarUrl && a.avatarUrl.trim() !== '';
            return {
              ...a,
              avatarUrl: hasReal ? a.avatarUrl : fallbackAvatars[i % fallbackAvatars.length]
            };
          })
        );
      } else {
        setAssistants([]);
      }
    } catch (error) {
      console.error("Failed to fetch assistants:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssistants();
  }, [location.key]);

  // Effect to handle showing create form after purchase
  useEffect(() => {
    if (shouldShowCreateForm.current && user) {
      console.log('Effect triggered - showing create form');
      shouldShowCreateForm.current = false;
      setShowCreateForm(true);
    }
  }, [user]); // Trigger when user data changes

  const handleDelete = async (assistantId) => {
      // This is now a simple delete. It frees up a slot.
      if (window.confirm('Are you sure you want to delete this assistant? This will free up a slot in your plan.')) {
          try {
              await fetch(`http://localhost:3001/api/assistant/${assistantId}`, {
                  method: 'DELETE',
                  credentials: 'include'
              });
              fetchAssistants(); // Refresh the list
          } catch (error) {
              console.error('Failed to delete assistant:', error);
          }
      }
  };

  const handleCreateClick = async () => {
        if (!user) return;
        
        const totalSlots = (user?.basePlanLimit ?? 0) + (user?.addOnSlots ?? 0);

        // Check if user has reached their slot limit
        if (assistants.length >= totalSlots) {
            setIsLoading(true);
            try {
                const response = await fetch('http://localhost:3001/api/proration-preview', { credentials: 'include' });
                if (!response.ok) throw new Error('Could not get price');
                const data = await response.json();
                setProratedPrice(data.proratedPrice);
                setShowPurchaseDialog(true);
            } catch (error) {
                console.error(error);
                setSnackbar({ open: true, message: 'Could not fetch upgrade price. Please try again.', severity: 'error' });
            } finally {
                setIsLoading(false);
            }
        } else {
            setShowCreateForm(true); // User has free slots, show the creation form
        }
    };

  const handlePurchaseConfirm = async () => {
      setIsPurchasing(true);
      try {
          const response = await fetch('http://localhost:3001/api/purchase-assistant', {
              method: 'POST',
              credentials: 'include',
          });
          if (!response.ok) throw new Error('Purchase failed');
          
          setShowPurchaseDialog(false);
          
          setSnackbar({ open: true, message: 'Assistant slot purchased successfully! You can now create a new assistant.', severity: 'success' });
          
          // Set flag to show create form after user data is refetched
          setTimeout(async () => {
              shouldShowCreateForm.current = true;
              await refetchUser();
              await fetchAssistants();
          }, 3000);
          
      } catch (error) {
          console.error("Purchase failed:", error);
          console.log('Setting error snackbar');
          setSnackbar({ open: true, message: 'Purchase failed. Please try again.', severity: 'error' });
      } finally {
          setIsPurchasing(false);
      }
  };


  if (showCreateForm) {
    return <CreateAssistantPage onAssistantCreated={() => {
      console.log('onAssistantCreated called');
      setShowCreateForm(false);
      fetchAssistants();
    }} />;
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column'}}>
      <Box sx={{ mb: 4, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', flexGrow: 1, position: { sm: 'relative', lg: 'relative'} }}>
        <Typography variant="h3" fontWeight="bold" sx={{ mb: 3, background: '#7cdff8e3', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Your Assistants</Typography>
        {user && (
            <Typography variant="h5" color="text.secondary">
                Using {assistants.length} of {user.basePlanLimit + user.addOnSlots} available slots.
            </Typography>
        )}
        <Box sx={{
            flexGrow: 1,            // fill remaining space
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            justifyContent: 'center', // center horizontally
            alignItems: 'center',     // center vertically
            p: 4,                     // optional padding
        }}>
      {assistants.map(a => {

        const fileName = a.avatarUrl.split('/').pop();
        const ida       = fileName.replace('.png','');
        const size = 180;
        const overlap = 20;

        return (
          <Box key={a.id} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Avatar
              
              src={`/avatars/${ida}-${size}.png`}
              alt={a.name}
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
                }
              }}
              onClick={() => window.location.href = `/assistant/${a.id}`}
            >
              {a.name[0]}
            </Avatar>
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
        );
      })}

  {/* Add New Assistant tile */}
  <Tooltip title="Add new assistant" fontSize="40" arrow>
    <Box
      onClick={handleCreateClick}
      sx={{
        width: 180,
        height: 180,
        borderRadius: '50%',
        border: '2px dashed #7cf4f8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 60,
        fontWeight: 400,
        color: '#7cf4f8',
        cursor: 'pointer'
      }}
    >
      +
    </Box>
  </Tooltip>
</Box>
      </Box>

      {isLoading && <CircularProgress sx={{ mt: 4 }} />}
      {!isLoading && assistants.length === 0 && (
        <Typography sx={{ mt: 6 }} color="text.secondary" textAlign="center">
          No assistants yet. Click the + to create one.
        </Typography>
      )}

        <Dialog open={showPurchaseDialog} onClose={() => setShowPurchaseDialog(false)} PaperProps={{
            sx: {
            backgroundColor: '#1a2c3bff', boxShadow: 6, border: '1px solid #00e5ffa4', backgroundImage: 'none'
            }
        }}>
            <DialogTitle fontWeight="bold">Add Assistant Slot</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    You have reached your limit of <strong>{(user?.basePlanLimit ?? 0) + (user?.addOnSlots ?? 0)}</strong> assistant slots. You can purchase an additional slot for **$19.00/month**.
                    <br/><br/>
                    Because you are part-way through your billing cycle, you will be charged a one-time prorated amount of
                    <Typography component="span" variant="h6" color="primary.main" fontWeight="bold"> ${proratedPrice ?? '...'} </Typography>
                    immediately. Your subscription will then renew at the new total on your next billing date.
                </DialogContentText>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button onClick={() => setShowPurchaseDialog(false)}>Cancel</Button>
                <Button onClick={handlePurchaseConfirm} variant="contained" autoFocus disabled={isPurchasing}>
                    {isPurchasing ? <CircularProgress size={24} /> : `Confirm and Pay $${proratedPrice ?? '...'}`}
                </Button>
            </DialogActions>
        </Dialog>

        <Snackbar 
            open={snackbar.open} 
            autoHideDuration={6000} 
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            sx={{ 
                zIndex: 9999,
                '& .MuiSnackbar-root': {
                    position: 'fixed !important'
                }
            }}
        >
            <Alert 
                onClose={() => setSnackbar({ ...snackbar, open: false })} 
                severity={snackbar.severity} 
                sx={{ 
                    width: '100%',
                    minWidth: '300px' 
                }}
                variant="filled"
            >
                {snackbar.message}
            </Alert>
        </Snackbar>
    </Box>
  );
}

export default AssistantsPage;