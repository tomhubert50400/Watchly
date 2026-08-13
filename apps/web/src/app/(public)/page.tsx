import type { Metadata } from 'next';
import {
  ArrowDown,
  CalendarDays,
  Compass,
  ListVideo,
  MessageCircle,
  Play,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import watchlyLogo from '../../../../mobile/assets/watchly-logo-ui.png';

export const metadata: Metadata = {
  description: 'Discover films and series, track every watch, build watchlists, and share reviews with Watchly.',
};

export default function HomePage() {
  return (
    <>
      <section className="home-hero">
        <div className="home-hero__copy">
          <p className="eyebrow">Your films. Your series. Your people.</p>
          <h1>Everything you watch,<br /><em>in one place.</em></h1>
          <p>
            Watchly brings discovery, progress, watchlists, ratings, reviews, and community together around the stories you love.
          </p>
          <div className="home-hero__actions">
            <Link className="primary-link" href="#features">
              See what Watchly does
              <ArrowDown aria-hidden="true" size={18} />
            </Link>
            <Link className="text-link" href="#community">Explore the community</Link>
          </div>
        </div>

        <div className="home-hero__art">
          <Image alt="Watchly" className="home-hero__brand-mark" priority src={watchlyLogo} />
          <p>Built for what you watch.</p>
          <ul aria-label="Watchly product areas" className="home-hero__product-list">
            <li>Discover</li>
            <li>Track</li>
            <li>Collect</li>
            <li>Connect</li>
          </ul>
        </div>
      </section>

      <section aria-labelledby="features-title" className="product-section" id="features">
        <div className="product-section__intro">
          <p className="eyebrow">One app for the whole story</p>
          <h2 id="features-title">From discovery to the final episode.</h2>
          <p>Watchly remembers what matters, without turning your viewing life into a spreadsheet.</p>
        </div>

        <div className="feature-grid">
          <article className="feature-card">
            <div className="feature-card__heading">
              <span className="feature-card__icon"><Compass aria-hidden="true" size={21} /></span>
              <span className="feature-card__number">01</span>
            </div>
            <div className="feature-card__copy">
              <h3>Discover films and series</h3>
              <p>Explore trending titles, upcoming releases, genres, films, and series through a catalogue powered by TMDB.</p>
            </div>
          </article>

          <article className="feature-card">
            <div className="feature-card__heading">
              <span className="feature-card__icon"><Play aria-hidden="true" size={21} /></span>
              <span className="feature-card__number">02</span>
            </div>
            <div className="feature-card__copy">
              <h3>Track every watch</h3>
              <p>Keep movie status, episode progress, ratings, and release alerts in sync with what you are watching.</p>
            </div>
          </article>

          <article className="feature-card" id="your-watchly">
            <div className="feature-card__heading">
              <span className="feature-card__icon"><ListVideo aria-hidden="true" size={21} /></span>
              <span className="feature-card__number">03</span>
            </div>
            <div className="feature-card__copy">
              <h3>Build watchlists together</h3>
              <p>Create personal lists, share a selection, and vote together when nobody knows what to watch next.</p>
            </div>
          </article>

          <article className="feature-card" id="community">
            <div className="feature-card__heading">
              <span className="feature-card__icon"><MessageCircle aria-hidden="true" size={21} /></span>
              <span className="feature-card__number">04</span>
            </div>
            <div className="feature-card__copy">
              <h3>Rate, review, and connect</h3>
              <p>Share movie and episode reviews, react to other members, and find profiles through the community.</p>
            </div>
          </article>

          <article className="feature-card">
            <div className="feature-card__heading">
              <span className="feature-card__icon"><CalendarDays aria-hidden="true" size={21} /></span>
              <span className="feature-card__number">05</span>
            </div>
            <div className="feature-card__copy">
              <h3>Remember every story</h3>
              <p>Your journal organises watches, ratings, and reviews by date, while your profile turns them into meaningful viewing stats.</p>
            </div>
          </article>
        </div>
      </section>

      <section aria-labelledby="closing-title" className="product-closing">
        <div className="product-closing__mark">
          <Image alt="" src={watchlyLogo} />
        </div>
        <div>
          <p className="eyebrow">Your Watchly</p>
          <h2 id="closing-title">Your taste, progress, and conversations stay connected.</h2>
        </div>
        <p>Open Watchly and continue exactly where your last story left you.</p>
      </section>
    </>
  );
}
