// Scenario data for the Executive Calendar Control Room.
// Shared by the page and the scoring functions. It holds facts and wording only.
// Answer keys and credit rules live on the server in netlify/lib/scenario.mjs.
// Days are November 2026 dates (2 = Monday 2 November). Times are WAT unless stated.

export const T = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
export const hhmm = (n) => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
const WD = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const dayName = (d) => WD[(((d - 2) % 7) + 7) % 7];
export const dayShort = (d) => dayName(d).slice(0, 3);
export const dayLong = (d) => `${dayName(d)} ${d} November`;
export const dayMid = (d) => `${dayShort(d)} ${d} Nov`;
export const absMin = (d, m) => d * 1440 + m;
export const parseSlot = (v) => {
  const m = /^(\d{1,2})@(\d{2}:\d{2})$/.exec(String(v || ''));
  return m ? { day: Number(m[1]), start: T(m[2]) } : null;
};
export const slotValue = (day, start) => `${day}@${hhmm(start)}`;

export const MAX_ATTEMPTS = 3;
export const RULES = { open: T('09:00'), close: T('17:00'), len: 30, buffer: 15, notice: 1440, dailyLimit: 4 };
export const GRID = { from: T('09:00'), to: T('17:30'), step: 15 };

export const PEOPLE = {
  exec: 'Damilola Akinwale',
  company: 'KestrelPoint Advisory Ltd.',
};

// type: client, internal, protected, travel, proposed, allday
export const EVENTS = [
  { day: 2, from: '09:00', to: '10:00', type: 'internal', title: 'Leadership huddle' },
  { day: 2, from: '11:00', to: '11:30', type: 'client', title: 'Client consultation' },
  { day: 2, from: '13:30', to: '14:00', type: 'client', title: 'Client consultation' },

  { day: 3, type: 'allday', title: 'Budget week', free: true },
  { day: 3, from: '10:00', to: '10:30', type: 'client', title: 'Client consultation' },
  { day: 3, from: '13:30', to: '14:30', type: 'internal', title: 'Finance review' },
  { day: 3, from: '15:00', to: '15:30', type: 'client', title: 'Client call' },

  { day: 4, from: '11:00', to: '11:30', type: 'client', title: 'Mrs Hauwa Danjuma', sub: 'Online consultation', series: true },
  { day: 4, from: '14:00', to: '15:00', type: 'internal', title: 'Partner call' },

  { day: 5, from: '09:00', to: '11:00', type: 'protected', title: 'Protected time' },
  { day: 5, from: '11:30', to: '12:00', type: 'client', title: 'Client consultation' },
  { day: 5, from: '13:00', to: '14:00', type: 'internal', title: 'Internal meeting' },
  { day: 5, from: '15:45', to: '16:15', type: 'client', title: 'Client consultation' },

  { day: 6, from: '10:00', to: '11:15', type: 'internal', title: 'Site A meeting', sub: 'Ikoyi' },
  { day: 6, from: '11:15', to: '12:05', type: 'travel', title: 'Travel and access', sub: '40 min drive, 10 min access' },
  { day: 6, from: '11:30', to: '12:00', type: 'proposed', title: 'Harbour Mills review', sub: 'Proposed, 6 people' },
  { day: 6, from: '13:30', to: '14:30', type: 'protected', title: 'Protected time' },
  { day: 6, from: '15:15', to: '15:45', type: 'client', title: 'Mr Tobenna Eze', sub: 'Online consultation' },
  { day: 6, from: '16:00', to: '16:30', type: 'client', title: 'Client consultation' },

  { day: 9, from: '09:00', to: '09:30', type: 'client', title: 'Client consultation' },
  { day: 9, from: '10:30', to: '11:00', type: 'client', title: 'Client consultation' },
  { day: 9, from: '13:00', to: '13:30', type: 'client', title: 'Client consultation' },
  { day: 9, from: '15:00', to: '15:30', type: 'client', title: 'Client consultation' },

  { day: 10, from: '09:00', to: '10:00', type: 'internal', title: 'Internal meeting' },
  { day: 10, from: '11:30', to: '12:00', type: 'client', title: 'Client consultation' },

  { day: 11, from: '16:00', to: '17:00', type: 'protected', title: 'Out of office', sub: 'From 16:00' },

  { day: 12, from: '09:00', to: '10:00', type: 'protected', title: 'Protected time' },
  { day: 12, from: '13:00', to: '13:30', type: 'client', title: 'Client consultation' },
].map((e) => ({ ...e, a: e.from ? T(e.from) : null, b: e.to ? T(e.to) : null }));

