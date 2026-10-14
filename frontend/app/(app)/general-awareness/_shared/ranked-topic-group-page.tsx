"use client";

// Shared chapter hub for General Awareness and IIT JAM Physics.

import MicIcon from "@/components/MicIcon";
import TopicThumbnail from "@/components/subject-hub/TopicThumbnail";
import { CHAPTER_IMAGE_NAMES, chapterImage } from "@/lib/topic-images";
import { useBackLayer } from "@/hooks/useAppNavigation";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import hubStyles from "@/components/SubjectHub.module.css";
import type {
RankedTopicGroup,
RankedTopicPriority,
} from "@/lib/ranked-topic-groups";


interface SpeechRecognitionResultEvent {
  results?: { [index: number]: { [index: number]: { transcript?: string } } };
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;
type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};
import Link from "next/link";
import { useCallback,useEffect,useMemo,useRef,useState } from "react";
import styles from "./RankedTopicGroupPage.module.css";

type PriorityFilter = RankedTopicPriority | "All";

const PRIORITY_CLASS: Record<RankedTopicPriority, string> = {
  "Very High": styles.veryHigh,
  Core: styles.veryHigh,
  High: styles.high,
  Medium: styles.medium,
  Lower: styles.lower,
};

export interface TopicMeta {
  image: string;
}

