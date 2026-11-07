import type {
  Activity,
  ChoiceOption,
  Curriculum,
  Level,
  Lesson,
  MatchPair,
  MediaRef,
  Unit,
} from './types.js';

/* ------------------------------------------------------------------ *
 * Small builders - keep the curriculum data readable and type-safe.
 * ------------------------------------------------------------------ */

const audio = (
  src: string,
  label: string,
  durationSec = 2.5,
  transcript?: string,
): MediaRef => ({ kind: 'audio', src, label, durationSec, transcript });

const image = (src: string, label: string): MediaRef => ({
  kind: 'image',
  src,
  label,
});

const choice = (
  id: string,
  label: string,
  correct: boolean,
  media?: MediaRef,
): ChoiceOption => ({ id, label, correct, media });

const pair = (id: string, left: MediaRef, right: MediaRef): MatchPair => ({
  id,
  left,
  right,
});

const activity = (
  a: Omit<Activity, 'seconds' | 'difficulty'> &
    Partial<Pick<Activity, 'seconds' | 'difficulty'>>,
): Activity => ({
  seconds: 20,
  difficulty: 1,
  ...a,
});

const lesson = (
  id: string,
  title: string,
  objective: string,
  activities: Activity[],
): Lesson => ({ id, title, objective, activities });

const unit = (
  id: string,
  title: string,
  theme: string,
  icon: string,
  lessons: Lesson[],
): Unit => ({ id, title, theme, icon, lessons });

/* ------------------------------------------------------------------ *
 * Level 1 - Hello World (ages 3-4)
 * Pure oral/aural foundation. No reading required.
 * ------------------------------------------------------------------ */

