/*
 * Invented seed data for the dev-only fake Firestore. Every name, title,
 * venue and email here is made up. Dates are relative to today so each
 * scenario always lands in the phase it is named after.
 *
 * Scenarios: empty, fresh, lists, invites (default), production, showweek, after.
 */

export interface SeedDoc {
  path: string;
  data: Record<string, unknown>;
}

type MakeTs = (ms: number) => unknown;

const PEOPLE = [
  'Avery Quill', 'Bea Marchetti', 'Cal Okonkwo', 'Dana Whitlock', 'Eli Brandvold', 'Fern Castellano',
  'Gus Halloran', 'Hana Leclair', 'Ivo Petrakis', 'Juno Albright', 'Kit Ferreira', 'Lena Moreau',
  'Milo Achterberg', 'Nora Vasquez', 'Otto Lindqvist', 'Pia Delacroix', 'Quinn Harrow', 'Rosa Abernathy',
  'Sami Okafor', 'Tess Kowalczyk', 'Uma Fairweather', 'Vic Santangelo', 'Wren Hadley', 'Xavi Montclair',
  'Yara Bellweather', 'Zed Kincaid', 'Ada Penhallow', 'Bram Oyelaran', 'Cleo Rasmussen', 'Dev Ashcombe',
  'Effie Tranter', 'Finn Galloway', 'Gia Moretti', 'Hal Brightwater', 'Iris Vandermolen', 'Jules Carrow',
  'Kai Thornbury', 'Lux Ambrose', 'Mae Holloway', 'Ned Farquhar', 'Opal Sinclair', 'Pip Ravensworth',
  'Rex Calloway', 'Sol Everhart', 'Tova Lindgren',
];

const FILMS = [
  'The Glass Orchard', 'Midnight at Pelican Pier', 'Seven Small Thunders', 'Lantern Season', 'Copper Ridge',
  'The Velvet Accountant', 'Northbound Waltz', 'A Fox in Aspic', 'Paper Boats', 'Saltwater Saints',
  'The Quiet Engine', 'Moth Hour', 'Dear Hollow', 'Orbit of Small Things', 'The Last Cartographer',
  'Pigeon Kings', 'Heatwave Hotel', 'Under the Rhubarb', 'Ghosts of Galveston Street', 'Two Left Wings',
  'The Borrowed Summer', 'Cinder & Sage', 'Atlas Unbound', 'Wolves of the Laundromat',
];

const DAY = 86_400_000;

