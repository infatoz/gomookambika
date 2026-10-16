import { useState, useRef } from 'react';
import {
  User,
  Phone,
  Mail,
  ShieldCheck,
  CreditCard,
  HelpCircle,
  FileText,
  LogOut,
  ChevronRight,
  Camera,
  Edit2,
  Check,
  X,
  Loader2,
  AlertCircle,
  Building2,
  Compass,
} from 'lucide-react';
import { api, AuthState } from '@/lib/api';
import { toast } from '@/lib/toast';

interface ProfilePageProps {
  auth: AuthState;
  onLogout: () => void;
  onOpenLogin: () => void;
  onUpdateUser?: (updated: { name?: string; phone?: string; email?: string; profilePhoto?: string }) => void;
}

export function ProfilePage({ auth, onLogout, onOpenLogin, onUpdateUser }: ProfilePageProps) {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [nameInput, setNameInput] = useState(auth.user?.name || '');
  const [emailInput, setEmailInput] = useState(auth.user?.email || '');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!auth.token) {
    return (
      <div className="max-w-md mx-auto min-h-[calc(100vh-140px)] flex flex-col items-center justify-center p-6 text-center text-black">
        <div className="w-20 h-20 rounded-full bg-neutral-100 flex items-center justify-center text-3xl mb-4 shadow-inner">
          👤
        </div>
        <h2 className="text-2xl font-bold text-neutral-900">Your Passenger Account</h2>
        <p className="text-sm text-neutral-500 mt-2 max-w-xs">
          Log in with your mobile number to view profile settings, saved trips, and driver ratings.
        </p>
        <button
          onClick={onOpenLogin}
          className="mt-6 px-6 py-3.5 bg-black hover:bg-neutral-800 text-white font-bold rounded-2xl text-sm transition-all shadow-md active:scale-95"
        >
          Log in or Sign up
        </button>
      </div>
    );
  }

  const userName = auth.user?.name || 'Customer';
  const userPhone = auth.user?.phone || '';
  const userEmail = auth.user?.email || '';
  const userPhoto = auth.user?.profilePhoto;

  const handleOpenEdit = () => {
    setNameInput(auth.user?.name || '');
    setEmailInput(auth.user?.email || '');
    setErrorMsg('');
    setSuccessMsg('');
    setEditModalOpen(true);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      const msg = 'Please select a valid image file (JPG, PNG, WebP)';
      setErrorMsg(msg);
      toast.error('Invalid Format', msg);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      const msg = 'Image size must be less than 5MB';
      setErrorMsg(msg);
      toast.error('File Too Large', msg);
      return;
    }

    setUploadingPhoto(true);
    setErrorMsg('');
    try {
      const res = await api.uploadPhoto<{ success: boolean; data: { photoUrl: string } }>(file, auth);
      if (res?.data?.photoUrl) {
        onUpdateUser?.({ profilePhoto: res.data.photoUrl });
        setSuccessMsg('Profile photo updated successfully!');
        toast.success('Photo Updated!', 'Your new profile photo has been saved.');
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to upload profile photo';
      setErrorMsg(msg);
      toast.error('Upload Failed', msg);
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) {
      setErrorMsg('Name is required');
      toast.error('Validation Error', 'Name is required');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    try {
      await api.patch<{ success: boolean; data: { name: string; email?: string } }>(
        '/auth/profile',
        { name: nameInput.trim(), email: emailInput.trim() },
        auth
      );

      onUpdateUser?.({
        name: nameInput.trim(),
        email: emailInput.trim(),
      });

      setSuccessMsg('Profile details saved successfully!');
      toast.success('Profile Saved', 'Your personal details have been updated.');
      setTimeout(() => {
        setSuccessMsg('');
        setEditModalOpen(false);
      }, 1200);
    } catch (err: any) {
      const msg = err?.message || 'Failed to update profile details';
      setErrorMsg(msg);
      toast.error('Update Failed', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6 text-black space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-neutral-900">
          Account
        </h1>
        <button
          type="button"
          onClick={handleOpenEdit}
          className="px-3.5 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-900 text-xs font-bold flex items-center gap-1.5 transition-colors active:scale-95 shadow-2xs"
        >
          <Edit2 className="w-3.5 h-3.5" />
          <span>Edit Profile</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* User Info Header Card with Photo Upload */}
      <div className="p-5 rounded-3xl bg-neutral-50 border border-neutral-200 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-4 min-w-0">
          {/* Avatar with Photo Upload Trigger */}
          <div className="relative shrink-0 group">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
            />
            {userPhoto ? (
              <img
                src={userPhoto}
                alt={userName}
                className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-black text-white flex items-center justify-center font-black text-2xl shadow-sm">
                {userName[0]?.toUpperCase() || 'P'}
              </div>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-neutral-900 hover:bg-black text-white border-2 border-white flex items-center justify-center shadow-md transition-transform active:scale-90"
              title="Change profile photo"
            >
              {uploadingPhoto ? (
                <Loader2 className="w-3 h-3 animate-spin text-white" />
              ) : (
                <Camera className="w-3 h-3" />
              )}
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-lg text-neutral-900 truncate">{userName}</h2>
            </div>
            <p className="text-xs text-neutral-500 font-mono mt-0.5">{userPhone}</p>
            {userEmail && (
              <p className="text-xs text-neutral-500 truncate mt-0.5">{userEmail}</p>
            )}
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 mt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Verified Passenger
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingPhoto}
          className="text-xs font-bold text-neutral-600 hover:text-black border border-neutral-300 rounded-xl px-2.5 py-1 hover:bg-neutral-100 transition-colors hidden sm:block"
        >
          {uploadingPhoto ? 'Uploading...' : 'Change Photo'}
        </button>
      </div>

      {/* Quick Settings Group */}
      <div className="bg-white rounded-3xl border border-neutral-200 divide-y divide-neutral-100 overflow-hidden shadow-xs">
        <div
          onClick={handleOpenEdit}
          className="p-4 flex items-center justify-between hover:bg-neutral-50 cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-neutral-600" />
            <div>
              <h4 className="text-sm font-semibold text-neutral-900">Personal Information</h4>
              <p className="text-xs text-neutral-500">Edit Name, Email, and Profile Photo</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-neutral-400" />
        </div>

        <div className="p-4 flex items-center justify-between hover:bg-neutral-50 cursor-pointer transition-colors">
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-neutral-600" />
            <div>
              <h4 className="text-sm font-semibold text-neutral-900">Payment & Settlement</h4>
              <p className="text-xs text-neutral-500">Direct Cash or Bank UPI to Captain on Ride Finish</p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            Zero Platform Markup
          </span>
        </div>

        <a
          href="tel:+919481200000"
          className="p-4 flex items-center justify-between hover:bg-neutral-50 cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-3">
            <Phone className="w-5 h-5 text-emerald-600" />
            <div>
              <h4 className="text-sm font-semibold text-neutral-900">24x7 Association Control Room</h4>
              <p className="text-xs text-neutral-500">Call Dispatch: +91 94812 00000</p>
            </div>
          </div>
          <span className="text-xs font-bold text-neutral-800 bg-neutral-100 px-2.5 py-1 rounded-full">
            Call Helpline
          </span>
        </a>

        <div className="p-4 flex items-center justify-between hover:bg-neutral-50 cursor-pointer transition-colors">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-neutral-600" />
            <div>
              <h4 className="text-sm font-semibold text-neutral-900">Association Bylaws & Fixed Fares</h4>
              <p className="text-xs text-neutral-500">Government approved pilgrim tariffs (Reg: KA-UD-TA-2024-089)</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-neutral-400" />
        </div>
      </div>

      {/* Logout Button */}
      <button
        onClick={onLogout}
        className="w-full py-4 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-rose-600 font-bold text-sm flex items-center justify-center gap-2 transition-colors border border-neutral-200 active:scale-98"
      >
        <LogOut className="w-4 h-4" />
        <span>Log out of Go Mookambika</span>
      </button>

      <div className="text-center text-[11px] text-neutral-400 pt-2">
        Sri Mookambika Tourist Taxi Association • v1.0.0
      </div>

      {/* ─── EDIT PROFILE MODAL ────────────────────────────── */}
      {editModalOpen && (
        <div
          onClick={() => setEditModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-900">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900 text-base">Edit Profile</h3>
                  <p className="text-xs text-neutral-500">Update your passenger credentials</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Profile Photo Uploader */}
            <div className="flex flex-col items-center justify-center py-2 space-y-2">
              <div className="relative">
                {userPhoto ? (
                  <img
                    src={userPhoto}
                    alt={userName}
                    className="w-20 h-20 rounded-full object-cover border-2 border-neutral-200 shadow-sm"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-black text-white flex items-center justify-center font-black text-3xl shadow-sm">
                    {userName[0]?.toUpperCase() || 'P'}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-neutral-900 text-white border-2 border-white flex items-center justify-center shadow-md active:scale-95"
                >
                  {uploadingPhoto ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
              >
                {uploadingPhoto ? 'Uploading Photo...' : 'Upload Profile Photo'}
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  placeholder="e.g. Ramesh Hegde"
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-black outline-none text-sm font-semibold transition-colors"
                />
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                  Email Address
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  placeholder="e.g. ramesh@gmail.com"
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-black outline-none text-sm font-semibold transition-colors"
                />
              </div>

              {/* Phone (Read Only) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-600 flex items-center justify-between">
                  <span>Registered Mobile</span>
                  <span className="text-[10px] text-neutral-400 font-normal">Verified via OTP</span>
                </label>
                <input
                  type="text"
                  value={userPhone}
                  disabled
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-100 text-neutral-500 font-mono text-sm cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="py-3 rounded-xl border border-neutral-200 text-neutral-700 font-bold text-xs hover:bg-neutral-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="py-3 rounded-xl bg-black hover:bg-neutral-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md active:scale-95"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