const level1: Level = {
  id: 'level-1',
  title: 'Hello, World!',
  description: 'First words, greetings and sounds - all through listening.',
  ageBand: '3-4',
  color: '#FF8A65',
  units: [
    unit('u1-1', 'Greetings', 'Say hello to your friends', '👋', [
      lesson('l1-u1-s1', 'Hello!', 'Greet someone and say hello.', [
        activity({
          id: 'a-greet-listen',
          kind: 'listen',
          prompt: 'Listen',
          stimulus: audio('/media/audio/hello', 'Hello', 1.2, 'Hello'),
          expected: 'hello',
          // A listen activity always offers pictures to choose from, so the
          // child can always answer and the lesson can always continue.
          options: [
            choice('wave', 'Wave', true, image('/media/img/wave', 'A waving hand')),
            choice('hand', 'Hand', false, image('/media/img/hand', 'An open hand')),
            choice('foot', 'Foot', false, image('/media/img/foot', 'A foot')),
          ],
          stars: 1,
          skills: ['listening', 'greetings'],
        }),
        activity({
          id: 'a-greet-choose',
          kind: 'choose',
          prompt: 'Tap the wave',
          options: [
            choice('wave', 'Wave', true, image('/media/img/wave', 'A waving hand')),
            choice('hand', 'Hand', false, image('/media/img/hand', 'An open hand')),
            choice('foot', 'Foot', false, image('/media/img/foot', 'A foot')),
          ],
          stars: 1,
          skills: ['greetings', 'vocabulary'],
        }),
        activity({
          id: 'a-greet-speak',
          kind: 'speak',
          prompt: 'Say hello',
          speakTarget: 'Hello!',
          stimulus: audio('/media/audio/hello', 'Hello', 1.2, 'Hello'),
          stars: 2,
          difficulty: 2,
          skills: ['speaking', 'greetings'],
        }),
      ]),
      lesson('l1-u1-s2', 'Goodbye', 'Say goodbye and see you.', [
        activity({
          id: 'a-bye-listen',
          kind: 'listen',
          prompt: 'Listen',
          stimulus: audio('/media/audio/goodbye', 'Goodbye', 1.2, 'Goodbye'),
          expected: 'goodbye',
          options: [
            choice('wave', 'Wave', true, image('/media/img/wave', 'A waving hand')),
            choice('sun', 'Sun', false, image('/media/img/sun', 'The sun')),
            choice('cup', 'Cup', false, image('/media/img/cup', 'A cup')),
          ],
          stars: 1,
          skills: ['listening', 'greetings'],
        }),
        activity({
          id: 'a-bye-order',
          kind: 'order',
          prompt: 'Put in order',
          orderTokens: ['Hello', 'Goodbye'],
          solution: ['Hello', 'Goodbye'],
          stars: 2,
          difficulty: 2,
          skills: ['grammar', 'greetings'],
        }),
      ]),
    ]),
    unit('u1-2', 'My Family', 'Names for the people you love', '👨‍👩‍👧', [
      lesson('l1-u2-s1', 'Who is this?', 'Name six family members.', [
        activity({
          id: 'a-fam-match',
          kind: 'match',
          prompt: 'Match them',
          pairs: [
            pair('mama', image('/media/img/mum', 'Mum'), audio('/media/audio/mum', 'Mum', 1, 'Mum')),
            pair('dada', image('/media/img/dad', 'Dad'), audio('/media/audio/dad', 'Dad', 1, 'Dad')),
            pair('sister', image('/media/img/sister', 'Sister'), audio('/media/audio/sister', 'Sister', 1.2, 'Sister')),
            pair('brother', image('/media/img/brother', 'Brother'), audio('/media/audio/brother', 'Brother', 1.2, 'Brother')),
          ],
          stars: 2,
          skills: ['vocabulary', 'listening'],
        }),
        activity({
          id: 'a-fam-choose',
          kind: 'choose',
          prompt: 'Who is this?',
          stimulus: audio('/media/audio/sister', 'Sister', 1.2, 'Sister'),
          options: [
            choice('brother', 'Brother', false, image('/media/img/brother', 'Brother')),
            choice('sister', 'Sister', true, image('/media/img/sister', 'Sister')),
            choice('mum', 'Mum', false, image('/media/img/mum', 'Mum')),
          ],
          stars: 2,
          difficulty: 2,
          skills: ['vocabulary', 'listening'],
        }),
        activity({
          id: 'a-fam-speak',
          kind: 'speak',
          prompt: 'Say your family',
          speakTarget: 'This is my family.',
          stars: 2,
          skills: ['speaking', 'vocabulary'],
        }),
      ]),
    ]),
    unit('u1-3', 'Colours & Shapes', 'Name the colours around you', '🎨', [
      lesson('l1-u3-s1', 'Colours', 'Name four colours.', [
        activity({
          id: 'a-col-listen',
          kind: 'listen',
          prompt: 'Listen',
          stimulus: audio('/media/audio/red', 'Red', 1, 'Red'),
          expected: 'red',
          options: [
            choice('red', 'Red', true, image('/media/img/ball-red', 'A red ball')),
            choice('blue', 'Blue', false, image('/media/img/ball-blue', 'A blue ball')),
            choice('green', 'Green', false, image('/media/img/ball-green', 'A green ball')),
            choice('yellow', 'Yellow', false, image('/media/img/ball-yellow', 'A yellow ball')),
          ],
          stars: 1,
          skills: ['listening', 'colours'],
        }),
        activity({
          id: 'a-col-choose',
          kind: 'choose',
          prompt: 'Tap red',
          options: [
            choice('red', 'Red', true, image('/media/img/ball-red', 'A red ball')),
            choice('blue', 'Blue', false, image('/media/img/ball-blue', 'A blue ball')),
            choice('green', 'Green', false, image('/media/img/ball-green', 'A green ball')),
            choice('yellow', 'Yellow', false, image('/media/img/ball-yellow', 'A yellow ball')),
          ],
          stars: 2,
          difficulty: 2,
          skills: ['colours', 'vocabulary'],
        }),
        activity({
          id: 'a-col-match',
          kind: 'match',
          prompt: 'Match the colour',
          pairs: [
            pair('red', image('/media/img/ball-red', 'Red'), audio('/media/audio/red', 'Red', 1, 'Red')),
            pair('blue', image('/media/img/ball-blue', 'Blue'), audio('/media/audio/blue', 'Blue', 1, 'Blue')),
            pair('green', image('/media/img/ball-green', 'Green'), audio('/media/audio/green', 'Green', 1, 'Green')),
          ],
          stars: 2,
          skills: ['colours', 'vocabulary'],
        }),
      ]),
      lesson('l1-u3-s2', 'Shapes', 'Name three shapes.', [
        activity({
          id: 'a-shape-choose',
          kind: 'choose',
          prompt: 'Tap the circle',
          options: [
            choice('circle', 'Circle', true, image('/media/img/shape-circle', 'A circle')),
            choice('square', 'Square', false, image('/media/img/shape-square', 'A square')),
            choice('triangle', 'Triangle', false, image('/media/img/shape-triangle', 'A triangle')),
          ],
          stars: 1,
          skills: ['shapes', 'vocabulary'],
        }),
        activity({
          id: 'a-shape-order',
          kind: 'order',
          prompt: 'How many?',
          orderTokens: ['One', 'Two', 'Three'],
          solution: ['One', 'Two', 'Three'],
          stars: 3,
          difficulty: 3,
          skills: ['numbers', 'grammar'],
        }),
      ]),
    ]),
  ],
};

