import type { Metadata } from 'next';
import { CircleHelp, Database, LockKeyhole, Mail, ShieldAlert } from 'lucide-react';

export const metadata: Metadata = {
  description: 'Contact Watchly support for account, privacy, catalogue, or community safety help.',
  title: 'Contact and support',
};

const topics = [
  {
    description: 'Sign-in trouble, account access, profile settings, or a deletion request.',
    icon: CircleHelp,
    title: 'Account help',
  },
  {
    description: 'Data access, export, correction, privacy controls, or retention questions.',
    icon: LockKeyhole,
    title: 'Privacy request',
  },
  {
    description: 'Incorrect title, artwork, release date, or streaming availability information.',
    icon: Database,
    title: 'Catalogue correction',
  },
  {
    description: 'Urgent safety concerns, impersonation, abuse, or unlawful content reports.',
    icon: ShieldAlert,
    title: 'Safety and reports',
  },
] as const;

export default function SupportPage() {
  const supportEmail = getSupportEmail();

  return (
    <article className="support-page">
      <header className="support-hero">
        <div>
          <p className="eyebrow">Help center</p>
          <h1>How can we help?</h1>
          <p>Choose the closest topic and include only the information needed to understand the request.</p>
        </div>
        <div className="support-contact">
          <Mail aria-hidden="true" size={26} strokeWidth={1.5} />
          <span>Support contact</span>
          {supportEmail ? (
            <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
          ) : (
            <p>Use the verified publisher contact in the App Store or Google Play listing.</p>
          )}
        </div>
      </header>
      <section aria-labelledby="support-topics" className="support-topics">
        <div className="section-heading">
          <p className="eyebrow">Request routing</p>
          <h2 id="support-topics">Send the right context</h2>
        </div>
        <div className="support-grid">
          {topics.map(({ description, icon: Icon, title }) => (
            <div className="support-card" key={title}>
              <Icon aria-hidden="true" size={22} strokeWidth={1.5} />
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
          ))}
        </div>
      </section>
      <aside className="security-note">
        <ShieldAlert aria-hidden="true" size={22} />
        <div>
          <h2>Never send credentials</h2>
          <p>Watchly support will never ask for your password, one-time code, recovery key, or authentication token.</p>
        </div>
      </aside>
    </article>
  );
}

function getSupportEmail() {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();

  if (!email || email.endsWith('@example.com') || !/^\S+@\S+\.\S+$/.test(email)) {
    return null;
  }

  return email;
}
