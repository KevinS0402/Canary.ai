declare module "radio-browser" {
  interface StationFilter {
    by?: string;
    searchterm?: string;
    limit?: number;
    offset?: number;
    order?: string;
    reverse?: boolean;
    [key: string]: any;
  }

  interface RadioStation {
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
    [key: string]: any;
  }

  interface RadioBrowser {
    getStations(filter?: StationFilter): Promise<RadioStation[]>;
    [key: string]: any;
  }

  const RadioBrowser: RadioBrowser;
  export default RadioBrowser;
}
