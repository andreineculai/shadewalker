import { GoogleGenAI, Type, Schema } from "@google/genai";
import { RouteOption, Coordinates } from "../types";

// Define the schema for the Gemini response
const routeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    routes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING, description: "e.g., 'Fastest Route', 'Shady Boulevard Route'" },
          summary: { type: Type.STRING, description: "Brief overview of the path taken" },
          totalDistance: { type: Type.STRING },
          totalDuration: { type: Type.STRING },
          averageShadePercentage: { type: Type.NUMBER, description: "0-100 integer estimated average shade" },
          tags: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "Keywords like 'Tree Lined', 'Skyscrapers', 'Tunnel'" 
          },
          shadeProfile: {
            type: Type.ARRAY,
            description: "Estimated shade percentage (0-100) at 5-minute intervals of the walk",
            items: {
              type: Type.OBJECT,
              properties: {
                timeOffset: { type: Type.NUMBER, description: "Minutes from start" },
                shadeLevel: { type: Type.NUMBER, description: "0-100 shade percentage" }
              }
            }
          },
          steps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                instruction: { type: Type.STRING },
                distance: { type: Type.STRING },
                duration: { type: Type.STRING },
                shadeQuality: { type: Type.STRING, enum: ['sunny', 'partial', 'shady'] },
                description: { type: Type.STRING, description: "Reason for shade status (e.g. 'South side of tall buildings', 'Park canopy')" }
              }
            }
          }
        },
        required: ["id", "name", "summary", "totalDistance", "totalDuration", "averageShadePercentage", "shadeProfile", "steps", "tags"]
      }
    }
  }
};

export const fetchShadyRoutes = async (origin: string, destination: string, time: string): Promise<RouteOption[]> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key not found");

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
      I am planning a walking route from "${origin}" to "${destination}" starting at ${time}.
      
      Please generate 3 distinct walking route options based on real-world urban geography and typical building/tree coverage:
      1. The "Fastest" route (standard).
      2. The "Maximum Shade" route (prioritizing tree-lined streets, narrow alleys, or sides of streets with tall buildings casting shadows at ${time}).
      3. A "Balanced" route.

      For each route:
      - Estimate the shade percentage based on the time of day (${time}) and the likely sun position.
      - If it is noon, narrow streets might be sunny. If it is 4 PM, the east side of a North-South street might be shady.
      - Generate a 'shadeProfile' array representing the shade percentage every 5 minutes of the walk.
      - Provide detailed walking instructions explaining *why* a section is shady or sunny.
      
      Use your knowledge of the locations to make reasonable estimates about urban canyons, parks, and exposure.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: routeSchema,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    const data = JSON.parse(text);
    return data.routes;

  } catch (error) {
    console.error("Error fetching routes:", error);
    throw error;
  }
};

export const getPlaceSuggestions = async (query: string, location?: Coordinates): Promise<string[]> => {
  if (!query || query.length < 3) return [];
  
  const apiKey = process.env.API_KEY;
  if (!apiKey) return [];

  const ai = new GoogleGenAI({ apiKey });
  
  // Prompt optimized to trigger Google Maps search effectively
  let promptText = `Find streets, addresses, or landmarks matching "${query}"`;
  if (location) {
    promptText += ` near ${location.lat}, ${location.lng}`;
  }
  promptText += `.`;
  
  const config: any = {
    tools: [{ googleMaps: {} }],
  };

  if (location) {
    config.toolConfig = {
      retrievalConfig: {
        latLng: {
          latitude: location.lat,
          longitude: location.lng
        }
      }
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: promptText,
      config
    });

    // Strategy: Use Grounding Metadata directly from the Tool (Higher Quality / Relevance)
    // The googleMaps tool returns "chunks" containing the actual titles/places found.
    const candidates = response.candidates;
    if (candidates && candidates[0]) {
        const chunks = candidates[0].groundingMetadata?.groundingChunks;
        if (chunks && chunks.length > 0) {
            const suggestions = chunks
                .map((chunk: any) => chunk.maps?.title) // Extract title from maps chunk
                .filter((title: any): title is string => typeof title === 'string' && !!title);
            
            // Deduplicate and return
            return Array.from(new Set(suggestions)).slice(0, 5);
        }
    }

    // Fallback: Parse text if no grounding chunks (rare for map queries)
    const text = response.text || "";
    const lines = text.split('\n')
      .map(line => line.replace(/^[\d\-\.\*\s]+/, '').trim()) // Remove bullets, numbers
      .filter(line => line.length > 0 && !line.startsWith('http') && !line.toLowerCase().includes('search'));
      
    return lines.slice(0, 5);
  } catch (error) {
    console.error("Error getting suggestions:", error);
    return [];
  }
};