export const TOPIC_META: Record<string, TopicMeta> = {
  // IIT JAM electricity-magnetism
  "coulombs-law": { image: CHAPTER_IMAGE_NAMES.Zap },
  "gauss-law": { image: CHAPTER_IMAGE_NAMES.CircleDot },
  "electrostatic-potential": { image: CHAPTER_IMAGE_NAMES.Gauge },
  "energy-in-electrostatic-system": { image: CHAPTER_IMAGE_NAMES.BatteryCharging },
  "electric-dipole-and-multipole-terms": { image: CHAPTER_IMAGE_NAMES.ArrowLeftRight },
  "laplace-and-poisson-equations": { image: CHAPTER_IMAGE_NAMES.Sigma },
  "dielectric-material": { image: CHAPTER_IMAGE_NAMES.Layers },
  "magnetostatics-biot-savart-law": { image: CHAPTER_IMAGE_NAMES.Magnet },
  "lorentz-force": { image: CHAPTER_IMAGE_NAMES.MoveRight },
  "amperes-law": { image: CHAPTER_IMAGE_NAMES.Orbit },
  "magnetic-dipole": { image: CHAPTER_IMAGE_NAMES.Magnet },
  "torque-on-a-loop-inside-magnetic-field": { image: CHAPTER_IMAGE_NAMES.RefreshCw },
  "electrodynamics-electromotive-force": { image: CHAPTER_IMAGE_NAMES.Zap },
  "magnetic-induction-and-inductance": { image: CHAPTER_IMAGE_NAMES.Activity },
  "maxwell-equations-and-boundary-conditions": { image: CHAPTER_IMAGE_NAMES.Sigma },
  "poynting-vector": { image: CHAPTER_IMAGE_NAMES.MoveRight },
  "skin-depth": { image: CHAPTER_IMAGE_NAMES.Layers },
  "electromagnetic-radiation": { image: CHAPTER_IMAGE_NAMES.Radiation },
  // IIT JAM oscillations-waves-optics
  "differential-equation-for-simple-harmonic-oscillator-and-its-general-solution": { image: CHAPTER_IMAGE_NAMES.Activity },
  "superposition-of-two-or-more-simple-harmonic-oscillators": { image: CHAPTER_IMAGE_NAMES.Layers },
  "lissajous-figures": { image: CHAPTER_IMAGE_NAMES.Orbit },
  "damped-and-forced-oscillators": { image: CHAPTER_IMAGE_NAMES.Activity },
  "group-velocity-and-phase-velocity": { image: CHAPTER_IMAGE_NAMES.Gauge },
  "sound-waves-in-media": { image: CHAPTER_IMAGE_NAMES.Volume2 },
  "doppler-effect": { image: CHAPTER_IMAGE_NAMES.Waves },
  "fermats-principle": { image: CHAPTER_IMAGE_NAMES.Route },
  "general-theory-of-image-formation": { image: CHAPTER_IMAGE_NAMES.Eye },
  "thick-lens-thin-lens-and-lens-combinations": { image: CHAPTER_IMAGE_NAMES.Glasses },
  "interference-of-light": { image: CHAPTER_IMAGE_NAMES.Waves },
  "fraunhofer-diffraction": { image: CHAPTER_IMAGE_NAMES.ScanLine },
  "rayleigh-criterion-and-resolving-power": { image: CHAPTER_IMAGE_NAMES.Microscope },
  "diffraction-gratings": { image: CHAPTER_IMAGE_NAMES.Grid },
  "polarization": { image: CHAPTER_IMAGE_NAMES.Filter },
  "double-refraction-and-optical-rotation": { image: CHAPTER_IMAGE_NAMES.RefreshCw },
  // IIT JAM mechanics
  "kinematics-fluid-mechanics-rigid-body-dynamics": { image: CHAPTER_IMAGE_NAMES.Cog },
  "simple-harmonic-motion": { image: CHAPTER_IMAGE_NAMES.Activity },
  "collision-and-impulse": { image: CHAPTER_IMAGE_NAMES.ArrowLeftRight },
  "centrifugal-and-coriolis-force": { image: CHAPTER_IMAGE_NAMES.RefreshCw },
  "small-oscillations": { image: CHAPTER_IMAGE_NAMES.Waves },
  "central-force-motion-gravitation": { image: CHAPTER_IMAGE_NAMES.Orbit },
  "velocity-and-acceleration-in-plane-polar-and-cylindrical-coordinate": { image: CHAPTER_IMAGE_NAMES.Compass },
  // IIT JAM solid-state-electronics
  "semiconductor-devices": { image: CHAPTER_IMAGE_NAMES.Cpu },
  "application-of-junction-diode": { image: CHAPTER_IMAGE_NAMES.MoveRight },
  "bipolar-junction-transistor": { image: CHAPTER_IMAGE_NAMES.Network },
  "circuit-analysis": { image: CHAPTER_IMAGE_NAMES.Route },
  "operational-amplifiers-and-its-applications": { image: CHAPTER_IMAGE_NAMES.Volume2 },
  "zener-diode-and-its-applications": { image: CHAPTER_IMAGE_NAMES.Zap },
  "boolean-expression-and-gates": { image: CHAPTER_IMAGE_NAMES.Network },
  "number-system": { image: CHAPTER_IMAGE_NAMES.Sigma },
  "lcr-circuits": { image: CHAPTER_IMAGE_NAMES.Activity },
  "crystal-structure": { image: CHAPTER_IMAGE_NAMES.Gem },
  "x-ray-diffraction": { image: CHAPTER_IMAGE_NAMES.ScanLine },
  "specific-heat": { image: CHAPTER_IMAGE_NAMES.Thermometer },
  "magnetic-properties": { image: CHAPTER_IMAGE_NAMES.Magnet },
  "fermi-level": { image: CHAPTER_IMAGE_NAMES.Layers },
  "semiconductor": { image: CHAPTER_IMAGE_NAMES.Cpu },
  // IIT JAM thermodynamics
  "elements-of-kinetic-theory-of-gases": { image: CHAPTER_IMAGE_NAMES.Wind },
  "degree-of-freedom-and-equipartition-theorem-and-specific-heat": { image: CHAPTER_IMAGE_NAMES.Thermometer },
  "mean-free-path": { image: CHAPTER_IMAGE_NAMES.Route },
  "ideal-gas-van-der-waals-gas-and-equation-of-state": { image: CHAPTER_IMAGE_NAMES.Gauge },
  "calorimetry-work-and-state-functions": { image: CHAPTER_IMAGE_NAMES.Flame },
  "laws-of-thermodynamics-zeroth-law-and-concept-of-thermal-equilibrium-1st-law-and-its-consequences": { image: CHAPTER_IMAGE_NAMES.Scale },
  "isothermal-and-adiabatic-process": { image: CHAPTER_IMAGE_NAMES.LineChart },
  "reversible-irreversible-quasi-static-process": { image: CHAPTER_IMAGE_NAMES.ArrowLeftRight },
  "2nd-law-of-thermodynamics-entropy-carnot-cycle": { image: CHAPTER_IMAGE_NAMES.RefreshCw },
  "maxwells-thermodynamic-relations-and-simple-applications": { image: CHAPTER_IMAGE_NAMES.Sigma },
  "phase-transition-and-clausius-clapeyron-equation": { image: CHAPTER_IMAGE_NAMES.Droplets },
  "black-body-radiation": { image: CHAPTER_IMAGE_NAMES.Sun },
  "ideas-of-ensembles-mb-fd-be-distribution": { image: CHAPTER_IMAGE_NAMES.BarChart3 },

  // IIT JAM Mathematical Methods
  "vector-algebra-and-vector-calculus": { image: CHAPTER_IMAGE_NAMES.Compass },
  "matrices": { image: CHAPTER_IMAGE_NAMES.Grid },
  "eigenvalues-and-eigenvectors": { image: CHAPTER_IMAGE_NAMES.MoveRight },
  "linear-ordinary-differential-equations-of-first-second-order": { image: CHAPTER_IMAGE_NAMES.LineChart },
  "fourier-series": { image: CHAPTER_IMAGE_NAMES.Waves },
  "complex-analysis": { image: CHAPTER_IMAGE_NAMES.Orbit },
  "taylor-laurent-series": { image: CHAPTER_IMAGE_NAMES.Sigma },

  // IIT JAM Modern Physics
  "blackbody-radiation": { image: CHAPTER_IMAGE_NAMES.Sun },
  "photoelectric-effect": { image: CHAPTER_IMAGE_NAMES.Zap },
  "compton-effect": { image: CHAPTER_IMAGE_NAMES.ArrowLeftRight },
  "x-rays": { image: CHAPTER_IMAGE_NAMES.ScanLine },
  "wave-particle-duality": { image: CHAPTER_IMAGE_NAMES.Waves },
  "uncertainty-principle": { image: CHAPTER_IMAGE_NAMES.Target },
  "superposition-principle": { image: CHAPTER_IMAGE_NAMES.Layers },
  "calculation-of-expectation-values": { image: CHAPTER_IMAGE_NAMES.Sigma },
  "schrodinger-equation-and-its-solution-for-one-dimensional-box": { image: CHAPTER_IMAGE_NAMES.Box },
  "two-dimensional-box": { image: CHAPTER_IMAGE_NAMES.Grid },
  "three-dimensional-boxes": { image: CHAPTER_IMAGE_NAMES.Boxes },
  "one-dimensional-harmonic-oscillator": { image: CHAPTER_IMAGE_NAMES.Activity },
  "step-potential": { image: CHAPTER_IMAGE_NAMES.TrendingUp },
  "paulis-spin-matrices": { image: CHAPTER_IMAGE_NAMES.RefreshCw },
  "basic-properties-of-nucleus": { image: CHAPTER_IMAGE_NAMES.Atom },
  "relativistic-behavior-binding-energy-semf": { image: CHAPTER_IMAGE_NAMES.Gauge },
  "radioactivity": { image: CHAPTER_IMAGE_NAMES.Radiation },

  // ── Geography Chapters (30) ────────────────────────────────────────────────
  "indian-rivers-drainage-system": { image: CHAPTER_IMAGE_NAMES.Waves },
  "physiography-of-india": { image: CHAPTER_IMAGE_NAMES.Mountain },
  "soil-agriculture": { image: CHAPTER_IMAGE_NAMES.Sprout },
  "national-parks-wildlife-sanctuaries-tiger-reserves-biosphere-reserves": { image: CHAPTER_IMAGE_NAMES.Trees },
  "indian-climate-monsoon": { image: CHAPTER_IMAGE_NAMES.CloudRain },
  "india-location-states-uts-boundaries-neighbouring-countries": { image: CHAPTER_IMAGE_NAMES.MapPin },
  "world-map-important-geographical-locations": { image: CHAPTER_IMAGE_NAMES.Globe },
  "solar-system-universe": { image: CHAPTER_IMAGE_NAMES.Orbit },
  "mountains-plateaus-plains-ghats-mountain-passes-india": { image: CHAPTER_IMAGE_NAMES.MountainSnow },
  "atmosphere-weather-climate": { image: CHAPTER_IMAGE_NAMES.CloudSun },
  "minerals-energy-resources": { image: CHAPTER_IMAGE_NAMES.Zap },
  "forests-grasslands-natural-vegetation-wildlife": { image: CHAPTER_IMAGE_NAMES.TreePine },
  "dams-reservoirs-lakes-waterfalls-wetlands": { image: CHAPTER_IMAGE_NAMES.Droplets },
  "oceanography-oceans-currents-tides-waves": { image: CHAPTER_IMAGE_NAMES.Compass },
  "earth-interior-plate-tectonics-earthquakes-volcanoes": { image: CHAPTER_IMAGE_NAMES.Flame },
  "world-physical-geography": { image: CHAPTER_IMAGE_NAMES.Map },
  "transport-geography-railways-roads-ports-waterways": { image: CHAPTER_IMAGE_NAMES.Route },
  "population-census-human-geography": { image: CHAPTER_IMAGE_NAMES.Users },
  "industries-industrial-regions": { image: CHAPTER_IMAGE_NAMES.Factory },
  "latitude-longitude-rotation-revolution-time-zones": { image: CHAPTER_IMAGE_NAMES.Clock },
  "seas-gulfs-bays-straits-channels-canals": { image: CHAPTER_IMAGE_NAMES.Anchor },
  "geomorphology-landforms": { image: CHAPTER_IMAGE_NAMES.Layers },
  "rocks-minerals-rock-cycle": { image: CHAPTER_IMAGE_NAMES.CircleDot },
  "cyclones-anticyclones-local-winds": { image: CHAPTER_IMAGE_NAMES.Wind },
  "water-atmosphere-humidity-clouds-rainfall-precipitation": { image: CHAPTER_IMAGE_NAMES.CloudFog },
  "water-resources-irrigation-groundwater": { image: CHAPTER_IMAGE_NAMES.Droplet },
  "natural-disasters-hazards": { image: CHAPTER_IMAGE_NAMES.AlertTriangle },
  "world-climate-natural-vegetation": { image: CHAPTER_IMAGE_NAMES.SunMedium },
  "environmental-geography-ecology": { image: CHAPTER_IMAGE_NAMES.Leaf },
  "world-human-economic-geography": { image: CHAPTER_IMAGE_NAMES.TrendingUp },

  // ── Ancient History Chapters (14) ──────────────────────────────────────────
  "jainism-buddhism": { image: CHAPTER_IMAGE_NAMES.Flower2 },
  "mauryan-empire": { image: CHAPTER_IMAGE_NAMES.Crown },
  "indus-valley-civilization": { image: CHAPTER_IMAGE_NAMES.Boxes },
  "gupta-empire": { image: CHAPTER_IMAGE_NAMES.Coins },
  "vedic-age": { image: CHAPTER_IMAGE_NAMES.Flame },
  "ancient-indian-art-architecture-literature-education-science": { image: CHAPTER_IMAGE_NAMES.Palette },
  "mahajanapadas-rise-of-magadha": { image: CHAPTER_IMAGE_NAMES.ShieldAlert },
  "post-mauryan-india": { image: CHAPTER_IMAGE_NAMES.Globe2 },
  "sangam-age": { image: CHAPTER_IMAGE_NAMES.Feather },
  "chola-empire": { image: CHAPTER_IMAGE_NAMES.Ship },
  "post-gupta-india": { image: CHAPTER_IMAGE_NAMES.Columns },
  "tripartite-struggle": { image: CHAPTER_IMAGE_NAMES.Swords },
  "stone-age": { image: CHAPTER_IMAGE_NAMES.Pickaxe },
  "foreign-travellers-ancient-universities-texts": { image: CHAPTER_IMAGE_NAMES.GraduationCap },

  // ── Medieval History Chapters (10) ─────────────────────────────────────────
  "mughal-empire": { image: CHAPTER_IMAGE_NAMES.Landmark },
  "delhi-sultanate": { image: CHAPTER_IMAGE_NAMES.Castle },
  "bhakti-sufi-movements": { image: CHAPTER_IMAGE_NAMES.Heart },
  "marathas-shivaji": { image: CHAPTER_IMAGE_NAMES.Shield },
  "vijayanagara-bahmani-kingdoms": { image: CHAPTER_IMAGE_NAMES.Gem },
  "sikh-gurus-khalsa": { image: CHAPTER_IMAGE_NAMES.Sparkles },
  "sher-shah-suri-sur-dynasty": { image: CHAPTER_IMAGE_NAMES.Route },
  "medieval-art-architecture-literature-administration": { image: CHAPTER_IMAGE_NAMES.Building2 },
  "medieval-travellers": { image: CHAPTER_IMAGE_NAMES.Compass },
  "regional-kingdoms": { image: CHAPTER_IMAGE_NAMES.Crown },

  // ── Modern History Chapters (19) ───────────────────────────────────────────
  "gandhian-era": { image: CHAPTER_IMAGE_NAMES.Glasses },
  "indian-national-congress": { image: CHAPTER_IMAGE_NAMES.Building2 },
  "british-conquest-expansion-india": { image: CHAPTER_IMAGE_NAMES.Swords },
  "governor-generals-viceroys": { image: CHAPTER_IMAGE_NAMES.Award },
  "constitutional-development-british-acts": { image: CHAPTER_IMAGE_NAMES.FileText },
  "revolt-of-1857": { image: CHAPTER_IMAGE_NAMES.Flame },
  "final-phase-freedom-struggle": { image: CHAPTER_IMAGE_NAMES.Flag },
  "revolutionary-nationalism": { image: CHAPTER_IMAGE_NAMES.Target },
  "socio-religious-reform-movements": { image: CHAPTER_IMAGE_NAMES.Lightbulb },
  "partition-bengal-swadeshi-movement": { image: CHAPTER_IMAGE_NAMES.ShieldAlert },
  "home-rule-movement-lucknow-pact": { image: CHAPTER_IMAGE_NAMES.Home },
  "simon-commission-civil-disobedience-movement": { image: CHAPTER_IMAGE_NAMES.Footprints },
  "subhas-chandra-bose-indian-national-army": { image: CHAPTER_IMAGE_NAMES.Award },
  "peasant-tribal-movements": { image: CHAPTER_IMAGE_NAMES.TreePine },
  "advent-of-europeans": { image: CHAPTER_IMAGE_NAMES.Ship },
  "british-land-revenue-economic-policies": { image: CHAPTER_IMAGE_NAMES.Coins },
  "education-press-social-legislation-british-rule": { image: CHAPTER_IMAGE_NAMES.Newspaper },
  "early-political-associations-nationalist-newspapers": { image: CHAPTER_IMAGE_NAMES.Megaphone },
  "integration-princely-states-early-post-independence-india": { image: CHAPTER_IMAGE_NAMES.ShieldCheck },

  // ── Polity Chapters (28) ───────────────────────────────────────────────────
  "fundamental-rights": { image: CHAPTER_IMAGE_NAMES.ShieldCheck },
  "parliament": { image: CHAPTER_IMAGE_NAMES.Landmark },
  "president-and-vice-president": { image: CHAPTER_IMAGE_NAMES.Crown },
  "constitutional-articles-parts-and-schedules": { image: CHAPTER_IMAGE_NAMES.BookOpen },
  "constitutional-amendments": { image: CHAPTER_IMAGE_NAMES.FileText },
  "supreme-court-and-high-courts": { image: CHAPTER_IMAGE_NAMES.Scale },
  "prime-minister-and-council-of-ministers": { image: CHAPTER_IMAGE_NAMES.Users },
  "directive-principles-of-state-policy-dpsp-and-fundamental-duties": { image: CHAPTER_IMAGE_NAMES.HeartHandshake },
  "making-of-the-constitution-and-constituent-assembly": { image: CHAPTER_IMAGE_NAMES.PenTool },
  "preamble": { image: CHAPTER_IMAGE_NAMES.Scroll },
  "constitutional-and-non-constitutional-bodies": { image: CHAPTER_IMAGE_NAMES.Building2 },
  "governor-chief-minister-and-state-council-of-ministers": { image: CHAPTER_IMAGE_NAMES.Award },
  "election-commission-and-elections": { image: CHAPTER_IMAGE_NAMES.Vote },
  "citizenship": { image: CHAPTER_IMAGE_NAMES.UserCheck },
  "emergency-provisions": { image: CHAPTER_IMAGE_NAMES.AlertTriangle },
  "salient-features-and-sources-of-the-constitution": { image: CHAPTER_IMAGE_NAMES.Compass },
  "centre-state-relations": { image: CHAPTER_IMAGE_NAMES.Network },
  "state-legislature": { image: CHAPTER_IMAGE_NAMES.Columns },
  "panchayati-raj-and-municipalities": { image: CHAPTER_IMAGE_NAMES.Home },
  "comptroller-and-auditor-general-cag": { image: CHAPTER_IMAGE_NAMES.Search },
  "finance-commission": { image: CHAPTER_IMAGE_NAMES.Coins },
  "attorney-general-and-advocate-general": { image: CHAPTER_IMAGE_NAMES.Briefcase },
  "union-public-service-commission-and-state-public-service-commission": { image: CHAPTER_IMAGE_NAMES.GraduationCap },
  "parliamentary-committees": { image: CHAPTER_IMAGE_NAMES.Users2 },
  "political-parties-and-anti-defection-law": { image: CHAPTER_IMAGE_NAMES.Flag },
  "official-language-and-special-provisions": { image: CHAPTER_IMAGE_NAMES.Languages },
  "union-territories-and-special-areas": { image: CHAPTER_IMAGE_NAMES.MapPin },
  "local-government": { image: CHAPTER_IMAGE_NAMES.Building },

  // ── Physics Chapters (18) ──────────────────────────────────────────────────
  "units-measurements-and-measuring-instruments": { image: CHAPTER_IMAGE_NAMES.Gauge },
  "motion": { image: CHAPTER_IMAGE_NAMES.MoveRight },
  "force-and-laws-of-motion": { image: CHAPTER_IMAGE_NAMES.Shield },
  "work-energy-and-power": { image: CHAPTER_IMAGE_NAMES.Zap },
  "gravitation": { image: CHAPTER_IMAGE_NAMES.Orbit },
  "heat-and-temperature": { image: CHAPTER_IMAGE_NAMES.Thermometer },
  "sound": { image: CHAPTER_IMAGE_NAMES.Volume2 },
  "light-reflection-and-refraction": { image: CHAPTER_IMAGE_NAMES.Sun },
  "electricity": { image: CHAPTER_IMAGE_NAMES.BatteryCharging },
  "magnetism-and-magnetic-effect-of-electric-current": { image: CHAPTER_IMAGE_NAMES.Magnet },
  "pressure-and-properties-of-fluids": { image: CHAPTER_IMAGE_NAMES.Droplets },
  "waves": { image: CHAPTER_IMAGE_NAMES.Waves },
  "human-eye-optical-instruments-and-vision": { image: CHAPTER_IMAGE_NAMES.Eye },
  "simple-machines": { image: CHAPTER_IMAGE_NAMES.Cog },
  "sources-of-energy": { image: CHAPTER_IMAGE_NAMES.Flame },
  "electronics-and-semiconductors": { image: CHAPTER_IMAGE_NAMES.Cpu },
  "atomic-and-nuclear-physics": { image: CHAPTER_IMAGE_NAMES.Atom },
  "scientific-instruments-and-important-inventions": { image: CHAPTER_IMAGE_NAMES.Microscope },

  // ── Chemistry Chapters (18) ────────────────────────────────────────────────
  "matter-and-its-properties": { image: CHAPTER_IMAGE_NAMES.Boxes },
  "atomic-structure": { image: CHAPTER_IMAGE_NAMES.Atom },
  "periodic-table": { image: CHAPTER_IMAGE_NAMES.Grid },
  "acids-bases-and-salts": { image: CHAPTER_IMAGE_NAMES.FlaskConical },
  "metals-and-non-metals": { image: CHAPTER_IMAGE_NAMES.Shield },
  "chemical-reactions-and-equations": { image: CHAPTER_IMAGE_NAMES.Sparkles },
  "carbon-and-its-compounds": { image: CHAPTER_IMAGE_NAMES.Gem },
  "elements-compounds-and-mixtures": { image: CHAPTER_IMAGE_NAMES.Layers },
  "physical-and-chemical-changes": { image: CHAPTER_IMAGE_NAMES.RefreshCw },
  "chemical-bonding-and-valency": { image: CHAPTER_IMAGE_NAMES.Link2 },
  "solutions-and-separation-techniques": { image: CHAPTER_IMAGE_NAMES.Filter },
  "oxidation-and-reduction": { image: CHAPTER_IMAGE_NAMES.Flame },
  "electrochemistry-and-electrolysis": { image: CHAPTER_IMAGE_NAMES.BatteryCharging },
  "common-chemicals-and-their-uses": { image: CHAPTER_IMAGE_NAMES.Pill },
  "fuels-and-combustion": { image: CHAPTER_IMAGE_NAMES.Flame },
  "alloys": { image: CHAPTER_IMAGE_NAMES.Coins },
  "environmental-chemistry": { image: CHAPTER_IMAGE_NAMES.Leaf },
  "chemistry-in-everyday-life": { image: CHAPTER_IMAGE_NAMES.Sparkle },

  // ── Biology Chapters (20) ──────────────────────────────────────────────────
  "human-body-systems": { image: CHAPTER_IMAGE_NAMES.Activity },
  "diseases-and-immunity": { image: CHAPTER_IMAGE_NAMES.ShieldAlert },
  "nutrition-vitamins-and-deficiency-diseases": { image: CHAPTER_IMAGE_NAMES.Apple },
  "cell": { image: CHAPTER_IMAGE_NAMES.CircleDot },
  "genetics-and-heredity": { image: CHAPTER_IMAGE_NAMES.Dna },
  "plant-physiology": { image: CHAPTER_IMAGE_NAMES.Sprout },
  "animal-tissues": { image: CHAPTER_IMAGE_NAMES.Layers },
  "plant-tissues": { image: CHAPTER_IMAGE_NAMES.TreePine },
  "classification-of-living-organisms": { image: CHAPTER_IMAGE_NAMES.Network },
  "reproduction": { image: CHAPTER_IMAGE_NAMES.Heart },
  "nervous-system": { image: CHAPTER_IMAGE_NAMES.Brain },
  "hormones-and-endocrine-system": { image: CHAPTER_IMAGE_NAMES.Droplet },
  "circulatory-and-excretory-system": { image: CHAPTER_IMAGE_NAMES.HeartPulse },
  "digestive-and-respiratory-system": { image: CHAPTER_IMAGE_NAMES.Wind },
  "plant-kingdom": { image: CHAPTER_IMAGE_NAMES.Trees },
  "animal-kingdom": { image: CHAPTER_IMAGE_NAMES.Bug },
  "ecology-and-ecosystem": { image: CHAPTER_IMAGE_NAMES.Leaf },
  "evolution": { image: CHAPTER_IMAGE_NAMES.Footprints },
  "microorganisms": { image: CHAPTER_IMAGE_NAMES.Microscope },
  "biotechnology": { image: CHAPTER_IMAGE_NAMES.Atom },

  // ── Economy Chapters (17) ──────────────────────────────────────────────────
  "basics-of-economics": { image: CHAPTER_IMAGE_NAMES.LineChart },
  "national-income": { image: CHAPTER_IMAGE_NAMES.DollarSign },
  "money-and-banking": { image: CHAPTER_IMAGE_NAMES.Building2 },
  "inflation-and-unemployment": { image: CHAPTER_IMAGE_NAMES.TrendingUp },
  "budget-and-taxation": { image: CHAPTER_IMAGE_NAMES.Receipt },
  "monetary-policy": { image: CHAPTER_IMAGE_NAMES.Scale },
  "fiscal-policy": { image: CHAPTER_IMAGE_NAMES.PieChart },
  "indian-banking-system-and-rbi": { image: CHAPTER_IMAGE_NAMES.Landmark },
  "economic-planning-in-india": { image: CHAPTER_IMAGE_NAMES.Target },
  "poverty-and-human-development": { image: CHAPTER_IMAGE_NAMES.Users },
  "agriculture-and-indian-economy": { image: CHAPTER_IMAGE_NAMES.Sprout },
  "industry-and-infrastructure": { image: CHAPTER_IMAGE_NAMES.Factory },
  "balance-of-payments-and-foreign-trade": { image: CHAPTER_IMAGE_NAMES.ArrowLeftRight },
  "financial-markets": { image: CHAPTER_IMAGE_NAMES.BarChart3 },
  "international-economic-organisations": { image: CHAPTER_IMAGE_NAMES.Globe2 },
  "government-schemes-and-economic-institutions": { image: CHAPTER_IMAGE_NAMES.Award },
  "demography-and-census": { image: CHAPTER_IMAGE_NAMES.Users2 },

  // ── Static GK Chapters (18) ────────────────────────────────────────────────
  "important-days-and-themes": { image: CHAPTER_IMAGE_NAMES.Calendar },
  "awards-and-honours": { image: CHAPTER_IMAGE_NAMES.Trophy },
  "books-and-authors": { image: CHAPTER_IMAGE_NAMES.BookOpen },
  "sports-and-tournaments": { image: CHAPTER_IMAGE_NAMES.Medal },
  "national-and-international-organisations": { image: CHAPTER_IMAGE_NAMES.Building2 },
  "art-and-culture": { image: CHAPTER_IMAGE_NAMES.Palette },
  "classical-and-folk-dances": { image: CHAPTER_IMAGE_NAMES.Sparkles },
  "music-and-musical-instruments": { image: CHAPTER_IMAGE_NAMES.Music },
  "festivals-of-india": { image: CHAPTER_IMAGE_NAMES.PartyPopper },
  "important-monuments-and-places": { image: CHAPTER_IMAGE_NAMES.Landmark },
  "firsts-largest-longest-and-superlatives": { image: CHAPTER_IMAGE_NAMES.Crown },
  "famous-personalities": { image: CHAPTER_IMAGE_NAMES.UserCheck },
  "census": { image: CHAPTER_IMAGE_NAMES.Users2 },
  "countries-capitals-and-currencies": { image: CHAPTER_IMAGE_NAMES.Coins },
  "national-symbols": { image: CHAPTER_IMAGE_NAMES.Flag },
  "important-government-institutions": { image: CHAPTER_IMAGE_NAMES.Building },
  "world-heritage-sites": { image: CHAPTER_IMAGE_NAMES.Landmark },
  "important-headquarters": { image: CHAPTER_IMAGE_NAMES.MapPin },
};

