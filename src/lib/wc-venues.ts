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


  // ── Levi's Stadium, Santa Clara (San Francisco Bay Area) ──────────────────
  'san-francisco': {
    slug: 'san-francisco',
    name: "Levi's Stadium",
    shortName: "Levi's Stadium",
    city: 'Santa Clara',
    stateOrRegion: 'California',
    country: 'United States',
    countryFlag: '🇺🇸',
    capacity: 68_500,
    surfaceType: 'Natural grass (Shaw Sports Turf hybrid)',
    roofType: 'Retractable open-air (partial canopy over lower bowl)',
    openedYear: 2014,
    primaryTenant: 'San Francisco 49ers (NFL)',
    architecturalNote: "Named after iconic denim brand Levi Strauss & Co., the stadium debuted in 2014 and made history hosting Super Bowl 50 in 2016. A rooftop garden and solar panels atop the structure make it one of the greenest NFL venues in the country.",
    metaTitle: "Levi's Stadium Santa Clara – FIFA World Cup 2026 Venue Guide | GoalRadar",
    metaDesc: "Levi's Stadium in Santa Clara hosts FIFA World Cup 2026 matches. Capacity 68,500, opened 2014. Transport, tickets, and full venue guide for the San Francisco Bay Area.",
    intro:
      "Levi's Stadium in Santa Clara, California brings FIFA World Cup 2026 to the heart of " +
      'Silicon Valley and the San Francisco Bay Area. Home of the San Francisco 49ers and famous ' +
      'for hosting Super Bowl 50 in 2016, the 68,500-seat venue sits in the tech capital of the ' +
      'world, just minutes from San Jose and roughly 45 minutes south of San Francisco. ' +
      "The stadium's partial canopy, cutting-edge connectivity and solar-panelled rooftop garden " +
      'make it one of the most technologically advanced and environmentally conscious venues in ' +
      'the tournament. Bay Area fans are passionate and the diverse, international population of ' +
      "the region will generate vibrant atmospheres for every World Cup fixture held here.",
    nearestAirport: 'San Francisco International Airport (SFO) — 5 miles / Norman Y. Mineta San José International (SJC) — 3 miles',
    distanceFromCity: 'Santa Clara, CA — 45 miles south of San Francisco, 4 miles from downtown San Jose',
    transport: [
      { mode: 'VTA Light Rail', icon: '🚈', description: 'Santa Clara Valley Transportation Authority (VTA) light rail stops directly at the stadium on the Mountain View–Winchester line. Trains run from downtown San Jose and connect to the broader VTA network.' },
      { mode: 'Caltrain', icon: '🚆', description: 'Take Caltrain from San Francisco (4th & King) or San Jose Diridon to the Santa Clara station, then a short ride-share or 20-minute walk to the stadium. Caltrain adds extra services on match days.' },
      { mode: 'BART + Bus', icon: '🚇', description: 'BART to Millbrae or Berryessa, then connect via Caltrain or VTA services. From central San Francisco, the combined journey is approximately 60–75 minutes.' },
      { mode: 'Car / Rideshare', icon: '🚗', description: 'Via US-101 or I-880. On-site parking available but expensive on match days. Rideshare drop-off zones are well-organised. Allow significant extra time for Bay Area traffic on match days.' },
    ],
    matchInfo: [
      { round: 'Group Stage',   matchCount: 5, description: 'Five group stage fixtures drawing on the Bay Area\'s large global diaspora community' },
      { round: 'Round of 32',  matchCount: 2, description: 'Two first-round knockout matches' },
      { round: 'Round of 16',  matchCount: 1, description: 'One Round of 16 match' },
    ],
    stats: [
      { label: 'Capacity',     value: '68,500' },
      { label: 'Opened',       value: '2014' },
      { label: 'Location',     value: 'Santa Clara, CA' },
      { label: 'To SFO',       value: '5 miles' },
      { label: 'Roof',         value: 'Partial canopy' },
      { label: 'WC Highlight', value: 'Hosted Super Bowl 50' },
    ],
    faq: [
      { q: "Where exactly is Levi's Stadium?", a: "Levi's Stadium is located at 4900 Marie P DeBartolo Way, Santa Clara, CA 95054 — in the South Bay, roughly 45 miles south of San Francisco and 4 miles from downtown San Jose." },
      { q: 'What airport should I use for the San Francisco World Cup venue?', a: "San José International (SJC) is closest at 3 miles. San Francisco International (SFO) is 5 miles away. Both have good public transport links to the Santa Clara/San Jose area." },
      { q: "How do I get to Levi's Stadium without a car?", a: 'VTA light rail stops directly at the stadium — take it from downtown San Jose. Alternatively, ride Caltrain from San Francisco or San Jose Diridon to Santa Clara station, then connect via VTA or rideshare.' },
      { q: "Is Levi's Stadium covered?", a: "Levi's Stadium has a partial canopy covering much of the lower bowl seating. The playing field is open to the sky. Summer afternoons in Santa Clara can be warm — sunscreen and water are recommended for daytime matches." },
      { q: 'What World Cup matches are at the San Francisco venue?', a: "Levi's Stadium hosts five group stage matches, two Round of 32 games and one Round of 16 fixture for FIFA World Cup 2026." },
      { q: 'Is parking available at the stadium?', a: 'Yes, multiple lots surround the stadium. However, parking is expensive on match days and lots fill quickly. Public transport via VTA light rail or Caltrain is strongly recommended.' },
      { q: 'What is special about Levi\'s Stadium?', a: "Levi's Stadium is one of the most technologically advanced sports venues in the US, with over 1,200 Wi-Fi access points and a rooftop garden with solar panels. It hosted Super Bowl 50 in 2016 and the inaugural College Football Playoff National Championship." },
    ],
  },

  // ── Rose Bowl, Pasadena ────────────────────────────────────────────────────
  'pasadena': {
    slug: 'pasadena',
    name: 'Rose Bowl Stadium',
    shortName: 'Rose Bowl',
    city: 'Pasadena',
    stateOrRegion: 'California',
    country: 'United States',
    countryFlag: '🇺🇸',
    capacity: 88_565,
    surfaceType: 'Natural grass',
    roofType: 'Open-air (no roof)',
    openedYear: 1922,
    primaryTenant: 'UCLA Bruins (college football) / Rose Bowl Game',
    architecturalNote: 'One of the most celebrated stadiums in American sports history, the Rose Bowl hosted the 1994 FIFA World Cup Final (Brazil vs Italy) and the 1984 Olympic football events. Its horseshoe-shaped bowl, nestled among Arroyo Seco parklands, is a National Historic Landmark.',
    metaTitle: 'Rose Bowl Pasadena – FIFA World Cup 2026 Venue Guide | GoalRadar',
    metaDesc: 'The Rose Bowl in Pasadena hosts FIFA World Cup 2026 matches. Capacity 88,565, opened 1922. Transport, tickets, and full venue guide for the Greater Los Angeles area.',
    intro:
      'The Rose Bowl in Pasadena, California is one of the most storied football venues on earth ' +
      'and brings unmatched historical prestige to FIFA World Cup 2026. With a capacity of 88,565, ' +
      'it is the largest stadium in the tournament and the only venue hosting matches from two ' +
      'World Cup editions — having staged the iconic 1994 Final between Brazil and Italy. ' +
      'Set among the picturesque Arroyo Seco parklands beneath the San Gabriel Mountains, the ' +
      "Rose Bowl's 1922 horseshoe structure is a National Historic Landmark, renovated and " +
      'modernised over the decades while preserving its classic character. Football fans will ' +
      'recognise this ground immediately, knowing that Pelé, Maradona and countless legends ' +
      'have graced its famous turf.',
    nearestAirport: 'Los Angeles International Airport (LAX) — 30 miles / Burbank Bob Hope Airport (BUR) — 15 miles',
    distanceFromCity: 'Pasadena, CA — 11 miles northeast of downtown Los Angeles',
    transport: [
      { mode: 'Metro Gold Line (A Line)', icon: '🚇', description: 'LA Metro A Line (Gold Line) to Memorial Park or Del Mar station in Pasadena, then shuttle buses to the Rose Bowl on match days. This is the recommended route — LA Metro runs extra services for major events.' },
      { mode: 'DASH Shuttle', icon: '🚌', description: 'Free DASH shuttle buses operate from Pasadena Metro stations to the Rose Bowl on event days, running frequently before and after matches.' },
      { mode: 'Car / Rideshare', icon: '🚗', description: 'Via I-210 (Foothill Freeway) or Arroyo Seco Parkway. Extensive paid parking surrounds the Rose Bowl. Rideshare recommended for smaller groups — designated drop-off zones are well-signed.' },
      { mode: 'From Hollywood / Downtown LA', icon: '🌆', description: 'Metro B Line (Red) to Union Station, then Metro A Line (Gold) to Pasadena — roughly 50–60 minutes total. A convenient option avoiding freeway traffic on match days.' },
    ],
    matchInfo: [
      { round: 'Group Stage',   matchCount: 6, description: 'Six group stage matches at the iconic venue, including high-profile national team fixtures' },
      { round: 'Round of 32',  matchCount: 2, description: 'Two Round of 32 knockout matches' },
      { round: 'Round of 16',  matchCount: 1, description: 'One Round of 16 match' },
      { round: 'Quarter-final', matchCount: 1, description: 'One quarter-final match at this historic venue' },
    ],
    stats: [
      { label: 'Capacity',     value: '88,565' },
      { label: 'Opened',       value: '1922' },
      { label: 'Location',     value: 'Pasadena, CA' },
      { label: 'To LAX',       value: '30 miles' },
      { label: 'Surface',      value: 'Natural grass' },
      { label: 'WC Highlight', value: 'Hosted 1994 WC Final' },
    ],
    faq: [
      { q: 'Did the Rose Bowl host a previous World Cup?', a: 'Yes. The Rose Bowl hosted the 1994 FIFA World Cup Final between Brazil and Italy on 17 July 1994 — the famous penalty shootout won by Brazil. It also hosted all Olympic football matches in the 1984 Los Angeles Olympics.' },
      { q: 'What matches are at the Rose Bowl for World Cup 2026?', a: 'The Rose Bowl hosts six group stage matches, two Round of 32 games, one Round of 16 and one Quarter-final for FIFA World Cup 2026.' },
      { q: 'How do I get to the Rose Bowl by public transport?', a: 'Take LA Metro A Line (Gold Line) to Memorial Park or Del Mar station in Pasadena, then a free DASH shuttle to the Rose Bowl. From Downtown LA, connect via Metro B Line (Red) to Union Station, then transfer to the A Line.' },
      { q: 'What airport is closest to the Rose Bowl?', a: 'Burbank Bob Hope Airport (BUR) is 15 miles away and is the most convenient. Los Angeles International (LAX) is 30 miles but has far more international connections. Pasadena is also about 20 minutes from Burbank on the Gold Line.' },
      { q: 'Is the Rose Bowl an open-air stadium?', a: 'Yes. The Rose Bowl is entirely open-air with no roof. Pasadena in June–July is typically warm and sunny — bring sunscreen, a hat and plenty of water for daytime matches.' },
      { q: 'What is the capacity of the Rose Bowl?', a: 'The Rose Bowl seats 88,565 people, making it the largest World Cup 2026 venue after MetLife Stadium. Its horseshoe-shaped bowl creates an excellent atmosphere with sightlines close to the pitch.' },
      { q: 'Is the Rose Bowl a protected landmark?', a: 'Yes. The Rose Bowl is a National Historic Landmark, one of only a few sports stadiums in the United States to hold that designation. Its iconic arched façade and bowl design have been carefully preserved through multiple renovations.' },
    ],
  },

  // ── Lincoln Financial Field, Philadelphia ──────────────────────────────────
  'philadelphia': {
    slug: 'philadelphia',
    name: 'Lincoln Financial Field',
    shortName: 'The Linc',
    city: 'Philadelphia',
    stateOrRegion: 'Pennsylvania',
    country: 'United States',
    countryFlag: '🇺🇸',
    capacity: 69_176,
    surfaceType: 'Natural grass (FieldTurf for WC)',
    roofType: 'Open-air with partial canopy over upper deck',
    openedYear: 2003,
    primaryTenant: 'Philadelphia Eagles (NFL)',
    architecturalNote: 'Known as "The Linc," Lincoln Financial Field opened in 2003 and is famous for its raucous Eagles fan base — one of the most passionate in the NFL. The stadium features solar panels and wind turbines making it the first NFL facility to generate its own power.',
    metaTitle: 'Lincoln Financial Field Philadelphia – FIFA World Cup 2026 Venue Guide | GoalRadar',
    metaDesc: 'Lincoln Financial Field in Philadelphia hosts FIFA World Cup 2026. Capacity 69,176, opened 2003. Transport, tickets, and full venue guide for the City of Brotherly Love.',
    intro:
      'Lincoln Financial Field, known affectionately as "The Linc," brings FIFA World Cup 2026 ' +
      "to Philadelphia — the City of Brotherly Love and America's birthplace of independence. " +
      'Home of the Super Bowl champion Philadelphia Eagles, this 69,176-seat stadium is famous ' +
      'for its electric atmosphere and famously passionate crowd. Opened in 2003 and powered ' +
      'in part by its own solar panels and wind turbines, The Linc is one of the most ' +
      'environmentally sustainable NFL venues in the country. Philadelphia itself is steeped in ' +
      'American history and culture, offering visiting World Cup fans a rich city experience ' +
      'alongside top-class football. The stadium is easily accessible from the downtown core ' +
      'via SEPTA public transit and sits within the South Philadelphia Sports Complex.',
    nearestAirport: 'Philadelphia International Airport (PHL) — 9 miles',
    distanceFromCity: 'South Philadelphia, PA — 3 miles south of downtown Philadelphia',
    transport: [
      { mode: 'SEPTA Broad Street Line', icon: '🚇', description: "Philadelphia's Broad Street Line subway runs from downtown City Hall to the NRG/stadiums stop, adjacent to Lincoln Financial Field. Fast, cheap and highly recommended — ~15 minutes from City Hall." },
      { mode: 'SEPTA Bus', icon: '🚌', description: 'Multiple SEPTA bus routes serve the South Philadelphia Sports Complex. Match-day services are enhanced. Check SEPTA.org for schedules and routes from your location.' },
      { mode: 'Car / Rideshare', icon: '🚗', description: 'Via I-95 or I-76 (Schuylkill Expressway). Large parking complex surrounds the stadium. Rideshare is convenient — use designated pick-up/drop-off zones. Traffic on I-95 can be heavy on match days.' },
      { mode: 'From PHL Airport', icon: '✈️', description: 'SEPTA Airport Line train to 30th Street Station or Center City, then Broad Street Line south to the stadium. Alternatively, rideshare from PHL is 15–20 minutes and 9 miles.' },
    ],
    matchInfo: [
      { round: 'Group Stage',  matchCount: 5, description: 'Five group stage fixtures in the passionate Philly football atmosphere' },
      { round: 'Round of 32', matchCount: 2, description: 'Two first-round knockout matches' },
      { round: 'Round of 16', matchCount: 1, description: 'One Round of 16 match' },
    ],
    stats: [
      { label: 'Capacity',  value: '69,176' },
      { label: 'Opened',    value: '2003' },
      { label: 'Location',  value: 'South Philadelphia, PA' },
      { label: 'To PHL',    value: '9 miles' },
      { label: 'Surface',   value: 'Natural grass (WC)' },
      { label: 'Nickname',  value: 'The Linc' },
    ],
    faq: [
      { q: 'What matches are at Lincoln Financial Field for World Cup 2026?', a: 'The Linc hosts five group stage matches, two Round of 32 games and one Round of 16 fixture during FIFA World Cup 2026.' },
      { q: 'How do I get to Lincoln Financial Field?', a: "The easiest way is SEPTA's Broad Street Line subway from City Hall station to the NRG/stadiums stop — it's fast, inexpensive and takes about 15 minutes from downtown Philadelphia." },
      { q: 'What airport should I use for the Philadelphia World Cup venue?', a: 'Philadelphia International Airport (PHL) is just 9 miles from the stadium. A rideshare takes 15–20 minutes. SEPTA Airport Line trains connect PHL to Center City, from where you can take the Broad Street Line.' },
      { q: 'Is Lincoln Financial Field open-air?', a: 'Yes, the field is open-air with a partial canopy over the upper deck. Philadelphia in June–July can be hot and humid — stay hydrated and apply sunscreen for daytime matches.' },
      { q: 'What is the capacity of Lincoln Financial Field?', a: 'Lincoln Financial Field has a capacity of 69,176 for NFL events. FIFA configurations may make slight adjustments for World Cup matches.' },
      { q: 'Is the stadium close to downtown Philadelphia?', a: "Yes. Lincoln Financial Field is in South Philadelphia, just 3 miles south of downtown (Center City). It's easily walkable from parts of South Philly and a quick SEPTA subway ride from City Hall." },
      { q: "Is Lincoln Financial Field environmentally friendly?", a: "Yes — The Linc was the first NFL stadium to achieve energy self-sufficiency through a combination of rooftop solar panels and wind turbines. It's one of the greenest sports venues in the United States." },
    ],
  },

  // ── Arrowhead Stadium, Kansas City ────────────────────────────────────────
  'kansas-city': {
    slug: 'kansas-city',
    name: 'Arrowhead Stadium',
    shortName: 'Arrowhead',
    city: 'Kansas City',
    stateOrRegion: 'Missouri',
    country: 'United States',
    countryFlag: '🇺🇸',
    capacity: 76_416,
    surfaceType: 'Natural grass',
    roofType: 'Open-air (no roof)',
    openedYear: 1972,
    primaryTenant: 'Kansas City Chiefs (NFL)',
    architecturalNote: "Arrowhead Stadium is widely regarded as the world's loudest outdoor stadium, a Guinness World Record holder with a recorded crowd noise of 142.2 decibels. Home of the Kansas City Chiefs — winners of four recent Super Bowls — the stadium's open bowl design concentrates fan noise to extraordinary levels.",
    metaTitle: 'Arrowhead Stadium Kansas City – FIFA World Cup 2026 Venue Guide | GoalRadar',
    metaDesc: "Arrowhead Stadium in Kansas City hosts FIFA World Cup 2026 matches. Capacity 76,416, opened 1972. The world's loudest stadium — transport, tickets and full venue guide.",
    intro:
      "Arrowhead Stadium in Kansas City, Missouri is the world's loudest outdoor sports venue — " +
      'a Guinness World Record holder — and a fitting stage for FIFA World Cup 2026. Home of ' +
      'the Kansas City Chiefs, one of the dominant forces in the NFL with four Super Bowl titles ' +
      'in recent years, this 76,416-seat open-air bowl has been generating deafening atmospheres ' +
      'since 1972. Kansas City sits at the geographic heart of the United States, making it ' +
      'accessible from across the country and ensuring a blend of passionate local fans and ' +
      'visiting international supporters. World Cup matches here are certain to be loud, ' +
      'colourful and unforgettable — the Chiefs Kingdom fan culture is unlike anything else ' +
      'in American sports.',
    nearestAirport: 'Kansas City International Airport (KCI) — 17 miles',
    distanceFromCity: 'Eastern Kansas City, MO — 9 miles east of downtown Kansas City',
    transport: [
      { mode: 'Bus Rapid Transit (MAX)', icon: '🚌', description: 'Kansas City\'s Troost MAX BRT route connects downtown KC to areas near the stadium. Match-day shuttle buses operate from multiple park-and-ride locations around the metro area.' },
      { mode: 'Match-Day Shuttles', icon: '🚐', description: 'Official and commercial shuttle services run from downtown Kansas City hotels, the Power & Light district and Union Station on major match days. Check with the venue and local transit for schedules.' },
      { mode: 'Car / Rideshare', icon: '🚗', description: 'Via I-70 East. The Truman Sports Complex has extensive free and paid parking. Rideshare pickup zones are well-organised. Tailgating culture means lots arrive hours before kickoff — plan accordingly.' },
      { mode: 'From KCI Airport', icon: '✈️', description: 'No direct public transit from KCI to the stadium. Rideshare (Uber/Lyft) or rental car is the practical option — approximately 20–25 minutes on the I-29/I-435 corridor.' },
    ],
    matchInfo: [
      { round: 'Group Stage',   matchCount: 5, description: 'Five group stage matches in the heart of America' },
      { round: 'Round of 32',  matchCount: 2, description: 'Two first-round knockout matches' },
      { round: 'Round of 16',  matchCount: 1, description: 'One Round of 16 match' },
    ],
    stats: [
      { label: 'Capacity',    value: '76,416' },
      { label: 'Opened',      value: '1972' },
      { label: 'Location',    value: 'Kansas City, MO' },
      { label: 'To KCI',      value: '17 miles' },
      { label: 'Noise Record', value: '142.2 dB (Guinness)' },
      { label: 'Nickname',    value: "Chiefs Kingdom" },
    ],
    faq: [
      { q: 'Why is Arrowhead called the loudest stadium in the world?', a: 'Arrowhead Stadium holds the Guinness World Record for loudest outdoor stadium, recorded at 142.2 decibels during a Kansas City Chiefs game in 2014. The open bowl design concentrates crowd noise, and Chiefs fans are famously passionate.' },
      { q: 'What World Cup 2026 matches are at Arrowhead Stadium?', a: 'Arrowhead Stadium hosts five group stage matches, two Round of 32 games and one Round of 16 fixture during FIFA World Cup 2026.' },
      { q: 'How do I get to Arrowhead Stadium?', a: 'Rideshare or car is the most practical option. Match-day shuttle buses run from downtown Kansas City and designated park-and-ride locations. The Truman Sports Complex has ample parking.' },
      { q: 'What airport should I use for Kansas City World Cup matches?', a: 'Kansas City International Airport (KCI) is 17 miles away. Rideshare from KCI takes about 20–25 minutes. No direct public transit runs between KCI and the stadium.' },
      { q: 'Is Arrowhead Stadium covered?', a: 'No. Arrowhead Stadium is fully open-air with no roof or canopy. Kansas City summer weather can be hot and humid in June–July — prepare for sun and possible afternoon thunderstorms.' },
      { q: 'What is the Kansas City Chiefs connection?', a: 'The Chiefs are the current NFL dynasty, having won four Super Bowls in the last six years with quarterback Patrick Mahomes. Arrowhead is their home since 1972 and is beloved as one of the great American sports venues.' },
      { q: 'Is tailgating allowed at Arrowhead for World Cup matches?', a: 'Tailgating traditions are central to the Arrowhead experience, though FIFA event regulations may adjust usual NFL tailgating rules. Check the official FIFA World Cup 2026 event guidelines for the specific policies at this venue.' },
    ],
  },

  // ── Lumen Field, Seattle ───────────────────────────────────────────────────
  'seattle': {
    slug: 'seattle',
    name: 'Lumen Field',
    shortName: 'Lumen Field',
    city: 'Seattle',
    stateOrRegion: 'Washington',
    country: 'United States',
    countryFlag: '🇺🇸',
    capacity: 69_000,
    surfaceType: 'FieldTurf (natural grass overlay for WC)',
    roofType: 'Partially covered (roof over seating, open end zones)',
    openedYear: 2002,
    primaryTenant: 'Seattle Seahawks (NFL) & Seattle Sounders FC (MLS)',
    architecturalNote: 'Lumen Field is unique among WC 2026 venues in being home to both an NFL franchise and a Major League Soccer team. The partial roof traps crowd noise, contributing to the famous "12th Man" atmosphere. The Sounders have the best MLS attendance record, indicating a deep football culture in the city.',
    metaTitle: 'Lumen Field Seattle – FIFA World Cup 2026 Venue Guide | GoalRadar',
    metaDesc: 'Lumen Field in Seattle hosts FIFA World Cup 2026 matches. Capacity 69,000, opened 2002. Home of the Seahawks and Sounders — transport, tickets and full venue guide.',
    intro:
      'Lumen Field in Seattle, Washington is one of the most football-savvy venues in FIFA ' +
      'World Cup 2026. Already home to the Seattle Sounders — MLS Cup champions with the ' +
      "league's most loyal fanbase — as well as NFL side the Seattle Seahawks, this " +
      '69,000-seat stadium boasts a partial roof that traps crowd noise to extraordinary ' +
      'levels. The legendary "12th Man" atmosphere that Seahawks fans created here translated ' +
      'directly to Sounders soccer culture, making Seattle one of the most genuine football ' +
      'cities in the United States. Set against the stunning backdrop of Puget Sound, the ' +
      'Olympic Mountains and downtown Seattle\'s skyline, Lumen Field delivers both sporting ' +
      'drama and spectacular scenery for visiting World Cup fans.',
    nearestAirport: 'Seattle-Tacoma International Airport (SEA) — 15 miles',
    distanceFromCity: 'SoDo district, Seattle, WA — 1 mile south of downtown Seattle',
    transport: [
      { mode: 'Link Light Rail', icon: '🚇', description: "Sound Transit Link Light Rail connects Sea-Tac Airport directly to Stadium station adjacent to Lumen Field. The journey from the airport takes approximately 35 minutes. This is the easiest and most recommended transport option." },
      { mode: 'Sounder Commuter Rail', icon: '🚆', description: 'Sound Transit Sounder trains run from Tacoma and Everett to King Street Station, a short walk from Lumen Field. Excellent option for fans coming from Tacoma or suburban areas.' },
      { mode: 'Metro Bus', icon: '🚌', description: 'King County Metro runs multiple routes through downtown and to the SoDo stadium district. Routes 21, 50, 101 and others serve the stadium area. Frequent match-day services.' },
      { mode: 'Car / Rideshare', icon: '🚗', description: 'Via I-5 or I-90. Paid parking in SoDo garages. Rideshare drop-off zones are on 1st Ave S. With the stadium being 1 mile from downtown, walking from Pioneer Square is a popular option too.' },
    ],
    matchInfo: [
      { round: 'Group Stage',   matchCount: 5, description: 'Five group stage matches in one of the US\'s most football-literate cities' },
      { round: 'Round of 32',  matchCount: 2, description: 'Two first-round knockout matches' },
      { round: 'Round of 16',  matchCount: 1, description: 'One Round of 16 match' },
    ],
    stats: [
      { label: 'Capacity',    value: '69,000' },
      { label: 'Opened',      value: '2002' },
      { label: 'Location',    value: 'Seattle, WA' },
      { label: 'To SEA',      value: '15 miles' },
      { label: 'Roof',        value: 'Partial (noise trap)' },
      { label: 'MLS Tenant',  value: 'Seattle Sounders FC' },
    ],
    faq: [
      { q: 'What World Cup 2026 matches are at Lumen Field?', a: 'Lumen Field hosts five group stage matches, two Round of 32 games and one Round of 16 fixture during FIFA World Cup 2026.' },
      { q: 'How do I get to Lumen Field from Sea-Tac Airport?', a: 'Take Sound Transit Link Light Rail from Sea-Tac Airport directly to Stadium station — this is right outside Lumen Field. The journey takes about 35 minutes and trains run frequently.' },
      { q: 'Does Seattle have a strong football (soccer) culture?', a: 'Yes — Seattle Sounders FC consistently lead MLS in attendance and their fans (the "Emerald City Supporters" and "Gorilla FC") create some of the best atmospheres in American soccer. This makes Lumen Field a particularly genuine venue for World Cup football.' },
      { q: 'Is Lumen Field covered?', a: "Lumen Field has a distinctive partial roof covering the seating areas but with open end zones. Seattle's June–July weather is generally mild and pleasant, though the city is known for rain — the roof provides good protection for most seats." },
      { q: 'Is the stadium close to downtown Seattle?', a: 'Yes — Lumen Field is in the SoDo (South of Downtown) district, just 1 mile south of downtown Seattle. It\'s a pleasant 20-minute walk from Pioneer Square.' },
      { q: 'What airport should I use for Seattle World Cup matches?', a: 'Seattle-Tacoma International Airport (SEA) is 15 miles south and directly connected to the stadium via Link Light Rail. International visitors should fly directly into SEA.' },
      { q: 'What is the "12th Man" at Lumen Field?', a: 'The "12th Man" refers to the crowd noise culture at Lumen Field — the Seahawks retired the #12 jersey number to honour fans. The partial roof concentrates noise and the atmosphere has been one of the loudest in all of American sports. Sounders fans carry this tradition into soccer.' },
    ],
  },

  // ── Gillette Stadium, Foxborough (Boston) ─────────────────────────────────
  'boston': {
    slug: 'boston',
    name: 'Gillette Stadium',
    shortName: 'Gillette',
    city: 'Foxborough',
    stateOrRegion: 'Massachusetts',
    country: 'United States',
    countryFlag: '🇺🇸',
    capacity: 65_878,
    surfaceType: 'Natural grass',
    roofType: 'Open-air (no roof)',
    openedYear: 2002,
    primaryTenant: 'New England Patriots (NFL) & New England Revolution (MLS)',
    architecturalNote: "Gillette Stadium is instantly recognisable by its twin lighthouse towers flanking the iconic bridge structure above the south end zone. Home of the NFL's most successful dynasty — the New England Patriots — and MLS side the New England Revolution, the stadium combines New England character with world-class facilities.",
    metaTitle: 'Gillette Stadium Boston – FIFA World Cup 2026 Venue Guide | GoalRadar',
    metaDesc: 'Gillette Stadium near Boston hosts FIFA World Cup 2026 matches. Capacity 65,878, opened 2002. Transport from Boston, tickets and full venue guide for Foxborough, MA.',
    intro:
      'Gillette Stadium in Foxborough, Massachusetts serves as the New England hub for FIFA ' +
      "World Cup 2026, drawing fans from Boston — one of America's most sports-obsessed cities. " +
      'Home of the legendary New England Patriots NFL dynasty and MLS side the New England ' +
      'Revolution, this 65,878-seat stadium is instantly recognisable by its distinctive twin ' +
      'lighthouse towers. Located 28 miles southwest of Boston in the town of Foxborough, ' +
      'Gillette is accessible via dedicated match-day rail services from the city. Boston itself ' +
      "offers World Cup visitors a rich blend of history, culture, world-class universities and " +
      "New England's famous seafood and sporting passion — making this one of the most appealing " +
      'host cities in the entire tournament.',
    nearestAirport: 'Boston Logan International Airport (BOS) — 28 miles',
    distanceFromCity: 'Foxborough, MA — 28 miles southwest of downtown Boston',
    transport: [
      { mode: 'MBTA Commuter Rail', icon: '🚆', description: 'Dedicated MBTA commuter rail event trains run from Boston South Station and Back Bay Station directly to Foxborough station, adjacent to Gillette Stadium, on match days. Journey time approximately 65–75 minutes. This is the strongly recommended option.' },
      { mode: 'Providence/Stoughton Line', icon: '🚆', description: 'On non-event days, the MBTA Providence/Stoughton Line runs to nearby stations with connections to Foxborough. Match-day specials are far more convenient.' },
      { mode: 'Car / Rideshare', icon: '🚗', description: 'Via I-95 or Route 1 South. Extensive parking on-site. Traffic on Route 1 can be very heavy after major events — allow 60–90 minutes extra for egress. Rideshare drop-off on Patriot Place Drive.' },
      { mode: 'From Providence, RI', icon: '🏙️', description: 'Foxborough is equidistant between Boston and Providence (~20 miles). Some fans base themselves in Providence (cheaper hotels) and take the commuter rail or rideshare to matches.' },
    ],
    matchInfo: [
      { round: 'Group Stage',  matchCount: 5, description: 'Five group stage fixtures bringing the World Cup to New England' },
      { round: 'Round of 32', matchCount: 2, description: 'Two first-round knockout matches' },
      { round: 'Round of 16', matchCount: 1, description: 'One Round of 16 match' },
    ],
    stats: [
      { label: 'Capacity',  value: '65,878' },
      { label: 'Opened',    value: '2002' },
      { label: 'Location',  value: 'Foxborough, MA' },
      { label: 'To Boston', value: '28 miles' },
      { label: 'Surface',   value: 'Natural grass' },
      { label: 'Nickname',  value: 'Lighthouse Stadium' },
    ],
    faq: [
      { q: 'Where is Gillette Stadium relative to Boston?', a: 'Gillette Stadium is in Foxborough, Massachusetts — 28 miles southwest of downtown Boston. It takes approximately 65–75 minutes by MBTA commuter rail from South Station.' },
      { q: 'How do I get to Gillette Stadium from Boston?', a: 'MBTA runs dedicated event trains from Boston South Station and Back Bay directly to Foxborough on match days. This is the easiest and most popular option. Trains run 2–3 hours before kickoff and for 1–2 hours after the final whistle.' },
      { q: 'What matches are at Gillette Stadium for World Cup 2026?', a: 'Gillette Stadium hosts five group stage matches, two Round of 32 games and one Round of 16 fixture during FIFA World Cup 2026.' },
      { q: 'What airport should I use for the Boston World Cup venue?', a: 'Boston Logan International Airport (BOS) is 28 miles from Gillette Stadium. Take the MBTA Silver Line to South Station, then match-day commuter rail to Foxborough. Alternatively, rideshare from BOS takes 40–55 minutes in light traffic.' },
      { q: 'Is Gillette Stadium covered?', a: 'Gillette Stadium is open-air with no roof. Massachusetts weather in June–July is generally mild, but afternoon thunderstorms are possible — rain gear is advisable.' },
      { q: 'What is special about Gillette Stadium?', a: "Gillette is famous for its twin lighthouse towers and the dramatic bridge structure over the south end zone — a unique architectural identity. It's home to the New England Patriots, who have won six Super Bowls, and the New England Revolution MLS club." },
      { q: 'Are there hotels near Gillette Stadium?', a: "Patriot Place, the retail/entertainment complex adjacent to Gillette Stadium, has a Renaissance Hotel on-site. Many fans also stay in Boston, Providence, or surrounding towns and take the match-day commuter rail. Book early as New England hotel rooms fill fast for World Cup." },
    ],
  },

  // ── Mercedes-Benz Stadium, Atlanta ────────────────────────────────────────
  'atlanta': {
    slug: 'atlanta',
    name: 'Mercedes-Benz Stadium',
    shortName: 'MBS Atlanta',
    city: 'Atlanta',
    stateOrRegion: 'Georgia',
    country: 'United States',
    countryFlag: '🇺🇸',
    capacity: 71_000,
    surfaceType: 'Natural grass (Shaw Sports Turf for WC)',
    roofType: 'Retractable petal roof (8 panels, ETFE)',
    openedYear: 2017,
    primaryTenant: 'Atlanta Falcons (NFL) & Atlanta United FC (MLS)',
    architecturalNote: 'Mercedes-Benz Stadium is considered one of the finest sports venues in the world. Its revolutionary eight-panel retractable "petal" roof opens like a camera aperture in approximately eight minutes. The 360-degree video halo board — the largest in the world — circles the interior above the upper deck.',
    metaTitle: 'Mercedes-Benz Stadium Atlanta – FIFA World Cup 2026 Venue Guide | GoalRadar',
    metaDesc: 'Mercedes-Benz Stadium in Atlanta hosts FIFA World Cup 2026 matches. Capacity 71,000, opened 2017. Retractable petal roof, largest halo board — full venue guide.',
    intro:
      'Mercedes-Benz Stadium in Atlanta, Georgia is one of the most architecturally magnificent ' +
      'sports venues on the planet and a showpiece of FIFA World Cup 2026. Home to both the ' +
      'Atlanta Falcons NFL franchise and Atlanta United FC — one of the fastest-growing MLS ' +
      'clubs — this 71,000-seat stadium opened in 2017 and immediately set new global ' +
      'standards for stadium design. Its iconic eight-panel retractable "petal" roof opens ' +
      'like a camera aperture, while the world\'s largest 360-degree halo video board circles ' +
      'the interior in stunning detail. MBS hosted Super Bowl LIII in 2019 and the College ' +
      'Football Playoff Championship. Atlanta\'s warm summer climate and vibrant international ' +
      'food and music scene make it a compelling World Cup host city.',
    nearestAirport: 'Hartsfield-Jackson Atlanta International Airport (ATL) — 12 miles',
    distanceFromCity: 'Downtown Atlanta, GA — 1 mile west of Centennial Olympic Park',
    transport: [
      { mode: 'MARTA Rail', icon: '🚇', description: "MARTA's West End station (Green/Blue Line) is a short walk from Mercedes-Benz Stadium. Trains run from Hartsfield-Jackson Airport to downtown in about 20 minutes. This is the recommended option — MARTA provides frequent match-day services." },
      { mode: 'From ATL Airport', icon: '✈️', description: 'MARTA Gold/Red Line from the airport to Five Points station, then switch to Blue/Green Line to the stadium area. Total journey: approximately 35 minutes. Quick, cheap and avoids traffic.' },
      { mode: 'Atlanta Streetcar', icon: '🚃', description: "The Atlanta Streetcar connects Centennial Olympic Park area to Sweet Auburn district. Useful for reaching the stadium from nearby hotels and tourist areas in downtown Atlanta." },
      { mode: 'Car / Rideshare', icon: '🚗', description: 'Via I-20 or I-75/I-85. Multiple parking decks adjacent to the stadium. Rideshare drop-off at designated zones on Martin Luther King Jr. Dr. Atlanta traffic can be significant — allow extra time.' },
    ],
    matchInfo: [
      { round: 'Group Stage',   matchCount: 5, description: 'Five group stage matches in the stunning MBS petal-roof arena' },
      { round: 'Round of 32',  matchCount: 2, description: 'Two first-round knockout matches' },
      { round: 'Round of 16',  matchCount: 1, description: 'One Round of 16 match' },
      { round: 'Quarter-final', matchCount: 1, description: 'One quarter-final match' },
    ],
    stats: [
      { label: 'Capacity',    value: '71,000' },
      { label: 'Opened',      value: '2017' },
      { label: 'Location',    value: 'Downtown Atlanta, GA' },
      { label: 'To ATL',      value: '12 miles' },
      { label: 'Roof',        value: 'Retractable petal (8 panels)' },
      { label: 'WC Highlight', value: 'Hosted Super Bowl LIII' },
    ],
    faq: [
      { q: 'What makes Mercedes-Benz Stadium unique?', a: "MBS features a revolutionary eight-panel retractable petal roof that opens in approximately eight minutes, and the world's largest 360-degree halo video board encircling the interior. It is widely considered one of the finest stadium designs in the world." },
      { q: 'What World Cup 2026 matches are at Mercedes-Benz Stadium?', a: 'MBS hosts five group stage matches, two Round of 32 games, one Round of 16 and one Quarter-final during FIFA World Cup 2026.' },
      { q: 'How do I get to Mercedes-Benz Stadium from the airport?', a: 'Take MARTA Gold/Red Line from Hartsfield-Jackson Airport to Five Points station (about 20 minutes), then switch to the Blue/Green Line toward the stadium area. Total journey is around 35 minutes.' },
      { q: 'Is Mercedes-Benz Stadium air-conditioned?', a: 'Yes — when the retractable roof is closed, the stadium is climate-controlled. This is particularly beneficial for Atlanta\'s humid summer weather. The roof can be opened or closed depending on conditions.' },
      { q: 'What airport serves Atlanta for the World Cup?', a: 'Hartsfield-Jackson Atlanta International Airport (ATL), 12 miles from the stadium, is one of the busiest airports in the world with extensive international connections. MARTA rail connects directly to downtown.' },
      { q: 'Does Atlanta have an MLS team?', a: 'Yes — Atlanta United FC play at MBS and consistently rank among the top MLS clubs in both attendance and performance. Their passionate supporter groups will ensure a soccer-savvy atmosphere for World Cup matches.' },
      { q: 'What previous major events has Mercedes-Benz Stadium hosted?', a: 'MBS hosted Super Bowl LIII in February 2019 (New England Patriots vs Los Angeles Rams), the College Football Playoff National Championship, and numerous SEC Championship Games. It is a proven major-event venue.' },
    ],
  },

  // ── Estadio Akron, Guadalajara ─────────────────────────────────────────────
  'guadalajara': {
    slug: 'guadalajara',
    name: 'Estadio Akron',
    shortName: 'Estadio Akron',
    city: 'Guadalajara',
    stateOrRegion: 'Jalisco',
    country: 'Mexico',
    countryFlag: '🇲🇽',
    capacity: 46_513,
    surfaceType: 'Natural grass',
    roofType: 'Open-air (no roof)',
    openedYear: 2010,
    primaryTenant: 'Chivas de Guadalajara (Liga MX)',
    architecturalNote: 'Also known as Estadio Omnilife or Estadio Guadalajara, the Akron is one of the most modern football-specific stadiums in Mexico. Located in the suburb of Zapopan, its design features a distinctive curved exterior and steep sightlines that create an intense atmosphere for Liga MX matches.',
    metaTitle: 'Estadio Akron Guadalajara – FIFA World Cup 2026 Venue Guide | GoalRadar',
    metaDesc: 'Estadio Akron in Guadalajara hosts FIFA World Cup 2026 matches. Capacity 46,513, opened 2010. Home of Chivas — transport, tickets and full venue guide for Jalisco.',
    intro:
      'Estadio Akron in Zapopan, Guadalajara brings FIFA World Cup 2026 to Mexico\'s second-largest ' +
      'city and one of its most passionate football communities. Home of Club Deportivo ' +
      'Guadalajara — universally known as Chivas — this 46,513-seat modern stadium opened in ' +
      '2010 and quickly became one of the finest football-specific venues in Latin America. ' +
      'Guadalajara is a city of deep cultural heritage: birthplace of mariachi music and ' +
      'tequila, and home to some of Mexico\'s most fervent football supporters. ' +
      'The stadium\'s steep bowl design concentrates crowd noise and creates an atmosphere ' +
      'that visiting fans will find electrifying. For international visitors, Guadalajara ' +
      'offers excellent accessibility and a vibrant city experience.',
    nearestAirport: 'Guadalajara International Airport — Miguel Hidalgo y Costilla (GDL) — 10 km',
    distanceFromCity: 'Zapopan suburb, 12 km northwest of Guadalajara city centre',
    transport: [
      { mode: 'Tren Ligero (Light Rail)', icon: '🚈', description: 'The Guadalajara Tren Ligero Line 1 connects downtown Guadalajara to Periférico Norte, with bus connections toward Zapopan. Services are enhanced on major event days.' },
      { mode: 'Macrobús BRT', icon: '🚌', description: "Guadalajara's Macrobús rapid bus network provides corridors from the city centre toward the stadium area in Zapopan. Check local transit maps for the most convenient route from your accommodation." },
      { mode: 'Car / Rideshare', icon: '🚗', description: 'Via Periférico Norte or Avenida Acueducto. Parking is available at and around the stadium. Uber operates extensively in Guadalajara and is a convenient option for match-day travel.' },
      { mode: 'From GDL Airport', icon: '✈️', description: 'Guadalajara International Airport is approximately 10 km from the stadium. Uber and taxis are available outside arrivals. No direct rail link — rideshare takes 15–25 minutes depending on traffic.' },
    ],
    matchInfo: [
      { round: 'Group Stage',  matchCount: 4, description: 'Four group stage matches in the passionate Chivas heartland' },
      { round: 'Round of 32', matchCount: 2, description: 'Two first-round knockout matches' },
    ],
    stats: [
      { label: 'Capacity',  value: '46,513' },
      { label: 'Opened',    value: '2010' },
      { label: 'Location',  value: 'Zapopan, Jalisco' },
      { label: 'To GDL',    value: '10 km' },
      { label: 'Surface',   value: 'Natural grass' },
      { label: 'Home Club', value: 'Chivas de Guadalajara' },
    ],
    faq: [
      { q: 'Where is Estadio Akron exactly?', a: 'Estadio Akron is in Zapopan, a municipality immediately northwest of Guadalajara city. The address is Av. Presa Aguamilpa 750, Zapopan, Jalisco, Mexico. It is approximately 12 km from the Guadalajara city centre.' },
      { q: 'What matches are at Estadio Akron for World Cup 2026?', a: 'Estadio Akron hosts four group stage matches and two Round of 32 games during FIFA World Cup 2026.' },
      { q: 'How do I get to Estadio Akron?', a: 'Uber is the most practical option for most visitors. The Guadalajara Macrobús BRT and Tren Ligero provide public transit options with connections near Zapopan. Enhanced services operate on match days.' },
      { q: 'What airport serves Guadalajara?', a: 'Guadalajara International Airport (GDL) — officially named Aeropuerto Internacional Miguel Hidalgo y Costilla — is about 10 km from the stadium and 20 km from the city centre. Uber or taxi from GDL to the stadium takes 15–25 minutes.' },
      { q: 'What is Chivas de Guadalajara?', a: "Chivas (Club Deportivo Guadalajara) is one of Mexico's most beloved and successful clubs, unique in only fielding Mexican-born players — a policy that makes them especially popular as a symbol of Mexican football identity. They are one of Liga MX's most decorated clubs." },
      { q: 'What is Guadalajara famous for?', a: 'Guadalajara is considered the cultural capital of western Mexico — birthplace of mariachi music, the Jalisco folk dance (jarabe tapatío) and the tequila industry (the town of Tequila is 60 km away). The city is known for excellent food, art and architecture.' },
      { q: 'Is the stadium open-air?', a: 'Yes. Estadio Akron is fully open-air with no roof. Guadalajara\'s June climate is warm (25–30°C) with the rainy season beginning, so afternoon thunderstorms are possible. Sunscreen and rain gear are both advisable.' },
    ],
  },

  // ── Estadio BBVA, Monterrey ────────────────────────────────────────────────
  'monterrey': {
    slug: 'monterrey',
    name: 'Estadio BBVA',
    shortName: 'Estadio BBVA',
    city: 'Monterrey',
    stateOrRegion: 'Nuevo León',
    country: 'Mexico',
    countryFlag: '🇲🇽',
    capacity: 53_500,
    surfaceType: 'Natural grass',
    roofType: 'Open-air (no roof)',
    openedYear: 2015,
    primaryTenant: 'CF Monterrey — Rayados (Liga MX)',
    architecturalNote: "Estadio BBVA is widely regarded as one of Latin America's most visually stunning sports venues. Nestled in the foothills of the Sierra Madre Oriental mountains on the outskirts of Monterrey, the ultra-modern design by Populous features dramatic mountain backdrops visible from every seat. Located close to the US border, Monterrey attracts significant cross-border fan interest.",
    metaTitle: 'Estadio BBVA Monterrey – FIFA World Cup 2026 Venue Guide | GoalRadar',
    metaDesc: 'Estadio BBVA in Monterrey hosts FIFA World Cup 2026 matches. Capacity 53,500, opened 2015. Stunning mountain backdrop — transport, tickets and full venue guide.',
    intro:
      'Estadio BBVA in Monterrey, Mexico is arguably the most visually spectacular venue in ' +
      'FIFA World Cup 2026. Home of CF Monterrey (Rayados), this 53,500-seat ultra-modern ' +
      'stadium opened in 2015 and is set dramatically in the foothills of the Sierra Madre ' +
      'Oriental mountains — with breathtaking mountain views visible from virtually every ' +
      'seat in the house. Designed by global sports architects Populous, the stadium is ' +
      'located in the Guadalupe municipality on the eastern edge of Monterrey, Mexico\'s ' +
      "most industrial and economically powerful city — just 240 km from the US border. " +
      "Monterrey's proximity to Texas will draw enormous numbers of US-based fans, " +
      'particularly for Mexican national team fixtures, creating extraordinary atmospheres.',
    nearestAirport: 'General Mariano Escobedo International Airport (MTY) — 13 km / General Guadalupe Victoria International (alternate entry via McAllen TX)',
    distanceFromCity: 'Guadalupe municipality, 9 km east of central Monterrey',
    transport: [
      { mode: 'Metro Line 1', icon: '🚇', description: "Monterrey's Metro Line 1 (Línea 1) runs east–west through the city. The closest station to the stadium is Exposición or Félix U. Gómez, from where a short taxi or rideshare completes the journey. Metro services increase on match days." },
      { mode: 'Taxi / Uber', icon: '🚕', description: 'Uber operates reliably in Monterrey and is the most convenient door-to-door option for the stadium, which is located in a suburban area. Budget 20–30 minutes from downtown Monterrey.' },
      { mode: 'Car', icon: '🚗', description: 'Via Av. Pablo González or Blvd. Díaz Ordaz. Ample parking surrounds the stadium. Driving is common in Monterrey — allow extra time for traffic on match days.' },
      { mode: 'From the US Border', icon: '🌎', description: "Laredo (TX) is 240 km north via Mexico Highway 85. McAllen (TX) is 230 km northeast. Many US fans drive across for matches — ensure valid Mexican vehicle insurance and check crossing times at busy World Cup weekends." },
    ],
    matchInfo: [
      { round: 'Group Stage',  matchCount: 4, description: 'Four group stage matches near the US–Mexico border drawing huge cross-border interest' },
      { round: 'Round of 32', matchCount: 2, description: 'Two first-round knockout matches' },
    ],
    stats: [
      { label: 'Capacity',   value: '53,500' },
      { label: 'Opened',     value: '2015' },
      { label: 'Location',   value: 'Guadalupe, Nuevo León' },
      { label: 'To MTY',     value: '13 km' },
      { label: 'Surface',    value: 'Natural grass' },
      { label: 'Backdrop',   value: 'Sierra Madre mountains' },
    ],
    faq: [
      { q: 'What makes Estadio BBVA visually special?', a: 'The stadium is set in the foothills of the Sierra Madre Oriental mountains, with dramatic mountain peaks visible from virtually every seat. At dusk or on clear days, the scenery is genuinely breathtaking — many consider it the most beautiful stadium setting in the Americas.' },
      { q: 'What World Cup 2026 matches are at Estadio BBVA?', a: 'Estadio BBVA hosts four group stage matches and two Round of 32 games during FIFA World Cup 2026.' },
      { q: 'How close is Monterrey to the US border?', a: 'Monterrey is approximately 240 km south of Laredo, Texas and 230 km from McAllen, Texas. Many American fans are expected to drive or fly across for matches, particularly for Mexican national team fixtures.' },
      { q: 'What airport should I use for Monterrey World Cup matches?', a: 'General Mariano Escobedo International Airport (MTY) is the main Monterrey airport, approximately 13 km from the stadium. US visitors might also consider flying into McAllen (MFE) or Laredo (LRD) in Texas and driving across.' },
      { q: 'How do I get to the stadium from central Monterrey?', a: 'Uber is the most convenient option, taking 20–30 minutes from downtown. Metro Line 1 reaches nearby stations, from where a short taxi completes the journey. Enhanced public transit is expected on match days.' },
      { q: 'Is it safe to travel to Monterrey?', a: "Monterrey is Mexico's most industrialised and economically developed city. The World Cup venue area and tourist zones are considered safe. Standard travel precautions apply — follow official FIFA and US/UK government travel advisories for the latest guidance." },
      { q: 'What is the weather like in Monterrey during the World Cup?', a: 'Monterrey in June–July is hot and can be humid — expect temperatures of 35–40°C during the day. Evening matches will be more comfortable. Stay hydrated and wear light, breathable clothing.' },
    ],
  },

  // ── BC Place, Vancouver ────────────────────────────────────────────────────
  'vancouver': {
    slug: 'vancouver',
    name: 'BC Place',
    shortName: 'BC Place',
    city: 'Vancouver',
    stateOrRegion: 'British Columbia',
    country: 'Canada',
    countryFlag: '🇨🇦',
    capacity: 54_500,
    surfaceType: 'FieldTurf (natural grass overlay for WC)',
    roofType: 'Retractable roof (cable-supported — largest in Canada)',
    openedYear: 1983,
    primaryTenant: 'BC Lions (CFL) & Vancouver Whitecaps FC (MLS)',
    architecturalNote: "BC Place underwent a C$563 million renovation in 2011, replacing its original air-supported dome with a state-of-the-art retractable cable-supported roof — the largest in Canada. The stadium hosted the opening and closing ceremonies of the 2010 Vancouver Winter Olympics and the 2015 FIFA Women's World Cup Final.",
    metaTitle: 'BC Place Vancouver – FIFA World Cup 2026 Venue Guide | GoalRadar',
    metaDesc: 'BC Place in Vancouver hosts FIFA World Cup 2026 matches. Capacity 54,500, Canada\'s largest covered stadium. Transport, tickets and full venue guide for Vancouver.',
    intro:
      'BC Place in Vancouver, British Columbia is the flagship Canadian venue for FIFA World ' +
      'Cup 2026 and the proud host of some of the most significant matches in the tournament. ' +
      "Canada's largest covered stadium — with a spectacular retractable roof installed during " +
      'its 2011 renovation — BC Place has a distinguished history in major sporting events, ' +
      'having hosted the 2010 Winter Olympics ceremonies and the 2015 FIFA Women\'s World Cup Final. ' +
      'Located in the heart of downtown Vancouver alongside False Creek, the stadium offers ' +
      'stunning views of the Coast Mountains and is steps from the SkyTrain network. ' +
      "Vancouver itself is one of the world's most liveable and beautiful cities, with a " +
      'diverse, cosmopolitan population that will embrace World Cup football with genuine passion.',
    nearestAirport: "Vancouver International Airport (YVR) — 15 km",
    distanceFromCity: 'Downtown Vancouver, BC — adjacent to False Creek and Yaletown',
    transport: [
      { mode: 'SkyTrain (Expo / Canada Line)', icon: '🚇', description: "BC Place's Stadium-Chinatown station (Expo Line) is directly adjacent to the venue. From Vancouver International Airport (YVR), take the Canada Line to Waterfront, then transfer to the Expo Line — total journey approximately 30 minutes. The SkyTrain is fast, cheap and the best option." },
      { mode: 'Canada Line from YVR', icon: '✈️', description: 'The SkyTrain Canada Line runs directly from YVR Airport to downtown Vancouver. Transfer at Waterfront or Vancouver City Centre to the Expo Line for Stadium-Chinatown. No fuss, no traffic.' },
      { mode: 'Bus', icon: '🚌', description: 'TransLink buses serve the False Creek / Pacific Boulevard area near BC Place. Routes 15, 17 and others stop close to the stadium. Combined TransLink passes cover bus and SkyTrain.' },
      { mode: 'Cycling / Walking', icon: '🚲', description: "Vancouver has an excellent cycling infrastructure. BC Place is in central downtown — many fans from nearby Yaletown, Gastown or the West End choose to cycle or walk to matches. Vancouver's seawall path runs past the stadium." },
    ],
    matchInfo: [
      { round: 'Group Stage',   matchCount: 5, description: "Five group stage matches at Canada's premier stadium" },
      { round: 'Round of 32',  matchCount: 2, description: 'Two first-round knockout matches' },
      { round: 'Round of 16',  matchCount: 1, description: 'One Round of 16 match' },
    ],
    stats: [
      { label: 'Capacity',    value: '54,500' },
      { label: 'Opened',      value: '1983 (renovated 2011)' },
      { label: 'Location',    value: 'Downtown Vancouver, BC' },
      { label: 'To YVR',      value: '15 km' },
      { label: 'Roof',        value: "Retractable (Canada's largest)" },
      { label: 'WC Highlight', value: "Hosted 2015 Women's WC Final" },
    ],
    faq: [
      { q: 'Has BC Place hosted a World Cup before?', a: "Yes. BC Place hosted the 2015 FIFA Women's World Cup Final between USA and Japan, won 5-2 by the United States. The stadium also hosted the opening and closing ceremonies of the 2010 Vancouver Winter Olympics." },
      { q: 'What World Cup 2026 matches are at BC Place?', a: 'BC Place hosts five group stage matches, two Round of 32 games and one Round of 16 fixture during FIFA World Cup 2026.' },
      { q: 'How do I get to BC Place from YVR Airport?', a: 'Take the Canada Line SkyTrain from the airport to Waterfront or Vancouver City Centre station, then transfer to the Expo Line for Stadium-Chinatown station — directly outside BC Place. The journey takes about 30 minutes and is very straightforward.' },
      { q: 'Does BC Place have a roof?', a: "Yes. BC Place has a retractable cable-supported roof — the largest retractable roof in Canada — installed during the 2011 renovation. The roof can be opened or closed, protecting fans from Vancouver's rain while allowing the option of open-air conditions in good weather." },
      { q: 'Is BC Place close to downtown hotels?', a: "BC Place is in the heart of downtown Vancouver, steps from Yaletown and the False Creek waterfront. There are hundreds of hotels within walking distance, making it one of the most convenient World Cup venues for accommodation access." },
      { q: 'Do Canadian fans need a visa to attend?', a: "Fans attending in Vancouver are already in Canada — no visa needed for the matches themselves. International visitors may need an Electronic Travel Authorization (eTA) or visa to enter Canada. Check the Government of Canada's official visa requirements for your nationality." },
      { q: 'What is the weather like in Vancouver during the World Cup?', a: "Vancouver in June–July is typically mild and pleasant — average highs of 20–24°C. It can rain, but summer is the driest season. BC Place's retractable roof means weather won't affect the match experience for spectators." },
    ],
  },

  // ── BMO Field, Toronto ─────────────────────────────────────────────────────
  'toronto': {
    slug: 'toronto',
    name: 'BMO Field',
    shortName: 'BMO Field',
    city: 'Toronto',
    stateOrRegion: 'Ontario',
    country: 'Canada',
    countryFlag: '🇨🇦',
    capacity: 45_500,
    surfaceType: 'Natural grass',
    roofType: 'Open-air with partial canopy over main and east stands',
    openedYear: 2007,
    primaryTenant: 'Toronto FC (MLS) & Canada national football team',
    architecturalNote: 'BMO Field is the historic home of Canadian soccer, serving as the primary venue for the Canadian national team. Originally opened with 20,000 seats in 2007, the stadium is being expanded to 45,500 capacity for FIFA World Cup 2026. Situated on the Lakeshore waterfront in Exhibition Place, it enjoys striking views of Lake Ontario and the Toronto skyline.',
    metaTitle: 'BMO Field Toronto – FIFA World Cup 2026 Venue Guide | GoalRadar',
    metaDesc: "BMO Field in Toronto hosts FIFA World Cup 2026 matches. Capacity expanded to 45,500 for WC. Canada's national football home — transport, tickets and full venue guide.",
    intro:
      'BMO Field in Toronto, Ontario is the spiritual home of Canadian football and a ' +
      'deeply meaningful venue for FIFA World Cup 2026. Home of Toronto FC and the Canadian ' +
      'national team, this waterfront stadium on the shores of Lake Ontario is being expanded ' +
      'to 45,500 seats for the tournament. Opened in 2007 as a purpose-built football-specific ' +
      'venue, BMO Field sits within Exhibition Place on the western edge of downtown Toronto, ' +
      "offering spectacular views of Lake Ontario and the city's iconic skyline. For Canadian " +
      'fans, hosting the World Cup at BMO Field — where the national team has played countless ' +
      'historic matches — carries profound emotional significance. Toronto is one of the ' +
      "world's most multicultural cities, ensuring vibrant, diverse World Cup crowds.",
    nearestAirport: "Toronto Pearson International Airport (YYZ) — 20 km / Billy Bishop Toronto City Airport (YTZ) — 2 km",
    distanceFromCity: 'Exhibition Place, Toronto ON — 3 km west of downtown (CN Tower)',
    transport: [
      { mode: 'TTC Streetcar (509/511)', icon: '🚃', description: "Toronto Transit Commission streetcar routes 509 Harbourfront and 511 Bathurst run directly to Exhibition Place / BMO Field from Union Station. The journey from Union takes about 10–15 minutes. This is the easiest and most popular option." },
      { mode: 'UP Express + Walk', icon: '🚆', description: 'Union Pearson Express (UP Express) from Toronto Pearson Airport to Union Station takes 25 minutes. From Union, transfer to the 509 or 511 streetcar to BMO Field. Total journey from YYZ: approximately 40 minutes.' },
      { mode: 'GO Train', icon: '🚆', description: 'GO Transit trains run from across the Greater Toronto Area to Union Station. From there, transfer to TTC streetcar to BMO Field. Fans from Hamilton, Oakville, Mississauga and Durham Region can ride GO Transit directly.' },
      { mode: 'Billy Bishop Airport (YTZ)', icon: '✈️', description: 'Billy Bishop Toronto City Airport is just 2 km across the water from BMO Field — the closest airport to any World Cup 2026 venue. A short taxi or rideshare connects the island airport to the stadium in minutes. Domestic and US connections available.' },
    ],
    matchInfo: [
      { round: 'Group Stage',  matchCount: 4, description: "Four group stage fixtures at Canada's football home ground" },
      { round: 'Round of 32', matchCount: 2, description: 'Two first-round knockout matches' },
    ],
    stats: [
      { label: 'Capacity',    value: '45,500 (expanded for WC)' },
      { label: 'Opened',      value: '2007 (expanded 2025–26)' },
      { label: 'Location',    value: 'Exhibition Place, Toronto' },
      { label: 'To YYZ',      value: '20 km' },
      { label: 'To YTZ',      value: '2 km' },
      { label: 'Home',        value: 'Canada national team' },
    ],
    faq: [
      { q: 'Why is BMO Field significant for Canadian football?', a: "BMO Field is the home of the Canadian national football (soccer) team and has hosted Canada's most important qualification matches. For Canadian fans, watching the World Cup here — where the national team qualified for the first time since 1986 in 2022 — is deeply meaningful." },
      { q: 'Is BMO Field being expanded for the World Cup?', a: 'Yes. BMO Field is undergoing significant expansion from its original capacity to approximately 45,500 seats specifically to meet FIFA World Cup 2026 requirements. The expansion adds new stands and upgraded facilities throughout the venue.' },
      { q: 'What World Cup 2026 matches are at BMO Field?', a: 'BMO Field hosts four group stage matches and two Round of 32 games during FIFA World Cup 2026.' },
      { q: 'How do I get to BMO Field from downtown Toronto?', a: 'Take the TTC streetcar route 509 (Harbourfront) or 511 (Bathurst) from Union Station to Exhibition Place / BMO Field. The journey takes 10–15 minutes and is very straightforward. Trains are frequent.' },
      { q: 'What is the closest airport to BMO Field?', a: "Billy Bishop Toronto City Airport (YTZ) is literally across the water — just 2 km away — making it the closest airport to any World Cup 2026 venue. It serves domestic and some US routes. Toronto Pearson (YYZ) is 20 km away with full international connections." },
      { q: 'Is BMO Field a covered stadium?', a: 'BMO Field is open-air with a partial canopy covering the main and east stands. Toronto in June–July is warm and generally pleasant (20–26°C), though afternoon thunderstorms are possible. Bring layers for evening games as temperatures drop near the lake.' },
      { q: 'Where exactly is BMO Field in Toronto?', a: "BMO Field is at 170 Princes' Blvd, Toronto, ON M6K 3C3 — within Exhibition Place on the Lakeshore, approximately 3 km west of the CN Tower and downtown core. The waterfront setting offers great views of Lake Ontario." },
    ],
  },

};

export const WC_VENUE_SLUGS = Object.keys(WC_VENUES);

export function getVenue(slug: string): WCVenue | null {
  return WC_VENUES[slug] ?? null;
}
