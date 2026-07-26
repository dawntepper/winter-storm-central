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
        heading: 'About Tornado Warnings',
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
        heading: 'About Flash Flood Warnings',
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
        heading: 'Safety during a Flash Flood Warning',
        paragraphs: [
          'Avoid flood waters and underpasses. Just six inches of moving water can knock a person down; a foot of water can float many vehicles. Turn around — never drive through flooded roadways.',
        ],
      },
    ],
    faq: [
      {
        q: 'What does a Flash Flood Warning mean?',
        a: 'It means flash flooding is occurring or imminent. Move to higher ground and avoid flooded roads immediately.',
      },
      {
        q: 'Is it safe to drive through a flooded road if I know the area?',
        a: 'No. Turn around — never drive through flooded roadways.',
      },
      {
        q: 'Where do Flash Flood Warnings come from?',
        a: 'Official Flash Flood Warnings are issued by the National Weather Service. StormTracking organizes and displays them for monitoring.',
      },
      {
        q: 'How often is this page updated?',
        a: 'StormTracking refreshes National Weather Service alert data on a regular cadence (faster when urgent warnings are active).',
      },
    ],
    source: SHARED_SOURCE,
  },
  'flood-warning': {
    sections: [
      {
        heading: 'About Flood Warnings',
        paragraphs: [
          'A Flood Warning is issued when flooding is occurring, imminent, or expected within the warned area. Take protective action and follow instructions from local officials.',
          'Flood Warnings come from the National Weather Service. StormTracking displays active warnings with live status, radar, and links to affected state alert pages.',
        ],
      },
      {
        heading: 'Flood Watch vs. Flood Warning',
        paragraphs: [
          'A Flood Watch means conditions are favorable for flooding. Stay informed and be ready to act.',
          'A Flood Warning means flooding is occurring, imminent, or expected and action may be necessary in the warned area.',
        ],
      },
      {
        heading: 'Safety during a Flood Warning',
        paragraphs: [
          'Avoid flooded roads. Never drive through water covering a roadway — turn around instead.',
          'Move to higher ground if flooding threatens your location. Follow evacuation or emergency instructions from local officials and continue monitoring official National Weather Service alerts.',
        ],
      },
    ],
    faq: [
      {
        q: 'What does a Flood Warning mean?',
        a: 'A Flood Warning means flooding is occurring, imminent, or expected in the warned area. Follow local guidance and avoid flood waters.',
      },
      {
        q: 'What is the difference between a Flood Watch and Flood Warning?',
        a: 'A Flood Watch means flooding is possible. A Flood Warning means flooding is occurring, imminent, or expected and protective action may be needed.',
      },
      {
        q: 'Where do these Flood Warnings come from?',
        a: 'Official Flood Warnings are issued by the National Weather Service. StormTracking organizes and displays them for easier monitoring.',
      },
      {
        q: 'How often is this page updated?',
        a: 'StormTracking refreshes National Weather Service alert data on a regular cadence (faster when urgent warnings are active). Counts and affected states update as the live feed changes.',
      },
    ],
    source: SHARED_SOURCE,
  },
  'flood-watch': {
    sections: [
      {
        heading: 'About Flood Watches',
        paragraphs: [
          'A Flood Watch means conditions are favorable for flooding. Stay informed and be ready to move to higher ground if flooding develops.',
        ],
      },
      {
        heading: 'Flood Watch vs. Flood Warning',
        paragraphs: [
          'A Flood Watch means flooding is possible. A Flood Warning means flooding is occurring, imminent, or expected and action may be necessary.',
        ],
      },
      {
        heading: 'Safety during a Flood Watch',
        paragraphs: [
          'Review your plan for moving to higher ground. Avoid unnecessary travel through low-lying areas, and monitor National Weather Service alerts for upgrades to warnings.',
        ],
      },
    ],
    faq: [
      {
        q: 'Does a Flood Watch mean flooding is happening now?',
        a: 'No. A watch means flooding is possible. Follow Flood or Flash Flood Warnings if they are issued for your area.',
      },
      {
        q: 'Where do Flood Watches come from?',
        a: 'Official Flood Watches are issued by the National Weather Service. StormTracking organizes and displays them for monitoring.',
      },
      {
        q: 'How often is this page updated?',
        a: 'StormTracking refreshes National Weather Service alert data on a regular cadence. This page updates when the live feed changes.',
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
  'flash-flood-watch': {
    sections: [
      {
        heading: 'What is a Flash Flood Watch?',
        paragraphs: [
          'A Flash Flood Watch means conditions are favorable for flash flooding in and near the watch area. Stay informed and be ready to move to higher ground if a warning is issued.',
        ],
      },
      {
        heading: 'Flash Flood Watch vs. Flash Flood Warning',
        paragraphs: [
          'A watch means flash flooding is possible. A Flash Flood Warning means life-threatening flash flooding is occurring or imminent — move to higher ground immediately.',
        ],
      },
      {
        heading: 'Safety during a Flash Flood Watch',
        paragraphs: [
          'Avoid unnecessary travel through low-lying areas and never drive into flooded roadways. Monitor National Weather Service alerts for upgrades to warnings.',
        ],
      },
    ],
    faq: [
      {
        q: 'Does a Flash Flood Watch mean flooding is happening now?',
        a: 'No. A watch means flash flooding is possible. Take action immediately if a Flash Flood Warning is issued for your area.',
      },
      {
        q: 'Where do Flash Flood Watches come from?',
        a: 'Official Flash Flood Watches are issued by the National Weather Service. StormTracking organizes and displays them for monitoring.',
      },
    ],
    source: SHARED_SOURCE,
  },
  'blizzard-warning': {
    sections: [
      {
        heading: 'What is a Blizzard Warning?',
        paragraphs: [
          'A Blizzard Warning means blizzard conditions are occurring or expected. Expect falling or blowing snow with strong winds that reduce visibility to a quarter mile or less for an extended period.',
        ],
      },
      {
        heading: 'Safety during a Blizzard Warning',
        paragraphs: [
          'Avoid travel if possible. If you must go out, dress in layers, carry emergency supplies, and tell someone your route. Stay indoors when conditions deteriorate.',
        ],
      },
      {
        heading: 'How StormTracking displays Blizzard Warnings',
        paragraphs: [
          'This page filters live National Weather Service alerts to Blizzard Warnings and links related winter hazard pages for broader situational awareness.',
        ],
      },
    ],
    faq: [
      {
        q: 'What is the difference between a Blizzard Warning and a Winter Storm Warning?',
        a: 'A Blizzard Warning focuses on dangerous winds and severely reduced visibility in snow. A Winter Storm Warning covers significant snow, ice, or mixed precipitation that can disrupt travel and services.',
      },
    ],
    source: SHARED_SOURCE,
  },
  'winter-storm-warning': {
    sections: [
      {
        heading: 'What is a Winter Storm Warning?',
        paragraphs: [
          'A Winter Storm Warning means a significant winter storm is occurring or expected. Hazardous snow, ice, or mixed precipitation may disrupt travel and daily activities.',
        ],
      },
      {
        heading: 'Safety during a Winter Storm Warning',
        paragraphs: [
          'Limit travel, prepare for power outages, and keep pets and vulnerable household members indoors when conditions are dangerous. Continue monitoring official National Weather Service alerts.',
        ],
      },
    ],
    faq: [
      {
        q: 'Where do Winter Storm Warnings come from?',
        a: 'Official Winter Storm Warnings are issued by the National Weather Service. StormTracking organizes and displays them for monitoring.',
      },
    ],
    source: SHARED_SOURCE,
  },
  'ice-storm-warning': {
    sections: [
      {
        heading: 'What is an Ice Storm Warning?',
        paragraphs: [
          'An Ice Storm Warning means significant ice accumulation is occurring or expected. Ice can make roads and walkways extremely hazardous and weigh down trees and power lines.',
        ],
      },
      {
        heading: 'Safety during an Ice Storm Warning',
        paragraphs: [
          'Avoid travel when possible. Watch for downed power lines and falling tree limbs. Prepare for potential power outages and slippery surfaces around your home.',
        ],
      },
    ],
    faq: [
      {
        q: 'Why are ice storms so dangerous?',
        a: 'Even a thin glaze of ice can cause widespread traffic accidents, while heavier accumulations can snap trees and bring down power lines across large areas.',
      },
    ],
    source: SHARED_SOURCE,
  },
  'high-wind-warning': {
    sections: [
      {
        heading: 'What is a High Wind Warning?',
        paragraphs: [
          'A High Wind Warning means sustained winds or frequent gusts meeting local high-wind criteria are occurring or expected. Damaging winds can down trees and power lines and make driving hazardous, especially for high-profile vehicles.',
        ],
      },
      {
        heading: 'Safety during a High Wind Warning',
        paragraphs: [
          'Secure outdoor objects, avoid unnecessary travel if possible, and stay away from downed power lines. High-profile vehicles are especially vulnerable to strong crosswinds.',
        ],
      },
    ],
    faq: [
      {
        q: 'Is a High Wind Warning the same as a Severe Thunderstorm Warning?',
        a: 'No. Severe Thunderstorm Warnings are typically tied to thunderstorms and may include large hail or damaging winds. High Wind Warnings cover non-thunderstorm wind hazards that meet warning criteria.',
      },
    ],
    source: SHARED_SOURCE,
  },
  'excessive-heat-warning': {
    sections: [
      {
        heading: 'What is an Extreme Heat Warning?',
        paragraphs: [
          'An Extreme Heat Warning (also issued by some National Weather Service offices as an Excessive Heat Warning) means a dangerous heat event is occurring or expected. High temperatures and humidity can create a significant risk of heat-related illness.',
        ],
      },
      {
        heading: 'Safety during an Extreme Heat Warning',
        paragraphs: [
          'Limit outdoor activity during the hottest hours, stay hydrated, and check on vulnerable neighbors. Never leave children or pets in a vehicle.',
        ],
      },
    ],
    faq: [
      {
        q: 'Where do Extreme Heat Warnings come from?',
        a: 'Official Extreme Heat Warnings and Excessive Heat Warnings are issued by the National Weather Service. StormTracking organizes and displays them for monitoring.',
      },
    ],
    source: SHARED_SOURCE,
  },
  'red-flag-warning': {
    sections: [
      {
        heading: 'What is a Red Flag Warning?',
        paragraphs: [
          'A Red Flag Warning means critical fire weather conditions are occurring or expected. Warm temperatures, low humidity, and strong winds can cause wildfires to start easily and spread rapidly.',
        ],
      },
      {
        heading: 'Safety during a Red Flag Warning',
        paragraphs: [
          'Avoid outdoor burning and activities that could spark a fire. Follow local fire restrictions and be ready to evacuate if you live in a wildfire-prone area.',
        ],
      },
    ],
    faq: [
      {
        q: 'Does a Red Flag Warning mean a wildfire is happening?',
        a: 'Not necessarily. It means weather conditions are favorable for rapid fire growth. Always follow local fire and emergency guidance.',
      },
    ],
    source: SHARED_SOURCE,
  },
  'storm-surge-warning': {
    sections: [
      {
        heading: 'What is a Storm Surge Warning?',
        paragraphs: [
          'A Storm Surge Warning means there is a danger of life-threatening inundation from rising water moving inland from the shoreline, generally within 36 hours. Follow evacuation orders from local officials.',
        ],
      },
      {
        heading: 'Safety during a Storm Surge Warning',
        paragraphs: [
          'Move away from the coast and low-lying areas if directed. Storm surge is often the greatest threat to life from a landfalling tropical cyclone.',
        ],
      },
    ],
    faq: [
      {
        q: 'Is storm surge the same as flooding from heavy rain?',
        a: 'No. Storm surge is ocean water pushed ashore by a storm. Rainfall flooding is a separate hazard that can also occur during tropical systems.',
      },
    ],
    source: SHARED_SOURCE,
  },
  'extreme-wind-warning': {
    sections: [
      {
        heading: 'What is an Extreme Wind Warning?',
        paragraphs: [
          'An Extreme Wind Warning means extreme tropical-cyclone winds are occurring or expected soon, typically associated with the eyewall of a major hurricane. Take shelter immediately in a sturdy structure.',
        ],
      },
      {
        heading: 'Safety during an Extreme Wind Warning',
        paragraphs: [
          'Get to a safe interior location away from windows. Extreme winds can cause catastrophic damage; do not attempt to travel once this warning is in effect for your area.',
        ],
      },
    ],
    faq: [
      {
        q: 'How is an Extreme Wind Warning different from a Hurricane Warning?',
        a: 'A Hurricane Warning covers a broader area and longer lead time. An Extreme Wind Warning is a short-fuse alert for the most dangerous winds near the storm center.',
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
