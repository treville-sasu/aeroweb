import XmlJS from "xml-js";

// Build with :
// Référence: DP / GT / DocServeurAeroweb
// Version du document: 9 Statut: Définitif
// Date: 07 / 11 / 2019
// Rédacteur: Sylvie Guidotti
// Mise à jour: Nadège Martin

export default class {
  constructor(key, options = {}) {
    this.key = key;
    this.url = options.url || new URL("FR/aviation/serveur_donnees.jsp", "https://aviation.meteo.fr");
    this.prefetch = options.prefetch
    this.parser = options.parser || ((data) => { return XmlJS.xml2js(data, { compact: true, ignoreDeclaration: true }); })
  }

  async OPMET(codes) {
    const data = await this.aerofetch(
      "OPMET2",
      this.prepareCodes(codes),
    );
    return data.root ? this.sanitizeStations(data.root.opmet) : [];
  }

  async SIGMET(codes) {
    const data = await this.aerofetch(
      "SIGMET2",
      this.prepareCodes(codes),
    );
    return data.root ? this.sanitizeStations(data.root.FIR) : [];
  }

  async VAA(codes) {
    const data = await this.aerofetch(
      "VAA",
      this.prepareCodes(codes),
    )
    return this.groupByMessage(data);
  }

  async VAG(codes) {
    const data = await this.aerofetch(
      "VAG",
      this.prepareCodes(codes),
    )
    return this.flattenMaps(data);
  }

  async TCA(codes) {
    const data = await this.aerofetch(
      "TCA",
      this.prepareCodes(codes),
    )
    return this.groupByMessage(data);
  }

  async TCAG(codes) {
    const data = this.aerofetch(
      "TCAG",
      this.prepareCodes(codes),
    )
    return this.flattenMaps(data);
  }

  async MAA(codes) {
    return await this.aerofetch(
      "MAA",
      this.prepareCodes(codes),
    );
  }

  async PREDEC(codes) {
    return await this.aerofetch(
      "PREDEC",
      this.prepareCodes(codes),
    );
  }

  async CARTES(zone, type, alt) {
    let params = {};
    if (!zone && !type && !alt) params.BASE_COMPLETE = "oui";
    else {
      if (zone) params.ZONE = zone;
      if (type) params.VUE_CARTE = type;
      if (alt) params.ALTITUDE = alt;
    }

    const data = await this.aerofetch("CARTES", params)
    return this.flattenMaps(data);
  }

  async DOSSIER(destination) {
    return await this.aerofetch(
      "DOSSIER",
      {
        DESTINATION: destination
      },
    );
  }

  async SW() {
    return await this.aerofetch("SW", {});
  }

  async VALIDATION(code) {
    const data = await this.aerofetch("VALIDATION", {
      CODE_METEO: code
    });
    return (data.validation.resultat == "OK" ? true : false);
  }

  async aerofetch(type, params) {
    let url = new URL(this.url);

    url.search = new URLSearchParams({
      ID: this.key,
      TYPE_DONNEES: type,
      ...params
    });
    let request = new Request(url)
    if (this.prefetch) request = this.prefetch(request)

    const response = await fetch(request)
    if (!response.ok)
      throw { code: response.status, message: response.statusText };
    else {
      const text = await response.text();
      const data = this.parser(text);
      if (data.ERREUR) return {};
      if (data.acces && data.acces.code)
        throw new Error("Aeroweb: login unknown");
      return this.sanitizeAttributes.call(this, data);
    }
  }

  prepareCodes(codes) {
    return {
      LIEUID: codes.join("|")
    }
  }

  sanitizeAttributes(data) {
    for (const property in data) {
      if (data[property]._attributes) {
        data[property] = { ...data[property], ...data[property]._attributes };
        delete data[property]._attributes;
      }
      if (data[property]._text) data[property] = data[property]._text;
      if (data[property]._cdata) data[property] = data[property]._cdata;
      if (property == "lien") data[property] = new URL(data[property], this.url);
      if (
        data[property] &&
        (typeof data[property] === "object" || Array.isArray(data[property]))
      )
        this.sanitizeAttributes(data[property]);
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
        ...this.groupBy([station.message].flat(), "type", m => m.texte)
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

  // Utility fonctions gessing constants from API aerofetch.
  extractZones(data) {
    return data.cartes.bloc_zone.map(bz => {
      return { id: bz.idz, name: bz.nom };
    });
  }

  extractMaps(data) {
    let zones = this.groupBy(data.cartes.bloc_zone, "idz", bz => bz.carte);
    for (const property in zones) {
      zones[property] = zones[property].flat();
      zones[property] = this.groupBy(zones[property], "type", c => c.niveau);
      for (const type in zones[property]) {
        zones[property][type] = [...new Set(zones[property][type])];
      }
    }
    return zones;
  }

  groupBy(xs, key, callback) {
    return xs.reduce(function (rv, x) {
      if (x) (rv[x[key]] = rv[x[key]] || []).push(callback.call(null, x));
      return rv;
    }, {});
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
