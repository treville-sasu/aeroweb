import XmlJS from "xml-js";

// Build with :
// Référence: DP / GT / DocServeurAeroweb
// Version du document: 9 Statut: Définitif
// Date: 07 / 11 / 2019
// Rédacteur: Sylvie Guidotti
// Mise à jour: Nadège Martin

export default class Aeroweb {
  constructor(key, options) {
    this.options = {
      baseURL: this.constructor.baseURL,
      url: this.constructor.pathname,
      login: key,
      ...options
    };
  }

  OPMET(codes, options) {
    return this.request(
      "OPMET2",
      {
        LIEUID: codes.join("|")
      },
      options
    ).then(data => {
      return data.root ? this.sanitizeStations(data.root.opmet) : [];
    });
  }
  SIGMET(codes, options) {
    return this.request(
      "SIGMET2",
      {
        LIEUID: codes.join("|")
      },
      options
    ).then(data => {
      return data.root ? this.sanitizeStations(data.root.FIR) : [];
    });
  }
  VAA(codes, options) {
    return this.request(
      "VAA",
      {
        LIEUID: codes.join("|")
      },
      options
    ).then(this.groupByMessage);
  }
  VAG(codes, options) {
    return this.request(
      "VAG",
      {
        LIEUID: codes.join("|")
      },
      options
    ).then(this.flattenMaps);
  }
  TCA(codes, options) {
    return this.request(
      "TCA",
      {
        LIEUID: codes.join("|")
      },
      options
    ).then(this.groupByMessage);
  }
  TCAG(codes, options) {
    return this.request(
      "TCAG",
      {
        LIEUID: codes.join("|")
      },
      options
    ).then(this.flattenMaps);
  }
  MAA(codes, options) {
    return this.request(
      "MAA",
      {
        LIEUID: codes.join("|")
      },
      options
    );
  }
  PREDEC(codes, options) {
    return this.request(
      "PREDEC",
      {
        LIEUID: codes.join("|")
      },
      options
    );
  }
  CARTES(zone, type, alt, options) {
    let params = {};
    if (!zone && !type && !alt) params.BASE_COMPLETE = "oui";
    else {
      if (zone) params.ZONE = zone;
      if (type) params.VUE_CARTE = type;
      if (alt) params.ALTITUDE = alt;
    }

    return this.request("CARTES", params, options).then(this.flattenMaps);
  }
  DOSSIER(destination, options) {
    return this.request(
      "DOSSIER",
      {
        DESTINATION: destination
      },
      options
    );
  }
  SW(options) {
    return this.request("SW", {}, options);
  }
  VALIDATION(code) {
    return this.request("VALIDATION", {
      CODE_METEO: code
    }).then(data => {
      console.debug(data); return (data.validation.resultat == "OK" ? true : false)
    });
  }

  request(type, params, options) {
    let url = new URL(this.options.url, this.options.baseURL);

    url.search = new URLSearchParams({
      ID: this.options.login,
      TYPE_DONNEES: type,
      ...params
    });

    if (this.options.cors_proxy) url = this.options.cors_proxy(url);

    return (
      fetch(url, options)
        .then(response => response.text())
        .then(this.parser)
        .then(data => {
          if (data.ERREUR) return {};
          if (data.acces && data.acces.code)
            throw new Error("Aeroweb: login unknown");
          return data;
        })
        .then(Aeroweb.sanitizeAttributes)
    );
  }

  parser(data) {
    return XmlJS.xml2js(data, { compact: true, ignoreDeclaration: true });
  }

  static sanitizeAttributes(data) {
    for (const property in data) {
      if (data[property]._attributes) {
        data[property] = { ...data[property], ...data[property]._attributes };
        delete data[property]._attributes;
      }
      if (data[property]._text) data[property] = data[property]._text;
      if (data[property]._cdata) data[property] = data[property]._cdata;
      if (property == "lien") data[property] = this.baseURL + data[property];
      if (
        data[property] &&
        (typeof data[property] === "object" || Array.isArray(data[property]))
      )
        Aeroweb.sanitizeAttributes(data[property]);
    }
    return data;
  }

  sanitizeStations(data) {
    return [data].flat().map(station => {
      let obj = { messages: [] };
      for (const prop in station) {
        if (["nom", "oaci"].includes(prop)) obj[prop] = station[prop];
        else if (station[prop] != "NODATA") obj.messages.push(station[prop]);
      }
      obj.messages = obj.messages.flat();
      return obj;
    });
  }

  groupByMessage(data) {
    if (!data.groupe) return data;
    return [data.groupe.messages].flat().map(function (station) {
      return {
        ...{ oaci: station.oaci, nom: station.nom },
        ...AeroWeb.groupBy([station.message].flat(), "type", m => m.texte)
      };
    });
  }

  flattenMaps(data) {
    if (!data.cartes) return data;
    return [data.cartes.bloc_zone]
      .flat()
      .flatMap(z => z.carte)
      .filter(Boolean);
  }

  // Utility fonctions gessing constants from API request.
  extractZones(data) {
    return data.cartes.bloc_zone.map(bz => {
      return { id: bz.idz, name: bz.nom };
    });
  }
  extractMaps(data) {
    let zones = AeroWeb.groupBy(data.cartes.bloc_zone, "idz", bz => bz.carte);
    for (const property in zones) {
      zones[property] = zones[property].flat();
      zones[property] = AeroWeb.groupBy(zones[property], "type", c => c.niveau);
      for (const type in zones[property]) {
        zones[property][type] = [...new Set(zones[property][type])];
      }
    }
    return zones;
  }

