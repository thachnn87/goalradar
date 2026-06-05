/**
 * src/lib/wc-teams.ts
 *
 * Static configuration for the six featured World Cup 2026 team pages.
 * Dynamic data (fixtures, results, standings) is fetched at render time.
 */

export interface WCTeamBroadcast {
  country: string;
  flag: string;
  channels: string;   // free/cable channels
  streaming: string;  // streaming platforms
}

export interface WCTeam {
  /** URL slug: /world-cup-2026/[slug] */
  slug: string;
  /** Exact team name as returned by football-data.org API */
  apiName: string;
  /** Display name shown on page */
  displayName: string;
  /** Short name for tight spaces */
  shortName: string;
  /** Country flag emoji */
  flag: string;
  /** FIFA world ranking (2024–25) */
  fifaRanking: number;
  /** Current head coach */
  manager: string;
  /** One of the three 2026 co-host nations */
  hostNation: boolean;
  /** ISO 3166-1 alpha-2 — used for structured data */
  countryCode: string;
  /** 150-char SEO meta description */
  metaDescription: string;
  /** 300-word SEO intro for the hero section */
  intro: string;
  /** Tournament history blurb */
  history: string;
  /** 4-6 key players worth mentioning */
  keyPlayers: string[];
  /** Playing style / tactical identity */
  style: string;
  /** Broadcast info per major market */
  broadcasts: WCTeamBroadcast[];
  /** Affiliate CTA label for "How to Watch" section */
  watchCtaLabel: string;
}

// ---------------------------------------------------------------------------
// Team data
// ---------------------------------------------------------------------------

