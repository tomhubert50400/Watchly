'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { MouseEvent } from 'react';
import watchlyWordmark from '../../../mobile/assets/watchly-wordmark-ui.png';

function closeMobileNavigation(event: MouseEvent<HTMLAnchorElement>) {
  event.currentTarget.closest('details')?.removeAttribute('open');
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="site-header__inner">
        <Link aria-label="Watchly home" className="brand" href="/">
          <Image alt="Watchly" className="brand__wordmark" priority src={watchlyWordmark} />
        </Link>
        <nav aria-label="Primary navigation" className="site-nav">
          <Link href="/#journal">Your journal</Link>
          <Link href="/#series">Your series</Link>
          <Link href="/#lists">Your lists</Link>
        </nav>
        <a
          aria-label="Follow @WatchlyTV on X"
          className="site-social-link"
          href="https://x.com/WatchlyTV"
          rel="noreferrer"
          target="_blank"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M18.24 2.25h3.31l-7.23 8.26 8.51 11.24h-6.66l-5.22-6.82-5.96 6.82H1.68l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.11l11.97 15.64Z" />
          </svg>
          <span><span className="site-social-link__verb">Follow </span>@WatchlyTV</span>
        </a>
        <details className="mobile-nav">
          <summary aria-label="Open navigation">
            Menu
          </summary>
          <nav aria-label="Mobile navigation">
            <Link href="/#journal" onClick={closeMobileNavigation}>Your journal</Link>
            <Link href="/#series" onClick={closeMobileNavigation}>Your series</Link>
            <Link href="/#lists" onClick={closeMobileNavigation}>Your lists</Link>
            <Link href="/#join" onClick={closeMobileNavigation}>Get Watchly</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
