import type { Metadata } from 'next';
import {
  ArrowDown,
  CalendarDays,
  Compass,
  ListVideo,
  MessageCircle,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import watchlyLogo from '../../../../mobile/assets/watchly-logo-ui.png';

export const metadata: Metadata = {
  description: 'Discover films and series, track every watch, build watchlists, and share reviews with Watchly.',
  title: 'Your films, series, and people',
};

const tourCards = [
  {
    alt: 'Watchly home screen with a featured film and trending titles',
    copy: 'See what deserves your attention, then jump straight back into the stories you care about.',
    image: '/landing/watchly-home.png',
    label: 'At a glance.',
  },
  {
    alt: 'Watchly Explore screen with search, trending films, and upcoming releases',
    copy: 'Search films, series, and people, or browse a catalogue shaped around what is happening now.',
    image: '/landing/watchly-explore.png',
    label: 'Find the next one.',
  },
  {
    alt: 'Watchly film detail screen with watchlist and viewing status controls',
    copy: 'Save a title, track its status, rate it, and keep the whole story together on one rich page.',
    image: '/landing/watchly-detail.jpg',
    label: 'Make it yours.',
  },
] as const;

const faqs = [
  {
    answer: 'Films and series, including viewing status, episode progress, ratings, reviews, watchlists, and release dates.',
    question: 'What can I track with Watchly?',
  },
  {
    answer: 'Yes. Watchly is built around real catalogue metadata supplied by TMDB, with discovery, details, artwork, and release information connected throughout the app.',
    question: 'Does Watchly use a real catalogue?',
  },
  {
    answer: 'You can publish ratings and reviews, follow other members, and join conversations while keeping control of how your profile and activity are presented.',
    question: 'Is Watchly social?',
  },
  {
    answer: 'Watchly is in active development. Public store availability will be announced when the app is ready.',
    question: 'Where can I download Watchly?',
  },
] as const;

export default function HomePage() {
  return (
    <>
      <section className="landing-hero" id="top">
        <div className="landing-container landing-hero__inner">
          <div className="landing-hero__copy">
            <Image alt="Watchly" className="landing-hero__mark" priority src={watchlyLogo} />
            <p className="landing-kicker">Your watch life, beautifully connected</p>
            <h1>Find it.<br />Watch it.<br /><span>Remember it.</span></h1>
            <p className="landing-hero__lede">
              Discover films and series, track every watch, build lists, rate what you love, and share the conversation.
            </p>
            <div className="landing-actions">
              <Link className="landing-button landing-button--primary" href="#product">
                See Watchly in action
                <ArrowDown aria-hidden="true" size={17} />
              </Link>
              <Link className="landing-button landing-button--quiet" href="#community">Why Watchly</Link>
            </div>
            <div aria-label="Watchly product status" className="landing-status">
              <span aria-hidden="true" />
              In active development for iPhone
            </div>
          </div>

          <div className="landing-hero__visual">
            <div className="landing-hero__glow" />
            <Image
              alt="Three iPhones showing the Watchly Explore, Home, and film detail screens"
              className="landing-hero__showcase"
              fill
              priority
              sizes="(max-width: 760px) 100vw, 58vw"
              src="/landing/watchly-app-showcase.png"
            />
          </div>
        </div>
      </section>

      <section className="landing-manifesto">
        <div className="landing-container landing-manifesto__inner">
          <p className="landing-kicker">One app for the whole story</p>
          <h2>Everything you watch, everything you think, and everyone you discover it with.</h2>
          <div className="landing-manifesto__facts">
            <span>Films + series</span>
            <span>Real TMDB catalogue</span>
            <span>Progress + journal</span>
            <span>Reviews + community</span>
          </div>
        </div>
      </section>

      <section className="landing-feature" id="features">
        <div className="landing-container landing-feature__inner">
          <div className="landing-phone-stage">
            <div className="landing-phone-stage__halo" />
            <Image
              alt="Watchly Home screen featuring a film and trending titles"
              className="landing-phone-stage__image"
              height={2622}
              sizes="(max-width: 760px) 78vw, 410px"
              src="/landing/watchly-home.png"
              width={1206}
            />
          </div>
          <div className="landing-feature__copy">
            <p className="landing-kicker">Start where your taste left off</p>
            <h2>Open Watchly.<br />Know what is worth your time.</h2>
            <p>
              Watchly turns discovery, progress, and personal taste into one calm home. No scattered notes, forgotten episodes, or watchlists lost between services.
            </p>
            <ul className="landing-feature__list">
              <li><Compass aria-hidden="true" size={19} />Discover trending and upcoming titles</li>
              <li><PlayCircle aria-hidden="true" size={19} />Track films and episode progress</li>
              <li><ListVideo aria-hidden="true" size={19} />Build personal and shared watchlists</li>
              <li><CalendarDays aria-hidden="true" size={19} />Keep a journal of what you watched</li>
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="product-title" className="landing-tour" id="product">
        <div className="landing-container landing-tour__intro">
          <p className="landing-kicker">A closer look</p>
          <h2 id="product-title">Every part of Watchly.<br />One continuous experience.</h2>
          <p>Swipe through the product, screen by screen.</p>
        </div>
        <div aria-label="Watchly product screens" className="landing-tour__track" role="region">
          {tourCards.map((card, index) => (
            <article className="landing-tour-card" key={card.label}>
              <div className="landing-tour-card__heading">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{card.label}</h3>
              </div>
              <div className="landing-tour-card__screen">
                <Image alt={card.alt} fill sizes="(max-width: 620px) 78vw, 360px" src={card.image} />
              </div>
              <p>{card.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-values" id="community">
        <div className="landing-container">
          <div className="landing-values__intro">
            <p className="landing-kicker">Built around people, not feeds</p>
            <h2>Your taste has a story.<br />Watchly gives it a place to live.</h2>
          </div>
          <div className="landing-values__grid">
            <article className="landing-value-card landing-value-card--lead">
              <div>
                <MessageCircle aria-hidden="true" size={25} />
                <p className="landing-kicker">Community</p>
              </div>
              <h3>Reviews become conversations.</h3>
              <p>Follow people whose taste you trust, publish thoughtful opinions, and react without losing the film at the centre.</p>
            </article>
            <article className="landing-value-card landing-value-card--accent">
              <Star aria-hidden="true" size={25} />
              <p className="landing-kicker">Your taste</p>
              <h3>Rate it your way.</h3>
              <p>Half-star ratings and written reviews turn a watched title into something you can return to.</p>
            </article>
            <article className="landing-value-card">
              <ShieldCheck aria-hidden="true" size={25} />
              <p className="landing-kicker">Your control</p>
              <h3>Public when you want it.</h3>
              <p>Shape your profile and decide how your activity appears to the people around you.</p>
            </article>
            <article className="landing-value-card landing-value-card--wide">
              <Sparkles aria-hidden="true" size={25} />
              <div>
                <p className="landing-kicker">More than a watchlist</p>
                <h3>From the first save to the final review, the context stays connected.</h3>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="landing-closing">
        <div className="landing-container landing-closing__inner">
          <Image alt="" className="landing-closing__mark" src={watchlyLogo} />
          <p className="landing-kicker">Coming to iPhone</p>
          <h2>Your next watch starts here.</h2>
          <p>Watchly is being built for people who want more from everything they watch.</p>
          <div className="landing-actions">
            <Link className="landing-button landing-button--primary" href="#product">Explore the product</Link>
            <Link className="landing-button landing-button--quiet" href="/support">Contact Watchly</Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="faq-title" className="landing-faq" id="faq">
        <div className="landing-container landing-faq__inner">
          <div>
            <p className="landing-kicker">FAQ</p>
            <h2 id="faq-title">Questions,<br />answered.</h2>
          </div>
          <div className="landing-faq__list">
            {faqs.map((faq) => (
              <details key={faq.question}>
                <summary>{faq.question}<span aria-hidden="true">+</span></summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
