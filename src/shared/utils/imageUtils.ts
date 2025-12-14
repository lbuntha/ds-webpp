
/**
 * Processes an image file to ensure it is under a specific size limit (default 400KB).
 * It resizes the image if dimensions are too large and adjusts JPEG quality.
 */
export const processImageForUpload = (file: File, maxSizeKB: number = 400): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // 1. Resize logic: Max dimension 1280px (Good balance for screens)
        const MAX_DIMENSION = 1280;
        if (width > height) {
          if (width > MAX_DIMENSION) {
            height *= MAX_DIMENSION / width;
            width = MAX_DIMENSION;
          }
        } else {
          if (height > MAX_DIMENSION) {
            width *= MAX_DIMENSION / height;
            height = MAX_DIMENSION;
          }
        }

        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            reject(new Error("Could not get canvas context"));
            return;
        }
        
        // Draw image on canvas (this effectively resizes it)
        ctx.drawImage(img, 0, 0, width, height);

        // 2. Compression Loop
        let quality = 0.9;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        
        // Loop to reduce quality until size is under limit
        while (dataUrl.length > maxSizeKB * 1024 && quality > 0.1) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(dataUrl);
      };

      img.onerror = () => reject(new Error("Failed to load image for processing"));
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
  });
};
