# Expert onboarding — shared data model

All five POCs collect the same conceptual fields (mock localStorage in demo).

| Field | Type | When |
|-------|------|------|
| `workspaceName` | string | Pre-wizard / Express |
| `specialty` / `subSpecialty` | string | Pre-wizard |
| `practiceCountry` | PT \| ES \| BR | Pre-wizard |
| `city` | string | Pre-wizard (`city-search` step) |
| `cityGeocoded` | boolean | Set when city geocoded to map coordinates |
| `yearsInField` | number | About |
| `professionalTitle` | string | About |
| `linkedIn` | string | About (optional) |
| `meetingAddress` | string | Location |
| `meetingLatitude` / `meetingLongitude` | number \| null | Progressive map: country preset → city → address → pin |
| `sessionMode` | online \| in_person \| both | Location |
| `headline` | LocalizedString | Profile (native language + AI translate on one step) |
| `qualifications` | LocalizedString | About / Profile |
| `bio` | LocalizedString | Profile |
| `photos` / `coverPhotoIndex` | url[] / number | Photos |
| `languages` | Locale[] | Profile (EN / PT / ES cards on one step) |
| `primaryLocale` | Locale | Which language the expert writes in first (`en` \| `pt` \| `es`) |
| `eventTitle` / `eventDescription` | LocalizedString | Event (one step per field, all locales visible) |
| `eventDuration` / `eventPrice` | number | Event / Pricing |
| `telehealthAck` / `insuranceAck` | boolean \| null | Trust (yes/no steps) |
| `introOffers` | boolean \| null | Pricing |
| `nif` / `licenseScope` | string | Final gate |
| `complianceAck` / `termsAccepted` | boolean | Final gate |

`LocalizedString` = `{ en, pt, es }`

Default tier on create: **Community Expert**. Top Expert = earned (info only in UI).
