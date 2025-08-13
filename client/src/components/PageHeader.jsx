// client/src/components/PageHeader.jsx

import { Typography, Box } from '@mui/material';

function PageHeader({ title }) {
  return (
    <Box sx={{ mb: 4, textAlign: 'center' }}>
      <Typography variant="h4" component="h1" fontWeight="700">
        {title}
      </Typography>
    </Box>
  );
}

export default PageHeader;