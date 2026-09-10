'use client';

import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import sources from '../../../public/landing/cinema/sources.json';
import episodes from '../../../public/landing/cinema/episodes.json';
import styles from './page.module.css';

const CinemaScene = dynamic(() => import('./CinemaScene'), { ssr: false });
const programme = [
  { id: 313369, title: 'La La Land', director: 'Damien Chazelle', year: '2016', runtime: '128 min', genre: 'Romance, music', line: 'Here’s to the ones who dream.' },
  { id: 157336, title: 'Interstellar', director: 'Christopher Nolan', year: '2014', runtime: '169 min', genre: 'Science fiction, drama', line: 'Some distances can’t be measured.' },
  { id: 693134, title: 'Dune: Part Two', director: 'Denis Villeneuve', year: '2024', runtime: '167 min', genre: 'Science fiction, adventure', line: 'A world worth getting lost in.' },
];
const collectionIds = [329865, 129, 157336, 120467, 693134];
const collection = collectionIds.map((id) => sources.find((film) => film.id === id)!);
const clamp = (n: number) => Math.max(0, Math.min(1, n));

export function CinemaExperience() {
  const experience = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [systemReduced, setSystemReduced] = useState(false);
  const [activeFilm, setActiveFilm] = useState(0);
  const [ratings, setRatings] = useState<Record<number, number>>({});
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [watched, setWatched] = useState(1);
  const film = programme[activeFilm];
  const rating = ratings[film.id] || 0;
  const motion = motionEnabled && !systemReduced;
  const saved = savedIds.includes(film.id);
  const journalEntries = [
    ...programme.filter((movie) => ratings[movie.id]).map((movie) => ({ id: movie.id, title: movie.title, year: movie.year, score: ratings[movie.id], date: 'Just now' })),
    { id: 244786, title: 'Whiplash', year: '2014', score: 5, date: '06 Sep' },
    { id: 329865, title: 'Arrival', year: '2016', score: 4, date: '04 Sep' },
    { id: 120467, title: 'The Grand Budapest Hotel', year: '2014', score: 5, date: '01 Sep' },
  ];

  function toggleSaved(id: number) {
    setSavedIds((ids) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]);
  }

  function focusGallery(index: number, button: HTMLButtonElement) {
    if (!motion || !button.matches(':focus-visible')) return;
    const chapter = document.getElementById('lists')!;
    const stage = chapter.firstElementChild as HTMLElement;
    const top = chapter.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + index / (collection.length - 1) * (chapter.offsetHeight - stage.offsetHeight), behavior: 'instant' });
  }

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setSystemReduced(preference.matches);
    change();
    preference.addEventListener('change', change);
    return () => preference.removeEventListener('change', change);
  }, []);

  useEffect(() => {
    const root = experience.current;
    if (!root) return;
    const chapters = root.querySelectorAll<HTMLElement>('[data-chapter]');
    const reveals = root.querySelectorAll<HTMLElement>('[data-reveal]');
    let frame = 0;
    function update() {
      frame = 0;
      chapters.forEach((chapter) => {
        const rect = chapter.getBoundingClientRect();
        const stage = chapter.firstElementChild as HTMLElement;
        const p = motion ? clamp(-rect.top / Math.max(1, rect.height - stage.offsetHeight)) : 0;
        chapter.style.setProperty('--p', String(p));
        if (chapter.id === 'screening-room') {
          progress.current = p;
          chapter.style.setProperty('--intro', String(1 - clamp(p / .19)));
          chapter.style.setProperty('--inside', String(clamp((p - .26) / .08) * (1 - clamp((p - .48) / .08))));
          chapter.style.setProperty('--image', String(clamp((p - .78) / .13)));
          chapter.style.setProperty('--title', String(clamp((p - .87) / .09)));
          chapter.dataset.entered = p > .8 ? 'true' : 'false';
          chapter.querySelectorAll<HTMLElement>('[data-intro-control]').forEach((item) => { item.inert = p > .19; });
          const title = chapter.querySelector<HTMLElement>('[data-film-title]');
          if (title) title.inert = p < .88;
        }
      });
      reveals.forEach((item) => {
        const rect = item.getBoundingClientRect();
        if (!motion || rect.top < window.innerHeight * .9) item.dataset.visible = 'true';
      });
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(update); }
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [motion]);

  return (
    <div className={styles.experience} ref={experience} data-motion={motion ? 'on' : 'off'}>
      <button className={styles.motionSwitch} type="button" aria-pressed={motion} onClick={() => setMotionEnabled(!motionEnabled)} disabled={systemReduced} aria-label={systemReduced ? 'Reduced motion follows your device preference' : 'Toggle animations'}><span aria-hidden="true">{motion ? '◉' : '○'}</span> Motion {motion ? 'on' : 'off'}</button>

      <section className={styles.screeningChapter} id="screening-room" data-chapter aria-labelledby="hero-title">
        <div className={styles.screeningStage}>
          <div className={styles.sceneFallback} aria-hidden="true"><Image src={'/landing/cinema/' + film.id + '-backdrop.jpg'} alt="" fill sizes="100vw" priority /></div>
          <CinemaScene progress={progress} filmId={film.id} motion={motion} />
          <div className={styles.sceneGrain} aria-hidden="true" />
          <div className={styles.heroIntro} data-intro-control>
            <p className={styles.eyebrow}><span className={styles.tinyStar} aria-hidden="true">✳</span> A life in cinema</p>
            <h1 id="hero-title">A place for<br />the films<br />that <em>stay.</em></h1>
            <p className={styles.heroCopy}>The ones you love. The ones you’re yet to find.<br />Your films, series and memories, all in Watchly.</p>
            <a href="#after-credits" className={styles.enterLink}><span className={styles.roundArrow} aria-hidden="true">↓</span><span>Take your seat<small>Scroll to enter</small></span></a>
          </div>
          <div className={styles.roomCaption} aria-hidden="true"><span className={styles.eyebrow}>The lights go down.</span><p>The rest of the world<br /><em>can wait.</em></p></div>
          <div className={styles.programme} data-intro-control role="group" aria-label="Choose the film on screen"><span>NOW SHOWING</span>{programme.map((movie, index) => <button key={movie.id} type="button" aria-pressed={index === activeFilm} onClick={() => setActiveFilm(index)}><small>0{index + 1}</small>{movie.title}<span aria-hidden="true">↗</span></button>)}</div>
          <div className={styles.fullFilm} aria-hidden="true" key={film.id}><Image src={'/landing/cinema/' + film.id + '-backdrop.jpg'} alt="" fill sizes="100vw" priority /><div className={styles.filmShade} /></div>
          <div className={styles.filmTitle} data-film-title><p className={styles.eyebrow}>A film by {film.director}</p><h2>{film.title}</h2><div><span>{film.year} <i /> {film.runtime}</span><span>{film.line}</span></div><a href="#after-credits">Stay a little longer <span aria-hidden="true">↓</span></a></div>
          <span className={styles.reelCounter} aria-hidden="true">WATCHLY PICTURE HOUSE <span>01 / 03</span></span>
        </div>
      </section>

      <section className={styles.afterCredits} id="after-credits" aria-labelledby="film-title">
        <div className={styles.afterIntro} data-reveal><p className={styles.eyebrow}>01 / After the credits</p><h2 id="film-title">It’s over.<br /><em>It’s not gone.</em></h2><p>Give it a rating. Save it for a second viewing.<br />Keep a little of the feeling.</p></div>
        <div className={styles.filmCard} data-reveal><Image className={styles.detailPoster} src={'/landing/cinema/' + film.id + '-poster.jpg'} alt={film.title + ' poster'} width={180} height={270} /><div><p className={styles.eyebrow}>{film.year} · {film.runtime}</p><h3>{film.title}</h3><p className={styles.filmCredit}>{film.director}<br />{film.genre}</p><fieldset className={styles.rating}><legend>Your rating</legend>{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" aria-label={'Rate ' + value + ' out of 5'} aria-pressed={rating === value} data-filled={value <= rating} onClick={() => setRatings((current) => ({ ...current, [film.id]: value }))}>★</button>)}</fieldset><p className={styles.ratingMessage} aria-live="polite">{rating ? rating + '/5. Added to your journal below.' : 'How did it leave you?'}</p><button className={styles.saveButton} type="button" aria-pressed={saved} onClick={() => toggleSaved(film.id)}><span aria-hidden="true">{saved ? '✓' : '+'}</span>{saved ? 'In your watchlist' : 'Add to watchlist'}</button></div></div>
      </section>

      <section className={styles.journal} id="journal" aria-labelledby="journal-title">
        <div className={styles.journalHeading} data-reveal><p className={styles.eyebrow}>02 / The things you keep</p><h2 id="journal-title">A life, <em>in frames.</em></h2><p>That late screening. That third rewatch.<br />A journal of everything you’ve seen.</p></div>
        <div className={styles.journalSheet} data-reveal><div className={styles.journalTop}><span>Your film journal</span><span>SEPTEMBER 2026</span><span>{String(journalEntries.length).padStart(2, '0')} ENTRIES</span></div><div className={styles.journalRows}>{journalEntries.map((entry, index) => <div className={styles.journalRow} key={entry.id} style={{ '--order': index } as CSSProperties}><span className={styles.entryNumber}>{String(index + 1).padStart(2, '0')}</span><Image src={'/landing/cinema/' + entry.id + '-poster.jpg'} alt="" width={58} height={87} /><div><h3>{entry.title}</h3><p>{entry.year} <span>Watched</span></p></div><time>{entry.date}</time><span className={styles.entryRating} aria-label={entry.score + ' out of 5'}>{'★'.repeat(entry.score)}<span>{'★'.repeat(5 - entry.score)}</span></span></div>)}</div><div className={styles.journalBottom}><span>Some things are worth keeping track of.</span><span>WATCHLY / PERSONAL COLLECTION</span></div></div>
      </section>

      <section className={styles.collectionChapter} id="lists" data-chapter aria-labelledby="collection-title">
        <div className={styles.collectionStage}>
          <div className={styles.collectionHeading}><p className={styles.eyebrow}>And then there’s the next one.</p><h2 id="collection-title">Follow <em>the feeling.</em></h2><p>A watchlist for every “you have to see this”.</p></div>
          <div className={styles.filmGallery}>{collection.map((movie, index) => <article className={styles.galleryFilm} key={movie.id} style={{ '--index': index } as CSSProperties}><div className={styles.galleryImage}><Image src={'/landing/cinema/' + movie.id + '-poster.jpg'} alt={movie.title + ' poster'} width={360} height={540} sizes="(max-width: 600px) 58vw, 25vw" /><button type="button" aria-label={(savedIds.includes(movie.id) ? 'Remove ' : 'Save ') + movie.title + (savedIds.includes(movie.id) ? ' from watchlist' : ' to watchlist')} aria-pressed={savedIds.includes(movie.id)} onFocus={(event) => focusGallery(index, event.currentTarget)} onClick={() => toggleSaved(movie.id)}>{savedIds.includes(movie.id) ? '✓' : '+'}</button></div><div className={styles.galleryCaption}><span>{movie.title}</span><small>{movie.year.slice(0, 4)}</small></div></article>)}</div>
          <div className={styles.collectionFoot}><span>FIVE FILMS. FIVE DIFFERENT WORLDS.</span><span className={styles.galleryProgress} aria-hidden="true"><i /></span></div>
        </div>
      </section>

      <section className={styles.series} id="series" aria-labelledby="series-title"><div className={styles.seriesBackdrop}><Image src="/landing/cinema/breaking-bad-backdrop.jpg" alt="Walt and Jesse in the desert in Breaking Bad" fill sizes="100vw" /></div><div className={styles.seriesContent} data-reveal><p className={styles.eyebrow}>03 / To be continued</p><h2 id="series-title">Just one<br /><em>more episode.</em></h2><p>For the stories that take a little longer.<br />Pick up exactly where you left off.</p><div className={styles.episode}><div className={styles.episodeTop}><h3>Breaking Bad</h3><span>{watched}/16</span></div><progress value={watched} max={16} aria-label={watched + ' of 16 episodes watched'} /><div className={styles.episodeNext} aria-live="polite"><span>{watched === 16 ? 'Season complete' : 'S05 / E' + String(watched + 1).padStart(2, '0')}</span><h4>{watched === 16 ? 'That final frame.' : episodes[watched].name}</h4></div><button type="button" disabled={watched === 16} onClick={() => setWatched((value) => Math.min(value + 1, 16))}>{watched === 16 ? '✓ Season finished' : 'Mark episode watched'}<span aria-hidden="true">↗</span></button></div></div><span className={styles.seriesCredit}>BREAKING BAD / VINCE GILLIGAN / 2008–2013</span></section>
    </div>
  );
}
