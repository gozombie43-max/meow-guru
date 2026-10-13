import Image from 'next/image';
import Link from 'next/link';
import { JAM_MOCK_CONFIGS } from '@meow/contracts/jam';
import { JAM_SECTIONS, JAM_SUBJECT } from '@/lib/exam-mode';
import styles from './exam-mode.module.css';

const titles: Record<string, string> = {
  'mathematical-methods': 'Mathematical Methods',
  mechanics: 'Mechanics',
  'oscillations-waves-optics': 'Waves & Optics',
  'electricity-magnetism': 'Electricity & Magnetism',
  thermodynamics: 'Thermodynamics',
  'modern-physics': 'Modern Physics',
  'solid-state-electronics': 'Solid State & Electronics',
};

export default function JamMockSectionCards() {
  return <div className={styles.mockGrid}>
    {JAM_SECTIONS.map(section => {
      const exam = `${JAM_SUBJECT}-${section.slug}`;
      const config = Object.values(JAM_MOCK_CONFIGS).find(item => item.key === exam);
      const questions = config?.sections.reduce((total, item) => total + Number(item.questionCount), 0);
      return <Link key={section.slug} href={`/mock-test/${exam}`} prefetch={true} className={styles.mockCard}>
        <span className={styles.mockArtwork}>
          <Image src={`/images/jam-sections/${section.slug}.webp`} alt="" fill sizes="(max-width: 600px) 50vw, (max-width: 1000px) 33vw, 260px" />
        </span>
        <span className={styles.mockCardCopy}>
          <strong>{titles[section.slug] ?? section.title}</strong>
          <small>{questions ? `${questions} questions per test` : 'Section practice'}</small>
        </span>
      </Link>;
    })}
  </div>;
}
