import type { Metadata } from 'next';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Demo access',
  robots: { index: false, follow: false },
};

export default function ReviewAccessPage() {
  return (
    <article className={styles.page}>
      <p className="eyebrow">Watchly review access</p>
      <h1>Open your demo account</h1>
      <p>On your iPhone, install the Watchly build from TestFlight, then tap the button below.</p>
      <p><a className={styles.openApp} href="com.trywatchly.app://review-access">Open Watchly</a></p>
      <p>Enter the username and password provided in App Store Connect inside the app. This page does not collect credentials.</p>
      <p>If Watchly does not open, check that it is installed and open this page in Safari on the same iPhone.</p>
    </article>
  );
}
