'use client';

/**
 * NewsletterSignup
 *
 * Reusable double opt-in newsletter form.
 *
 * Props:
 *   source   — tracking label ('world-cup-hub' | 'watch-live' | 'match-page')
 *   variant  — 'card'   → standalone card with heading + description
 *              'inline' → compact horizontal strip (fits within a page section)
 *
 * States: idle → loading → success | error
 */

import { useState, useRef, useEffect, type FormEvent } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  source: string;
  variant?: 'card' | 'inline';
  /** Optional override heading for card variant */
  heading?: string;
  /** Optional override description for card variant */
  description?: string;
}

type State = 'idle' | 'loading' | 'success' | 'error';

// ---------------------------------------------------------------------------
// Shared input + button
// ---------------------------------------------------------------------------

function EmailInput({
  value,
  onChange,
  disabled,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <input
      ref={inputRef}
      type="email"
      name="email"
      autoComplete="email"
      placeholder="your@email.com"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      required
      className="
        flex-1 min-w-0 bg-gray-800 border border-gray-700
        text-white placeholder-gray-500 text-sm
        rounded-xl px-4 py-2.5
        focus:outline-none focus:border-yellow-600 focus:ring-1 focus:ring-yellow-600/50
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      "
    />
  );
}

function SubmitButton({ loading }: { loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="
        shrink-0
        bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-600
        disabled:opacity-60 disabled:cursor-not-allowed
        text-black font-bold text-sm
        px-5 py-2.5 rounded-xl
        transition-colors flex items-center gap-2
      "
    >
      {loading ? (
        <>
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
          <span>Sending…</span>
        </>
      ) : (
        <>⚡ Subscribe</>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Success state
// ---------------------------------------------------------------------------

function SuccessMessage({ variant }: { variant: 'card' | 'inline' }) {
  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2 py-2">
        <span className="text-green-400 text-lg leading-none" aria-hidden>✓</span>
        <p className="text-green-400 text-sm font-medium">
          Check your inbox for a confirmation link!
        </p>
      </div>
    );
  }

  return (
    <div className="text-center py-4 space-y-2">
      <div className="text-4xl" aria-hidden>📬</div>
      <p className="text-white font-bold text-base">Check your inbox!</p>
      <p className="text-gray-400 text-sm max-w-sm mx-auto">
        We&apos;ve sent a confirmation link to your email address.
        Click it to complete your subscription.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card variant
// ---------------------------------------------------------------------------

function CardForm({
  heading,
  description,
  email,
  setEmail,
  state,
  error,
  onSubmit,
  inputRef,
}: {
  heading: string;
  description: string;
  email: string;
  setEmail: (v: string) => void;
  state: State;
  error: string;
  onSubmit: (e: FormEvent) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  if (state === 'success') return <SuccessMessage variant="card" />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5" aria-hidden>📬</span>
        <div>
          <h2 className="text-white font-black text-base sm:text-lg leading-tight">
            {heading}
          </h2>
          <p className="text-gray-400 text-sm mt-1 leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2" noValidate>
        {/* Anti-spam honeypot — hidden from real users, must stay empty */}
        <input
          type="text"
          name="_hp"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden"
        />
        <EmailInput
          value={email}
          onChange={setEmail}
          disabled={state === 'loading'}
          inputRef={inputRef}
        />
        <SubmitButton loading={state === 'loading'} />
      </form>

      {/* Error */}
      {error && (
        <p role="alert" className="text-red-400 text-xs flex items-center gap-1.5">
          <span aria-hidden>⚠</span> {error}
        </p>
      )}

      {/* Privacy note */}
      <p className="text-gray-600 text-[11px]">
        Free · No spam · Unsubscribe any time. Double opt-in required.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline variant
// ---------------------------------------------------------------------------

function InlineForm({
  email,
  setEmail,
  state,
  error,
  onSubmit,
  inputRef,
}: {
  email: string;
  setEmail: (v: string) => void;
  state: State;
  error: string;
  onSubmit: (e: FormEvent) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  if (state === 'success') return <SuccessMessage variant="inline" />;

  return (
    <div className="space-y-2">
      <form onSubmit={onSubmit} className="flex gap-2" noValidate>
        {/* Anti-spam honeypot */}
        <input
          type="text"
          name="_hp"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden"
        />
        <EmailInput
          value={email}
          onChange={setEmail}
          disabled={state === 'loading'}
          inputRef={inputRef}
        />
        <SubmitButton loading={state === 'loading'} />
      </form>
      {error && (
        <p role="alert" className="text-red-400 text-xs flex items-center gap-1.5">
          <span aria-hidden>⚠</span> {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const DEFAULT_HEADING     = 'Get World Cup 2026 updates in your inbox';
const DEFAULT_DESCRIPTION = 'Fixture alerts, live score roundups and match reports — delivered free. No spam.';

export default function NewsletterSignup({
  source,
  variant = 'card',
  heading     = DEFAULT_HEADING,
  description = DEFAULT_DESCRIPTION,
}: Props) {
  const [email, setEmail]     = useState('');
  const [state, setState]     = useState<State>('idle');
  const [error, setError]     = useState('');
  const [loadTime, setLoadTime] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Record when the form was rendered — used server-side to detect instant-submit bots
  useEffect(() => { setLoadTime(Date.now()); }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    const trimmed = email.trim();
    if (!trimmed) {
      setError('Please enter your email address.');
      inputRef.current?.focus();
      return;
    }

    // Client-side: read honeypot field directly from the form element
    const form     = e.currentTarget as HTMLFormElement;
    const honeypot = (form.elements.namedItem('_hp') as HTMLInputElement | null)?.value ?? '';

    setState('loading');

    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: trimmed, source, _hp: honeypot, _t: loadTime }),
      });

      const data: { ok?: boolean; error?: string } = await res.json();

      if (!res.ok) {
        // Server returned a user-facing error (validation / rate-limit)
        setError(data.error ?? 'Something went wrong. Please try again.');
        setState('error');
        return;
      }

      setState('success');
    } catch {
      setError('Network error. Please check your connection and try again.');
      setState('error');
    }
  }

  const sharedProps = { email, setEmail, state, error, onSubmit: handleSubmit, inputRef };

  if (variant === 'inline') {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Label */}
          <div className="shrink-0 sm:w-48">
            <p className="text-white font-bold text-sm">
              📬 World Cup updates
            </p>
            <p className="text-gray-500 text-xs mt-0.5">
              Free · No spam
            </p>
          </div>
          {/* Form */}
          <div className="flex-1">
            <InlineForm {...sharedProps} />
          </div>
        </div>
      </div>
    );
  }

  // Card variant
  return (
    <div className="bg-gradient-to-br from-yellow-950/30 via-gray-900 to-gray-900
                    border border-yellow-800/30 rounded-2xl p-5 sm:p-6">
      <CardForm
        heading={heading}
        description={description}
        {...sharedProps}
      />
    </div>
  );
}