/* ------------------------------------------------------------------ *
 * Level 2 - Alphabet Adventure (ages 3-5)
 * Letter recognition, letter names, letter sounds, tracing.
 * ------------------------------------------------------------------ */

interface LetterSpec {
  letter: string;
  sound: string;
  word: string;
  picture: string;
}

const LETTERS: LetterSpec[] = [
  { letter: 'A', sound: 'ah', word: 'apple', picture: 'apple' },
  { letter: 'B', sound: 'buh', word: 'ball', picture: 'ball' },
  { letter: 'C', sound: 'kuh', word: 'cat', picture: 'cat' },
  { letter: 'D', sound: 'duh', word: 'dog', picture: 'dog' },
  { letter: 'E', sound: 'eh', word: 'egg', picture: 'egg' },
  { letter: 'F', sound: 'fff', word: 'fish', picture: 'fish' },
  { letter: 'G', sound: 'guh', word: 'goat', picture: 'goat' },
  { letter: 'H', sound: 'huh', word: 'hat', picture: 'hat' },
  { letter: 'I', sound: 'ih', word: 'igloo', picture: 'igloo' },
  { letter: 'J', sound: 'juh', word: 'jam', picture: 'jam' },
  { letter: 'K', sound: 'kuh', word: 'kite', picture: 'kite' },
  { letter: 'L', sound: 'lll', word: 'lion', picture: 'lion' },
  { letter: 'M', sound: 'mmm', word: 'moon', picture: 'moon' },
  { letter: 'N', sound: 'nnn', word: 'nest', picture: 'nest' },
  { letter: 'O', sound: 'oh', word: 'owl', picture: 'owl' },
  { letter: 'P', sound: 'puh', word: 'pig', picture: 'pig' },
  { letter: 'Q', sound: 'kwuh', word: 'queen', picture: 'queen' },
  { letter: 'R', sound: 'rrr', word: 'rabbit', picture: 'rabbit' },
  { letter: 'S', sound: 'sss', word: 'sun', picture: 'sun' },
  { letter: 'T', sound: 'tuh', word: 'tree', picture: 'tree' },
  { letter: 'U', sound: 'uh', word: 'umbrella', picture: 'umbrella' },
  { letter: 'V', sound: 'vvv', word: 'van', picture: 'van' },
  { letter: 'W', sound: 'wuh', word: 'water', picture: 'water' },
  { letter: 'X', sound: 'ks', word: 'box', picture: 'box' },
  { letter: 'Y', sound: 'yuh', word: 'yo-yo', picture: 'yoyo' },
  { letter: 'Z', sound: 'zzz', word: 'zebra', picture: 'zebra' },
];

