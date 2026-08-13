import { Menu } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import watchlyWordmark from '../../../mobile/assets/watchly-wordmark-ui.png';

export function SiteHeader() {
  return (
    <header className="site-header">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="site-header__inner">
        <Link aria-label="Watchly home" className="brand" href="/">
          <Image alt="Watchly" className="brand__wordmark" priority src={watchlyWordmark} />
        </Link>
        <nav aria-label="Primary navigation" className="site-nav">
          <Link href="/#features">Features</Link>
          <Link href="/#community">Community</Link>
          <Link href="/#your-watchly">Your Watchly</Link>
        </nav>
        <details className="mobile-nav">
          <summary aria-label="Open navigation">
            <Menu aria-hidden="true" size={22} />
          </summary>
          <nav aria-label="Mobile navigation">
            <Link href="/#features">Features</Link>
            <Link href="/#community">Community</Link>
            <Link href="/#your-watchly">Your Watchly</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