function iso(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function steps(labels: string[], done: number, doing = false) {
  return labels.map((label, i) => ({
    key: slug(label),
    label,
    status: i < done ? 'done' : i === done && doing ? 'doing' : 'todo',
  }));
}

const STEP_LABELS: Record<string, string[]> = {
  'award-video': [
    'Nominees set', 'Images and clips gathered', 'Winner decided', 'Script and voice-over', 'Edit',
    'Export at −3 dBFS and test loud', 'In master deck',
  ],
  song: ['Song picked', 'Lyrics', 'Vocals recorded', 'Mix', 'Video or backing track', 'Rehearsed', 'In playlist'],
  'slides-bit': ['Draft', 'Final', 'In master deck'],
  'contributor-deck': [
    'Asked', 'Title and minutes confirmed', 'Submitted', 'Checked (arrow-key playback, audio levels)', 'In master deck',
  ],
  other: ['To do', 'Done'],
};

interface Scenario {
  daysToShow: number | null;
  /** 0..1, how far production has got. */
  progress: number;
  venueBooked: boolean;
  invites: 'none' | 'some' | 'most' | 'all';
  rsvps: number;
  published: boolean;
}

const SCENARIOS: Record<string, Scenario> = {
  lists: { daysToShow: 150, progress: 0.12, venueBooked: false, invites: 'none', rsvps: 0, published: false },
  invites: { daysToShow: 62, progress: 0.38, venueBooked: true, invites: 'some', rsvps: 4, published: false },
  production: { daysToShow: 24, progress: 0.66, venueBooked: true, invites: 'most', rsvps: 1, published: true },
  showweek: { daysToShow: 4, progress: 0.9, venueBooked: true, invites: 'all', rsvps: 0, published: true },
  after: { daysToShow: -9, progress: 1, venueBooked: true, invites: 'all', rsvps: 0, published: true },
};

export function seedFor(name: string, ts: MakeTs): SeedDoc[] {
  if (name === 'empty') return [];
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const day = (n: number) => iso(new Date(today.getTime() + n * DAY));
  const stamp = (n: number) => ts(today.getTime() + n * DAY);
  const meta = (n = -30) => ({ createdAt: stamp(n), updatedAt: stamp(n), updatedBy: 'planner' });
  const docs: SeedDoc[] = [];
  const put = (path: string, data: Record<string, unknown>) => docs.push({ path, data: { ...meta(), ...data } });

  // People are shared across seasons.
  PEOPLE.forEach((n, i) => {
    const first = n.split(' ')[0].toLowerCase();
    put(`people/p${i + 1}`, {
      name: n,
      ...(i % 3 !== 2 ? { email: `${first}@example.com` } : {}),
      ...(i === 4 ? { aliases: ['Eli B'] } : {}),
    });
  });

  // Last year's season, archived.
  put('seasons/2026', {
    year: 2026, name: '2026 Award Sharemony', showDate: day(-300), showStartTime: '19:00',
    runtimeCapSec: 10800, bufferTargetSec: 600, capacity: 55, timerDocId: 'seanscars-2026-rundown', archived: true,
  });
  PEOPLE.slice(0, 30).forEach((_, i) =>
    put(`seasons/2026/invitations/p${i + 1}`, {
      status: i % 6 === 5 ? 'declined' : 'confirmed', plusOnes: i % 4 === 0 ? 1 : 0, brunch: i % 3 === 0, rsvpIds: [],
    }),
  );

  if (name === 'fresh') {
    put('seasons/2027', {
      year: 2027, name: '2027 Award Sharemony', showStartTime: '19:00', runtimeCapSec: 10800, bufferTargetSec: 600,
      timerDocId: 'seanscars-2027-rundown', archived: false,
    });
    return docs;
  }

  const sc = SCENARIOS[name] ?? SCENARIOS.invites;
  const r = rand(2027);
  const S = 'seasons/2027';
  const showDate = sc.daysToShow === null ? undefined : day(sc.daysToShow);
  const until = (d: number) => (sc.daysToShow ?? 90) - d; // days from today to "d days before the show"

  /* ---------- venues ---------- */
  const venues = [
    { id: 'v1', name: 'The Marigold Room', capacity: 60, quoteUsd: 1800, datesOffered: 'Fri or Sat in late Feb' },
    { id: 'v2', name: 'Old Fire Station Hall', capacity: 75, quoteUsd: 2400, datesOffered: 'Any Saturday' },
    { id: 'v3', name: 'Bluebird Supper Club', capacity: 48, quoteUsd: 1200, datesOffered: 'Sundays only' },
    { id: 'v4', name: 'Riverside Grange', capacity: 90, quoteUsd: 3100 },
  ];
  venues.forEach((v, i) => {
    const status = sc.venueBooked
      ? i === 0 ? 'booked' : i === 2 ? 'declined' : 'inquired'
      : ['holding', 'inquired', 'researching', 'inquired'][i];
    put(`${S}/venues/${v.id}`, {
      name: v.name, status, capacity: v.capacity, quoteUsd: v.quoteUsd,
      ...(v.datesOffered ? { datesOffered: v.datesOffered } : {}),
      ...(status !== 'researching' ? { lastContactDate: day(-3 - i * 6) } : {}),
      ...(i === 0 ? { depositDue: day(sc.venueBooked ? -20 : 12) } : {}),
      links: [{ label: 'Website', url: `https://example.com/${slug(v.name)}` }],
      ...(i === 1 ? { notes: 'Has a projector; bring our own mics.' } : {}),
    });
  });

  put(S, {
    year: 2027, name: '2027 Award Sharemony', ...(showDate ? { showDate } : {}), doorsTime: '18:30',
    showStartTime: '19:00', runtimeCapSec: 10800, bufferTargetSec: 600, capacity: sc.venueBooked ? 60 : 54,
    ...(sc.venueBooked ? { venueOptionId: 'v1' } : {}), timerDocId: 'seanscars-2027-rundown',
    masterDeckUrl: 'https://example.com/master-deck', theme: 'Lost & Found', archived: false,
  });

  /* ---------- invitations ---------- */
  // p1..p42 are on the list this year; p43..p45 are not.
  const contributors = [3, 7, 11, 16, 22, 28]; // person numbers presenting
  const invited = sc.invites === 'none' ? 0 : sc.invites === 'some' ? 26 : sc.invites === 'most' ? 40 : 42;
  for (let i = 1; i <= 45; i++) {
    const id = `p${i}`;
    const plusOnes = i % 3 === 0 ? 1 : i % 11 === 0 ? 2 : 0;
    let status: string;
    let extra: Record<string, unknown> = {};
    if (i > 42) status = 'not-inviting';
    else if (i <= 3 && sc.invites === 'none') status = 'confirmed'; // co-hosts said yes in person
    else if (i > invited) status = 'invite?';
    else {
      const sentAgo = Math.max(1, Math.round(4 + (i / 42) * 30));
      const method = ['text', 'email', 'mail', 'hand'][i % 4];
      extra = { method, invitedAt: day(-sentAgo) };
      const replied = sc.invites === 'some' ? i % 3 !== 1 : sc.invites === 'most' ? i % 9 !== 4 : true;
      if (!replied) status = 'invited';
      else {
        status = i % 8 === 6 ? 'declined' : i % 7 === 5 ? 'maybe' : 'confirmed';
        extra.respondedAt = day(-Math.max(0, sentAgo - 3));
      }
    }
    put(`${S}/invitations/${id}`, {
      status, plusOnes, brunch: status === 'confirmed' && i % 2 === 0, rsvpIds: [], ...extra,
      ...(i === 9 ? { notes: 'Ask about the piano' } : {}),
    });
  }

  /* ---------- RSVPs (public form, unprocessed) ---------- */
  const rsvpPeople = [
    { first: 'Gus', last: 'Halloran', email: 'gus@example.com', rsvp: 'enthusiastically', brunch: 'Yes', type: 'attend' },
    { first: 'Lena', last: 'Moreau', email: 'lena@example.com', rsvp: 'tentatively', brunch: 'No', type: 'attend' },
    { first: 'Marlow', last: 'Testa', email: 'marlow@example.com', rsvp: 'enthusiastically', brunch: 'No', type: 'present', award: 'The Snack Awards' },
    { first: 'Nora', last: 'Vasquez', email: 'nora@example.com', rsvp: 'regretfully', brunch: 'No', type: 'attend' },
  ];
  rsvpPeople.slice(0, sc.rsvps).forEach((p, i) =>
    put(`rsvps/r${i + 1}`, {
      firstName: p.first, lastName: p.last, email: p.email, rsvp: p.rsvp,
      guestsComment: i === 0 ? 'Bringing my partner!' : '', attendanceType: p.type, awardName: p.award ?? '',
      brunch: p.brunch, createdAt: stamp(-i), source: 'rsvp-page', seasonHint: '2027',
    }),
  );

  /* ---------- segments ---------- */
  const segs: [string, string, string, number, string[], string?, string?][] = [
    ['Cold open', 'pretape', 'video', 240, []],
    ['Welcome & house rules', 'live', 'slides', 360, []],
    ['Best Snack Pairing', 'live', 'slides', 540, [], undefined, 'award'],
    ['The Lost & Found Song', 'song', 'live-music', 270, []],
    ['Guest set: Cal', 'live', 'slides', 600, ['p3']],
    ['Most Dramatic Exit', 'pretape', 'video', 420, []],
    ['Guest set: Gus', 'live', 'slides', 540, ['p7']],
    ['Intermission', 'intermission', 'none', 900, [], 'Sharemony'],
    ['Lifetime Achievement in Napping', 'pretape', 'video', 480, []],
    ['Guest set: Kit', 'live', 'browser', 600, ['p11']],
    ['Best Supporting Pet', 'live', 'slides', 480, []],
    ['Guest set: Pia & Ned', 'live', 'slides', 720, ['p16', 'p40']],
    ['Audience vote reveal', 'live', 'slides', 300, [], 'Sharemony'],
    ['Guest set: Vic', 'live', 'slides', 540, ['p22']],
    ['Best Picture', 'pretape', 'video', 600, []],
    ['Finale & thank-yous', 'live', 'slides', 420, []],
  ];
  // Pushes the show a few minutes over the 2:50 available time in early phases.
  const extraMin = name === 'production' ? 18 : name === 'invites' ? 6 : 0;
  segs.forEach(([title, type, src, sec, owners, label], i) =>
    put(`${S}/segments/s${i + 1}`, {
      order: (i + 1) * 1000, title, type, playbackSource: src, plannedSec: sec + (i === 9 ? extraMin * 60 : 0),
      ownerPersonIds: owners, ...(label ? { presenterLabel: label } : {}),
      ...(i === 12 ? { hardTime: '21:15' } : {}),
      ...(i === 5 ? { notes: 'Check the audio level on the last clip.' } : {}),
    }),
  );

  /* ---------- awards ---------- */
  const awards: [string, string, string, number][] = [
    ['Best Snack Pairing', 'nominees', 's3', 0],
    ['Most Dramatic Exit', 'contenders', 's6', 1],
    ['Lifetime Achievement in Napping', 'winner', 's9', 2],
    ['Best Supporting Pet', 'nominees', 's11', 3],
    ['Best Picture', 'nominees', 's15', 4],
    ['Most Improved Houseplant', 'idea', '', 5],
    ['Best Use of a Hat', 'cut', '', 6],
  ];
  const decided = sc.progress >= 0.6;
  awards.forEach(([nm, stage0, seg, i]) => {
    const films = FILMS.slice(i * 3, i * 3 + 5);
    const contenders = films.map((f, j) => ({ id: `a${i + 1}c${j + 1}`, label: f, filmId: `f${i * 3 + j + 1}`, nominee: j < 4 && stage0 !== 'contenders' }));
    const hasWinner = stage0 === 'winner' || (decided && stage0 === 'nominees' && i !== 4) || (sc.progress >= 0.9 && stage0 !== 'idea' && stage0 !== 'cut');
    put(`${S}/awards/a${i + 1}`, {
      order: (i + 1) * 1000, name: nm, stage: hasWinner ? 'winner' : stage0, returning: i < 3,
      ...(seg ? { segmentId: seg } : {}),
      contenders: stage0 === 'idea' ? [] : contenders.map((c) => (hasWinner ? { ...c, nominee: c.nominee || c.id.endsWith('c1') } : c)),
      ...(hasWinner ? { winnerContenderId: `a${i + 1}c1` } : {}),
      ...(i === 0 ? { recognizes: 'The boldest snack combination of the year' } : {}),
    });
  });

  /* ---------- pieces ---------- */
  let order = 0;
  const piece = (id: string, data: Record<string, unknown>) => {
    order += 1000;
    put(`${S}/pieces/${id}`, { order, ownerPersonIds: [], links: [], ...data });
  };
  const doneOf = (kind: string, bias: number) => {
    const n = STEP_LABELS[kind].length;
    return Math.max(0, Math.min(n, Math.round(n * Math.min(1, sc.progress + bias))));
  };
  // Award videos: their "Winner decided" step must wait on the award.
  [['a1', 's3', 300], ['a2', 's6', 420], ['a3', 's9', 450], ['a4', 's11', 360], ['a5', 's15', 540]].forEach(
    ([aw, seg, est], i) => {
      const awardDecided = i === 2 || (decided && i !== 4 && i !== 1) || sc.progress >= 0.9;
      let done = doneOf('award-video', (i % 3) * 0.08 - 0.05);
      if (!awardDecided) done = Math.min(done, 2);
      piece(`pv${i + 1}`, {
        title: `${awards[i][0]} video`, kind: 'award-video', awardId: aw, segmentId: seg, estSec: est,
        ...(done >= 5 ? { measuredSec: (est as number) + 25 } : {}),
        steps: steps(STEP_LABELS['award-video'], done, done < 7 && i % 2 === 0),
        dueDate: day(until(10 + i * 3)),
      });
    },
  );
  piece('ps1', {
    title: 'The Lost & Found Song', kind: 'song', segmentId: 's4', estSec: 240,
    steps: steps(STEP_LABELS.song, doneOf('song', 0.05), true), dueDate: day(until(14)),
    links: [{ label: 'Lyrics doc', url: 'https://example.com/lyrics' }],
  });
  piece('ps2', { title: 'Cold open', kind: 'other', segmentId: 's1', estSec: 210, steps: steps(STEP_LABELS.other, doneOf('other', 0)) });
  piece('ps3', { title: 'House rules slides', kind: 'slides-bit', segmentId: 's2', estSec: 300, steps: steps(STEP_LABELS['slides-bit'], doneOf('slides-bit', 0.2)), dueDate: day(until(7)) });
  piece('ps4', { title: 'Vote reveal graphics', kind: 'slides-bit', segmentId: 's13', estSec: 240, steps: steps(STEP_LABELS['slides-bit'], doneOf('slides-bit', -0.1)), waitingOn: { kind: 'question', id: 'q2' } });
  piece('ps5', { title: 'Thank-you montage', kind: 'other', estSec: 180, steps: steps(STEP_LABELS.other, doneOf('other', -0.2)) });
  piece('ps6', { title: 'Napping highlight reel', kind: 'slides-bit', estSec: 120, steps: steps(STEP_LABELS['slides-bit'], 0) });

  // Contributor decks: one per presenting guest; staggered due dates and progress.
  const deckTitles = ['The Crumb Awards', 'Awards for Doors', 'Best Weather of the Year', 'The Sock Drawer Honors', 'Kitchen Gadget Oscars', 'Car Karaoke Golden Mics'];
  const segFor = ['s5', 's7', 's10', 's12', 's14', undefined];
  contributors.forEach((p, i) => {
    const bias = [0.25, -0.15, 0.05, -0.3, 0.1, -0.4][i];
    piece(`pc${i + 1}`, {
      title: deckTitles[i], kind: 'contributor-deck', ownerPersonIds: i === 3 ? [`p${p}`, 'p40'] : [`p${p}`],
      ...(segFor[i] ? { segmentId: segFor[i] } : {}), confirmedSec: 480 + i * 30,
      steps: steps(STEP_LABELS['contributor-deck'], Math.max(1, doneOf('contributor-deck', bias))),
      dueDate: day(until(21 - i * 2)),
    });
  });
  void r;

  /* ---------- questions ---------- */
  const qs: [string, number, string?, string?][] = [
    ['Do we serve dinner or just snacks?', -2, undefined, 'Dinner; Heavy snacks; Potluck'],
    ['How does the audience vote this year — paper or phones?', 6],
    ['Who runs the slides while Sean is on stage?', 14],
    ['Is brunch the next morning at the same venue?', 30],
    ['Dress code wording', -40, 'Black tie optional, costumes encouraged'],
  ];
  qs.forEach(([q, due, answer, options], i) =>
    put(`${S}/questions/q${i + 1}`, {
      question: q, dueDate: day(due), status: answer ? 'decided' : 'open', ...(answer ? { answer } : {}),
      ...(options ? { options } : {}),
    }),
  );

  /* ---------- checklist ---------- */
  const tasks: [string, string, number, boolean][] = [
    ['Pay venue deposit', 'Venue', until(70), sc.venueBooked],
    ['Book the sound person', 'Tech', until(30), sc.progress > 0.5],
    ['Test the projector and clicker', 'Tech', until(3), sc.progress >= 1],
    ['Order trophies', 'Props', until(21), sc.progress > 0.6],
    ['Print ballots', 'Props', until(5), sc.progress >= 0.9],
    ['Buy snacks and drinks', 'Food', until(2), sc.progress >= 1],
    ['Confirm brunch reservation', 'Food', until(10), sc.progress > 0.85],
    ['Send run of show to helpers', 'Show', until(4), sc.progress >= 0.9],
    ['Charge the mics', 'Tech', until(1), false],
    ['Thank-you notes', 'After', -(sc.daysToShow ?? 0) + 7 + (sc.daysToShow ?? 0) * 0, false],
  ];
  tasks.forEach(([text, area, due, done], i) =>
    put(`${S}/checklist/t${i + 1}`, {
      text, area, dueDate: day(i === 9 ? (sc.daysToShow ?? 0) + 7 : due), done, order: (i + 1) * 1000,
      ...(i === 6 ? { waitingOn: { kind: 'question', id: 'q4' } } : {}),
    }),
  );

  /* ---------- films ---------- */
  FILMS.forEach((title, i) =>
    put(`${S}/films/f${i + 1}`, {
      title, seen: i % 4 !== 3, eligible: i % 9 !== 8, onBallot: i < 15,
      ...(i % 4 !== 3 ? { reaction: ['loved', 'liked', 'meh', 'disliked'][i % 4 === 2 ? 2 : i % 5 === 0 ? 0 : 1] } : {}),
      ...(i === 2 ? { ideas: 'Running gag: the thunder count' } : {}),
    }),
  );

  /* ---------- ideas ---------- */
  const ideas: [string, string, string?][] = [
    ['A song about the lost-and-found box at the venue', 'song'],
    ['Award for the best wrong answer on the ballot', 'award'],
    ['Bit: Sean reads one-star reviews of the show', 'bit'],
    ['Theme idea: everything is an envelope', 'theme'],
    ['Montage of everyone saying "is this on?"', 'bit'],
    ['Most Improved Houseplant', 'award', 'award'],
  ];
  ideas.forEach(([text, tag, promoted], i) =>
    put(`${S}/ideas/i${i + 1}`, {
      ...meta(-20 + i), text, tag, ...(promoted ? { promotedTo: { kind: promoted, id: 'a6' } } : {}),
    }),
  );

  /* ---------- publishes ---------- */
  if (sc.published) {
    put(`${S}/publishes/pub1`, {
      at: stamp(-6), targetDocId: 'seanscars-2027-rundown-test', segmentCount: segs.length, totalSec: 0,
      byEmail: 'planner', payloadUpdatedAtMs: today.getTime() - 6 * DAY,
    });
  }

  return docs;
}
