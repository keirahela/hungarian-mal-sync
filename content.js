window.addEventListener("load", myMain, false);

function myMain(evt) {
  chrome.runtime.sendMessage(
    { type: "update_anime_info" },
    function (response) {
      console.log(response);
    }
  );
}

var sites = [
  "animedrive.hu/watch/",
  "magyaranime.eu/resz/",
  "uraharashop.hu/player/",
];

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  let siteLocation = request["site"].split(".")[0];
  if (request["type"] == "get_anime_information") {
    switch (siteLocation) {
      case "animedrive":
        let siteName = document.title;

        let cutSiteName = siteName.split("ANIME | ")[1];
        cutSiteInfo = cutSiteName.split(" | ");
        cutSiteName = cutSiteInfo[0];
        episodeCount = cutSiteInfo[1];

        sendResponse({
          name: cutSiteName,
          episode: episodeCount,
        });
        return true;
        break;
      case "magyaranime":
        let masite = document.title;

        let macutSite = masite.split(" - ");
        let macutSiteName = macutSite[0];
        let macutSiteEpisode = macutSite[1];
        sendResponse({
          name: macutSiteName,
          episode: macutSiteEpisode,
        });
        return true;
        break;
      case "uraharashop":
        let _site = document.getElementsByClassName(
          "mdc-typography--headline5"
        )[0].innerHTML;

        let _cutSite = _site.split(" - ");
        let _cutSiteName = _cutSite[0];
        let _cutSiteEpisode = _cutSite[1];
        sendResponse({
          name: _cutSiteName,
          episode: _cutSiteEpisode,
        });
        return true;
        break;
      default:
        break;
    }
  }
});
