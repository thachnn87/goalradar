/**
 * src/lib/wc-venues.ts
 *
 * Static data for FIFA World Cup 2026 venue pages.
 * Routes: /world-cup-2026/venues/[venue]
 */

export interface VenueTransport {
  mode: string;
  icon: string;
  description: string;
}

export interface VenueMatchInfo {
  round: string;
  matchCount: number;
  description: string;
}

export interface VenueFaq {
  q: string;
  a: string;
}

export interface WCVenue {
  slug: string;
  name: string;
  shortName: string;
  city: string;
  stateOrRegion: string;
  country: string;
  countryFlag: string;
  capacity: number;
  surfaceType: string;
  roofType: string;
  openedYear: number;
  primaryTenant: string;
  architecturalNote: string;
  metaTitle: string;
  metaDesc: string;
  intro: string;
  nearestAirport: string;
  distanceFromCity: string;
  transport: VenueTransport[];
  matchInfo: VenueMatchInfo[];
  /** Key stats shown in the summary card */
  stats: { label: string; value: string }[];
  faq: VenueFaq[];
}

// ---------------------------------------------------------------------------
// Venue data
// ---------------------------------------------------------------------------

export const WC_VENUES: Record<string, WCVenue> = {

  // ── MetLife Stadium, New Jersey ────────────────────────────────────────────
  'metlife-stadium': {
    slug: 'metlife-stadium',
    name: 'MetLife Stadium',
    shortName: 'MetLife',
    city: 'East Rutherford',
    stateOrRegion: 'New Jersey',
    country: 'United States',
    countryFlag: '🇺🇸',
    capacity: 82_500,
    surfaceType: 'Natural grass (FieldTurf hybrid for WC)',
    roofType: 'Open-air (partially covered seating)',
    openedYear: 2010,
    primaryTenant: 'New York Giants & New York Jets (NFL)',
    architecturalNote: 'The most expensive stadium ever built when it opened in 2010, costing $1.6 billion. Shared by two NFL franchises — a unique arrangement in American sports.',
    metaTitle: 'MetLife Stadium – FIFA World Cup 2026 Venue Guide | GoalRadar',
    metaDesc: 'MetLife Stadium hosts the FIFA World Cup 2026 Final on 19 July plus multiple group stage and knockout matches. Capacity 82,500. Venue guide, transport info and match schedule.',
    intro:
      'MetLife Stadium in East Rutherford, New Jersey is the crown jewel of FIFA World Cup 2026 ' +
      'and will host the tournament Final on Sunday 19 July 2026 — the most prestigious match in ' +
      'world football. Located just 8 miles west of Midtown Manhattan in the New Jersey Meadowlands, ' +
      'MetLife is the NFL\'s largest stadium by seating capacity and home to both the New York Giants ' +
      'and New York Jets. The stadium opened in 2010 at a cost of $1.6 billion, making it the most ' +
      'expensive sports venue in the world at the time. For the World Cup, the venue will be transformed ' +
      'with FIFA-compliant natural grass replacing the artificial turf, new sight lines and world-class ' +
      'broadcast infrastructure. The proximity to New York City — easily reached by NJ Transit rail ' +
      'directly from Penn Station — makes this the most accessible of all 16 World Cup venues for ' +
      'international fans. Expect enormous crowds, particularly as the tournament reaches its climax ' +
      'with the semi-finals and final. With a capacity of over 82,000 fans, the MetLife World Cup Final ' +
      'will be one of the largest-attended sporting events in modern history.',
    nearestAirport: 'Newark Liberty International (EWR) — 10 miles / John F. Kennedy International (JFK) — 25 miles',
    distanceFromCity: '8 miles west of Midtown Manhattan, New York City',
    transport: [
      { mode: 'Train', icon: '🚆', description: 'NJ Transit Meadowlands Rail Line from Penn Station, New York. Direct service with extra trains on match days. ~30 minutes from NYC. Most popular option for visitors.' },
      { mode: 'Bus', icon: '🚌', description: 'NJ Transit bus routes from Port Authority Bus Terminal and other NJ hubs. Check NJ Transit for match-day services.' },
      { mode: 'Car', icon: '🚗', description: 'MetLife Stadium Complex has extensive parking. Major routes via NJ Turnpike (I-95) exit 16W and Route 3. Expect significant traffic on match days — allow extra time.' },
      { mode: 'Rideshare', icon: '🚕', description: 'Uber and Lyft drop-off available at designated zones around the stadium. Pre-book return rides well in advance for major matches.' },
      { mode: 'From Manhattan', icon: '🗽', description: 'NJ Transit from Penn Station is by far the fastest and cheapest option from NYC. Tickets from ~$7 each way. Avoid driving into Manhattan before taking transit.' },
    ],
    matchInfo: [
      { round: 'Group Stage',         matchCount: 6,  description: 'Multiple group stage matches including high-profile fixtures' },
      { round: 'Round of 32',         matchCount: 2,  description: 'Two knockout stage first-round matches' },
      { round: 'Round of 16',         matchCount: 1,  description: 'Round of 16 match' },
      { round: 'Quarter-final',       matchCount: 1,  description: 'Quarter-final match' },
      { round: 'Semi-final',          matchCount: 1,  description: 'One semi-final match' },
      { round: 'Final',               matchCount: 1,  description: '🏆 The FIFA World Cup 2026 Final — 19 July 2026' },
    ],
    stats: [
      { label: 'Capacity',     value: '82,500' },
      { label: 'Opened',       value: '2010' },
      { label: 'Location',     value: 'East Rutherford, NJ' },
      { label: 'To NYC',       value: '8 miles' },
      { label: 'Surface',      value: 'Natural grass (WC)' },
      { label: 'WC Highlight', value: '🏆 Hosts the Final' },
    ],
    faq: [
      { q: 'Which matches are at MetLife Stadium for World Cup 2026?', a: 'MetLife Stadium hosts group stage matches, a Round of 32 game, Round of 16, Quarter-final, Semi-final, and — most importantly — the FIFA World Cup 2026 Final on 19 July 2026.' },
      { q: 'How do I get to MetLife Stadium from New York City?', a: 'Take NJ Transit Meadowlands Rail Line from Penn Station, Manhattan. Direct trains run on match days, taking approximately 30 minutes. This is the recommended and most popular option for visitors from NYC.' },
      { q: 'How to get tickets for MetLife World Cup matches?', a: 'World Cup 2026 tickets are sold exclusively through FIFA\'s official ticketing platform at FIFA.com/tickets. No third-party sellers are authorised. For the Final, demand will be extraordinary — register for ballot draws early.' },
      { q: 'What is the capacity of MetLife Stadium?', a: 'MetLife Stadium has a capacity of approximately 82,500 for NFL events. For the World Cup, FIFA may adjust configurations, but it will remain one of the largest stadiums in the tournament.' },
      { q: 'What airport should I fly into for MetLife Stadium?', a: 'Newark Liberty International (EWR) is the closest at 10 miles. JFK is 25 miles away. Both airports have direct transport links to the MetLife area. NJ Transit connects EWR directly to the stadium area.' },
      { q: 'Is MetLife Stadium open-air or covered?', a: 'MetLife Stadium is an open-air venue with a partial roof over the seating areas. The playing field is exposed to the elements. Summer matches in July may be hot — bring sunscreen, water and wear layers for evening games.' },
      { q: 'When is the World Cup 2026 Final at MetLife Stadium?', a: 'The FIFA World Cup 2026 Final is scheduled for Sunday 19 July 2026 at MetLife Stadium in East Rutherford, New Jersey. Expected kick-off at approximately 7:00 PM Eastern Time.' },
      { q: 'Where is MetLife Stadium located?', a: 'MetLife Stadium is in East Rutherford, New Jersey — in the Meadowlands Sports Complex, about 8 miles west of Midtown Manhattan. The address is 1 MetLife Stadium Dr, East Rutherford, NJ 07073.' },
    ],
  },

  // ── Estadio Azteca, Mexico City ────────────────────────────────────────────
  'azteca-stadium': {
    slug: 'azteca-stadium',
    name: 'Estadio Azteca',
    shortName: 'Azteca',
    city: 'Mexico City',
    stateOrRegion: 'Mexico City',
    country: 'Mexico',
    countryFlag: '🇲🇽',
    capacity: 87_523,
    surfaceType: 'Natural grass',
    roofType: 'Cantilevered partial roof',
    openedYear: 1966,
    primaryTenant: 'Club América (Liga MX) & Mexico national football team',
    architecturalNote: 'The only stadium to have hosted two FIFA World Cup Finals (1970 and 1986). One of the most historic sporting venues in the world, located at 2,240 m above sea level.',
    metaTitle: 'Estadio Azteca – FIFA World Cup 2026 Opening Match Venue | GoalRadar',
    metaDesc: 'Estadio Azteca in Mexico City hosts the opening match of FIFA World Cup 2026 — Mexico vs South Africa on 11 June. Capacity 87,523. Complete venue guide.',
    intro:
      'Estadio Azteca is one of the most iconic football venues in history and the proud host of ' +
      'the FIFA World Cup 2026 opening match — Mexico vs South Africa on 11 June 2026. ' +
      'This legendary stadium in the Coyoacán district of Mexico City is the only venue in the ' +
      'world to have hosted two World Cup Finals: the 1970 tournament won by Brazil (home of ' +
      'Pelé\'s greatest performances) and the 1986 Final won by Argentina (featuring Diego Maradona\'s ' +
      '"Hand of God" and "Goal of the Century" against England in the quarter-final). ' +
      'Built in 1966 and renovated for the 2026 tournament, the Azteca seats over 87,500 fans ' +
      'and sits at 2,240 metres above sea level — a significant altitude factor that teams must ' +
      'account for when playing at this venue. The distinctive cantilevered partial roof and ' +
      'the thunderous atmosphere generated by Mexico\'s passionate Azteca faithful make this ' +
      'one of the most special stages in world sport. For the opening ceremony and match, ' +
      'expect a colour-saturated, noise-filled event that will capture the imagination of ' +
      'billions of football fans worldwide.',
    nearestAirport: 'Mexico City International Airport (MEX) — 15 km away',
    distanceFromCity: 'Located in the Coyoacán district of southern Mexico City, approximately 12 km from the city centre',
    transport: [
      { mode: 'Metro', icon: '🚇', description: 'Mexico City Metro Line 2 to Tasqueña, then Tren Ligero to Estadio Azteca station. Cheap and reliable — the recommended option for match days.' },
      { mode: 'Bus (Metrobús)', icon: '🚌', description: 'Mexico City Metrobús lines serve the area. Line 4 stops near the stadium. A cost-effective option for visitors staying in central areas.' },
      { mode: 'Taxi / Rideshare', icon: '🚕', description: 'Uber and Cabify operate extensively in Mexico City. Book in advance for match days. Avoid unlicensed taxis — use only app-based services.' },
      { mode: 'Car', icon: '🚗', description: 'Limited parking available around the stadium. The Periferico and Calzada de Tlalpan are the main access roads. Traffic is notoriously heavy — allow 2+ hours before kick-off.' },
    ],
    matchInfo: [
      { round: 'Opening Match', matchCount: 1, description: '🎉 Mexico vs South Africa — Opening Ceremony & Match, 11 June 2026' },
      { round: 'Group Stage',   matchCount: 5, description: 'Additional group stage fixtures at this iconic venue' },
      { round: 'Round of 32',  matchCount: 1, description: 'Knockout round match' },
    ],
    stats: [
      { label: 'Capacity',     value: '87,523' },
      { label: 'Opened',       value: '1966' },
      { label: 'Altitude',     value: '2,240 m' },
      { label: 'Location',     value: 'Mexico City, MX' },
      { label: 'WC Finals',    value: '1970 & 1986' },
      { label: 'WC Highlight', value: '🎉 Opening Match' },
    ],
    faq: [
      { q: 'What is the opening match of World Cup 2026?', a: 'The opening match of FIFA World Cup 2026 is Mexico vs South Africa at Estadio Azteca in Mexico City on Thursday 11 June 2026. An opening ceremony will precede kick-off.' },
      { q: 'How many World Cup Finals has Azteca Stadium hosted?', a: 'Estadio Azteca is the only stadium in the world to have hosted two FIFA World Cup Finals: 1970 (Brazil 4–1 Italy) and 1986 (Argentina 3–2 West Germany). It is also famous for Maradona\'s Hand of God and Goal of the Century in 1986.' },
      { q: 'What is the altitude of Estadio Azteca?', a: 'Estadio Azteca sits at 2,240 metres (7,349 feet) above sea level. This high altitude significantly reduces oxygen availability, affecting player fitness. Teams typically acclimatise before playing at altitude.' },
      { q: 'How do I get to Estadio Azteca by metro?', a: 'Take Mexico City Metro Line 2 to Tasqueña station, then transfer to the Tren Ligero light rail southbound to the Estadio Azteca stop. This is the cheapest and most reliable match-day transport option.' },
      { q: 'What is the capacity of Estadio Azteca?', a: 'Estadio Azteca has a capacity of approximately 87,523, making it one of the largest football venues in the world. FIFA may adjust configurations for World Cup matches.' },
      { q: 'How to get tickets for Azteca World Cup matches?', a: 'All World Cup 2026 tickets are sold through FIFA\'s official ticketing platform at FIFA.com/tickets. For the opening match, demand will be at its peak — register for ticket ballots as early as possible.' },
      { q: 'What city is Estadio Azteca in?', a: 'Estadio Azteca is in the Coyoacán district of Mexico City, Mexico\'s capital. It is approximately 12 km from the historic city centre and 15 km from Mexico City International Airport (MEX).' },
      { q: 'Is Estadio Azteca covered?', a: 'Estadio Azteca has a cantilevered partial roof that covers the seating areas but the pitch is open to the sky. The roof provides significant shade for spectators. Mexico City in June typically has warm days with possible afternoon showers.' },
    ],
  },

  // ── AT&T Stadium, Dallas (Arlington TX) ─────────────────────────────────────
  dallas: {
    slug: 'dallas',
    name: 'AT&T Stadium',
    shortName: 'AT&T Stadium',
    city: 'Arlington',
    stateOrRegion: 'Texas',
    country: 'United States',
    countryFlag: '🇺🇸',
    capacity: 80_000,
    surfaceType: 'Natural grass (FieldTurf hybrid for WC)',
    roofType: 'Retractable roof',
    openedYear: 2009,
    primaryTenant: 'Dallas Cowboys (NFL)',
    architecturalNote: 'Home of the Dallas Cowboys, nicknamed "Jerry World" for owner Jerry Jones who championed the stadium\'s design. Features the world\'s largest column-free interior and the largest HD video screen ever installed in a sports venue when it opened.',
    metaTitle: 'AT&T Stadium Dallas – FIFA World Cup 2026 Venue Guide | GoalRadar',
    metaDesc: 'AT&T Stadium in Arlington (Dallas area) hosts FIFA World Cup 2026 group stage and knockout matches. Capacity 80,000. Retractable roof. Transport and match guide.',
    intro:
      'AT&T Stadium in Arlington, Texas — home of the Dallas Cowboys and universally known as ' +
      '"Jerry World" — brings a distinctly Texan grandeur to the FIFA World Cup 2026. ' +
      'Opened in 2009 and situated between Dallas and Fort Worth in the Dallas–Fort Worth ' +
      'metroplex, the stadium seats approximately 80,000 fans and features a fully retractable ' +
      'roof, ensuring matches can proceed regardless of Texas weather — including the intense ' +
      'summer heat and occasional thunderstorms that characterise North Texas in June. ' +
      'The stadium is famous for its architectural scale: it holds the world\'s record for ' +
      'the largest column-free interior and debuted the largest video screen in any sports ' +
      'venue when it opened. The Dallas–Fort Worth area is one of the fastest-growing metro ' +
      'regions in the USA and has a huge football fan base. For World Cup 2026, the stadium ' +
      'will host multiple group stage matches as well as knockout-round fixtures, drawing ' +
      'international fans to the heart of the American South. The city of Arlington is ' +
      'conveniently located between Dallas and Fort Worth, well-served by road though ' +
      'fans without a car are advised to use rideshare from nearby transit hubs.',
    nearestAirport: 'Dallas/Fort Worth International Airport (DFW) — 12 miles / Dallas Love Field (DAL) — 20 miles',
    distanceFromCity: 'Located in Arlington, TX — midway between Dallas (20 miles) and Fort Worth (15 miles)',
    transport: [
      { mode: 'Car / Rideshare', icon: '🚗', description: 'Most visitors drive or rideshare. Major routes via I-30 and Highway 360. Ample stadium parking available — purchase in advance. Heavy traffic on match days — arrive 2 hours early.' },
      { mode: 'DFW Airport Shuttle', icon: '✈️', description: 'No direct transit from DFW to the stadium. Take DART or Trinity Metro to central Arlington, then rideshare. Alternatively, rent a car at DFW for the most convenient option.' },
      { mode: 'From Dallas', icon: '🏙️', description: 'DART rail to CentrePort/DFW, then Trinity Metro Zip Rail or rideshare to the stadium. Journey time ~45–60 minutes from downtown Dallas. Check Trinity Metro schedules on match days.' },
      { mode: 'From Fort Worth', icon: '🤠', description: 'Trinity Metro TEXRail to CentrePort, then rideshare. Or drive east on I-30 to the stadium. Fort Worth visitors may prefer driving given the short distance.' },
    ],
    matchInfo: [
      { round: 'Group Stage',  matchCount: 6, description: 'Group stage fixtures including high-profile international matchups' },
      { round: 'Round of 32', matchCount: 2, description: 'Two knockout stage matches' },
      { round: 'Round of 16', matchCount: 1, description: 'Round of 16 match' },
    ],
    stats: [
      { label: 'Capacity',   value: '80,000' },
      { label: 'Opened',     value: '2009' },
      { label: 'Location',   value: 'Arlington, TX' },
      { label: 'Roof',       value: 'Retractable' },
      { label: 'To Dallas',  value: '20 miles' },
      { label: 'NFL Team',   value: 'Dallas Cowboys' },
    ],
    faq: [
      { q: 'Where is the World Cup 2026 Dallas venue?', a: 'The Dallas World Cup venue is AT&T Stadium in Arlington, Texas — located midway between Dallas and Fort Worth, approximately 20 miles from downtown Dallas. Address: 1 AT&T Way, Arlington, TX 76011.' },
      { q: 'What is the capacity of AT&T Stadium for World Cup 2026?', a: 'AT&T Stadium has a standard capacity of approximately 80,000, expandable to over 100,000 for major events. For World Cup group stage and knockout matches, FIFA configurations will apply.' },
      { q: 'Does AT&T Stadium have a roof for the World Cup?', a: 'Yes. AT&T Stadium has a retractable roof that can be fully closed, providing complete weather protection from Texas heat and storms. For World Cup matches, the roof will likely be closed to ensure optimal playing and spectator conditions.' },
      { q: 'How to get to AT&T Stadium for World Cup 2026?', a: 'Most fans will drive or rideshare to AT&T Stadium. From Dallas, DART rail to CentrePort then Trinity Metro connection. From DFW Airport, TEXRail to CentrePort then rideshare. No direct rail service to the stadium — rideshare is recommended for car-free visitors.' },
      { q: 'What airport is closest to AT&T Stadium Dallas?', a: 'Dallas/Fort Worth International Airport (DFW) is 12 miles away. Dallas Love Field (DAL) is approximately 20 miles. DFW is the major international hub with the most flight connections.' },
      { q: 'How hot is it in Dallas in June?', a: 'Arlington, Texas in June typically sees high temperatures of 32–38°C (90–100°F) with high humidity. AT&T Stadium\'s retractable roof will be closed for most matches to maintain comfortable indoor conditions.' },
      { q: 'Which matches will be at AT&T Stadium Dallas for World Cup 2026?', a: 'AT&T Stadium hosts group stage matches and knockout round games including a Round of 32 and Round of 16 match. The full schedule is published on FIFA.com. Texas-area fans should expect several high-profile international fixtures.' },
      { q: 'How many World Cups has Dallas hosted?', a: 'This is Dallas\'s first FIFA World Cup. However, the region has a long history of major international events — AT&T Stadium has hosted Super Bowls, College Football Playoffs and major concerts. The 1994 World Cup was held at the Cotton Bowl in Dallas (Fair Park).' },
    ],
  },

  // ── Hard Rock Stadium, Miami ───────────────────────────────────────────────
  miami: {
    slug: 'miami',
    name: 'Hard Rock Stadium',
    shortName: 'Hard Rock',
    city: 'Miami Gardens',
    stateOrRegion: 'Florida',
    country: 'United States',
    countryFlag: '🇺🇸',
    capacity: 65_326,
    surfaceType: 'Natural grass (Bermuda hybrid)',
    roofType: 'Canopy roof (open sides)',
    openedYear: 1987,
    primaryTenant: 'Miami Dolphins (NFL) & Miami Hurricanes (NCAA)',
    architecturalNote: 'Received a $550 million renovation completed in 2016, adding a distinctive canopy roof for shade and atmosphere. Has also hosted multiple Super Bowls, the 2020 CFP National Championship and the Miami Grand Prix Formula 1 race.',
    metaTitle: 'Hard Rock Stadium Miami – FIFA World Cup 2026 Venue Guide | GoalRadar',
    metaDesc: 'Hard Rock Stadium in Miami Gardens hosts FIFA World Cup 2026 group stage and knockout matches. Capacity 65,326. Complete Miami venue guide with transport and match information.',
    intro:
      'Hard Rock Stadium in Miami Gardens, Florida brings the unique energy of Miami — ' +
      'one of the world\'s most culturally diverse and football-passionate cities — to ' +
      'the FIFA World Cup 2026 stage. Home of the Miami Dolphins NFL franchise, ' +
      'the venue underwent a transformative $550 million renovation in 2016 that added ' +
      'a signature canopy roof covering all seating areas while keeping the sides open ' +
      'for Miami\'s tropical breezes. The stadium has hosted multiple Super Bowls and ' +
      'is now also the home of the Formula 1 Miami Grand Prix, cementing its reputation ' +
      'as one of America\'s elite multi-purpose sports venues. Miami Gardens is a suburb ' +
      'just north of Miami city centre, easily accessible by car or rideshare. ' +
      'The city of Miami has one of the USA\'s largest Latin American populations, ' +
      'meaning World Cup matches in this city will draw passionate, knowledgeable ' +
      'crowds — particularly for matches involving South American and Central American ' +
      'nations. The Miami tropical climate in June means warm evenings and potential ' +
      'afternoon thunderstorms — the canopy roof provides crucial shade and rain ' +
      'protection for spectators without fully enclosing the venue.',
    nearestAirport: 'Miami International Airport (MIA) — 10 miles / Fort Lauderdale-Hollywood International (FLL) — 25 miles',
    distanceFromCity: 'Miami Gardens — approximately 14 miles north of downtown Miami',
    transport: [
      { mode: 'Metrorail + Bus', icon: '🚆', description: 'Take Miami-Dade Metrorail to Opa-locka station, then a connecting bus or rideshare to the stadium. Metrorail runs from Brickell and downtown Miami.' },
      { mode: 'Car / Rideshare', icon: '🚗', description: 'Most visitors drive or use Uber/Lyft. Access via Florida Turnpike, I-95 and NW 199th Street. Extensive parking on site. Arrive 90 minutes early for major matches.' },
      { mode: 'From Miami Beach', icon: '🏖️', description: 'No direct transit from South Beach. Take Uber/Lyft (45–60 min) or drive. Limited weekend Metrobus options available from central Miami.' },
      { mode: 'From MIA Airport', icon: '✈️', description: 'Rideshare from Miami International Airport takes approximately 20–25 minutes. No direct transit connection — rideshare is the most convenient option from the airport.' },
    ],
    matchInfo: [
      { round: 'Group Stage',  matchCount: 5, description: 'Multiple group stage fixtures featuring diverse international teams' },
      { round: 'Round of 32', matchCount: 2, description: 'Two knockout stage matches' },
      { round: 'Round of 16', matchCount: 1, description: 'Round of 16 match' },
    ],
    stats: [
      { label: 'Capacity',       value: '65,326' },
      { label: 'Opened',         value: '1987' },
      { label: 'Renovated',      value: '2016 ($550M)' },
      { label: 'Location',       value: 'Miami Gardens, FL' },
      { label: 'Roof',           value: 'Canopy (shade)' },
      { label: 'Also hosts',     value: 'F1 Miami GP' },
    ],
    faq: [
      { q: 'Where is the World Cup 2026 Miami venue?', a: 'The Miami World Cup venue is Hard Rock Stadium in Miami Gardens, Florida — located about 14 miles north of downtown Miami. Address: 347 Don Shula Dr, Miami Gardens, FL 33056.' },
      { q: 'What matches will be played in Miami at World Cup 2026?', a: 'Hard Rock Stadium hosts group stage matches and knockout games including Round of 32 and Round of 16 fixtures. Miami\'s huge Latin American population means strong demand for matches involving South American teams.' },
      { q: 'Does Hard Rock Stadium have a roof?', a: 'Hard Rock Stadium has a canopy roof over all seating areas following the 2016 renovation. The sides are open, allowing tropical breezes while protecting fans from sun and rain. The pitch is exposed to the elements.' },
      { q: 'How to get to Hard Rock Stadium for World Cup 2026?', a: 'Most fans drive or rideshare. From Miami, Metrorail to Opa-locka then a connecting bus or rideshare to the stadium. Rideshare from downtown Miami takes 25–35 minutes in normal traffic.' },
      { q: 'What is the capacity of Hard Rock Stadium?', a: 'Hard Rock Stadium has a capacity of approximately 65,326 for NFL events. FIFA configurations for World Cup matches may adjust this figure slightly.' },
      { q: 'What airport is closest to Hard Rock Stadium Miami?', a: 'Miami International Airport (MIA) is approximately 10 miles away — about 20–25 minutes by rideshare. Fort Lauderdale-Hollywood International (FLL) is 25 miles north.' },
      { q: 'What is the weather like in Miami for World Cup 2026 in June?', a: 'Miami in June is tropical: temperatures of 30–34°C (86–94°F) with high humidity and frequent afternoon thunderstorms. The canopy roof provides shade and rain protection. Evening matches will be more comfortable than afternoon games.' },
      { q: 'Has Hard Rock Stadium hosted other major sporting events?', a: 'Yes. Hard Rock Stadium has hosted multiple Super Bowls, the 2020 College Football Playoff National Championship and, since 2022, the Formula 1 Miami Grand Prix. It is one of the USA\'s most versatile major venues.' },
    ],
  },

  // ── SoFi Stadium, Los Angeles (Inglewood CA) ─────────────────────────────────
  'los-angeles': {
    slug: 'los-angeles',
    name: 'SoFi Stadium',
    shortName: 'SoFi Stadium',
    city: 'Inglewood',
    stateOrRegion: 'California',
    country: 'United States',
    countryFlag: '🇺🇸',
    capacity: 70_240,
    surfaceType: 'Natural grass (installed for WC)',
    roofType: 'Translucent roof (fully enclosed)',
    openedYear: 2020,
    primaryTenant: 'Los Angeles Rams & Los Angeles Chargers (NFL)',
    architecturalNote: 'The most expensive stadium ever built globally at $5.5 billion (2020). Features a translucent ethylene tetrafluoroethylene (ETFE) roof that allows natural light while providing full weather protection. Also hosts Super Bowl LXI in 2027.',
    metaTitle: 'SoFi Stadium Los Angeles – FIFA World Cup 2026 Venue Guide | GoalRadar',
    metaDesc: 'SoFi Stadium in Inglewood (Los Angeles) hosts FIFA World Cup 2026 group stage and knockout matches. Capacity 70,240. Fully roofed. Complete LA venue guide.',
    intro:
      'SoFi Stadium in Inglewood, California is the most technologically advanced and expensive ' +
      'sports venue ever constructed, having opened in 2020 at a cost of $5.5 billion. ' +
      'The home of both the Los Angeles Rams and Los Angeles Chargers NFL franchises, ' +
      'SoFi Stadium brings a futuristic aesthetic to the FIFA World Cup 2026 — with its ' +
      'distinctive translucent ETFE roof providing full weather protection while allowing ' +
      'natural daylight to flood the interior. The stadium is located in Inglewood, ' +
      'immediately adjacent to the future Clippers Arena and a short distance from ' +
      'Los Angeles International Airport. Los Angeles is one of the world\'s great ' +
      'football cities — with MLS\'s LA Galaxy and LAFC drawing passionate crowds — ' +
      'and the large Hispanic population in the greater LA area ensures electrifying ' +
      'atmospheres for Central and South American fixtures. With the 2028 Los Angeles ' +
      'Olympics and Super Bowl LXI also scheduled at this venue, SoFi Stadium is at ' +
      'the centre of a golden era of mega-events for the city.',
    nearestAirport: 'Los Angeles International Airport (LAX) — 3 miles',
    distanceFromCity: 'Inglewood, CA — 12 miles southwest of downtown Los Angeles, 3 miles from LAX',
    transport: [
      { mode: 'Metro (K Line)', icon: '🚇', description: 'Los Angeles Metro K Line (Crenshaw/LAX Line) has a Westchester/Veterans station adjacent to SoFi Stadium complex. Direct connection from Expo/Crenshaw and LAX Metro connections.' },
      { mode: 'From LAX Airport', icon: '✈️', description: 'The LAX Automated People Mover (when complete) connects to Metro K Line. Alternatively, rideshare from LAX takes 10–15 minutes. Walk-able distance from some terminal areas.' },
      { mode: 'Car / Rideshare', icon: '🚗', description: 'Via I-405, I-110 or La Cienega Blvd. Extensive parking at SoFi Stadium Campus. Traffic on LA freeways is significant — allow 2 hours from central LA on match days.' },
      { mode: 'From Downtown LA', icon: '🌆', description: 'Metro E Line (Expo Line) to Crenshaw, transfer to K Line to Westchester/Veterans. Or rideshare — approximately 20–30 minutes from DTLA in normal traffic.' },
    ],
    matchInfo: [
      { round: 'Group Stage',   matchCount: 6, description: 'Group stage fixtures with strong demand from LA\'s huge international fan base' },
      { round: 'Round of 32',  matchCount: 2, description: 'Two knockout stage matches' },
      { round: 'Quarter-final', matchCount: 1, description: 'Quarter-final match' },
    ],
    stats: [
      { label: 'Capacity',   value: '70,240' },
      { label: 'Opened',     value: '2020' },
      { label: 'Cost',       value: '$5.5 billion' },
      { label: 'Location',   value: 'Inglewood, CA' },
      { label: 'Roof',       value: 'Translucent (enclosed)' },
      { label: 'To LAX',     value: '3 miles' },
    ],
    faq: [
      { q: 'Where is the World Cup 2026 Los Angeles venue?', a: 'The Los Angeles World Cup venue is SoFi Stadium in Inglewood, California — 3 miles from Los Angeles International Airport (LAX) and 12 miles southwest of downtown LA. Address: 1001 Stadium Dr, Inglewood, CA 90301.' },
      { q: 'What matches are at SoFi Stadium for World Cup 2026?', a: 'SoFi Stadium hosts group stage matches, two Round of 32 games and a Quarter-final. Los Angeles\'s vast international community, particularly Latin American fans, will create exceptional atmospheres.' },
      { q: 'Is SoFi Stadium roofed?', a: 'Yes. SoFi Stadium is fully enclosed with a translucent ETFE roof that allows natural light while providing complete weather protection. The stadium is climate-controlled, making LA summer heat a non-issue for spectators.' },
      { q: 'How do I get to SoFi Stadium by train?', a: 'Take the Los Angeles Metro K Line (Crenshaw/LAX Line) to Westchester/Veterans station, which is adjacent to the SoFi Stadium campus. From downtown LA, take the E Line to Crenshaw then transfer to the K Line.' },
      { q: 'How close is SoFi Stadium to LAX airport?', a: 'SoFi Stadium is approximately 3 miles from Los Angeles International Airport. A rideshare takes 10–15 minutes. When the LAX Metro connection is fully operational, it will be easily walkable from the terminal area.' },
      { q: 'What is the capacity of SoFi Stadium?', a: 'SoFi Stadium has a capacity of 70,240. With temporary expansions for major events, it can hold up to 100,000 — but for World Cup group stage matches, the standard FIFA-configured capacity will apply.' },
      { q: 'How much did SoFi Stadium cost to build?', a: 'SoFi Stadium cost approximately $5.5 billion to build, making it the most expensive sports venue ever constructed in the world. It opened in July 2020 after a two-year pandemic-related delay to its first events.' },
      { q: 'What other major events is SoFi Stadium hosting?', a: 'In addition to World Cup 2026, SoFi Stadium will host Super Bowl LXI (2027) and serve as a venue for the 2028 Los Angeles Olympics. It is one of the busiest major event venues in the world for this period.' },
    ],
  },

};

export const WC_VENUE_SLUGS = Object.keys(WC_VENUES);

export function getVenue(slug: string): WCVenue | null {
  return WC_VENUES[slug] ?? null;
}
