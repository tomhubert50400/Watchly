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
          <Link href="/#reel"><span>01</span> Screens</Link>
          <Link href="/#journal"><span>02</span> Journal</Link>
          <Link href="/#community"><span>03</span> Community</Link>
          <Link href="/#info"><span>04</span> Info</Link>
          <Link className="site-nav__cta" href="/support">Contact</Link>
        </nav>
        <details className="mobile-nav">
          <summary aria-label="Open navigation">
            Menu
          </summary>
          <nav aria-label="Mobile navigation">
            <Link href="/#reel" onClick={closeMobileNavigation}>Screens</Link>
            <Link href="/#journal" onClick={closeMobileNavigation}>Journal</Link>
            <Link href="/#community" onClick={closeMobileNavigation}>Community</Link>
            <Link href="/#info" onClick={closeMobileNavigation}>Info</Link>
            <Link href="/support" onClick={closeMobileNavigation}>Contact</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
