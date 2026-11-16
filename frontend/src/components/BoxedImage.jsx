import React from 'react';

// A photo with the admin's boxes drawn on it. Boxes are fractions of the image, so the photo is shown whole
// (never cropped) and the boxes line up on any screen size.
export default function BoxedImage({ src, boxes = [], alt = '', className, onError }) {
  return (
    <div style={{ position: 'relative', lineHeight: 0 }}>
      <img src={src} alt={alt} className={className} onError={onError}
        style={{ width: '100%', height: 'auto', maxHeight: 'none', objectFit: 'fill', display: 'block' }} />
      {boxes.map(([x, y, w, h], i) => (
        <div key={i} data-testid="hazard-box"
          style={{ position: 'absolute', left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%`,
            border: '3px solid #22c55e', boxSizing: 'border-box', pointerEvents: 'none' }} />
      ))}
    </div>
  );
}