  static groupBy(xs, key, callback) {
    return xs.reduce(function (rv, x) {
      if (x) (rv[x[key]] = rv[x[key]] || []).push(callback.call(null, x));
      return rv;
    }, {});
  }

  // Constants used when building a request
  static get baseURL() {
    return "https://aviation.meteo.fr";
  }
  static get pathname() {
    return "FR/aviation/serveur_donnees.jsp";
  }

  static get VAA() {
    return {
      PAWU: "Anchorage",
      ADRM: "Darwin",
      EGRR: "London",
      CWAO: "Montreal",
      RJTD: "Tokyo",
      LFPW: "Toulouse",
      KNES: "Washington",
      SABM: "Buenos Aires",
      NZKL: "Wellington"
    };
  }
  static get VAG() {
    return {
      PAWU: "Anchorage",
      ADRM: "Darwin",
      EGRR: "London",
      CWAO: "Montreal",
      RJTD: "Tokyo",
      LFPW: "Toulouse",
      KNES: "Washington"
    };
  }
  static get TCA() {
    return {
      FMEE: "La Réunion",
      KNHC: "Miami",
      RJTD: "Tokyo",
      PHFO: "Honolulu",
      VIDP: "New Delhi",
      NFFN: "Nadi",
      ADRM: "Darwin"
    };
  }
  static get TCAG() {
    return {
      FMEE: "La Réunion"
    };
  }
  static get PREDEC() {
    return {
      LFPG: "CDG",
      LFPO: "Orly",
      SOCA: "Cayenne",
      TFFF: "Fort de France",
      TFFR: "Pointe à pitre",
      FMEE: "Saint Denis",
      NWWW: "Nouméa",
      NTAA: "Tahiti"
    };
  }

  static get CARTES() {
    return {
      zones: {
        AERO_FRANCE: "FRANCE",
        AERO_EUROC: "EUROC",
        AERO_EUR: "EUR",
        AERO_ANTILLES: "ANTILLES",
        AERO_ANTIL_GUY: "ANTILLES GUYANE",
        AERO_DIRAG_ATL: "ANTILLES-GUYANE-AMERIQUES",
        AERO_ATLANTIQUE: "ANTILLES-GUYANE-ATLANTIQUE",
        AERO_GUYANE: "GUYANE",
        AERO_MASCAREIG: "MASCAREIGNES",
        "AERO_DIRNC-AUSTRALIE": "NOUVELLE_CALEDONIE-AUSTRALIE",
        AERO_JAPON: "NOUVELLE_CALEDONIE-JAPON",
        AERO_MAGENTA: "NOUVELLE_CALEDONIE-MAGENTA",
        AERO_NANDI_WALLIS: "NOUVELLE_CALEDONIE-NANDI_WALLIS",
        AERO_NORFOLK: "NOUVELLE_CALEDONIE-NORFOLK",
        AERO_NOUVELLE_ZELANDE: "NOUVELLE_CALEDONIE-NOUVELLE_ZELANDE",
        AERO_SAIPAN: "NOUVELLE_CALEDONIE-SAIPAN",
        AERO_TAHITI: "NOUVELLE_CALEDONIE-TAHITI",
        AERO_WALLIS: "NOUVELLE_CALEDONIE-WALLIS",
        AERO_PAC_EST: "PACIFIQUE EST",
        AERO_PAC_OUEST: "PACIFIQUE OUEST",
        AERO_POLYNESIE: "POLYNESIE",
        "AERO_TAHITI-HAWAI-JAPON": "TAHITI-HAWAI-JAPON",
        "AERO_TAHITI-EASTER_ISLAND-CHILI": "TAHITI-EASTER_ISLAND-CHILI",
        "AERO_TAHITI-POLYNESIE-FRANCAISE": "TAHITI-POLYNESIE-FRANCAISE",
        AERO_AUSTRALIE: "AUSTRALIE",
        AERO_EURASIA: "ASIA (D)",
        AERO_ASIA_SOUTH: "ASIA SOUTH",
        AERO_MEA: "ASIA SOUTH_MID",
        AERO_EURAFI: "EURAFI C",
        AERO_EURSAM_B: "EURSAM B",
        AERO_EURSAM_B1: "EURSAM B1",
        AERO_INDOC: "INDOC E",
        AERO_MID: "MID G",
        AERO_AMERIQUES: "NAMSAM A",
        AERO_NORTH_ATL: "NAT",
        AERO_NAT: "NAT H",
        AERO_NATsecour: "NAT H Secours",
        AERO_NORTH_PAC: "NORTH PACIFIC M",
        AERO_PACIF: "PACIF I",
        AERO_PACIFIC: "PACIFIC F",
        AERO_SIO: "SIO K",
        AERO_SOUTH_POL: "SOUTH POLAR J"
      },
      types: {
        AERO_TEMSI: "Temps Significatif",
        AERO_WINTEM: "Vent & Température"
      },
      altitudes: [
        20,
        50,
        80,
        100,
        140,
        180,
        210,
        240,
        270,
        300,
        320,
        340,
        360,
        390,
        410,
        450,
        480,
        530
      ]
    };
  }
}
