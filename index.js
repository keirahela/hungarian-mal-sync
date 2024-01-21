function makeid(length) {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

var redirectUri = chrome.identity.getRedirectURL("provider_cb");
var redirectRe = new RegExp(redirectUri + "[#?](.*)");
var access_token = null;
var ref_token = null;
var clientId = "2abcb9ece86e2edcd8ee64ccdba9e18e";
var code_challenge = makeid(128);

var sites = [
  "animedrive.hu/watch/",
  "magyaranime.eu/resz/",
  "uraharashop.hu/player/",
];

window.addEventListener("selectstart", function (e) {
  e.preventDefault();
});

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  let currentSite = sites.find((site) => tabs[0].url.includes(site));

  if (currentSite) {
    chrome.tabs.sendMessage(
      tabs[0].id,
      { type: "get_anime_information", site: currentSite },
      function (response) {
        if (!response.name || !response.episode)
          return console.log("Nem található az anime információ");
        document.getElementById("name").innerHTML = response.name;
        document.getElementById("episode").innerHTML =
          response.episode.toLowerCase();
        validateToken(false);
      }
    );
  } else {
    document.getElementById("name").innerHTML = "Nem támogatott oldal";
    document.getElementById("episode").innerHTML = "";
  }
});

async function findAndUpdateAnimeInformation() {
  var xhr = new XMLHttpRequest();
  await xhr.open(
    "GET",
    `https://corsproxy.io/?https://api.myanimelist.net/v2/anime?q=${
      document.getElementById("name").innerHTML
    }&limit=100&fields=alternative_titles`
  );
  xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
  xhr.setRequestHeader("Accept", "application/json");
  xhr.setRequestHeader("Authorization", "Bearer " + access_token);
  xhr.onload = async function () {
    if (this.status === 200) {
      var response = JSON.parse(this.responseText);
      for (let i = 0; i < response.data.length; i++) {
        let currAnime = response.data[i].node;
        console.log(
          currAnime.title.toLowerCase() ==
            document
              .getElementById("name")
              .innerHTML.toLowerCase()
              .trimStart()
              .trimEnd()
        );
        if (
          currAnime.title.toLowerCase() ==
            document
              .getElementById("name")
              .innerHTML.toLowerCase()
              .trimStart()
              .trimEnd() ||
          currAnime.alternative_titles.en.toLowerCase() ==
            document
              .getElementById("name")
              .innerHTML.toLowerCase()
              .trimStart()
              .trimEnd() ||
          currAnime.alternative_titles.synonyms.find(
            (namep) =>
              namep.toLowerCase() ==
              document
                .getElementById("name")
                .innerHTML.toLowerCase()
                .trimStart()
                .trimEnd()
          )
        ) {
          updateAnime(currAnime.id);
          return;
        }
      }
      return new Error("Anime not found");
    } else {
      console.log("find anime info status:", this.status);
      return new Error("find anime info failed");
    }
  };
  xhr.send();
}

function launchWebAuthFlow() {
  document.getElementById("validation").innerHTML = "Bejelentkezés...";
  var options = {
    interactive: true,
    url:
      "https://myanimelist.net/v1/oauth2/authorize?" +
      "response_type=code" +
      "&client_id=" +
      clientId +
      "&code_challenge=" +
      code_challenge +
      "&state=RequestID42",
  };
  chrome.identity.launchWebAuthFlow(options, function (redirectUri) {
    console.log(
      "launchWebAuthFlow completed",
      chrome.runtime.lastError,
      redirectUri
    );

    if (chrome.runtime.lastError) {
      new Error(
        "launchWebAuthFlow login failed. Is your redirect URL (" +
          chrome.identity.getRedirectURL("provider_cb") +
          ") configured with your OAuth2 provider?"
      );
      return new Error(chrome.runtime.lastError);
    }

    var matches = redirectUri.match(redirectRe);
    if (matches && matches.length > 1) {
      document.getElementById("validation").innerHTML = "Bejelentkezés...";
      handleProviderResponse(parseRedirectFragment(matches[1]));
    } else return new Error("Invalid redirect URI");
  });
}

