const WORDS = [
  'airplane', 'anchor', 'apple', 'astronaut', 'backpack',
  'banana', 'basketball', 'bicycle', 'bridge', 'butterfly',
  'camera', 'campfire', 'castle', 'compass', 'crown',
  'diamond', 'dinosaur', 'dragon', 'elephant', 'escalator',
  'fireworks', 'flamingo', 'flashlight', 'fountain', 'giraffe',
  'guitar', 'hamburger', 'helicopter', 'hourglass', 'iceberg',
  'island', 'jellyfish', 'keyboard', 'lighthouse', 'microscope',
  'mountain', 'octopus', 'parachute', 'penguin', 'pineapple',
  'pyramid', 'rainbow', 'rocket', 'sandwich', 'satellite',
  'skeleton', 'snowman', 'spaceship', 'submarine', 'sunflower',
  'telescope', 'tornado', 'treasure', 'umbrella', 'volcano',
  'waterfall', 'windmill', 'wizard', 'zebra'
];

export function getRandomWords(count = 3) {
  const copy = [...WORDS];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}