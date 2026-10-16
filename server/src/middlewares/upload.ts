import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { errors } from './errorHandler';

const uploadDir = path.join(process.cwd(), 'uploads', 'vehicle-categories');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const safeName = `vehicle-cat-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  },
});

export const vehicleIconUpload: any = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (_req: any, file: any, cb: any) => {
    const allowedMimes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(errors.badRequest('Only PNG or image files (PNG, JPEG, WebP, SVG) are allowed for vehicle icons'));
    }
  },
});

const profileUploadDir = path.join(process.cwd(), 'uploads', 'profiles');
if (!fs.existsSync(profileUploadDir)) {
  fs.mkdirSync(profileUploadDir, { recursive: true });
}

const profileStorage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => {
    if (!fs.existsSync(profileUploadDir)) {
      fs.mkdirSync(profileUploadDir, { recursive: true });
    }
    cb(null, profileUploadDir);
  },
  filename: (_req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeName = `user-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  },
});

export const profilePhotoUpload: any = multer({
  storage: profileStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (_req: any, file: any, cb: any) => {
    const allowedMimes = ['image/png', 'image/jpeg', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(errors.badRequest('Only JPG, PNG, and WebP images are allowed for profile photos'));
    }
  },
});

