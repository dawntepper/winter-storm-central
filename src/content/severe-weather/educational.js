/**
 * Evergreen educational content for severe-weather hazard pages.
 * Keep copy accurate and hazard-specific. Warnings originate from the NWS.
 */

const SHARED_SOURCE = {
  heading: 'Sources and updates',
  paragraphs: [
    'Official alerts are provided by the National Weather Service. StormTracking organizes and displays this information for easier monitoring.',
    'StormTracking does not issue warnings. Always follow instructions from local officials and the National Weather Service.',
  ],
};

const CONTENT = {
  'tornado-warning': {
    sections: [
      {
        heading: 'What is a Tornado Warning?',
        paragraphs: [
          'A Tornado Warning means a tornado has been sighted or indicated by weather radar. Take protective action immediately in the warned area.',
          'Tornado Warnings are issued by National Weather Service forecast offices and typically cover portions of one or more counties for a short period of time.',
        ],
      },
      {
        heading: 'Tornado Warning vs. Tornado Watch',
        paragraphs: [
          'A Tornado Watch means conditions are favorable for tornadoes. Stay aware and ready to act.',
          'A Tornado Warning means a tornado is occurring or imminent for the warned location. Move to a sturdy shelter right away.',
        ],
      },
      {
        heading: 'What to do during a Tornado Warning',
        paragraphs: [
          'Go to an interior room on the lowest floor of a sturdy building, away from windows. Mobile homes and vehicles are not safe shelters.',
          'If you are outdoors with no sturdy shelter nearby, lie flat in a low spot and protect your head. Continue monitoring official alerts until the warning expires or is cancelled.',
        ],
      },
      {
        heading: 'How long do Tornado Warnings last?',
        paragraphs: [
          'Most Tornado Warnings last from about 30 to 60 minutes, but duration varies. Always check the expiration time on the specific warning covering your location.',
        ],
      },
      {
        heading: 'How StormTracking displays Tornado Warnings',
        paragraphs: [
          'This page filters live National Weather Service alerts to Tornado Warnings only, shows affected states, and overlays matching alerts on live radar.',
          'Alert counts and locations update as the NWS feed refreshes. The Weather Brief summarizes structured alert data and never replaces official warning text.',
        ],
      },
    ],
    faq: [
      {
        q: 'Does StormTracking issue Tornado Warnings?',
        a: 'No. Tornado Warnings come from the National Weather Service. StormTracking displays and organizes that information.',
      },
      {
        q: 'What if there are no active Tornado Warnings?',
        a: 'This page remains available with radar, related severe-weather links, and safety information. It updates when new warnings are issued.',
      },
      {
        q: 'Should I wait for a Tornado Warning before preparing?',
        a: 'If a Tornado Watch is in effect, review your shelter plan early. When a warning is issued for your area, take action immediately.',
      },
    ],
    source: SHARED_SOURCE,
  },
  'tornado-watch': {
    sections: [
      {
        heading: 'What is a Tornado Watch?',
        paragraphs: [
          'A Tornado Watch means conditions are favorable for tornadoes in and near the watch area. Stay informed and ready to move to shelter if a warning is issued.',
        ],
      },
      {
        heading: 'Tornado Watch vs. Tornado Warning',
        paragraphs: [
          'A watch covers a broader area and longer time window. A warning means a tornado is occurring or imminent for a specific location — act immediately.',
        ],
      },
      {
        heading: 'What to do during a Tornado Watch',
        paragraphs: [
          'Review your shelter plan, charge phones, and monitor radar and official alerts. Be ready to act quickly if a Tornado Warning is issued for your county.',
        ],
      },
      {
        heading: 'How StormTracking displays Tornado Watches',
        paragraphs: [
          'This page shows active Tornado Watches from the National Weather Service with affected states, related warnings, and live radar filtered to watch alerts.',
        ],
      },
    ],
    faq: [
      {
        q: 'Can tornadoes form outside a Tornado Watch?',
        a: 'Yes. Watches highlight elevated risk, but warnings can occur without a preceding watch. Stay alert to changing conditions.',
      },
      {
        q: 'Does a Tornado Watch mean a tornado is on the ground?',
        a: 'No. A watch means tornadoes are possible. A Tornado Warning means one is occurring or imminent.',
      },
    ],
    source: SHARED_SOURCE,
  },
  'severe-thunderstorm-warning': {
    sections: [
      {
        heading: 'What is a Severe Thunderstorm Warning?',
        paragraphs: [
          'A Severe Thunderstorm Warning means a thunderstorm with damaging winds, large hail, or both is occurring or imminent. Take shelter in a sturdy building.',
        ],
      },
      {
        heading: 'Severe Thunderstorm Warning vs. Watch',
        paragraphs: [
          'A Severe Thunderstorm Watch means organized severe storms are possible. A warning means a severe storm is affecting or about to affect the warned area.',
        ],
      },
      {
        heading: 'What to do during a Severe Thunderstorm Warning',
        paragraphs: [
          'Move indoors away from windows. Secure loose outdoor objects beforehand when possible. Continue monitoring alerts — some severe storms can produce tornadoes with little notice.',
        ],
      },
      {
        heading: 'How StormTracking displays Severe Thunderstorm Warnings',
        paragraphs: [
          'This page filters the live NWS feed to Severe Thunderstorm Warnings only and pairs them with radar, state links, and related severe-weather pages.',
        ],
      },
    ],
    faq: [
      {
        q: 'Can a severe thunderstorm produce a tornado?',
        a: 'Yes. If a Tornado Warning is issued, follow tornado safety guidance immediately.',
      },
    ],
    source: SHARED_SOURCE,
  },
  'severe-thunderstorm-watch': {
    sections: [
      {
        heading: 'What is a Severe Thunderstorm Watch?',
        paragraphs: [
          'A Severe Thunderstorm Watch means conditions favor organized severe thunderstorms capable of damaging winds and large hail.',
        ],
      },
      {
        heading: 'Watch vs. Warning',
        paragraphs: [
          'A watch means be prepared. A Severe Thunderstorm Warning means take protective action for the warned location.',
        ],
      },
      {
        heading: 'How StormTracking displays Severe Thunderstorm Watches',
        paragraphs: [
          'Active watches from the National Weather Service appear here with affected states, related tornado and flash-flood pages, and live radar.',
        ],
      },
    ],
    faq: [
      {
        q: 'Should I cancel outdoor plans during a watch?',
        a: 'Have a shelter plan ready and monitor warnings closely. Conditions can escalate quickly.',
      },
    ],
    source: SHARED_SOURCE,
  },
  'flash-flood-warning': {
    sections: [
      {
        heading: 'What is a Flash Flood Warning?',
        paragraphs: [
          'A Flash Flood Warning means flash flooding is occurring or imminent. Move to higher ground immediately — do not drive through flooded roadways.',
        ],
      },
      {
        heading: 'Flash Flood Warning vs. Flood Watch',
        paragraphs: [
          'A Flood Watch means flooding is possible. A Flash Flood Warning means life-threatening flooding is happening or about to happen in the warned area.',
        ],
      },
      {
        heading: 'What to do during a Flash Flood Warning',
        paragraphs: [
          'Avoid flood waters and underpasses. Just six inches of moving water can knock a person down; a foot of water can float many vehicles.',
        ],
      },
    ],
    faq: [
      {
        q: 'Is it safe to drive through a flooded road if I know the area?',
        a: 'No. Turn around — never drive through flooded roadways.',
      },
    ],
    source: SHARED_SOURCE,
  },
  'flood-watch': {
    sections: [
      {
        heading: 'What is a Flood Watch?',
        paragraphs: [
          'A Flood Watch means conditions are favorable for flooding. Stay informed and be ready to move to higher ground if flooding develops.',
        ],
      },
      {
        heading: 'How StormTracking displays Flood Watches',
        paragraphs: [
          'This page lists active Flood Watches from the National Weather Service with radar and links to related flood and severe-weather pages.',
        ],
      },
    ],
    faq: [
      {
        q: 'Does a Flood Watch mean flooding is happening now?',
        a: 'No. A watch means flooding is possible. Follow Flash Flood or Flood Warnings if they are issued for your area.',
      },
    ],
    source: SHARED_SOURCE,
  },
  'hurricane-warning': {
    sections: [
      {
        heading: 'What is a Hurricane Warning?',
        paragraphs: [
          'A Hurricane Warning means hurricane conditions are expected somewhere within the warning area, generally within 36 hours. Complete protective actions.',
        ],
      },
      {
        heading: 'Hurricane Warning vs. Tropical Storm Warning',
        paragraphs: [
          'A Tropical Storm Warning means tropical-storm-force winds are expected. A Hurricane Warning means hurricane-force winds are expected.',
        ],
      },
      {
        heading: 'How StormTracking displays Hurricane Warnings',
        paragraphs: [
          'Active Hurricane Warnings appear with affected states, related tropical pages, and live radar. Managed storm event pages may provide additional storm-specific context when available.',
        ],
      },
    ],
    faq: [
      {
        q: 'Does StormTracking issue hurricane evacuations?',
        a: 'No. Follow local emergency management and National Weather Service guidance for evacuations and timing.',
      },
    ],
    source: SHARED_SOURCE,
  },
  'tropical-storm-warning': {
    sections: [
      {
        heading: 'What is a Tropical Storm Warning?',
        paragraphs: [
          'A Tropical Storm Warning means tropical-storm-force winds are expected somewhere within the warning area, generally within 36 hours.',
        ],
      },
      {
        heading: 'How StormTracking displays Tropical Storm Warnings',
        paragraphs: [
          'This page filters live NWS alerts to Tropical Storm Warnings and links related hurricane and flood pages for broader situational awareness.',
        ],
      },
    ],
    faq: [
      {
        q: 'Can a Tropical Storm Warning upgrade to a Hurricane Warning?',
        a: 'Yes. Continue monitoring official forecasts as the system evolves.',
      },
    ],
    source: SHARED_SOURCE,
  },
};

const DEFAULT_CONTENT = {
  sections: [
    {
      heading: 'About this alert',
      paragraphs: [
        'This page tracks a specific National Weather Service alert type with live status, radar, and safety context.',
      ],
    },
  ],
  faq: [
    {
      q: 'Where do these alerts come from?',
      a: 'Official alerts are issued by the National Weather Service. StormTracking organizes them for monitoring.',
    },
  ],
  source: SHARED_SOURCE,
};

export function getHazardEducationalContent(key) {
  return CONTENT[key] || DEFAULT_CONTENT;
}