const GROUP_META: Record<string, TopicMeta> = {
  "mathematical-methods": { image: CHAPTER_IMAGE_NAMES.Sigma },
  "modern-physics": { image: CHAPTER_IMAGE_NAMES.Atom },
  "ancient-history": { image: CHAPTER_IMAGE_NAMES.Landmark },
  "medieval-history": { image: CHAPTER_IMAGE_NAMES.Castle },
  "modern-history": { image: CHAPTER_IMAGE_NAMES.Flag },
  physics: { image: CHAPTER_IMAGE_NAMES.Atom },
  chemistry: { image: CHAPTER_IMAGE_NAMES.FlaskConical },
  biology: { image: CHAPTER_IMAGE_NAMES.Dna },
  economy: { image: CHAPTER_IMAGE_NAMES.TrendingUp },
  economics: { image: CHAPTER_IMAGE_NAMES.TrendingUp },
  "static-gk": { image: CHAPTER_IMAGE_NAMES.BookOpenCheck },
  static: { image: CHAPTER_IMAGE_NAMES.BookOpenCheck },
  polity: { image: CHAPTER_IMAGE_NAMES.Scale },
  science: { image: CHAPTER_IMAGE_NAMES.Atom },
  "general-science": { image: CHAPTER_IMAGE_NAMES.Atom },
};

