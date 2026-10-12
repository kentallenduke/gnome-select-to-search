export type SpotLink = { label: string; href: string; detail: string };

export type Spot = {
  kicker: string;
  title: string;
  quote: string;
  body: string;
  translation?: string;
  links: SpotLink[];
};

export const SPOTS: Record<string, Spot> = {
  panda: {
    kicker: "No text in the selection",
    title: "Red panda",
    quote: "",
    body: "Ailurus fulgens, on a mossy branch. Temperate forests of the eastern Himalayas and southwestern China. The diet is almost entirely bamboo.",
    links: [
      {
        label: "Red panda",
        href: "https://en.wikipedia.org/wiki/Red_panda",
        detail: "Species account",
      },
      {
        label: "Ailuridae",
        href: "https://en.wikipedia.org/wiki/Ailuridae",
        detail: "The family it sits in",
      },
    ],
  },
  recipe: {
    kicker: "Text in the selection",
    title: "Brown-butter miso noodles",
    quote:
      "Toss 200 g wheat noodles with 2 tbsp brown butter, 1 tbsp white miso, and a splash of pasta water. Finish with scallions and chili crisp.",
    body: "A weeknight bowl. Gemini reads the recipe in the circle and answers from the picture.",
    links: [
      {
        label: "Miso",
        href: "https://en.wikipedia.org/wiki/Miso",
        detail: "Fermented soybean paste",
      },
      {
        label: "Chili crisp",
        href: "https://en.wikipedia.org/wiki/Chili_crisp",
        detail: "The crunch on top",
      },
    ],
  },
  traceback: {
    kicker: "Text in the selection",
    title: "KeyError: 'HARBOR_TOKEN'",
    quote:
      'File "sync.py", line 42, in push\n    token = config["HARBOR_TOKEN"]\nKeyError: \'HARBOR_TOKEN\'',
    body: "That key is missing, so push() stops before it can run. Set the variable, or test for the key before indexing it.",
    links: [
      {
        label: "KeyError",
        href: "https://docs.python.org/3/library/exceptions.html#KeyError",
        detail: "Python docs",
      },
    ],
  },
  note: {
    kicker: "Text · Japanese",
    title: "明日の朝、海岸を歩こう。",
    quote: "明日の朝、海岸を歩こう。",
    translation: "Let's walk along the coast tomorrow morning.",
    body: "",
    links: [
      {
        label: "Look up the sentence",
        href: "https://jisho.org/search/%E6%98%8E%E6%97%A5%E3%81%AE%E6%9C%9D%E3%80%81%E6%B5%B7%E5%B2%B8%E3%82%92%E6%AD%A9%E3%81%93%E3%81%86%E3%80%82",
        detail: "Jisho",
      },
    ],
  },
  clock: {
    kicker: "Text in the selection",
    title: "Clock",
    quote: "",
    body: "The time in the top bar.",
    links: [],
  },
};

export const SPOT_ORDER = ["panda", "recipe", "traceback", "note", "clock"] as const;