function parseRedirectFragment(fragment) {
  var pairs = fragment.split(/&/);
  var values = {};
  pairs.forEach(function (pair) {
    var nameval = pair.split(/=/);
    values[nameval[0]] = nameval[1];
  });
  return values;
}

function handleProviderResponse(values) {
  if (values.hasOwnProperty("access_token"))
    setAccessToken(values.access_token);
  else if (values.hasOwnProperty("code")) exchangeCodeForToken(values.code);
  else return new Error("Neither access_token nor code avialable.");
}

function setAccessToken(token, refresh_token) {
  if (!token || !refresh_token) {
    return new Error("No access_token/refresh_token value");
  }
  if (access_token === token || ref_token === refresh_token) {
    return new Error("Same access_token/refresh_token value");
  }
  access_token = token;
  ref_token = refresh_token;

  chrome.storage.local.set(
    { access_token: access_token, refresh_token: ref_token },
    function () {
      console.log("Token set");
      document.getElementById("validation").innerHTML = "Frissítés";
    }
  );
}

function updateAnime(animeId) {
  var xhr = new XMLHttpRequest();
  xhr.open(
    "PUT",
    `https://cors-anywhere.herokuapp.com/https://api.myanimelist.net/v2/anime/${animeId}/my_list_status`
  );
  xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
  xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
  xhr.setRequestHeader("Accept", "application/json");
  xhr.setRequestHeader("Authorization", "Bearer " + access_token);
  xhr.onload = function () {
    if (this.status === 200) {
      var response = JSON.parse(this.responseText);
      console.log(response);
    } else {
      console.log("update anime status:", this.status);
      return new Error("update anime failed");
    }
  };
  xhr.send(
    "num_watched_episodes=" +
      Number(document.getElementById("episode").innerHTML.split(".")[0])
  );
}

document.getElementById("validation").addEventListener("click", validateToken);

chrome.storage.local.get(["access_token", "refresh_token"], function (data) {
  if (data.access_token && data.refresh_token) {
    document.getElementById("validation").innerHTML = "Frissítés";
  } else {
    document.getElementById("validation").innerHTML = "Bejelentkezés";
  }
});

function validateToken(shouldPopupLogin = true) {
  chrome.storage.local.get(["access_token", "refresh_token"], function (data) {
    if (
      (data.access_token && data.refresh_token) ||
      (access_token && ref_token)
    ) {
      access_token = data.access_token ? data.access_token : access_token;
      ref_token = data.refresh_token ? data.refresh_token : ref_token;
      if (
        document.getElementById("name").innerHTML != "Nem támogatott oldal" ||
        document.getElementById("episode").innerHTML != ""
      ) {
        findAndUpdateAnimeInformation();
      }
    } else {
      removeTokens();
      if (shouldPopupLogin) {
        launchWebAuthFlow();
      }
    }
  });
}

function removeTokens() {
  if (!access_token || !ref_token) {
    return new Error("No access_token value");
  }
  access_token = null;
  ref_token = null;
  chrome.storage.local.remove(["access_token", "refresh_token"]);
  document.getElementById("validation").innerHTML = "Bejelentkezés";
  document.getElementById("clear").innerHTML = "Kijelentkezés";
}

function exchangeCodeForToken(code) {
  var xhr = new XMLHttpRequest();
  xhr.open(
    "POST",
    `https://corsproxy.io/?https://myanimelist.net/v1/oauth2/token`
  );
  xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
  xhr.setRequestHeader("Accept", "application/json");
  xhr.onload = function () {
    if (this.status === 200) {
      var response = JSON.parse(this.responseText);
      if (response.hasOwnProperty("access_token")) {
        setAccessToken(response.access_token, response.refresh_token);
      } else {
        return new Error("Cannot obtain access_token from code.");
      }
    } else {
      console.log("code exchange status:", this.status);
      return new Error("Code exchange failed");
    }
  };

  xhr.send(
    `client_id=${clientId}&grant_type=authorization_code&code=${code}&code_verifier=${code_challenge}`
  );
}
