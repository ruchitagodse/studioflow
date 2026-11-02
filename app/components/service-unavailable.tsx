import styles from "./sprint-one.module.css";

export function ServiceUnavailable() {
  return <main className={styles.simplePage}><section className={styles.simpleCard}>
    <p className={styles.kicker}>TEMPORARILY UNAVAILABLE</p>
    <h1>Your studio will be back soon.</h1>
    <p className={styles.muted}>We can’t load your studio information right now. Please wait a little before trying again. If this continues, contact your studio administrator.</p>
    <a className={styles.primaryLink} href="/entry">Try again</a>
  </section></main>;
}
