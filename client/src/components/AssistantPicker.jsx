import { useState } from 'react';
import {
  Avatar, Box, Typography, Popover, Tooltip, IconButton
} from '@mui/material';

const circleSize = 98;

export default function AssistantPicker({
  assistants = [],
  value,
  onChange,
  onAddClick,          // optional: show + tile
  addLabel = 'Add new assistant'
}) {
  const [anchorEl, setAnchorEl] = useState(null);

  const current = assistants.find(a => a.id === value);

  const handleOpen = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const open = Boolean(anchorEl);

  const size = 98;
  const avatarId = current?.avatarUrl
    ? current.avatarUrl.split('/').pop().replace(/\.png$/, '')
    : '';
  const src    = avatarId ? `/avatars/${avatarId}-${size}.png`       : undefined;
  const overlap = 20;
  const selected = value === src;

  return (
    <>
      {/* Current avatar button */}
      <IconButton onClick={handleOpen} disableRipple={true}
  disableFocusRipple={true}
  disableTouchRipple={true}
  sx={{ 
    padding: 0,
    
    '&:focus': {
      outline: 'none', // Remove focus outline
    }
  }}>
        <Avatar
          src={src}
          alt={current?.name}
          sx={{ width: size, height: size, border: selected ? '1px solid #7cf4f8b2' : '1px solid #7cf4f8b2', m: 0, p: 0.7 , clipPath: `inset(-${overlap}px 0 0 0 round 50%)`,
      // keep bottom edge flush
      position: 'relative',  overflow: 'visible',
      '& img': {
        // lift the image up by the same amount
        position: 'relative',
        top: `-5px`,         
        bottom: `-${overlap}px`,        
        width: `calc(100% + ${overlap * 2}px)`,  
        height: `auto`,  
        minHeight: '100%',  
        objectFit: 'cover',
        clipPath: `inset(-${overlap}px 0 0 0 round 50%)`,
      }
    }}
            >
          {current?.name?.[0] ?? '?'}
        </Avatar>
        
      </IconButton>
      <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" sx={{ mt: 0.5, textAlign: 'center', fontSize: '1rem', fontWeight: 550 }}>
          {current?.name || 'Pick assistant'}
          </Typography>
          {current?.role && (
              <Typography variant="body1" color="textSecondary" sx={{ display: 'block' }}>
              ({current?.role})
              </Typography>
          )}
      </Box>
        

      {/* Popover with all faces */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        PaperProps={{ sx: { p: 3, borderRadius: 3, maxWidth: 360, bgcolor: '#1a2c3bff', boxShadow: 6, mt: 1, backgroundImage: 'none', opacity: 1, border: '1px solid #00e5ffa4' } }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(110px,1fr))',
            rowGap: 3,
            columnGap: 3,
            maxHeight: 340,
            overflowY: 'auto',
            p: 1,
          }}
        >
          {assistants.map(a => {

            const fileName = a.avatarUrl.split('/').pop();
            const avatarId = fileName.replace(/\.png$/, '');
            const size     = 98;

            return(
              <Box
                key={a.id}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer'
                }}
                onClick={() => { onChange(a.id); handleClose(); }}
              >
                <Avatar
                  src={`/avatars/${avatarId}-${size}.png`}
                  alt={a.name}
                  sx={{ width: size, height: size, mb: 0.5, border: '1px solid #00e5ffa4', clipPath: `inset(-${overlap}px 0 0 0 round 50%)`,
      // keep bottom edge flush
      position: 'relative',  overflow: 'visible',
      '& img': {
        // lift the image up by the same amount
        position: 'relative',
        top: `-5px`,         
        bottom: `-${overlap}px`,        
        width: `calc(100% + ${overlap * 2}px)`,  
        height: `auto`,  
        minHeight: '100%',  
        objectFit: 'cover',
        clipPath: `inset(-${overlap}px 0 0 0 round 50%)`,
      }
     }}
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
            )
          })}

          {onAddClick && (
            <Tooltip title={addLabel} arrow>
              <Box
                onClick={() => { handleClose(); onAddClick(); }}
                sx={{
                  width: circleSize,
                  height: circleSize,
                  borderRadius: '50%',
                  border: '2px dashed #7cf4f8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 32,
                  fontWeight: 500,
                  color: '#7cf4f8',
                  mx: 'auto',
                  cursor: 'pointer'
                }}
              >
                +
              </Box>
            </Tooltip>
          )}
        </Box>
      </Popover>
    </>
  );
}