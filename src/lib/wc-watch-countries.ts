/**
 * src/lib/wc-watch-countries.ts
 *
 * Country-specific Watch Live data for FIFA World Cup 2026.
 * Used by /world-cup-2026/watch-live/[country] pages.
 */

export interface WCBroadcaster {
  name: string;
  type: 'free-tv' | 'pay-tv' | 'streaming-free' | 'streaming-paid';
  coverage: string;     // "All 104 matches" | "Selected matches" | etc.
  platform: string;     // "TV + App" | "App only" | "TV only"
  price: string;        // "Free" | "$5.99/mo" | "Subscription required"
  note?: string;
}

export interface WCWatchFAQ {
  q: string;
  a: string;
}

export interface WCWatchAffiliate {
  title: string;
  description: string;
  cta: string;
  tag: string;
  variant: 'yellow' | 'green' | 'blue';
}

export interface WCWatchCountry {
  slug: string;
  name: string;
  flag: string;
  timezone: string;       // IANA timezone for display
  utcOffset: string;      // e.g. "UTC+7" for display
  metaTitle: string;
  metaDesc: string;
  heroSubtitle: string;
  intro: string;          // ~200 words for hero / intro section
  /** One-line verdict shown in the "Quick Guide" card */
  quickVerdict: string;
  /** Best free option */
  bestFree: string;
  /** Best premium/comprehensive option */
  bestPaid: string;
  broadcasters: WCBroadcaster[];
  cordCuttingSection: {
    heading: string;
    body: string;
  };
  timezoneSection: {
    heading: string;
    body: string;
    /** Sample kick-off times in local time for display */
    kickoffs: { utcTime: string; localTime: string; label: string }[];
  };
  vpnSection: {
    heading: string;
    body: string;
  };
  faq: WCWatchFAQ[];
  affiliates: WCWatchAffiliate[];
}

// ---------------------------------------------------------------------------
// Country data
// ---------------------------------------------------------------------------

