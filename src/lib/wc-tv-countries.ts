/**
 * src/lib/wc-tv-countries.ts
 *
 * TV-schedule-focused data for /world-cup-2026/tv-schedule/[country] pages.
 * Emphasises channels, frequency and kick-off times — complementary to the
 * streaming-focused data in wc-watch-countries.ts.
 */

export interface TVChannel {
  name: string;
  type: 'free-tv' | 'cable' | 'streaming-free' | 'streaming-paid';
  language: string;
  coverage: string;   // "All 104 matches" | "Selected matches" | etc.
  where: string;      // "TV Ch. 5 + App" | "Cable/Satellite"
}

export interface TVKickoff {
  utcTime: string;
  localTime: string;
  slot: string;        // "Morning" | "Afternoon" | etc.
  friendly: boolean;   // true = civilised viewing time
}

export interface TVFaqItem {
  q: string;
  a: string;
}

export interface WCTVCountry {
  slug: string;
  name: string;
  flag: string;
  timezone: string;     // IANA
  utcOffset: string;    // display, e.g. "UTC+7"
  metaTitle: string;
  metaDesc: string;
  heroSubtitle: string;
  intro: string;
  channels: TVChannel[];
  kickoffs: TVKickoff[];
  /** Best option for the casual fan */
  bestPickFree: string;
  /** Best for comprehensive coverage */
  bestPickPaid: string;
  faq: TVFaqItem[];
}

// ---------------------------------------------------------------------------
// Country data
// ---------------------------------------------------------------------------

