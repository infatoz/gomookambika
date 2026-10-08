import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, CameraDevice } from 'html5-qrcode';
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
}

export function QRScannerModal({
  isOpen,
  onClose,
  onScan,
  onScanSuccess,
  loading = false,
}: QRScannerModalProps) {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [currentCameraId, setCurrentCameraId] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [stands, setStands] = useState<TaxiStandQuickOption[]>([]);
  const [loadingStands, setLoadingStands] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerId = 'gm-qr-reader-video';

  // Fetch active taxi stands for quick-testing fallback
  const fetchTaxiStands = useCallback(async () => {
    setLoadingStands(true);
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
    } finally {
      setLoadingStands(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchTaxiStands();
    }
  }, [isOpen, fetchTaxiStands]);

  const handleSuccessfulScan = useCallback(
    (decodedText: string) => {
      // Clean up token if full URL was scanned
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

      // Haptic feedback if supported on mobile
      if (navigator.vibrate) {
        navigator.vibrate([40, 60, 40]);
      }

      if (onScanSuccess) {
        onScanSuccess(cleanToken);
      } else if (onScan) {
        onScan(cleanToken);
      }
    },
    [onScan, onScanSuccess]
  );

  const startScannerWithCamera = useCallback(
    async (cameraIdOrConfig: string | MediaTrackConstraints) => {
      if (!scannerRef.current) return;
      setCameraError(null);
      setIsScanning(false);

      try {
        await scannerRef.current.start(
          cameraIdOrConfig,
          {
            fps: 15,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1.0,
          },
          decodedText => {
            handleSuccessfulScan(decodedText);
          },
          () => {
            // Frame scan tick, ignore
          }
        );

        setIsScanning(true);

        // Check if torch/flashlight is supported
        try {
          const capabilities = scannerRef.current.getRunningTrackCapabilities() as any;
          setHasTorch(Boolean(capabilities?.torch));
        } catch {
          setHasTorch(false);
        }
      } catch (err: any) {
        console.error('Html5Qrcode start error:', err);
        setCameraError(
          err?.name === 'NotAllowedError'
            ? 'Camera permission denied. Please allow camera access in browser settings.'
            : 'Could not access device camera. Try uploading a photo of the QR code below.'
        );
        setIsScanning(false);
      }
    },
    [handleSuccessfulScan]
  );

  // Initialize camera scanner when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    const scanner = new Html5Qrcode(containerId);
    scannerRef.current = scanner;

    const init = async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (!mounted) return;

        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back/environment camera
          const backCam =
            devices.find(d => /back|rear|environment/i.test(d.label)) || devices[devices.length - 1];
          setCurrentCameraId(backCam.id);
          await startScannerWithCamera(backCam.id);
        } else {
          // Try generic environment constraints
          await startScannerWithCamera({ facingMode: 'environment' });
        }
      } catch (err) {
        console.warn('Could not enumerate cameras, trying default environment camera', err);
        if (mounted) {
          await startScannerWithCamera({ facingMode: 'environment' });
        }
      }
    };

    const timer = setTimeout(() => {
      init();
    }, 200);

    return () => {
      mounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current
            .stop()
            .catch(() => {})
            .then(() => {
              scannerRef.current?.clear();
              scannerRef.current = null;
            });
        } else {
          scannerRef.current.clear();
          scannerRef.current = null;
        }
      }
      setIsScanning(false);
    };
  }, [isOpen, startScannerWithCamera]);

  const switchCamera = async () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex(c => c.id === currentCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];
    setCurrentCameraId(nextCamera.id);
    await startScannerWithCamera(nextCamera.id);
  };

  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextTorch = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch } as any],
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn('Torch toggle failed', e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCameraError(null);
    try {
      const scanner = scannerRef.current || new Html5Qrcode(containerId);
      const decodedText = await scanner.scanFile(file, true);
      handleSuccessfulScan(decodedText);
    } catch (err) {
      setCameraError('No valid QR code found in the selected image. Please try another photo.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between p-4 safe-area-top safe-area-bottom">
      {/* Top Bar */}
      <div className="flex items-center justify-between w-full max-w-sm mx-auto z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <QrCode className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">Scan Taxi Stand QR</h3>
            <p className="text-[11px] text-slate-400">Position QR within frame</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-colors active:scale-95"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Center Viewfinder */}
      <div className="flex-1 flex flex-col items-center justify-center my-4 relative">
        <div className="w-72 h-72 rounded-3xl overflow-hidden relative border-2 border-slate-700 bg-slate-950 shadow-2xl flex items-center justify-center">
          <div id={containerId} className="w-full h-full object-cover" />

          {/* Viewfinder Target Reticles */}
          {isScanning && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[210px] h-[210px] relative border-2 border-transparent">
                <div className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
                <div className="scan-laser-line" />
              </div>
            </div>
          )}

          {/* Camera Loading / Error Overlay */}
          {!isScanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 z-10">
              {cameraError ? (
                <div className="space-y-3">
                  <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
                  <p className="text-xs text-amber-200 leading-relaxed">{cameraError}</p>
                  <button
                    onClick={() => startScannerWithCamera({ facingMode: 'environment' })}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center justify-center gap-1.5 mx-auto"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry Camera</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-slate-400">Starting camera feed...</p>
                </div>
              )}
            </div>
          )}

          {/* Loading Indicator when joining queue */}
          {loading && (
            <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-3 z-30">
              <div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <div className="text-sm text-emerald-300 font-medium">Joining Stand Queue...</div>
            </div>
          )}
        </div>

        {/* Camera Controls Bar */}
        <div className="flex items-center gap-2.5 mt-4 z-10">
          {cameras.length > 1 && (
            <button
              onClick={switchCamera}
              className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-300" />
              <span>Flip</span>
            </button>
          )}

          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
                torchOn
                  ? 'bg-amber-500 text-black font-semibold'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Flash {torchOn ? 'On' : 'Off'}</span>
            </button>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-all"
          >
            <ImageIcon className="w-3.5 h-3.5 text-slate-300" />
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

      {/* Bottom Section: Quick Stand Selection & Manual Token */}
      <div className="w-full max-w-sm mx-auto space-y-2.5 z-10">
        <button
          onClick={() => setShowManual(!showManual)}
          className="w-full py-2 text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1"
        >
          <span>
            {showManual
              ? 'Hide Stand Selector / Manual Entry'
              : 'Cannot scan? Select stand directly or paste token'}
          </span>
          {showManual ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showManual && (
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            {/* Active Taxi Stands Quick Selection */}
            {stands.length > 0 && (
              <div>
                <div className="text-xs text-slate-300 font-semibold mb-1.5">
                  Select Stand Directly:
                </div>
                <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {stands.map(stand => (
                    <button
                      key={stand._id}
                      onClick={() => {
                        if (stand.qrToken) {
                          handleSuccessfulScan(stand.qrToken);
                        }
                      }}
                      disabled={!stand.qrToken || loading}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-950 hover:bg-emerald-950/40 hover:border-emerald-500/40 border border-slate-800 text-left text-xs text-white transition-all disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2 truncate font-medium">
                        <Car className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">{stand.name}</span>
                      </div>
                      <span className="text-[11px] text-emerald-400 font-semibold shrink-0 ml-2 flex items-center gap-0.5">
                        <span>Check In</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Manual Token Paste */}
            <div>
              <div className="text-xs text-slate-400 mb-1">Or paste Stand QR Token:</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Paste QR token string..."
                  value={manualToken}
                  onChange={e => setManualToken(e.target.value)}
                  className="input-field !py-2 !text-xs flex-1 font-mono bg-slate-950 border-slate-800 text-white rounded-xl"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && manualToken.trim()) {
                      handleSuccessfulScan(manualToken.trim());
                    }
                  }}
                />
                <button
                  onClick={() => manualToken.trim() && handleSuccessfulScan(manualToken.trim())}
                  disabled={!manualToken.trim() || loading}
                  className="btn-primary !w-auto !py-2 px-4 !text-xs whitespace-nowrap bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