const alphabetLessons: Lesson[] = [
  lesson('l2-u1-s1', 'Letters A to H', 'Recognise and say the first eight letters.', [
    ...LETTERS.slice(0, 4).flatMap((l) => [
      activity({
        id: `a-l2-${l.letter.toLowerCase()}-trace`,
        kind: 'trace',
        prompt: 'Trace the letter',
        expected: l.letter,
        stimulus: audio(`/media/audio/letter-${l.letter.toLowerCase()}`, `${l.letter}. ${l.sound}`, 1.6, `${l.letter} for ${l.word}`),
        stars: 1,
        skills: ['alphabet', 'writing'],
      }),
      activity({
        id: `a-l2-${l.letter.toLowerCase()}-choose`,
        kind: 'choose',
        prompt: `Find ${l.letter}`,
        options: [
          choice(l.letter.toLowerCase(), l.letter, true, image(`/media/img/letter-${l.letter.toLowerCase()}`, `Letter ${l.letter}`)),
          choice('distractor-1', '?', false),
          choice('distractor-2', '?', false),
        ],
        stars: 2,
        difficulty: 2,
        skills: ['alphabet', 'vocabulary'],
      }),
    ]),
  ]),
  lesson('l2-u1-s2', 'Letters I to P', 'Recognise and say eight more letters.', [
    ...LETTERS.slice(8, 12).flatMap((l) => [
      activity({
        id: `a-l2-${l.letter.toLowerCase()}-trace`,
        kind: 'trace',
        prompt: 'Trace the letter',
        expected: l.letter,
        stimulus: audio(`/media/audio/letter-${l.letter.toLowerCase()}`, `${l.letter}. ${l.sound}`, 1.6, `${l.letter} for ${l.word}`),
        stars: 1,
        skills: ['alphabet', 'writing'],
      }),
      activity({
        id: `a-l2-${l.letter.toLowerCase()}-choose`,
        kind: 'choose',
        prompt: `Find ${l.letter}`,
        options: [
          choice(l.letter.toLowerCase(), l.letter, true, image(`/media/img/letter-${l.letter.toLowerCase()}`, `Letter ${l.letter}`)),
          choice('distractor-1', '?', false),
          choice('distractor-2', '?', false),
        ],
        stars: 2,
        difficulty: 2,
        skills: ['alphabet', 'vocabulary'],
      }),
    ]),
  ]),
  lesson('l2-u1-s3', 'Letters Q to Z', 'Finish the alphabet.', [
    ...LETTERS.slice(20).flatMap((l) => [
      activity({
        id: `a-l2-${l.letter.toLowerCase()}-trace`,
        kind: 'trace',
        prompt: 'Trace the letter',
        expected: l.letter,
        stimulus: audio(`/media/audio/letter-${l.letter.toLowerCase()}`, `${l.letter}. ${l.sound}`, 1.6, `${l.letter} for ${l.word}`),
        stars: 1,
        skills: ['alphabet', 'writing'],
      }),
      activity({
        id: `a-l2-${l.letter.toLowerCase()}-choose`,
        kind: 'choose',
        prompt: `Find ${l.letter}`,
        options: [
          choice(l.letter.toLowerCase(), l.letter, true, image(`/media/img/letter-${l.letter.toLowerCase()}`, `Letter ${l.letter}`)),
          choice('distractor-1', '?', false),
          choice('distractor-2', '?', false),
        ],
        stars: 2,
        difficulty: 2,
        skills: ['alphabet', 'vocabulary'],
      }),
    ]),
  ]),
];

const level2: Level = {
  id: 'level-2',
  title: 'Alphabet Adventure',
  description: 'Meet every letter, hear its sound and trace it with a finger.',
  ageBand: '3-4',
  color: '#42A5F5',
  units: [
    unit('u2-1', 'The Alphabet', 'A is for Apple', '🔤', alphabetLessons),
    unit('u2-2', 'Letter Sounds', 'Hear the first sound of each word', '👂', [
      lesson('l2-u2-s1', 'Beginning sounds', 'Match a sound to its first letter.', [
        activity({
          id: 'a-l2-sound-match',
          kind: 'match',
          prompt: 'Match the sound',
          pairs: [
            pair('cat', audio('/media/audio/word-cat', 'Cat', 1, 'Cat'), image('/media/img/letter-c', 'Letter C')),
            pair('dog', audio('/media/audio/word-dog', 'Dog', 1, 'Dog'), image('/media/img/letter-d', 'Letter D')),
            pair('fish', audio('/media/audio/word-fish', 'Fish', 1, 'Fish'), image('/media/img/letter-f', 'Letter F')),
          ],
          stars: 2,
          skills: ['phonics', 'listening'],
        }),
        activity({
          id: 'a-l2-sound-listen',
          kind: 'listen',
          prompt: 'What does it start with?',
          stimulus: audio('/media/audio/word-sun', 'Sun', 1, 'Sun'),
          expected: 's',
          options: [
            choice('letter-s', 'S', true, image('/media/img/letter-s', 'Letter S')),
            choice('letter-t', 'T', false, image('/media/img/letter-t', 'Letter T')),
            choice('letter-m', 'M', false, image('/media/img/letter-m', 'Letter M')),
          ],
          stars: 2,
          difficulty: 2,
          skills: ['phonics', 'listening'],
        }),
      ]),
    ]),
  ],
};

/* ------------------------------------------------------------------ *
 * Level 3 - Sound Magic (ages 4-6)
 * Blending, segmenting, rhyme, CVC words.
 * ------------------------------------------------------------------ */

