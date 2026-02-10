import { radioBrowserService, StationFilter } from "./radioBrowserService";

(async () => {
  const filter: StationFilter = {
    by: "topvote", // stations by topvote
    limit: 5, // top 5 stations
  };
  const stations = await radioBrowserService.getStations(filter);
  stations.forEach((s) => {
    console.log(s.name, s.url_resolved);
  });
})();
