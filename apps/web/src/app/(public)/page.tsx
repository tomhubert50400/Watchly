import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import watchlyLogo from '../../../../mobile/assets/watchly-logo-ui.png';

export const metadata: Metadata = {
  description: 'Track films and series, log every watch, rate in half-stars, write reviews, and keep your whole viewing history in one place.',
  title: 'Track films, series, ratings and reviews',
};

const productJourneys = [
  {
    alt: 'Watchly Explore showing search, trending films and upcoming releases',
    copy: 'Search films, series and people. Browse what is trending, see what is coming, then save the title before you forget it.',
    image: '/landing/watchly-explore.png',
    label: 'Find your next watch',
    title: 'Start with the whole catalogue.',
  },
  {
    alt: 'Watchly film page with watch status, watchlist and rating controls',
    copy: 'Mark what you are watching, watched or dropped. Add a half-star rating, write the review, and keep it attached to the title.',
    image: '/landing/watchly-detail.jpg',
    label: 'Log it properly',
    title: 'A checkmark is not a film journal.',
  },
  {
    alt: 'Watchly Home showing a featured film and current viewing activity',
    copy: 'Keep film history and episode progress together. Watchly brings you back to the title or episode that actually comes next.',
    image: '/landing/watchly-home.png',
    label: 'Never lose your place',
    title: 'Films and series belong in the same history.',
  },
] as const;

const productFacts = [
  {
    detail: 'Films, series, seasons and episodes, with real metadata and artwork.',
    label: 'Catalogue',
  },
  {
    detail: 'Watching, watched and dropped states, plus episode-by-episode progress.',
    label: 'Tracking',
  },
  {
    detail: 'Half-star ratings, written reviews and a chronological viewing journal.',
    label: 'Your take',
  },
  {
    detail: 'Personal and shared watchlists, voting, release alerts and a calendar.',
    label: 'What is next',
  },
  {
    detail: 'Public or private profiles, follows, blocks and control over shared activity.',
    label: 'Community',
  },
] as const;

const appStoreUrl = getStoreUrl(process.env.NEXT_PUBLIC_APP_STORE_URL);
const googlePlayUrl = getStoreUrl(process.env.NEXT_PUBLIC_GOOGLE_PLAY_URL);

