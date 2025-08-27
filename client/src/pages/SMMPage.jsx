import { Box, Typography } from '@mui/material';

function SMMPage() {
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '60vh', 
        textAlign: 'center' 
      }}
    >
      <Typography variant="h4" color="text.secondary">
        Coming Soon
      </Typography>
    </Box>
  );
}

export default SMMPage;