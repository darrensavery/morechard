import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function AudienceCard({
  to,
  title,
  description,
}: {
  to: string;
  title: string;
  description: string;
}) {
  return (
    <Link to={to} className={styles.audienceCard}>
      <Heading as="h2">{title}</Heading>
      <p>{description}</p>
      <span className={styles.cardCta}>Browse guides →</span>
    </Link>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="Morechard Support"
      description="Help and how-to guides for parents and kids using Morechard.">
      <header className={styles.hero}>
        <div className="container">
          <Heading as="h1" className={styles.heroTitle}>
            How can we help?
          </Heading>
          <p className={styles.heroSubtitle}>
            Guides for setting up chores, goals, and the family ledger — written
            for parents and for kids.
          </p>
        </div>
      </header>
      <main className="container">
        <div className={styles.audienceGrid}>
          <AudienceCard
            to="/category/for-parents"
            title="For Parents"
            description="Setting up chores, approving completions, the Ledger, separated-family features, billing, and account security."
          />
          <AudienceCard
            to="/category/for-kids"
            title="For Kids"
            description="How chores, goals, and the Learning Lab work — written for you, not your parents."
          />
        </div>
        <div className={styles.helpBanner}>
          <p>
            Can't find what you're looking for?{' '}
            <a href="mailto:support@morechard.com">Email support@morechard.com</a>{' '}
            and we'll pick it up from here.
          </p>
        </div>
      </main>
    </Layout>
  );
}
