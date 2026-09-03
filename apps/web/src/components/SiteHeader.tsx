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
          <Link href="/#features">How it works</Link>
          <Link href="/#journal">Journal</Link>
          <Link href="/#community">Community</Link>
          <Link className="site-nav__cta" href="/#download">Get Watchly</Link>
        </nav>
        <details className="mobile-nav">
          <summary aria-label="Open navigation">
            Menu
          </summary>
          <nav aria-label="Mobile navigation">
            <Link href="/#features" onClick={closeMobileNavigation}>How it works</Link>
            <Link href="/#journal" onClick={closeMobileNavigation}>Journal</Link>
            <Link href="/#community" onClick={closeMobileNavigation}>Community</Link>
            <Link href="/#download" onClick={closeMobileNavigation}>Get Watchly</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
