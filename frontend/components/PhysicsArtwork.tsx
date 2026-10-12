import { Atom, Magnet, Thermometer, Waves, Radical, Network } from 'lucide-react';
export default function PhysicsArtwork({ section }: { section: string }) {
  if (section === 'mechanics') return <svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M9 12h46M18 12v31M32 12v31M46 12v31" stroke="#aeb5c3" strokeWidth="2.5" strokeLinecap="round"/><circle cx="18" cy="45" r="8" fill="#ff6b7c"/><circle cx="32" cy="45" r="8" fill="#ffb74b"/><circle cx="46" cy="45" r="8" fill="#ff8247"/></svg>;
  const Icon = section === 'mathematical-methods' ? Radical : section === 'oscillations-waves-optics' ? Waves : section === 'electricity-magnetism' ? Magnet : section === 'thermodynamics' ? Thermometer : section === 'solid-state-electronics' ? Network : Atom;
  return <Icon strokeWidth={1.5} aria-hidden="true" />;
}
