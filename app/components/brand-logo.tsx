import Image from "next/image";
import styles from "./brand-logo.module.css";

/** Blend the original lockup into the navigation surface without a logo tile. */
export function BrandLogo({ full = false }: { full?: boolean }) {
  return full ? (
    <Image className={styles.full} src="/brand/studio-calendar-logo.png" width={1020} height={680} alt="Studio Calendar by PROSPERA — Pilates studio booking platform" />
  ) : (
    <Image className={styles.compact} src="/brand/studio-calendar-lockup.png" width={840} height={180} alt="Studio Calendar by PROSPERA" />
  );
}
