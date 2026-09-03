import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { WaitlistForm } from '../../components/WaitlistForm';
import styles from './page.module.css';

export const metadata: Metadata = {
  description: 'Find films and series, track every episode, rate what you watch, and keep your viewing history with Watchly.',
  title: 'Your watching, remembered',
};

const features = [
  {
    accent: 'anything.',
    alt: 'Watchly Explore showing search, trending films and upcoming releases',
    copy: 'Search films, series and people. See what is trending and what is coming next.',
    id: 'find',
    image: '/landing/watchly-explore-trending.jpg',
    label: 'Find Anything',
    lead: 'Find',
  },
  {
    accent: 'progress.',
    alt: 'Watchly episode page showing watched status, rating and episode navigation',
    copy: 'Keep every season and episode exactly where you left it.',
    id: 'progress',
    image: '/landing/watchly-episode-activity.jpg',
    label: 'Track Progress',
    lead: 'Track',
  },
  {
    accent: 'honestly.',
    alt: 'Watchly rating sheet for Spider-Man with stars and a written review',
    copy: 'Rate in half-stars, write a review, or simply mark it watched.',
    id: 'rating',
    image: '/landing/watchly-review-sheet.jpg',
    label: 'Rate Honestly',
    lead: 'Rate',
  },
  {
    accent: 'history.',
    alt: 'Watchly Journal showing a chronological viewing history',
    copy: 'Your viewing history, ratings and reviews stay together.',
    id: 'journal',
    image: '/landing/watchly-journal-history.jpg',
    label: 'Keep Memories',
    lead: 'Your whole',
  },
  {
    accent: 'lists.',
    alt: 'Watchly Library showing continue watching and personal lists',
    copy: 'Keep personal picks or build a shared list with friends.',
    id: 'lists',
    image: '/landing/watchly-library-lists.jpg',
    label: 'Build Lists',
    lead: 'Build',
  },
] as const;

const appStoreUrl = getStoreUrl(process.env.NEXT_PUBLIC_APP_STORE_URL);
const googlePlayUrl = getStoreUrl(process.env.NEXT_PUBLIC_GOOGLE_PLAY_URL);

