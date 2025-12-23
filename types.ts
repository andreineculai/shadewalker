export interface Coordinates {
  lat: number;
  lng: number;
}

export interface RouteStep {
  instruction: string;
  distance: string;
  duration: string;
  shadeQuality: 'sunny' | 'partial' | 'shady';
  description: string; // Why is it shady? (e.g., "Tall buildings on left", "Tree lined")
}

export interface RouteOption {
  id: string;
  name: string; // e.g., "Fastest", "Maximum Shade", "Balanced"
  summary: string;
  totalDistance: string;
  totalDuration: string;
  averageShadePercentage: number;
  shadeProfile: { timeOffset: number; shadeLevel: number }[]; // For the chart
  steps: RouteStep[];
  tags: string[];
}

export interface SearchParams {
  origin: string;
  destination: string;
  time: string; // HH:MM format
}

export enum AppState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  RESULTS = 'RESULTS',
  ERROR = 'ERROR'
}

// Re-export shade engine types for debug panel
export type { ShadeFeature, ShadeFeatureType, ShadeAnalysisDebug } from './services/shadeEngine';