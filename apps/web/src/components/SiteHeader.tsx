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
          <Link href="/#find">Find Anything</Link>
          <Link href="/#progress">Track Progress</Link>
          <Link href="/#rating">Rate Honestly</Link>
          <Link href="/#journal">Keep Memories</Link>
          <Link href="/#lists">Build Lists</Link>
        </nav>
        <details className="mobile-nav">
          <summary aria-label="Open navigation">
            Menu
          </summary>
          <nav aria-label="Mobile navigation">
            <Link href="/#find" onClick={closeMobileNavigation}>Find Anything</Link>
            <Link href="/#progress" onClick={closeMobileNavigation}>Track Progress</Link>
            <Link href="/#rating" onClick={closeMobileNavigation}>Rate Honestly</Link>
            <Link href="/#journal" onClick={closeMobileNavigation}>Keep Memories</Link>
            <Link href="/#lists" onClick={closeMobileNavigation}>Build Lists</Link>
            <Link href="/#download" onClick={closeMobileNavigation}>Get Watchly</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
