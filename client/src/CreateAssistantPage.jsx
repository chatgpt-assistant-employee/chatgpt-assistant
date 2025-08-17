// client/src/CreateAssistantPage.jsx

import { useState } from 'react';
// Import components from MUI
import { Box, Button, Paper, TextField, Typography, List, ListItem, ListItemText, IconButton, CircularProgress, Avatar , Tooltip} from '@mui/material';
import { CloudUpload as CloudUploadIcon, Delete as DeleteIcon } from '@mui/icons-material';
import AvatarGridPicker from './components/AvatarGridPicker';
import availableAvatars from './constants/availableAvatars';

function CreateAssistantPage({ onAssistantCreated }) {
  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [files, setFiles] = useState([]); // Handle multiple files
  const [role, setRole] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(availableAvatars[0]);

  const handleFileChange = (event) => {
    // Add new files to the existing array
    setFiles(prev => [...prev, ...Array.from(event.target.files)]);
  };
  
  const handleRemoveFile = (fileIndex) => {
    setFiles(prevFiles => prevFiles.filter((_, index) => index !== fileIndex));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    const formData = new FormData();
    formData.append('name', name);
    formData.append('instructions', instructions);
    formData.append('role', role);
    formData.append('avatarUrl', avatarUrl);
    files.forEach(file => {
      formData.append('files', file); // Append each file
    });

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/assistant`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create assistant');
      }
      
      // Pass the complete, updated user object back to the dashboard
      onAssistantCreated(data.user); 

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#0c13190e'}}>
      <Paper sx={{ padding: 4, borderRadius: 2, width: '100%', maxWidth: '600px', bgcolor: '#0c1319a4', border: '1px solid #00e5ffa4', }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Create Your Assistant
        </Typography>
        <Typography variant="body1" color="textSecondary" align="center" gutterBottom>
          Define the personality and knowledge base for your personal AI email assistant.
        </Typography>
        <Box component="form" onSubmit={handleCreate} noValidate sx={{ mt: 3 }}>
          <TextField
            label="Assistant Name"
            fullWidth
            required
            margin="normal"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Friendly Real Estate Helper"
          />
          <TextField
            label="Instructions"
            fullWidth
            required
            multiline
            rows={8}
            margin="normal"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g., You are a helpful assistant for a busy real estate agent..."
          />
          <TextField
           label="Role"
           fullWidth
           margin="normal"
           value={role}
           onChange={(e) => setRole(e.target.value)}
           placeholder="e.g., Sales Assistant, Tutor, Chef"
         />
          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>Pick an avatar</Typography>

          <AvatarGridPicker
            images={availableAvatars}
            value={avatarUrl}
            onChange={setAvatarUrl}
            size={130}
          />
          <Button
            variant="outlined"
            component="label"
            fullWidth
            startIcon={<CloudUploadIcon />}
            sx={{ mt: 2, mb: 1 }}
          >
            Upload Knowledge Files
            <input type="file" hidden multiple onChange={handleFileChange} />
          </Button>
          {files.length > 0 && (
            <List dense>
              {files.map((file, index) => (
                <ListItem
                  key={index}
                  secondaryAction={
                    <IconButton edge="end" aria-label="delete" onClick={() => handleRemoveFile(index)}>
                      <DeleteIcon />
                    </IconButton>
                  }
                >
                  <ListItemText primary={file.name} secondary={`${(file.size / 1024).toFixed(2)} KB`} />
                </ListItem>
              ))}
            </List>
          )}
          {error && <Typography color="error" align="center" sx={{ mt: 2 }}>{error}</Typography>}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={isLoading}
            sx={{ mt: 3, mb: 2, py: 1.5 }}
          >
            {isLoading ? 'Creating...' : 'Create Assistant'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

export default CreateAssistantPage;