export default function HomePage() {
  return (
    <>
      <section className="cine-hero" id="top">
        <div aria-hidden="true" className="cine-grain" />
        <div className="cine-shell cine-hero__meta">
          <span>A film and series journal</span>
          <span>For iPhone and Android</span>
          <span>Made for people who keep watching after the credits</span>
        </div>

        <div className="cine-shell cine-hero__layout">
          <div className="cine-hero__copy">
            <p className="cine-label">Watchly keeps the whole watch</p>
            <h1>Keep a real record of what you watch.</h1>
            <p className="cine-hero__lede">
              Find films and series, log every watch, rate in half-stars, write reviews, follow friends, and pick up the next episode without digging through five apps.
            </p>
            <div className="cine-actions">
              <StoreButton href={appStoreUrl} platform="App Store" />
              <StoreButton href={googlePlayUrl} platform="Google Play" />
              <Link className="cine-link" href="#product">See what Watchly keeps <span aria-hidden="true">↓</span></Link>
            </div>
          </div>

          <div className="cine-hero__contact-sheet">
            <div className="cine-frame cine-frame--home">
              <Image alt="Watchly Home screen" fill priority sizes="(max-width: 760px) 35vw, 250px" src="/landing/watchly-home.png" />
            </div>
            <div className="cine-frame cine-frame--hero">
              <Image alt="Watchly film page with tracking, watchlist, synopsis and activity" fill loading="eager" priority sizes="(max-width: 760px) 58vw, 420px" src="/landing/watchly-detail.jpg" />
              <p className="cine-frame__slate">Everything about the film stays with the film.</p>
            </div>
            <div className="cine-frame cine-frame--explore">
              <Image alt="Watchly Explore screen" fill sizes="(max-width: 760px) 34vw, 230px" src="/landing/watchly-explore.png" />
            </div>
          </div>
        </div>

        <div className="cine-hero__marquee" aria-label="Watchly features">
          <span>Watched dates</span><i>•</i><span>Half-star ratings</span><i>•</i><span>Reviews</span><i>•</i><span>Episode progress</span><i>•</i><span>Shared lists</span><i>•</i><span>Release calendar</span>
        </div>
      </section>

      <section className="cine-statement" id="product">
        <div className="cine-shell cine-statement__layout">
          <p className="cine-index">What Watchly is</p>
          <div>
            <h2>Watchly is a film and series journal, not a streaming service.</h2>
            <p>It keeps the title, your progress, rating, review, lists and release dates together, without deciding what subscription you should open next.</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="reel-title" className="cine-reel" id="features">
        <div className="cine-shell cine-section-heading">
          <div>
            <p className="cine-index">How it works</p>
            <h2 id="reel-title">From finding it to remembering why it mattered.</h2>
          </div>
          <p>No streaks to maintain. No points to collect. Just the useful parts of being serious about what you watch.</p>
        </div>

        <div aria-label="Watchly product tour" className="cine-reel__track">
          {productJourneys.map((journey) => (
            <article className="cine-reel-card" key={journey.label}>
              <div className="cine-reel-card__perforation" aria-hidden="true" />
              <div className="cine-reel-card__image">
                <Image alt={journey.alt} fill sizes="(max-width: 720px) 80vw, 390px" src={journey.image} />
              </div>
              <div className="cine-reel-card__copy">
                <span>{journey.label}</span>
                <h3>{journey.title}</h3>
                <p>{journey.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="journal-title" className="cine-journal" id="journal">
        <div className="cine-shell">
          <div className="cine-section-heading cine-section-heading--journal">
            <div>
              <p className="cine-index">Your journal</p>
              <h2 id="journal-title">A history that still feels like yours.</h2>
            </div>
            <p>Keep the facts when you want them. Keep the feeling when you have something to say.</p>
          </div>

          <div className="cine-archive-grid">
            <article className="cine-archive-panel cine-archive-panel--journal">
              <div className="cine-archive-panel__topline"><span>One viewing history</span><span>Films + series</span></div>
              <div className="cine-diary-entry"><span>01</span><div><span>Log the watch</span><h3>Status, date, rating and review stay together.</h3></div></div>
              <div className="cine-diary-entry cine-diary-entry--muted"><span>02</span><div><span>Return to it</span><h3>Open your journal instead of rebuilding your memory.</h3></div></div>
            </article>

            <article className="cine-archive-panel cine-archive-panel--lists">
              <span className="cine-panel-number">+</span>
              <p className="cine-label">Lists with other people</p>
              <h3>Plan movie night without another group chat poll.</h3>
              <p>Create shared watchlists, add titles together and vote on what gets played.</p>
            </article>

            <article className="cine-archive-panel cine-archive-panel--calendar">
              <span className="cine-panel-number">↗</span>
              <p className="cine-label">Release calendar</p>
              <h3>Know when the film, season or next episode actually lands.</h3>
              <p>Follow only the releases connected to titles you care about.</p>
            </article>

            <article className="cine-archive-panel cine-archive-panel--opinion">
              <div><span>½</span><span>★</span><span>5</span></div>
              <p className="cine-label">Your rating, your words</p>
              <h3>Sometimes three stars says enough. Sometimes it needs a paragraph.</h3>
            </article>
          </div>
        </div>
      </section>

      <section className="cine-community" id="community">
        <div className="cine-shell cine-community__layout">
          <p className="cine-index">Community without performance</p>
          <div className="cine-community__statement"><p>Follow people whose taste means something to you.</p></div>
          <div className="cine-community__copy">
            <h2>See the review. Skip the follower-count theatre.</h2>
            <p>Watchly connects profiles, ratings and reviews around the films themselves. You decide what stays private, what friends can see, and who gets access to your activity.</p>
            <Link className="cine-text-link" href="#download">Get Watchly <span aria-hidden="true">↓</span></Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="questions-title" className="cine-questions" id="info">
        <div className="cine-shell">
          <div className="cine-section-heading cine-section-heading--questions">
            <div>
              <p className="cine-index">Inside Watchly</p>
              <h2 id="questions-title">The useful details, without the pitch.</h2>
            </div>
          </div>
          <div className="cine-questions__grid">
            {productFacts.map((fact) => (
              <article key={fact.label}><span aria-hidden="true">•</span><h3>{fact.label}</h3><p>{fact.detail}</p></article>
            ))}
          </div>
        </div>
      </section>

      <section className="cine-closing" id="download">
        <div aria-hidden="true" className="cine-grain" />
        <div className="cine-shell cine-closing__layout">
          <div>
            <Image alt="Watchly" className="cine-closing__mark" src={watchlyLogo} />
            <p className="cine-index">For iPhone and Android</p>
          </div>
          <h2>Keep the film after the credits.</h2>
          <div className="cine-closing__action">
            <p>Download Watchly when the official Store pages go live.</p>
            <div className="store-actions"><StoreButton href={appStoreUrl} platform="App Store" /><StoreButton href={googlePlayUrl} platform="Google Play" /></div>
          </div>
        </div>
      </section>
    </>
  );
}

function StoreButton({ href, platform }: Readonly<{ href: string | null; platform: 'App Store' | 'Google Play' }>) {
  const content = (
    <>
      <span className="store-button__icon" aria-hidden="true">{platform === 'App Store' ? 'iOS' : 'GP'}</span>
      <span><small>{href ? 'Download on the' : 'Coming soon on'}</small><strong>{platform}</strong></span>
    </>
  );

  if (!href) return <span aria-disabled="true" className="store-button store-button--disabled">{content}</span>;

  return <a className="store-button" href={href} rel="noreferrer" target="_blank">{content}</a>;
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
