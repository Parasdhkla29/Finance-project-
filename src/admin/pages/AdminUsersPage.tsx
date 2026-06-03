import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../AdminLayout';
import {
  getUsers,
  createUser,
  updateUser,
  resetPassword,
  deleteUser,
} from '../../admin/lib/adminApi';
import type { AdminUser } from '../../admin/lib/adminApi';

// ── Password generator ─────────────────────────────────────────────────────

const PASSWORD_CHARS =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';

function generatePassword(): string {
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((n) => PASSWORD_CHARS[n % PASSWORD_CHARS.length])
    .join('');
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ── Icons ──────────────────────────────────────────────────────────────────

function IconX({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className ?? 'h-5 w-5'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconEye({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className ?? 'h-4 w-4'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className ?? 'h-4 w-4'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className ?? 'h-4 w-4'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconAlertTriangle({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className ?? 'h-5 w-5'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconCopy({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className ?? 'h-4 w-4'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────

interface LabeledFieldProps {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
}

function LabeledField({ label, htmlFor, children, required }: LabeledFieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors';

interface PasswordFieldProps {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onGenerate?: () => void;
}

function PasswordField({ id, value, onChange, placeholder, onGenerate }: PasswordFieldProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${inputClass} pr-10`}
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <IconEyeOff /> : <IconEye />}
        </button>
      </div>
      {onGenerate !== undefined && (
        <button
          type="button"
          onClick={onGenerate}
          className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Generate
        </button>
      )}
    </div>
  );
}

interface PasswordRevealBoxProps {
  password: string;
  onDismiss: () => void;
}

function PasswordRevealBox({ password, onDismiss }: PasswordRevealBoxProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-2 mb-3">
        <IconAlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm font-semibold text-amber-800">
          This password will only be shown once. Copy it now.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded-md bg-white border border-amber-200 px-3 py-2 text-sm font-mono text-gray-900 break-all select-all">
          {password}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-md border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 transition-colors flex items-center gap-1.5"
        >
          <IconCopy className="h-3.5 w-3.5" />
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-3 w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
      >
        I have copied the password — Close
      </button>
    </div>
  );
}

interface ModalShellProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

function ModalShell({ title, onClose, children }: ModalShellProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  // Trap focus and close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close modal"
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

interface FormErrorProps {
  message: string | null;
}

function FormError({ message }: FormErrorProps) {
  if (message === null) return null;
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}

// ── CreateUserModal ────────────────────────────────────────────────────────

interface CreateUserModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function CreateUserModal({ onClose, onSuccess }: CreateUserModalProps) {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);

  function handleGenerate() {
    const p = generatePassword();
    setPassword(p);
    setConfirmPassword(p);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (fullName.trim().length < 2) {
      setError('Full name is required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createUser({
        username: username.trim(),
        password,
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        role,
      });

      if (!result.success) {
        setError(result.error ?? 'Failed to create user.');
        return;
      }

      setCreatedPassword(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleDismissPassword() {
    setCreatedPassword(null);
    onSuccess();
    onClose();
  }

  return (
    <ModalShell title="Create User" onClose={onClose}>
      {createdPassword !== null ? (
        <div>
          <p className="text-sm text-green-700 font-medium mb-2">
            User <strong>@{username}</strong> created successfully.
          </p>
          <PasswordRevealBox password={createdPassword} onDismiss={handleDismissPassword} />
        </div>
      ) : (
        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          <FormError message={error} />

          <LabeledField label="Username" htmlFor="cu-username" required>
            <input
              id="cu-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. johndoe"
              className={inputClass}
              autoComplete="off"
            />
          </LabeledField>

          <LabeledField label="Full Name" htmlFor="cu-fullname" required>
            <input
              id="cu-fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. John Doe"
              className={inputClass}
            />
          </LabeledField>

          <LabeledField label="Email" htmlFor="cu-email">
            <input
              id="cu-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              className={inputClass}
            />
          </LabeledField>

          <LabeledField label="Phone" htmlFor="cu-phone">
            <input
              id="cu-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+44 7700 900000"
              className={inputClass}
            />
          </LabeledField>

          <LabeledField label="Role" htmlFor="cu-role" required>
            <select
              id="cu-role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'user' | 'admin')}
              className={inputClass}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </LabeledField>

          <LabeledField label="Password" htmlFor="cu-password" required>
            <PasswordField
              id="cu-password"
              value={password}
              onChange={setPassword}
              placeholder="Min. 8 characters"
              onGenerate={handleGenerate}
            />
          </LabeledField>

          <LabeledField label="Confirm Password" htmlFor="cu-confirm">
            <PasswordField
              id="cu-confirm"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Repeat password"
            />
          </LabeledField>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}

// ── EditUserModal ──────────────────────────────────────────────────────────

interface EditUserModalProps {
  user: AdminUser;
  onClose: () => void;
  onSuccess: () => void;
  onOpenReset: (user: AdminUser) => void;
}

function EditUserModal({ user, onClose, onSuccess, onOpenReset }: EditUserModalProps) {
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email ?? '');
  const [phone, setPhone] = useState(user.phone ?? '');
  const [status, setStatus] = useState<'active' | 'disabled'>(user.status);
  const [role, setRole] = useState<'admin' | 'user'>(user.role);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (fullName.trim().length < 2) {
      setError('Full name is required.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await updateUser(user.id, {
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        status,
        role,
      });

      if (!result.success) {
        setError(result.error ?? 'Failed to update user.');
        return;
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenReset() {
    onClose();
    onOpenReset(user);
  }

  return (
    <ModalShell title={`Edit @${user.username}`} onClose={onClose}>
      <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
        <FormError message={error} />

        <LabeledField label="Full Name" htmlFor="eu-fullname" required>
          <input
            id="eu-fullname"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputClass}
          />
        </LabeledField>

        <LabeledField label="Email" htmlFor="eu-email">
          <input
            id="eu-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Not set"
            className={inputClass}
          />
        </LabeledField>

        <LabeledField label="Phone" htmlFor="eu-phone">
          <input
            id="eu-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Not set"
            className={inputClass}
          />
        </LabeledField>

        <LabeledField label="Status" htmlFor="eu-status" required>
          <select
            id="eu-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'disabled')}
            className={inputClass}
          >
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </LabeledField>

        <LabeledField label="Role" htmlFor="eu-role" required>
          <select
            id="eu-role"
            value={role}
            onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
            className={inputClass}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </LabeledField>

        <div className="pt-1">
          <button
            type="button"
            onClick={handleOpenReset}
            className="w-full rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors"
          >
            Reset Password Instead
          </button>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ── ResetPasswordModal ─────────────────────────────────────────────────────

interface ResetPasswordModalProps {
  user: AdminUser;
  onClose: () => void;
  onSuccess: () => void;
}

function ResetPasswordModal({ user, onClose, onSuccess }: ResetPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetPassword2, setResetPassword2] = useState<string | null>(null);

  function handleGenerate() {
    const p = generatePassword();
    setPassword(p);
    setConfirmPassword(p);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await resetPassword(user.id, password);
      if (!result.success) {
        setError(result.error ?? 'Failed to reset password.');
        return;
      }
      setResetPassword2(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleDismissPassword() {
    setResetPassword2(null);
    onSuccess();
    onClose();
  }

  return (
    <ModalShell title={`Reset Password — @${user.username}`} onClose={onClose}>
      {resetPassword2 !== null ? (
        <div>
          <p className="text-sm text-green-700 font-medium mb-2">
            Password for <strong>@{user.username}</strong> has been reset.
          </p>
          <PasswordRevealBox password={resetPassword2} onDismiss={handleDismissPassword} />
        </div>
      ) : (
        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2">
            <IconAlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Resetting the password will log this user out of all devices.
            </p>
          </div>

          <FormError message={error} />

          <LabeledField label="New Password" htmlFor="rp-password" required>
            <PasswordField
              id="rp-password"
              value={password}
              onChange={setPassword}
              placeholder="Min. 8 characters"
              onGenerate={handleGenerate}
            />
          </LabeledField>

          <LabeledField label="Confirm New Password" htmlFor="rp-confirm" required>
            <PasswordField
              id="rp-confirm"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Repeat password"
            />
          </LabeledField>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Resetting…' : 'Reset Password'}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}

// ── DeleteConfirmModal ─────────────────────────────────────────────────────

interface DeleteConfirmModalProps {
  user: AdminUser;
  onClose: () => void;
  onSuccess: () => void;
}

function DeleteConfirmModal({ user, onClose, onSuccess }: DeleteConfirmModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    setSubmitting(true);
    try {
      const result = await deleteUser(user.id);
      if (!result.success) {
        setError(result.error ?? 'Failed to delete user.');
        return;
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title="Delete User" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
            <IconAlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-gray-900">Are you sure?</p>
            <p className="mt-1 text-sm text-gray-500">
              You are about to permanently delete{' '}
              <span className="font-semibold text-gray-800">@{user.username}</span>.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong className="font-semibold">Warning:</strong> This will permanently delete the user
          and all their finance data. This action cannot be undone.
        </div>

        <FormError message={error} />

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { void handleDelete(); }}
            disabled={submitting}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Deleting…' : 'Delete User'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Badges ─────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: 'admin' | 'user' }) {
  return role === 'admin' ? (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700">
      Admin
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
      User
    </span>
  );
}

function StatusBadge({ status }: { status: 'active' | 'disabled' }) {
  return status === 'active' ? (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
      Disabled
    </span>
  );
}

// ── Table skeleton ─────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-4 px-6 py-4 border-b border-gray-100">
          <div className="h-4 bg-gray-200 rounded w-28" />
          <div className="h-4 bg-gray-200 rounded w-32" />
          <div className="h-4 bg-gray-200 rounded w-16" />
          <div className="h-4 bg-gray-200 rounded w-16" />
          <div className="h-4 bg-gray-200 rounded w-20" />
          <div className="h-4 bg-gray-200 rounded flex-1" />
        </div>
      ))}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Modal state
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<AdminUser | null>(null);
  const [resetModal, setResetModal] = useState<AdminUser | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<AdminUser | null>(null);

  // Inline status toggle loading
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function handleToggleStatus(user: AdminUser) {
    setTogglingId(user.id);
    try {
      const newStatus = user.status === 'active' ? 'disabled' : 'active';
      await updateUser(user.id, {
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        status: newStatus,
        role: user.role,
      });
      await loadUsers();
    } catch {
      // silently reload to sync state
      await loadUsers();
    } finally {
      setTogglingId(null);
    }
  }

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      u.username.toLowerCase().includes(q) ||
      u.fullName.toLowerCase().includes(q) ||
      (u.email?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Users</h2>
          <p className="mt-1 text-sm text-gray-500">{users.length} total users</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateModal(true)}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
        >
          + Create User
        </button>
      </div>

      {/* Error */}
      {error !== null && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong className="font-semibold">Error:</strong> {error}
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-sm">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username, name, or email…"
            className="w-full rounded-lg border border-gray-300 pl-9 pr-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ minWidth: '960px' }}>
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {[
                  'Username',
                  'Full Name',
                  'Role',
                  'Status',
                  'Created',
                  'Last Login',
                  'Transactions',
                  'Accounts',
                  'Actions',
                ].map((col) => (
                  <th
                    key={col}
                    className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-0">
                    <TableSkeleton />
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-12 text-center text-sm text-gray-500"
                  >
                    {search ? 'No users match your search.' : 'No users found.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                  >
                    {/* Username */}
                    <td className="px-5 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                      @{user.username}
                      {user.tempPasswordRequired && (
                        <span className="ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">
                          temp pw
                        </span>
                      )}
                    </td>
                    {/* Full Name */}
                    <td className="px-5 py-4 text-sm text-gray-700 whitespace-nowrap">
                      {user.fullName}
                    </td>
                    {/* Role */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <RoleBadge role={user.role} />
                    </td>
                    {/* Status */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <StatusBadge status={user.status} />
                    </td>
                    {/* Created */}
                    <td className="px-5 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {formatDate(user.createdAt)}
                    </td>
                    {/* Last Login */}
                    <td className="px-5 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {user.lastLoginAt ? formatDate(user.lastLoginAt) : (
                        <span className="text-gray-400">Never</span>
                      )}
                    </td>
                    {/* Transactions */}
                    <td className="px-5 py-4 text-sm text-gray-700 whitespace-nowrap tabular-nums">
                      {user.transactionCount.toLocaleString('en-GB')}
                    </td>
                    {/* Accounts */}
                    <td className="px-5 py-4 text-sm text-gray-700 whitespace-nowrap tabular-nums">
                      {user.accountCount.toLocaleString('en-GB')}
                    </td>
                    {/* Actions */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/users/${user.id}`)}
                          className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditModal(user)}
                          className="rounded-md px-2.5 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 hover:bg-blue-50 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setResetModal(user)}
                          className="rounded-md px-2.5 py-1.5 text-xs font-medium text-amber-600 border border-amber-200 hover:bg-amber-50 transition-colors"
                        >
                          Reset Pwd
                        </button>
                        <button
                          type="button"
                          onClick={() => { void handleToggleStatus(user); }}
                          disabled={togglingId === user.id}
                          className={`rounded-md px-2.5 py-1.5 text-xs font-medium border transition-colors disabled:opacity-50 ${
                            user.status === 'active'
                              ? 'text-red-600 border-red-200 hover:bg-red-50'
                              : 'text-green-600 border-green-200 hover:bg-green-50'
                          }`}
                        >
                          {togglingId === user.id
                            ? '…'
                            : user.status === 'active'
                            ? 'Disable'
                            : 'Enable'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(user)}
                          className="rounded-md px-2.5 py-1.5 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {createModal && (
        <CreateUserModal
          onClose={() => setCreateModal(false)}
          onSuccess={() => { void loadUsers(); }}
        />
      )}

      {editModal !== null && (
        <EditUserModal
          user={editModal}
          onClose={() => setEditModal(null)}
          onSuccess={() => { void loadUsers(); }}
          onOpenReset={(u) => {
            setEditModal(null);
            setResetModal(u);
          }}
        />
      )}

      {resetModal !== null && (
        <ResetPasswordModal
          user={resetModal}
          onClose={() => setResetModal(null)}
          onSuccess={() => { void loadUsers(); }}
        />
      )}

      {deleteConfirm !== null && (
        <DeleteConfirmModal
          user={deleteConfirm}
          onClose={() => setDeleteConfirm(null)}
          onSuccess={() => { void loadUsers(); }}
        />
      )}
    </AdminLayout>
  );
}
