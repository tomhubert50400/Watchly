import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import watchlyLogo from '../../../../mobile/assets/watchly-logo-ui.png';

export const metadata: Metadata = {
  description: 'A home for the films you discover, watch, rate, remember, and share.',
  title: 'A home for your life in films',
};

const reelChapters = [
  {
    alt: 'Watchly Explore screen with search, trending films, and upcoming releases',
    copy: 'Search the catalogue, follow what is coming, and find the film that fits tonight.',
    image: '/landing/watchly-explore.png',
    number: '01',
    overline: 'Discover',
    title: 'Start with a feeling.',
  },
  {
    alt: 'Watchly Home screen featuring a film and trending titles',
    copy: 'Return to what you started and keep every film and episode in the right place.',
    image: '/landing/watchly-home.png',
    number: '02',
    overline: 'Watch',
    title: 'Never lose the thread.',
  },
  {
    alt: 'Watchly film detail screen with watchlist and viewing status controls',
    copy: 'Save the title, log the watch, rate it, and keep the thoughts that came after.',
    image: '/landing/watchly-detail.jpg',
    number: '03',
    overline: 'Remember',
    title: 'Give every film a place.',
  },
] as const;

const questions = [
  {
    answer: 'Films and series, including viewing status, episode progress, ratings, reviews, watchlists, and release dates.',
    question: 'What can I keep in Watchly?',
  },
  {
    answer: 'Yes. Watchly uses real TMDB catalogue metadata for discovery, artwork, film details, series, seasons, episodes, and release information.',
    question: 'Is the catalogue real?',
  },
  {
    answer: 'You decide how your profile and activity appear. Public taste and private viewing history do not have to be the same thing.',
    question: 'Can I control what people see?',
  },
  {
    answer: 'Watchly is in active development for iPhone. Public availability will be announced when the experience is ready.',
    question: 'When can I download it?',
  },
] as const;

