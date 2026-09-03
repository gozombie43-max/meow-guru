"use client";

// Shared ranked chapter hub for Geography and the three History periods.

import Link from "next/link";
import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  ArrowLeft,
  Waves,
  Mountain,
  Sprout,
  Trees,
  CloudRain,
  MapPin,
  Globe,
  Orbit,
  MountainSnow,
  CloudSun,
  Zap,
  TreePine,
  Droplets,
  Compass,
  Flame,
  Map,
  Route,
  Users,
  Factory,
  Clock,
  Anchor,
  Layers,
  CircleDot,
  Wind,
  CloudFog,
  Droplet,
  AlertTriangle,
  SunMedium,
  Leaf,
  TrendingUp,
  Landmark,
  Castle,
  Flag,
  Atom,
  FlaskConical,
  Dna,
  BookOpenCheck,
  Scale,
  Flower2,
  Crown,
  Boxes,
  Coins,
  Palette,
  ShieldAlert,
  Globe2,
  Feather,
  Ship,
  Columns,
  Swords,
  Pickaxe,
  GraduationCap,
  Heart,
  Shield,
  Gem,
  Sparkles,
  Building2,
  Glasses,
  Award,
  FileText,
  Target,
  Lightbulb,
  Home,
  Footprints,
  Newspaper,
  Megaphone,
  ShieldCheck,
  BookOpen,
  HeartHandshake,
  PenTool,
  Scroll,
  Vote,
  UserCheck,
  Network,
  Briefcase,
  Users2,
  Languages,
  Building,
  Gauge,
  MoveRight,
  Thermometer,
  Volume2,
  Sun,
  BatteryCharging,
  Magnet,
  Eye,
  Cog,
  Cpu,
  Microscope,
  Grid,
  RefreshCw,
  Link2,
  Filter,
  Pill,
  Sparkle,
  Activity,
  Apple,
  Brain,
  HeartPulse,
  Bug,
  LineChart,
  DollarSign,
  Receipt,
  PieChart,
  ArrowLeftRight,
  BarChart3,
  Calendar,
  Trophy,
  Medal,
  Music,
  PartyPopper,
  type LucideIcon,
} from "lucide-react";
import type {
  RankedTopicGroup,
  RankedTopicPriority,
} from "@/lib/ranked-topic-groups";
import MicIcon from "@/components/MicIcon";
import hubStyles from "@/components/SubjectHub.module.css";
import styles from "./RankedTopicGroupPage.module.css";

type PriorityFilter = RankedTopicPriority;

const PRIORITY_CLASS: Record<RankedTopicPriority, string> = {
  "Very High": styles.veryHigh,
  Core: styles.veryHigh,
  High: styles.high,
  Medium: styles.medium,
  Lower: styles.lower,
};

interface TopicMeta {
  icon: LucideIcon;
  color: string;
}

