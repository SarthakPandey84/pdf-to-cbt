import React, { useState, useRef, useCallback } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

export default function ImageCropperModal({ base64Image, onClose, onCropComplete }) {
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const imgRef = useRef(null);

  const onImageLoad = useCallback((e) => {
    imgRef.current = e.currentTarget;
  }, []);

  const handleConfirm = () => {
    if (!completedCrop || !imgRef.current) {
      onClose();
      return;
    }

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    // Set actual size in memory (scaled to account for CSS sizing)
    canvas.width = completedCrop.width * scaleX;
    canvas.height = completedCrop.height * scaleY;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      onClose();
      return;
    }

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY
    );

    // Get the base64 output
    const base64Url = canvas.toDataURL('image/png');
    // Remove the data:image/png;base64, prefix
    const base64Data = base64Url.split(',')[1];
    
    onCropComplete(base64Data, 'image/png');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl flex flex-col max-h-full max-w-5xl w-full">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-white font-semibold">Crop Diagram</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">&times;</button>
        </div>
        
        <div className="p-4 overflow-auto flex-1 flex justify-center items-center bg-slate-950/50">
          {base64Image ? (
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
            >
              <img
                ref={imgRef}
                alt="Crop me"
                src={`data:image/png;base64,${base64Image}`}
                onLoad={onImageLoad}
                className="max-h-[70vh] object-contain"
              />
            </ReactCrop>
          ) : (
            <p className="text-slate-500">Image not available</p>
          )}
        </div>
        
        <div className="p-4 border-t border-slate-800 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm}
            disabled={!completedCrop?.width || !completedCrop?.height}
            className="px-6 py-2 rounded-xl bg-amber-400 text-slate-900 font-bold hover:bg-amber-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm Selection
          </button>
        </div>
      </div>
    </div>
  );
}