const level3: Level = {
  id: 'level-3',
  title: 'Sound Magic',
  description: 'Blend sounds together to read your first real words.',
  ageBand: '5-6',
  color: '#AB47BC',
  units: [
    unit('u3-1', 'Blending', 'Put sounds together to make words', '🧩', [
      lesson('l3-u1-s1', 'Blend with me', 'Blend three sounds into a word.', [
        activity({
          id: 'a-l3-blend-listen',
          kind: 'listen',
          prompt: 'Listen and blend',
          stimulus: audio('/media/audio/word-cat', 'C... A... T... Cat', 2, 'C A T, cat'),
          expected: 'cat',
          options: [
            choice('cat', 'Cat', true, image('/media/img/cat', 'A cat')),
            choice('pig', 'Pig', false, image('/media/img/pig', 'A pig')),
            choice('sun', 'Sun', false, image('/media/img/sun', 'The sun')),
          ],
          stars: 2,
          skills: ['phonics', 'listening'],
        }),
        activity({
          id: 'a-l3-blend-choose',
          kind: 'choose',
          prompt: 'Which word?',
          stimulus: audio('/media/audio/word-dog', 'D... O... G... Dog', 2, 'D O G, dog'),
          options: [
            choice('dog', 'Dog', true, image('/media/img/dog', 'A dog')),
            choice('dot', 'Dot', false, image('/media/img/dot', 'A dot')),
            choice('dig', 'Dig', false, image('/media/img/dig', 'A dig')),
          ],
          stars: 3,
          difficulty: 2,
          skills: ['phonics', 'vocabulary'],
        }),
        activity({
          id: 'a-l3-blend-speak',
          kind: 'speak',
          prompt: 'Blend it out loud',
          speakTarget: 'cat',
          stimulus: audio('/media/audio/word-cat', 'C... A... T... Cat', 2, 'C A T, cat'),
          stars: 3,
          difficulty: 3,
          skills: ['phonics', 'speaking'],
        }),
      ]),
      lesson('l3-u1-s2', 'Rhyme time', 'Spot words that rhyme.', [
        activity({
          id: 'a-l3-rhyme-match',
          kind: 'match',
          prompt: 'Match the rhymes',
          pairs: [
            pair('cat-hat', image('/media/img/cat', 'Cat'), image('/media/img/hat', 'Hat')),
            pair('dog-log', image('/media/img/dog', 'Dog'), image('/media/img/log', 'Log')),
            pair('pig-big', image('/media/img/pig', 'Pig'), image('/media/img/big', 'Big')),
          ],
          stars: 3,
          difficulty: 3,
          skills: ['phonics', 'vocabulary'],
        }),
      ]),
    ]),
    unit('u3-2', 'Word Families', 'Change the first sound, keep the rest', '🏠', [
      lesson('l3-u2-s1', 'Word families', 'Read a family of words.', [
        activity({
          id: 'a-l3-family-listen',
          kind: 'listen',
          prompt: 'Which did you hear?',
          stimulus: audio('/media/audio/family-animals', 'Bat, cat, hat, rat', 4, 'Bat, cat, hat, rat'),
          expected: 'cat',
          options: [
            choice('cat', 'Cat', true, image('/media/img/cat', 'A cat')),
            choice('dog', 'Dog', false, image('/media/img/dog', 'A dog')),
            choice('cow', 'Cow', false, image('/media/img/cow', 'A cow')),
          ],
          stars: 2,
          skills: ['phonics', 'listening'],
        }),
        activity({
          id: 'a-l3-family-choose',
          kind: 'choose',
          prompt: 'Which one is in the family?',
          options: [
            choice('bat', 'Bat', true, image('/media/img/bat', 'A bat')),
            choice('sun', 'Sun', false, image('/media/img/sun', 'The sun')),
            choice('top', 'Top', false, image('/media/img/top', 'A top')),
          ],
          stars: 3,
          difficulty: 3,
          skills: ['phonics', 'vocabulary'],
        }),
      ]),
    ]),
  ],
};

/* ------------------------------------------------------------------ *
 * Level 4 - Word Builder (ages 5-6)
 * Vocabulary breadth, categorisation, plurals.
 * ------------------------------------------------------------------ */

