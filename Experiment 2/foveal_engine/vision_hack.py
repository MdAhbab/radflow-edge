import cv2
import numpy as np
import os

class FovealPreprocessor:
    def __init__(self, global_size=(224, 224), crop_size=(512, 512)):
        self.global_size = global_size
        self.crop_size = crop_size
        
    def process(self, image_path):
        """
        Takes a high-res image and returns:
        1. A downscaled global context image
        2. A native-resolution cropped region centered around the densest anomaly
        """
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image {image_path} not found.")

        # Read in Grayscale
        img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        orig_h, orig_w = img.shape
        
        # 1. Global Context Thumbnail
        global_img = cv2.resize(img, self.global_size)
        
        # 2. Anomaly Detection (Simple contrast/density threshold for demonstration)
        # Apply CLAHE to enhance contrast
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        cl_img = clahe.apply(img)
        
        # Blur and threshold to find dense areas (simulating lung cavitations/nodules)
        blur = cv2.GaussianBlur(cl_img, (15, 15), 0)
        _, thresh = cv2.threshold(blur, 200, 255, cv2.THRESH_BINARY)
        
        # Find contours
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        crop_x, crop_y = 0, 0
        if contours:
            # Find largest high density contour
            c = max(contours, key=cv2.contourArea)
            x, y, w, h = cv2.boundingRect(c)
            # Center of the anomaly
            center_x, center_y = x + w//2, y + h//2
        else:
            # Fallback to center of the image if no clear anomaly
            center_x, center_y = orig_w//2, orig_h//2
            
        # Define crop boundaries
        half_w, half_h = self.crop_size[0]//2, self.crop_size[1]//2
        
        startX = max(0, center_x - half_w)
        startY = max(0, center_y - half_h)
        endX = min(orig_w, center_x + half_w)
        endY = min(orig_h, center_y + half_h)
        
        # Adjust if crop is too small (hit a border)
        if endX - startX < self.crop_size[0]:
            if startX == 0: endX = min(orig_w, self.crop_size[0])
            else: startX = max(0, endX - self.crop_size[0])
            
        if endY - startY < self.crop_size[1]:
            if startY == 0: endY = min(orig_h, self.crop_size[1])
            else: startY = max(0, endY - self.crop_size[1])

        crop_img = img[startY:endY, startX:endX]
        
        return {
            "global_context": global_img,
            "foveal_crop": crop_img,
            "bbox": (startX, startY, endX, endY)
        }