export const WC_TV_COUNTRIES: Record<string, WCTVCountry> = {

  // ── United States ──────────────────────────────────────────────────────────
  usa: {
    slug: 'usa',
    name: 'United States',
    flag: '🇺🇸',
    timezone: 'America/New_York',
    utcOffset: 'UTC−4 (EDT)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule USA – Fox, Telemundo & Channel Guide | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for the USA. Find every match channel — Fox, FS1, FS2, Telemundo — with kick-off times in Eastern, Central and Pacific time.',
    heroSubtitle: 'Every match on Fox (English) or Telemundo (Spanish). Check kick-off times in ET, CT and PT.',
    intro:
      'As a co-host nation, the USA has the most comprehensive World Cup 2026 TV schedule of any ' +
      'country. Fox holds exclusive English-language broadcast rights across Fox, FS1 and FS2, while ' +
      'Telemundo and Universo carry every match in Spanish. Because the USA is hosting games in cities ' +
      'spanning Eastern, Central and Mountain time zones, match times vary — but all four daily kick-off ' +
      'slots are at civilised hours for American viewers. The morning slot (12:00 PM ET) is ideal for ' +
      'east-coast viewers at lunch, while the 9:00 PM ET prime-time slot is perfect for evening ' +
      'viewing across the country. With the USMNT playing group stage games at MetLife Stadium (NJ), ' +
      'AT&T Stadium (Dallas) and SoFi Stadium (LA), every national team match will air on Fox — ' +
      'the most-watched cable/OTA sports network in the country.',
    channels: [
      { name: 'Fox (OTA/Cable)',    type: 'free-tv',         language: 'English', coverage: 'Key matches + USMNT',        where: 'Ch. varies by market + OTA antenna' },
      { name: 'FS1',                type: 'cable',           language: 'English', coverage: 'Full group stage slate',      where: 'Cable/Satellite Ch. + Fox Sports App' },
      { name: 'FS2',                type: 'cable',           language: 'English', coverage: 'Overflow / group stage',      where: 'Cable/Satellite Ch. + Fox Sports App' },
      { name: 'Telemundo',          type: 'free-tv',         language: 'Spanish', coverage: 'Key matches + USMNT',         where: 'Ch. varies by market + OTA antenna' },
      { name: 'Universo',           type: 'cable',           language: 'Spanish', coverage: 'Full Spanish coverage',       where: 'Cable/Satellite Ch. + Telemundo App' },
      { name: 'Fox Sports App',     type: 'streaming-paid',  language: 'English', coverage: 'All Fox/FS1/FS2 matches',     where: 'iOS / Android / Smart TV (with TV login)' },
      { name: 'Peacock',            type: 'streaming-paid',  language: 'English', coverage: 'All Fox Sports matches',      where: 'App / Web — from $7.99/month' },
      { name: 'Fubo TV',            type: 'streaming-paid',  language: 'En + Es', coverage: 'All 104 matches',             where: 'App / Web — from $79.99/month' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '12:00 PM ET / 11:00 AM CT / 9:00 AM PT',  slot: 'Midday',      friendly: true  },
      { utcTime: '19:00 UTC', localTime: '3:00 PM ET / 2:00 PM CT / 12:00 PM PT',   slot: 'Afternoon',   friendly: true  },
      { utcTime: '22:00 UTC', localTime: '6:00 PM ET / 5:00 PM CT / 3:00 PM PT',    slot: 'Early Evening', friendly: true },
      { utcTime: '01:00 UTC', localTime: '9:00 PM ET / 8:00 PM CT / 6:00 PM PT',    slot: 'Prime Time',  friendly: true  },
    ],
    bestPickFree: 'Fox / Telemundo via OTA antenna — completely free',
    bestPickPaid: 'Fubo TV — all 104 matches on both Fox and Telemundo',
    faq: [
      { q: 'What channel is the World Cup 2026 on in the USA?', a: 'In the USA, Fox holds the English-language rights across Fox, FS1 and FS2. Spanish-language coverage is on Telemundo and Universo. All USMNT matches air on Fox and Telemundo.' },
      { q: 'What time do World Cup 2026 matches kick off in the USA?', a: 'Group stage matches kick off at 12:00 PM, 3:00 PM, 6:00 PM and 9:00 PM Eastern Time (ET). All times are civilised for US viewers — no overnight or early-morning matches.' },
      { q: 'What channel are USMNT World Cup matches on?', a: 'All USMNT matches air on Fox (English) and Telemundo (Spanish). These are the primary channels for the highest-profile matches, including all US national team games.' },
      { q: 'Can I watch World Cup 2026 without cable in the USA?', a: 'Yes. Fox and Telemundo are available free over-the-air with an OTA antenna. For cable channels like FS1/FS2, use Peacock, Fubo TV, YouTube TV or Sling TV. Most services offer free trials.' },
      { q: 'Is the World Cup Final on Fox in the USA?', a: 'Yes, the World Cup 2026 Final on 19 July at MetLife Stadium will air on Fox in the USA. It is the marquee event of the tournament and Fox will provide full coverage in primetime.' },
      { q: 'What is the World Cup 2026 Final kick-off time in the USA?', a: 'The Final at MetLife Stadium on 19 July 2026 is expected to kick off at approximately 7:00 PM ET (4:00 PM PT). The exact time will be confirmed closer to the tournament.' },
      { q: 'Can I stream World Cup 2026 matches on my phone in the USA?', a: 'Yes. The Fox Sports app (with cable/satellite login), Peacock, Fubo TV, YouTube TV and the Telemundo Deportes app all support mobile streaming on iOS and Android.' },
      { q: 'Is World Cup 2026 on YouTube TV in the USA?', a: 'Yes. YouTube TV ($72.99/month) includes Fox, FS1, FS2, Telemundo and Universo — all four channels with World Cup rights. It also offers unlimited DVR for recording every match.' },
    ],
  },

  // ── Canada ─────────────────────────────────────────────────────────────────
  canada: {
    slug: 'canada',
    name: 'Canada',
    flag: '🇨🇦',
    timezone: 'America/Toronto',
    utcOffset: 'UTC−4 (EDT)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule Canada – TSN, CTV & Channel Guide | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for Canada. Find every match on TSN, CTV, RDS and streaming platforms, with kick-off times in Eastern and Pacific time.',
    heroSubtitle: 'TSN carries all 104 matches. CTV shows Canada games free. Check local kick-off times.',
    intro:
      'Canada is a co-host of the 2026 World Cup, and the Canadian TV schedule reflects the enormous ' +
      'national interest in the tournament. TSN holds comprehensive English-language broadcast rights, ' +
      'carrying all 104 matches across TSN 1–5. CTV, Bell Media\'s free-to-air network, broadcasts ' +
      'selected high-profile matches — including all Canadian national team games — at no cost. ' +
      'For French-language viewers, RDS and TVA Sports provide equivalent coverage, with Noovo as ' +
      'the free-to-air French option. As a co-host nation, Canada\'s group stage games at BMO Field ' +
      '(Toronto) and BC Place (Vancouver) will draw record domestic audiences. All times on the ' +
      'Canadian TV schedule follow Eastern Time (ET) for most of the country, with a 3-hour offset ' +
      'to Pacific Time for viewers in British Columbia.',
    channels: [
      { name: 'TSN 1–5',        type: 'cable',          language: 'English', coverage: 'All 104 matches',          where: 'Cable/Satellite + TSN Direct app' },
      { name: 'TSN Direct',     type: 'streaming-paid', language: 'English', coverage: 'All 104 matches',          where: 'App / Web — $19.99/month standalone' },
      { name: 'CTV',            type: 'free-tv',         language: 'English', coverage: 'Canada games + key fixtures', where: 'OTA + CTV app (free)' },
      { name: 'RDS / TVA Sports', type: 'cable',         language: 'French',  coverage: 'All matches (French)',     where: 'Cable/Satellite (Quebec/Francophone)' },
      { name: 'Noovo',          type: 'free-tv',         language: 'French',  coverage: 'Canada games (French)',   where: 'OTA + Noovo app (free)' },
      { name: 'Crave',          type: 'streaming-paid', language: 'English', coverage: 'Via CTV/TSN add-on',      where: 'App / Web — from $9.99/month' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '12:00 PM ET / 9:00 AM PT',  slot: 'Midday',      friendly: true  },
      { utcTime: '19:00 UTC', localTime: '3:00 PM ET / 12:00 PM PT',  slot: 'Afternoon',   friendly: true  },
      { utcTime: '22:00 UTC', localTime: '6:00 PM ET / 3:00 PM PT',   slot: 'Early Evening', friendly: true },
      { utcTime: '01:00 UTC', localTime: '9:00 PM ET / 6:00 PM PT',   slot: 'Prime Time',  friendly: true  },
    ],
    bestPickFree: 'CTV (English free) / Noovo (French free) — Canada games guaranteed',
    bestPickPaid: 'TSN Direct — all 104 matches streamed without cable',
    faq: [
      { q: 'What channel is the World Cup 2026 on in Canada?', a: 'TSN holds comprehensive English-language rights across TSN 1–5. CTV broadcasts selected matches (including all Canadian games) free. French-language coverage is on RDS, TVA Sports and Noovo.' },
      { q: 'What time do World Cup 2026 matches kick off in Canada?', a: 'Group stage matches kick off at 12:00 PM, 3:00 PM, 6:00 PM and 9:00 PM Eastern Time. Subtract 3 hours for Pacific Time (9:00 AM, 12:00 PM, 3:00 PM and 6:00 PM PT).' },
      { q: 'Are Canadian team World Cup matches on CTV?', a: 'Yes. All Canadian national team matches are guaranteed to air free on CTV in English and Noovo in French. This is confirmed under Canadian broadcast regulations.' },
      { q: 'How to watch World Cup 2026 without cable in Canada?', a: 'TSN Direct is the main cord-cutting option at $19.99/month — all 104 matches without cable. CTV app is free for Canada games. Crave with a TSN add-on is another option.' },
      { q: 'Is the World Cup 2026 on CBC in Canada?', a: 'TSN and CTV hold the primary World Cup rights. CBC may carry some high-profile matches as a public broadcaster — watch for announcements. CBC Gem may offer additional streaming.' },
      { q: 'What time is the World Cup 2026 Final in Canada?', a: 'The Final on 19 July 2026 at MetLife Stadium is expected at approximately 7:00 PM ET (4:00 PM PT). TSN and CTV will both broadcast the Final.' },
      { q: 'Can I stream World Cup 2026 on my phone in Canada?', a: 'Yes. TSN Direct and the TSN app (with subscription) stream all matches on mobile. The CTV app is free for selected matches. The RDS and Noovo apps serve French-language viewers.' },
      { q: 'Is RDS showing World Cup 2026 matches in Canada?', a: 'Yes. RDS and TVA Sports carry French-language rights for World Cup 2026 in Canada, covering all matches for Quebec and Francophone viewers. Noovo shows selected matches free.' },
    ],
  },

  // ── United Kingdom ─────────────────────────────────────────────────────────
  uk: {
    slug: 'uk',
    name: 'United Kingdom',
    flag: '🇬🇧',
    timezone: 'Europe/London',
    utcOffset: 'UTC+1 (BST)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule UK – BBC, ITV & Match Times | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for the UK. Every match on BBC or ITV — completely free. Find exact kick-off times in BST and which channel shows each game.',
    heroSubtitle: 'Every match free on BBC and ITV. Stream free on BBC iPlayer and ITVX. Check UK kick-off times.',
    intro:
      'The UK has one of the world\'s best World Cup TV deals — every single match is free. ' +
      'The BBC and ITV share broadcast rights for World Cup 2026, meaning all 104 games are ' +
      'available on free-to-air television and free streaming services (BBC iPlayer and ITVX). ' +
      'Matches in June and July air during British Summer Time (BST, UTC+1). The most convenient ' +
      'kick-off times for UK viewers are the 5:00 PM and 8:00 PM BST slots, which fall squarely ' +
      'in prime-time viewing. The 11:00 PM BST slot is late but manageable for big games — ' +
      'particularly England matches — while the 2:00 AM BST overnight slot requires either a ' +
      'very dedicated fan or a DVR recording. The BBC and ITV typically alternate high-profile ' +
      'games, with England fixtures split between both channels based on match scheduling.',
    channels: [
      { name: 'BBC One / Two',  type: 'free-tv',         language: 'English', coverage: 'Approx. half the tournament', where: 'Freeview, Sky, Virgin + BBC iPlayer' },
      { name: 'BBC iPlayer',    type: 'streaming-free',  language: 'English', coverage: 'All BBC matches live + replay', where: 'App / Web (free account required)' },
      { name: 'ITV1 / ITV2',   type: 'free-tv',         language: 'English', coverage: 'Approx. half the tournament', where: 'Freeview, Sky, Virgin + ITVX' },
      { name: 'ITVX',          type: 'streaming-free',  language: 'English', coverage: 'All ITV matches live + replay', where: 'App / Web (free account required)' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '5:00 PM BST',   slot: 'Early Evening', friendly: true  },
      { utcTime: '19:00 UTC', localTime: '8:00 PM BST',   slot: 'Prime Time',    friendly: true  },
      { utcTime: '22:00 UTC', localTime: '11:00 PM BST',  slot: 'Late Night',    friendly: false },
      { utcTime: '01:00 UTC', localTime: '2:00 AM BST',   slot: 'Overnight',     friendly: false },
    ],
    bestPickFree: 'BBC iPlayer or ITVX — genuinely free, all matches',
    bestPickPaid: 'N/A — no paid option needed. All matches are free.',
    faq: [
      { q: 'What channel is the World Cup 2026 on in the UK?', a: 'All World Cup 2026 matches are split between the BBC and ITV — both free-to-air. BBC One, BBC Two, ITV1 and ITV2 share the rights, with free online streaming on BBC iPlayer and ITVX.' },
      { q: 'What time do World Cup 2026 matches kick off in the UK?', a: 'UK kick-off times in British Summer Time (BST): 5:00 PM, 8:00 PM, 11:00 PM and 2:00 AM. The 5:00 PM and 8:00 PM slots are the best for prime-time viewing.' },
      { q: 'Is the World Cup 2026 free to watch in the UK?', a: 'Yes — 100% free. BBC and ITV share all broadcast rights. Every match is on free-to-air TV and free streaming (BBC iPlayer / ITVX), listed as a protected event under UK broadcasting law.' },
      { q: 'What time are England World Cup matches in the UK?', a: 'England\'s group stage kick-off times depend on their schedule slot. Typically either the 5:00 PM, 8:00 PM or 11:00 PM BST slot. The BBC and ITV typically both broadcast England games, sharing coverage.' },
      { q: 'When is the World Cup 2026 Final in UK time?', a: 'The Final on 19 July 2026 is expected around midnight BST (approximately 12:00 AM–1:00 AM BST on 20 July). Exact times will be confirmed closer to the tournament.' },
      { q: 'Is BBC or ITV showing World Cup 2026 matches?', a: 'Both. The BBC and ITV share all 104 matches — roughly half each. The split is negotiated and typically gives both channels flagship games. England matches appear on both channels throughout the tournament.' },
      { q: 'Can I watch World Cup 2026 on BBC iPlayer from abroad?', a: 'BBC iPlayer is geo-restricted to the UK. If you\'re a UK resident travelling abroad, a VPN with a UK server will restore access. Note that VPN use may not comply with BBC\'s terms.' },
      { q: 'Do I need a TV licence to watch World Cup 2026 in the UK?', a: 'A TV licence is required to watch live broadcasts on BBC or ITV. However, you can stream ITVX live without a licence. BBC iPlayer requires a licence for live TV but not for on-demand replay.' },
    ],
  },

  // ── Thailand ────────────────────────────────────────────────────────────────
  thailand: {
    slug: 'thailand',
    name: 'Thailand',
    flag: '🇹🇭',
    timezone: 'Asia/Bangkok',
    utcOffset: 'UTC+7 (ICT)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule Thailand – TrueVisions & Channel Guide | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for Thailand. Find every match on TrueVisions, True Sport and PPTV with kick-off times in Bangkok (ICT, UTC+7).',
    heroSubtitle: 'TrueVisions has rights to all matches. PPTV may carry free-to-air games. Check Bangkok kick-off times.',
    intro:
      'Thailand is one of Southeast Asia\'s most football-passionate nations, with millions of fans ' +
      'following the Premier League and Champions League year-round. For FIFA World Cup 2026, ' +
      'TrueVisions holds the primary broadcast rights with comprehensive coverage across True Sport ' +
      '1–7 channels and the TrueID streaming app. PPTV, which broadcast free-to-air World Cup ' +
      'matches in 2018, may carry selected games in 2026 — official announcements are expected ' +
      'closer to the tournament. Thailand\'s time zone (ICT, UTC+7) means North American matches ' +
      'air from 11:00 PM to 8:00 AM local time — a schedule Thai fans are well-accustomed to, ' +
      'having watched late-night Premier League and Champions League fixtures for years. ' +
      'The 8:00 AM slot is the most convenient, airing during morning weekday and weekend viewing.',
    channels: [
      { name: 'True Sport 1–7 (TrueVisions)', type: 'cable',          language: 'Thai/English', coverage: 'All matches', where: 'TrueVisions satellite + cable' },
      { name: 'TrueID App',                   type: 'streaming-paid', language: 'Thai/English', coverage: 'All matches (TrueVisions subscribers)', where: 'iOS / Android / Smart TV' },
      { name: 'PPTV (Ch. 36)',                type: 'free-tv',         language: 'Thai',         coverage: 'Selected matches (TBC 2026)', where: 'Freeview digital TV Ch. 36 + PPTV app' },
      { name: 'AIS Play',                     type: 'streaming-paid', language: 'Thai/English', coverage: 'Selected matches', where: 'AIS subscriber benefit — mobile app' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '11:00 PM ICT',                  slot: 'Late Night',          friendly: false },
      { utcTime: '19:00 UTC', localTime: '2:00 AM ICT (next day)',         slot: 'Early Morning',       friendly: false },
      { utcTime: '22:00 UTC', localTime: '5:00 AM ICT',                   slot: 'Very Early Morning',  friendly: false },
      { utcTime: '01:00 UTC', localTime: '8:00 AM ICT',                   slot: 'Morning (best slot)', friendly: true  },
    ],
    bestPickFree: 'PPTV — free-to-air (selected matches, to be confirmed for 2026)',
    bestPickPaid: 'TrueVisions / TrueID — comprehensive coverage of all matches',
    faq: [
      { q: 'ดูฟุตบอลโลก 2026 ช่องอะไร / What channel is World Cup 2026 on in Thailand?', a: 'TrueVisions holds the primary rights in Thailand with coverage on True Sport channels and the TrueID app. PPTV (Ch. 36) may carry selected free-to-air matches — check their announcements closer to June 2026.' },
      { q: 'World Cup 2026 kick-off times in Thailand (Bangkok)?', a: 'In Bangkok time (ICT, UTC+7), World Cup 2026 group stage matches kick off at: 11:00 PM, 2:00 AM, 5:00 AM and 8:00 AM. The 8:00 AM morning slot is the most convenient for viewing.' },
      { q: 'Is World Cup 2026 free to watch in Thailand?', a: 'TrueVisions requires a subscription for full coverage. PPTV (Ch. 36) may carry selected matches free — this was the case in 2018. Confirm with PPTV and TrueVisions closer to the tournament date.' },
      { q: 'Can I stream World Cup 2026 on TrueID in Thailand?', a: 'Yes. TrueID is TrueVisions\' streaming app available on iOS, Android and Smart TV. If you have a TrueVisions subscription, log in to TrueID to watch all True Sport coverage live.' },
      { q: 'What time is the World Cup 2026 Final in Thailand?', a: 'The Final on 19 July 2026 is expected at approximately 7:00 PM ET (Miami/New York time), which is 6:00 AM on 20 July in Thailand (ICT). Set an early alarm or check TrueID for replay.' },
      { q: 'How to watch World Cup 2026 without TrueVisions in Thailand?', a: 'Check whether PPTV (Ch. 36 on Freeview digital TV) is broadcasting selected matches in 2026. If you prefer international commentary, a VPN with UK or US servers gives access to BBC iPlayer or Peacock.' },
      { q: 'Does AIS have World Cup 2026 in Thailand?', a: 'AIS Play may carry selected World Cup matches as part of AIS mobile subscriber benefits. Check the AIS Play app for World Cup 2026 content closer to the tournament.' },
      { q: 'How can expats watch their home country\'s World Cup broadcast in Thailand?', a: 'Use a VPN with servers in your home country. UK residents can use BBC iPlayer, Australians SBS On Demand, and Americans Fox Sports via a US VPN server.' },
    ],
  },

  // ── Vietnam ─────────────────────────────────────────────────────────────────
  vietnam: {
    slug: 'vietnam',
    name: 'Vietnam',
    flag: '🇻🇳',
    timezone: 'Asia/Ho_Chi_Minh',
    utcOffset: 'UTC+7 (ICT)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule Vietnam – FPT Play, VTV & Channel Guide | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for Vietnam. Find every match on FPT Play, VTV and K+ with kick-off times in Hanoi and Ho Chi Minh City (ICT, UTC+7).',
    heroSubtitle: 'FPT Play streams all matches. VTV shows selected games free. Check Vietnam kick-off times.',
    intro:
      'Vietnam has one of Southeast Asia\'s most passionate football cultures, with enormous ' +
      'audiences for the Premier League, Champions League and major international tournaments. ' +
      'FPT Corporation (FPT Play) holds comprehensive digital streaming rights for World Cup 2026 ' +
      'in Vietnam, offering live access to all matches via app and web browser. VTV (Vietnam ' +
      'Television) carries selected free-to-air matches on public channels, as is traditional for ' +
      'major tournaments. K+ satellite TV may provide additional coverage for subscribers. ' +
      'Vietnam shares the ICT time zone with Thailand (UTC+7), meaning the same late-night to ' +
      'early-morning match schedule. The 8:00 AM ICT morning slot — typically a weekend slot for ' +
      'group stage games — is the most accessible for Vietnamese fans. FPT Play\'s mobile-first ' +
      'platform is particularly well-suited to Vietnam\'s smartphone-heavy viewing habits.',
    channels: [
      { name: 'FPT Play',       type: 'streaming-paid', language: 'Vietnamese', coverage: 'All/most matches', where: 'iOS / Android / Web / Smart TV (FPT subscription)' },
      { name: 'VTV (public TV)', type: 'free-tv',        language: 'Vietnamese', coverage: 'Selected matches (opening, semis, final)', where: 'National TV broadcast + VTV Go app' },
      { name: 'K+ (K Plus)',    type: 'cable',           language: 'Vietnamese', coverage: 'Selected matches (TBC)', where: 'K+ satellite TV + K+ app' },
      { name: 'VTC',            type: 'free-tv',         language: 'Vietnamese', coverage: 'Selected matches (TBC)', where: 'Digital terrestrial TV' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '11:00 PM ICT',                 slot: 'Late Night',          friendly: false },
      { utcTime: '19:00 UTC', localTime: '2:00 AM ICT (next day)',        slot: 'Early Morning',       friendly: false },
      { utcTime: '22:00 UTC', localTime: '5:00 AM ICT',                  slot: 'Very Early Morning',  friendly: false },
      { utcTime: '01:00 UTC', localTime: '8:00 AM ICT',                  slot: 'Morning (best slot)', friendly: true  },
    ],
    bestPickFree: 'VTV — selected matches free on public TV and VTV Go app',
    bestPickPaid: 'FPT Play — comprehensive streaming of all matches',
    faq: [
      { q: 'World Cup 2026 xem kênh gì / What channel is World Cup 2026 on in Vietnam?', a: 'FPT Play holds comprehensive streaming rights for World Cup 2026 in Vietnam. VTV (Vietnam Television) broadcasts selected matches free on public TV. K+ may carry additional coverage for satellite subscribers.' },
      { q: 'World Cup 2026 mấy giờ / What time do matches kick off in Vietnam?', a: 'In Vietnam (ICT, UTC+7), World Cup 2026 group stage matches start at: 11:00 PM, 2:00 AM, 5:00 AM and 8:00 AM. The 8:00 AM morning slot is the best for viewing.' },
      { q: 'Is World Cup 2026 free on VTV in Vietnam?', a: 'VTV traditionally carries selected World Cup matches free, including the opening match, semi-finals and final. For full access to all 104 group stage matches, FPT Play or K+ subscription is recommended.' },
      { q: 'FPT Play có chiếu World Cup 2026 không / Does FPT Play show World Cup 2026?', a: 'Yes. FPT Play holds extensive digital rights for World Cup 2026 in Vietnam and is expected to stream all or most matches live. Check the FPT Play app for confirmed match schedules.' },
      { q: 'What time is the World Cup 2026 Final in Vietnam?', a: 'The Final on 19 July 2026 at MetLife Stadium is expected at approximately 7:00 PM ET, which is 6:00 AM on 20 July in Vietnam. Check FPT Play for live streaming and replay options.' },
      { q: 'How to watch World Cup 2026 on mobile in Vietnam?', a: 'Download the FPT Play app (iOS/Android) for comprehensive coverage, or the VTV Go app for any VTV-broadcast matches. K+ also has a mobile app for subscribers.' },
      { q: 'Có VPN để xem World Cup không / Can I use a VPN to watch World Cup 2026?', a: 'FPT Play is geo-restricted to Vietnam. Vietnamese fans abroad can use a VPN with Vietnamese servers to access FPT Play. Expats in Vietnam can use a VPN to access their home country\'s free coverage (BBC iPlayer, SBS, etc.).' },
      { q: 'Does K+ show World Cup 2026 in Vietnam?', a: 'K+ (K Plus) may carry selected World Cup 2026 matches for satellite TV subscribers in Vietnam. Check K+\'s official announcements closer to June 2026 for their confirmed coverage plan.' },
    ],
  },

  // ── France ─────────────────────────────────────────────────────────────────
  france: {
    slug: 'france',
    name: 'France',
    flag: '🇫🇷',
    timezone: 'Europe/Paris',
    utcOffset: 'UTC+2 (CEST)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule France – TF1, beIN Sports & Horaires | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for France. Every match on TF1 (gratuit) or beIN Sports with kickoff times in French time (CEST, UTC+2).',
    heroSubtitle: 'TF1 diffuse les gros matches gratuitement. beIN Sports couvre les 104 rencontres. Horaires en heure française.',
    intro:
      'La France est l\'un des pays les plus passionnés de football au monde, et la couverture TV de ' +
      'la Coupe du Monde 2026 sera à la hauteur. TF1, la principale chaîne gratuite française, ' +
      'diffuse les matches phares — dont tous les matches des Bleus — en clair. beIN Sports, ' +
      'disponible sur abonnement câble, satellite ou streaming, assure la couverture complète des ' +
      '104 matches. En heure française d\'été (CEST, UTC+2), les créneaux horaires de la Coupe du ' +
      'Monde sont très accessibles : 18h00, 21h00, minuit et 3h du matin. Le créneau 21h00 est ' +
      'idéal pour regarder les matches en prime time.',
    channels: [
      { name: 'TF1',               type: 'free-tv',         language: 'French', coverage: 'Matches des Bleus + grands chocs', where: 'TNT + TF1+ streaming gratuit' },
      { name: 'beIN Sports 1–3',   type: 'cable',           language: 'French', coverage: 'Tous les 104 matches',             where: 'Câble/Sat/IPTV + beIN Connect' },
      { name: 'beIN Connect',      type: 'streaming-paid',  language: 'French', coverage: 'Tous les 104 matches',             where: 'App / Web — à partir de 15€/mois' },
      { name: 'myCanal',           type: 'streaming-paid',  language: 'French', coverage: 'Via abonnement Canal+/beIN',       where: 'App / Web (abonnés Canal+)' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '18:00 CEST',                  slot: 'Soirée',           friendly: true  },
      { utcTime: '19:00 UTC', localTime: '21:00 CEST',                  slot: 'Prime Time',       friendly: true  },
      { utcTime: '22:00 UTC', localTime: '00:00 CEST (lendemain)',       slot: 'Nuit',             friendly: false },
      { utcTime: '01:00 UTC', localTime: '03:00 CEST (lendemain)',       slot: 'Nuit profonde',    friendly: false },
    ],
    bestPickFree: 'TF1 — matches des Bleus + affiches phares en clair',
    bestPickPaid: 'beIN Sports — couverture intégrale des 104 matches',
    faq: [
      { q: 'Sur quelle chaîne voir la Coupe du Monde 2026 en France ?', a: 'TF1 diffuse les matches phares dont tous les matches de l\'équipe de France, gratuitement sur la TNT et en streaming sur TF1+. beIN Sports (abonnement) couvre les 104 rencontres.' },
      { q: 'À quelle heure sont les matches de la Coupe du Monde 2026 en France ?', a: 'Les matches de la phase de groupes débutent à 18h00, 21h00, minuit et 3h00 en heure de Paris (CEST). Les créneaux 18h00 et 21h00 sont les plus pratiques.' },
      { q: 'La Coupe du Monde 2026 est-elle gratuite en France ?', a: 'Les matches des Bleus et les affiches majeures (quarts, demi-finales, finale) sont disponibles gratuitement sur TF1 et en streaming sur TF1+. Pour tous les matches, un abonnement beIN Sports est nécessaire.' },
      { q: 'Peut-on regarder la Coupe du Monde 2026 en streaming en France ?', a: 'Oui. TF1+ (gratuit avec compte), beIN Connect et myCanal permettent de suivre les matches en direct sur ordinateur, smartphone et Smart TV.' },
      { q: 'La finale de la Coupe du Monde 2026 sera-t-elle sur TF1 ?', a: 'Oui, la finale du 19 juillet 2026 au MetLife Stadium sera très probablement diffusée sur TF1, comme c\'est la tradition pour les grandes finales internationales en France.' },
      { q: 'Qu\'est-ce que beIN Connect pour la Coupe du Monde ?', a: 'beIN Connect est la plateforme de streaming de beIN Sports, accessible sans décodeur. Elle permet de regarder tous les matches de la Coupe du Monde sur mobile, tablette ou PC, à partir de 15€/mois.' },
    ],
  },

  // ── Germany ─────────────────────────────────────────────────────────────────
  germany: {
    slug: 'germany',
    name: 'Germany',
    flag: '🇩🇪',
    timezone: 'Europe/Berlin',
    utcOffset: 'UTC+2 (CEST)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule Germany – ARD, ZDF & MagentaTV | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for Germany. Every match on ARD, ZDF (free) or MagentaTV with kickoff times in German time (CEST, UTC+2).',
    heroSubtitle: 'ARD and ZDF show all Germany matches free. MagentaTV covers all 104 games. Check German kickoff times.',
    intro:
      'Germany has one of the world\'s best free-to-air World Cup setups. ARD (Das Erste) and ZDF ' +
      'share broadcast rights for all 104 matches, meaning every game — including those not ' +
      'featuring the German national team — is available free on public television and the ARD ' +
      'and ZDF media libraries. MagentaTV (Deutsche Telekom) serves as the premium streaming option ' +
      'with additional coverage and features. In Central European Summer Time (CEST, UTC+2), the ' +
      '18:00 and 21:00 kickoff slots are prime-time viewing, while the midnight and 03:00 slots ' +
      'require a late-night commitment. All Germany matches are expected to air on both ARD and ZDF.',
    channels: [
      { name: 'ARD (Das Erste)',   type: 'free-tv',        language: 'German', coverage: 'Approx. half of all matches', where: 'DVB-T2/Kabel/Sat + ARD Mediathek' },
      { name: 'ZDF',               type: 'free-tv',        language: 'German', coverage: 'Approx. half of all matches', where: 'DVB-T2/Kabel/Sat + ZDF Mediathek' },
      { name: 'ARD Mediathek',     type: 'streaming-free', language: 'German', coverage: 'All ARD matches live + replay', where: 'App / Web (free)' },
      { name: 'ZDF Mediathek',     type: 'streaming-free', language: 'German', coverage: 'All ZDF matches live + replay', where: 'App / Web (free)' },
      { name: 'MagentaTV',         type: 'streaming-paid', language: 'German', coverage: 'All 104 matches + extras',    where: 'App / Web — Telekom subscribers' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '18:00 CEST',             slot: 'Früher Abend',  friendly: true  },
      { utcTime: '19:00 UTC', localTime: '21:00 CEST',             slot: 'Primetime',     friendly: true  },
      { utcTime: '22:00 UTC', localTime: '00:00 CEST (Folgetag)', slot: 'Mitternacht',   friendly: false },
      { utcTime: '01:00 UTC', localTime: '03:00 CEST (Folgetag)', slot: 'Tiefe Nacht',   friendly: false },
    ],
    bestPickFree: 'ARD / ZDF — alle Spiele kostenlos im Free-TV und in der Mediathek',
    bestPickPaid: 'MagentaTV — alle 104 Spiele plus zusätzliche Features',
    faq: [
      { q: 'Wo läuft die WM 2026 in Deutschland?', a: 'ARD und ZDF teilen sich die Übertragungsrechte und zeigen alle 104 Spiele kostenlos im Free-TV sowie in der Mediathek. MagentaTV (Telekom) bietet zusätzlich alle Spiele als Streamingdienst an.' },
      { q: 'Wann sind die Anstoßzeiten der WM 2026 in Deutschland?', a: 'In der Mitteleuropäischen Sommerzeit (MESZ/CEST) beginnen die Gruppenspiele um 18:00 Uhr, 21:00 Uhr, 00:00 Uhr und 03:00 Uhr. Die Slots 18:00 und 21:00 Uhr sind für die meisten Fans die günstigsten.' },
      { q: 'Ist die WM 2026 kostenlos in Deutschland zu sehen?', a: 'Ja. ARD und ZDF übertragen alle Spiele kostenlos im Free-TV. Der Empfang funktioniert per DVB-T2-Antenne, Kabel, Satellit oder kostenlos in der ARD/ZDF-Mediathek.' },
      { q: 'Zeigt MagentaTV alle WM-Spiele?', a: 'Ja. MagentaTV (Deutsche Telekom) hat alle 104 WM-2026-Spiele im Programm und bietet zusätzliche Features wie Konferenz und Statistiken. Das Angebot ist für Telekom-Kunden teilweise inklusive.' },
      { q: 'Wann ist das WM-Finale 2026 in Deutschland?', a: 'Das Finale am 19. Juli 2026 im MetLife Stadium beginnt voraussichtlich um ca. 21:00 Uhr MESZ (19:00 Uhr UTC). ARD oder ZDF werden live übertragen.' },
      { q: 'Kann ich die WM 2026 im Ausland über ARD/ZDF sehen?', a: 'ARD und ZDF Mediathek sind im Ausland eingeschränkt verfügbar. Mit einem VPN mit deutschem Server kann der Zugang wiederhergestellt werden — beachte dabei die Nutzungsbedingungen.' },
    ],
  },

  // ── Spain ───────────────────────────────────────────────────────────────────
  spain: {
    slug: 'spain',
    name: 'Spain',
    flag: '🇪🇸',
    timezone: 'Europe/Madrid',
    utcOffset: 'UTC+2 (CEST)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule Spain – TVE, Mediaset & Horarios | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for Spain. Spain matches free on TVE (La 1). Full coverage on RTVE Play and Movistar+. Kickoff times in Spanish time (CEST).',
    heroSubtitle: 'La Roja matches are free on TVE. Movistar+ covers all 104 games. Horarios en hora española.',
    intro:
      'Spain is one of the leading football nations and its World Cup 2026 TV coverage reflects ' +
      'that status. RTVE (TVE/La 1) holds free-to-air rights for Spain national team matches and ' +
      'key fixtures, with RTVE Play providing free live streaming. Mediaset España (Cuatro, Telecinco) ' +
      'may carry selected matches. Movistar+ (M+ Liga) provides comprehensive paid coverage of all ' +
      '104 matches. In Spanish time (CEST, UTC+2), the 18:00, 21:00, midnight and 03:00 kickoff ' +
      'slots are the same as France and Germany — prime evening windows for group stage matches.',
    channels: [
      { name: 'TVE / La 1',        type: 'free-tv',        language: 'Spanish', coverage: 'Spain games + key matches',    where: 'TDT + RTVE Play (free)' },
      { name: 'RTVE Play',         type: 'streaming-free', language: 'Spanish', coverage: 'All TVE matches live + replay', where: 'App / Web (free account)' },
      { name: 'Cuatro (Mediaset)', type: 'free-tv',        language: 'Spanish', coverage: 'Selected matches (TBC)',       where: 'TDT + Mitele (free streaming)' },
      { name: 'Movistar+ / M+',   type: 'cable',           language: 'Spanish', coverage: 'All 104 matches',             where: 'Cable/Sat + Movistar+ app' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '18:00 CEST',             slot: 'Tarde-noche',  friendly: true  },
      { utcTime: '19:00 UTC', localTime: '21:00 CEST',             slot: 'Prime Time',   friendly: true  },
      { utcTime: '22:00 UTC', localTime: '00:00 CEST (madrugada)', slot: 'Madrugada',   friendly: false },
      { utcTime: '01:00 UTC', localTime: '03:00 CEST (madrugada)', slot: 'Madrugada',   friendly: false },
    ],
    bestPickFree: 'TVE / La 1 — partidos de España gratis + RTVE Play en streaming',
    bestPickPaid: 'Movistar+ — cobertura completa de los 104 partidos',
    faq: [
      { q: '¿En qué canal se ve el Mundial 2026 en España?', a: 'TVE (La 1) retransmite los partidos de la selección española y los grandes encuentros en abierto. Movistar+ cubre los 104 partidos con abonnement. RTVE Play es gratis en streaming.' },
      { q: '¿A qué hora son los partidos del Mundial 2026 en España?', a: 'En hora española (CEST, UTC+2): 18:00, 21:00, 00:00 y 03:00. Los mejores horarios para ver son el de las 18:00 y las 21:00 en prime time.' },
      { q: '¿Es gratis el Mundial 2026 en España?', a: 'Los partidos de España y las grandes rondas (cuartos, semis, final) serán gratuitos en TVE y en streaming en RTVE Play. Para ver todos los 104 partidos es necesario Movistar+.' },
      { q: '¿Cuándo es la final del Mundial 2026 en horario español?', a: 'La final del 19 de julio de 2026 en el MetLife Stadium comenzará aproximadamente a las 21:00 CEST. TVE (La 1) la retransmitirá en abierto.' },
      { q: '¿Puedo ver el Mundial 2026 en streaming gratis en España?', a: 'Sí. RTVE Play (rtve.es/play) permite ver en streaming los partidos emitidos por TVE sin suscripción. Para todos los demás, Movistar+ tiene app para móvil y Smart TV.' },
      { q: '¿Mediaset España retransmite el Mundial 2026?', a: 'Mediaset (Cuatro/Telecinco) puede retransmitir partidos seleccionados, aunque los derechos principales son de TVE y Movistar+. Se confirmarán los detalles antes del torneo.' },
    ],
  },

  // ── Brazil ──────────────────────────────────────────────────────────────────
  brazil: {
    slug: 'brazil',
    name: 'Brazil',
    flag: '🇧🇷',
    timezone: 'America/Sao_Paulo',
    utcOffset: 'UTC−3 (BRT)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule Brazil – Globo, Cazé TV & Horários | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for Brazil. Every match on Globo (free) or Cazé TV (YouTube). Kickoff times in Brasília time (BRT, UTC−3).',
    heroSubtitle: 'Globo covers Brazil matches free. Cazé TV (YouTube) streams all 104 games. Check horários in BRT.',
    intro:
      'Brazil is the most successful nation in World Cup history and its domestic TV coverage ' +
      'matches that prestige. TV Globo holds free-to-air rights covering all Brazil matches and ' +
      'major fixtures. Cazé TV — the Brazilian streamer that broke records at the 2022 World Cup — ' +
      'streams matches on YouTube, making it one of the most accessible free options in any country. ' +
      'SporTV (cable) provides round-the-clock coverage, and Globoplay streams Globo content online. ' +
      'Brazil\'s time zone (BRT, UTC−3) gives fans excellent kickoff times: 13:00, 16:00, 19:00 and ' +
      '22:00 — every slot is at a civil hour with no overnight matches.',
    channels: [
      { name: 'TV Globo',      type: 'free-tv',         language: 'Portuguese', coverage: 'Brazil games + major matches', where: 'Broadcast TV + Globoplay app' },
      { name: 'Cazé TV',       type: 'streaming-free',  language: 'Portuguese', coverage: 'All 104 matches (YouTube)',    where: 'YouTube.com/CazéTV — completely free' },
      { name: 'SporTV 1–3',   type: 'cable',            language: 'Portuguese', coverage: 'All 104 matches',             where: 'Cable/Satellite + Globoplay premium' },
      { name: 'Globoplay',     type: 'streaming-paid',  language: 'Portuguese', coverage: 'Globo + SporTV matches',      where: 'App / Web — from R$24.90/month' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '13:00 BRT',  slot: 'Hora do Almoço', friendly: true },
      { utcTime: '19:00 UTC', localTime: '16:00 BRT',  slot: 'Tarde',          friendly: true },
      { utcTime: '22:00 UTC', localTime: '19:00 BRT',  slot: 'Prime Time',     friendly: true },
      { utcTime: '01:00 UTC', localTime: '22:00 BRT',  slot: 'Noite',          friendly: true },
    ],
    bestPickFree: 'Cazé TV (YouTube) — todos os 104 jogos gratuitamente no YouTube',
    bestPickPaid: 'SporTV via Globoplay — cobertura completa com análises',
    faq: [
      { q: 'Onde assistir a Copa do Mundo 2026 no Brasil?', a: 'TV Globo exibe os jogos do Brasil e as partidas principais gratuitamente. Cazé TV transmite todos os 104 jogos pelo YouTube de graça. SporTV (cabo) e Globoplay (streaming) têm cobertura completa.' },
      { q: 'Que horas são os jogos da Copa 2026 no horário de Brasília?', a: 'No horário de Brasília (BRT, UTC−3): 13:00, 16:00, 19:00 e 22:00. Todos os horários são confortáveis — não há jogos de madrugada para os brasileiros.' },
      { q: 'A Copa do Mundo 2026 vai passar na Globo?', a: 'Sim. TV Globo tem os direitos dos jogos da Seleção Brasileira e das partidas de maior destaque, transmitidos gratuitamente. SporTV (do Grupo Globo) cobre todos os 104 jogos no cabo.' },
      { q: 'O Cazé TV vai transmitir a Copa 2026?', a: 'Cazé TV transmitiu a Copa do Mundo 2022 com recordes de audiência no YouTube. A expectativa é que transmita novamente em 2026. Confirme no canal oficial do YouTube de Cazé TV.' },
      { q: 'Que horas é a final da Copa 2026 no Brasil?', a: 'A final de 19 de julho de 2026 no MetLife Stadium deve começar às 22:00 horário de Brasília (01:00 UTC). TV Globo e Cazé TV devem transmitir ao vivo.' },
      { q: 'Como assistir a Copa 2026 pelo celular no Brasil?', a: 'Pelo app do Globoplay (com ou sem assinatura para partidas gratuitas), pelo YouTube (Cazé TV), ou pelo app da SporTV com assinatura de cabo.' },
    ],
  },

  // ── Argentina ───────────────────────────────────────────────────────────────
  argentina: {
    slug: 'argentina',
    name: 'Argentina',
    flag: '🇦🇷',
    timezone: 'America/Argentina/Buenos_Aires',
    utcOffset: 'UTC−3 (ART)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule Argentina – TyC Sports, TVP & Horarios | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for Argentina. Argentina matches free on TVP (Canal 7). TyC Sports & DirecTV cover all 104 games. Horarios en ART (UTC−3).',
    heroSubtitle: 'TVP shows Argentina games free. TyC Sports covers the full tournament. All times in ART.',
    intro:
      'As reigning World Cup champions, Argentina enters the 2026 tournament with enormous ' +
      'expectations, and the domestic TV coverage reflects the national obsession with football. ' +
      'TVP (Canal 7, state broadcaster) carries all Argentina national team matches free on public ' +
      'television. TyC Sports, the country\'s leading sports cable channel, provides comprehensive ' +
      'coverage of all 104 matches. DirecTV Sports offers satellite coverage for subscribers. ' +
      'Argentina\'s time zone (ART, UTC−3) gives fans the same excellent schedule as Brazil — ' +
      '13:00, 16:00, 19:00 and 22:00 local time — with no overnight matches.',
    channels: [
      { name: 'TVP / Canal 7',      type: 'free-tv',        language: 'Spanish', coverage: 'Argentina matches (guaranteed)', where: 'Broadcast TV + Cont.ar (free stream)' },
      { name: 'TyC Sports',         type: 'cable',           language: 'Spanish', coverage: 'All 104 matches',               where: 'Cable/Satellite + TyC Sports Play' },
      { name: 'DirecTV Sports',     type: 'cable',           language: 'Spanish', coverage: 'All matches (satellite)',        where: 'DirecTV/STAR+ satellite' },
      { name: 'STAR+',              type: 'streaming-paid',  language: 'Spanish', coverage: 'Selected matches',              where: 'App / Web (Disney/STAR subscription)' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '13:00 ART',  slot: 'Mediodía',   friendly: true },
      { utcTime: '19:00 UTC', localTime: '16:00 ART',  slot: 'Tarde',      friendly: true },
      { utcTime: '22:00 UTC', localTime: '19:00 ART',  slot: 'Prime Time', friendly: true },
      { utcTime: '01:00 UTC', localTime: '22:00 ART',  slot: 'Noche',      friendly: true },
    ],
    bestPickFree: 'TVP / Canal 7 — partidos de Argentina gratis en TV abierta',
    bestPickPaid: 'TyC Sports — cobertura completa de los 104 partidos',
    faq: [
      { q: '¿Dónde ver el Mundial 2026 en Argentina?', a: 'TVP (Canal 7) transmite gratis todos los partidos de la Selección Argentina. TyC Sports (cable) cubre los 104 partidos. DirecTV Sports y STAR+ son las opciones de pago por streaming.' },
      { q: '¿A qué hora son los partidos del Mundial 2026 en Argentina?', a: 'En horario argentino (ART, UTC−3): 13:00, 16:00, 19:00 y 22:00. Todos los horarios son muy cómodos — sin partidos de madrugada.' },
      { q: '¿La Selección Argentina sale por TV Pública?', a: 'Sí. Todos los partidos de la Selección Argentina están garantizados en TVP (Canal 7) por disposición legal. Cont.ar ofrece el streaming gratuito de TV Pública.' },
      { q: '¿Qué es TyC Sports Play?', a: 'TyC Sports Play es la plataforma de streaming de TyC Sports. Permite ver todos los partidos del Mundial 2026 en vivo desde el celular, computadora o Smart TV con una suscripción al paquete de cable.' },
      { q: '¿A qué hora es la final del Mundial 2026 en Argentina?', a: 'La final del 19 de julio de 2026 en el MetLife Stadium comenzará aproximadamente a las 22:00 ART. TVP y TyC Sports transmitirán en vivo.' },
      { q: '¿Se puede ver el Mundial 2026 gratis por streaming en Argentina?', a: 'Sí. Cont.ar (el streaming oficial de TVP) transmite en vivo todos los partidos de Argentina gratis. Para el resto de los partidos, TyC Sports Play requiere suscripción de cable.' },
    ],
  },

  // ── Mexico ──────────────────────────────────────────────────────────────────
  mexico: {
    slug: 'mexico',
    name: 'Mexico',
    flag: '🇲🇽',
    timezone: 'America/Mexico_City',
    utcOffset: 'UTC−5 (CDT)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule Mexico – Azteca, TUDN & Horarios | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for Mexico (co-host). El Tri matches free on Azteca 7 & Canal de las Estrellas. TUDN covers all 104 games. Horarios en CDT.',
    heroSubtitle: 'Mexico is a co-host. Azteca and Televisa show El Tri games free. TUDN covers all 104 matches.',
    intro:
      'Mexico is a co-host of the 2026 World Cup alongside the USA and Canada — one of the most ' +
      'exciting developments for Mexican fans who will see games played at Estadio Azteca (Mexico City), ' +
      'Estadio Guadalajara and Estadio Monterrey on home soil. Free-to-air channels Azteca 7 and ' +
      'Canal de las Estrellas (Televisa) broadcast El Tri matches at no cost. TUDN, available on ' +
      'cable and its streaming app, covers all 104 matches. ViX (sports streaming) offers additional ' +
      'coverage. Mexico\'s Central Daylight Time (CDT, UTC−5) gives fans excellent midday and ' +
      'afternoon kickoff times — 11:00, 14:00, 17:00 and 20:00 — perfectly suited for viewing.',
    channels: [
      { name: 'Azteca 7',               type: 'free-tv',        language: 'Spanish', coverage: 'El Tri + key matches',       where: 'Broadcast TV + Azteca Deportes app' },
      { name: 'Canal de las Estrellas', type: 'free-tv',        language: 'Spanish', coverage: 'El Tri + selected matches',  where: 'Broadcast TV + Las Estrellas app' },
      { name: 'TUDN',                   type: 'cable',           language: 'Spanish', coverage: 'All 104 matches',           where: 'Cable/Sat + TUDN app' },
      { name: 'ViX (sports tier)',      type: 'streaming-paid',  language: 'Spanish', coverage: 'Selected matches',          where: 'App / Web — from $6.99 USD/month' },
      { name: 'Claro Sports',          type: 'streaming-paid',  language: 'Spanish', coverage: 'Selected matches',          where: 'App / Web (Claro subscribers)' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '11:00 CDT',  slot: 'Mañana',     friendly: true },
      { utcTime: '19:00 UTC', localTime: '14:00 CDT',  slot: 'Mediodía',   friendly: true },
      { utcTime: '22:00 UTC', localTime: '17:00 CDT',  slot: 'Tarde',      friendly: true },
      { utcTime: '01:00 UTC', localTime: '20:00 CDT',  slot: 'Prime Time', friendly: true },
    ],
    bestPickFree: 'Azteca 7 / Canal de las Estrellas — partidos de El Tri gratis',
    bestPickPaid: 'TUDN — cobertura completa de los 104 partidos',
    faq: [
      { q: '¿Dónde ver el Mundial 2026 en México?', a: 'Azteca 7 y Canal de las Estrellas (Televisa) transmiten los partidos de El Tri gratuitamente. TUDN (cable) cubre todos los 104 partidos. ViX ofrece streaming de partidos seleccionados.' },
      { q: '¿A qué hora son los partidos del Mundial 2026 en México?', a: 'En horario del centro de México (CDT, UTC−5): 11:00, 14:00, 17:00 y 20:00. Todos los horarios son ideales — sin partidos de madrugada.' },
      { q: '¿En qué estadios de México se jugará el Mundial 2026?', a: 'México es sede de partidos en el Estadio Azteca (Ciudad de México), el Estadio Akron (Guadalajara) y el Estadio BBVA (Monterrey), con la fase de grupos y posibles partidos de ronda eliminatoria.' },
      { q: '¿El partido inaugural del Mundial 2026 es en México?', a: 'Sí. El partido inaugural del Mundial 2026 se celebrará en el Estadio Azteca de Ciudad de México el 11 de junio de 2026, con México como anfitrión.' },
      { q: '¿Puedo ver el Mundial 2026 gratis en México?', a: 'Sí. Azteca 7 y Canal de las Estrellas transmiten los partidos de México gratis en TV abierta. Las apps de Azteca Deportes y Televisa Deportes también tienen streaming gratuito para estos partidos.' },
      { q: '¿Cuándo es la final del Mundial 2026 en horario de México?', a: 'La final del 19 de julio de 2026 en el MetLife Stadium comenzará aproximadamente a las 20:00 CDT (01:00 UTC del 20 de julio). TUDN y Azteca 7 transmitirán en vivo.' },
    ],
  },

  // ── Japan ───────────────────────────────────────────────────────────────────
  japan: {
    slug: 'japan',
    name: 'Japan',
    flag: '🇯🇵',
    timezone: 'Asia/Tokyo',
    utcOffset: 'UTC+9 (JST)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule Japan – NHK, DAZN & Kickoff Times | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for Japan. Japan matches free on NHK. DAZN Japan streams all 104 games. Kickoff times in Japan Standard Time (JST, UTC+9).',
    heroSubtitle: 'NHK shows Japan matches free. DAZN Japan has all 104 games. Check JST kickoff times.',
    intro:
      'Japan has one of Asia\'s most dedicated football fan bases, with the Blue Samurai ' +
      '(Samurai Blue) consistently reaching the knockout stages at recent World Cups. NHK, ' +
      'Japan\'s public broadcaster, carries all Japan national team matches free on terrestrial TV. ' +
      'DAZN Japan holds comprehensive streaming rights for all 104 matches. Fuji TV may ' +
      'broadcast selected matches on free-to-air television. Japan\'s time zone (JST, UTC+9) ' +
      'means most group stage matches kick off between 01:00 and 10:00 — a late-night to early ' +
      'morning schedule that Japanese fans are accustomed to from years of Champions League viewing. ' +
      'The 10:00 JST slot (01:00 UTC) is the most convenient for Japanese viewers.',
    channels: [
      { name: 'NHK (総合/BS)',      type: 'free-tv',        language: 'Japanese', coverage: 'Japan matches + selected key games', where: 'Terrestrial + BS satellite + NHK+ app' },
      { name: 'Fuji TV / TBS',      type: 'free-tv',        language: 'Japanese', coverage: 'Selected matches (TBC)',             where: 'Terrestrial broadcast' },
      { name: 'DAZN Japan',         type: 'streaming-paid', language: 'Japanese', coverage: 'All 104 matches',                   where: 'App / Web — from ¥3,700/month' },
      { name: 'NHK+',              type: 'streaming-free', language: 'Japanese', coverage: 'NHK broadcast matches',             where: 'App / Web (free with NHK subscription)' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '01:00 JST (翌日)',  slot: '深夜',           friendly: false },
      { utcTime: '19:00 UTC', localTime: '04:00 JST (翌日)',  slot: '早朝',           friendly: false },
      { utcTime: '22:00 UTC', localTime: '07:00 JST',         slot: '朝 (Morning)',   friendly: true  },
      { utcTime: '01:00 UTC', localTime: '10:00 JST',         slot: '午前 (Best slot)', friendly: true },
    ],
    bestPickFree: 'NHK — Japan matches free on terrestrial and NHK+',
    bestPickPaid: 'DAZN Japan — all 104 matches streamed live',
    faq: [
      { q: 'ワールドカップ2026はどこで見れる？/ Where to watch World Cup 2026 in Japan?', a: 'NHKが日本代表戦と主要試合を無料放送。DAZNジャパンが全104試合を配信。フジテレビやTBSが一部の試合を地上波で放送する可能性あり。' },
      { q: '日本でワールドカップ2026の試合は何時に始まる？', a: '日本時間（JST、UTC+9）：グループステージの試合は01:00、04:00、07:00、10:00。最も見やすいのは07:00と10:00のスロット。' },
      { q: 'DAZNでワールドカップ2026は見れる？', a: 'DAZNジャパンは全104試合の配信権を持ち、スマートフォン、PC、スマートテレビでライブ観戦が可能。月額¥3,700から（契約プランによって異なる）。' },
      { q: 'NHKはワールドカップ2026を放送する？', a: 'NHKはサムライブルー（日本代表）の全試合と主要な試合を無料で地上波・BS放送予定。NHK+でストリーミングも可能。' },
      { q: 'ワールドカップ2026の決勝は日本時間で何時？', a: '2026年7月19日（日）の決勝（メトライフ・スタジアム）は日本時間でおよそ10:00〜11:00頃の予定。DAZNとNHKが中継予定。' },
      { q: 'ワールドカップを深夜に見る方法は？', a: '01:00や04:00のスロットはDAZNまたはNHK+で視聴し、録画機能（タイムシフト）を活用して翌朝に見返すことをおすすめします。' },
    ],
  },

  // ── South Korea ─────────────────────────────────────────────────────────────
  'south-korea': {
    slug: 'south-korea',
    name: 'South Korea',
    flag: '🇰🇷',
    timezone: 'Asia/Seoul',
    utcOffset: 'UTC+9 (KST)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule South Korea – KBS, SPOTV & Times | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for South Korea. Korea matches free on KBS/MBC/SBS. SPOTV and Wavve stream all 104 games. Times in KST (UTC+9).',
    heroSubtitle: 'KBS, MBC and SBS show Korea matches free. SPOTV has all 104 games. Check KST kickoff times.',
    intro:
      'South Korea has a passionate football following and a rich World Cup history, including ' +
      'a remarkable run to the semi-finals on home soil in 2002. For 2026, KBS, MBC and SBS — ' +
      'Korea\'s three main free-to-air broadcasters — will share rights for Korea national team ' +
      'matches and selected fixtures. SPOTV (cable) provides comprehensive coverage of all 104 ' +
      'matches, with Wavve and TVING offering streaming access. Like Japan, Korea\'s KST (UTC+9) ' +
      'time zone means group stage matches run from 01:00 to 10:00 local time, with the morning ' +
      'slots (07:00 and 10:00 KST) being the most viewer-friendly.',
    channels: [
      { name: 'KBS / MBC / SBS', type: 'free-tv',        language: 'Korean', coverage: 'Korea matches + selected games', where: 'Terrestrial broadcast + streaming apps' },
      { name: 'SPOTV 1–2',       type: 'cable',           language: 'Korean', coverage: 'All 104 matches',              where: 'Cable/IPTV + SPOTV NOW app' },
      { name: 'Wavve',           type: 'streaming-paid',  language: 'Korean', coverage: 'Selected matches',             where: 'App / Web — streaming platform' },
      { name: 'TVING',           type: 'streaming-paid',  language: 'Korean', coverage: 'Selected matches',             where: 'App / Web — streaming platform' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '01:00 KST (다음날)', slot: '심야',          friendly: false },
      { utcTime: '19:00 UTC', localTime: '04:00 KST (다음날)', slot: '새벽',          friendly: false },
      { utcTime: '22:00 UTC', localTime: '07:00 KST',          slot: '아침',          friendly: true  },
      { utcTime: '01:00 UTC', localTime: '10:00 KST',          slot: '오전 (최적)',   friendly: true  },
    ],
    bestPickFree: 'KBS / MBC / SBS — Korea matches free on terrestrial TV',
    bestPickPaid: 'SPOTV NOW — all 104 matches live',
    faq: [
      { q: '2026 월드컵 어디서 봐? / Where to watch World Cup 2026 in Korea?', a: 'KBS, MBC, SBS가 한국 대표팀 경기와 주요 경기를 무료 방송. SPOTV(케이블/IPTV)가 전 104경기 중계. Wavve, TVING에서도 선택 경기 스트리밍 가능.' },
      { q: '2026 월드컵 한국 시간으로 몇 시에 시작?', a: '한국 시간(KST, UTC+9) 기준: 새벽 1시, 4시, 오전 7시, 10시. 가장 보기 편한 시간대는 오전 7시와 10시 슬롯.' },
      { q: 'SPOTV에서 2026 월드컵을 볼 수 있나요?', a: 'SPOTV는 2026 월드컵 전 104경기 중계권을 가지고 있으며, SPOTV NOW 앱을 통해 스마트폰, PC, 스마트TV에서 실시간 시청 가능.' },
      { q: '2026 월드컵 결승전은 한국 시간으로 몇 시?', a: '2026년 7월 19일 결승전(메트라이프 스타디움)은 한국 시간으로 오전 10시~11시경 예정. KBS와 SPOTV에서 중계 예정.' },
      { q: '지상파에서 2026 월드컵을 볼 수 있나요?', a: 'KBS, MBC, SBS가 태극전사 경기와 주요 라운드(8강, 4강, 결승) 중계 예정. 대표팀 경기는 무료로 지상파에서 시청 가능.' },
      { q: '새벽 경기를 편하게 보는 방법은?', a: 'SPOTV NOW나 Wavve 앱의 다시보기 기능을 활용해 새벽 1시, 4시 경기를 다음 날 아침에 재시청하는 것을 추천합니다.' },
    ],
  },

  // ── Australia ────────────────────────────────────────────────────────────────
  australia: {
    slug: 'australia',
    name: 'Australia',
    flag: '🇦🇺',
    timezone: 'Australia/Sydney',
    utcOffset: 'UTC+10 (AEST)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule Australia – SBS, Optus Sport & Times | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for Australia. Socceroos matches free on SBS. Optus Sport streams all 104 games. Kickoff times in AEST (UTC+10).',
    heroSubtitle: 'SBS has Socceroos matches free. Optus Sport streams all 104 games. Check AEST kickoff times.',
    intro:
      'Australia\'s Socceroos have qualified for consecutive World Cups, building a passionate ' +
      'football (soccer) following. SBS (Special Broadcasting Service), Australia\'s multicultural ' +
      'public broadcaster, holds free-to-air rights for the World Cup and is expected to show all ' +
      'Socceroos matches and selected fixtures free. Optus Sport provides comprehensive streaming ' +
      'of all 104 matches for subscribers. SBS On Demand offers free replay of SBS-broadcast games. ' +
      'In Australian Eastern Standard Time (AEST, UTC+10), group stage matches run from 02:00 to ' +
      '11:00 — the 08:00 and 11:00 AEST morning slots are the most viewer-friendly.',
    channels: [
      { name: 'SBS (Ch. 3)',     type: 'free-tv',        language: 'English', coverage: 'Socceroos + selected matches', where: 'Broadcast TV + SBS On Demand' },
      { name: 'SBS On Demand',  type: 'streaming-free',  language: 'English', coverage: 'SBS broadcast matches',        where: 'App / Web (free account)' },
      { name: 'Optus Sport',    type: 'streaming-paid',  language: 'English', coverage: 'All 104 matches',              where: 'App / Web — from A$24.99/month' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '02:00 AEST (next day)', slot: 'Overnight',    friendly: false },
      { utcTime: '19:00 UTC', localTime: '05:00 AEST (next day)', slot: 'Early Morning', friendly: false },
      { utcTime: '22:00 UTC', localTime: '08:00 AEST',            slot: 'Morning',      friendly: true  },
      { utcTime: '01:00 UTC', localTime: '11:00 AEST',            slot: 'Late Morning (best)', friendly: true },
    ],
    bestPickFree: 'SBS — Socceroos matches and selected games free-to-air',
    bestPickPaid: 'Optus Sport — all 104 World Cup matches streamed live',
    faq: [
      { q: 'What channel is World Cup 2026 on in Australia?', a: 'SBS has free-to-air rights and will broadcast Socceroos matches and selected key games. Optus Sport streams all 104 matches for subscribers. SBS On Demand offers free streaming of SBS-broadcast games.' },
      { q: 'What time do World Cup 2026 matches kick off in Australia (AEST)?', a: 'In Australian Eastern Standard Time (AEST, UTC+10): 02:00, 05:00, 08:00 and 11:00. The 08:00 and 11:00 AEST slots are the most convenient for morning viewing.' },
      { q: 'Is the World Cup 2026 free to watch in Australia?', a: 'Yes — Socceroos matches and selected games are free on SBS and SBS On Demand. For all 104 matches, Optus Sport subscription (A$24.99/month) is required.' },
      { q: 'Does Optus Sport have all World Cup 2026 matches?', a: 'Yes. Optus Sport holds comprehensive streaming rights for all 104 FIFA World Cup 2026 matches. Watch on the Optus Sport app on mobile, Smart TV or web browser.' },
      { q: 'What time is the World Cup 2026 Final in Australia?', a: 'The Final on 19 July 2026 at MetLife Stadium is expected at approximately 11:00 AEST (01:00 UTC). SBS and Optus Sport will both broadcast the Final.' },
      { q: 'Can I watch World Cup 2026 for free without Optus Sport?', a: 'Yes, partially. SBS shows Socceroos matches and select games free on broadcast TV and SBS On Demand. For every match, Optus Sport is required.' },
    ],
  },

  // ── Indonesia ────────────────────────────────────────────────────────────────
  indonesia: {
    slug: 'indonesia',
    name: 'Indonesia',
    flag: '🇮🇩',
    timezone: 'Asia/Jakarta',
    utcOffset: 'UTC+7 (WIB)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule Indonesia – RCTI, Vidio & Jam Tayang | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule Indonesia. Matches free on RCTI & Trans7. Vidio streams all 104 games. Jam tayang dalam WIB (UTC+7).',
    heroSubtitle: 'RCTI dan Trans7 siarkan laga pilihan gratis. Vidio streaming semua 104 laga. Cek jam tayang WIB.',
    intro:
      'Indonesia memiliki salah satu basis penggemar sepak bola terbesar di Asia Tenggara, dengan ' +
      'jutaan penggemar mengikuti Liga Inggris dan Liga Champions sepanjang tahun. Untuk Piala Dunia ' +
      '2026, RCTI dan Trans7 (stasiun TV gratis) akan menyiarkan laga-laga pilihan, termasuk ' +
      'kemungkinan laga Timnas Indonesia jika lolos kualifikasi. Vidio (platform streaming MNC Group) ' +
      'memegang hak siar digital komprehensif untuk semua 104 pertandingan. Jam tayang WIB (UTC+7) ' +
      'sama dengan Thailand dan Vietnam: 23:00, 02:00, 05:00, dan 08:00 — dengan slot 08:00 WIB ' +
      'sebagai waktu paling nyaman untuk ditonton.',
    channels: [
      { name: 'RCTI',          type: 'free-tv',        language: 'Indonesian', coverage: 'Laga pilihan (termasuk Timnas)', where: 'TV Siaran + RCTI+ app (gratis)' },
      { name: 'Trans7',        type: 'free-tv',        language: 'Indonesian', coverage: 'Laga pilihan (TBC)',             where: 'TV Siaran + Trans7 app' },
      { name: 'Vidio',         type: 'streaming-paid', language: 'Indonesian', coverage: 'Semua 104 laga',                where: 'App / Web — dari Rp39.000/bulan' },
      { name: 'MNC Sports',    type: 'cable',           language: 'Indonesian', coverage: 'Laga pilihan',                  where: 'MNC Vision / IndiHome TV' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '23:00 WIB',          slot: 'Malam',              friendly: false },
      { utcTime: '19:00 UTC', localTime: '02:00 WIB (dini hari)', slot: 'Dini hari',       friendly: false },
      { utcTime: '22:00 UTC', localTime: '05:00 WIB',          slot: 'Subuh',              friendly: false },
      { utcTime: '01:00 UTC', localTime: '08:00 WIB',          slot: 'Pagi (slot terbaik)', friendly: true },
    ],
    bestPickFree: 'RCTI / Trans7 — laga pilihan gratis + RCTI+ streaming',
    bestPickPaid: 'Vidio — semua 104 laga streaming langsung',
    faq: [
      { q: 'Piala Dunia 2026 tayang di mana? / Where to watch World Cup 2026 in Indonesia?', a: 'RCTI dan Trans7 menyiarkan laga-laga pilihan gratis di TV dan aplikasi. Vidio streaming semua 104 laga dengan langganan. MNC Sports (kabel) juga menayangkan pilihan pertandingan.' },
      { q: 'Jam berapa laga Piala Dunia 2026 di Indonesia (WIB)?', a: 'Waktu Indonesia Barat (WIB, UTC+7): 23:00, 02:00, 05:00, dan 08:00. Slot 08:00 WIB adalah yang paling nyaman untuk ditonton pagi hari.' },
      { q: 'Apakah Piala Dunia 2026 tayang gratis di Indonesia?', a: 'RCTI dan Trans7 menyiarkan laga-laga pilihan gratis. Untuk semua 104 pertandingan, diperlukan langganan Vidio (mulai dari Rp39.000/bulan).' },
      { q: 'Apakah Vidio streaming Piala Dunia 2026?', a: 'Ya. Vidio diperkirakan memegang hak streaming digital untuk semua laga Piala Dunia 2026 di Indonesia, dapat ditonton di smartphone, tablet, Smart TV, dan browser.' },
      { q: 'Berapa harga langganan Vidio untuk Piala Dunia?', a: 'Paket Vidio Premier untuk olahraga mulai dari Rp39.000/bulan. Pastikan untuk memeriksa harga terbaru di aplikasi Vidio menjelang turnamen Juni 2026.' },
      { q: 'Kapan final Piala Dunia 2026 di WIB?', a: 'Final pada 19 Juli 2026 di MetLife Stadium diperkirakan pukul 08:00 WIB. RCTI dan Vidio kemungkinan besar akan menyiarkannya secara langsung.' },
    ],
  },

  // ── India ────────────────────────────────────────────────────────────────────
  india: {
    slug: 'india',
    name: 'India',
    flag: '🇮🇳',
    timezone: 'Asia/Kolkata',
    utcOffset: 'UTC+5:30 (IST)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule India – Sports18, JioCinema & Match Times | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for India. Sports18 (cable) covers all 104 matches. JioCinema may stream free. Kickoff times in IST (UTC+5:30).',
    heroSubtitle: 'Sports18 covers all 104 matches. JioCinema may stream free. Check IST kickoff times.',
    intro:
      'Football\'s popularity is rapidly growing in India, with the Indian Super League and ' +
      'international tournaments drawing large audiences. For World Cup 2026, Sports18 (Viacom18/Reliance) ' +
      'holds cable and satellite broadcast rights across all 104 matches. JioCinema — which famously ' +
      'streamed the 2023 Cricket World Cup free — may carry World Cup 2026 streaming rights, ' +
      'potentially making it free on mobile. DD Sports (Doordarshan) may carry selected matches on ' +
      'the public broadcaster. In India Standard Time (IST, UTC+5:30), group stage matches kick off ' +
      'at 21:30, 00:30, 03:30 and 06:30 — the evening and early morning slots are most accessible.',
    channels: [
      { name: 'Sports18 (1–3)',  type: 'cable',           language: 'English/Hindi', coverage: 'All 104 matches',           where: 'Cable/DTH (Tata Sky, Airtel, Jio)' },
      { name: 'JioCinema',       type: 'streaming-free',  language: 'English/Hindi', coverage: 'TBC — all or selected',     where: 'App / Web (free for Jio users)' },
      { name: 'DD Sports',       type: 'free-tv',         language: 'Hindi/English', coverage: 'Selected matches (TBC)',    where: 'Doordarshan DTH + DD Free Dish' },
      { name: 'Voot / JioTV',   type: 'streaming-paid',  language: 'English/Hindi', coverage: 'Sports18 matches via app',  where: 'App (Jio subscribers)' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '21:30 IST',          slot: 'Evening',      friendly: true  },
      { utcTime: '19:00 UTC', localTime: '00:30 IST (next day)', slot: 'Midnight',   friendly: false },
      { utcTime: '22:00 UTC', localTime: '03:30 IST',           slot: 'Early Morning', friendly: false },
      { utcTime: '01:00 UTC', localTime: '06:30 IST',           slot: 'Early Morning (best)', friendly: true },
    ],
    bestPickFree: 'JioCinema (if rights confirmed) — potentially free streaming on mobile',
    bestPickPaid: 'Sports18 via cable/DTH — all 104 matches',
    faq: [
      { q: 'Which channel is showing World Cup 2026 in India?', a: 'Sports18 (Viacom18) holds cable and satellite rights for all 104 matches. JioCinema may stream matches free on mobile. DD Sports could carry selected matches on free DTH.' },
      { q: 'What time are World Cup 2026 matches in India (IST)?', a: 'In Indian Standard Time (IST, UTC+5:30): 21:30, 00:30, 03:30 and 06:30. The 21:30 evening slot and 06:30 early morning slot are the most convenient.' },
      { q: 'Is World Cup 2026 free on JioCinema in India?', a: 'JioCinema streamed the 2023 Cricket World Cup and IPL for free. Whether it will carry World Cup 2026 football rights is subject to confirmation from Jio and FIFA broadcasters.' },
      { q: 'How to watch World Cup 2026 on mobile in India?', a: 'JioCinema app (potentially free), Sports18 via JioTV (Jio subscribers), or through your cable/DTH provider\'s app (Tata Play, Airtel Xstream). Check each service for confirmed access.' },
      { q: 'What time is the World Cup 2026 Final in India?', a: 'The Final on 19 July 2026 is expected around 01:00 UTC, which is 06:30 IST on 20 July. An early morning kickoff — but one worth setting an alarm for.' },
      { q: 'Will DD Sports show World Cup 2026 in India?', a: 'DD Sports (Doordarshan) may carry selected matches on free satellite TV, as it has for previous major tournaments. Confirm with Doordarshan closer to June 2026.' },
    ],
  },

  // ── Netherlands ──────────────────────────────────────────────────────────────
  netherlands: {
    slug: 'netherlands',
    name: 'Netherlands',
    flag: '🇳🇱',
    timezone: 'Europe/Amsterdam',
    utcOffset: 'UTC+2 (CEST)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule Netherlands – NOS, Ziggo Sport & Times | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for the Netherlands. All matches free on NOS (NPO). Ziggo Sport has additional coverage. Kickoff times in CEST (UTC+2).',
    heroSubtitle: 'NOS (NPO) shows all major matches free. Ziggo Sport has comprehensive coverage. Check Dutch kickoff times.',
    intro:
      'The Netherlands is one of Europe\'s most passionate football nations, and Dutch fans benefit ' +
      'from excellent free-to-air World Cup coverage. NOS (Nederlandse Omroep Stichting) via NPO ' +
      '(NPO 1 / NPO 3) broadcasts major matches including all Dutch national team games free on ' +
      'public television and the NOS.nl live stream. Ziggo Sport provides comprehensive cable ' +
      'coverage of all 104 matches. In Central European Summer Time (CEST, UTC+2), the 18:00 and ' +
      '21:00 kickoff slots are ideal prime-time viewing for Dutch fans.',
    channels: [
      { name: 'NPO 1 / NPO 3 (NOS)', type: 'free-tv',        language: 'Dutch', coverage: 'Oranje games + key matches', where: 'Broadcast + NOS.nl + NPO Start' },
      { name: 'NOS Livestream',       type: 'streaming-free', language: 'Dutch', coverage: 'NOS broadcast matches',      where: 'nos.nl/live — completely free' },
      { name: 'Ziggo Sport',          type: 'cable',           language: 'Dutch', coverage: 'All 104 matches',           where: 'Ziggo cable + Ziggo GO app' },
      { name: 'Ziggo GO',             type: 'streaming-paid',  language: 'Dutch', coverage: 'All Ziggo matches',         where: 'App / Web (Ziggo subscribers)' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '18:00 CEST',              slot: 'Vroege avond', friendly: true  },
      { utcTime: '19:00 UTC', localTime: '21:00 CEST',              slot: 'Primetime',    friendly: true  },
      { utcTime: '22:00 UTC', localTime: '00:00 CEST (volgende dag)', slot: 'Middernacht', friendly: false },
      { utcTime: '01:00 UTC', localTime: '03:00 CEST (volgende dag)', slot: 'Nacht',       friendly: false },
    ],
    bestPickFree: 'NOS / NPO — Oranje games and big matches free on TV and nos.nl',
    bestPickPaid: 'Ziggo Sport — all 104 World Cup matches',
    faq: [
      { q: 'Op welke zender is het WK 2026 te zien in Nederland?', a: 'NOS via NPO 1 en NPO 3 zendt de Oranje-wedstrijden en topwedstrijden gratis uit. Ziggo Sport biedt alle 104 wedstrijden via kabel. NOS.nl/live is gratis streaming.' },
      { q: 'Hoe laat beginnen de WK 2026 wedstrijden in Nederland?', a: 'In Nederlandse zomertijd (CEST, UTC+2): 18:00, 21:00, 00:00 en 03:00. De slots van 18:00 en 21:00 zijn het meest kijkvriendelijk.' },
      { q: 'Is het WK 2026 gratis te kijken in Nederland?', a: 'Ja. NOS zendt de Oranje-wedstrijden en grote duels gratis uit op NPO 1 en NPO 3, ook via nos.nl/live. Voor alle 104 wedstrijden is een Ziggo Sport-abonnement nodig.' },
      { q: 'Hoe laat is de WK 2026 finale in Nederland?', a: 'De finale van 19 juli 2026 in het MetLife Stadium begint naar verwachting om circa 21:00 CEST. NOS zal live uitzenden op NPO.' },
      { q: 'Kan ik het WK 2026 gratis streamen in Nederland?', a: 'Ja. nos.nl/live biedt gratis live streams van NOS-wedstrijden. NPO Start is ook gratis. Voor Ziggo Sport heb je een Ziggo-abonnement nodig.' },
      { q: 'Welk kanaal zendt Oranje-wedstrijden uit op het WK 2026?', a: 'NOS via NPO 1 en NPO 3 heeft de rechten voor de Oranje-wedstrijden. Ziggo Sport zendt ook uit. Beide zijn beschikbaar bij de meeste kabelaanbieders.' },
    ],
  },

  // ── Portugal ─────────────────────────────────────────────────────────────────
  portugal: {
    slug: 'portugal',
    name: 'Portugal',
    flag: '🇵🇹',
    timezone: 'Europe/Lisbon',
    utcOffset: 'UTC+1 (WEST)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule Portugal – RTP, Sport TV & Horários | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for Portugal. Portugal matches free on RTP. Sport TV covers all 104 games. Kickoff times in WEST (UTC+1).',
    heroSubtitle: 'RTP shows Portugal matches free. Sport TV has all 104 games. Check Portuguese kickoff times.',
    intro:
      'Portugal has one of the world\'s most watched football teams, led by a generation of elite ' +
      'talent. RTP (Rádio e Televisão de Portugal) is the public broadcaster with free-to-air ' +
      'rights for Portugal national team matches and selected fixtures — available on RTP1 and ' +
      'free via RTP Play. Sport TV (cable) provides comprehensive coverage of all 104 matches. ' +
      'In Western European Summer Time (WEST, UTC+1), group stage matches kick off at 17:00, 20:00, ' +
      '23:00 and 02:00 — the 17:00 and 20:00 slots are prime viewing for Portuguese fans.',
    channels: [
      { name: 'RTP1',          type: 'free-tv',        language: 'Portuguese', coverage: 'Portugal games + key matches', where: 'Broadcast + RTP Play (free stream)' },
      { name: 'RTP Play',      type: 'streaming-free', language: 'Portuguese', coverage: 'All RTP broadcast matches',    where: 'rtp.pt/play — free no account needed' },
      { name: 'Sport TV 1–5', type: 'cable',           language: 'Portuguese', coverage: 'All 104 matches',             where: 'NOS/MEO/Vodafone cable + Sport TV app' },
      { name: 'CMTV',          type: 'free-tv',        language: 'Portuguese', coverage: 'Selected matches (TBC)',       where: 'Broadcast + CMTV.pt' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '17:00 WEST',  slot: 'Tarde',      friendly: true  },
      { utcTime: '19:00 UTC', localTime: '20:00 WEST',  slot: 'Prime Time', friendly: true  },
      { utcTime: '22:00 UTC', localTime: '23:00 WEST',  slot: 'Noite',      friendly: false },
      { utcTime: '01:00 UTC', localTime: '02:00 WEST',  slot: 'Madrugada',  friendly: false },
    ],
    bestPickFree: 'RTP1 / RTP Play — jogos de Portugal e grandes encontros grátis',
    bestPickPaid: 'Sport TV — cobertura completa de todos os 104 jogos',
    faq: [
      { q: 'Em que canal ver o Mundial 2026 em Portugal?', a: 'RTP1 transmite os jogos da Seleção Nacional e os grandes encontros gratuitamente, também em streaming na RTP Play. Sport TV (cabo) tem todos os 104 jogos com subscrição.' },
      { q: 'A que horas são os jogos do Mundial 2026 em Portugal?', a: 'Em hora de verão portuguesa (WEST, UTC+1): 17:00, 20:00, 23:00 e 02:00. Os horários das 17:00 e 20:00 são os mais cómodos.' },
      { q: 'O Mundial 2026 é gratuito em Portugal?', a: 'Os jogos de Portugal e as grandes fases (quartos, meias, final) são gratuitos na RTP1 e em streaming na RTP Play. Para todos os 104 jogos, é necessária subscrição ao Sport TV.' },
      { q: 'Quando é a final do Mundial 2026 em hora portuguesa?', a: 'A final de 19 de julho de 2026 no MetLife Stadium está prevista para as 01:00 UTC, ou seja, as 02:00 WEST. RTP1 deverá transmitir ao vivo.' },
      { q: 'Posso ver o Mundial 2026 de graça na RTP Play?', a: 'Sim. A RTP Play (rtp.pt/play) transmite em direto todos os jogos emitidos pela RTP1, sem necessidade de conta ou pagamento.' },
      { q: 'O Sport TV tem todos os jogos do Mundial 2026?', a: 'Sim. Sport TV tem os direitos para todos os 104 jogos em Portugal, disponíveis nos canais Sport TV 1–5 e na app Sport TV, para subscritores NOS, MEO e Vodafone.' },
    ],
  },

  // ── Italy ────────────────────────────────────────────────────────────────────
  italy: {
    slug: 'italy',
    name: 'Italy',
    flag: '🇮🇹',
    timezone: 'Europe/Rome',
    utcOffset: 'UTC+2 (CEST)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule Italy – RAI, Sky Sport & Orari | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for Italy. Major matches on RAI (free). Sky Sport Italia covers all 104 games. Kickoff times in Italian time (CEST, UTC+2).',
    heroSubtitle: 'RAI shows top matches free. Sky Sport Italia covers all 104 games. Check Italian kickoff times.',
    intro:
      'Italy\'s World Cup 2026 TV coverage provides excellent access to all matches. RAI (Radiotelevisione ' +
      'italiana), Italy\'s public broadcaster, shows top fixtures and key rounds on RAI 1 and RAI 2 ' +
      'free-to-air, with RaiPlay streaming available online. Sky Sport Italia (cable/streaming) provides ' +
      'comprehensive coverage of all 104 matches for subscribers. Mediaset (Italia 1, Canale 5) may ' +
      'also carry selected matches. In Italian summer time (CEST, UTC+2), kickoff slots are 18:00, ' +
      '21:00, midnight and 03:00 — with the evening slots being prime-time for Italian viewers.',
    channels: [
      { name: 'RAI 1 / RAI 2',    type: 'free-tv',        language: 'Italian', coverage: 'Major matches + key rounds', where: 'Digitale terrestre + RaiPlay (free)' },
      { name: 'RaiPlay',           type: 'streaming-free', language: 'Italian', coverage: 'All RAI broadcast matches',  where: 'raiplay.it — free account required' },
      { name: 'Sky Sport Italia',  type: 'cable',           language: 'Italian', coverage: 'All 104 matches',           where: 'Sky Q satellite + NOW streaming' },
      { name: 'NOW TV',            type: 'streaming-paid',  language: 'Italian', coverage: 'All Sky Sport matches',     where: 'App / Web — from €14.99/month' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '18:00 CEST',              slot: 'Primo Serale', friendly: true  },
      { utcTime: '19:00 UTC', localTime: '21:00 CEST',              slot: 'Prime Time',   friendly: true  },
      { utcTime: '22:00 UTC', localTime: '00:00 CEST (giorno dopo)', slot: 'Mezzanotte', friendly: false },
      { utcTime: '01:00 UTC', localTime: '03:00 CEST (giorno dopo)', slot: 'Notte fonda', friendly: false },
    ],
    bestPickFree: 'RAI 1 / RAI 2 + RaiPlay — grandi partite gratis in chiaro',
    bestPickPaid: 'Sky Sport Italia / NOW — copertura completa di tutte le 104 partite',
    faq: [
      { q: 'Dove vedere i Mondiali 2026 in Italia?', a: 'RAI (RAI 1/RAI 2) trasmette le partite principali e le fasi eliminatorie in chiaro. Sky Sport Italia copre tutte le 104 partite. RaiPlay è gratis in streaming.' },
      { q: 'A che ora giocano le partite dei Mondiali 2026 in Italia?', a: 'In ora legale italiana (CEST, UTC+2): 18:00, 21:00, 00:00 e 03:00. I più comodi sono i fasce delle 18:00 e delle 21:00 in prima serata.' },
      { q: 'I Mondiali 2026 sono gratis in Italia?', a: 'Le partite principali e le fasi finali sono in chiaro su RAI 1/RAI 2 e in streaming gratuito su RaiPlay. Per tutte le 104 partite è necessario un abbonamento a Sky o NOW TV.' },
      { q: 'Quando è la finale dei Mondiali 2026 in Italia?', a: 'La finale del 19 luglio 2026 al MetLife Stadium inizierà alle 21:00 CEST circa. RAI trasmetterà in diretta in chiaro.' },
      { q: 'Si può vedere i Mondiali 2026 su RaiPlay?', a: 'Sì. RaiPlay (raiplay.it) trasmette in diretta tutte le partite che vanno in onda su RAI 1/RAI 2, con accesso gratuito creando un account.' },
      { q: 'Sky Sport mostra tutte le partite dei Mondiali 2026?', a: 'Sì. Sky Sport Italia detiene i diritti per tutte le 104 partite dei Mondiali 2026. Disponibili su Sky Q e in streaming su NOW TV.' },
    ],
  },

  // ── Belgium ──────────────────────────────────────────────────────────────────
  belgium: {
    slug: 'belgium',
    name: 'Belgium',
    flag: '🇧🇪',
    timezone: 'Europe/Brussels',
    utcOffset: 'UTC+2 (CEST)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule Belgium – RTBF, VRT & Match Times | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for Belgium. Red Devils matches free on RTBF/VRT. Play Sports has all 104 games. Kickoff times in CEST (UTC+2).',
    heroSubtitle: 'RTBF and VRT show Red Devils games free. Play Sports covers all 104 matches. Check Belgian kickoff times.',
    intro:
      'Belgium\'s "Golden Generation" era may be winding down, but the Red Devils remain a ' +
      'major force and the domestic TV coverage reflects the national passion for football. ' +
      'RTBF (La Une) covers French-speaking Belgium with free-to-air Red Devils matches, while ' +
      'VRT (Één) does the same for Dutch-speaking Flanders. Play Sports (cable) provides ' +
      'comprehensive coverage of all 104 matches for subscribers. In Belgian Summer Time ' +
      '(CEST, UTC+2), kickoffs at 18:00 and 21:00 are prime-time windows for Belgian fans.',
    channels: [
      { name: 'La Une (RTBF)',    type: 'free-tv',        language: 'French', coverage: 'Red Devils + selected',   where: 'Broadcast + Auvio (free stream)' },
      { name: 'Één (VRT)',        type: 'free-tv',        language: 'Dutch',  coverage: 'Red Devils + selected',   where: 'Broadcast + VRT MAX (free stream)' },
      { name: 'Play Sports 1–4', type: 'cable',           language: 'Fr/NL',  coverage: 'All 104 matches',         where: 'Cable/Sat + Play Sports app' },
      { name: 'Auvio / VRT MAX', type: 'streaming-free',  language: 'Fr/NL',  coverage: 'RTBF and VRT matches',   where: 'App / Web — free' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '18:00 CEST',               slot: 'Vroege avond / Début de soirée', friendly: true  },
      { utcTime: '19:00 UTC', localTime: '21:00 CEST',               slot: 'Primetime',                      friendly: true  },
      { utcTime: '22:00 UTC', localTime: '00:00 CEST (volgende dag)', slot: 'Middernacht / Minuit',           friendly: false },
      { utcTime: '01:00 UTC', localTime: '03:00 CEST (volgende dag)', slot: 'Nacht / Nuit',                   friendly: false },
    ],
    bestPickFree: 'RTBF (La Une) / VRT (Één) — Red Devils matches free in both languages',
    bestPickPaid: 'Play Sports — all 104 World Cup matches',
    faq: [
      { q: 'Waar kan ik het WK 2026 bekijken in België? / Où voir la Coupe du Monde 2026 en Belgique?', a: 'VRT (Één) toont de Rode Duivels-wedstrijden gratis in het Nederlands. RTBF (La Une) doet hetzelfde in het Frans. Play Sports (kabel) heeft alle 104 wedstrijden.' },
      { q: 'Hoe laat beginnen de WK 2026-wedstrijden in België?', a: 'In Belgische zomertijd (CEST, UTC+2): 18:00, 21:00, 00:00 en 03:00. De slots van 18:00 en 21:00 zijn het meest kijkvriendelijk.' },
      { q: 'Is het WK 2026 gratis te zien in België?', a: 'Ja. VRT en RTBF zenden de Rode Duivels-wedstrijden gratis uit. VRT MAX en Auvio bieden gratis livestreams. Voor alle 104 wedstrijden is een Play Sports-abonnement nodig.' },
      { q: 'Hoe laat is de WK 2026-finale in België?', a: 'De finale op 19 juli 2026 in het MetLife Stadium begint naar verwachting om 21:00 CEST. VRT en RTBF zenden beiden de finale live uit.' },
      { q: 'Heeft Play Sports alle WK 2026-wedstrijden?', a: 'Ja. Play Sports 1–4 heeft alle 104 WK-wedstrijden via kabel en satelliet, plus de Play Sports-app voor mobiel en Smart TV.' },
      { q: 'Kan ik het WK 2026 streamen in België?', a: 'Ja. VRT MAX (vtm.be) en Auvio (rtbf.be) bieden gratis live streams voor VRT- en RTBF-wedstrijden. De Play Sports-app vereist een abonnement.' },
    ],
  },

  // ── Morocco ──────────────────────────────────────────────────────────────────
  morocco: {
    slug: 'morocco',
    name: 'Morocco',
    flag: '🇲🇦',
    timezone: 'Africa/Casablanca',
    utcOffset: 'UTC+1 (WEST)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule Morocco – SNRT, 2M & Match Times | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for Morocco. All matches free on SNRT (Al Oula) and 2M. Kickoff times in Moroccan time (WEST, UTC+1).',
    heroSubtitle: 'All matches free on SNRT and 2M. beIN Sports Arabia available for cable subscribers. Check Moroccan times.',
    intro:
      'Morocco made history at the 2022 World Cup, becoming the first African and Arab nation to ' +
      'reach the semi-finals. The Atlas Lions\'s success has transformed football viewership in ' +
      'Morocco. SNRT (Al Oula) — Morocco\'s state broadcaster — carries all World Cup matches free ' +
      'on national television as part of its mandate to broadcast major international sporting events. ' +
      '2M (Deuxième Chaîne) also carries selected matches. beIN Sports Arabia provides premium ' +
      'cable and streaming coverage. Morocco\'s time zone (WEST, UTC+1) gives 17:00, 20:00, 23:00 ' +
      'and 02:00 kickoffs — with 17:00 and 20:00 being prime-time slots.',
    channels: [
      { name: 'SNRT / Al Oula',  type: 'free-tv',        language: 'Arabic/French', coverage: 'All matches (national mandate)', where: 'Broadcast + SNRT app (free)' },
      { name: '2M',              type: 'free-tv',        language: 'French/Darija', coverage: 'Selected matches',               where: 'Broadcast + 2m.ma' },
      { name: 'beIN Sports Arabia', type: 'cable',       language: 'Arabic',        coverage: 'All 104 matches',               where: 'Satellite (Nilesat/Arabsat) + beIN Connect' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '17:00 WEST',  slot: 'Après-midi / بعد الظهر', friendly: true  },
      { utcTime: '19:00 UTC', localTime: '20:00 WEST',  slot: 'Prime Time / السهرة',    friendly: true  },
      { utcTime: '22:00 UTC', localTime: '23:00 WEST',  slot: 'Fin de soirée / ليل',    friendly: false },
      { utcTime: '01:00 UTC', localTime: '02:00 WEST',  slot: 'Nuit / فجر',             friendly: false },
    ],
    bestPickFree: 'SNRT (Al Oula) — tous les matchs gratuits (mandat national)',
    bestPickPaid: 'beIN Sports Arabia — couverture complète en arabe',
    faq: [
      { q: 'Sur quelle chaîne voir la Coupe du Monde 2026 au Maroc?', a: 'SNRT (Al Oula) diffuse tous les matchs gratuitement en vertu de son mandat national. 2M diffuse les matchs sélectionnés. beIN Sports Arabia offre une couverture premium via satellite.' },
      { q: 'À quelle heure sont les matchs de la Coupe du Monde 2026 au Maroc?', a: 'En heure marocaine (WEST, UTC+1): 17:00, 20:00, 23:00 et 02:00. Les créneaux de 17:00 et 20:00 sont les plus accessibles.' },
      { q: 'Les matchs de la Coupe du Monde 2026 sont-ils gratuits au Maroc?', a: 'Oui. SNRT (Al Oula) diffuse tous les matchs en clair, y compris ceux des Lions de l\'Atlas, conformément à son mandat de service public.' },
      { q: 'Quand est la finale de la Coupe du Monde 2026 au Maroc?', a: 'La finale du 19 juillet 2026 débutera vers 01:00 UTC, soit 02:00 heure marocaine. SNRT devrait diffuser en direct.' },
      { q: 'Est-ce que beIN Sports montre tous les matchs au Maroc?', a: 'Oui. beIN Sports Arabia diffuse les 104 matchs via satellite et la plateforme beIN Connect, disponible sur abonnement.' },
      { q: 'Comment regarder la Coupe du Monde 2026 sur mobile au Maroc?', a: 'L\'application SNRT et le site 2m.ma permettent un streaming gratuit des matchs diffusés en clair. beIN Connect est disponible sur mobile avec abonnement.' },
    ],
  },

  // ── Nigeria ──────────────────────────────────────────────────────────────────
  nigeria: {
    slug: 'nigeria',
    name: 'Nigeria',
    flag: '🇳🇬',
    timezone: 'Africa/Lagos',
    utcOffset: 'UTC+1 (WAT)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule Nigeria – SuperSport, NTA & Times | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for Nigeria. Super Eagles matches on NTA (free). SuperSport/DStv covers all 104 games. Times in WAT (UTC+1).',
    heroSubtitle: 'NTA shows Super Eagles games free. SuperSport/DStv covers all 104 matches. Check Nigerian kickoff times.',
    intro:
      'Nigeria\'s Super Eagles are one of Africa\'s most successful World Cup nations and the ' +
      'most-watched football team in the most populous country in Africa. NTA (Nigerian Television ' +
      'Authority), the national broadcaster, carries Super Eagles matches free on terrestrial TV ' +
      'as per its public mandate. SuperSport (via DStv) provides comprehensive premium coverage ' +
      'of all 104 matches across multiple dedicated sports channels. In West Africa Time ' +
      '(WAT, UTC+1), kickoffs fall at 17:00, 20:00, 23:00 and 02:00 — the 17:00 and 20:00 ' +
      'slots being comfortably in the afternoon and evening.',
    channels: [
      { name: 'NTA Network',         type: 'free-tv',        language: 'English', coverage: 'Super Eagles + selected matches', where: 'Terrestrial broadcast nationwide' },
      { name: 'SuperSport (DStv)',   type: 'cable',           language: 'English', coverage: 'All 104 matches',               where: 'DStv satellite — various packages' },
      { name: 'DStv Now / Showmax', type: 'streaming-paid',  language: 'English', coverage: 'SuperSport matches',            where: 'App / Web (DStv subscribers)' },
      { name: 'Arise TV',            type: 'cable',           language: 'English', coverage: 'Selected matches (TBC)',        where: 'Cable/Satellite' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '17:00 WAT',  slot: 'Afternoon',  friendly: true  },
      { utcTime: '19:00 UTC', localTime: '20:00 WAT',  slot: 'Evening',    friendly: true  },
      { utcTime: '22:00 UTC', localTime: '23:00 WAT',  slot: 'Late Night', friendly: false },
      { utcTime: '01:00 UTC', localTime: '02:00 WAT',  slot: 'Overnight',  friendly: false },
    ],
    bestPickFree: 'NTA Network — Super Eagles matches free on national TV',
    bestPickPaid: 'SuperSport / DStv — all 104 World Cup matches',
    faq: [
      { q: 'Where can I watch World Cup 2026 in Nigeria?', a: 'NTA (Nigerian Television Authority) broadcasts Super Eagles matches free on terrestrial TV. SuperSport (via DStv) covers all 104 matches. DStv Now and Showmax provide streaming for DStv subscribers.' },
      { q: 'What time are World Cup 2026 matches in Nigeria (WAT)?', a: 'In West Africa Time (WAT, UTC+1): 17:00, 20:00, 23:00 and 02:00. The 17:00 and 20:00 slots are the most viewer-friendly.' },
      { q: 'Is the World Cup 2026 free on NTA in Nigeria?', a: 'NTA broadcasts the Super Eagles matches free as part of its national public broadcasting mandate. For all 104 matches, a DStv SuperSport subscription is required.' },
      { q: 'Which DStv package shows World Cup 2026 in Nigeria?', a: 'SuperSport channels are available on DStv Compact, Compact Plus and Premium packages. Check the DStv website for the most up-to-date World Cup 2026 package details.' },
      { q: 'What time is the World Cup 2026 Final in Nigeria?', a: 'The Final on 19 July 2026 is expected at 01:00 UTC, which is 02:00 WAT. SuperSport and NTA will broadcast the Final.' },
      { q: 'Can I stream World Cup 2026 matches in Nigeria?', a: 'Yes. DStv Now and Showmax (for DStv subscribers) provide mobile and web streaming of SuperSport channels. Check the apps for World Cup 2026 content.' },
    ],
  },

  // ── Saudi Arabia ─────────────────────────────────────────────────────────────
  'saudi-arabia': {
    slug: 'saudi-arabia',
    name: 'Saudi Arabia',
    flag: '🇸🇦',
    timezone: 'Asia/Riyadh',
    utcOffset: 'UTC+3 (AST)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule Saudi Arabia – SSC, beIN Sports & Times | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for Saudi Arabia. All matches free on SSC (Saudi Sports Company). beIN Sports for full coverage. Times in AST (UTC+3).',
    heroSubtitle: 'SSC shows all matches free — one of the best World Cup deals. beIN Arabia for premium. Check AST times.',
    intro:
      'Saudi Arabia has one of the world\'s most generous World Cup TV arrangements. The Saudi ' +
      'Sports Company (SSC) — the official state sports broadcaster — carries all 104 World Cup ' +
      'matches on its free-to-air channels (SSC 1–6), transmitted via Arabsat and Nilesat ' +
      'satellite. This makes Saudi Arabia one of the few countries in the world where every single ' +
      'World Cup match is available completely free on national television. beIN Sports Arabia ' +
      'provides additional premium coverage. In Arabia Standard Time (AST, UTC+3), group stage ' +
      'matches kick off at 19:00, 22:00, 01:00 and 04:00 — with the evening slots being the best.',
    channels: [
      { name: 'SSC 1–6',          type: 'free-tv',        language: 'Arabic', coverage: 'All 104 matches (free!)',    where: 'Arabsat/Nilesat satellite (free-to-air)' },
      { name: 'SSC Extra app',    type: 'streaming-free',  language: 'Arabic', coverage: 'All SSC matches streaming', where: 'App / Web (free with SSC account)' },
      { name: 'beIN Sports Arabia', type: 'cable',         language: 'Arabic', coverage: 'All matches (premium)',     where: 'Satellite + beIN Connect app' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '19:00 AST',  slot: 'مساء (Evening)',        friendly: true  },
      { utcTime: '19:00 UTC', localTime: '22:00 AST',  slot: 'ليل (Late Evening)',    friendly: true  },
      { utcTime: '22:00 UTC', localTime: '01:00 AST',  slot: 'منتصف الليل (Midnight)', friendly: false },
      { utcTime: '01:00 UTC', localTime: '04:00 AST',  slot: 'فجر (Pre-dawn)',        friendly: false },
    ],
    bestPickFree: 'SSC 1–6 — all 104 matches completely free on satellite',
    bestPickPaid: 'beIN Sports Arabia — additional analysis and multi-channel coverage',
    faq: [
      { q: 'على أي قناة تشاهد كأس العالم 2026 في السعودية؟', a: 'شركة السعودية للرياضة (SSC) تبث جميع مباريات المونديال 2026 البالغ عددها 104 مباريات مجاناً عبر قنوات SSC 1-6 على الأقمار الصناعية عربسات ونايلسات. beIN Sports العربية تقدم تغطية متميزة بالاشتراك.' },
      { q: 'ما هي أوقات مباريات كأس العالم 2026 بتوقيت السعودية؟', a: 'بتوقيت المملكة العربية السعودية (AST، UTC+3): 19:00 و22:00 و01:00 و04:00. أفضل الأوقات للمشاهدة هي ساعات المساء (19:00 و22:00).' },
      { q: 'هل كأس العالم 2026 مجاني في السعودية؟', a: 'نعم. SSC تبث جميع المباريات الـ 104 مجاناً عبر الأقمار الصناعية. SSC Extra (التطبيق) يتيح البث المجاني مع حساب مجاني.' },
      { q: 'كيف أشاهد كأس العالم 2026 على الجوال؟', a: 'تطبيق SSC Extra يتيح مشاهدة جميع المباريات مجاناً على الهواتف الذكية والأجهزة اللوحية والتلفزيون الذكي بعد إنشاء حساب مجاني.' },
      { q: 'متى يعقد نهائي كأس العالم 2026 بتوقيت السعودية؟', a: 'النهائي في 19 يوليو 2026 بملعب ميتلايف ستاديوم متوقع أن ينطلق حوالي الساعة 01:00 UTC أي الساعة 04:00 فجراً بتوقيت السعودية.' },
      { q: 'هل beIN Sports تعرض كأس العالم 2026؟', a: 'نعم. beIN Sports العربية تقدم تغطية شاملة لكأس العالم 2026 عبر القمر الصناعي وتطبيق beIN Connect بالاشتراك، بجانب التغطية المجانية على SSC.' },
    ],
  },

  // ── Poland ───────────────────────────────────────────────────────────────────
  poland: {
    slug: 'poland',
    name: 'Poland',
    flag: '🇵🇱',
    timezone: 'Europe/Warsaw',
    utcOffset: 'UTC+2 (CEST)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule Poland – TVP, Canal+ & Godziny | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for Poland. Poland matches free on TVP. Canal+ Poland covers all 104 games. Kickoff times in Polish time (CEST, UTC+2).',
    heroSubtitle: 'TVP shows Poland matches free. Canal+ covers all 104 games. Check Polish kickoff times.',
    intro:
      'Poland has a proud World Cup history and Robert Lewandowski led the team to consecutive ' +
      'World Cup appearances. TVP (Telewizja Polska), the state broadcaster, carries Poland ' +
      'national team matches and selected fixtures free on TVP1 and TVP2. Canal+ Poland provides ' +
      'comprehensive coverage of all 104 matches for subscribers. Polsat may also carry selected ' +
      'matches. In Central European Summer Time (CEST, UTC+2), kickoffs fall at 18:00, 21:00, ' +
      'midnight and 03:00 — with the evening slots being best for Polish fans.',
    channels: [
      { name: 'TVP1 / TVP2',      type: 'free-tv',        language: 'Polish', coverage: 'Poland games + selected matches', where: 'Broadcast + TVP GO (free stream)' },
      { name: 'TVP GO',           type: 'streaming-free',  language: 'Polish', coverage: 'All TVP broadcast matches',      where: 'tvpgo.pl — free access' },
      { name: 'Canal+ Poland',   type: 'cable',            language: 'Polish', coverage: 'All 104 matches',               where: 'Cable/Sat + Canal+ online app' },
      { name: 'Polsat',           type: 'free-tv',         language: 'Polish', coverage: 'Selected matches (TBC)',         where: 'Broadcast + Polsat Box Go' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '18:00 CEST',               slot: 'Wczesny wieczór', friendly: true  },
      { utcTime: '19:00 UTC', localTime: '21:00 CEST',               slot: 'Prime time',      friendly: true  },
      { utcTime: '22:00 UTC', localTime: '00:00 CEST (kolejny dzień)', slot: 'Północ',         friendly: false },
      { utcTime: '01:00 UTC', localTime: '03:00 CEST (kolejny dzień)', slot: 'Noc',            friendly: false },
    ],
    bestPickFree: 'TVP1 / TVP GO — mecze Polski gratis w TV i streamingu',
    bestPickPaid: 'Canal+ Poland — pełna transmisja wszystkich 104 meczów',
    faq: [
      { q: 'Gdzie oglądać MŚ 2026 w Polsce?', a: 'TVP (TVP1/TVP2) transmituje mecze reprezentacji Polski gratis. Canal+ Poland ma prawa do wszystkich 104 meczów. TVP GO oferuje darmowy streaming meczów TVP.' },
      { q: 'O której godzinie są mecze MŚ 2026 w Polsce?', a: 'W polskim czasie letnim (CEST, UTC+2): 18:00, 21:00, 00:00 i 03:00. Najwygodniejsze są sloty o 18:00 i 21:00.' },
      { q: 'Czy MŚ 2026 można oglądać za darmo w Polsce?', a: 'Tak. TVP emituje mecze Polski i wybrane spotkania za darmo na TVP1/TVP2 i w streamingu na TVP GO. Canal+ Poland wymaga abonamentu.' },
      { q: 'O której jest finał MŚ 2026 w Polsce?', a: 'Finał 19 lipca 2026 na MetLife Stadium rozpocznie się ok. 21:00 CEST. TVP i Canal+ będą transmitować na żywo.' },
      { q: 'Czy Canal+ Poland ma wszystkie mecze MŚ 2026?', a: 'Tak. Canal+ Poland posiada prawa do transmisji wszystkich 104 meczów MŚ 2026, dostępne przez kabel, satelitę i aplikację Canal+ online.' },
      { q: 'Jak oglądać MŚ 2026 na telefonie w Polsce?', a: 'TVP GO (tvpgo.pl) oferuje darmowy streaming meczów TVP. Canal+ online app (z subskrypcją) daje dostęp do wszystkich 104 meczów na mobile i Smart TV.' },
    ],
  },

  // ── Colombia ─────────────────────────────────────────────────────────────────
  colombia: {
    slug: 'colombia',
    name: 'Colombia',
    flag: '🇨🇴',
    timezone: 'America/Bogota',
    utcOffset: 'UTC−5 (COT)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule Colombia – Caracol, ESPN & Horarios | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for Colombia. Colombia matches free on Caracol and RCN. ESPN covers all 104 games. Kickoff times in COT (UTC−5).',
    heroSubtitle: 'Caracol and RCN show Colombia games free. ESPN covers all 104 matches. Check Colombian kickoff times.',
    intro:
      'Colombia is one of South America\'s most passionate football nations, and the Colombian ' +
      'TV schedule for the 2026 World Cup offers excellent accessibility. Caracol TV and RCN — ' +
      'the two main free-to-air channels — broadcast Colombia national team matches free for ' +
      'all viewers. ESPN Colombia provides comprehensive cable coverage of all 104 matches. ' +
      'Win Sports+ may carry additional games. Colombia\'s time zone (COT, UTC−5) gives fans ' +
      'ideal kickoff times of 11:00, 14:00, 17:00 and 20:00 — all civil hours with no ' +
      'overnight matches.',
    channels: [
      { name: 'Caracol TV',   type: 'free-tv',        language: 'Spanish', coverage: 'Colombia games + selected matches', where: 'Broadcast TV + Caracol Play (free)' },
      { name: 'RCN',          type: 'free-tv',        language: 'Spanish', coverage: 'Colombia games + selected matches', where: 'Broadcast TV + RCN app' },
      { name: 'ESPN Colombia', type: 'cable',          language: 'Spanish', coverage: 'All 104 matches',                 where: 'Cable/Satellite + Star+ streaming' },
      { name: 'Win Sports+',  type: 'cable',           language: 'Spanish', coverage: 'Selected matches (TBC)',          where: 'Cable/Sat + Win Sports app' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '11:00 COT',  slot: 'Mañana',     friendly: true },
      { utcTime: '19:00 UTC', localTime: '14:00 COT',  slot: 'Mediodía',   friendly: true },
      { utcTime: '22:00 UTC', localTime: '17:00 COT',  slot: 'Tarde',      friendly: true },
      { utcTime: '01:00 UTC', localTime: '20:00 COT',  slot: 'Prime Time', friendly: true },
    ],
    bestPickFree: 'Caracol TV / RCN — partidos de Colombia gratis en señal abierta',
    bestPickPaid: 'ESPN Colombia — cobertura completa de los 104 partidos',
    faq: [
      { q: '¿Dónde ver el Mundial 2026 en Colombia?', a: 'Caracol TV y RCN transmiten los partidos de la Selección Colombia gratis. ESPN Colombia (cable) cubre todos los 104 partidos. Star+ ofrece streaming con suscripción.' },
      { q: '¿A qué hora son los partidos del Mundial 2026 en Colombia?', a: 'En hora colombiana (COT, UTC−5): 11:00, 14:00, 17:00 y 20:00. Todos los horarios son muy cómodos — sin madrugadas.' },
      { q: '¿Los partidos de Colombia son gratis en TV?', a: 'Sí. Caracol TV y RCN tienen el mandato de transmitir los partidos de la Selección Colombia en señal abierta de forma gratuita.' },
      { q: '¿Cuándo es la final del Mundial 2026 en hora colombiana?', a: 'La final del 19 de julio de 2026 comenzará a las 20:00 COT (01:00 UTC del 20 de julio). Caracol y ESPN transmitirán en vivo.' },
      { q: '¿ESPN Colombia tiene todos los partidos del Mundial?', a: 'Sí. ESPN Colombia, vía cable o satélite, tiene derechos para la transmisión de los 104 partidos. Star+ permite el streaming para suscriptores.' },
      { q: '¿Puedo ver el Mundial 2026 por internet en Colombia?', a: 'Sí. Caracol Play (caracol.tv) tiene streaming gratuito de los partidos de Caracol TV. Para todos los partidos, Star+ (con suscripción) transmite el contenido de ESPN.' },
    ],
  },

  // ── Egypt ────────────────────────────────────────────────────────────────────
  egypt: {
    slug: 'egypt',
    name: 'Egypt',
    flag: '🇪🇬',
    timezone: 'Africa/Cairo',
    utcOffset: 'UTC+3 (EET)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule Egypt – beIN Sports, Nile Sport & Times | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for Egypt. Nile Sport shows selected matches free. beIN Sports covers all 104 games. Times in EET (UTC+3).',
    heroSubtitle: 'Nile Sport and Egypt TV show selected matches free. beIN Sports covers all 104 games. Check Egyptian times.',
    intro:
      'Egypt, home to the legendary Mohamed Salah, has one of the most passionate football ' +
      'fan bases in Africa and the Arab world. For World Cup 2026, beIN Sports Arabia carries ' +
      'comprehensive coverage of all 104 matches via satellite and the beIN Connect app. Egypt\'s ' +
      'national broadcaster — ERTU (Egyptian Radio and Television Union) via Nile Sport — ' +
      'traditionally broadcasts selected matches on free-to-air television. In Eastern European ' +
      'Time (EET, UTC+3), group stage matches kick off at 19:00, 22:00, 01:00 and 04:00 — ' +
      'with the 19:00 and 22:00 evening slots being most accessible for Egyptian viewers.',
    channels: [
      { name: 'Nile Sport (ERTU)',    type: 'free-tv',       language: 'Arabic', coverage: 'Selected matches (national TV)', where: 'Nilesat satellite + ERTU app' },
      { name: 'beIN Sports Arabia',   type: 'cable',          language: 'Arabic', coverage: 'All 104 matches',              where: 'Arabsat/Nilesat + beIN Connect app' },
      { name: 'beIN Connect',         type: 'streaming-paid', language: 'Arabic', coverage: 'All beIN matches streaming',  where: 'App / Web (beIN subscription)' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '19:00 EET',  slot: 'مساء (Evening)',         friendly: true  },
      { utcTime: '19:00 UTC', localTime: '22:00 EET',  slot: 'ليل (Late Evening)',     friendly: true  },
      { utcTime: '22:00 UTC', localTime: '01:00 EET',  slot: 'منتصف الليل (Midnight)', friendly: false },
      { utcTime: '01:00 UTC', localTime: '04:00 EET',  slot: 'فجر (Pre-dawn)',         friendly: false },
    ],
    bestPickFree: 'Nile Sport / ERTU — selected matches free on satellite',
    bestPickPaid: 'beIN Sports Arabia — all 104 matches via satellite and streaming',
    faq: [
      { q: 'على أي قناة مشاهدة كأس العالم 2026 في مصر؟', a: 'beIN Sports العربية تبث جميع المباريات الـ 104 عبر الأقمار الصناعية وتطبيق beIN Connect. قناة النيل للرياضة (ERTU) تبث مباريات مختارة مجاناً عبر القمر الاصطناعي.' },
      { q: 'ما هي مواعيد مباريات كأس العالم 2026 بالتوقيت المصري؟', a: 'بتوقيت مصر (EET، UTC+3): 19:00 و22:00 و01:00 و04:00. أفضل الأوقات للمشاهدة هي 19:00 و22:00 مساءً.' },
      { q: 'هل كأس العالم 2026 مجاني في مصر؟', a: 'قناة النيل للرياضة (ERTU) تبث مباريات مختارة مجاناً عبر نايلسات. beIN Sports العربية تتطلب اشتراكاً للتغطية الكاملة.' },
      { q: 'كيف أشاهد كأس العالم 2026 على الإنترنت في مصر؟', a: 'تطبيق beIN Connect يتيح بث جميع مباريات كأس العالم على الهواتف الذكية والحاسوب والتلفاز الذكي بموجب اشتراك beIN Sports.' },
      { q: 'متى يعقد نهائي كأس العالم 2026 بالتوقيت المصري؟', a: 'النهائي في 19 يوليو 2026 بملعب ميتلايف ستاديوم متوقع أن ينطلق حوالي الساعة 01:00 UTC أي الساعة 04:00 فجراً بالتوقيت المصري.' },
      { q: 'هل beIN Sports تعرض جميع مباريات كأس العالم في مصر؟', a: 'نعم. beIN Sports العربية تمتلك حقوق بث جميع مباريات كأس العالم 2026 الـ 104 في مصر ومنطقة الشرق الأوسط وشمال أفريقيا.' },
    ],
  },

  // ── South Africa ─────────────────────────────────────────────────────────────
  'south-africa': {
    slug: 'south-africa',
    name: 'South Africa',
    flag: '🇿🇦',
    timezone: 'Africa/Johannesburg',
    utcOffset: 'UTC+2 (SAST)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule South Africa – SuperSport, SABC & Times | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for South Africa. SABC shows selected matches free. SuperSport/DStv covers all 104 games. Times in SAST (UTC+2).',
    heroSubtitle: 'SABC shows Bafana Bafana and selected matches free. SuperSport covers all 104 games. Check SAST times.',
    intro:
      'South Africa hosted the 2010 World Cup — the first held on African soil — and football ' +
      'remains enormously popular. SABC (South African Broadcasting Corporation), the public ' +
      'broadcaster, carries Bafana Bafana matches and selected high-profile fixtures free on ' +
      'SABC 1, 2 and 3. SuperSport (via DStv) provides comprehensive coverage of all 104 ' +
      'matches across dedicated sports channels. In South Africa Standard Time (SAST, UTC+2), ' +
      'group stage kickoffs fall at 18:00, 21:00, midnight and 03:00 — with the 18:00 and 21:00 ' +
      'slots being ideal prime-time viewing.',
    channels: [
      { name: 'SABC 1/2/3',         type: 'free-tv',       language: 'English/Zulu/Sotho', coverage: 'Bafana Bafana + selected', where: 'Broadcast TV + SABC+ app' },
      { name: 'SuperSport (DStv)',   type: 'cable',          language: 'English',            coverage: 'All 104 matches',         where: 'DStv satellite — various packages' },
      { name: 'DStv Now / Showmax', type: 'streaming-paid', language: 'English',            coverage: 'SuperSport matches',      where: 'App / Web (DStv subscribers)' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '18:00 SAST',               slot: 'Early Evening', friendly: true  },
      { utcTime: '19:00 UTC', localTime: '21:00 SAST',               slot: 'Prime Time',    friendly: true  },
      { utcTime: '22:00 UTC', localTime: '00:00 SAST (next day)',    slot: 'Midnight',      friendly: false },
      { utcTime: '01:00 UTC', localTime: '03:00 SAST (next day)',    slot: 'Overnight',     friendly: false },
    ],
    bestPickFree: 'SABC — Bafana Bafana and big matches free on public TV',
    bestPickPaid: 'SuperSport / DStv — all 104 World Cup matches',
    faq: [
      { q: 'Where to watch World Cup 2026 in South Africa?', a: 'SABC broadcasts Bafana Bafana matches and selected games free on public TV. SuperSport (via DStv) covers all 104 matches. Showmax and DStv Now offer streaming for subscribers.' },
      { q: 'What time are World Cup 2026 matches in South Africa (SAST)?', a: 'In South Africa Standard Time (SAST, UTC+2): 18:00, 21:00, 00:00 and 03:00. The 18:00 and 21:00 slots are the most convenient.' },
      { q: 'Is the World Cup 2026 free on SABC in South Africa?', a: 'SABC will broadcast Bafana Bafana matches and selected key rounds free on SABC 1, 2 or 3. The SABC+ app may provide free streaming of these matches.' },
      { q: 'Which DStv package has World Cup 2026?', a: 'SuperSport channels showing the World Cup are available on DStv Compact, Compact Plus and Premium packages. Visit the DStv website for specific World Cup 2026 channel allocation.' },
      { q: 'What time is the World Cup 2026 Final in South Africa?', a: 'The Final on 19 July 2026 is expected at 01:00 UTC, which is 03:00 SAST. SuperSport and SABC will broadcast the Final.' },
      { q: 'Can I watch World Cup 2026 on Showmax in South Africa?', a: 'Yes. Showmax (for DStv subscribers) provides streaming access to SuperSport content including World Cup 2026 matches via mobile and web.' },
    ],
  },

  // ── New Zealand ──────────────────────────────────────────────────────────────
  'new-zealand': {
    slug: 'new-zealand',
    name: 'New Zealand',
    flag: '🇳🇿',
    timezone: 'Pacific/Auckland',
    utcOffset: 'UTC+12 (NZST)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule New Zealand – Sky Sport NZ & Times | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for New Zealand. Sky Sport NZ has all 104 matches. TVNZ may show All Whites games free. Times in NZST (UTC+12).',
    heroSubtitle: 'Sky Sport NZ covers all 104 matches. TVNZ may show All Whites free. Check NZ kickoff times (NZST).',
    intro:
      'New Zealand\'s football following has grown significantly since the All Whites\' landmark ' +
      'appearance at the 2010 World Cup. Sky Sport New Zealand holds comprehensive broadcast ' +
      'rights for all 104 World Cup 2026 matches. TVNZ (public broadcaster) may carry All Whites ' +
      'matches free if New Zealand qualifies. Sky Go provides mobile and streaming access for Sky ' +
      'subscribers. In New Zealand Standard Time (NZST, UTC+12), group stage kickoffs run from ' +
      '04:00 to 13:00 — with the 10:00 and 13:00 morning and early afternoon slots being the ' +
      'most viewer-friendly.',
    channels: [
      { name: 'Sky Sport NZ 1–7', type: 'cable',          language: 'English', coverage: 'All 104 matches',            where: 'Sky satellite/cable + Sky Go app' },
      { name: 'Sky Go',           type: 'streaming-paid', language: 'English', coverage: 'All Sky matches streaming',  where: 'App / Web (Sky NZ subscribers)' },
      { name: 'TVNZ (Freeview)', type: 'free-tv',         language: 'English', coverage: 'All Whites matches (TBC)',   where: 'Freeview broadcast + TVNZ+ streaming' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '04:00 NZST (next day)',  slot: 'Overnight',           friendly: false },
      { utcTime: '19:00 UTC', localTime: '07:00 NZST (next day)',  slot: 'Early Morning',       friendly: true  },
      { utcTime: '22:00 UTC', localTime: '10:00 NZST',            slot: 'Late Morning',         friendly: true  },
      { utcTime: '01:00 UTC', localTime: '13:00 NZST',            slot: 'Afternoon (best)',     friendly: true  },
    ],
    bestPickFree: 'TVNZ — All Whites matches free (if NZ qualifies)',
    bestPickPaid: 'Sky Sport NZ — all 104 World Cup matches',
    faq: [
      { q: 'Where to watch World Cup 2026 in New Zealand?', a: 'Sky Sport NZ has comprehensive rights for all 104 matches. TVNZ may carry All Whites matches free. Sky Go streams Sky Sport content on mobile and Smart TV.' },
      { q: 'What time are World Cup 2026 matches in New Zealand (NZST)?', a: 'In New Zealand Standard Time (NZST, UTC+12): 04:00, 07:00, 10:00 and 13:00. The 10:00 and 13:00 slots are the most convenient for NZ viewers.' },
      { q: 'Is World Cup 2026 on TVNZ in New Zealand?', a: 'TVNZ may broadcast All Whites matches free if New Zealand qualifies for World Cup 2026. For all matches, Sky Sport NZ subscription is required.' },
      { q: 'Does Sky Sport NZ have all World Cup 2026 games?', a: 'Yes. Sky Sport NZ holds comprehensive broadcast rights for all 104 FIFA World Cup 2026 matches, available across Sky Sport channels 1–7.' },
      { q: 'What time is the World Cup 2026 Final in New Zealand?', a: 'The Final on 19 July 2026 is expected at 01:00 UTC, which is 13:00 NZST on 19 July. An excellent afternoon viewing time for New Zealand!' },
      { q: 'Can I watch World Cup 2026 on Sky Go in New Zealand?', a: 'Yes. Sky Go (the Sky NZ streaming app) lets you watch all Sky Sport channels including World Cup 2026 matches on mobile, tablet and Smart TV with a Sky subscription.' },
    ],
  },

  // ── Ecuador ──────────────────────────────────────────────────────────────────
  ecuador: {
    slug: 'ecuador',
    name: 'Ecuador',
    flag: '🇪🇨',
    timezone: 'America/Guayaquil',
    utcOffset: 'UTC−5 (ECT)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule Ecuador – TC, RTS & Horarios | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for Ecuador. Ecuador matches free on TC and RTS. ESPN covers all 104 games. Kickoff times in ECT (UTC−5).',
    heroSubtitle: 'TC and RTS show Ecuador games free. ESPN covers all 104 matches. Check Ecuadorian kickoff times.',
    intro:
      'Ecuador has qualified for three consecutive World Cups — 2002, 2006 and 2022 — and the ' +
      'national team\'s success has generated enormous football enthusiasm. TC Televisión and RTS ' +
      '(Radio Televisión Señal) broadcast Ecuador matches free on terrestrial TV. Ecuador Sports ' +
      'and ESPN provide comprehensive cable coverage. In Ecuador Time (ECT, UTC−5), kickoffs fall ' +
      'at 11:00, 14:00, 17:00 and 20:00 — all comfortable daytime and evening slots with no ' +
      'overnight matches.',
    channels: [
      { name: 'TC Televisión',  type: 'free-tv',       language: 'Spanish', coverage: 'Ecuador games + selected matches', where: 'Broadcast TV + TCMi app' },
      { name: 'RTS',            type: 'free-tv',       language: 'Spanish', coverage: 'Selected matches (TBC)',           where: 'Broadcast TV' },
      { name: 'ESPN Ecuador',   type: 'cable',          language: 'Spanish', coverage: 'All 104 matches',                where: 'Cable/Satellite + Star+ streaming' },
      { name: 'Star+',          type: 'streaming-paid', language: 'Spanish', coverage: 'ESPN matches via streaming',    where: 'App / Web (Disney subscription)' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '11:00 ECT',  slot: 'Mañana',     friendly: true },
      { utcTime: '19:00 UTC', localTime: '14:00 ECT',  slot: 'Mediodía',   friendly: true },
      { utcTime: '22:00 UTC', localTime: '17:00 ECT',  slot: 'Tarde',      friendly: true },
      { utcTime: '01:00 UTC', localTime: '20:00 ECT',  slot: 'Prime Time', friendly: true },
    ],
    bestPickFree: 'TC Televisión / RTS — partidos de Ecuador gratis en señal abierta',
    bestPickPaid: 'ESPN Ecuador / Star+ — cobertura completa de los 104 partidos',
    faq: [
      { q: '¿Dónde ver el Mundial 2026 en Ecuador?', a: 'TC Televisión y RTS transmiten los partidos de la Tri gratis en TV abierta. ESPN Ecuador (cable) cubre todos los 104 partidos. Star+ ofrece streaming con suscripción.' },
      { q: '¿A qué hora son los partidos del Mundial 2026 en Ecuador?', a: 'En hora ecuatoriana (ECT, UTC−5): 11:00, 14:00, 17:00 y 20:00. Todos los horarios son cómodos — sin madrugadas.' },
      { q: '¿Los partidos de Ecuador en el Mundial son gratis?', a: 'Sí. TC Televisión y RTS tienen el mandato de transmitir los partidos de La Tri en señal abierta de forma gratuita.' },
      { q: '¿Cuándo es la final del Mundial 2026 en horario de Ecuador?', a: 'La final del 19 de julio de 2026 comenzará a las 20:00 ECT (01:00 UTC del 20 de julio). TC y ESPN transmitirán en vivo.' },
      { q: '¿ESPN tiene todos los partidos del Mundial 2026 en Ecuador?', a: 'Sí. ESPN Ecuador tiene derechos para la transmisión de los 104 partidos del Mundial 2026. Star+ es la opción de streaming con suscripción Disney.' },
      { q: '¿Puedo ver el Mundial 2026 gratis en Ecuador?', a: 'Sí, los partidos de La Tri están en TC Televisión y RTS gratis. La app TCMi puede ofrecer streaming de TC. Para todos los partidos, se necesita cable o Star+.' },
    ],
  },

  // ── Croatia ──────────────────────────────────────────────────────────────────
  croatia: {
    slug: 'croatia',
    name: 'Croatia',
    flag: '🇭🇷',
    timezone: 'Europe/Zagreb',
    utcOffset: 'UTC+2 (CEST)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule Croatia – HRT, Sport Klub & Termini | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for Croatia. Croatia matches free on HRT. Sport Klub covers all 104 games. Kickoff times in Croatian time (CEST, UTC+2).',
    heroSubtitle: 'HRT shows Vatreni matches free. Sport Klub covers all 104 games. Check Croatian kickoff times.',
    intro:
      'Croatia\'s "Vatreni" (The Blazers) are one of Europe\'s most successful World Cup nations ' +
      'of the modern era, reaching the Final in 2018 and the semi-finals in 2022. HRT (Hrvatska ' +
      'radiotelevizija), Croatia\'s public broadcaster, carries Croatia national team matches and ' +
      'selected fixtures free on HTV1. Sport Klub provides comprehensive cable coverage of all ' +
      '104 matches. In Central European Summer Time (CEST, UTC+2), kickoffs are at 18:00, 21:00, ' +
      'midnight and 03:00 — with the prime-time slots being best for Croatian fans.',
    channels: [
      { name: 'HRT / HTV1',    type: 'free-tv',        language: 'Croatian', coverage: 'Croatia games + selected',  where: 'Broadcast + HRTi (free stream)' },
      { name: 'HRTi',          type: 'streaming-free',  language: 'Croatian', coverage: 'All HRT broadcast matches', where: 'hrti.hrt.hr — free with account' },
      { name: 'Sport Klub 1–3', type: 'cable',          language: 'Croatian', coverage: 'All 104 matches',          where: 'Cable/Sat + Sport Klub app' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '18:00 CEST',               slot: 'Rano večer',     friendly: true  },
      { utcTime: '19:00 UTC', localTime: '21:00 CEST',               slot: 'Primetime',      friendly: true  },
      { utcTime: '22:00 UTC', localTime: '00:00 CEST (sutradan)',    slot: 'Ponoć',          friendly: false },
      { utcTime: '01:00 UTC', localTime: '03:00 CEST (sutradan)',    slot: 'Noć',            friendly: false },
    ],
    bestPickFree: 'HRT / HRTi — utakmice Vatrenih besplatno u HTV-u i streamingu',
    bestPickPaid: 'Sport Klub — sve 104 utakmice',
    faq: [
      { q: 'Gdje gledati SP 2026 u Hrvatskoj?', a: 'HRT (HTV1) prenosi utakmice Vatrenih i odabrane susrete besplatno. Sport Klub (kabel/satelit) ima sve 104 utakmice. HRTi nudi besplatni streaming HRT prijenosa.' },
      { q: 'U koliko sati su utakmice SP 2026 u Hrvatskoj?', a: 'Prema hrvatskom ljetnom vremenu (CEST, UTC+2): 18:00, 21:00, 00:00 i 03:00. Najpovoljniji termini su 18:00 i 21:00.' },
      { q: 'Je li SP 2026 besplatan u Hrvatskoj?', a: 'Da. HRT prenosi utakmice Vatrenih besplatno na HTV1 i putem HRTi streaminga. Za sve 104 utakmice potreban je Sport Klub pretplata.' },
      { q: 'Kad je finale SP 2026 u Hrvatskoj?', a: 'Finale 19. srpnja 2026. na MetLife Stadiumu trebalo bi početi oko 21:00 CEST. HRT i Sport Klub prenose finale uživo.' },
      { q: 'Ima li Sport Klub sve utakmice SP 2026?', a: 'Da. Sport Klub 1–3 ima sve 104 utakmice Svjetskog Prventa 2026 putem kabelske/satelitske televizije i Sport Klub aplikacije.' },
      { q: 'Kako gledati SP 2026 na mobitelu u Hrvatskoj?', a: 'HRTi (hrti.hrt.hr) nudi besplatan live stream HRT prijenosa. Sport Klub aplikacija (uz pretplatu) pruža pristup svim utakmicama na mobilnim uređajima i Smart TV-u.' },
    ],
  },

  // ── Turkey ───────────────────────────────────────────────────────────────────
  turkey: {
    slug: 'turkey',
    name: 'Turkey',
    flag: '🇹🇷',
    timezone: 'Europe/Istanbul',
    utcOffset: 'UTC+3 (TRT)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule Turkey – TRT Sport, S Sport & Saatler | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for Turkey. All matches free on TRT Sport. S Sport has full coverage. Kickoff times in Turkish time (TRT, UTC+3).',
    heroSubtitle: 'TRT Sport shows all matches free — one of the world\'s best WC deals. Check Turkish kickoff times.',
    intro:
      'Turkish football fans benefit from exceptional World Cup TV coverage. TRT Sport — Turkey\'s ' +
      'state sports broadcaster — has historically carried all World Cup matches free-to-air, ' +
      'making Turkey one of the few countries where the entire tournament is available on public ' +
      'television at no cost. S Sport (subscription) provides premium coverage with additional ' +
      'analysis. Exxen/Tivibu offers streaming options. In Turkey Time (TRT, UTC+3), group stage ' +
      'matches kick off at 19:00, 22:00, 01:00 and 04:00 — with the 19:00 and 22:00 evening ' +
      'slots being the most convenient for Turkish viewers.',
    channels: [
      { name: 'TRT Sport 1–2', type: 'free-tv',        language: 'Turkish', coverage: 'All matches free (state TV)',  where: 'Broadcast + TRT SPORT app (free)' },
      { name: 'TRT SPORT app', type: 'streaming-free',  language: 'Turkish', coverage: 'All TRT matches streaming',  where: 'iOS / Android / Web (free)' },
      { name: 'S Sport',       type: 'cable',            language: 'Turkish', coverage: 'All 104 matches + extras',  where: 'Cable/Sat + S Sport+ streaming' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '19:00 TRT',  slot: 'Akşam (Evening)',    friendly: true  },
      { utcTime: '19:00 UTC', localTime: '22:00 TRT',  slot: 'Gece başlangıcı',   friendly: true  },
      { utcTime: '22:00 UTC', localTime: '01:00 TRT',  slot: 'Gece yarısı',       friendly: false },
      { utcTime: '01:00 UTC', localTime: '04:00 TRT',  slot: 'Sabah erken',       friendly: false },
    ],
    bestPickFree: 'TRT Sport — tüm 104 maç ücretsiz devlet yayıncısında',
    bestPickPaid: 'S Sport — tam kapsamlı yayın ve ek analizler',
    faq: [
      { q: '2026 Dünya Kupası hangi kanalda? / Which channel shows World Cup 2026 in Turkey?', a: 'TRT Sport, Dünya Kupası 2026\'nın tüm maçlarını ücretsiz olarak yayınlaması bekleniyor. S Sport premium kapsam sunuyor. TRT SPORT uygulaması ücretsiz mobil izleme imkânı sağlıyor.' },
      { q: '2026 Dünya Kupası maçları Türkiye saatiyle kaçta başlıyor?', a: 'Türkiye saatiyle (TRT, UTC+3): 19:00, 22:00, 01:00 ve 04:00. 19:00 ve 22:00 akşam slotları en uygun izleme saatleri.' },
      { q: '2026 Dünya Kupası Türkiye\'de ücretsiz mi?', a: 'Evet. TRT Sport, Dünya Kupası maçlarını tarihsel olarak ücretsiz yayınlamıştır. TRT SPORT uygulaması da ücretsiz mobil stream sunuyor.' },
      { q: '2026 Dünya Kupası finali Türkiye saatiyle kaçta?', a: '19 Temmuz 2026\'daki final (MetLife Stadium) yaklaşık 01:00 TRT\'de başlaması bekleniyor. TRT Sport ve S Sport canlı yayın yapacak.' },
      { q: 'S Sport tüm Dünya Kupası 2026 maçlarını veriyor mu?', a: 'Evet. S Sport, Dünya Kupası 2026\'nın tüm 104 maçını kablo/uydu ve S Sport+ uygulaması aracılığıyla yayınlıyor.' },
      { q: 'TRT SPORT uygulamasından Dünya Kupası 2026 nasıl izlenir?', a: 'TRT SPORT uygulamasını App Store veya Google Play\'den ücretsiz indirin. TRT Sport kanallarını canlı olarak akıllı telefon, tablet ve bilgisayardan izleyebilirsiniz.' },
    ],
  },

  // ── Senegal ──────────────────────────────────────────────────────────────────
  senegal: {
    slug: 'senegal',
    name: 'Senegal',
    flag: '🇸🇳',
    timezone: 'Africa/Dakar',
    utcOffset: 'UTC+0 (GMT)',
    metaTitle: 'FIFA World Cup 2026 TV Schedule Senegal – Canal+, TFM & Match Times | GoalRadar',
    metaDesc: 'World Cup 2026 TV schedule for Senegal. Lions of Teranga matches on TFM and 2STV free. Canal+ Afrique covers all 104 games. Times in GMT (UTC+0).',
    heroSubtitle: 'TFM and 2STV show Lions of Teranga games free. Canal+ Afrique covers all 104 matches. Check Dakar times.',
    intro:
      'Senegal\'s Lions of Teranga reached the semi-finals of the 2002 World Cup and won the ' +
      '2021 Africa Cup of Nations, making it one of the continent\'s most successful and ' +
      'passionate football nations. TFM (Télévision Futurs Médias) and 2STV broadcast ' +
      'selected World Cup matches including Senegalese national team games free on national ' +
      'television. Canal+ Afrique provides comprehensive coverage of all 104 matches via ' +
      'satellite. Senegal\'s GMT time zone (UTC+0) gives excellent daytime and evening ' +
      'kickoff times: 16:00, 19:00, 22:00 and 01:00 local — matching UTC exactly.',
    channels: [
      { name: 'TFM',            type: 'free-tv',       language: 'French/Wolof', coverage: 'Lions of Teranga + selected',   where: 'Broadcast TV + TFM app' },
      { name: '2STV',           type: 'free-tv',       language: 'French/Wolof', coverage: 'Selected matches (TBC)',        where: 'Broadcast TV + 2STV app' },
      { name: 'Canal+ Afrique', type: 'cable',          language: 'French',       coverage: 'All 104 matches',              where: 'Satellite (CanalSat Afrique) + myCanal' },
      { name: 'RTS (Sénégal)', type: 'free-tv',        language: 'French/Wolof', coverage: 'Major matches (TBC)',           where: 'National TV broadcast' },
    ],
    kickoffs: [
      { utcTime: '16:00 UTC', localTime: '16:00 GMT',  slot: 'Après-midi',   friendly: true  },
      { utcTime: '19:00 UTC', localTime: '19:00 GMT',  slot: 'Soirée',       friendly: true  },
      { utcTime: '22:00 UTC', localTime: '22:00 GMT',  slot: 'Nuit',         friendly: false },
      { utcTime: '01:00 UTC', localTime: '01:00 GMT',  slot: 'Nuit profonde', friendly: false },
    ],
    bestPickFree: 'TFM / 2STV — Lions de la Teranga matches gratis',
    bestPickPaid: 'Canal+ Afrique — couverture complète des 104 matchs',
    faq: [
      { q: 'Sur quelle chaîne voir la Coupe du Monde 2026 au Sénégal ?', a: 'TFM et 2STV diffusent les matchs des Lions de la Teranga et des sélections choisies gratuitement. Canal+ Afrique (abonnement) couvre les 104 rencontres. RTS peut diffuser les grands matchs.' },
      { q: 'À quelle heure sont les matchs de la Coupe du Monde 2026 au Sénégal ?', a: 'Le Sénégal est en GMT (UTC+0), ce qui donne des horaires identiques à l\'UTC : 16h00, 19h00, 22h00 et 01h00. Les créneaux de 16h00 et 19h00 sont les plus pratiques.' },
      { q: 'La Coupe du Monde 2026 est-elle gratuite au Sénégal ?', a: 'TFM, 2STV et RTS diffusent les matchs des Lions de la Teranga et les affiches phares gratuitement. Canal+ Afrique nécessite un abonnement pour la couverture complète.' },
      { q: 'Canal+ Afrique montre-t-il tous les matchs de la Coupe du Monde ?', a: 'Oui. Canal+ Afrique dispose des droits pour l\'intégralité des 104 matchs de la Coupe du Monde 2026 via le bouquet CanalSat Afrique et l\'application myCanal.' },
      { q: 'Quand est la finale de la Coupe du Monde 2026 au Sénégal ?', a: 'La finale du 19 juillet 2026 débutera à 01h00 UTC (01h00 heure de Dakar). TFM, RTS et Canal+ Afrique devraient diffuser en direct.' },
      { q: 'Comment regarder la Coupe du Monde 2026 sur mobile au Sénégal ?', a: 'L\'application TFM et 2STV permettent un streaming sur mobile. Canal+ abonnés peuvent utiliser l\'application myCanal pour voir tous les matchs sur smartphone et Smart TV.' },
    ],
  },

};

export const WC_TV_COUNTRY_SLUGS = Object.keys(WC_TV_COUNTRIES);

export function getTVCountry(slug: string): WCTVCountry | null {
  return WC_TV_COUNTRIES[slug] ?? null;
}
