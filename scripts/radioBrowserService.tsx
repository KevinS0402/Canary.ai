import RadioBrowser from "radio-browser";

/**
 * Common filter options supported by Radio Browser
 * (subset – expand as needed)
 */
export interface StationFilter {
  by?:
    | "tag"
    | "country"
    | "state"
    | "language"
    | "name"
    | "city"
    | "topclick"
    | "topvote";
  searchterm?: string;
  limit?: number;
  offset?: number;
  order?: "name" | "votes" | "clickcount" | "bitrate";
  reverse?: boolean;
}

/**
 * Minimal station shape (expand if needed)
 */
export interface RadioStation {
  stationuuid: string;
  name: string;
  url: string;
  url_resolved: string;
  homepage: string;
  favicon: string;
  tags: string;
  country: string;
  state: string;
  city: string;
  language: string;
  votes: number;
  clickcount: number;
  bitrate: number;
}

/**
 * Service layer for Radio Browser
 */
export const radioBrowserService = {
  /**
   * Generic station search
   */
  async getStations(filter: StationFilter = {}): Promise<RadioStation[]> {
    try {
      const stations = await RadioBrowser.getStations(filter);
      return stations;
    } catch (error) {
      console.error("RadioBrowser.getStations failed", error);
      throw new Error("Failed to fetch radio stations");
    }
  },

  /**
   * Convenience method: top stations by city
   */
  async getTopStationsByCity(
    city: string,
    limit = 10,
  ): Promise<RadioStation[]> {
    return this.getStations({
      by: "city",
      searchterm: city,
      order: "clickcount",
      reverse: true,
      limit,
    });
  },

  /**
   * Convenience method: top stations by tag/genre
   */
  async getTopStationsByTag(tag: string, limit = 10): Promise<RadioStation[]> {
    return this.getStations({
      by: "tag",
      searchterm: tag,
      order: "votes",
      reverse: true,
      limit,
    });
  },

  /**
   * Extract stream URL (useful for frontend)
   */
  getStreamUrl(station: RadioStation): string {
    return station.url_resolved || station.url;
  },
};
