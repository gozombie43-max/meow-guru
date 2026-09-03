export type GeographyWeightage = "Very High" | "High" | "Medium";

export interface GeographyTopic {
  readonly rank: number;
  readonly title: string;
  readonly slug: string;
  readonly weightage: GeographyWeightage;
}

export const GEOGRAPHY_TOPICS: readonly GeographyTopic[] = [
  { rank: 1, title: "Indian Rivers & Drainage System", slug: "indian-rivers-drainage-system", weightage: "Very High" },
  { rank: 2, title: "Physiography of India", slug: "physiography-of-india", weightage: "Very High" },
  { rank: 3, title: "Soil & Agriculture", slug: "soil-agriculture", weightage: "Very High" },
  { rank: 4, title: "National Parks, Wildlife Sanctuaries, Tiger Reserves & Biosphere Reserves", slug: "national-parks-wildlife-sanctuaries-tiger-reserves-biosphere-reserves", weightage: "Very High" },
  { rank: 5, title: "Indian Climate & Monsoon", slug: "indian-climate-monsoon", weightage: "Very High" },
  { rank: 6, title: "India: Location, States, UTs, Boundaries & Neighbouring Countries", slug: "india-location-states-uts-boundaries-neighbouring-countries", weightage: "Very High" },
  { rank: 7, title: "World Map & Important Geographical Locations", slug: "world-map-important-geographical-locations", weightage: "Very High" },
  { rank: 8, title: "Solar System & Universe", slug: "solar-system-universe", weightage: "Very High" },
  { rank: 9, title: "Mountains, Plateaus, Plains, Ghats & Mountain Passes of India", slug: "mountains-plateaus-plains-ghats-mountain-passes-india", weightage: "Very High" },
  { rank: 10, title: "Atmosphere, Weather & Climate", slug: "atmosphere-weather-climate", weightage: "Very High" },
  { rank: 11, title: "Minerals & Energy Resources", slug: "minerals-energy-resources", weightage: "High" },
  { rank: 12, title: "Forests, Grasslands, Natural Vegetation & Wildlife", slug: "forests-grasslands-natural-vegetation-wildlife", weightage: "High" },
  { rank: 13, title: "Dams, Reservoirs, Lakes, Waterfalls & Wetlands", slug: "dams-reservoirs-lakes-waterfalls-wetlands", weightage: "High" },
  { rank: 14, title: "Oceanography — Oceans, Currents, Tides & Waves", slug: "oceanography-oceans-currents-tides-waves", weightage: "High" },
  { rank: 15, title: "Earth Interior, Plate Tectonics, Earthquakes & Volcanoes", slug: "earth-interior-plate-tectonics-earthquakes-volcanoes", weightage: "High" },
  { rank: 16, title: "World Physical Geography", slug: "world-physical-geography", weightage: "High" },
  { rank: 17, title: "Transport Geography — Railways, Roads, Ports & Waterways", slug: "transport-geography-railways-roads-ports-waterways", weightage: "High" },
  { rank: 18, title: "Population, Census & Human Geography", slug: "population-census-human-geography", weightage: "High" },
  { rank: 19, title: "Industries & Industrial Regions", slug: "industries-industrial-regions", weightage: "High" },
  { rank: 20, title: "Latitude, Longitude, Rotation, Revolution & Time Zones", slug: "latitude-longitude-rotation-revolution-time-zones", weightage: "High" },
  { rank: 21, title: "Seas, Gulfs, Bays, Straits, Channels & Canals", slug: "seas-gulfs-bays-straits-channels-canals", weightage: "High" },
  { rank: 22, title: "Geomorphology & Landforms", slug: "geomorphology-landforms", weightage: "Medium" },
  { rank: 23, title: "Rocks, Minerals & Rock Cycle", slug: "rocks-minerals-rock-cycle", weightage: "Medium" },
  { rank: 24, title: "Cyclones, Anticyclones & Local Winds", slug: "cyclones-anticyclones-local-winds", weightage: "Medium" },
  { rank: 25, title: "Water in the Atmosphere — Humidity, Clouds, Rainfall & Precipitation", slug: "water-atmosphere-humidity-clouds-rainfall-precipitation", weightage: "Medium" },
  { rank: 26, title: "Water Resources, Irrigation & Groundwater", slug: "water-resources-irrigation-groundwater", weightage: "Medium" },
  { rank: 27, title: "Natural Disasters & Hazards", slug: "natural-disasters-hazards", weightage: "Medium" },
  { rank: 28, title: "World Climate & Natural Vegetation", slug: "world-climate-natural-vegetation", weightage: "Medium" },
  { rank: 29, title: "Environmental Geography & Ecology", slug: "environmental-geography-ecology", weightage: "Medium" },
  { rank: 30, title: "World Human & Economic Geography", slug: "world-human-economic-geography", weightage: "Medium" },
];

export function getGeographyTopic(slug: string) {
  return GEOGRAPHY_TOPICS.find((topic) => topic.slug === slug);
}
