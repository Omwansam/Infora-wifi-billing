import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { API_ENDPOINTS, getAuthHeaders } from '../../../config/api';
import { getAccessToken } from '../../../utils/authToken';
import { Card, Field, TextInput, SaveBar, LoadingBlock } from '../ui';

export default function AccountSettings() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(API_ENDPOINTS.PROFILE, { headers: getAuthHeaders(getAccessToken()) });
        const data = await res.json();
        if (res.ok && data.user) setProfile(data.user);
        else throw new Error(data.error || 'Failed to load profile');
      } catch (e) {
        toast.error(e.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (k, v) => setProfile((p) => ({ ...p, [k]: v }));

  const saveProfile = async () => {
    try {
      setSavingProfile(true);
      const res = await fetch(API_ENDPOINTS.PROFILE, {
        method: 'PUT',
        headers: getAuthHeaders(getAccessToken()),
        body: JSON.stringify({
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success('Profile updated');
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (!pw.current_password || !pw.new_password) return toast.error('Fill in all password fields');
    if (pw.new_password !== pw.confirm) return toast.error('New passwords do not match');
    try {
      setSavingPw(true);
      const res = await fetch(API_ENDPOINTS.CHANGE_PASSWORD, {
        method: 'POST',
        headers: getAuthHeaders(getAccessToken()),
        body: JSON.stringify({ current_password: pw.current_password, new_password: pw.new_password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Change failed');
      setPw({ current_password: '', new_password: '', confirm: '' });
      toast.success('Password changed');
    } catch (e) {
      toast.error(e.message || 'Change failed');
    } finally {
      setSavingPw(false);
    }
  };

  if (loading || !profile) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      <Card title="Personal Information" description="Your account details used across the dashboard">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
          <Field label="First Name">
            <TextInput value={profile.first_name || ''} onChange={(e) => set('first_name', e.target.value)} />
          </Field>
          <Field label="Last Name">
            <TextInput value={profile.last_name || ''} onChange={(e) => set('last_name', e.target.value)} />
          </Field>
          <Field label="Email Address">
            <TextInput type="email" value={profile.email || ''} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="Role">
            <TextInput value={profile.role || ''} disabled className="bg-gray-50 capitalize" />
          </Field>
        </div>
        <div className="mt-6">
          <SaveBar onSave={saveProfile} saving={savingProfile} />
        </div>
      </Card>

      <Card title="Change Password" description="Use a strong password you don't use elsewhere">
        <div className="space-y-4 max-w-md">
          <Field label="Current Password">
            <div className="relative">
              <TextInput
                type={showPw ? 'text' : 'password'}
                value={pw.current_password}
                onChange={(e) => setPw({ ...pw, current_password: e.target.value })}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          <Field label="New Password" hint="At least 6 characters">
            <TextInput
              type={showPw ? 'text' : 'password'}
              value={pw.new_password}
              onChange={(e) => setPw({ ...pw, new_password: e.target.value })}
            />
          </Field>
          <Field label="Confirm New Password">
            <TextInput
              type={showPw ? 'text' : 'password'}
              value={pw.confirm}
              onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
            />
          </Field>
        </div>
        <div className="mt-6">
          <SaveBar onSave={changePassword} saving={savingPw} label="Update Password" />
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Two-Factor Authentication</p>
            <p className="text-sm text-gray-500">Add an extra layer of security to your account. Coming soon.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
