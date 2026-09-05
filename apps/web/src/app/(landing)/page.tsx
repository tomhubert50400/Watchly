import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import wordmark from '../../../../mobile/assets/watchly-wordmark-ui.png';
import { WaitlistForm } from '../../components/WaitlistForm';
import { CinemaExperience } from './CinemaExperience';
import styles from './page.module.css';

export const metadata: Metadata = { title: { absolute: 'Watchly | Your films, series and watching history' } };

export default function CinemaPreview() {
  return (
    <div className={styles.root}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className={styles.header}>
        <Link href="/" aria-label="Watchly home"><Image src={wordmark} alt="Watchly" className={styles.logo} priority /></Link>
        <nav aria-label="Primary navigation"><a href="#journal">Your journal</a><a href="#series">Your series</a><a href="#lists">Your lists</a></nav>
        <a href="#join" className={styles.headerCta}>Get early access <span aria-hidden="true">↗</span></a>
      </header>
      <main id="main-content">
        <CinemaExperience />
        <section className={styles.join} id="join" aria-labelledby="join-title">
          <div className={styles.joinInner}>
            <div><p className={styles.eyebrow}>Coming soon to iOS &amp; Android</p><h2 id="join-title">Your next<br />chapter.</h2></div>
            <div className={styles.joinCopy}><p>There’s always another film.<br />Another season. Another favourite.</p><p>Be the first to make it yours with Watchly.</p><WaitlistForm /><span className={styles.joinNote}>An email when we’re ready. That’s it.</span></div>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerTop}><Image src={wordmark} alt="Watchly" className={styles.footerLogo} /><a href="https://x.com/WatchlyTV" target="_blank" rel="noreferrer">Follow the story <span aria-hidden="true">↗</span></a></div>
        <div className={styles.footerBottom}><span>© 2026 Watchly</span><nav aria-label="Legal and support"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/support">Support</Link><Link href="/community-guidelines">Community</Link><Link href="/account-deletion">Delete account</Link></nav></div>
        <p className={styles.attribution}>Artwork and metadata from <a href="https://www.themoviedb.org/">TMDB</a>. This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      </footer>
    </div>
  );
}
