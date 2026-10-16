import { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { api } from '@/lib/api';
import {
  X,
  QrCode,
  RotateCcw,
  Zap,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Car,
  ArrowRight,
  Loader2,
} from 'lucide-react';

interface TaxiStandQuickOption {
  _id: string;
  name: string;
  qrToken?: string;
}

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan?: (token: string) => void;
  onScanSuccess?: (token: string) => void;
  loading?: boolean;
  title?: string;
  subtitle?: string;
  hideStands?: boolean;
}

export function QRScannerModal({
  isOpen,
  onClose,
  onScan,
  onScanSuccess,
  loading = false,
  title = 'Scan Taxi Stand QR',
  subtitle = 'Position QR within viewfinder',
  hideStands = false,
}: QRScannerModalProps) {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [stands, setStands] = useState<TaxiStandQuickOption[]>([]);
  const [decodingFile, setDecodingFile] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const isScanningRef = useRef<boolean>(false);
  const isScannedRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch active taxi stands for quick-testing fallback
  const fetchTaxiStands = useCallback(async () => {
    try {
      const res = await api.get<{ data: TaxiStandQuickOption[] }>('/locations/stands');
      if (res.data) setStands(res.data);
    } catch {
      try {
        const qRes = await api.get<{ data: TaxiStandQuickOption[] }>('/queue/stands');
        if (qRes.data) setStands(qRes.data);
      } catch {
        // Ignored
      }
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchTaxiStands();
    }
  }, [isOpen, fetchTaxiStands]);

  const handleSuccessfulScan = useCallback(
    (decodedText: string) => {
      if (isScannedRef.current) return;
      isScannedRef.current = true;

      let cleanToken = decodedText.trim();
      if (cleanToken.includes('token=')) {
        try {
          const url = new URL(cleanToken);
          cleanToken = url.searchParams.get('token') || cleanToken;
        } catch {
          const match = cleanToken.match(/token=([a-zA-Z0-9._-]+)/);
          if (match) cleanToken = match[1];
        }
      }

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([40, 60, 40]);
        } catch {}
      }

      if (onScanSuccess) {
        onScanSuccess(cleanToken);
      } else if (onScan) {
        onScan(cleanToken);
      }
    },
    [onScan, onScanSuccess]
  );

  // Stop camera tracks and cancel scan loop
  const stopCamera = useCallback(() => {
    isScanningRef.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchOn(false);
    setHasTorch(false);
    setIsCameraReady(false);
  }, []);

  // Frame scanner loop using BarcodeDetector + jsQR fallback
  const startScanningLoop = useCallback(() => {
    let detector: any = null;
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      } catch {
        detector = null;
      }
    }

    const scanFrame = async (timestamp: number) => {
      if (!isScanningRef.current || isScannedRef.current) return;

      // Scan every ~75ms (~13 fps) for snappy detection with minimal CPU load
      if (timestamp - lastScanTimeRef.current >= 75) {
        lastScanTimeRef.current = timestamp;

        const video = videoRef.current;
        if (
          video &&
          video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
          video.videoWidth > 0 &&
          video.videoHeight > 0
        ) {
          let foundText: string | null = null;

          // 1. Hardware-accelerated BarcodeDetector (Chrome/Safari modern)
          if (detector) {
            try {
              const barcodes = await detector.detect(video);
              if (barcodes && barcodes.length > 0 && barcodes[0]?.rawValue) {
                foundText = barcodes[0].rawValue;
              }
            } catch {
              // Ignore and fallback to canvas jsQR
            }
          }

          // 2. jsQR Fallback
          if (!foundText && canvasRef.current) {
            try {
              const canvas = canvasRef.current;
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                // Downsample large video feeds to max 640px for super fast decoding
                const maxDim = Math.max(video.videoWidth, video.videoHeight);
                const scale = maxDim > 640 ? 640 / maxDim : 1;
                const targetW = Math.round(video.videoWidth * scale);
                const targetH = Math.round(video.videoHeight * scale);

                if (canvas.width !== targetW || canvas.height !== targetH) {
                  canvas.width = targetW;
                  canvas.height = targetH;
                }

                ctx.drawImage(video, 0, 0, targetW, targetH);
                const imageData = ctx.getImageData(0, 0, targetW, targetH);
                const code = jsQR(imageData.data, targetW, targetH, {
                  inversionAttempts: 'dontInvert',
                });

                if (code && code.data) {
                  foundText = code.data;
                }
              }
            } catch {
              // Canvas draw/read error safe ignore
            }
          }

          if (foundText && !isScannedRef.current) {
            handleSuccessfulScan(foundText);
            return;
          }
        }
      }

      if (isScanningRef.current && !isScannedRef.current) {
        animFrameRef.current = requestAnimationFrame(scanFrame);
      }
    };

    isScanningRef.current = true;
    animFrameRef.current = requestAnimationFrame(scanFrame);
  }, [handleSuccessfulScan]);

  // Request camera and initialize video stream
  const startCamera = useCallback(
    async (mode: 'environment' | 'user' = facingMode) => {
      stopCamera();
      setCameraError(null);
      setIsCameraReady(false);
      isScannedRef.current = false;

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera access is not supported by your browser.');
        return;
      }

      try {
        let stream: MediaStream;
        try {
          // Attempt with ideal resolution and facingMode
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: mode },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch {
          // Fallback if ideal constraints fail on specific hardware
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: mode },
            audio: false,
          });
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Crucial for mobile iOS & Android autoplay policies
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.setAttribute('muted', 'true');
          videoRef.current.muted = true;

          try {
            await videoRef.current.play();
          } catch (playErr) {
            console.warn('Video play caught:', playErr);
          }
        }

        // Check if torch/flashlight is supported on the active video track
        try {
          const track = stream.getVideoTracks()[0];
          const caps: any = track?.getCapabilities ? track.getCapabilities() : {};
          setHasTorch(Boolean(caps?.torch));
        } catch {
          setHasTorch(false);
        }

        setIsCameraReady(true);
        startScanningLoop();
      } catch (err: any) {
        console.error('Camera access error:', err);
        setIsCameraReady(false);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraError(
            'Camera permission was denied. Please allow camera access in your browser or phone settings.'
          );
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setCameraError('No camera was found on this device.');
        } else {
          setCameraError('Could not start camera feed. Please check permissions or upload a QR photo.');
        }
      }
    },
    [facingMode, stopCamera, startScanningLoop]
  );

  // Lifecycle when modal opens / closes
  useEffect(() => {
    if (isOpen) {
      isScannedRef.current = false;
      startCamera(facingMode);
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera, facingMode]);

  // Flip camera between environment (back) and user (front)
  const switchCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Toggle flash torch if supported by device
  const toggleTorch = async () => {
    if (!streamRef.current || !hasTorch) return;
    try {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        const nextTorch = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextTorch }],
        });
        setTorchOn(nextTorch);
      }
    } catch (e) {
      console.warn('Torch toggle failed', e);
    }
  };

  // Decode QR code from an uploaded image file
  const decodeQRFromImage = async (file: File): Promise<string | null> => {
    // 1. Hardware BarcodeDetector
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const BarcodeDetectorClass = (window as any).BarcodeDetector;
        const formats = await BarcodeDetectorClass.getSupportedFormats?.().catch(() => ['qr_code']);
        if (!formats || formats.includes('qr_code')) {
          const detector = new BarcodeDetectorClass({ formats: ['qr_code'] });
          const bitmap = await createImageBitmap(file);
          const codes = await detector.detect(bitmap);
          if (codes && codes.length > 0 && codes[0]?.rawValue) {
            return codes[0].rawValue;
          }
        }
      } catch (e) {
        console.warn('BarcodeDetector on image failed, trying jsQR:', e);
      }
    }

    // 2. jsQR with multi-resolution sampling
    try {
      const objectUrl = URL.createObjectURL(file);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = objectUrl;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (ctx && img.naturalWidth && img.naturalHeight) {
        const origW = img.naturalWidth;
        const origH = img.naturalHeight;
        const targetSizes = [
          Math.min(1000, Math.max(origW, origH)),
          Math.min(600, Math.max(origW, origH)),
          Math.max(origW, origH),
        ];
        const uniqueSizes = Array.from(new Set(targetSizes));

        for (const targetSize of uniqueSizes) {
          let w = origW;
          let h = origH;
          if (Math.max(origW, origH) > targetSize) {
            const ratio = targetSize / Math.max(origW, origH);
            w = Math.round(origW * ratio);
            h = Math.round(origH * ratio);
          }

          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);

          const imgData = ctx.getImageData(0, 0, w, h);
          const code = jsQR(imgData.data, w, h, { inversionAttempts: 'attemptBoth' });

          if (code && code.data) {
            URL.revokeObjectURL(objectUrl);
            return code.data;
          }
        }
      }
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      console.warn('jsQR scan attempt failed:', e);
    }

    return null;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCameraError(null);
    setDecodingFile(true);
    try {
      const decodedText = await decodeQRFromImage(file);
      if (decodedText) {
        handleSuccessfulScan(decodedText);
      } else {
        setCameraError('No QR code detected in this photo. Please ensure clear lighting.');
      }
    } catch {
      setCameraError('Could not process photo. Please try again.');
    } finally {
      setDecodingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col justify-between p-4 safe-area-top safe-area-bottom">
      {/* Top Bar */}
      <div className="flex items-center justify-between w-full max-w-sm mx-auto z-10 pt-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white/[0.08] text-emerald-400 flex items-center justify-center">
            <QrCode className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-white font-extrabold text-sm">{title}</h3>
            <p className="text-[11px] text-neutral-400">{subtitle}</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-neutral-800 text-neutral-300 hover:text-white flex items-center justify-center transition-colors active:scale-90"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Center Viewfinder */}
      <div className="flex-1 flex flex-col items-center justify-center my-4 relative">
        <div className="w-72 h-72 rounded-3xl overflow-hidden relative border-2 border-white/[0.12] bg-neutral-950 shadow-2xl flex items-center justify-center">
          {/* Live Video Feed */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isCameraReady ? 'opacity-100' : 'opacity-0'
            }`}
          />
          {/* Hidden Canvas for QR frame reading */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Viewfinder Target Reticles */}
          {isCameraReady && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[210px] h-[210px] relative border-2 border-transparent">
                <div className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />
                <div className="scan-laser-line" />
              </div>
            </div>
          )}

          {/* Camera Loading / Error Overlay */}
          {!isCameraReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-black/90 z-10">
              {cameraError ? (
                <div className="space-y-3">
                  <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
                  <p className="text-xs text-amber-200 leading-relaxed">{cameraError}</p>
                  <button
                    onClick={() => startCamera(facingMode)}
                    className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs text-white font-semibold flex items-center justify-center gap-1.5 mx-auto transition-all active:scale-95"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry Camera</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-neutral-400">Starting camera feed...</p>
                </div>
              )}
            </div>
          )}

          {/* Loading Indicator when decoding photo */}
          {decodingFile && (
            <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-2.5 z-30">
              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
              <div className="text-xs text-white font-bold">Scanning photo...</div>
            </div>
          )}

          {/* Loading Indicator when joining queue */}
          {loading && (
            <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-2.5 z-30">
              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
              <div className="text-xs text-white font-bold">Checking in to stand...</div>
            </div>
          )}
        </div>

        {/* Camera Controls Bar */}
        <div className="flex items-center gap-2.5 mt-4 z-10">
          <button
            onClick={switchCamera}
            className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-white/[0.08] hover:bg-neutral-800 active:scale-95 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
            title="Switch front / rear camera"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Flip</span>
          </button>

          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                torchOn
                  ? 'bg-amber-400 text-black font-bold'
                  : 'bg-neutral-900 border border-white/[0.08] hover:bg-neutral-800 text-neutral-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Flash {torchOn ? 'On' : 'Off'}</span>
            </button>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={decodingFile || loading}
            className="px-3.5 py-1.5 rounded-xl bg-neutral-900 border border-white/[0.08] hover:bg-neutral-800 active:scale-95 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <ImageIcon className="w-3.5 h-3.5 text-neutral-300" />
            <span>Upload Photo</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      </div>

      {/* Bottom Section: Stand Quick Select / Manual */}
      {!hideStands && (
        <div className="w-full max-w-sm mx-auto space-y-2 z-10 pb-2">
          <button
            onClick={() => setShowManual(!showManual)}
            className="w-full py-2 text-xs text-neutral-400 hover:text-white flex items-center justify-center gap-1"
          >
            <span>
              {showManual
                ? 'Hide Stand Selector'
                : 'Select Stand Directly or Enter Code'}
            </span>
            {showManual ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showManual && (
            <div className="p-3.5 rounded-2xl bg-neutral-900 border border-white/[0.08] space-y-3">
              {stands.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs text-neutral-300 font-bold">
                    Select Taxi Stand:
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto no-scrollbar">
                    {stands.map(stand => (
                      <button
                        key={stand._id}
                        onClick={() => {
                          if (stand.qrToken) {
                            handleSuccessfulScan(stand.qrToken);
                          }
                        }}
                        disabled={!stand.qrToken || loading}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-black hover:bg-neutral-800 border border-white/[0.06] text-left text-xs text-white transition-all disabled:opacity-40"
                      >
                        <div className="flex items-center gap-2 truncate font-medium">
                          <Car className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">{stand.name}</span>
                        </div>
                        <span className="text-[11px] text-emerald-400 font-bold shrink-0 ml-2 flex items-center gap-0.5">
                          <span>Check In</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5 pt-1">
                <div className="text-xs text-neutral-400">Or paste QR token:</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Token string..."
                    value={manualToken}
                    onChange={e => setManualToken(e.target.value)}
                    className="input-field !py-2 !text-xs flex-1 font-mono"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && manualToken.trim()) {
                        handleSuccessfulScan(manualToken.trim());
                      }
                    }}
                  />
                  <button
                    onClick={() => manualToken.trim() && handleSuccessfulScan(manualToken.trim())}
                    disabled={!manualToken.trim() || loading}
                    className="btn-uber-primary !w-auto !py-2 px-4 !text-xs !rounded-xl"
                  >
                    Check In
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
