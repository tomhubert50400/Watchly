import Image from 'next/image';
import Link from 'next/link';
import watchlyWordmark from '../../../mobile/assets/watchly-wordmark-ui.png';

const footerLinks = [
  ['Privacy policy', '/privacy'],
  ['Terms of use', '/terms'],
  ['Community guidelines', '/community-guidelines'],
  ['Support', '/support'],
  ['Delete account', '/account-deletion'],
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div>
          <Image alt="Watchly" className="site-footer__brand" src={watchlyWordmark} />
          <p>Your films, series, and conversations, kept on your terms.</p>
        </div>
        <nav aria-label="Legal and support links">
          {footerLinks.map(([label, href]) => (
            <Link href={href} key={href}>{label}</Link>
          ))}
        </nav>
      </div>
      <div className="site-footer__fineprint">
        <span>© {new Date().getFullYear()} Watchly</span>
        <span>This product uses the TMDB API but is not endorsed or certified by TMDB.</span>
      </div>
    </footer>
  );
}