const hourOptions = (from, to) => {
  const out = [];
  for (let m = T(from); m <= T(to); m += 15) out.push({ id: hhmm(m), label: hhmm(m) });
  return out;
};

export const MEMO = {
  to: 'Executive Virtual Assistant',
  from: 'Office of the CEO, KestrelPoint Advisory Ltd.',
  date: 'Monday 2 November 2026',
  subject: 'Standing rules for the calendar this week',
  intro: 'You manage Damilola Akinwale’s calendar this week, Monday 2 to Friday 6 November. All times are WAT unless stated. Requests reach you as the week goes. Apply these rules to every one.',
  rules: [
    'Hours are 09:00 to 17:00, Monday to Friday. An appointment and its buffer must end by 17:00.',
    'A consultation is 30 minutes and starts on the quarter hour.',
    'New bookings and changes need 24 hours’ notice, counted from the time on your clock.',
    'Leave 15 minutes after every appointment and every meeting. Protected time cannot be booked, and a buffer cannot run into it.',
    'No more than 4 client appointments a day. A booking can be rescheduled once.',
    'For in person meetings, travel and access time replace the buffer after the previous appointment. The 15 minute buffer after the meeting still applies. A room needs 15 minutes to reset and must be big enough for everyone attending.',
    'Reminders go out 24 hours and 2 hours before each appointment.',
    'Late arrivals get 10 minutes’ grace. At least 20 minutes of service must remain, and the buffer is not service time. If that cannot be met, rebook within 5 working days and record “Late arrival, rebooked”. “No show” applies only when the customer neither arrives nor makes contact before the booked time ends.',
  ],
  outro: 'Keep notes to what the appointment needs. Record every conflict decision.',
};

export const HELP = [
  'Read the memo first. Its rules apply to every request.',
  'Each stage has a request and a list of tasks. Work in any order inside a stage.',
  'To choose a time, tap a quarter hour on the calendar. Your pick shows with its buffer.',
  'The page marks direct overlaps only. Every other check is yours.',
  'Your work saves after every action and follows you to another phone or laptop.',
  'Continue locks a stage. You cannot return to it.',
  'Log out ends your attempt and submits your work so far. Items left blank score nothing.',
  'Reset clears your work and restarts the shift. You can reset once in each attempt. It uses no attempt.',
];

const TIMES = hourOptions('09:00', '16:45');
const ENDS = hourOptions('09:15', '17:15');
const DATES_W1 = [2, 3, 4, 5, 6].map((d) => ({ id: String(d), label: dayMid(d) }));

const o = (id, label, sub) => (sub ? { id, label, sub } : { id, label });