const TOPIC_META: Record<string, TopicMeta> = {
  // ── Geography Chapters (30) ────────────────────────────────────────────────
  "indian-rivers-drainage-system": { icon: Waves, color: "#0284c7" },
  "physiography-of-india": { icon: Mountain, color: "#059669" },
  "soil-agriculture": { icon: Sprout, color: "#16a34a" },
  "national-parks-wildlife-sanctuaries-tiger-reserves-biosphere-reserves": { icon: Trees, color: "#15803d" },
  "indian-climate-monsoon": { icon: CloudRain, color: "#0ea5e9" },
  "india-location-states-uts-boundaries-neighbouring-countries": { icon: MapPin, color: "#f43f5e" },
  "world-map-important-geographical-locations": { icon: Globe, color: "#3b82f6" },
  "solar-system-universe": { icon: Orbit, color: "#8b5cf6" },
  "mountains-plateaus-plains-ghats-mountain-passes-india": { icon: MountainSnow, color: "#0d9488" },
  "atmosphere-weather-climate": { icon: CloudSun, color: "#f59e0b" },
  "minerals-energy-resources": { icon: Zap, color: "#f97316" },
  "forests-grasslands-natural-vegetation-wildlife": { icon: TreePine, color: "#10b981" },
  "dams-reservoirs-lakes-waterfalls-wetlands": { icon: Droplets, color: "#06b6d4" },
  "oceanography-oceans-currents-tides-waves": { icon: Compass, color: "#2563eb" },
  "earth-interior-plate-tectonics-earthquakes-volcanoes": { icon: Flame, color: "#ef4444" },
  "world-physical-geography": { icon: Map, color: "#6366f1" },
  "transport-geography-railways-roads-ports-waterways": { icon: Route, color: "#ec4899" },
  "population-census-human-geography": { icon: Users, color: "#a855f7" },
  "industries-industrial-regions": { icon: Factory, color: "#d97706" },
  "latitude-longitude-rotation-revolution-time-zones": { icon: Clock, color: "#0284c7" },
  "seas-gulfs-bays-straits-channels-canals": { icon: Anchor, color: "#0891b2" },
  "geomorphology-landforms": { icon: Layers, color: "#ca8a04" },
  "rocks-minerals-rock-cycle": { icon: CircleDot, color: "#71717a" },
  "cyclones-anticyclones-local-winds": { icon: Wind, color: "#38bdf8" },
  "water-atmosphere-humidity-clouds-rainfall-precipitation": { icon: CloudFog, color: "#64748b" },
  "water-resources-irrigation-groundwater": { icon: Droplet, color: "#0ea5e9" },
  "natural-disasters-hazards": { icon: AlertTriangle, color: "#dc2626" },
  "world-climate-natural-vegetation": { icon: SunMedium, color: "#ea580c" },
  "environmental-geography-ecology": { icon: Leaf, color: "#16a34a" },
  "world-human-economic-geography": { icon: TrendingUp, color: "#7c3aed" },

  // ── Ancient History Chapters (14) ──────────────────────────────────────────
  "jainism-buddhism": { icon: Flower2, color: "#f59e0b" },
  "mauryan-empire": { icon: Crown, color: "#3b82f6" },
  "indus-valley-civilization": { icon: Boxes, color: "#ea580c" },
  "gupta-empire": { icon: Coins, color: "#eab308" },
  "vedic-age": { icon: Flame, color: "#f97316" },
  "ancient-indian-art-architecture-literature-education-science": { icon: Palette, color: "#8b5cf6" },
  "mahajanapadas-rise-of-magadha": { icon: ShieldAlert, color: "#dc2626" },
  "post-mauryan-india": { icon: Globe2, color: "#d97706" },
  "sangam-age": { icon: Feather, color: "#0d9488" },
  "chola-empire": { icon: Ship, color: "#0284c7" },
  "post-gupta-india": { icon: Columns, color: "#059669" },
  "tripartite-struggle": { icon: Swords, color: "#e11d48" },
  "stone-age": { icon: Pickaxe, color: "#71717a" },
  "foreign-travellers-ancient-universities-texts": { icon: GraduationCap, color: "#7c3aed" },

  // ── Medieval History Chapters (10) ─────────────────────────────────────────
  "mughal-empire": { icon: Landmark, color: "#059669" },
  "delhi-sultanate": { icon: Castle, color: "#dc2626" },
  "bhakti-sufi-movements": { icon: Heart, color: "#f43f5e" },
  "marathas-shivaji": { icon: Shield, color: "#f97316" },
  "vijayanagara-bahmani-kingdoms": { icon: Gem, color: "#8b5cf6" },
  "sikh-gurus-khalsa": { icon: Sparkles, color: "#eab308" },
  "sher-shah-suri-sur-dynasty": { icon: Route, color: "#d97706" },
  "medieval-art-architecture-literature-administration": { icon: Building2, color: "#4f46e5" },
  "medieval-travellers": { icon: Compass, color: "#0891b2" },
  "regional-kingdoms": { icon: Crown, color: "#db2777" },

  // ── Modern History Chapters (19) ───────────────────────────────────────────
  "gandhian-era": { icon: Glasses, color: "#059669" },
  "indian-national-congress": { icon: Building2, color: "#2563eb" },
  "british-conquest-expansion-india": { icon: Swords, color: "#dc2626" },
  "governor-generals-viceroys": { icon: Award, color: "#475569" },
  "constitutional-development-british-acts": { icon: FileText, color: "#4f46e5" },
  "revolt-of-1857": { icon: Flame, color: "#ea580c" },
  "final-phase-freedom-struggle": { icon: Flag, color: "#f97316" },
  "revolutionary-nationalism": { icon: Target, color: "#ef4444" },
  "socio-religious-reform-movements": { icon: Lightbulb, color: "#d97706" },
  "partition-bengal-swadeshi-movement": { icon: ShieldAlert, color: "#e11d48" },
  "home-rule-movement-lucknow-pact": { icon: Home, color: "#0d9488" },
  "simon-commission-civil-disobedience-movement": { icon: Footprints, color: "#0284c7" },
  "subhas-chandra-bose-indian-national-army": { icon: Award, color: "#15803d" },
  "peasant-tribal-movements": { icon: TreePine, color: "#16a34a" },
  "advent-of-europeans": { icon: Ship, color: "#1d4ed8" },
  "british-land-revenue-economic-policies": { icon: Coins, color: "#b45309" },
  "education-press-social-legislation-british-rule": { icon: Newspaper, color: "#7c3aed" },
  "early-political-associations-nationalist-newspapers": { icon: Megaphone, color: "#0284c7" },
  "integration-princely-states-early-post-independence-india": { icon: ShieldCheck, color: "#f97316" },

  // ── Polity Chapters (28) ───────────────────────────────────────────────────
  "fundamental-rights": { icon: ShieldCheck, color: "#3b82f6" },
  "parliament": { icon: Landmark, color: "#6366f1" },
  "president-and-vice-president": { icon: Crown, color: "#f59e0b" },
  "constitutional-articles-parts-and-schedules": { icon: BookOpen, color: "#0284c7" },
  "constitutional-amendments": { icon: FileText, color: "#10b981" },
  "supreme-court-and-high-courts": { icon: Scale, color: "#8b5cf6" },
  "prime-minister-and-council-of-ministers": { icon: Users, color: "#0d9488" },
  "directive-principles-of-state-policy-dpsp-and-fundamental-duties": { icon: HeartHandshake, color: "#ec4899" },
  "making-of-the-constitution-and-constituent-assembly": { icon: PenTool, color: "#f97316" },
  "preamble": { icon: Scroll, color: "#eab308" },
  "constitutional-and-non-constitutional-bodies": { icon: Building2, color: "#059669" },
  "governor-chief-minister-and-state-council-of-ministers": { icon: Award, color: "#d97706" },
  "election-commission-and-elections": { icon: Vote, color: "#2563eb" },
  "citizenship": { icon: UserCheck, color: "#06b6d4" },
  "emergency-provisions": { icon: AlertTriangle, color: "#ef4444" },
  "salient-features-and-sources-of-the-constitution": { icon: Compass, color: "#7c3aed" },
  "centre-state-relations": { icon: Network, color: "#4f46e5" },
  "state-legislature": { icon: Columns, color: "#0891b2" },
  "panchayati-raj-and-municipalities": { icon: Home, color: "#16a34a" },
  "comptroller-and-auditor-general-cag": { icon: Search, color: "#475569" },
  "finance-commission": { icon: Coins, color: "#ca8a04" },
  "attorney-general-and-advocate-general": { icon: Briefcase, color: "#334155" },
  "union-public-service-commission-and-state-public-service-commission": { icon: GraduationCap, color: "#6d28d9" },
  "parliamentary-committees": { icon: Users2, color: "#0284c7" },
  "political-parties-and-anti-defection-law": { icon: Flag, color: "#e11d48" },
  "official-language-and-special-provisions": { icon: Languages, color: "#0d9488" },
  "union-territories-and-special-areas": { icon: MapPin, color: "#ea580c" },
  "local-government": { icon: Building, color: "#15803d" },

  // ── Physics Chapters (18) ──────────────────────────────────────────────────
  "units-measurements-and-measuring-instruments": { icon: Gauge, color: "#0284c7" },
  "motion": { icon: MoveRight, color: "#0ea5e9" },
  "force-and-laws-of-motion": { icon: Shield, color: "#2563eb" },
  "work-energy-and-power": { icon: Zap, color: "#f59e0b" },
  "gravitation": { icon: Orbit, color: "#8b5cf6" },
  "heat-and-temperature": { icon: Thermometer, color: "#ea580c" },
  "sound": { icon: Volume2, color: "#06b6d4" },
  "light-reflection-and-refraction": { icon: Sun, color: "#eab308" },
  "electricity": { icon: BatteryCharging, color: "#f97316" },
  "magnetism-and-magnetic-effect-of-electric-current": { icon: Magnet, color: "#dc2626" },
  "pressure-and-properties-of-fluids": { icon: Droplets, color: "#0284c7" },
  "waves": { icon: Waves, color: "#6366f1" },
  "human-eye-optical-instruments-and-vision": { icon: Eye, color: "#0d9488" },
  "simple-machines": { icon: Cog, color: "#475569" },
  "sources-of-energy": { icon: Flame, color: "#16a34a" },
  "electronics-and-semiconductors": { icon: Cpu, color: "#7c3aed" },
  "atomic-and-nuclear-physics": { icon: Atom, color: "#0891b2" },
  "scientific-instruments-and-important-inventions": { icon: Microscope, color: "#ec4899" },

  // ── Chemistry Chapters (18) ────────────────────────────────────────────────
  "matter-and-its-properties": { icon: Boxes, color: "#0284c7" },
  "atomic-structure": { icon: Atom, color: "#8b5cf6" },
  "periodic-table": { icon: Grid, color: "#2563eb" },
  "acids-bases-and-salts": { icon: FlaskConical, color: "#dc2626" },
  "metals-and-non-metals": { icon: Shield, color: "#ca8a04" },
  "chemical-reactions-and-equations": { icon: Sparkles, color: "#ea580c" },
  "carbon-and-its-compounds": { icon: Gem, color: "#334155" },
  "elements-compounds-and-mixtures": { icon: Layers, color: "#0d9488" },
  "physical-and-chemical-changes": { icon: RefreshCw, color: "#059669" },
  "chemical-bonding-and-valency": { icon: Link2, color: "#4f46e5" },
  "solutions-and-separation-techniques": { icon: Filter, color: "#06b6d4" },
  "oxidation-and-reduction": { icon: Flame, color: "#f59e0b" },
  "electrochemistry-and-electrolysis": { icon: BatteryCharging, color: "#f97316" },
  "common-chemicals-and-their-uses": { icon: Pill, color: "#ec4899" },
  "fuels-and-combustion": { icon: Flame, color: "#ef4444" },
  "alloys": { icon: Coins, color: "#d97706" },
  "environmental-chemistry": { icon: Leaf, color: "#16a34a" },
  "chemistry-in-everyday-life": { icon: Sparkle, color: "#7c3aed" },

  // ── Biology Chapters (20) ──────────────────────────────────────────────────
  "human-body-systems": { icon: Activity, color: "#dc2626" },
  "diseases-and-immunity": { icon: ShieldAlert, color: "#f43f5e" },
  "nutrition-vitamins-and-deficiency-diseases": { icon: Apple, color: "#16a34a" },
  "cell": { icon: CircleDot, color: "#8b5cf6" },
  "genetics-and-heredity": { icon: Dna, color: "#6366f1" },
  "plant-physiology": { icon: Sprout, color: "#10b981" },
  "animal-tissues": { icon: Layers, color: "#f59e0b" },
  "plant-tissues": { icon: TreePine, color: "#059669" },
  "classification-of-living-organisms": { icon: Network, color: "#0891b2" },
  "reproduction": { icon: Heart, color: "#ec4899" },
  "nervous-system": { icon: Brain, color: "#7c3aed" },
  "hormones-and-endocrine-system": { icon: Droplet, color: "#0284c7" },
  "circulatory-and-excretory-system": { icon: HeartPulse, color: "#e11d48" },
  "digestive-and-respiratory-system": { icon: Wind, color: "#0ea5e9" },
  "plant-kingdom": { icon: Trees, color: "#15803d" },
  "animal-kingdom": { icon: Bug, color: "#d97706" },
  "ecology-and-ecosystem": { icon: Leaf, color: "#16a34a" },
  "evolution": { icon: Footprints, color: "#b45309" },
  "microorganisms": { icon: Microscope, color: "#06b6d4" },
  "biotechnology": { icon: Atom, color: "#4f46e5" },

  // ── Economy Chapters (17) ──────────────────────────────────────────────────
  "basics-of-economics": { icon: LineChart, color: "#2563eb" },
  "national-income": { icon: DollarSign, color: "#059669" },
  "money-and-banking": { icon: Building2, color: "#3b82f6" },
  "inflation-and-unemployment": { icon: TrendingUp, color: "#dc2626" },
  "budget-and-taxation": { icon: Receipt, color: "#f59e0b" },
  "monetary-policy": { icon: Scale, color: "#7c3aed" },
  "fiscal-policy": { icon: PieChart, color: "#6366f1" },
  "indian-banking-system-and-rbi": { icon: Landmark, color: "#0284c7" },
  "economic-planning-in-india": { icon: Target, color: "#0d9488" },
  "poverty-and-human-development": { icon: Users, color: "#ec4899" },
  "agriculture-and-indian-economy": { icon: Sprout, color: "#16a34a" },
  "industry-and-infrastructure": { icon: Factory, color: "#d97706" },
  "balance-of-payments-and-foreign-trade": { icon: ArrowLeftRight, color: "#0891b2" },
  "financial-markets": { icon: BarChart3, color: "#8b5cf6" },
  "international-economic-organisations": { icon: Globe2, color: "#1d4ed8" },
  "government-schemes-and-economic-institutions": { icon: Award, color: "#f97316" },
  "demography-and-census": { icon: Users2, color: "#ea580c" },

  // ── Static GK Chapters (18) ────────────────────────────────────────────────
  "important-days-and-themes": { icon: Calendar, color: "#0284c7" },
  "awards-and-honours": { icon: Trophy, color: "#f59e0b" },
  "books-and-authors": { icon: BookOpen, color: "#8b5cf6" },
  "sports-and-tournaments": { icon: Medal, color: "#ea580c" },
  "national-and-international-organisations": { icon: Building2, color: "#2563eb" },
  "art-and-culture": { icon: Palette, color: "#ec4899" },
  "classical-and-folk-dances": { icon: Sparkles, color: "#d97706" },
  "music-and-musical-instruments": { icon: Music, color: "#7c3aed" },
  "festivals-of-india": { icon: PartyPopper, color: "#f97316" },
  "important-monuments-and-places": { icon: Landmark, color: "#059669" },
  "firsts-largest-longest-and-superlatives": { icon: Crown, color: "#eab308" },
  "famous-personalities": { icon: UserCheck, color: "#0d9488" },
  "census": { icon: Users2, color: "#0891b2" },
  "countries-capitals-and-currencies": { icon: Coins, color: "#4f46e5" },
  "national-symbols": { icon: Flag, color: "#dc2626" },
  "important-government-institutions": { icon: Building, color: "#475569" },
  "world-heritage-sites": { icon: Landmark, color: "#15803d" },
  "important-headquarters": { icon: MapPin, color: "#e11d48" },
};