const level4: Level = {
  id: 'level-4',
  title: 'Word Builder',
  description: 'Collect, group and use a bigger, richer vocabulary.',
  ageBand: '5-6',
  color: '#26A69A',
  units: [
    unit('u4-1', 'Everyday Words', 'Words for home, school and outside', '🏠', [
      lesson('l4-u1-s1', 'At home', 'Name eight things at home.', [
        activity({
          id: 'a-l4-home-match',
          kind: 'match',
          prompt: 'Match the word',
          pairs: [
            pair('cup', image('/media/img/cup', 'A cup'), audio('/media/audio/word-cup', 'Cup', 1, 'Cup')),
            pair('bed', image('/media/img/bed', 'A bed'), audio('/media/audio/word-bed', 'Bed', 1, 'Bed')),
            pair('door', image('/media/img/door', 'A door'), audio('/media/audio/word-door', 'Door', 1, 'Door')),
            pair('lamp', image('/media/img/lamp', 'A lamp'), audio('/media/audio/word-lamp', 'Lamp', 1, 'Lamp')),
          ],
          stars: 2,
          skills: ['vocabulary', 'listening'],
        }),
        activity({
          id: 'a-l4-home-choose',
          kind: 'choose',
          prompt: 'Where does it go?',
          options: [
            choice('kitchen', 'Kitchen', true, image('/media/img/room-kitchen', 'A kitchen')),
            choice('bathroom', 'Bathroom', false, image('/media/img/room-bathroom', 'A bathroom')),
            choice('garden', 'Garden', false, image('/media/img/room-garden', 'A garden')),
          ],
          stars: 2,
          difficulty: 2,
          skills: ['vocabulary'],
        }),
      ]),
      lesson('l4-u1-s2', 'Animals', 'Name ten animals and their sounds.', [
        activity({
          id: 'a-l4-animals-listen',
          kind: 'listen',
          prompt: 'Which animal?',
          stimulus: audio('/media/audio/animal-moo', 'Moo', 1.5, 'Moo'),
          expected: 'cow',
          options: [
            choice('cow', 'Cow', true, image('/media/img/cow', 'A cow')),
            choice('pig', 'Pig', false, image('/media/img/pig', 'A pig')),
            choice('duck', 'Duck', false, image('/media/img/duck', 'A duck')),
            choice('hen', 'Hen', false, image('/media/img/hen', 'A hen')),
          ],
          stars: 2,
          skills: ['listening', 'vocabulary'],
        }),
        activity({
          id: 'a-l4-animals-choose',
          kind: 'choose',
          prompt: 'Find the cow',
          options: [
            choice('cow', 'Cow', true, image('/media/img/cow', 'A cow')),
            choice('pig', 'Pig', false, image('/media/img/pig', 'A pig')),
            choice('duck', 'Duck', false, image('/media/img/duck', 'A duck')),
            choice('hen', 'Hen', false, image('/media/img/hen', 'A hen')),
          ],
          stars: 2,
          difficulty: 2,
          skills: ['vocabulary', 'listening'],
        }),
        activity({
          id: 'a-l4-animals-speak',
          kind: 'speak',
          prompt: 'Make the sound',
          speakTarget: 'The cow says moo.',
          stimulus: audio('/media/audio/animal-moo', 'Moo', 1.5, 'Moo'),
          stars: 3,
          difficulty: 3,
          skills: ['speaking', 'vocabulary'],
        }),
      ]),
    ]),
    unit('u4-2', 'Sorting', 'Put things in groups', '🗂️', [
      lesson('l4-u2-s1', 'Groups', 'Sort words into groups.', [
        activity({
          id: 'a-l4-group-choose',
          kind: 'choose',
          prompt: 'Which is a fruit?',
          options: [
            choice('apple', 'Apple', true, image('/media/img/apple', 'An apple')),
            choice('carrot', 'Carrot', false, image('/media/img/carrot', 'A carrot')),
            choice('bus', 'Bus', false, image('/media/img/bus', 'A bus')),
          ],
          stars: 2,
          skills: ['vocabulary', 'grammar'],
        }),
        activity({
          id: 'a-l4-group-order',
          kind: 'order',
          prompt: 'Which is biggest?',
          orderTokens: ['Elephant', 'Cat', 'Ant'],
          solution: ['Elephant', 'Cat', 'Ant'],
          stars: 3,
          difficulty: 3,
          skills: ['vocabulary', 'logic'],
        }),
      ]),
    ]),
  ],
};

/* ------------------------------------------------------------------ *
 * Level 5 - Little Grammar (ages 5-7)
 * Plurals, pronouns, articles, simple sentences.
 * ------------------------------------------------------------------ */

