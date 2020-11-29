# aeroweb
Javascript client for Meteo France Aeroweb service.

Aeroweb is a compilation of documents and weather information dedicated to aeronautical users.
Fully asynchrone fetch requests and data "sanitization".
offer JSON content, directly from MétéoFrance Server

# Installation

`yarn add aeroweb` or `npm install aeroweb`

or in web browser
`<script src="https://cdn.jsdelivr.net/npm/aeroweb@0.9.0/dist/main.min.js"></script>`

# Usage
First of all, you'll need an api key from Meteo France. Then you'll be able to make request to the server.

the lib rely on a XML parser to work. It is shipped with `xml-js` but can be changer with the `parser` property.

Create a new instance with two argumets.
* first is the api key
* second is an option object :
  * `url` : would be the base URL of all request (could be a String or an URL).
  * `prefetch` is a function used to alter the request before fetch. if needed. It receive a request and should return a request.
  * `parser` a function wich will parse XML string and return a javascript object, it is called synchronously.

## Methods

With the API key Meteo France will give you documentation to there API, I will, only give you the liste of implemented methods.

methods are : 
`OPMET, SIGMET, VAA,  TCA, MAA, PREDEC, SW` returning bulletins (collection of messages)
`TCAG, VAG, CARTES` returning charts.
`VALIDATION, DOSSIER` user management.

Quick refernce : If you want METAR or TAF messages use `OPMET`

## Example

```js
import Aeroweb from "aeroweb";
let aero = new Aeroweb("API_KEY")

let messages = await aero.OPMET(['LFPB', 'LFPO'])
```

Will return 
```json
[
    {
        "messages": [
            "METAR LFPB 281300Z AUTO 04005KT 360V060 CAVOK 11/06 Q1016 NOSIG=",
            "TAF LFPB 281100Z 2812/2912 06008KT CAVOK BECMG 2822/2824 4000 BR NSC\nPROB30 2902/2907 0300 BCFG BKN003 BECMG 2909/2911 8000 NSW="
        ],
        "oaci": "LFPB",
        "nom": "PARIS LE BOURGET"
    },
    {
        "messages": [
            "METAR LFPO 281300Z 03006KT CAVOK 11/05 Q1016 NOSIG=",
            "TAF LFPO 281100Z 2812/2918 06005KT CAVOK BECMG 2902/2904 4000 BR\nTEMPO 2904/2910 1500 BR OVC002 PROB30 TEMPO 2904/2907 0600 FG VV///\nBECMG 2910/2912 6000 NSW BECMG 2912/2914 CAVOK="
        ],
        "oaci": "LFPO",
        "nom": "PARIS ORLY"
    }
]
```


```js
let charts = await aero.CARTES('FRANCE', 'WINTEM')
```
Will return 
```json
[
    {
        "type": "WINTEM",
        "niveau": "FL20-100",
        "zone_carte": "FRANCE",
        "date_run": "28 11 2020 12:00",
        "date_echeance": "28 11 2020 12:00",
        "echeance": "12 UTC",
        "lien": "https://aviation.meteo.fr/FR/aviation/affiche_image.php?login=eqSiua%2BSvYWBd7AK4GqbYGpnnWRhZWzd1uE%3D&layer=wintemp/fr/france/fl020&echeance=20201128120000"
    },
    {
        "type": "WINTEM",
        "niveau": "FL20-100",
        "zone_carte": "FRANCE",
        "date_run": "28 11 2020 15:00",
        "date_echeance": "28 11 2020 15:00",
        "echeance": "15 UTC",
        "lien": "https://aviation.meteo.fr/FR/aviation/affiche_image.php?login=eqSiua%2BSvYWBd7AK4GqbYGpnnWRhZWzd1uE%3D&layer=wintemp/fr/france/fl020&echeance=20201128150000"
    }
]
```

Response data, is not altered, attributes are kept with their original name, value are not casted (for now).
the only thing done, is the object structure, which is flatten, empty (as is XML NODATA) attributes are removed

For consitancy with OPMET and SIGMET, messages from VAA & TCA messages are grouped by station.

There are also some static methods wich return list of avaliable stations and options.

```js
Aeroweb.VAA
Aeroweb.VAAG
Aeroweb.TCA
Aeroweb.TCAG
Aeroweb.PREDEC
Aeroweb.CARTES
```
They are populated with data in MeteoFrance documentation.

# Frequent Issues

```
Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource at https://aviation.meteo.fr/FR/aviation/serveur_donnees.jsp?ID=API_KEY&TYPE_DONNEES=VALIDATION&CODE_METEO=SomeUser. (Reason: CORS header ‘Access-Control-Allow-Origin’ missing).
```

Aeroweb server will not set `Access-Control-Allow-Origin` header, preventing you from using it directly from browser.
You'll need some sort of Proxy, or ServiceWorker to add this header.

for exemple, using a proxy :
```js
let aero = new Aeroweb("API_KEY", {prefetch: (request) => new Request("https://cors-anywhere.herokuapp.com/" + request.url, request); })
```