export default function HomePage() {
  return (
    <div className={`${styles.root} watchly-landing`}>
      <section className={styles.hero} id="top">
        <div aria-hidden="true" className={styles.grain} />
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <h1><span className={styles.heroLine}>Your watching,</span><span className={styles.heroAccent}>remembered.</span></h1>
            <p>Films, series, ratings, reviews and every episode in one place.</p>
            <WaitlistForm />
            <span className={styles.storeEyebrow}>Coming soon on</span>
            <div className={styles.storeActions}>
              <StoreButton href={appStoreUrl} platform="App Store" />
              <StoreButton href={googlePlayUrl} platform="Google Play" />
            </div>
          </div>

          <div className={styles.heroDevices}>
            <IPhoneFrame
              alt="Watchly home showing a weekly spotlight, continue watching and trending titles"
              className={styles.heroPhoneMain}
              image="/landing/watchly-home-spotlight.jpg"
              priority
            />
            <IPhoneFrame
              alt="Watchly Spider-Man details showing synopsis, watchlist and viewing activity"
              className={styles.heroPhoneSecondary}
              image="/landing/watchly-detail-spiderman.jpg"
            />
          </div>
        </div>

        <div className={styles.railWindow}>
          <nav aria-label="Watchly features" className={styles.featureRail}>
            {features.map((feature) => (
              <Link className={styles.featureCard} href={`#${feature.id}`} key={feature.id}>
                <div className={styles.featureArtwork}>
                  <Image alt="" fill sizes="(max-width: 640px) 78vw, 20vw" src={feature.image} />
                </div>
                <span>{feature.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </section>

      {features.map((feature, index) => (
        <section className={styles.chapter} id={feature.id} key={feature.id}>
          <div aria-hidden="true" className={styles.chapterGlow} />
          <div className={`${styles.chapterInner} ${index % 2 === 1 ? styles.chapterInnerReverse : ''}`}>
            <div className={styles.chapterCopy}>
              <h2>{feature.lead}<br /><span>{feature.accent}</span></h2>
              <p>{feature.copy}</p>
            </div>
            <div className={styles.captureStage}>
              <IPhoneFrame
                alt={feature.alt}
                className={styles.chapterPhone}
                image={feature.image}
              />
            </div>
          </div>
        </section>
      ))}

      <section className={styles.download} id="download">
        <div aria-hidden="true" className={styles.grain} />
        <div className={styles.downloadInner}>
          <h2>Your films.<br />Your series.<br /><span>Your history.</span></h2>
          <div>
            <p>Keep watching. Watchly keeps the rest.</p>
            <WaitlistForm />
            <a className={styles.socialLink} href="https://x.com/WatchlyTV" rel="noreferrer" target="_blank">
              Follow @WatchlyTV on X <span aria-hidden="true">↗</span>
            </a>
            <span className={styles.storeEyebrow}>Coming soon on</span>
            <div className={styles.storeActions}>
              <StoreButton href={appStoreUrl} platform="App Store" />
              <StoreButton href={googlePlayUrl} platform="Google Play" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function IPhoneFrame({
  alt,
  className,
  image,
  priority = false,
}: Readonly<{
  alt: string;
  className: string;
  image: string;
  priority?: boolean;
}>) {
  return (
    <div className={`${styles.phone} ${className}`}>
      <div className={styles.phoneScreen}>
        <Image
          alt={alt}
          className={styles.phoneImage}
          height={1280}
          priority={priority}
          sizes="(max-width: 620px) 78vw, 350px"
          src={image}
          width={590}
        />
      </div>
      <span aria-hidden="true" className={styles.dynamicIsland} />
      <span aria-hidden="true" className={styles.phoneButtons} />
    </div>
  );
}

function StoreButton({ href, platform }: Readonly<{ href: string | null; platform: 'App Store' | 'Google Play' }>) {
  const content = (
    <>
      <StoreIcon platform={platform} />
      <strong>{platform}</strong>
    </>
  );

  if (!href) {
    return (
      <span aria-disabled="true" aria-label={`${platform}, coming soon`} className={`${styles.storeButton} ${styles.storeButtonDisabled}`}>
        {content}
      </span>
    );
  }

  return <a className={styles.storeButton} href={href} rel="noreferrer" target="_blank">{content}</a>;
}

function StoreIcon({ platform }: Readonly<{ platform: 'App Store' | 'Google Play' }>) {
  if (platform === 'App Store') {
    return (
      <svg aria-hidden="true" className={styles.storeIcon} viewBox="0 0 24 24">
        <path d="M17.1 12.5c0-2.7 2.2-4 2.3-4.1-1.3-1.9-3.3-2.1-4-2.1-1.7-.2-3.3 1-4.1 1-.8 0-2.1-1-3.5-1-1.8 0-3.5 1.1-4.5 2.7-1.9 3.3-.5 8.2 1.4 10.9.9 1.3 2 2.8 3.5 2.7 1.4-.1 1.9-.9 3.6-.9s2.2.9 3.7.9 2.5-1.3 3.4-2.6c1.1-1.5 1.5-3 1.5-3.1-.1 0-3.3-1.3-3.3-4.4ZM14.3 4.5c.8-1 1.3-2.3 1.2-3.5-1.2.1-2.6.8-3.4 1.8-.7.8-1.4 2.2-1.2 3.4 1.3.1 2.6-.7 3.4-1.7Z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className={styles.storeIcon} viewBox="0 0 24 24">
      <path d="M3.6 2.6 14.8 12 3.6 21.4c-.4-.4-.6-1-.6-1.7V4.3c0-.7.2-1.3.6-1.7Z" fill="#54c1ff" />
      <path d="m14.8 12 3.1-2.6 3.4 1.9c.9.5.9 1 0 1.5l-3.4 1.9-3.1-2.7Z" fill="#ffd54a" />
      <path d="M3.6 2.6c.5-.5 1.2-.5 1.9-.1l12.4 6.9-3.1 2.6L3.6 2.6Z" fill="#56d887" />
      <path d="m3.6 21.4 11.2-9.4 3.1 2.6-12.4 6.9c-.7.4-1.4.4-1.9-.1Z" fill="#ff6476" />
    </svg>
  );
}

function getStoreUrl(value: string | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}
