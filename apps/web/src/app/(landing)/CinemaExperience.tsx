'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import sources from '../../../public/landing/cinema/sources.json';
import episodes from '../../../public/landing/cinema/episodes.json';
import styles from './page.module.css';

const films = sources.map((film) => ({ ...film, year: film.year.slice(0, 4) }));
const featured = [films[0], films[2], films[1]];
const initialEntries = [{ id: 244786, rating: 4.5 }, { id: 329865, rating: 4 }, { id: 120467, rating: 5 }];
const lists = [
  { title: 'Wish I could watch these for the first time.', description: 'Some endings deserve a second beginning.', ids: [157336, 496243, 329865, 244786, 129] },
  { title: 'A Sunday with absolutely no plans.', description: 'Phone away. Curtains closed. These on.', ids: [313369, 120467, 129, 693134, 157336] },
];

function Stars({ value }: Readonly<{ value: number }>) {
  return <span className={styles.staticStars} aria-label={`${value} out of 5 stars`}>{[1, 2, 3, 4, 5].map((star) => <span key={star} className={styles.starSlot}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m12 2 3 6.3 7 .9-5.1 4.9 1.3 7-6.2-3.4-6.2 3.4 1.3-7L2 9.2l7-.9Z" /></svg><svg aria-hidden="true" className={styles.starFill} style={{ clipPath: `inset(0 ${Math.max(0, Math.min(100, (star - value) * 100))}% 0 0)` }} viewBox="0 0 24 24"><path d="m12 2 3 6.3 7 .9-5.1 4.9 1.3 7-6.2-3.4-6.2 3.4 1.3-7L2 9.2l7-.9Z" /></svg></span>)}</span>;
}

export function CinemaExperience() {
  const [selected, setSelected] = useState(0);
  const [entries, setEntries] = useState(initialEntries);
  const [lastRated, setLastRated] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [watchedEpisodes, setWatchedEpisodes] = useState(1);
  const [activeList, setActiveList] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const film = featured[selected];
  const rating = entries.find((entry) => entry.id === film.id)?.rating ?? 0;
  const list = lists[activeList];

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const elements = container.current?.querySelectorAll<HTMLElement>('[data-reveal]');
    const observer = new IntersectionObserver((changes) => {
      changes.forEach((change) => { if (change.isIntersecting) { (change.target as HTMLElement).dataset.reveal = 'visible'; observer.unobserve(change.target); } });
    }, { threshold: 0.12 });
    elements?.forEach((element) => { if (element.getBoundingClientRect().top > window.innerHeight) { element.dataset.reveal = 'waiting'; observer.observe(element); } });
    return () => observer.disconnect();
  }, []);

  function rate(value: number) {
    setEntries((current) => [{ id: film.id, rating: value }, ...current.filter((entry) => entry.id !== film.id)]);
    setLastRated(film.id);
  }

  return (
    <div ref={container}>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroIntro}>
          <h1 id="hero-title"><span>Watch it.</span><span>Make it yours.</span></h1>
          <div className={styles.heroCopy}><p>The films you love.<br />The series you can’t put down.<br />A home for all of it.</p><a className={styles.primaryCta} href="#join">Get Watchly <span aria-hidden="true">↗</span></a><span className={styles.availability}>Coming to iOS &amp; Android</span></div>
        </div>
        <div className={styles.cinemaGallery} aria-label="Choose a film to try Watchly">
          {featured.map((item, index) => (
            <button key={item.id} type="button" className={styles.scene} data-active={selected === index} onClick={() => { setSelected(index); setHoverRating(null); }} aria-pressed={selected === index} aria-label={`Select ${item.title}`}>
              <Image src={`/landing/cinema/${item.id}-backdrop.jpg`} alt="" fill priority sizes="(max-width: 767px) 65vw, 50vw" />
              <span className={styles.sceneShade} /><span className={styles.sceneTop}>{item.year}<span aria-hidden="true">↗</span></span>
              <span className={styles.sceneTitle}>{item.id === 693134 ? <><strong>DUNE</strong><small>PART TWO</small></> : <strong>{item.title}</strong>}</span>
              <span className={styles.sceneHint}>{selected === index ? 'Your next favourite?' : 'Rate this film'}</span>
            </button>
          ))}
        </div>
        <div className={styles.heroBottom}>
          <p>Films. Series. <span>And everything you thought of them.</span></p>
          <div className={styles.ratingDock}>
            <div className={styles.ratingLabel}><span>Your take</span><strong>{film.title}</strong></div>
            <div className={styles.ratingButtons} role="group" aria-label={`Rate ${film.title}`} onPointerLeave={() => setHoverRating(null)}>
              <Stars value={hoverRating ?? rating} />
              <div className={styles.ratingHits}>{Array.from({ length: 10 }, (_, index) => (index + 1) / 2).map((value) => <button key={value} type="button" aria-label={`Rate ${value} out of 5`} aria-pressed={rating === value} onPointerEnter={() => setHoverRating(value)} onFocus={() => setHoverRating(value)} onBlur={() => setHoverRating(null)} onClick={() => rate(value)} />)}</div>
            </div>
            <span className={styles.ratingFeedback} aria-live="polite">{rating ? <a href="#journal"><span className={styles.savedCheck}>✓</span> In your journal <span aria-hidden="true">↓</span></a> : <>Try a rating <span aria-hidden="true">↑</span></>}</span>
          </div>
        </div>
      </section>
      <section className={styles.journalSection} id="journal" aria-labelledby="journal-title" data-reveal>
        <div className={styles.journalCopy}><p className={styles.eyebrow}>The credits are just the beginning</p><h2 id="journal-title">You saw it.<br /><span>You felt it.</span><br />Keep it.</h2><p>That five-star feeling. The ending you’re still thinking about. The one you’ll never watch again.</p><p>Your ratings, reviews and rewatches,<br />all in your journal.</p><a className={styles.textLink} href="#hero-title">Give a film its first entry <span aria-hidden="true">↗</span></a></div>
        <div className={styles.journalShell}>
          <div className={styles.journalHeader}><span>Your journal<span className={styles.demoLabel}>PREVIEW</span></span><span className={styles.journalCount}>{entries.length} films</span></div>
          <div className={styles.journalSummary}><div><strong>{entries.length}</strong><span>Films logged</span></div><div><strong>{(entries.reduce((sum, item) => sum + item.rating, 0) / entries.length).toFixed(1)}</strong><span>Average rating</span></div><div><strong>2026</strong><span>Your watching year</span></div></div>
          <div className={styles.journalEntries} aria-live="polite" aria-relevant="additions text">
            {entries.map((entry) => { const item = films.find((movie) => movie.id === entry.id)!; return <div key={entry.id} className={styles.journalEntry} data-new={lastRated === entry.id}><Image src={`/landing/cinema/${entry.id}-poster.jpg`} alt={`${item.title} poster`} width={48} height={72} /><div><span className={styles.entryMeta}>{lastRated === entry.id ? 'Just added' : 'Watched'} · {item.year}</span><h3>{item.title}</h3><Stars value={entry.rating} /></div><span className={styles.entryRating}>{entry.rating.toFixed(1)}</span></div>; })}
          </div>
          <p className={styles.journalNote}>{lastRated ? 'Your rating is here. That’s how a watching history begins.' : 'Rate a film above. Watch your journal grow.'}</p>
        </div>
      </section>
      <section className={styles.seriesSection} id="series" aria-labelledby="series-title" data-reveal>
        <div className={styles.seriesBackdrop}><Image src="/landing/cinema/breaking-bad-backdrop.jpg" alt="Breaking Bad" fill sizes="100vw" /></div>
        <div className={styles.seriesInner}>
          <div className={styles.seriesCopy}><p className={styles.eyebrow}>For your “one more episode” nights</p><h2 id="series-title">Still<br /><span>watching?</span></h2><p>Of course you are.<br />We’ll remember where you left off.</p></div>
          <div className={styles.seriesPlayer}>
            <div className={styles.seriesPlayerHeader}><span>Continue watching</span><span>YOUR PROGRESS</span></div>
            <div className={styles.seriesIdentity}><Image src="/landing/cinema/breaking-bad-poster.jpg" alt="Breaking Bad poster" width={55} height={83} /><div><h3>Breaking Bad</h3><span>Season 5 · 16 episodes</span></div></div>
            <div className={styles.seasonProgress} aria-label={`${watchedEpisodes} of 16 episodes watched`}>{episodes.map((episode, index) => <span key={episode.episode_number} data-watched={index < watchedEpisodes} title={`Episode ${episode.episode_number}: ${episode.name}`} />)}</div>
            <div className={styles.nextEpisode} aria-live="polite"><span>{watchedEpisodes === 16 ? 'Season complete' : `UP NEXT · EPISODE ${watchedEpisodes + 1}`}</span><h4>{watchedEpisodes === 16 ? 'What a season.' : episodes[watchedEpisodes].name}</h4><span>{watchedEpisodes} / 16 watched</span></div>
            <button className={styles.markEpisode} type="button" onClick={() => setWatchedEpisodes((count) => count === 16 ? 1 : count + 1)}>{watchedEpisodes === 16 ? 'Try the preview again' : 'Mark episode watched'}<span aria-hidden="true">✓</span></button>
            <span className={styles.localHint}>{watchedEpisodes === 16 ? 'Season finished. Ready for your next series.' : 'Try it. Your next episode is ready.'}</span>
          </div>
        </div>
      </section>
      <section className={styles.listsSection} id="lists" aria-labelledby="lists-title" data-reveal>
        <div className={styles.listsHeader}><div><p className={styles.eyebrow}>Good taste deserves a good list</p><h2 id="lists-title">Very specific lists.<br /><span>Very you.</span></h2></div><p>The comfort rewatches. The recommendations.<br />The films you keep telling your friends to see.</p></div>
        <div className={styles.listTabs} role="group" aria-label="Preview a film list"><button type="button" aria-pressed={activeList === 0} onClick={() => setActiveList(0)}>Worth a rewatch</button><button type="button" aria-pressed={activeList === 1} onClick={() => setActiveList(1)}>A slow Sunday</button></div>
        <div className={styles.posterShelf} key={activeList}>{list.ids.map((id, index) => { const item = films.find((movie) => movie.id === id)!; return <figure key={id} style={{ '--poster-index': index } as React.CSSProperties}><Image src={`/landing/cinema/${id}-poster.jpg`} alt={`${item.title} poster`} width={500} height={750} sizes="(max-width: 767px) 38vw, 20vw" /><figcaption>{item.title}<span>{item.year}</span></figcaption></figure>; })}</div>
        <div className={styles.listCaption} aria-live="polite"><h3>{list.title}</h3><p>{list.description}</p></div>
      </section>
    </div>
  );
}