export default function HomePage() {
  return (
    <>
      <section className="cine-hero" id="top">
        <div aria-hidden="true" className="cine-grain" />
        <div className="cine-shell cine-hero__meta">
          <span>Watchly presents</span>
          <span>For people who stay through the credits</span>
          <span>Picture 001</span>
        </div>

        <div className="cine-shell cine-hero__layout">
          <div className="cine-hero__copy">
            <p className="cine-label">A personal cinema companion</p>
            <h1>Your life<br /><em>in films.</em></h1>
            <p className="cine-hero__lede">
              Find what to watch. Keep the films that mattered. Build a journal of your taste, one title at a time.
            </p>
            <div className="cine-actions">
              <Link className="cine-link cine-link--primary" href="#reel">
                Enter Watchly
                <span aria-hidden="true">↓</span>
              </Link>
              <Link className="cine-link" href="#journal">See the film journal</Link>
            </div>
          </div>

          <div className="cine-hero__contact-sheet">
            <div className="cine-frame cine-frame--home">
              <Image
                alt="Watchly Home screen"
                fill
                priority
                sizes="(max-width: 760px) 38vw, 260px"
                src="/landing/watchly-home.png"
              />
            </div>
            <div className="cine-frame cine-frame--hero">
              <Image
                alt="Watchly film page with tracking and watchlist controls"
                fill
                priority
                sizes="(max-width: 760px) 58vw, 430px"
                src="/landing/watchly-detail.jpg"
              />
              <div className="cine-frame__slate">
                <span>Now screening</span>
                <strong>Watchly</strong>
                <span>Take 01</span>
              </div>
            </div>
            <div className="cine-frame cine-frame--explore">
              <Image
                alt="Watchly Explore screen"
                fill
                sizes="(max-width: 760px) 35vw, 230px"
                src="/landing/watchly-explore.png"
              />
            </div>
          </div>
        </div>

        <div className="cine-hero__marquee" aria-label="Watchly product actions">
          <span>Discover</span><i>✦</i><span>Track</span><i>✦</i><span>Rate</span><i>✦</i><span>Review</span><i>✦</i><span>Remember</span>
        </div>
      </section>

      <section className="cine-statement">
        <div className="cine-shell cine-statement__layout">
          <p className="cine-index">001 / The point</p>
          <div>
            <h2>A film is more than a poster in a grid.</h2>
            <p>
              It is the night you watched it, the line you kept thinking about, the person who recommended it, and the review you wrote after the credits.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="reel-title" className="cine-reel" id="reel">
        <div className="cine-shell cine-section-heading">
          <div>
            <p className="cine-index">002 / The ritual</p>
            <h2 id="reel-title">From first look<br />to lasting memory.</h2>
          </div>
          <p>Three acts, one uninterrupted record of everything you watch.</p>
        </div>

        <div aria-label="Watchly product journey" className="cine-reel__track" role="region">
          {reelChapters.map((chapter) => (
            <article className="cine-reel-card" key={chapter.number}>
              <div className="cine-reel-card__perforation" aria-hidden="true" />
              <div className="cine-reel-card__image">
                <Image alt={chapter.alt} fill sizes="(max-width: 620px) 72vw, 360px" src={chapter.image} />
              </div>
              <div className="cine-reel-card__copy">
                <span>{chapter.number} / {chapter.overline}</span>
                <h3>{chapter.title}</h3>
                <p>{chapter.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="journal-title" className="cine-journal" id="journal">
        <div className="cine-shell">
          <div className="cine-section-heading cine-section-heading--journal">
            <div>
              <p className="cine-index">003 / Your archive</p>
              <h2 id="journal-title">Build a life<br />in film.</h2>
            </div>
            <p>Watchly keeps the catalogue useful by making it personal.</p>
          </div>

          <div className="cine-archive-grid">
            <article className="cine-archive-panel cine-archive-panel--journal">
              <div className="cine-archive-panel__topline">
                <span>Viewing journal</span>
                <span>Chronological / personal</span>
              </div>
              <div className="cine-diary-entry">
                <time dateTime="2026-08-24"><strong>24</strong><span>Aug</span></time>
                <div><span>Watched</span><h3>The film, the date, the feeling.</h3></div>
              </div>
              <div className="cine-diary-entry cine-diary-entry--muted">
                <time dateTime="2026-08-19"><strong>19</strong><span>Aug</span></time>
                <div><span>Reviewed</span><h3>Your history becomes your story.</h3></div>
              </div>
            </article>

            <article className="cine-archive-panel cine-archive-panel--lists">
              <span className="cine-panel-number">A</span>
              <p className="cine-label">Lists with a point of view</p>
              <h3>Not everything belongs in “watch later.”</h3>
              <p>Build shelves for moods, directors, eras, friends, and the films you will defend forever.</p>
            </article>

            <article className="cine-archive-panel cine-archive-panel--calendar">
              <span className="cine-panel-number">B</span>
              <p className="cine-label">Release calendar</p>
              <h3>Know when the next story begins.</h3>
              <p>Keep films, seasons, and episodes on one personal timeline.</p>
            </article>

            <article className="cine-archive-panel cine-archive-panel--opinion">
              <div><span>½</span><span>★</span><span>5</span></div>
              <p className="cine-label">Half stars. Full thoughts.</p>
              <h3>A score marks the moment. A review explains why it stayed.</h3>
            </article>
          </div>
        </div>
      </section>

      <section className="cine-community" id="community">
        <div className="cine-shell cine-community__layout">
          <p className="cine-index">004 / After the credits</p>
          <blockquote>
            <p>“Taste gets better when it becomes a conversation.”</p>
          </blockquote>
          <div className="cine-community__copy">
            <h2>Follow people,<br />not an algorithm.</h2>
            <p>
              Find members whose taste challenges yours. Share ratings and reviews. Keep your viewing history under your control.
            </p>
            <Link className="cine-text-link" href="/support">Talk to Watchly <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="questions-title" className="cine-questions" id="info">
        <div className="cine-shell">
          <div className="cine-section-heading cine-section-heading--questions">
            <div>
              <p className="cine-index">005 / Before opening night</p>
              <h2 id="questions-title">The essentials.</h2>
            </div>
          </div>
          <div className="cine-questions__grid">
            {questions.map((item, index) => (
              <article key={item.question}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="cine-closing">
        <div aria-hidden="true" className="cine-grain" />
        <div className="cine-shell cine-closing__layout">
          <div>
            <Image alt="Watchly" className="cine-closing__mark" src={watchlyLogo} />
            <p className="cine-index">Coming to iPhone</p>
          </div>
          <h2>Make every<br /><em>watch count.</em></h2>
          <div className="cine-closing__action">
            <p>Watchly is being made for people who never say “it was just a movie.”</p>
            <Link className="cine-link cine-link--primary" href="/support">Contact Watchly <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>
    </>
  );
}