const level5: Level = {
  id: 'level-5',
  title: 'Little Grammar',
  description: 'Use the right word for the right thing: plurals, pronouns and sentences.',
  ageBand: '5-6',
  color: '#FFB300',
  units: [
    unit('u5-1', 'One and Many', 'Singular and plural', '🔢', [
      lesson('l5-u1-s1', 'Add an s', 'Make a word into many.', [
        activity({
          id: 'a-l5-plural-choose',
          kind: 'choose',
          prompt: 'Which is many?',
          options: [
            choice('cats', 'Cats', true, image('/media/img/cats', 'Several cats')),
            choice('cat', 'Cat', false, image('/media/img/cat', 'One cat')),
            choice('catter', 'Catter', false),
          ],
          stars: 2,
          skills: ['grammar', 'vocabulary'],
        }),
        activity({
          id: 'a-l5-plural-match',
          kind: 'match',
          prompt: 'One to many',
          pairs: [
            pair('bird-birds', image('/media/img/bird', 'A bird'), image('/media/img/birds', 'Several birds')),
            pair('fish-fish', image('/media/img/fish', 'A fish'), image('/media/img/fishes', 'Several fish')),
            pair('box-boxes', image('/media/img/box', 'A box'), image('/media/img/boxes', 'Several boxes')),
          ],
          stars: 3,
          difficulty: 3,
          skills: ['grammar'],
        }),
      ]),
    ]),
    unit('u5-2', 'Pronouns', 'I, you, he, she, we, they', '👥', [
      lesson('l5-u2-s1', 'Who is it?', 'Use the right pronoun.', [
        activity({
          id: 'a-l5-pronoun-listen',
          kind: 'listen',
          prompt: 'Who is she?',
          stimulus: audio('/media/audio/pronoun-she', 'She is my sister.', 1.8, 'She is my sister.'),
          expected: 'she',
          options: [
            choice('sister', 'Sister', true, image('/media/img/sister', 'Sister')),
            choice('brother', 'Brother', false, image('/media/img/brother', 'Brother')),
            choice('mum', 'Mum', false, image('/media/img/mum', 'Mum')),
          ],
          stars: 2,
          skills: ['grammar', 'listening'],
        }),
        activity({
          id: 'a-l5-pronoun-choose',
          kind: 'choose',
          prompt: 'Who is talking?',
          stimulus: audio('/media/audio/pronoun-we', 'We are friends.', 1.8, 'We are friends.'),
          options: [
            choice('we', 'We', true),
            choice('he', 'He', false),
            choice('it', 'It', false),
          ],
          stars: 3,
          difficulty: 2,
          skills: ['grammar', 'listening'],
        }),
      ]),
    ]),
    unit('u5-3', 'Build a Sentence', 'Put words in the right order', '🧱', [
      lesson('l5-u3-s1', 'Sentence builder', 'Build a sentence that makes sense.', [
        activity({
          id: 'a-l5-sentence-order',
          kind: 'order',
          prompt: 'Build it',
          orderTokens: ['the', 'cat', 'sits', 'on', 'the', 'mat'],
          solution: ['the', 'cat', 'sits', 'on', 'the', 'mat'],
          stars: 3,
          difficulty: 3,
          skills: ['grammar', 'reading'],
        }),
        activity({
          id: 'a-l5-sentence-listen',
          kind: 'listen',
          prompt: 'Who is running?',
          stimulus: audio('/media/audio/sentence-dog-runs', 'The dog runs fast.', 2, 'The dog runs fast.'),
          expected: 'dog',
          options: [
            choice('dog', 'Dog', true, image('/media/img/dog', 'A dog')),
            choice('cat', 'Cat', false, image('/media/img/cat', 'A cat')),
            choice('bird', 'Bird', false, image('/media/img/bird', 'A bird')),
          ],
          stars: 3,
          difficulty: 3,
          skills: ['grammar', 'listening'],
        }),
      ]),
    ]),
  ],
};

/* ------------------------------------------------------------------ *
 * Level 6 - Storyteller (ages 6-8)
 * Narrative comprehension, sequencing, expression, storytelling.
 * ------------------------------------------------------------------ */

