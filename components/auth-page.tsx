'use client';

/* oxlint-disable next/no-html-link-for-pages -- Native links avoid a Vinext production navigation crash. */

import {
  ArrowLeft,
  Check,
  GraduationCap,
  LockKeyhole,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useState } from 'react';

export default function AuthPage({ mode }: { mode: 'signin' | 'signup' }) {
  const [role, setRole] = useState<'student' | 'representative'>('student');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/campus', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: mode === 'signin' ? 'login' : 'signup',
          fullName,
          email,
          password,
          code,
          role,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error || 'We could not complete that request.');
      window.location.assign('/app');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page-shell">
      <section className="auth-brand-panel">
        <a className="auth-back" href="/">
          <ArrowLeft size={16} /> Back to Campus Hub
        </a>
        <div>
          <span className="marketing-kicker">A BETTER ACADEMIC DAY</span>
          <h1>
            {mode === 'signin'
              ? 'Welcome back to your course.'
              : 'Your organized semester starts here.'}
          </h1>
          <p>
            One secure account for course materials, schedules, rooms,
            classmates and student opportunities.
          </p>
        </div>
        <div className="auth-proof">
          <div>
            <ShieldCheck />
            <span>
              <strong>Private by design</strong>
              <small>
                Passwords are salted and hashed. Course data stays scoped to
                verified members.
              </small>
            </span>
          </div>
          <div>
            <GraduationCap />
            <span>
              <strong>Built for real courses</strong>
              <small>
                Representatives manage content directly where it appears.
              </small>
            </span>
          </div>
        </div>
      </section>
      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <a className="marketing-logo" href="/">
            <span>CH</span>Campus Hub
          </a>
          <span className="marketing-kicker">
            {mode === 'signin' ? 'SECURE SIGN IN' : 'CREATE ACCOUNT'}
          </span>
          <h2>
            {mode === 'signin'
              ? 'Continue to Campus Hub'
              : 'Join your verified course'}
          </h2>
          <p>
            {mode === 'signin'
              ? 'Use your account email and password.'
              : 'Create your account with the code from your representative.'}
          </p>
          <form className="standalone-auth-form" onSubmit={submit}>
            {mode === 'signup' && (
              <>
                <div className="auth-role-choice">
                  <button
                    className={role === 'student' ? 'active' : ''}
                    type="button"
                    onClick={() => setRole('student')}
                  >
                    <GraduationCap size={18} />
                    Student
                  </button>
                  <button
                    className={role === 'representative' ? 'active' : ''}
                    type="button"
                    onClick={() => setRole('representative')}
                  >
                    <Users size={18} />
                    Representative
                  </button>
                </div>
                <label>
                  Full name
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    autoComplete="name"
                    required
                    minLength={3}
                    placeholder="Your real name"
                  />
                </label>
              </>
            )}
            <label>
              Email address
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                placeholder="you@university.edu"
              />
            </label>
            <label>
              Password
              <div className="auth-password">
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={
                    mode === 'signin' ? 'current-password' : 'new-password'
                  }
                  required
                  minLength={mode === 'signin' ? 1 : 10}
                  placeholder={
                    mode === 'signin'
                      ? 'Your password'
                      : '10+ characters with upper/lowercase and number'
                  }
                />
                <LockKeyhole size={17} />
              </div>
            </label>
            {mode === 'signup' && (
              <label>
                {role === 'student'
                  ? 'Student course code'
                  : 'Representative course code'}
                <input
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.toUpperCase())
                  }
                  required
                  minLength={8}
                  placeholder={role === 'student' ? 'DSA2-K7Q1' : 'REP-SE2-4MK'}
                />
              </label>
            )}
            {error && <div className="auth-error">{error}</div>}
            <button className="auth-submit" type="submit" disabled={loading}>
              {loading
                ? 'Please wait…'
                : mode === 'signin'
                  ? 'Sign in securely'
                  : 'Create my account'}
              <Check size={17} />
            </button>
          </form>
          <p className="auth-switch">
            {mode === 'signin'
              ? 'New to Campus Hub?'
              : 'Already have an account?'}{' '}
            <a href={mode === 'signin' ? '/signup' : '/signin'}>
              {mode === 'signin' ? 'Create an account' : 'Sign in'}
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