export const STAGES = [
  // ------------------------------------------------------------ Stage 1
  {
    n: 1,
    title: 'Book a consultation',
    short: 'Book',
    clock: { day: 2, time: '15:30' },
    days: [2, 3, 4, 5, 6],
    startDay: 3,
    slotKey: 's1.slot',
    window: { days: [3], from: '14:30', to: '17:00' },
    attendee: { name: 'Mr Sani Abdullahi', busy: [{ day: 3, from: '15:30', to: '16:15' }] },
    nyChip: true,
    request: {
      kind: 'email',
      from: 'Kemi Balogun',
      role: 'Operations Manager, Cedar Peak Retail Ltd., New York',
      subject: 'Consultation request',
      time: 'Monday 2 November, 15:25',
      body: [
        'Good afternoon,',
        'I would like a 30 minute consultation with Damilola on Tuesday. I am free between 08:30 and 11:00 New York time. I want to talk about the operations review for our stores.',
        'Please include Mr Sani Abdullahi from your finance team, as we will discuss costs.',
        'Please keep this between us: I am dealing with a family matter this month, so I may need to move quickly.',
        'Kind regards,',
        'Kemi Balogun',
      ],
    },
    tasks: [
      {
        title: 'Choose a calendar view',
        prompt: 'You need to compare Tuesday 3 November closely, 15 minutes at a time. Which view do you open?',
        fields: [{ key: 's1.view', kind: 'radio', options: [
          o('day', 'Day view', 'One day at 15 minute steps'),
          o('week', 'Work week view', 'Monday to Friday side by side'),
          o('month', 'Month view', 'The whole month at a glance'),
        ] }],
      },
      {
        title: 'Convert Kemi’s window to WAT',
        prompt: 'Kemi is free from 08:30 to 11:00 New York time on Tuesday 3 November. What is her window in WAT?',
        fields: [{ key: 's1.window', kind: 'radio', options: [
          o('w1330', '13:30 to 16:00 WAT'),
          o('w1430', '14:30 to 17:00 WAT'),
          o('w0830', '08:30 to 11:00 WAT'),
          o('w0330', '03:30 to 06:00 WAT'),
        ] }],
      },
      {
        title: 'Say why three slots fail',
        prompt: 'Three Tuesday times are flagged. For each one, choose every reason it fails.',
        fields: ['14:30', '15:45', '16:30'].map((t) => ({
          key: `s1.r${t.replace(':', '')}`,
          kind: 'multi',
          label: `${t} to ${hhmm(T(t) + 30)}`,
          columns: true,
          options: [
            o('notice', 'Less than 24 hours’ notice'),
            o('buffer', 'The 15 minute buffer is not respected'),
            o('attendee', 'A required attendee is busy'),
            o('hours', 'The appointment and buffer run past 17:00'),
            o('overlap', 'It overlaps another appointment'),
            o('protected', 'It uses protected time'),
            o('window', 'It is outside Kemi’s window'),
            o('limit', 'It goes over 4 client appointments a day'),
          ],
        })),
      },
      {
        title: 'Check the all day event',
        prompt: '“Budget week” is an all day event on Tuesday. It is shown as Free. Does it block Tuesday?',
        fields: [{ key: 's1.allday', kind: 'radio', options: [
          o('free', 'No. It is shown as Free, so the day stays open'),
          o('block', 'Yes. An all day event blocks the whole day'),
          o('pm', 'Only the afternoon'),
        ] }],
      },
      {
        title: 'Word the free/busy answer',
        prompt: 'Kemi asks why 15:45 is not possible. Mr Abdullahi’s calendar shows only Busy, with no details. What do you tell her?',
        fields: [{ key: 's1.freebusy', kind: 'radio', options: [
          o('ok', '“That time is not available because a required attendee is busy.”'),
          o('vague', '“That time is not available.”'),
          o('leak', '“Mr Abdullahi is in a meeting with the finance team until 16:15.”'),
          o('wrong', '“Damilola is busy at that time.”'),
        ] }],
      },
      {
        title: 'Choose the slot and complete the record',
        prompt: 'Tap the best start time on the calendar. Then complete the appointment record.',
        fields: [
          { key: 's1.slot', kind: 'slot' },
          { key: 's1.rec.date', kind: 'select', label: 'Date', options: DATES_W1 },
          { key: 's1.rec.start', kind: 'select', label: 'Start', options: TIMES },
          { key: 's1.rec.end', kind: 'select', label: 'End', options: ENDS },
          { key: 's1.rec.zone', kind: 'select', label: 'Time zone', options: [
            o('wat', 'WAT, Lagos time (1 hour ahead of UTC)'),
            o('est', 'EST, New York time (5 hours behind UTC)'),
            o('edt', 'EDT, New York summer time (4 hours behind UTC)'),
            o('gmt', 'GMT'),
          ] },
          { key: 's1.rec.participant', kind: 'select', label: 'Participant', options: [
            o('kemi', 'Kemi Balogun, Cedar Peak Retail Ltd.'),
            o('dami', 'Damilola Akinwale, KestrelPoint Advisory Ltd.'),
            o('sani', 'Mr Sani Abdullahi'),
          ] },
          { key: 's1.rec.contact', kind: 'select', label: 'Contact method', options: [
            o('email', 'Email'), o('phone', 'Phone call'), o('chat', 'Chat message'),
          ] },
          { key: 's1.rec.provider', kind: 'select', label: 'Provider', options: [
            o('dami', 'Damilola Akinwale, CEO'), o('sani', 'Mr Sani Abdullahi'), o('kemi', 'Kemi Balogun'),
          ] },
          { key: 's1.rec.attendee', kind: 'select', label: 'Required attendee', options: [
            o('sani', 'Mr Sani Abdullahi'), o('yusuf', 'Mr Yusuf Garba'), o('none', 'No required attendee'),
          ] },
          { key: 's1.rec.link', kind: 'select', label: 'Meeting link', options: [
            o('video', 'Video meeting link in the invitation'), o('phone', 'No link. Call her by phone'), o('office', 'In person at the Lagos office'),
          ] },
          { key: 's1.rec.status', kind: 'select', label: 'Status', options: [
            o('confirmed', 'Confirmed'), o('pending', 'Pending'), o('cancelled', 'Cancelled'), o('noshow', 'No show'),
          ] },
        ],
      },
      {
        title: 'Confirm and set reminders',
        prompt: 'Choose the confirmation to send to Kemi, then the reminder plan. Times come from your record.',
        fields: [
          { key: 's1.confirm', kind: 'template', channel: 'email', to: 'Kemi Balogun', subject: 'Your consultation', slotKey: 's1.slot', options: [{ id: 'b' }, { id: 'e' }, { id: 'a' }, { id: 'd' }, { id: 'c' }] },
          { key: 's1.reminders', kind: 'radio', label: 'Reminder plan', options: [
            o('both', '24 hours and 2 hours before'),
            o('day', '24 hours before only'),
            o('two', '2 hours before only'),
            o('none', 'None. The confirmation is enough'),
          ] },
        ],
      },
      {
        title: 'Keep the right notes',
        prompt: 'Keep what the appointment needs. Choose the notes to keep on the record.',
        fields: [{ key: 's1.notes', kind: 'multi', options: [
          o('purpose', 'Purpose: operations review for Cedar Peak stores'),
          o('zone', 'Kemi is in New York and is free 08:30 to 11:00 her time'),
          o('attendee', 'Mr Sani Abdullahi must join to discuss costs'),
          o('private', 'Kemi is dealing with a family matter this month'),
        ] }],
      },
    ],
  },

  // ------------------------------------------------------------ Stage 2
  {
    n: 2,
    title: 'Reschedule an online consultation',
    short: 'Reschedule',
    clock: { day: 3, time: '10:00' },
    laterClock: { day: 3, time: '12:00' },
    days: [2, 3, 4, 5, 6],
    startDay: 5,
    slotKey: 's2.slot',
    window: { days: [5], from: '14:00', to: '17:00' },
    attendee: { name: 'Mr Yusuf Garba', busy: [{ day: 5, from: '13:00', to: '14:45' }] },
    request: {
      kind: 'chat',
      from: 'Mrs Hauwa Danjuma',
      role: 'Online consultation, first Wednesday of a monthly series',
      messages: [
        'Good morning. Please can I move my Wednesday 11:00 consultation to Thursday, after 2pm?',
        'This month only. My usual first Wednesday is fine from next month.',
      ],
      time: 'Tuesday 3 November, 09:55',
    },
    info: [
      { kind: 'facts', title: 'Booking details', items: [
        'Wednesday 4 November, 11:00 to 11:30, online.',
        'First Wednesday of a monthly series.',
        'Required attendee: Mr Yusuf Garba. He is busy until 14:45 on Thursday.',
      ] },
      { kind: 'waitlist', title: 'Waiting list for Wednesday 11:00', rows: [
        ['1', 'Mr Bashir Lawal', 'No contact permission'],
        ['2', 'Mrs Chidinma Eze', 'Afternoons only'],
        ['3', 'Mr Femi Adeyemi', 'Free on Wednesday at 11:00'],
      ] },
    ],
    tasks: [
      {
        title: 'Choose a replacement slot',
        prompt: 'Tap a start time on Thursday 5 November, after 14:00.',
        fields: [{ key: 's2.slot', kind: 'slot' }],
      },
      {
        title: 'Update the booking',
        prompt: 'How do you record the move?',
        fields: [{ key: 's2.record', kind: 'radio', options: [
          o('edit', 'Edit the same booking and change its date and time'),
          o('new', 'Create a new booking and leave the old one in place'),
          o('recreate', 'Cancel the old booking and create a new one'),
        ] }],
      },
      {
        title: 'Release the Wednesday slot',
        prompt: 'What happens to Wednesday 4 November at 11:00?',
        fields: [{ key: 's2.release', kind: 'radio', options: [
          o('release', 'Release it now and offer it to the waiting list'),
          o('hold', 'Keep it blocked until Mrs Danjuma confirms the new time'),
          o('series', 'Delete the whole monthly series'),
          o('tentative', 'Leave it in place and mark it tentative'),
        ] }],
      },
      {
        title: 'Set the recurrence',
        prompt: 'Mrs Danjuma wants this month only. What does the change apply to?',
        fields: [{ key: 's2.recur', kind: 'radio', options: [
          o('one', 'This occurrence only'),
          o('all', 'All events in the series'),
          o('following', 'This and following events'),
        ] }],
      },
      {
        title: 'Send the change notice',
        prompt: 'Choose the notice to send to Mrs Danjuma. Times come from your slot.',
        fields: [{ key: 's2.notice', kind: 'template', channel: 'chat', to: 'Mrs Hauwa Danjuma', slotKey: 's2.slot', options: [
          { id: 'c' }, { id: 'a' }, { id: 'd' }, { id: 'b' },
        ] }],
      },
      {
        title: 'Replace the reminders',
        prompt: 'Two reminders for Wednesday are live: Tuesday 11:00 and Wednesday 09:00. Choose every action you take.',
        fields: [{ key: 's2.reminders', kind: 'multi', options: [
          o('cancel24', 'Cancel the Tuesday 11:00 reminder'),
          o('cancel2', 'Cancel the Wednesday 09:00 reminder'),
          o('new24', 'Set a reminder 24 hours before the new time'),
          o('new2', 'Set a reminder 2 hours before the new time'),
          o('keep', 'Leave the old reminders running as a double check'),
          o('morning', 'Set one reminder on Thursday morning'),
        ] }],
      },
      {
        title: 'Offer the released slot',
        prompt: 'Apply the waiting list to Wednesday 11:00. Choose who gets the offer and when the reply is due.',
        fields: [
          { key: 's2.wl.person', kind: 'radio', label: 'Offer to', options: [
            o('bashir', 'Mr Bashir Lawal'), o('chidinma', 'Mrs Chidinma Eze'), o('femi', 'Mr Femi Adeyemi'),
          ] },
          { key: 's2.wl.deadline', kind: 'select', label: 'Reply due by (Tuesday)', options: [
            o('10:15', '10:15'), o('10:30', '10:30'), o('10:45', '10:45'), o('11:15', '11:15'), o('11:30', '11:30'), o('12:00', '12:00'),
          ] },
        ],
      },
      {
        title: 'Follow up on the notice',
        lockedUntil: 7,
        lockedText: 'This task opens when tasks 1 to 7 are answered. The clock then moves forward 2 hours.',
        prompt: 'It is now 12:00. The notice shows Delivered, with no reply after 2 hours. The Wednesday slot is still held for Mrs Danjuma.',
        fields: [{ key: 's2.followup', kind: 'radio', options: [
          o('call', 'Phone her'),
          o('resend', 'Send the same notice again'),
          o('silence', 'Treat the silence as agreement'),
        ] }],
      },
    ],
  },

  // ------------------------------------------------------------ Stage 3
  {
    n: 3,
    title: 'Repair a conflict',
    short: 'Repair',
    clock: { day: 5, time: '10:00' },
    days: [6],
    startDay: 6,
    slotKey: 's3.slot',
    window: { days: [6], from: '09:00', to: '17:00' },
    rooms: [
      { id: 'r1', name: 'Room 1', seats: 8, blocks: [
        { day: 6, from: '09:00', to: '12:30', kind: 'booked', label: 'Booked until 12:30' },
        { day: 6, from: '12:30', to: '12:45', kind: 'reset', label: 'Reset' },
      ] },
      { id: 'r2', name: 'Room 2', seats: 4, blocks: [] },
    ],
    roomFreeFrom: 765,
    request: {
      kind: 'email',
      from: 'Front office, Site B',
      role: 'Victoria Island',
      subject: 'Harbour Mills review on Friday',
      time: 'Thursday 5 November, 09:40',
      body: [
        'Harbour Mills Ltd. have asked for their strategy review at Site B at 11:30 on Friday. Six people will attend.',
        'Please confirm a time and a room.',
      ],
    },
    info: [
      { kind: 'facts', title: 'Facts for Friday 6 November', items: [
        'Damilola finishes at Site A (Ikoyi) at 11:15.',
        'Travel to Site B (Victoria Island) takes 40 minutes, plus 10 minutes for access. He is ready at 12:05.',
        'Room 1 seats 8. It is booked until 12:30 and needs 15 minutes to reset.',
        'Room 2 seats 4. It is free all day.',
        'Protected time runs from 13:30 to 14:30.',
        'The client asked for 11:30. The team prefers mornings and prefers Room 1 for its screen.',
      ] },
    ],
    tasks: [
      {
        title: 'Find the conflicts with 11:30',
        prompt: 'Choose every conflict with the proposed 11:30 start.',
        fields: [{ key: 's3.conflicts', kind: 'multi', options: [
          o('travel', 'Travel and transition time'),
          o('room', 'Room booking'),
          o('protected', 'Protected time'),
          o('attendee', 'Attendee clash'),
          o('notice', 'Notice period'),
        ] }],
      },
      {
        title: 'Sort hard constraints from preferences',
        prompt: 'A hard constraint cannot be broken. A preference can give way. Sort each item.',
        fields: [{ key: 's3.classify', kind: 'classify', options: [
          o('travel', 'Travel and access time between Site A and Site B'),
          o('room1', 'Room 1 is booked, then needs 15 minutes to reset'),
          o('capacity', 'Six people need a room that seats at least six'),
          o('protected', 'Protected time from 13:30 to 14:30'),
          o('client', 'The client asked for 11:30'),
          o('mornings', 'The team prefers mornings'),
          o('screen', 'The team prefers Room 1 for its screen'),
        ], choices: [o('hard', 'Hard'), o('pref', 'Preference')] }],
      },
      {
        title: 'Choose the slot and the room',
        prompt: 'Tap the best start time on the calendar, then choose the room.',
        fields: [
          { key: 's3.slot', kind: 'slot' },
          { key: 's3.room', kind: 'radio', label: 'Room', options: [
            o('r1', 'Room 1', 'Seats 8'), o('r2', 'Room 2', 'Seats 4'),
          ] },
        ],
      },
      {
        title: 'Complete the decision record',
        prompt: 'Record the decision so anyone can follow it later.',
        fields: [
          { key: 's3.rec.affected', kind: 'select', label: 'Affected appointment', options: [
            o('review', 'Harbour Mills strategy review, Friday 11:30'),
            o('sitea', 'Site A meeting, Friday 10:00'),
            o('protected', 'Protected time, Friday 13:30'),
          ] },
          { key: 's3.rec.constraints', kind: 'multi', label: 'Constraints that decided it', options: [
            o('travel', 'Travel and access time'),
            o('room', 'Room 1 booking and reset'),
            o('capacity', 'Room capacity for six'),
            o('protected', 'Protected time'),
            o('mornings', 'The team prefers mornings'),
          ] },
          { key: 's3.rec.resolution', kind: 'select', label: 'Resolution', options: [
            o('moved', 'Moved to a time and room that meet every hard constraint'),
            o('kept', 'Kept 11:30 and asked the executive to hurry'),
            o('room2', 'Kept 11:30 and used Room 2'),
            o('cancelled', 'Cancelled the meeting'),
          ] },
          { key: 's3.rec.contacted', kind: 'multi', label: 'People contacted', options: [
            o('client', 'Harbour Mills lead contact'),
            o('exec', 'Damilola Akinwale'),
            o('desk', 'Site B room booking desk'),
            o('all', 'All six attendees, one by one'),
            o('sani', 'Mr Sani Abdullahi'),
          ] },
          { key: 's3.rec.status', kind: 'select', label: 'Replacement status', options: [
            o('booked', 'Replacement booked, client informed'),
            o('proposed', 'Replacement proposed, waiting for the client'),
            o('none', 'No replacement booked'),
          ] },
        ],
      },
      {
        title: 'Diagnose a booking page with no times',
        prompt: 'The public booking page shows no times for Monday 9 November. Read the evidence and choose the cause.',
        evidence: {
          title: 'Booking page for Monday 9 November',
          banner: 'No times available',
          rows: [
            ['Appointments booked', '4 of 4'],
            ['Working hours', '09:00 to 17:00'],
            ['Notice period', '24 hours, met'],
            ['Booking window', 'Open'],
            ['Time steps', '15 minutes'],
            ['Duration', '30 minutes'],
            ['Attendees', 'Free'],
            ['Holidays', 'None'],
          ],
        },
        fields: [{ key: 's3.diag', kind: 'radio', options: [
          o('limit', 'The daily limit of 4 client appointments is reached'),
          o('hours', 'Working hours are not set for Monday'),
          o('notice', 'The notice period is too long'),
          o('holiday', 'A holiday falls on that date'),
          o('attendee', 'A required attendee is unavailable'),
          o('steps', 'The time steps are set wrongly'),
        ] }],
      },
    ],
  },

  // ------------------------------------------------------------ Stage 4
  {
    n: 4,
    title: 'Apply the policy',
    short: 'Policy',
    clock: { day: 6, time: '15:30' },
    days: [9, 10, 11, 12, 13],
    startDay: 9,
    slotKey: 's4.slot',
    window: { days: [9, 10, 11, 12], from: '09:00', to: '17:00' },
    request: {
      kind: 'note',
      from: 'Reception',
      role: 'Friday 6 November, 15:30',
      body: [
        'Mr Tobenna Eze has an online consultation from 15:15 to 15:45. He has just joined, 15 minutes late.',
        'The next appointment starts at 16:00.',
      ],
    },
    info: [
      { kind: 'facts', title: 'Facts', items: [
        'Grace period: 10 minutes. Minimum service: 20 minutes.',
        'He joined at 15:30. That leaves 15 minutes of the booked time.',
        'Rebook within 5 working days: Monday 9 to Friday 13 November.',
        'Mr Eze is available Monday to Thursday, at any time.',
      ] },
    ],
    tasks: [
      {
        title: 'Choose the outcome',
        prompt: 'Apply the late arrival policy.',
        fields: [{ key: 's4.outcome', kind: 'radio', options: [
          o('rebook', 'Rebook within 5 working days'),
          o('serve', 'Serve the 15 minutes that remain'),
          o('buffer', 'Run into the buffer so he gets 20 minutes'),
          o('delay', 'Delay the 16:00 appointment'),
          o('noshow', 'Mark it as a no show'),
        ] }],
      },
      {
        title: 'Protect the next appointment',
        prompt: 'Choose everything that stays unchanged.',
        fields: [{ key: 's4.protect', kind: 'multi', options: [
          o('start', 'The 16:00 appointment keeps its start time'),
          o('buffer', 'The buffer before it stays free'),
          o('after', 'The buffer after it stays in place'),
          o('extend', 'Mr Eze’s session is extended to 16:00'),
          o('late', 'The 16:00 appointment starts 15 minutes late'),
        ] }],
      },
      {
        title: 'Choose the rebooking slot',
        prompt: 'Tap the best start time next week. Mr Eze is available Monday to Thursday.',
        fields: [{ key: 's4.slot', kind: 'slot' }],
      },
      {
        title: 'Notify Mr Eze',
        prompt: 'Choose the notice to send. Times come from your slot.',
        fields: [{ key: 's4.notice', kind: 'template', channel: 'email', to: 'Mr Tobenna Eze', subject: 'Your consultation', slotKey: 's4.slot', options: [
          { id: 'd' }, { id: 'b' }, { id: 'a' }, { id: 'e' }, { id: 'c' },
        ] }],
      },
      {
        title: 'Set the status',
        prompt: 'What status do you record for the 15:15 appointment?',
        fields: [{ key: 's4.status', kind: 'radio', options: [
          o('late_rebooked', 'Late arrival, rebooked'),
          o('rebooked', 'Rebooked'),
          o('noshow', 'No show'),
          o('completed', 'Completed'),
        ] }],
      },
      {
        title: 'Set reminders for the new slot',
        prompt: 'What reminders go with the rebooked appointment?',
        fields: [{ key: 's4.reminders', kind: 'radio', options: [
          o('new', '24 hours and 2 hours before the new time'),
          o('old', 'Keep the reminders from today’s appointment'),
          o('none', 'None. He already knows the new time'),
        ] }],
      },
      {
        title: 'Run the final checks',
        prompt: 'Look over your whole week. For each check, say whether a problem remains in the calendar as you leave it.',
        fields: [{ key: 's4.checks', kind: 'checks', choices: [o('yes', 'Problem remains'), o('no', 'No problem')], options: [
          o('conflicts', 'Overlaps or buffer breaches'),
          o('resources', 'Rooms or required attendees double held or unavailable'),
          o('reminders', 'Old reminders still live'),
          o('records', 'Duplicate or mismatched records'),
        ] }],
      },
    ],
  },
];

