import { Box, Avatar, Tooltip } from '@mui/material';

export default function AvatarGridPicker({ images = [], value, onChange, size = 130, gap= 2 }) {
  const cell = size + 24; // avatar + padding
  const overlap = 20;
  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fill, minmax(${cell}px, 1fr))`,
      gap,
      mb: 2,
      border: '1px solid #00e5ff',
      borderRadius: '16px',
      p: 1
    }}>
      {images.map(src => {
        const selected = value === src;
        const id   = src.split('/').pop().replace('.png','');
        const dims = size;
        return (
          <Tooltip key={src} title={selected ? 'Selected' : 'Click to select'} arrow>
            <Avatar
              src={`/avatars/${id}-${dims}.png`}
              sx={{
                width: size,
                height: size,
                cursor: 'pointer',
                border: selected ? '2px solid #00e5ff' : '1px solid #00e5ffa4',
                boxShadow: selected ? '0 0 6px #00e5ff' : 'none',
                transition: 'all .15s',
                mx: 'auto',
                clipPath: `inset(-${overlap}px 0 0 0 round 50%)`,
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
              onClick={() => onChange(src)}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
}