import { useTopicQuestionTotals } from "@/hooks/useTopicQuestionTotals";

export default function RankedTopicGroupPage({ group, subject = "general-awareness", routeBase = `/general-awareness/${group.slug}`, backHref = "/general-awareness", backLabel = "General Awareness" }: {
  group: RankedTopicGroup;
  subject?: string;
  routeBase?: string;
  backHref?: string;
  backLabel?: string;
}) {
  const { data } = useTopicQuestionTotals(subject);
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<PriorityFilter>("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterDialogRef = useRef<HTMLDialogElement>(null);
  const filterTriggerRef = useRef<HTMLButtonElement | null>(null);
  useBackLayer(filterOpen, () => setFilterOpen(false));

  useEffect(() => {
    const dialog = filterDialogRef.current;
    if (!dialog) return;
    if (!filterOpen) {
      if (dialog.open) dialog.close();
      return;
    }
    const positionDialog = () => {
      const trigger = filterTriggerRef.current;
      if (!trigger) return;
      const bounds = trigger.getBoundingClientRect();
      const top = bounds.bottom + 8;
      dialog.style.top = `${top}px`;
      dialog.style.right = `${Math.max(12, window.innerWidth - bounds.right)}px`;
      dialog.style.maxHeight = `max(44px, calc(100dvh - ${top + 12}px))`;
    };
    positionDialog();
    if (!dialog.open) dialog.showModal();
    window.addEventListener('resize', positionDialog);
    return () => window.removeEventListener('resize', positionDialog);
  }, [filterOpen]);

  useEffect(() => {
    const timer = window.setTimeout(() => setPriority("All"), 0);
    return () => window.clearTimeout(timer);
  }, [group.slug, group.filters]);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const toggleVoiceSearch = useCallback(() => {
    if (typeof window === "undefined") return;
    const speechWindow = window as SpeechRecognitionWindow;
    const SpeechRecognitionClass =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      alert("Voice search is not supported in this browser.");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: SpeechRecognitionResultEvent) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setQuery(transcript);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  }, [isListening]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const topics = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return group.topics.filter((topic) => {
      const matchesQuery =
        normalizedQuery === "" || topic.title.toLowerCase().includes(normalizedQuery);
      const matchesPriority =
        normalizedQuery !== "" || priority === "All" || topic.priority === priority;
      return matchesQuery && matchesPriority;
    });
  }, [group.topics, priority, query]);

  const filters = useMemo<readonly PriorityFilter[]>(
    () => ["All", ...group.filters],
    [group.filters]
  );

  const filterButton = (
    <button
      type="button"
      data-ui-button="state"
      data-ui-shape="icon"
      className={styles.headerFilter}
      aria-label={`Filter chapters, ${priority} selected`}
      aria-haspopup="dialog"
      aria-expanded={filterOpen}
      aria-controls="chapter-filter-dialog"
      onClick={(event) => {
        filterTriggerRef.current = event.currentTarget;
        setFilterOpen(true);
      }}
    >
      <SlidersHorizontal size={20} aria-hidden="true" />
    </button>
  );

  return (
    <div className={styles.page}>
      {/* =========================================================================
          DESKTOP VIEW (>= 768px)
          ========================================================================= */}
      <div className={styles.desktopContainer}>
        <header data-ui-chrome="header" className={styles.header}>
          <Link replace data-ui-button="secondary"
            href={backHref}
            className={styles.backButton}
            aria-label={`Back to ${backLabel}`}
          >
            <ChevronLeft size={23} strokeWidth={2.2} />
          </Link>
          <h1 className={styles.headerTitle}>{group.label}</h1>
          {group.filters.length > 0 ? filterButton : null}
        </header>

        <main className={styles.content}>
          <section className={styles.intro} aria-labelledby="ranked-topics-heading">
            <p className={styles.eyebrow}>{group.eyebrow}</p>
            <h2 id="ranked-topics-heading" className={styles.heading}>
              {group.topics.length} chapters{group.filters.length ? ", ranked" : ""}
            </h2>
            <p className={styles.description}>
              {group.description}
            </p>
          </section>

          <div className={styles.searchWrap}>
            <Search className={styles.searchIcon} size={17} aria-hidden="true" />
            <input
              className={styles.searchInput}
              type="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${group.label.toLowerCase()} chapters`}
              aria-label={`Search ${group.label} chapters`}
            />
            {query ? (
              <button data-ui-button="secondary"
                type="button"
                className={styles.clearButton}
                onClick={() => setQuery("")}
                aria-label="Clear chapter search"
              >
                <X size={15} />
              </button>
            ) : null}
          </div>

          <section className={styles.table} aria-label={`Ranked ${group.label} chapters`}>
            <div className={styles.tableHeader} aria-hidden="true">
              <span>Rank</span>
              <span>Chapter</span>
              <span>{group.filters.length ? group.metricLabel : ""}</span>
            </div>

            {topics.length > 0 ? (
              topics.map((topic) => (
                <Link
                  key={topic.slug}
                  className={styles.row}
                  href={`${routeBase}/${topic.slug}`}
                  aria-label={group.filters.length ? `Rank ${topic.rank}: ${topic.title}, ${topic.priority} ${group.metricLabel.toLowerCase()}. Open topic.` : `${topic.rank}. ${topic.title}. Open chapter.`}
                >
                  <span className={styles.rank}>{topic.rank}</span>
                  <span className={styles.chapter}>{topic.title}</span>
                  <span className={styles.weightage} hidden={!group.filters.length}>
                    <span
                      className={`${styles.weightDot} ${PRIORITY_CLASS[topic.priority]}`}
                      aria-hidden="true"
                    />
                    {topic.priority}
                  </span>
                </Link>
              ))
            ) : (
              <div className={styles.empty}>No chapters match your search.</div>
            )}
          </section>
        </main>
      </div>

      {/* =========================================================================
          MOBILE / TABLET VIEW (< 768px Handheld Devices)
          ========================================================================= */}
      <div className={`${hubStyles.mobileContainer} ${hubStyles.fixedTopicsMobile} ${hubStyles.oledMobile} ${styles.mobileLayout}`}>
        {/* Mobile Topbar */}
        <header data-ui-chrome="header" data-hub-part="mobileTopbar" className={`${hubStyles.mobileTopbar} ${styles.mobileHeader}`}>
          <Link replace
            href={backHref}
            className={`${hubStyles.mobileBackBtn} ${styles.mobileBackBtn}`}
            aria-label={`Back to ${backLabel}`}
          >
            <ArrowLeft size={18} strokeWidth={2.4} />
          </Link>
          <h1 className={`${hubStyles.mobileTopbarTitle} ${styles.mobileTopbarTitle}`}>
            {group.label} Chapters
          </h1>
          {group.filters.length > 0 ? filterButton : null}
        </header>

        <div data-hub-part="mobileBody" className={hubStyles.mobileBody}>
          {/* Mobile Search Row */}
          <div data-hub-part="mobileSearchRow" className={styles.chapterSearch}>
            <Search size={21} aria-hidden="true" />
            <input
              type="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className={styles.chapterSearchInput}
              data-custom-focus
              data-mobile-chapter-search
              enterKeyHint="search"
              placeholder={isListening ? "Listening... speak chapter" : `Search ${group.label.toLowerCase()} chapters…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={`Search ${group.label} chapters`}
            />
            <div className={styles.chapterSearchActions}>
              {query && (
                <button data-ui-button="state" data-ui-shape="icon"
                  type="button"
                  className={styles.searchAction}
                  onClick={() => setQuery("")}
                  aria-label="Clear Search"
                >
                  <X size={11} />
                </button>
              )}
              <span className={styles.searchDivider} aria-hidden="true" />
              <button data-ui-button="state" data-ui-shape="icon"
                type="button"
                className={styles.searchAction}
                aria-pressed={isListening}
                onClick={toggleVoiceSearch}
                aria-label={isListening ? "Stop voice search" : "Voice search"}
                title={isListening ? "Listening..." : "Voice search"}
              >
                <MicIcon size={16} />
              </button>
            </div>
          </div>

          {/* Flat chapter list with stable rank and unrestricted title wrapping. */}
          <div data-hub-part="mobileTopicGroup" className={styles.chapterList}>
            {topics.length === 0 ? (
              <div style={{ padding: "28px 16px", textAlign: "center", color: "var(--mac-text-secondary, #8E8E93)", fontSize: "0.9rem" }}>
                No {group.label.toLowerCase()} chapters found matching &ldquo;{query}&rdquo;
              </div>
            ) : (
              topics.map((topic) => {
                const meta = TOPIC_META[topic.slug] || GROUP_META[group.slug] || { image: CHAPTER_IMAGE_NAMES.Globe };

                return (
                  <Link
                    key={topic.slug}
                    href={`${routeBase}/${topic.slug}`}
                    data-hub-part="mobileTopicRow" className={styles.chapterRow}
                    aria-label={`${topic.rank}. ${topic.title}`}
                  >
                      <div className={styles.chapterIcon}>
                        <TopicThumbnail src={chapterImage(topic.slug, group.slug, meta.image)} size={32} />
                      </div>
                      <span className={styles.mobileRankNum} aria-hidden="true">{topic.rank}.</span>
                      <span className={styles.chapterText}>
                        <span className={styles.mobileTopicName}>{topic.title}</span>
                        <span className={styles.chapterQuestionCount}>
                          {data?.totals?.[topic.slug] ?? 0} Questions
                        </span>
                      </span>
                      <ChevronRight className={styles.chapterChevron} size={20} aria-hidden="true" />
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
      <dialog
        ref={filterDialogRef}
        id="chapter-filter-dialog"
        className={styles.filterDialog}
        aria-labelledby="chapter-filter-title"
        onCancel={(event) => { event.preventDefault(); setFilterOpen(false); }}
        onClose={() => setFilterOpen(false)}
        onPointerDown={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right ||
              event.clientY < bounds.top || event.clientY > bounds.bottom) setFilterOpen(false);
        }}
      >
        <div className={styles.filterDialogHeader}>
          <h2 id="chapter-filter-title">Filter chapters</h2>
          <button type="button" data-ui-button="icon" aria-label="Close filters" onClick={() => setFilterOpen(false)}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className={styles.filterOptions} aria-label={`Filter by ${group.metricLabel.toLowerCase()}`}>
          {filters.map((filter) => (
            <button
              key={filter}
              type="button"
              data-ui-button="state"
              className={styles.filterOption}
              aria-pressed={priority === filter}
              onClick={() => { setPriority(filter); setFilterOpen(false); }}
            >
              {filter}
              {priority === filter && <Check size={18} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </dialog>
    </div>
  );
}