// Message wording. Tokens are filled from the learner's slot.
// {day} {start} {end} are WAT. {nyStart} {nyEnd} are New York time.
export const TEMPLATES = {
  's1.confirm': {
    a: 'Dear Kemi, your consultation with Damilola Akinwale is confirmed for {day}, {start} to {end} WAT ({nyStart} to {nyEnd} New York time). Mr Sani Abdullahi will join. The video link is in your invitation. Please reply to confirm you have received it.',
    b: 'Dear Kemi, your consultation with Damilola Akinwale is confirmed for {day}, {start} to {end}. Mr Sani Abdullahi will join. The video link is in your invitation. Please reply to confirm you have received it.',
    c: 'Dear Kemi, your consultation with Damilola Akinwale is confirmed for {day}, {start} to {end} WAT ({nyStart} to {nyEnd} New York time). Mr Sani Abdullahi will join.',
    d: 'Dear Kemi, your consultation with Damilola Akinwale is confirmed for {day}, {nyStart} to {nyEnd} WAT ({start} to {end} New York time). Mr Sani Abdullahi will join. The video link is in your invitation. Please reply to confirm you have received it.',
    e: 'Dear Kemi, your consultation is confirmed for {day}, {start} to {end} WAT ({nyStart} to {nyEnd} New York time). Damilola is free then because the finance review ended early, and Mr Sani Abdullahi is busy until 16:15 with the audit. The link is in your invitation.',
  },
  's2.notice': {
    a: 'Good morning Mrs Danjuma. Your consultation has moved from Wednesday 4 November, 11:00 to {day}, {start} to {end} WAT. Your first Wednesday slot stays the same from next month. Please reply to confirm the new time.',
    b: 'Good morning Mrs Danjuma. Your consultation has moved from Wednesday 4 November, 11:00 to {day}, {start} to {end} WAT. Your first Wednesday slot stays the same from next month.',
    c: 'Good morning Mrs Danjuma. Your consultation is now on Wednesday 4 November, {start} to {end} WAT. Please reply to confirm the new time.',
    d: 'Good morning Mrs Danjuma. We moved your consultation to {day}, {start} to {end} WAT because Mr Yusuf Garba is busy with another client until 14:45. Please reply to confirm the new time.',
  },
  's4.notice': {
    a: 'Dear Mr Eze, you joined at 15:30, which is 15 minutes after your 15:15 start. Our grace period is 10 minutes and a session needs at least 20 minutes, so we have rebooked you for {day}, {start} to {end} WAT. Please reply to confirm. Reminders will follow 24 hours and 2 hours before.',
    b: 'Dear Mr Eze, you joined at 15:30, which is 15 minutes after your 15:15 start. Our grace period is 10 minutes and a session needs at least 20 minutes, so we have rebooked you for {day}, {start} to {end} WAT.',
    c: 'Dear Mr Eze, you joined at 15:30, which is 15 minutes after your 15:15 start. We have rebooked you for {day}, {start} to {end}. Please reply to confirm.',
    d: 'Dear Mr Eze, you did not attend your 15:15 consultation and it is marked as a no show. Please book again online.',
    e: 'Dear Mr Eze, we have rebooked you for {day}, {start} to {end} WAT because Mr Ibrahim Yusuf was already waiting for the 16:00 slot. Please reply to confirm.',
  },
};