const level6: Level = {
  id: 'level-6',
  title: 'Storyteller',
  description: 'Follow a story, retell it and speak with confidence.',
  ageBand: '7-8',
  color: '#EC407A',
  units: [
    unit('u6-1', 'Story Time', 'Read and listen to a story', '📖', [
      lesson('l6-u1-s1', 'The Lost Duck', 'Follow the duck home.', [
        activity({
          id: 'a-l6-story-listen',
          kind: 'listen',
          prompt: 'Who is the story about?',
          stimulus: audio('/media/audio/story-lost-duck', 'The Lost Duck', 45, 'A little duck could not find her mother.'),
          expected: 'duck',
          options: [
            choice('duck', 'Duck', true, image('/media/img/duck', 'A duck')),
            choice('cat', 'Cat', false, image('/media/img/cat', 'A cat')),
            choice('cow', 'Cow', false, image('/media/img/cow', 'A cow')),
          ],
          stars: 2,
          skills: ['listening', 'comprehension'],
        }),
        activity({
          id: 'a-l6-story-order',
          kind: 'order',
          prompt: 'What happened first?',
          orderTokens: ['Duck finds mum', 'Duck gets lost', 'Duck feels sad', 'Duck goes home'],
          solution: ['Duck gets lost', 'Duck feels sad', 'Duck finds mum', 'Duck goes home'],
          stars: 3,
          difficulty: 3,
          skills: ['comprehension', 'logic'],
        }),
        activity({
          id: 'a-l6-story-choose',
          kind: 'choose',
          prompt: 'How did the duck feel?',
          options: [
            choice('sad', 'Sad', true, image('/media/img/mood-sad', 'A sad face')),
            choice('happy', 'Happy', false, image('/media/img/mood-happy', 'A happy face')),
            choice('angry', 'Angry', false, image('/media/img/mood-angry', 'An angry face')),
          ],
          stars: 3,
          difficulty: 3,
          skills: ['comprehension', 'emotions'],
        }),
      ]),
      lesson('l6-u1-s2', 'Tell me more', 'Answer deeper questions about the story.', [
        activity({
          id: 'a-l6-story-speak',
          kind: 'speak',
          prompt: 'Retell the story',
          speakTarget: 'The duck was lost, but she found her mother.',
          stimulus: audio('/media/audio/story-lost-duck', 'The Lost Duck', 45, 'A little duck could not find her mother.'),
          stars: 3,
          difficulty: 3,
          skills: ['speaking', 'comprehension'],
        }),
      ]),
    ]),
    unit('u6-2', 'Make a Story', 'Create your own adventure', '✏️', [
      lesson('l6-u2-s1', 'Your turn', 'Build a story with the picture cards.', [
        activity({
          id: 'a-l6-make-order',
          kind: 'order',
          prompt: 'Your story',
          orderTokens: ['A hero wakes up', 'A problem appears', 'A friend helps', 'Everyone celebrates'],
          solution: ['A hero wakes up', 'A problem appears', 'A friend helps', 'Everyone celebrates'],
          stars: 3,
          difficulty: 3,
          skills: ['comprehension', 'grammar'],
        }),
        activity({
          id: 'a-l6-make-story',
          kind: 'story',
          prompt: 'Tell your story',
          speakTarget: 'Once upon a time...',
          stars: 3,
          difficulty: 3,
          skills: ['speaking', 'comprehension'],
        }),
      ]),
    ]),
  ],
};

export const CURRICULUM: Curriculum = {
  levels: [level1, level2, level3, level4, level5, level6],
};

/* ------------------------------------------------------------------ *
 * Lookup helpers
 * ------------------------------------------------------------------ */

export function getLevel(levelId: string): Level | undefined {
  return CURRICULUM.levels.find((l) => l.id === levelId);
}

export function getLesson(lessonId: string): Lesson | undefined {
  for (const level of CURRICULUM.levels) {
    for (const u of level.units) {
      const found = u.lessons.find((l) => l.id === lessonId);
      if (found) return found;
    }
  }
  return undefined;
}

/** Flat, ordered list of lessons across the whole curriculum. */
export function allLessons(): Array<{ level: Level; unit: Unit; lesson: Lesson }> {
  const out: Array<{ level: Level; unit: Unit; lesson: Lesson }> = [];
  for (const level of CURRICULUM.levels) {
    for (const u of level.units) {
      for (const l of u.lessons) out.push({ level, unit: u, lesson: l });
    }
  }
  return out;
}

export function nextLessonId(lessonId: string): string | undefined {
  const flat = allLessons();
  const idx = flat.findIndex((entry) => entry.lesson.id === lessonId);
  if (idx === -1) return undefined;
  return flat[idx + 1]?.lesson.id;
}

/** Lesson ids in curriculum order - used to compute lock/unlock state. */
export const LESSON_ORDER = allLessons().map((entry) => entry.lesson.id);
