var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_vite = require("vite");
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json());
var DEFAULT_MAPILLARY_TOKEN = "MLY|27228156226813433|ff4d941ae45e04063527011e661063bc";
var MAPILLARY_TOKEN = process.env.MAPILLARY_CLIENT_TOKEN || process.env.MAPILLARY_TOKEN || DEFAULT_MAPILLARY_TOKEN;
app.get("/api/config", (req, res) => {
  res.json({
    mapillaryToken: MAPILLARY_TOKEN
  });
});
app.get("/api/mapillary/search", async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ error: "Par\xE2metros 'lat' e 'lng' s\xE3o obrigat\xF3rios." });
  }
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);
  const searchRadii = [5e-4, 15e-4, 3e-3, 6e-3, 0.012, 0.018];
  for (let i = 0; i < searchRadii.length; i++) {
    const offset = searchRadii[i];
    const min_lon = longitude - offset;
    const max_lon = longitude + offset;
    const min_lat = latitude - offset;
    const max_lat = latitude + offset;
    const bbox = `${min_lon},${min_lat},${max_lon},${max_lat}`;
    const url = `https://graph.mapillary.com/images?access_token=${MAPILLARY_TOKEN}&fields=id,geometry,captured_at,compass_angle&bbox=${bbox}&limit=15`;
    try {
      console.log(`[Mapillary] Pesquisando raio ${offset} para coordenadas [${latitude}, ${longitude}]`);
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Mapillary API Error] Status ${response.status}: ${errorText}`);
        if (response.status === 500 || errorText.includes("reduce the amount of data")) {
          console.warn(`[Mapillary] Densidade de dados muito alta no raio ${offset}. Pulando este raio.`);
          continue;
        }
        throw new Error(`Erro na API do Mapillary: ${response.statusText}`);
      }
      const data = await response.json();
      if (data && data.data && data.data.length > 0) {
        let closestImage = data.data[0];
        let minDistance = Infinity;
        for (const img of data.data) {
          const imgLng = img.geometry.coordinates[0];
          const imgLat = img.geometry.coordinates[1];
          const dist = Math.pow(imgLat - latitude, 2) + Math.pow(imgLng - longitude, 2);
          if (dist < minDistance) {
            minDistance = dist;
            closestImage = img;
          }
        }
        console.log(`[Mapillary] Ponto encontrado no raio ${offset}. Imagem ID: ${closestImage.id}`);
        return res.json({
          imageId: closestImage.id,
          coordinates: {
            lat: closestImage.geometry.coordinates[1],
            lng: closestImage.geometry.coordinates[0]
          },
          capturedAt: closestImage.captured_at,
          compassAngle: closestImage.compass_angle || 0
        });
      }
    } catch (error) {
      console.error("[Mapillary Search Error] Falha ao consultar o Mapillary no raio:", offset, error.message);
      if (error.message && error.message.includes("403")) {
        break;
      }
    }
  }
  console.log("[Mapillary] Nenhum ponto encontrado nas proximidades. Usando fallback de seguran\xE7a.");
  return res.json({
    imageId: "461019685608643",
    // Copacabana Rio fallback
    coordinates: { lat: -22.9711, lng: -43.1822 },
    capturedAt: 1618394800,
    compassAngle: 90,
    isFallback: true
  });
});
async function fetchAddressDetails(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=pt,en`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "GeoGuessrMapillaryApplet/2.0 (marinasheylla@gmail.com)"
      }
    });
    if (res.ok) {
      const data = await res.json();
      return data.address;
    }
  } catch (err) {
    console.error("[Nominatim Error] Falha ao geocodificar reversamente:", err);
  }
  return null;
}
async function fetchCountryDetails(countryCode) {
  try {
    const url = `https://restcountries.com/v3.1/alpha/${countryCode}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data[0];
      }
    }
  } catch (err) {
    console.error("[RestCountries Error] Falha ao buscar detalhes do pa\xEDs:", err);
  }
  return null;
}
function generateLocalHint(level, latitude, longitude) {
  const latDir = latitude >= 0 ? "Norte" : "Sul";
  const lngDir = longitude >= 0 ? "Leste" : "Oeste";
  if (level === 3) {
    return `\u{1F5FA}\uFE0F Dossi\xEA Cultural (Sutil): Este local situa-se em um territ\xF3rio na latitude ${Math.abs(latitude).toFixed(1)}\xB0 ${latDir}. O tr\xE1fego segue regras locais consolidadas e as redondezas exibem uma mistura de vegeta\xE7\xE3o e tra\xE7os arquitet\xF4nicos residenciais t\xEDpicos desta faixa clim\xE1tica do globo.`;
  } else {
    return `\u{1F6E3}\uFE0F Dossi\xEA Regional (Sutil): A paisagem urbana e vi\xE1ria ao redor reflete as caracter\xEDsticas geogr\xE1ficas na longitude ${Math.abs(longitude).toFixed(1)}\xB0 ${lngDir}. \xC9 poss\xEDvel notar detalhes de postes de servi\xE7os p\xFAblicos e asfalto com pavimenta\xE7\xE3o t\xEDpica desta zona.`;
  }
}
app.post("/api/hints/fetch", async (req, res) => {
  const { lat, lng, placeName, level } = req.body;
  if (!lat || !lng || !level) {
    return res.status(400).json({ error: "Latitude, longitude e n\xEDvel s\xE3o obrigat\xF3rios." });
  }
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);
  try {
    const address = await fetchAddressDetails(latitude, longitude);
    const rawCountry = address?.country || "Pa\xEDs Secreto";
    const countryCode = address?.country_code || "";
    const rawState = address?.state || address?.region || "";
    const rawCity = address?.city || address?.town || address?.suburb || "";
    let countryDetails = null;
    if (countryCode) {
      countryDetails = await fetchCountryDetails(countryCode);
    }
    const wordsToRedact = [rawCountry, rawState, rawCity];
    if (countryCode && countryCode.length > 1) {
      wordsToRedact.push(countryCode);
    }
    if (placeName) {
      const parts = placeName.split(/[\s,.'"-]+/);
      for (const part of parts) {
        if (part.length > 2) {
          wordsToRedact.push(part);
        }
      }
    }
    if (rawCountry.toLowerCase().includes("brasil")) {
      wordsToRedact.push("Brasil", "Brazil", "brasileiro", "brasileira", "brasileiros", "brasileiras");
    } else if (rawCountry.toLowerCase().includes("fran\xE7a") || rawCountry.toLowerCase().includes("france")) {
      wordsToRedact.push("Fran\xE7a", "France", "francesa", "franc\xEAs", "franceses", "francesas");
    } else if (rawCountry.toLowerCase().includes("estados unidos") || rawCountry.toLowerCase().includes("united states")) {
      wordsToRedact.push("Estados Unidos", "United States", "USA", "americano", "americana", "americanos", "americanas");
    } else if (rawCountry.toLowerCase().includes("jap\xE3o") || rawCountry.toLowerCase().includes("japan")) {
      wordsToRedact.push("Jap\xE3o", "Japan", "japon\xEAs", "japonesa", "japoneses", "japonesas");
    } else if (rawCountry.toLowerCase().includes("it\xE1lia") || rawCountry.toLowerCase().includes("italy")) {
      wordsToRedact.push("It\xE1lia", "Italy", "italiano", "italiana", "italianos", "italianas");
    } else if (rawCountry.toLowerCase().includes("reino unido") || rawCountry.toLowerCase().includes("united kingdom")) {
      wordsToRedact.push("Reino Unido", "United Kingdom", "UK", "brit\xE2nico", "brit\xE2nica", "brit\xE2nicos", "brit\xE2nicas");
    } else if (rawCountry.toLowerCase().includes("espanha") || rawCountry.toLowerCase().includes("spain")) {
      wordsToRedact.push("Espanha", "Spain", "espanhol", "espanhola", "espanh\xF3is", "espanholas");
    }
    let hintText = "";
    switch (level) {
      case 1: {
        const continent = countryDetails?.continents?.[0] || countryDetails?.subregion || "Territ\xF3rio Global";
        const drivingSide = countryDetails?.car?.side === "left" ? "Lado Esquerdo (M\xE3o Inglesa)" : "Lado Direito";
        const hemLat = latitude >= 0 ? "Hemisf\xE9rio Norte" : "Hemisf\xE9rio Sul";
        const hemLng = longitude >= 0 ? "Hemisf\xE9rio Oriental" : "Hemisf\xE9rio Ocidental";
        const timezone = countryDetails?.timezones?.[0] || "UTC / Vari\xE1vel";
        hintText = `\u{1F310} Continente: ${continent} | \u{1F9ED} Coordenadas: Localizado no ${hemLat} e ${hemLng} | \u{1F697} Sentido do Tr\xE2nsito: ${drivingSide} | \u{1F552} Fuso Hor\xE1rio Principal: ${timezone}`;
        break;
      }
      case 2: {
        const tld = countryDetails?.tld?.[0] || "N\xE3o listado";
        let currencyText = "N\xE3o dispon\xEDvel";
        if (countryDetails?.currencies) {
          const keys = Object.keys(countryDetails.currencies);
          if (keys.length > 0) {
            const cur = countryDetails.currencies[keys[0]];
            currencyText = `${cur.name} (${cur.symbol || keys[0]})`;
          }
        }
        let bordersText = "Nenhuma fronteira terrestre";
        if (countryDetails?.borders && countryDetails.borders.length > 0) {
          bordersText = `Faz fronteira terrestre com ${countryDetails.borders.length} outro(s) territ\xF3rio(s)`;
        }
        hintText = `\u{1F310} Dom\xEDnio de Internet Nacional: ${tld} | \u{1FA99} Moeda Corrente: ${currencyText} | \u{1F465} Fronteiras Terrestres: ${bordersText}`;
        break;
      }
      case 3: {
        hintText = generateLocalHint(3, latitude, longitude);
        break;
      }
      case 4: {
        hintText = generateLocalHint(4, latitude, longitude);
        break;
      }
      default:
        hintText = "Nenhuma pista dispon\xEDvel para este n\xEDvel.";
    }
    return res.json({
      hint: hintText,
      country: rawCountry
    });
  } catch (err) {
    console.error("[Fetch Hints Error] Erro:", err);
    return res.status(500).json({ error: "Erro interno ao extrair pistas da internet." });
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Servidor GeoGuessr Mapillary] Rodando na porta ${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
