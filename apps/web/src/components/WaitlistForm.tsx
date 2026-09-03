'use client';

import { FormEvent, useId, useState } from 'react';
import styles from './WaitlistForm.module.css';

type SubmissionState = 'error' | 'idle' | 'submitting' | 'success';

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '');
const apiUrl = configuredApiUrl
  || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null);
const environment = process.env.NEXT_PUBLIC_WATCHLY_ENVIRONMENT
  || (process.env.NODE_ENV === 'development' ? 'development' : null);

export function WaitlistForm() {
  const emailId = useId();
  const honeypotId = useId();
  const [state, setState] = useState<SubmissionState>('idle');
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!apiUrl || !environment) {
      setState('error');
      setMessage('The waitlist is unavailable right now.');
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get('email') ?? '').trim();
    const website = String(data.get('website') ?? '');

    setState('submitting');
    setMessage('');

    try {
      const response = await fetch(`${apiUrl}/waitlist`, {
        body: JSON.stringify({ email, website }),
        headers: {
          'content-type': 'application/json',
          'x-watchly-environment': environment,
        },
        method: 'POST',
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Too many attempts. Try again in a minute.');
        }

        throw new Error('We could not add you right now. Try again shortly.');
      }

      form.reset();
      setState('success');
      setMessage("You're on the list.");
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'We could not add you right now.');
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <label className={styles.label} htmlFor={emailId}>Email address</label>
      <input
        autoComplete="email"
        className={styles.input}
        id={emailId}
        maxLength={320}
        name="email"
        placeholder="Email address"
        required
        type="email"
      />
      <button className={styles.submit} disabled={state === 'submitting'} type="submit">
        {state === 'submitting' ? 'Joining...' : 'Join the waitlist'}
      </button>
      <div aria-hidden="true" className={styles.honeypot}>
        <label htmlFor={honeypotId}>Website</label>
        <input autoComplete="off" id={honeypotId} name="website" tabIndex={-1} type="text" />
      </div>
      {message ? <p aria-live="polite" className={styles.status} data-state={state} role="status">{message}</p> : null}
    </form>
  );
}
