import type { LegalDocument } from '../content/legal';

export function LegalArticle({ document }: { document: LegalDocument }) {
  return (
    <article className="legal-article">
      <header className="legal-hero">
        <p className="eyebrow">{document.eyebrow}</p>
        <h1>{document.title}</h1>
        <p className="legal-hero__description">{document.description}</p>
        <p className="legal-hero__date">Last updated {document.updatedAt}</p>
      </header>
      <div className="legal-body">
        <aside aria-label="Document information" className="legal-aside">
          <span>Plain language</span>
          <p>Designed to be read without legal or technical knowledge.</p>
        </aside>
        <div className="legal-sections">
          {document.sections.map((section, index) => (
            <section id={`section-${index + 1}`} key={section.title}>
              <span aria-hidden="true" className="section-number">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <h2>{section.title}</h2>
                {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
