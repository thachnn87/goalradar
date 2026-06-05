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

};

export const WC_TV_COUNTRY_SLUGS = Object.keys(WC_TV_COUNTRIES);

export function getTVCountry(slug: string): WCTVCountry | null {
  return WC_TV_COUNTRIES[slug] ?? null;
}