export const WC_TEAMS: Record<string, WCTeam> = {

  usa: {
    slug: 'usa',
    apiName: 'United States',
    displayName: 'United States',
    shortName: 'USA',
    flag: '🇺🇸',
    fifaRanking: 11,
    manager: 'Mauricio Pochettino',
    hostNation: true,
    countryCode: 'US',
    metaDescription:
      'Follow USA at FIFA World Cup 2026. Live scores, fixtures, results, group standings and how to watch every USMNT match.',
    intro:
      'The United States Men\'s National Team enters FIFA World Cup 2026 as one of three co-host nations, ' +
      'carrying the weight of expectation on home soil. Under head coach Mauricio Pochettino, appointed in ' +
      'September 2024, the USMNT boasts a dynamic blend of Premier League stars and Bundesliga talents. ' +
      'Christian Pulisic leads from the front, Gio Reyna supplies creativity in midfield, and Tyler Adams ' +
      'brings relentless energy as the engine of the team. Playing at iconic venues across the United States — ' +
      'from SoFi Stadium in Los Angeles to MetLife Stadium in New Jersey — the Americans will enjoy ' +
      'unprecedented home support. The 2026 World Cup represents the most significant football moment in ' +
      'US history and a golden opportunity to prove the programme has reached global elite level. With the ' +
      '2028 Olympics in Los Angeles on the horizon, this tournament is the first chapter of a transformative ' +
      'era for American soccer.',
    history:
      'The USA qualified for their first World Cup in 1930, finishing third. After a 40-year absence, they ' +
      'returned in 1990 and have qualified for every tournament since. Their best performance remains the ' +
      '2002 quarter-final exit to eventual champions Germany. The USMNT co-hosted the 1994 World Cup — ' +
      'the best-attended tournament in history — and now returns as a host for 2026.',
    keyPlayers: [
      'Christian Pulisic (AC Milan)',
      'Gio Reyna (Borussia Dortmund)',
      'Tyler Adams (Bournemouth)',
      'Weston McKennie (Juventus)',
      'Ricardo Pepi (PSV)',
      'Matt Turner (Crystal Palace)',
    ],
    style:
      'High-press, direct football with quick transitions. Pochettino emphasises vertical play and exploiting wide areas at pace.',
    broadcasts: [
      { country: 'United States', flag: '🇺🇸', channels: 'Fox Sports / Telemundo', streaming: 'Peacock / Fubo / Tubi' },
      { country: 'United Kingdom', flag: '🇬🇧', channels: 'ITV / BBC', streaming: 'ITVX / BBC iPlayer' },
      { country: 'Canada', flag: '🇨🇦', channels: 'CTV / TSN / RDS', streaming: 'Crave / TSN+' },
      { country: 'Australia', flag: '🇦🇺', channels: 'SBS', streaming: 'SBS On Demand' },
    ],
    watchCtaLabel: 'Watch USMNT Live',
  },

  england: {
    slug: 'england',
    apiName: 'England',
    displayName: 'England',
    shortName: 'England',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    fifaRanking: 5,
    manager: 'Thomas Tuchel',
    hostNation: false,
    countryCode: 'GB-ENG',
    metaDescription:
      'Follow England at FIFA World Cup 2026. Live scores, fixtures, results, group standings and how to watch every Three Lions match.',
    intro:
      'England arrive at FIFA World Cup 2026 with genuine title ambitions under German tactician Thomas Tuchel, ' +
      'who took over from Gareth Southgate in January 2025. The Three Lions possess arguably their most ' +
      'talented generation in decades: Jude Bellingham orchestrates from midfield with the authority of a ' +
      'world-class player, Harry Kane continues to break scoring records, and the forward line of Bukayo Saka, ' +
      'Phil Foden and Cole Palmer gives England relentless creative depth. Having reached the final of Euro 2020 ' +
      'and Euro 2024, and the semi-finals of the 2018 World Cup, England are a team that has shed the tournament ' +
      'timidity of past decades. The pressure of 60 years of hurt since 1966 fuels rather than burdens this ' +
      'squad, and North American fans will pack venues to see the Premier League\'s biggest nation in action. ' +
      'Tuchel\'s structural organisation combined with England\'s individual brilliance makes them one of the ' +
      'strongest contenders to lift the trophy.',
    history:
      'England are the 1966 World Cup champions — their only title, won on home soil at Wembley. They have ' +
      'reached four semi-finals (1966, 1990, 2018) and one final (2024 Euros, lost on penalties). ' +
      'Known for dramatic exits, the Three Lions\' 2026 campaign is seen as a genuine title chance.',
    keyPlayers: [
      'Jude Bellingham (Real Madrid)',
      'Harry Kane (Bayern Munich)',
      'Bukayo Saka (Arsenal)',
      'Phil Foden (Manchester City)',
      'Cole Palmer (Chelsea)',
      'Jordan Pickford (Everton)',
    ],
    style:
      'Fluid, possession-based attacking football with exceptional individual quality. Tuchel favours a high line and intense pressing supported by deep technical ability in midfield.',
    broadcasts: [
      { country: 'United Kingdom', flag: '🇬🇧', channels: 'ITV / BBC (free-to-air)', streaming: 'ITVX / BBC iPlayer' },
      { country: 'United States', flag: '🇺🇸', channels: 'Fox Sports / Telemundo', streaming: 'Peacock / Fubo / Tubi' },
      { country: 'Ireland', flag: '🇮🇪', channels: 'RTÉ / Virgin Media', streaming: 'RTÉ Player' },
      { country: 'Australia', flag: '🇦🇺', channels: 'SBS', streaming: 'SBS On Demand' },
    ],
    watchCtaLabel: 'Watch England Live',
  },

  brazil: {
    slug: 'brazil',
    apiName: 'Brazil',
    displayName: 'Brazil',
    shortName: 'Brazil',
    flag: '🇧🇷',
    fifaRanking: 5,
    manager: 'Dorival Júnior',
    hostNation: false,
    countryCode: 'BR',
    metaDescription:
      'Follow Brazil at FIFA World Cup 2026. Live scores, fixtures, results, group standings and how to watch every Seleção match.',
    intro:
      'Brazil — the Seleção — are the most successful nation in World Cup history with five titles, and they ' +
      'arrive in North America hungry to end a 24-year wait for a sixth. Head coach Dorival Júnior leads a ' +
      'squad built around Vinícius Júnior, the Real Madrid star who has become one of the most electrifying ' +
      'players on the planet. Endrick, still a teenager, brings explosive finishing power off the bench and ' +
      'from the start, while Rodrygo and Raphinha add width and unpredictability. The Seleção underperformed ' +
      'at Qatar 2022, falling in the quarter-finals to Croatia on penalties. That exit still stings the ' +
      'nation, and the 2026 campaign carries enormous redemptive weight. Brazil\'s technical brilliance, ' +
      'physical intensity and attacking depth make them one of the most watchable teams in the tournament ' +
      '— and one of the most feared by any opponent. A Seleção match is always an event, always electric, ' +
      'and always capable of producing the extraordinary.',
    history:
      'Brazil hold the record for most World Cup titles with five: 1958, 1962, 1970, 1994 and 2002. ' +
      'They are the only nation to have competed in every World Cup. Their 7-1 loss to Germany in the ' +
      '2014 semi-final on home soil remains one of the most shocking results in tournament history.',
    keyPlayers: [
      'Vinícius Júnior (Real Madrid)',
      'Rodrygo (Real Madrid)',
      'Endrick (Real Madrid)',
      'Raphinha (Barcelona)',
      'Casemiro (Manchester United)',
      'Alisson (Liverpool)',
    ],
    style:
      'Expressive, technically gifted attacking football rooted in Brazilian tradition. High energy pressing combined with creative individual improvisation in the final third.',
    broadcasts: [
      { country: 'Brazil', flag: '🇧🇷', channels: 'TV Globo / SBT / Record', streaming: 'GloboPlay / CazéTV' },
      { country: 'United States', flag: '🇺🇸', channels: 'Fox Sports / Telemundo', streaming: 'Peacock / Fubo / Tubi' },
      { country: 'United Kingdom', flag: '🇬🇧', channels: 'ITV / BBC', streaming: 'ITVX / BBC iPlayer' },
      { country: 'Latin America', flag: '🌎', channels: 'ESPN / Canal del Fútbol', streaming: 'Disney+ / Star+' },
    ],
    watchCtaLabel: 'Watch Brazil Live',
  },

  argentina: {
    slug: 'argentina',
    apiName: 'Argentina',
    displayName: 'Argentina',
    shortName: 'Argentina',
    flag: '🇦🇷',
    fifaRanking: 1,
    manager: 'Lionel Scaloni',
    hostNation: false,
    countryCode: 'AR',
    metaDescription:
      'Follow Argentina at FIFA World Cup 2026. Live scores, fixtures, results, group standings and how to watch the defending champions.',
    intro:
      'Argentina are the defending World Cup champions, arriving at FIFA World Cup 2026 as FIFA\'s number one ' +
      'ranked side under the continued stewardship of Lionel Scaloni. Their 2022 triumph in Qatar — secured ' +
      'in one of the greatest finals ever played — was the defining achievement of an era built around Lionel ' +
      'Messi. At 38, Messi may be making his final World Cup appearance, adding a poignant, emotional layer ' +
      'to every Argentina match. Around him, Lautaro Martínez has emerged as one of the world\'s most clinical ' +
      'strikers, Emiliano Martínez remains a world-class shot-stopper who won the Best Goalkeeper award in ' +
      '2022, and Enzo Fernández anchors midfield with composure beyond his years. Argentina are unbeaten in ' +
      'competitive international football over multiple years, a run that speaks to the group\'s unity and ' +
      'belief. Defending the title on foreign soil is historically the hardest task in football, but this ' +
      'Argentina side has the quality and mentality to attempt the unprecedented back-to-back.',
    history:
      'Argentina have won the World Cup three times: 1978 (home), 1986 (Maradona\'s iconic tournament) and ' +
      '2022 (Messi\'s crowning glory in Qatar). They have also reached four finals, losing in 1930, 1990 and ' +
      '2014. The Albiceleste are consistently one of the sport\'s great powers.',
    keyPlayers: [
      'Lionel Messi (Inter Miami)',
      'Lautaro Martínez (Inter Milan)',
      'Emiliano Martínez (Aston Villa)',
      'Enzo Fernández (Chelsea)',
      'Julián Álvarez (Atlético Madrid)',
      'Rodrigo De Paul (Atlético Madrid)',
    ],
    style:
      'Pragmatic, adaptable football that combines defensive solidity with devastating counter-attacking pace and the match-winning individual quality of Messi and Lautaro.',
    broadcasts: [
      { country: 'Argentina', flag: '🇦🇷', channels: 'TyC Sports / Telefé / Canal 13', streaming: 'DirecTV Sports / Star+' },
      { country: 'United States', flag: '🇺🇸', channels: 'Fox Sports / Telemundo', streaming: 'Peacock / Fubo / Tubi' },
      { country: 'United Kingdom', flag: '🇬🇧', channels: 'ITV / BBC', streaming: 'ITVX / BBC iPlayer' },
      { country: 'Latin America', flag: '🌎', channels: 'ESPN / DSports', streaming: 'Disney+ / Star+' },
    ],
    watchCtaLabel: 'Watch Argentina Live',
  },

  mexico: {
    slug: 'mexico',
    apiName: 'Mexico',
    displayName: 'Mexico',
    shortName: 'Mexico',
    flag: '🇲🇽',
    fifaRanking: 15,
    manager: 'Javier Aguirre',
    hostNation: true,
    countryCode: 'MX',
    metaDescription:
      'Follow Mexico at FIFA World Cup 2026. Live scores, fixtures, results, group standings and how to watch El Tri on home soil.',
    intro:
      'Mexico return to the World Cup stage as one of three co-host nations, a historic opportunity for ' +
      '"El Tri" to finally break the "quinto partido" curse — the nickname given to Mexico\'s remarkable ' +
      'run of seven consecutive Round of 16 exits between 1994 and 2018. Under veteran manager Javier ' +
      'Aguirre, who previously led the team in 2006 and 2010, Mexico will play their group stage matches ' +
      'in iconic Mexican cities and US stadiums filled with millions of passionate supporters. Santiago ' +
      'Giménez has emerged as one of the most dangerous strikers in European football with Feyenoord and ' +
      'AC Milan, giving Mexico a focal point they have lacked in recent years. The passion of Mexican ' +
      'football culture — the ear-splitting noise of Azteca Stadium and the green-shirted legions who ' +
      'travel everywhere — makes every El Tri match an unforgettable spectacle. Co-hosting a World Cup ' +
      'for the second time (after 1970 and 1986), Mexico have every structural advantage to go deeper ' +
      'than the last 16.',
    history:
      'Mexico have participated in 17 World Cups, reaching the quarter-finals in 1970 and 1986 — both ' +
      'on home soil. Since 1994, they have reached the last 16 in seven consecutive tournaments. ' +
      'Co-hosting in 2026 ends a wait dating back to their own 1986 finals for a deep run.',
    keyPlayers: [
      'Santiago Giménez (AC Milan)',
      'Hirving Lozano (PSV / Club América)',
      'Edson Álvarez (West Ham)',
      'Alexis Vega (Toluca)',
      'Guillermo Ochoa (Salernitana)',
      'Henry Martín (Club América)',
    ],
    style:
      'Organised, disciplined defensive shape with quick, direct counter-attacks through wide channels. Aguirre emphasises team unity and set-piece threat.',
    broadcasts: [
      { country: 'Mexico', flag: '🇲🇽', channels: 'Azteca / Canal 5 / TUDN', streaming: 'ViX / TUDN Premium' },
      { country: 'United States', flag: '🇺🇸', channels: 'Fox Sports / Telemundo', streaming: 'Peacock / Fubo / Tubi' },
      { country: 'United Kingdom', flag: '🇬🇧', channels: 'ITV / BBC', streaming: 'ITVX / BBC iPlayer' },
      { country: 'Latin America', flag: '🌎', channels: 'ESPN / Fox Sports', streaming: 'Disney+ / Star+' },
    ],
    watchCtaLabel: 'Watch Mexico Live',
  },

  canada: {
    slug: 'canada',
    apiName: 'Canada',
    displayName: 'Canada',
    shortName: 'Canada',
    flag: '🇨🇦',
    fifaRanking: 40,
    manager: 'Jesse Marsch',
    hostNation: true,
    countryCode: 'CA',
    metaDescription:
      'Follow Canada at FIFA World Cup 2026. Live scores, fixtures, results, group standings and how to watch Les Rouges as co-hosts.',
    intro:
      'Canada enter FIFA World Cup 2026 as one of three co-host nations and fresh from their historic ' +
      'qualification for Qatar 2022 — their first World Cup since 1986. After building momentum over ' +
      'the past decade, Les Rouges are making this tournament a coming-of-age moment for Canadian football. ' +
      'Alphonso Davies, Bayern Munich\'s electric left back, is one of the most dynamic players in world ' +
      'football and will be the focus of attention wherever Canada play. Jonathan David, the prolific ' +
      'Lille striker, provides a world-class goalscoring threat up front, and Tajon Buchanan adds ' +
      'pace and directness on the right. Jesse Marsch, with his extensive European management experience, ' +
      'brings tactical credibility and an attacking philosophy that suits Canada\'s squad profile. ' +
      'Playing matches in Toronto, Vancouver and various US cities, Canada will have the loudest home ' +
      'support of any tournament in their history. Expectations are growing and the infrastructure is ' +
      'finally matching the talent — 2026 could be the tournament where Canada announces itself to the world.',
    history:
      'Canada made their sole previous World Cup appearance in 1986, losing all three group stage ' +
      'games without scoring. Their 2022 qualification as CONCACAF leaders — ending a 36-year wait ' +
      '— marked a watershed moment. As 2026 co-hosts, Canada play their first World Cup on home soil.',
    keyPlayers: [
      'Alphonso Davies (Bayern Munich)',
      'Jonathan David (Lille)',
      'Tajon Buchanan (Inter Milan)',
      'Cyle Larin (Club Brugge)',
      'Milan Borjan (Red Star Belgrade)',
      'Stephen Eustáquio (FC Porto)',
    ],
    style:
      'Marsch\'s high-press system with direct, vertical ball progression. Davies provides devastating width and pace on the left, while David\'s movement creates space in central areas.',
    broadcasts: [
      { country: 'Canada', flag: '🇨🇦', channels: 'CTV / TSN / RDS / Noovo', streaming: 'TSN+ / Crave / RDS+' },
      { country: 'United States', flag: '🇺🇸', channels: 'Fox Sports / Telemundo', streaming: 'Peacock / Fubo / Tubi' },
      { country: 'United Kingdom', flag: '🇬🇧', channels: 'ITV / BBC', streaming: 'ITVX / BBC iPlayer' },
      { country: 'Australia', flag: '🇦🇺', channels: 'SBS', streaming: 'SBS On Demand' },
    ],
    watchCtaLabel: 'Watch Canada Live',
  },

};

/** All slugs that have team pages */
export const WC_TEAM_SLUGS = Object.keys(WC_TEAMS);

/** Look up a team by its URL slug. */
export function getTeamBySlug(slug: string): WCTeam | null {
  return WC_TEAMS[slug] ?? null;
}

/** Find a team's group from match data (uses the `group` field on Match). */
export function findTeamGroupFromMatches(
  matches: { group: string | null; homeTeam?: { name: string } | null; awayTeam?: { name: string } | null }[],
  apiName: string,
): string | null {
  const m = matches.find(
    (x) => x.homeTeam?.name === apiName || x.awayTeam?.name === apiName,
  );
  return m?.group ?? null;
}