const GROUP_META: Record<string, TopicMeta> = {
  "ancient-history": { icon: Landmark, color: "#d97706" },
  "medieval-history": { icon: Castle, color: "#7c3aed" },
  "modern-history": { icon: Flag, color: "#2563eb" },
  physics: { icon: Atom, color: "#0284c7" },
  chemistry: { icon: FlaskConical, color: "#0891b2" },
  biology: { icon: Dna, color: "#059669" },
  economy: { icon: TrendingUp, color: "#7c3aed" },
  economics: { icon: TrendingUp, color: "#7c3aed" },
  "static-gk": { icon: BookOpenCheck, color: "#db2777" },
  static: { icon: BookOpenCheck, color: "#db2777" },
  polity: { icon: Scale, color: "#2563eb" },
  science: { icon: Atom, color: "#0284c7" },
  "general-science": { icon: Atom, color: "#0284c7" },
};

export default function RankedTopicGroupPage({ group }: { group: RankedTopicGroup }) {
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<PriorityFilter>(group.filters[0] || "Core");

  useEffect(() => {
    setPriority(group.filters[0] || "Core");
  }, [group.slug, group.filters]);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggleVoiceSearch = useCallback(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

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

      recognition.onresult = (event: any) => {
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
        normalizedQuery !== "" || topic.priority === priority;
      return matchesQuery && matchesPriority;
    });
  }, [group.topics, priority, query]);

  const filters = useMemo<readonly PriorityFilter[]>(
    () => group.filters,
    [group.filters]
  );

  return (
    <div className={styles.page}>
      {/* =========================================================================
          DESKTOP VIEW (>= 768px)
          ========================================================================= */}
      <div className={styles.desktopContainer}>
        <header className={styles.header}>
          <Link
            href="/general-awareness"
            className={styles.backButton}
            aria-label="Back to General Awareness"
          >
            <ChevronLeft size={23} strokeWidth={2.2} />
          </Link>
          <h1 className={styles.headerTitle}>{group.label}</h1>
          <span aria-hidden="true" />
        </header>

        <main className={styles.content}>
          <section className={styles.intro} aria-labelledby="ranked-topics-heading">
            <p className={styles.eyebrow}>{group.eyebrow}</p>
            <h2 id="ranked-topics-heading" className={styles.heading}>
              {group.topics.length} chapters, ranked
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
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${group.label.toLowerCase()} chapters`}
              aria-label={`Search ${group.label} chapters`}
            />
            {query ? (
              <button
                type="button"
                className={styles.clearButton}
                onClick={() => setQuery("")}
                aria-label="Clear chapter search"
              >
                <X size={15} />
              </button>
            ) : null}
          </div>

          <nav className={styles.filters} aria-label={`Filter by ${group.metricLabel.toLowerCase()}`}>
            {filters.map((filter) => (
              <button
                key={filter}
                type="button"
                className={`${styles.filterButton} ${
                  priority === filter ? styles.filterButtonActive : ""
                }`}
                onClick={() => setPriority(filter)}
                aria-pressed={priority === filter}
              >
                {filter}
              </button>
            ))}
          </nav>

          <section className={styles.table} aria-label={`Ranked ${group.label} chapters`}>
            <div className={styles.tableHeader} aria-hidden="true">
              <span>Rank</span>
              <span>Chapter</span>
              <span>{group.metricLabel}</span>
              <span />
            </div>

            {topics.length > 0 ? (
              topics.map((topic) => (
                <Link
                  key={topic.slug}
                  className={styles.row}
                  href={`/general-awareness/${group.slug}/${topic.slug}`}
                  aria-label={`Rank ${topic.rank}: ${topic.title}, ${topic.priority} ${group.metricLabel.toLowerCase()}. Open topic.`}
                >
                  <span className={styles.rank}>{topic.rank}</span>
                  <span className={styles.chapter}>{topic.title}</span>
                  <span className={styles.weightage}>
                    <span
                      className={`${styles.weightDot} ${PRIORITY_CLASS[topic.priority]}`}
                      aria-hidden="true"
                    />
                    {topic.priority}
                  </span>
                  <ChevronRight className={styles.chevron} size={17} aria-hidden="true" />
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
      <div className={hubStyles.mobileContainer}>
        {/* Mobile Topbar */}
        <header className={hubStyles.mobileTopbar}>
          <Link
            href="/general-awareness"
            className={`${hubStyles.mobileBackBtn} ${styles.mobileBackBtn}`}
            aria-label="Back to General Awareness"
          >
            <ArrowLeft size={18} strokeWidth={2.4} />
          </Link>
          <span className={`${hubStyles.mobileTopbarTitle} ${styles.mobileTopbarTitle}`}>
            {group.label} Chapters
          </span>
          <div style={{ width: 34 }} />
        </header>

        <div className={hubStyles.mobileBody}>
          {/* Mobile Search Row */}
          <div className={hubStyles.mobileSearchRow}>
            <Search className={hubStyles.mobileSearchIcon} size={16} />
            <input
              type="text"
              className={hubStyles.mobileSearchInput}
              placeholder={isListening ? "Listening... speak chapter" : `Search ${group.label.toLowerCase()} chapters…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={`Search ${group.label} chapters`}
            />
            <div className={hubStyles.mobileSearchRightActions}>
              {query && (
                <button
                  type="button"
                  className={hubStyles.mobileSearchClearBtn}
                  onClick={() => setQuery("")}
                  aria-label="Clear Search"
                >
                  <X size={11} />
                </button>
              )}
              <span className={hubStyles.mobileSearchDivider} aria-hidden="true" />
              <button
                type="button"
                className={`${hubStyles.mobileMicBtn} ${isListening ? hubStyles.mobileMicBtnListening : ""}`}
                onClick={toggleVoiceSearch}
                aria-label={isListening ? "Stop voice search" : "Voice search"}
                title={isListening ? "Listening..." : "Voice search"}
              >
                <MicIcon size={16} />
              </button>
            </div>
          </div>

          {/* Section Title Header */}
          <div className={hubStyles.mobileTopicsTitle}>CHAPTERS</div>

          {/* iOS Grouped Card Container with Filter Header */}
          <div className={hubStyles.mobileTopicGroup}>
            {/* Weightage Tabs in Card Header */}
            <div className={hubStyles.mobileTabsScroll} role="tablist" aria-label={`Filter by ${group.metricLabel.toLowerCase()}`}>
              {filters.map((filter) => {
                const isActive = priority === filter;
                return (
                  <button
                    key={filter}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`${hubStyles.mobileTabBtn} ${isActive ? hubStyles.mobileTabActive : ""}`}
                    onClick={() => setPriority(filter)}
                  >
                    {filter}
                  </button>
                );
              })}
            </div>

            {topics.length === 0 ? (
              <div style={{ padding: "28px 16px", textAlign: "center", color: "var(--mac-text-secondary, #8E8E93)", fontSize: "0.9rem" }}>
                No {group.label.toLowerCase()} chapters found matching &ldquo;{query}&rdquo;
              </div>
            ) : (
              topics.map((topic) => {
                const meta = TOPIC_META[topic.slug] || GROUP_META[group.slug] || { icon: Globe, color: "#3b82f6" };
                const TopicIcon = meta.icon;
                return (
                  <Link
                    key={topic.slug}
                    href={`/general-awareness/${group.slug}/${topic.slug}`}
                    className={hubStyles.mobileTopicRow}
                    aria-label={`${topic.rank}. ${topic.title}`}
                  >
                    <div className={hubStyles.mobileTopicRowLeft}>
                      <div
                        className={hubStyles.mobileTopicIconBox}
                        style={{ background: meta.color }}
                      >
                        <TopicIcon size={18} strokeWidth={2.2} color="#ffffff" />
                      </div>

                      <span className={styles.mobileTopicName}>
                        <span className={styles.mobileRankNum}>{topic.rank}.</span> {topic.title}
                      </span>
                    </div>

                    <ChevronRight size={16} strokeWidth={2.4} className={hubStyles.mobileChevron} />
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