export const WC_WATCH_COUNTRIES: Record<string, WCWatchCountry> = {

  // ── United States ──────────────────────────────────────────────────────────
  us: {
    slug: 'us',
    name: 'United States',
    flag: '🇺🇸',
    timezone: 'America/New_York',
    utcOffset: 'UTC−4/−5',
    metaTitle: 'How to Watch FIFA World Cup 2026 in the USA – TV Channels & Live Streams | GoalRadar',
    metaDesc: 'Watch FIFA World Cup 2026 live in the USA on Fox Sports, Telemundo, Peacock and Fubo TV. Full guide to every US broadcaster, streaming option and free coverage.',
    heroSubtitle: 'Official US broadcasters, streaming options, prices and free alternatives for every World Cup match.',
    intro:
      'The FIFA World Cup 2026 is coming to the United States — and American fans have never had more ways to ' +
      'watch every moment of the action. Fox holds the exclusive English-language broadcast rights, with matches ' +
      'airing across Fox, FS1 and FS2. Telemundo and Universo carry Spanish-language coverage, making this the ' +
      'most accessible World Cup in US history. As a co-host nation, the USA will play group stage matches in ' +
      'American cities — SoFi Stadium in Los Angeles, MetLife Stadium in New Jersey, and AT&T Stadium in Dallas ' +
      '— with the Final at MetLife on 19 July 2026. Cord-cutters have multiple excellent options: Peacock, ' +
      'Fubo TV, DirecTV Stream, Sling TV, Hulu + Live TV and YouTube TV all carry Fox Sports channels. ' +
      'Some matches will be available free without a subscription on the Fox Sports app with a TV provider login. ' +
      'With 16 host cities spanning both coasts and the central timezone, match times vary — but most group ' +
      'stage fixtures kick off at 12:00 PM, 3:00 PM, 6:00 PM or 9:00 PM ET, making for civilised viewing ' +
      'throughout the day and evening.',
    quickVerdict: 'Fox Sports (English) + Telemundo (Spanish). Stream via Peacock, Fubo, or YouTube TV.',
    bestFree: 'Fox / Telemundo (OTA antenna)',
    bestPaid: 'Fubo TV (most comprehensive Fox + Telemundo bundle)',
    broadcasters: [
      { name: 'Fox / FS1 / FS2', type: 'free-tv', coverage: 'All matches', platform: 'TV + Fox Sports App', price: 'Free with cable/satellite or OTA antenna', note: 'Primary English-language rights holder' },
      { name: 'Telemundo / Universo', type: 'free-tv', coverage: 'All matches (Spanish)', platform: 'TV + Telemundo App', price: 'Free with cable/satellite or OTA antenna', note: 'Full Spanish-language coverage' },
      { name: 'Peacock', type: 'streaming-paid', coverage: 'All Fox matches', platform: 'App / Web', price: 'From $7.99/month', note: 'NBCUniversal streaming — simulcasts Fox coverage' },
      { name: 'Fubo TV', type: 'streaming-paid', coverage: 'All matches (Fox + Telemundo)', platform: 'App / Web / Smart TV', price: 'From $79.99/month', note: 'Best all-in-one bundle with both Fox and Telemundo' },
      { name: 'DirecTV Stream', type: 'streaming-paid', coverage: 'All Fox + Telemundo matches', platform: 'App / Web / Smart TV', price: 'From $79.99/month', note: 'No annual contract required' },
      { name: 'Sling TV', type: 'streaming-paid', coverage: 'FS1 / FS2 (not Fox OTA)', platform: 'App / Web', price: 'From $40/month', note: 'Add Sling Blue for FS1/FS2. Fox OTA not included.' },
      { name: 'YouTube TV', type: 'streaming-paid', coverage: 'All Fox + Telemundo matches', platform: 'App / Web / Smart TV', price: '$72.99/month', note: 'Unlimited DVR included — record every match' },
      { name: 'Hulu + Live TV', type: 'streaming-paid', coverage: 'All Fox + Telemundo matches', platform: 'App / Web / Smart TV', price: '$82.99/month', note: 'Includes Disney+ and ESPN+ bundle' },
    ],
    cordCuttingSection: {
      heading: 'How to Watch World Cup 2026 Without Cable in the USA',
      body:
        'Cutting the cord doesn\'t mean missing a single match. An OTA antenna gives you Fox and Telemundo ' +
        'completely free — the same signal cable providers carry, at zero monthly cost. Pair it with a ' +
        'streaming service for FS1/FS2 overflow matches. Fubo TV is the top pick for comprehensive ' +
        'coverage of both Fox and Telemundo channels in one subscription, with no annual contract. ' +
        'Peacock is the budget option if you only need Fox\'s English coverage. YouTube TV adds unlimited ' +
        'DVR — ideal for recording night matches. For the Spanish-language viewer, Telemundo\'s own app ' +
        'streams games free with a cable provider login, or via any of the major live TV streaming services. ' +
        'The Fox Sports app also streams games free with a participating TV provider login — worth checking ' +
        'before subscribing to anything. Key tip: most streaming services offer a free trial period, so you ' +
        'can start one just before the tournament and cancel after if you don\'t wish to continue.',
    },
    timezoneSection: {
      heading: 'World Cup 2026 Match Times in the USA',
      body:
        'Group stage matches are scheduled at four standard kick-off times per day. Since the tournament ' +
        'spans the US, Canadian and Mexican host cities, some matches start at local time offsets. ' +
        'All times below are Eastern Time (ET). Subtract 3 hours for Pacific (PT).',
      kickoffs: [
        { utcTime: '16:00 UTC', localTime: '12:00 PM ET / 9:00 AM PT', label: 'Midday slot' },
        { utcTime: '19:00 UTC', localTime: '3:00 PM ET / 12:00 PM PT', label: 'Afternoon slot' },
        { utcTime: '22:00 UTC', localTime: '6:00 PM ET / 3:00 PM PT',  label: 'Early evening slot' },
        { utcTime: '01:00 UTC', localTime: '9:00 PM ET / 6:00 PM PT',  label: 'Prime time slot' },
      ],
    },
    vpnSection: {
      heading: 'Watch US World Cup Coverage Abroad',
      body:
        'Travelling outside the USA during the World Cup? Fox Sports, Peacock and Fubo TV are ' +
        'geo-restricted to US IP addresses. A VPN (Virtual Private Network) connects you to a US server, ' +
        'making your device appear to be in the States and restoring access to your subscriptions. ' +
        'Choose a VPN with fast US servers optimised for live streaming — speed matters for HD football. ' +
        'Ensure the VPN is active before launching the app. Note that using a VPN may violate some ' +
        'streaming services\' terms of service; always check the T&Cs of your provider.',
    },
    faq: [
      { q: 'How to watch World Cup 2026 for free in the USA?', a: 'Fox and Telemundo broadcast matches over-the-air for free with an OTA antenna in most US cities. Some matches also stream free on the Fox Sports app with a cable provider login. Beyond that, cord-cutters can use streaming services, most of which offer free trials.' },
      { q: 'Which channel shows the USA team\'s matches?', a: 'All USMNT matches air on Fox (English) and Telemundo (Spanish). The exact channel assignment depends on the match schedule. Fox has primary rights and typically takes the highest-profile matches.' },
      { q: 'Is Peacock showing all World Cup 2026 matches?', a: 'Peacock simulcasts all Fox Sports coverage. Every match on Fox, FS1, or FS2 is available on Peacock. Peacock Premium starts at $7.99/month — the cheapest paid streaming option for full coverage.' },
      { q: 'Can I watch World Cup 2026 on Fubo TV?', a: 'Yes. Fubo TV carries Fox, FS1, FS2, Telemundo and Universo — making it the most comprehensive single-subscription option for both English and Spanish World Cup coverage. It starts at $79.99/month with a free trial.' },
      { q: 'Does YouTube TV carry World Cup 2026?', a: 'Yes. YouTube TV includes Fox, FS1, FS2, Telemundo and Universo for $72.99/month. It also offers unlimited DVR storage, so you can record every match and watch at a convenient time.' },
      { q: 'What time do World Cup matches kick off in Eastern Time?', a: 'Group stage matches typically start at 12:00 PM, 3:00 PM, 6:00 PM and 9:00 PM ET. Knockout matches may have different schedules. All times are ET; subtract 3 hours for PT.' },
      { q: 'Is there a free streaming option for World Cup 2026 in the US?', a: 'Yes — an OTA antenna gives you Fox (and Telemundo) completely free. Additionally, the Fox Sports app allows free streaming with a TV provider login. Some Tubi (Fox-owned) streaming may also apply for selected content.' },
      { q: 'Can I watch World Cup 2026 on my phone in the USA?', a: 'Yes. The Fox Sports app (iOS/Android) and Telemundo app both stream matches on mobile. Streaming services like Peacock, Fubo and YouTube TV also have full-featured mobile apps.' },
    ],
    affiliates: [
      { title: 'Stream Every USA Match on Fubo TV', description: 'Fox + Telemundo + FS1/FS2 in one bundle. No annual contract. Start watching in minutes.', cta: 'Start Free Trial', tag: 'watch-us-fubo', variant: 'yellow' },
      { title: 'Watch on Peacock from $7.99/month', description: 'Every Fox Sports match on Peacock Premium. Cancel any time.', cta: 'Get Peacock', tag: 'watch-us-peacock', variant: 'green' },
      { title: 'Watch US Coverage While Travelling', description: 'Access Fox Sports, Peacock and Fubo from anywhere with a fast VPN. 30-day money-back guarantee.', cta: 'Get a VPN', tag: 'watch-us-vpn', variant: 'blue' },
    ],
  },

  // ── United Kingdom ─────────────────────────────────────────────────────────
  uk: {
    slug: 'uk',
    name: 'United Kingdom',
    flag: '🇬🇧',
    timezone: 'Europe/London',
    utcOffset: 'UTC+1 (BST)',
    metaTitle: 'How to Watch FIFA World Cup 2026 in the UK – BBC & ITV Free Coverage | GoalRadar',
    metaDesc: 'Watch FIFA World Cup 2026 free in the UK on BBC and ITV. Every match live on free-to-air TV and free streaming via BBC iPlayer and ITVX. Full UK viewing guide.',
    heroSubtitle: 'Every match free on BBC and ITV. Stream free on BBC iPlayer and ITVX — no subscription needed.',
    intro:
      'UK football fans have one of the best deals in the world for FIFA World Cup 2026 coverage: ' +
      'every single match free to watch. The BBC and ITV share broadcast rights, as they did for the ' +
      '2022 Qatar World Cup, meaning you can watch the entire tournament without spending a penny ' +
      'beyond your TV licence. Both BBC iPlayer and ITVX offer free online streaming with no ' +
      'subscription required — just a free account. Matches air across BBC One, BBC Two, ITV1 and ITV2, ' +
      'with the rights split based on negotiation (typically the most high-profile matches go to ' +
      'the channel with the strongest audience). For the England games, expect enormous audiences — ' +
      'the England vs France match at Euro 2024 drew over 15 million UK viewers. The BBC and ITV ' +
      'also offer excellent pre-match analysis, expert punditry and post-match discussion. ' +
      'For UK residents travelling abroad during the tournament, BBC iPlayer and ITVX are ' +
      'geo-restricted, but a VPN with a UK server will restore access to your home coverage. ' +
      'It\'s as simple as the UK\'s World Cup viewing has ever been.',
    quickVerdict: 'Everything free. BBC & ITV share all 104 matches. Stream free via BBC iPlayer and ITVX.',
    bestFree: 'BBC iPlayer / ITVX (completely free, all matches)',
    bestPaid: 'N/A — all World Cup matches are free in the UK',
    broadcasters: [
      { name: 'BBC One / BBC Two', type: 'free-tv', coverage: 'Shared (approx. half the matches)', platform: 'TV + BBC iPlayer app', price: 'Free (TV licence required for TV)', note: 'The BBC\'s flagship channels — typically carries England matches and high-profile games' },
      { name: 'BBC iPlayer', type: 'streaming-free', coverage: 'All BBC matches live + replay', platform: 'App / Web / Smart TV', price: 'Free (account required)', note: 'Stream without a TV licence. Create a free account at bbc.co.uk/iplayer' },
      { name: 'ITV1 / ITV2', type: 'free-tv', coverage: 'Shared (approx. half the matches)', platform: 'TV + ITVX app', price: 'Free (no licence required for streaming)', note: 'ITV holds approximately half the rights — traditionally carries England and key knockout matches' },
      { name: 'ITVX', type: 'streaming-free', coverage: 'All ITV matches live + replay', platform: 'App / Web / Smart TV', price: 'Free (account required)', note: 'No subscription — create a free ITVX account. Watch live and replay without a TV licence.' },
      { name: 'TNT Sports / Discovery+', type: 'streaming-paid', coverage: 'Commentary/analysis only (no live rights)', platform: 'App / Web', price: 'From £30.99/month', note: 'TNT does not hold World Cup rights — all matches are on BBC/ITV' },
    ],
    cordCuttingSection: {
      heading: 'How to Watch World Cup 2026 Online in the UK for Free',
      body:
        'BBC iPlayer and ITVX are genuinely free — not just free trials. Create a free account on ' +
        'each platform and you\'ll have access to every World Cup 2026 match live and on-demand. ' +
        'Both apps are available on iOS, Android, Smart TVs (Samsung, LG, Sony), Fire TV, ' +
        'Apple TV, PlayStation and Xbox. There\'s no need to pay for a streaming service to watch ' +
        'the World Cup in the UK — unlike previous tournaments where Sky Sports held some rights, ' +
        '2026 is entirely on free-to-air television. The ITVX app does have a paid tier (ITVX ' +
        'Premium at £3.99/month) that removes ads, but the free tier works perfectly for live sport. ' +
        'BBC iPlayer has no ads at all. If you\'re watching on a Smart TV, look for both apps in ' +
        'your TV\'s app store — they\'re universally available.',
    },
    timezoneSection: {
      heading: 'World Cup 2026 Match Times in the UK (BST)',
      body:
        'Matches will be played in the USA, Canada and Mexico — meaning late evening and overnight ' +
        'kick-offs for UK viewers. Group stage matches start at four standard times. ' +
        'All times below are British Summer Time (BST, UTC+1), which applies June–July 2026.',
      kickoffs: [
        { utcTime: '16:00 UTC', localTime: '5:00 PM BST',  label: 'Late afternoon slot' },
        { utcTime: '19:00 UTC', localTime: '8:00 PM BST',  label: 'Prime time slot' },
        { utcTime: '22:00 UTC', localTime: '11:00 PM BST', label: 'Late night slot' },
        { utcTime: '01:00 UTC', localTime: '2:00 AM BST',  label: 'Overnight slot (next day)' },
      ],
    },
    vpnSection: {
      heading: 'Watch BBC & ITV World Cup Coverage Abroad',
      body:
        'BBC iPlayer and ITVX are geo-restricted to the UK — if you try to stream abroad, ' +
        'you\'ll see a "this content is not available in your country" message. A VPN with ' +
        'UK servers routes your traffic through a British IP address, restoring access to ' +
        'your home coverage. This is particularly useful for UK residents on holiday, ' +
        'working abroad, or living temporarily outside the UK. Choose a VPN with fast, ' +
        'reliable UK servers and good streaming performance — live sports require consistent ' +
        'bandwidth. Note that VPN use may not comply with the BBC/ITV terms of service; ' +
        'always check before use.',
    },
    faq: [
      { q: 'Is FIFA World Cup 2026 free to watch in the UK?', a: 'Yes — completely free. BBC and ITV share all broadcast rights for World Cup 2026 in the UK, as they did in 2022. Every match is available free on BBC One/Two and ITV1/2 on TV, and free to stream on BBC iPlayer and ITVX online.' },
      { q: 'Do I need a TV licence to watch World Cup 2026 in the UK?', a: 'A TV licence is required to watch live TV on any channel, including BBC and ITV. However, you can watch BBC iPlayer\'s on-demand replay content without a licence. Streaming ITVX live does not require a TV licence either — the licence is only needed for live TV viewing.' },
      { q: 'How are World Cup matches split between BBC and ITV?', a: 'The BBC and ITV negotiate match allocations, with each broadcaster typically taking around half the games. High-profile matches, England games and finals tend to be split between them. The full schedule of which matches go to which channel is announced closer to the tournament.' },
      { q: 'Can I watch World Cup 2026 on my phone in the UK?', a: 'Yes. Download the BBC iPlayer app and ITVX app on iOS or Android for free. Both offer live streaming of World Cup matches on mobile at no cost.' },
      { q: 'Will there be any paid-only World Cup matches in the UK?', a: 'No. All 104 World Cup 2026 matches are available free on BBC or ITV in the UK. This is confirmed as a protected "listed event" under UK broadcasting regulations, meaning it must be available on free-to-air channels.' },
      { q: 'What are the best times to watch from the UK?', a: 'The best kick-off time is 5:00 PM or 8:00 PM BST — comfortable prime time viewing. The 11:00 PM slot is watchable but late, and the 2:00 AM slot (overnight) requires a very dedicated fan or a DVR recording.' },
      { q: 'Can I record World Cup matches in the UK?', a: 'Yes. Both BBC iPlayer and ITVX allow replay of matches after they\'ve aired. On a set-top box or smart TV, you can also use the EPG guide to series-link or record any match to your device.' },
      { q: 'Will the BBC show England matches?', a: 'The BBC and ITV typically share England matches between them. Both broadcasters have historically shown England\'s biggest knockout games. Confirmed match allocations will be published ahead of the tournament.' },
    ],
    affiliates: [
      { title: 'Watch BBC & ITV Abroad with a VPN', description: 'Access BBC iPlayer and ITVX from anywhere in the world with a fast UK VPN. 30-day money-back guarantee.', cta: 'Get a VPN', tag: 'watch-uk-vpn', variant: 'blue' },
      { title: 'Never Miss a Kick-Off', description: 'Get World Cup 2026 fixture alerts and match reminders delivered to your inbox — free.', cta: 'Subscribe Free', tag: 'watch-uk-newsletter', variant: 'green' },
    ],
  },

  // ── Canada ─────────────────────────────────────────────────────────────────
  canada: {
    slug: 'canada',
    name: 'Canada',
    flag: '🇨🇦',
    timezone: 'America/Toronto',
    utcOffset: 'UTC−4/−5',
    metaTitle: 'How to Watch FIFA World Cup 2026 in Canada – TSN, CTV & Streaming Guide | GoalRadar',
    metaDesc: 'Watch FIFA World Cup 2026 live in Canada on CTV, TSN, RDS, Noovo and streaming. Full guide to free and paid options for every match, including Canada\'s group stage fixtures.',
    heroSubtitle: 'CTV free coverage + TSN comprehensive package. Canada\'s historic tournament — every match available.',
    intro:
      'Canada is a co-host nation for FIFA World Cup 2026, making this the most significant ' +
      'football tournament in Canadian history. Les Rouges will play group stage matches in ' +
      'Toronto and Vancouver — and Canadian broadcasters have secured extensive coverage. ' +
      'CTV offers free-to-air coverage of selected matches in English, while TSN provides ' +
      'comprehensive subscription-based coverage across TSN1–5. For French-language audiences, ' +
      'Noovo carries free matches and TVA Sports/RDS provide in-depth subscription coverage. ' +
      'Online, TSN+ and Crave offer streaming access to the full tournament. Alphonso Davies, ' +
      'Jonathan David and the Canadian squad will attract enormous domestic audiences — ' +
      'Canada\'s 2022 qualifying campaign broke TSN viewing records. With the team playing on ' +
      'home soil for the first time in a World Cup, viewer numbers are expected to surpass ' +
      'anything in Canadian football history. Group stage matches for Canada kick off at ' +
      'civilised times for Eastern viewers — typically afternoon or evening — making this an ' +
      'unmissable summer of football for all Canadians.',
    quickVerdict: 'CTV free (selected matches) + TSN for full English coverage + RDS/Noovo French.',
    bestFree: 'CTV (selected matches, English) / Noovo (selected, French)',
    bestPaid: 'TSN+ (comprehensive English streaming)',
    broadcasters: [
      { name: 'CTV', type: 'free-tv', coverage: 'Selected matches (including Canada)', platform: 'TV + CTV app', price: 'Free', note: 'Bell Media\'s free-to-air channel. Canada games guaranteed to air on CTV.' },
      { name: 'TSN 1–5', type: 'pay-tv', coverage: 'All 104 matches', platform: 'TV + TSN app', price: 'Subscription required (~$19.99/month TSN Direct)', note: 'The comprehensive English-language option — every match, every angle' },
      { name: 'TSN+', type: 'streaming-paid', coverage: 'All 104 matches', platform: 'App / Web', price: '$19.99/month or included with TSN', note: 'Stream on mobile, tablet and Smart TV without cable' },
      { name: 'Noovo', type: 'free-tv', coverage: 'Selected matches (French)', platform: 'TV + Noovo app', price: 'Free', note: 'Free French-language coverage — Bell Media\'s French free-to-air network' },
      { name: 'RDS / TVA Sports', type: 'pay-tv', coverage: 'All matches (French)', platform: 'TV + streaming', price: 'Subscription required', note: 'Comprehensive French-language coverage for Quebec viewers' },
      { name: 'Crave', type: 'streaming-paid', coverage: 'Selected matches (via CTV/TSN)', platform: 'App / Web', price: 'From $9.99/month', note: 'Bell Media streaming platform — includes access to CTV and some TSN content' },
    ],
    cordCuttingSection: {
      heading: 'How to Watch World Cup 2026 Without Cable in Canada',
      body:
        'TSN Direct is the top cord-cutting option for full coverage — at $19.99/month it gives ' +
        'you all 104 matches via TSN+, accessible on smart TVs, mobile, and web without a cable ' +
        'subscription. For free coverage, CTV streams selected matches (including all Canadian games) ' +
        'on the free CTV app — no subscription, just a free account. French speakers can do the same ' +
        'on the Noovo app at no cost. If you already have Crave, check whether your plan includes TSN ' +
        'add-ons. As a co-host nation, Canada\'s national broadcaster CBC may also carry some content — ' +
        'watch for announcements. The most cost-effective approach for the casual fan: CTV free app for ' +
        'Canada\'s matches, TSN Direct trial for the knockout rounds.',
    },
    timezoneSection: {
      heading: 'World Cup 2026 Match Times in Canada (ET/PT)',
      body:
        'Canada spans six time zones. As a co-host, Canadian venues host games at local times. ' +
        'All times below are Eastern Time (ET). Subtract 3 hours for Pacific Time (PT).',
      kickoffs: [
        { utcTime: '16:00 UTC', localTime: '12:00 PM ET / 9:00 AM PT', label: 'Midday slot' },
        { utcTime: '19:00 UTC', localTime: '3:00 PM ET / 12:00 PM PT', label: 'Afternoon slot' },
        { utcTime: '22:00 UTC', localTime: '6:00 PM ET / 3:00 PM PT',  label: 'Early evening slot' },
        { utcTime: '01:00 UTC', localTime: '9:00 PM ET / 6:00 PM PT',  label: 'Prime time slot' },
      ],
    },
    vpnSection: {
      heading: 'Watch Canadian World Cup Coverage Abroad',
      body:
        'TSN+ and CTV are geo-restricted to Canadian IP addresses. If you\'re outside Canada during ' +
        'the tournament — whether on vacation or working abroad — a VPN with Canadian servers lets ' +
        'you access your subscription as if you were home. Connect to a Canadian server, open TSN+ ' +
        'or the CTV app, and stream exactly as you would at home. Look for a VPN provider with ' +
        'fast Canadian servers optimised for HD video streaming.',
    },
    faq: [
      { q: 'How to watch FIFA World Cup 2026 in Canada for free?', a: 'CTV streams selected matches free including all Canada games. The CTV app on iOS, Android, Apple TV and Smart TVs requires only a free account. Noovo offers the same for French-language viewers. For every single match free, an OTA antenna picks up CTV in most major cities.' },
      { q: 'Does TSN show all World Cup 2026 matches in Canada?', a: 'Yes. TSN holds comprehensive English-language rights and airs all 104 matches across TSN 1–5 channels. TSN Direct (streaming, no cable required) gives you all matches for $19.99/month.' },
      { q: 'Where to watch Canada\'s World Cup matches?', a: 'Canada matches air on CTV (free), TSN (comprehensive) and Noovo/RDS (French). CTV guarantees free coverage of the Canadian national team\'s group stage fixtures. This is confirmed under Canadian broadcast regulations.' },
      { q: 'Is the World Cup on RDS in Canada?', a: 'Yes. RDS and TVA Sports carry French-language coverage of all World Cup matches for Quebec and Francophone viewers. Noovo (free-to-air French) shows selected matches including Canadian games.' },
      { q: 'Can I stream World Cup 2026 on TSN+?', a: 'Yes. TSN+ is TSN\'s streaming service available as a standalone subscription ($19.99/month) or included with a TSN cable package. It streams all TSN channels live, so every World Cup match is accessible on mobile, web and Smart TV.' },
      { q: 'What time do World Cup matches kick off in Toronto?', a: 'In Eastern Time, group stage matches kick off at 12:00 PM, 3:00 PM, 6:00 PM and 9:00 PM ET. Some matches in western host cities may have slightly different times. Subtract 3 hours for Vancouver/BC.' },
      { q: 'Will Canada games be on CBC?', a: 'CBC may carry some high-profile Canada matches as a public broadcaster, but TSN and CTV hold the primary rights. Check CBC Sports and CBC Gem closer to the tournament for any additional broadcast details.' },
      { q: 'How to watch World Cup 2026 on my phone in Canada?', a: 'Download the TSN app (subscription required) or the CTV app (free) on iOS or Android. Both stream live matches. The Noovo app works for French-language viewers. All apps are available in the Canadian App Store and Google Play.' },
    ],
    affiliates: [
      { title: 'Stream Every Match on TSN+', description: 'All 104 World Cup matches in HD. No cable required — stream on any device from $19.99/month.', cta: 'Get TSN Direct', tag: 'watch-canada-tsn', variant: 'yellow' },
      { title: 'Watch Canada From Abroad', description: 'Access CTV and TSN+ from outside Canada with a fast Canadian VPN server. 30-day guarantee.', cta: 'Get a VPN', tag: 'watch-canada-vpn', variant: 'blue' },
    ],
  },

  // ── Australia ───────────────────────────────────────────────────────────────
  australia: {
    slug: 'australia',
    name: 'Australia',
    flag: '🇦🇺',
    timezone: 'Australia/Sydney',
    utcOffset: 'UTC+10',
    metaTitle: 'How to Watch FIFA World Cup 2026 in Australia – SBS Free Coverage | GoalRadar',
    metaDesc: 'Watch FIFA World Cup 2026 free in Australia on SBS and SBS On Demand. All 104 matches live, free-to-air with no subscription required. Full Australia viewing guide.',
    heroSubtitle: 'SBS broadcasts every single match free-to-air. Stream all 104 games free on SBS On Demand.',
    intro:
      'Australian football fans have arguably the best World Cup 2026 deal of any country in the ' +
      'world: SBS holds the broadcast rights and airs every single one of the 104 matches ' +
      'completely free. Free-to-air on SBS and SBS World Sports, and free to stream on SBS On Demand ' +
      '(create a free account, no subscription required), Australia\'s coverage is ' +
      'unrivalled in its accessibility. SBS has been the home of World Cup football in Australia ' +
      'since the 1990s and brings expert multi-cultural commentary and presentation. ' +
      'The main challenge for Australian viewers is time zones — with matches played in North America, ' +
      'most kick-offs fall between midnight and 3:00 AM AEST during group stages. But with SBS On Demand\'s ' +
      'full replay library, you can watch every match at a time that suits you. ' +
      'Australia\'s Socceroos will be hoping to make it a historic run — their 2022 quarter-final ' +
      'appearance (the first since 2006) created record SBS viewing figures. With Mathew Ryan, ' +
      'Martin Boyle and a young, exciting squad, every Socceroos match will be unmissable viewing.',
    quickVerdict: 'SBS: every match free. Watch live or on-demand. No subscription, no cost.',
    bestFree: 'SBS On Demand (all 104 matches, genuinely free)',
    bestPaid: 'N/A — SBS coverage is free and comprehensive',
    broadcasters: [
      { name: 'SBS / SBS World Sports', type: 'free-tv', coverage: 'All 104 matches', platform: 'TV (Freeview + cable)', price: 'Free', note: 'Primary broadcaster — every group stage and knockout match' },
      { name: 'SBS On Demand', type: 'streaming-free', coverage: 'All 104 matches live + replay', platform: 'App / Web / Smart TV', price: 'Free (account required)', note: 'Create a free SBS account — no credit card, no subscription. Watch live and catch-up.' },
      { name: 'Optus Sport', type: 'streaming-paid', coverage: 'May carry selected matches', platform: 'App / Web', price: '$24.99/month', note: 'Optus Sport primarily focuses on EPL/UCL — SBS is the main World Cup home in Australia' },
    ],
    cordCuttingSection: {
      heading: 'How to Watch World Cup 2026 Online in Australia',
      body:
        'SBS On Demand is all you need. Download the app on iOS, Android, Apple TV, Chromecast, ' +
        'Fire TV or a Smart TV app store. Create a free SBS account (takes about 2 minutes), ' +
        'and you\'ll have live and on-demand access to every match. ' +
        'If you miss a match, SBS typically makes replays available shortly after the final whistle. ' +
        'The SBS On Demand app is pre-installed on many Australian Smart TVs. ' +
        'There are no hidden costs, no subscriptions and no premium tiers for World Cup content — ' +
        'SBS is funded by the Australian government and advertising, meaning the service is entirely ' +
        'free for viewers. This is arguably the best World Cup viewing package of any country globally.',
    },
    timezoneSection: {
      heading: 'World Cup 2026 Match Times in Australia (AEST/AEDT)',
      body:
        'North American match times translate to late night and early morning in Australia. ' +
        'June 2026 is winter in Australia, so most fans will be watching late-night games. ' +
        'All times below are AEST (UTC+10). Add 1 hour for AEDT if daylight saving is active.',
      kickoffs: [
        { utcTime: '16:00 UTC', localTime: '2:00 AM AEST', label: 'Overnight slot (very late)' },
        { utcTime: '19:00 UTC', localTime: '5:00 AM AEST', label: 'Early morning slot' },
        { utcTime: '22:00 UTC', localTime: '8:00 AM AEST', label: 'Morning slot' },
        { utcTime: '01:00 UTC', localTime: '11:00 AM AEST', label: 'Midday slot' },
      ],
    },
    vpnSection: {
      heading: 'Watch SBS Coverage Abroad',
      body:
        'SBS On Demand is geo-restricted to Australian IP addresses. Australian fans travelling ' +
        'abroad during the tournament can use a VPN with Australian servers to access SBS On Demand ' +
        'as if they were at home. This works for replay and live streaming. Choose a VPN with ' +
        'servers in Sydney or Melbourne for the best performance. Note that VPN use may not comply ' +
        'with SBS\'s terms of service — check before use.',
    },
    faq: [
      { q: 'Is World Cup 2026 free to watch in Australia?', a: 'Yes — every single match is free. SBS holds the broadcast rights and airs all 104 matches on free-to-air TV (SBS and SBS World Sports) and free online streaming via SBS On Demand. No subscription required.' },
      { q: 'How to watch World Cup 2026 on SBS On Demand?', a: 'Go to sbs.com.au/ondemand or download the SBS On Demand app on iOS, Android, Apple TV, Smart TV or Chromecast. Create a free SBS account (email only, no credit card) and you\'ll have access to all live matches and replays.' },
      { q: 'What time do World Cup matches start in Australia?', a: 'Most group stage matches start between 2:00 AM and 11:00 AM AEST. The best viewing times are the 8:00 AM and 11:00 AM AEST slots — manageable for morning viewing. Late-night matches can be watched on demand after the event.' },
      { q: 'Will the Socceroos games be on SBS?', a: 'Yes. All Socceroos matches will air on SBS and stream on SBS On Demand. Australia\'s group games are guaranteed free-to-air coverage — typically on the main SBS channel with full pre-match and post-match shows.' },
      { q: 'Can I watch World Cup 2026 on Kayo Sports in Australia?', a: 'SBS holds the exclusive World Cup rights in Australia, not Kayo Sports. Kayo focuses on Australian sports and some international football (EPL), but World Cup 2026 is exclusively on SBS.' },
      { q: 'Is Optus Sport showing World Cup 2026?', a: 'SBS is the confirmed rights holder for World Cup 2026 in Australia. Optus Sport focuses primarily on Premier League, Champions League and Spanish football. All World Cup matches are on SBS.' },
      { q: 'Can I record World Cup matches in Australia?', a: 'SBS On Demand offers full match replays — typically available within a few hours of the final whistle. You can also record via your set-top box EPG if you have SBS on your cable/satellite package.' },
      { q: 'How to watch World Cup 2026 on my phone in Australia?', a: 'Download the SBS On Demand app (free) on iOS or Android. Sign in with your free SBS account and stream any match live or on demand.' },
    ],
    affiliates: [
      { title: 'Watch SBS From Abroad — VPN Guide', description: 'Access SBS On Demand outside Australia with a fast Australian VPN. Watch every match free from anywhere.', cta: 'Get a VPN', tag: 'watch-aus-vpn', variant: 'blue' },
      { title: 'Get World Cup Match Alerts', description: 'Never miss an Aussie game. Fixture alerts, group updates and results to your inbox — free.', cta: 'Subscribe Free', tag: 'watch-aus-newsletter', variant: 'green' },
    ],
  },

  // ── India ───────────────────────────────────────────────────────────────────
  india: {
    slug: 'india',
    name: 'India',
    flag: '🇮🇳',
    timezone: 'Asia/Kolkata',
    utcOffset: 'UTC+5:30',
    metaTitle: 'How to Watch FIFA World Cup 2026 in India – JioCinema, Sports18 & Free Streaming | GoalRadar',
    metaDesc: 'Watch FIFA World Cup 2026 live in India on JioCinema (free online streaming), Sports18 and DD Sports. Full India viewing guide — channels, kick-off times and every match free.',
    heroSubtitle: 'JioCinema streams every match FREE online. Sports18 on TV. DD Sports for free-to-air coverage.',
    intro:
      'India is home to one of the world\'s most passionate football audiences, and for FIFA World Cup 2026 ' +
      'Indian fans will have unrivalled free access: JioCinema — Reliance\'s streaming platform — ' +
      'is expected to carry comprehensive digital rights, streaming every match live and on demand at ' +
      'no cost with a free account. This follows JioCinema\'s landmark free coverage of the 2023 IPL and ' +
      'their rights to major international football competitions. On television, Sports18 and Sports18 HD ' +
      '(Viacom18\'s sports channels, now part of the JioStar ecosystem) provide full cable and DTH ' +
      'coverage. DD Sports — Doordarshan\'s free-to-air national sports channel — traditionally carries ' +
      'selected high-profile matches including opening games, semi-finals and the final, making them ' +
      'available to the hundreds of millions of Indians without pay TV or internet subscriptions. ' +
      'India\'s time zone (IST, UTC+5:30) means group stage matches kick off between 9:30 PM and 6:30 AM ' +
      '— late nights are part of the World Cup experience for Indian fans, who are accustomed to watching ' +
      'Premier League matches at 1:30 AM. With 48 teams and 104 matches, and beloved players like ' +
      'Messi, Ronaldo\'s successor era, Mbappé and Vinícius Jr. in action, World Cup 2026 will be ' +
      'an enormous television event across every corner of India.',
    quickVerdict: 'JioCinema: all matches free online. Sports18 on cable/DTH. DD Sports for free-to-air highlights.',
    bestFree: 'JioCinema (all 104 matches, genuinely free — no subscription)',
    bestPaid: 'Sports18 HD (full HD TV coverage via cable or DTH)',
    broadcasters: [
      {
        name: 'JioCinema',
        type: 'streaming-free',
        coverage: 'All 104 matches (expected)',
        platform: 'App / Web / Smart TV / Chromecast',
        price: 'Free (free account required)',
        note: 'Reliance\'s flagship streaming platform — free live HD streaming for all World Cup matches. Available on iOS, Android, web, Smart TV and Chromecast.',
      },
      {
        name: 'Sports18 / Sports18 HD',
        type: 'pay-tv',
        coverage: 'All 104 matches',
        platform: 'TV (cable / DTH)',
        price: 'TV subscription required (₹200–400/month approx.)',
        note: 'Viacom18\'s sports channels — full World Cup coverage on SD and HD. Available on Tata Play, Dish TV, Airtel Digital TV, and major cable operators.',
      },
      {
        name: 'DD Sports (Doordarshan)',
        type: 'free-tv',
        coverage: 'Selected matches (opening, semis, final)',
        platform: 'TV (free-to-air) + DD Free Dish satellite',
        price: 'Free',
        note: 'India\'s national public broadcaster. Typically carries high-profile matches free. Available nationwide including rural areas via DD Free Dish satellite.',
      },
      {
        name: 'DD Free Dish',
        type: 'free-tv',
        coverage: 'Selected matches via DD Sports',
        platform: 'Free DTH satellite (set-top box required)',
        price: 'Free (one-time set-top box cost only)',
        note: 'Government-operated free satellite DTH — carries DD Sports. Reaches households across India without cable infrastructure.',
      },
      {
        name: 'JioStar / Hotstar',
        type: 'streaming-paid',
        coverage: 'Selected matches (check availability)',
        platform: 'App / Web',
        price: 'Disney+ Hotstar subscription from ₹299/month',
        note: 'Post-merger JioStar entity — check confirmed World Cup rights as the tournament approaches; JioCinema remains the primary free streaming home.',
      },
    ],
    cordCuttingSection: {
      heading: 'How to Watch World Cup 2026 Online in India — Free',
      body:
        'JioCinema makes it remarkably easy: download the JioCinema app on iOS, Android, or your Smart TV, ' +
        'create a free account (no credit card, no subscription), and stream every match live in HD. ' +
        'The JioCinema app is pre-installed on many Jio set-top boxes and supports Chromecast for ' +
        'big-screen viewing. Data users on Jio\'s network enjoy zero-data-charge streaming on the JioCinema app ' +
        'during major sporting events (confirm during World Cup period). For households with a smart TV, ' +
        'the JioCinema app is available in the app stores of Samsung, LG, Sony and other major brands. ' +
        'On a laptop or desktop, stream directly at jiocinema.com — no download required. ' +
        'If you have a Jio Fiber broadband connection, World Cup streams at 4K quality are expected. ' +
        'For those without internet access, DD Free Dish with a basic set-top box (one-time cost of ' +
        'approximately ₹1,500–2,000) provides free DD Sports coverage of selected matches nationwide.',
    },
    timezoneSection: {
      heading: 'World Cup 2026 Match Times in India (IST, UTC+5:30)',
      body:
        'India Standard Time (IST) is UTC+5:30. With World Cup 2026 hosted across North America, ' +
        'matches translate to the following local times in India. Late-night and early-morning ' +
        'viewing is standard for Indian football fans during major tournaments.',
      kickoffs: [
        { utcTime: '16:00 UTC', localTime: '9:30 PM IST',  label: 'Evening slot' },
        { utcTime: '19:00 UTC', localTime: '12:30 AM IST', label: 'Midnight slot (next day)' },
        { utcTime: '22:00 UTC', localTime: '3:30 AM IST',  label: 'Very early morning slot' },
        { utcTime: '01:00 UTC', localTime: '6:30 AM IST',  label: 'Early morning slot' },
      ],
    },
    vpnSection: {
      heading: 'Watch International World Cup Coverage From India — VPN Guide',
      body:
        'JioCinema is available within India and may be geo-restricted abroad. Indian fans ' +
        'travelling outside India can use a VPN with Indian servers to access JioCinema and ' +
        'stream matches as if they were at home. Choose a VPN with fast Mumbai or Delhi servers ' +
        'for stable HD streaming. Alternatively, expats in India from the UK, Australia or USA ' +
        'can connect to their home country\'s VPN server to access BBC iPlayer, SBS On Demand ' +
        'or Fox Sports streaming for home-language commentary. A VPN also protects your data ' +
        'on public Wi-Fi at hotels, airports and cafés during the tournament.',
    },
    faq: [
      {
        q: 'How to watch FIFA World Cup 2026 in India for free?',
        a: 'JioCinema is expected to stream every World Cup 2026 match free of charge — as it did for the 2023 IPL and other major events. Download the JioCinema app (iOS/Android/Smart TV) or visit jiocinema.com, create a free account, and watch every match live in HD. DD Sports also broadcasts selected high-profile matches free on television and via DD Free Dish satellite.',
      },
      {
        q: 'Which channel is showing FIFA World Cup 2026 in India?',
        a: 'Sports18 and Sports18 HD (Viacom18/JioStar) hold the primary television broadcast rights in India. All 104 matches air on Sports18 channels on cable and DTH platforms including Tata Play, Dish TV, Airtel Digital TV and Den/Hathway cable. DD Sports carries selected matches free to air.',
      },
      {
        q: 'Is JioCinema showing World Cup 2026 in India?',
        a: 'JioCinema is the primary digital rights holder for major international football in India. Based on previous rights agreements, JioCinema is expected to stream all World Cup 2026 matches free. Confirm on the JioCinema app or website as official tournament announcement approaches in early 2026.',
      },
      {
        q: 'Is World Cup 2026 free on DD Sports in India?',
        a: 'DD Sports (Doordarshan) typically carries selected World Cup matches free to air, including the opening match, semi-finals and the final. Full coverage of all 104 matches is not guaranteed on DD Sports — for complete access use JioCinema (free streaming) or Sports18 (TV subscription).',
      },
      {
        q: 'What time do World Cup matches start in India?',
        a: 'In India Standard Time (IST, UTC+5:30), group stage matches kick off at approximately 9:30 PM, 12:30 AM, 3:30 AM and 6:30 AM. The 9:30 PM slot is the most viewer-friendly. Early morning slots (3:30 AM and 6:30 AM) work for hardcore fans or as early-morning viewing before work.',
      },
      {
        q: 'How to watch World Cup 2026 on my phone in India?',
        a: 'Download the JioCinema app on iOS or Android — it\'s free and streams all matches live in HD. The Sports18 app may also offer streaming for Sports18 cable subscribers. Both apps support mobile data and Wi-Fi streaming.',
      },
      {
        q: 'Can I watch World Cup 2026 for free on TV in India without cable?',
        a: 'Yes — if you have a DD Free Dish satellite set-top box (one-time cost around ₹1,500–2,000 for the box), you can receive DD Sports free of charge and watch selected World Cup matches. This is particularly useful in rural areas or homes without cable infrastructure.',
      },
      {
        q: 'How to watch World Cup 2026 in 4K in India?',
        a: 'JioCinema has streamed major events in 4K for Jio Fiber broadband users. Expect a similar ultra-HD streaming option for World Cup 2026 on compatible devices. Sports18 HD provides full HD (1080i) on cable and DTH. A 4K-capable TV and a fast internet connection (25 Mbps+ recommended) are needed for 4K streaming.',
      },
    ],
    affiliates: [
      {
        title: 'Watch International Coverage From India — VPN',
        description: 'Access BBC iPlayer, Fox Sports or SBS On Demand from India with a fast VPN. 30-day money-back guarantee.',
        cta: 'Get a VPN',
        tag: 'watch-india-vpn',
        variant: 'blue',
      },
      {
        title: 'Get World Cup 2026 Match Alerts',
        description: 'Fixture reminders, live score roundups and results delivered free to your inbox.',
        cta: 'Subscribe Free',
        tag: 'watch-india-newsletter',
        variant: 'green',
      },
    ],
  },

  // ── Thailand ────────────────────────────────────────────────────────────────
  thailand: {
    slug: 'thailand',
    name: 'Thailand',
    flag: '🇹🇭',
    timezone: 'Asia/Bangkok',
    utcOffset: 'UTC+7',
    metaTitle: 'How to Watch FIFA World Cup 2026 in Thailand – TrueVisions, PPTV & Streaming | GoalRadar',
    metaDesc: 'Watch FIFA World Cup 2026 live in Thailand on TrueVisions, True Sport and streaming platforms. Full Thailand World Cup viewing guide with channels, times and how to watch free.',
    heroSubtitle: 'TrueVisions & True Sport have comprehensive rights. Check PPTV for free-to-air matches.',
    intro:
      'Thailand is one of the most passionate football nations in Southeast Asia, with tens of millions ' +
      'following the Premier League, Champions League and major international tournaments. ' +
      'For FIFA World Cup 2026, TrueVisions holds the primary broadcasting rights in Thailand, ' +
      'with comprehensive coverage across True Sport 1–7 channels and streaming via the TrueID app. ' +
      'PPTV, which carried free-to-air World Cup coverage in 2018, may also broadcast selected matches ' +
      'in 2026 — official announcements are expected closer to the tournament. ' +
      'AIS Play offers streaming access for AIS subscribers, and other digital platforms may carry ' +
      'highlights and short-form content. For Thai fans, the time zone is actually favourable: ' +
      'North American matches kick off between midnight and 9:00 AM ICT, meaning evening and early ' +
      'morning slots work for the dedicated supporter. Thai football fans are used to staying up for ' +
      'Premier League 2:45 AM kick-offs — the World Cup will bring the same dedication on a grander scale. ' +
      'Groups featuring popular clubs\' players (England, Brazil, Argentina) will attract the largest ' +
      'Thai audiences, alongside any exciting group stage upsets.',
    quickVerdict: 'TrueVisions subscribers get full coverage. Check PPTV for free-to-air selected matches.',
    bestFree: 'PPTV (selected matches — confirm closer to tournament)',
    bestPaid: 'TrueVisions / TrueID (comprehensive coverage)',
    broadcasters: [
      { name: 'True Sport 1–7 (TrueVisions)', type: 'pay-tv', coverage: 'All matches', platform: 'TV + TrueID app', price: 'TrueVisions subscription required', note: 'Primary rights holder in Thailand — full tournament coverage across True Sport channels' },
      { name: 'TrueID App', type: 'streaming-paid', coverage: 'All matches (TrueVisions subscribers)', platform: 'App / Web', price: 'Included with TrueVisions subscription', note: 'Live stream on smartphone, tablet and Smart TV via TrueID' },
      { name: 'PPTV', type: 'free-tv', coverage: 'Selected matches (TBC)', platform: 'TV (Ch. 36 Freeview)', price: 'Free', note: 'PPTV carried free World Cup matches in 2018 — official confirmation for 2026 pending' },
      { name: 'AIS Play', type: 'streaming-paid', coverage: 'Selected matches', platform: 'App (AIS subscribers)', price: 'AIS subscriber benefit', note: 'AIS mobile customers may access live content through AIS Play' },
      { name: 'Chang TV / GMM25', type: 'free-tv', coverage: 'Highlights / selected (TBC)', platform: 'Free-to-air TV', price: 'Free', note: 'May carry highlights or selected matches — check local listings as tournament approaches' },
    ],
    cordCuttingSection: {
      heading: 'How to Stream World Cup 2026 Online in Thailand',
      body:
        'TrueID is the main streaming platform for TrueVisions subscribers — download the app on iOS ' +
        'or Android, log in with your TrueVisions account, and watch every match live. ' +
        'If you\'re not a TrueVisions customer, PPTV (available via the PPTV app and on Freeview ' +
        'channel 36) may carry selected free-to-air matches — check their schedule as the ' +
        'tournament approaches. For Thai fans abroad, a VPN with a Thai server can restore ' +
        'access to Thai streaming platforms. The key advice is to confirm broadcast rights ' +
        'with TrueVisions and PPTV directly as the tournament approaches, as rights may be ' +
        'confirmed or change in the months before June 2026.',
    },
    timezoneSection: {
      heading: 'World Cup 2026 Match Times in Thailand (ICT, UTC+7)',
      body:
        'Thailand is in the Indochina Time (ICT) zone at UTC+7. Group stage matches scheduled ' +
        'in North America translate to the following local times in Bangkok and across Thailand.',
      kickoffs: [
        { utcTime: '16:00 UTC', localTime: '11:00 PM ICT', label: 'Late night slot' },
        { utcTime: '19:00 UTC', localTime: '2:00 AM ICT',  label: 'Early morning slot (next day)' },
        { utcTime: '22:00 UTC', localTime: '5:00 AM ICT',  label: 'Very early morning slot' },
        { utcTime: '01:00 UTC', localTime: '8:00 AM ICT',  label: 'Morning slot' },
      ],
    },
    vpnSection: {
      heading: 'Watch International World Cup Coverage from Thailand',
      body:
        'If you prefer to watch English-language coverage from the BBC (UK) or Spanish-language ' +
        'commentary, a VPN can route your connection through a server in the UK or USA, ' +
        'giving access to ITVX, BBC iPlayer or Fox Sports streaming. This is particularly ' +
        'useful for expats in Thailand who want to watch coverage from their home country. ' +
        'Thai fans travelling abroad can use a VPN with a Thai server to access TrueID and ' +
        'other Thai streaming platforms from outside Thailand.',
    },
    faq: [
      { q: 'How to watch FIFA World Cup 2026 in Thailand?', a: 'TrueVisions holds the primary rights in Thailand, with matches on True Sport channels and streaming via TrueID. PPTV may carry selected free-to-air matches — check their schedule closer to the tournament. AIS Play may offer additional streaming for AIS mobile subscribers.' },
      { q: 'Is World Cup 2026 free on PPTV in Thailand?', a: 'PPTV carried free-to-air World Cup matches in 2018. Whether they will do the same for 2026 has not yet been confirmed. Watch for official announcements from PPTV and TrueVisions in early 2026. PPTV is available on Freeview channel 36.' },
      { q: 'Can I stream World Cup 2026 on TrueID in Thailand?', a: 'Yes — TrueID is TrueVisions\' streaming app. If you have a TrueVisions subscription, download TrueID on iOS or Android and log in to stream all True Sport coverage live.' },
      { q: 'What time do World Cup matches start in Bangkok?', a: 'In Bangkok (ICT, UTC+7), group stage matches kick off at approximately 11:00 PM, 2:00 AM, 5:00 AM and 8:00 AM local time. The 8:00 AM slot is the most convenient for morning viewing; late-night matches require dedication.' },
      { q: 'Which English teams can I watch in Thailand?', a: 'All World Cup matches are covered by TrueVisions in Thailand, including England, Argentina, Brazil and other popular teams. TrueVisions\' True Sport channels also carry extensive Premier League and Champions League coverage year-round.' },
      { q: 'How to watch World Cup 2026 on mobile in Thailand?', a: 'Download the TrueID app (iOS/Android) with a TrueVisions subscription, or the PPTV app for any free-to-air matches. Both support live streaming on mobile devices.' },
      { q: 'Can expats in Thailand watch their home country\'s World Cup coverage?', a: 'Yes — using a VPN with servers in the UK, USA, or Australia, expats can access BBC iPlayer (UK), Fox Sports App (US), or SBS On Demand (Australia) from Thailand.' },
      { q: 'Is there a World Cup watching fee in Thailand?', a: 'TrueVisions requires a subscription for full coverage. PPTV is free-to-air if they broadcast matches (to be confirmed). AIS Play benefits are included with select AIS mobile plans.' },
    ],
    affiliates: [
      { title: 'Access International Streams from Thailand', description: 'Watch BBC, Fox Sports or SBS coverage from Thailand with a fast VPN. 30-day money-back guarantee.', cta: 'Get a VPN', tag: 'watch-thailand-vpn', variant: 'blue' },
      { title: 'Get World Cup Match Alerts', description: 'Fixture reminders, live score alerts and results delivered free to your inbox.', cta: 'Subscribe Free', tag: 'watch-thailand-newsletter', variant: 'green' },
    ],
  },

  // ── Vietnam ─────────────────────────────────────────────────────────────────
  vietnam: {
    slug: 'vietnam',
    name: 'Vietnam',
    flag: '🇻🇳',
    timezone: 'Asia/Ho_Chi_Minh',
    utcOffset: 'UTC+7',
    metaTitle: 'How to Watch FIFA World Cup 2026 in Vietnam – FPT Play, VTV & K+ | GoalRadar',
    metaDesc: 'Watch FIFA World Cup 2026 live in Vietnam on FPT Play, VTV and K+. Full Vietnam viewing guide with streaming options, kick-off times and how to watch every match.',
    heroSubtitle: 'FPT Play has comprehensive streaming rights. VTV free-to-air for selected matches.',
    intro:
      'Vietnam is one of Southeast Asia\'s most football-obsessed nations, with a population that ' +
      'passionately follows the Premier League, Champions League and major international tournaments. ' +
      'For FIFA World Cup 2026, FPT Corporation (FPT Play) holds comprehensive streaming rights, ' +
      'offering live access to all matches through their streaming platform. VTV (Vietnam Television) ' +
      'carries selected free-to-air matches on their public channels — a tradition dating back to ' +
      'previous World Cups. K+ (K Plus) satellite television also carries football rights and may ' +
      'feature World Cup coverage for subscribers. FPT Play is accessible via app and web browser, ' +
      'making it the most convenient option for younger Vietnamese viewers who primarily watch on ' +
      'smartphones and laptops. Vietnam\'s time zone (ICT, UTC+7) means North American matches ' +
      'air between 11:00 PM and 8:00 AM — a familiar schedule for fans who already stay up for ' +
      'late-night Premier League fixtures. With the Vietnamese national team\'s growing profile ' +
      'and a passionate football culture, World Cup 2026 is set to be an enormous television event.',
    quickVerdict: 'FPT Play for comprehensive streaming. VTV for selected free-to-air matches.',
    bestFree: 'VTV (selected matches — free to air)',
    bestPaid: 'FPT Play (comprehensive streaming)',
    broadcasters: [
      { name: 'FPT Play', type: 'streaming-paid', coverage: 'All/most matches', platform: 'App / Web / Smart TV', price: 'FPT subscription (affordable plans)', note: 'Main streaming rights holder in Vietnam. App available on iOS, Android, Smart TV.' },
      { name: 'VTV (Vietnam Television)', type: 'free-tv', coverage: 'Selected matches', platform: 'TV (national broadcast)', price: 'Free', note: 'Public broadcaster — typically carries high-profile matches and opening/final games free to air' },
      { name: 'K+ (K Plus)', type: 'pay-tv', coverage: 'Selected matches (TBC)', platform: 'Satellite TV + K+ app', price: 'K+ subscription required', note: 'Pay satellite TV — may carry supplemental World Cup coverage' },
      { name: 'VTC (Vietnam Multimedia Corporation)', type: 'free-tv', coverage: 'Selected matches (TBC)', platform: 'TV (digital terrestrial)', price: 'Free', note: 'State broadcaster — may carry some matches alongside VTV' },
    ],
    cordCuttingSection: {
      heading: 'How to Stream World Cup 2026 Online in Vietnam',
      body:
        'FPT Play is the go-to streaming option — download the app on iOS or Android, subscribe to ' +
        'an FPT package, and watch matches live and on demand on any device. FPT Play is widely ' +
        'used in Vietnam and offers a reliable, mobile-first experience. For free coverage, ' +
        'watch VTV on a TV set, or check the VTV Go app for any streaming of VTV-broadcast matches. ' +
        'K+ subscribers can use the K+ app for additional content. The FPT ecosystem (FPT Telecom ' +
        'broadband + FPT Play) is common in Vietnamese households and often includes bundled access. ' +
        'For Vietnamese fans abroad, a VPN with a Vietnam server can restore access to FPT Play ' +
        'from outside the country.',
    },
    timezoneSection: {
      heading: 'World Cup 2026 Match Times in Vietnam (ICT, UTC+7)',
      body:
        'Vietnam is in the Indochina Time (ICT) zone at UTC+7, identical to Thailand. ' +
        'Matches in North America translate to the following local times in Hanoi, Ho Chi Minh City and across Vietnam.',
      kickoffs: [
        { utcTime: '16:00 UTC', localTime: '11:00 PM ICT', label: 'Late night slot' },
        { utcTime: '19:00 UTC', localTime: '2:00 AM ICT',  label: 'Early morning slot (next day)' },
        { utcTime: '22:00 UTC', localTime: '5:00 AM ICT',  label: 'Very early morning slot' },
        { utcTime: '01:00 UTC', localTime: '8:00 AM ICT',  label: 'Morning slot' },
      ],
    },
    vpnSection: {
      heading: 'Watch International World Cup Coverage from Vietnam',
      body:
        'FPT Play is primarily available within Vietnam. Vietnamese fans living or travelling abroad ' +
        'can use a VPN with Vietnamese servers to access FPT Play and stream matches as if they were ' +
        'at home. Alternatively, expats in Vietnam from the UK, Australia or USA can use a VPN with ' +
        'servers in their home country to watch BBC iPlayer, SBS On Demand or Fox Sports streaming. ' +
        'A VPN also provides an extra layer of security when using public Wi-Fi at cafés or hotels.',
    },
    faq: [
      { q: 'How to watch FIFA World Cup 2026 in Vietnam?', a: 'FPT Play holds comprehensive streaming rights for World Cup 2026 in Vietnam. VTV (Vietnam Television) airs selected matches free on public channels. K+ satellite TV may carry additional coverage. Use the FPT Play app on iOS or Android for the most complete access.' },
      { q: 'Is FPT Play showing all World Cup 2026 matches in Vietnam?', a: 'FPT Play holds extensive digital rights in Vietnam and is expected to stream all or most matches. VTV typically carries free-to-air rights for the opening match, semi-finals and final at minimum. Check FPT Play and VTV official channels for confirmed match allocation closer to June 2026.' },
      { q: 'Is World Cup 2026 free to watch on VTV in Vietnam?', a: 'VTV (Vietnam Television) traditionally carries selected World Cup matches free on public channels. The opening match, semi-finals and final typically air on VTV. For comprehensive access to all group stage matches, FPT Play or K+ subscription is recommended.' },
      { q: 'What time do World Cup matches start in Ho Chi Minh City?', a: 'In Vietnam (ICT, UTC+7), group stage matches kick off at approximately 11:00 PM, 2:00 AM, 5:00 AM and 8:00 AM local time. The 8:00 AM slot is the most convenient for morning viewing.' },
      { q: 'Can I watch World Cup 2026 on my phone in Vietnam?', a: 'Yes. The FPT Play app (iOS/Android) supports live streaming on mobile. The VTV Go app may stream VTV-broadcast matches. K+ also has a mobile app for subscribers.' },
      { q: 'How to watch World Cup if I am Vietnamese living abroad?', a: 'Use a VPN with Vietnamese servers to access FPT Play from outside Vietnam. Connect to a Vietnamese server, open the FPT Play app or website, and stream as if you were in the country.' },
      { q: 'Does Vietnam have broadcasting rights for World Cup 2026?', a: 'Yes. FPT Corporation has been a major rights holder for international football in Vietnam, including previous World Cups. VTV also holds public broadcast rights for selected matches. Exact package details will be announced by FPT and VTV closer to the tournament.' },
      { q: 'Is there a free streaming option for World Cup 2026 in Vietnam?', a: 'VTV provides free-to-air broadcast for selected matches. VTV Go (VTV\'s app) may stream these matches online. For full access to all matches, FPT Play requires a subscription. Check FPT Play for current pricing and promotional packages.' },
    ],
    affiliates: [
      { title: 'Access FPT Play Abroad — VPN Guide', description: 'Watch FPT Play from outside Vietnam with a fast Vietnamese VPN server. Stream every match on your phone or laptop.', cta: 'Get a VPN', tag: 'watch-vietnam-vpn', variant: 'blue' },
      { title: 'Get World Cup Match Alerts', description: 'Fixture reminders, live score updates and results delivered free to your inbox.', cta: 'Subscribe Free', tag: 'watch-vietnam-newsletter', variant: 'green' },
    ],
  },

};

export const WC_WATCH_COUNTRY_SLUGS = Object.keys(WC_WATCH_COUNTRIES);

export function getWatchCountry(slug: string): WCWatchCountry | null {
  return WC_WATCH_COUNTRIES[slug] ?? null;
}
