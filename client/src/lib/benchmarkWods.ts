// Base de WODs benchmark — Girls, Heroes, Open
// Toutes les descriptions sont prêtes à être parsées par analyzeWod()

export type BenchmarkCategory = "Girls" | "Heroes" | "Open";

export interface BenchmarkWod {
  id: string;
  name: string;
  category: BenchmarkCategory;
  description: string;
  rxWeight?: { men: string; women: string };
  source?: string;
  notes?: string;
  expectedDuration?: string;
}

export const BENCHMARK_WODS: BenchmarkWod[] = [
  // ─── GIRLS ───────────────────────────────────────────────────────────────
  {
    id: "fran",
    name: "Fran",
    category: "Girls",
    description: `For Time
21-15-9
Thrusters 95lb
Pull-Ups`,
    rxWeight: { men: "95lb / 43kg", women: "65lb / 30kg" },
    expectedDuration: "2-8 min",
    notes: "Le métabolique iconique. Profil glycolytique pur.",
  },
  {
    id: "cindy",
    name: "Cindy",
    category: "Girls",
    description: `AMRAP 20 min
5 Pull-Ups
10 Push-Ups
15 Air Squats`,
    expectedDuration: "20 min",
    notes: "Bodyweight endurance.",
  },
  {
    id: "helen",
    name: "Helen",
    category: "Girls",
    description: `3 Rounds For Time
400m Run
21 Kettlebell Swing 24kg
12 Pull-Ups`,
    rxWeight: { men: "24kg KB", women: "16kg KB" },
    expectedDuration: "8-15 min",
  },
  {
    id: "grace",
    name: "Grace",
    category: "Girls",
    description: `For Time
30 Clean and Jerk 135lb`,
    rxWeight: { men: "135lb / 61kg", women: "95lb / 43kg" },
    expectedDuration: "2-8 min",
    notes: "Sprint haltéro pur.",
  },
  {
    id: "annie",
    name: "Annie",
    category: "Girls",
    description: `For Time
50-40-30-20-10
Double Unders
Sit-Ups`,
    expectedDuration: "5-12 min",
  },
  {
    id: "diane",
    name: "Diane",
    category: "Girls",
    description: `For Time
21-15-9
Deadlift 225lb
Handstand Push-Ups`,
    rxWeight: { men: "225lb / 102kg", women: "155lb / 70kg" },
    expectedDuration: "3-8 min",
  },
  {
    id: "elizabeth",
    name: "Elizabeth",
    category: "Girls",
    description: `For Time
21-15-9
Clean 135lb
Ring Dips`,
    rxWeight: { men: "135lb / 61kg", women: "95lb / 43kg" },
    expectedDuration: "5-12 min",
  },
  {
    id: "jackie",
    name: "Jackie",
    category: "Girls",
    description: `For Time
1000m Row
50 Thrusters 45lb
30 Pull-Ups`,
    rxWeight: { men: "45lb / 20kg", women: "35lb / 16kg" },
    expectedDuration: "6-12 min",
  },
  {
    id: "karen",
    name: "Karen",
    category: "Girls",
    description: `For Time
150 Wall Balls 20lb`,
    rxWeight: { men: "20lb / 9kg", women: "14lb / 6kg" },
    expectedDuration: "5-12 min",
  },
  {
    id: "linda",
    name: "Linda",
    category: "Girls",
    description: `For Time
10-9-8-7-6-5-4-3-2-1
Deadlift 1.5x bodyweight
Bench Press bodyweight
Clean 0.75x bodyweight`,
    expectedDuration: "15-30 min",
    notes: "Three bars of death.",
  },
  {
    id: "mary",
    name: "Mary",
    category: "Girls",
    description: `AMRAP 20 min
5 Handstand Push-Ups
10 Pistols
15 Pull-Ups`,
    expectedDuration: "20 min",
  },
  {
    id: "nancy",
    name: "Nancy",
    category: "Girls",
    description: `5 Rounds For Time
400m Run
15 Overhead Squat 95lb`,
    rxWeight: { men: "95lb / 43kg", women: "65lb / 30kg" },
    expectedDuration: "12-20 min",
  },
  {
    id: "angie",
    name: "Angie",
    category: "Girls",
    description: `For Time
100 Pull-Ups
100 Push-Ups
100 Sit-Ups
100 Air Squats`,
    expectedDuration: "15-25 min",
  },
  {
    id: "barbara",
    name: "Barbara",
    category: "Girls",
    description: `5 Rounds For Time
20 Pull-Ups
30 Push-Ups
40 Sit-Ups
50 Air Squats
Rest 3 min between rounds`,
    expectedDuration: "30-45 min",
  },
  {
    id: "chelsea",
    name: "Chelsea",
    category: "Girls",
    description: `EMOM 30 min
5 Pull-Ups
10 Push-Ups
15 Air Squats`,
    expectedDuration: "30 min",
  },
  {
    id: "eva",
    name: "Eva",
    category: "Girls",
    description: `5 Rounds For Time
800m Run
30 Kettlebell Swing 32kg
30 Pull-Ups`,
    rxWeight: { men: "32kg KB", women: "24kg KB" },
    expectedDuration: "30-50 min",
  },
  {
    id: "fgb",
    name: "Fight Gone Bad",
    category: "Girls",
    description: `3 Rounds
1 min Wall Balls 20lb
1 min Sumo Deadlift High Pull 75lb
1 min Box Jumps
1 min Push Press 75lb
1 min Row
Rest 1 min between rounds`,
    expectedDuration: "17 min",
  },
  {
    id: "isabel",
    name: "Isabel",
    category: "Girls",
    description: `For Time
30 Snatch 135lb`,
    rxWeight: { men: "135lb / 61kg", women: "95lb / 43kg" },
    expectedDuration: "2-8 min",
  },

  // ─── HEROES ──────────────────────────────────────────────────────────────
  {
    id: "murph",
    name: "Murph",
    category: "Heroes",
    description: `For Time (avec gilet 9kg/20lb)
1 mile Run
100 Pull-Ups
200 Push-Ups
300 Air Squats
1 mile Run`,
    rxWeight: { men: "Vest 20lb / 9kg", women: "Vest 14lb / 6kg" },
    expectedDuration: "35-60 min",
    notes: "Memorial Day Hero WOD. Lt. Michael Murphy.",
  },
  {
    id: "dt",
    name: "DT",
    category: "Heroes",
    description: `5 Rounds For Time
12 Deadlift 155lb
9 Hang Power Clean 155lb
6 Push Jerk 155lb`,
    rxWeight: { men: "155lb / 70kg", women: "105lb / 47kg" },
    expectedDuration: "8-15 min",
    notes: "Hommage à USAF SSgt Timothy P. Davis.",
  },
  {
    id: "jt",
    name: "JT",
    category: "Heroes",
    description: `For Time
21-15-9
Handstand Push-Ups
Ring Dips
Push-Ups`,
    expectedDuration: "10-25 min",
    notes: "Petty Officer Jeff Taylor.",
  },
  {
    id: "kalsu",
    name: "Kalsu",
    category: "Heroes",
    description: `For Time
100 Thrusters 135lb
EMOM 5 Burpees au début de chaque minute`,
    rxWeight: { men: "135lb / 61kg", women: "95lb / 43kg" },
    expectedDuration: "15-30 min",
    notes: "Lt. James Bob Kalsu.",
  },
  {
    id: "glen",
    name: "Glen",
    category: "Heroes",
    description: `For Time
30 Clean and Jerk 135lb
1 mile Run
10 Rope Climbs
1 mile Run
100 Burpees`,
    rxWeight: { men: "135lb / 61kg", women: "95lb / 43kg" },
    expectedDuration: "30-50 min",
  },
  {
    id: "chief",
    name: "The Chief",
    category: "Heroes",
    description: `5 AMRAP 3 min
3 Power Clean 135lb
6 Push-Ups
9 Air Squats
Rest 1 min between AMRAPs`,
    rxWeight: { men: "135lb / 61kg", women: "95lb / 43kg" },
    expectedDuration: "20 min",
  },
  {
    id: "holleyman",
    name: "Holleyman",
    category: "Heroes",
    description: `30 Rounds For Time
5 Wall Balls 20lb
3 Handstand Push-Ups
1 Power Clean 225lb`,
    rxWeight: { men: "225lb / 102kg", women: "155lb / 70kg" },
    expectedDuration: "25-40 min",
  },
  {
    id: "bert",
    name: "Bert",
    category: "Heroes",
    description: `For Time
50 Burpees
400m Run
100 Push-Ups
400m Run
150 Walking Lunges
400m Run
200 Air Squats
400m Run
150 Walking Lunges
400m Run
100 Push-Ups
400m Run
50 Burpees`,
    expectedDuration: "40-60 min",
  },
  {
    id: "hansen",
    name: "Hansen",
    category: "Heroes",
    description: `5 Rounds For Time
30 Kettlebell Swing 32kg
30 Burpees
30 GHD Sit-Ups`,
    rxWeight: { men: "32kg KB", women: "24kg KB" },
    expectedDuration: "25-40 min",
  },
  {
    id: "hotshots19",
    name: "Hotshots 19",
    category: "Heroes",
    description: `6 Rounds For Time
30 Air Squats
19 Power Cleans 135lb
7 Strict Pull-Ups
400m Run`,
    rxWeight: { men: "135lb / 61kg", women: "95lb / 43kg" },
    expectedDuration: "30-45 min",
  },
  {
    id: "jerry",
    name: "Jerry",
    category: "Heroes",
    description: `For Time
1 mile Run
2000m Row
1 mile Run`,
    expectedDuration: "25-40 min",
  },
  {
    id: "joshie",
    name: "Joshie",
    category: "Heroes",
    description: `3 Rounds For Time
21 Dumbbell Snatch 40lb bras droit
21 Pull-Ups
21 Dumbbell Snatch 40lb bras gauche
21 Pull-Ups`,
    rxWeight: { men: "40lb DB", women: "25lb DB" },
    expectedDuration: "15-25 min",
  },
  {
    id: "klepto",
    name: "Klepto",
    category: "Heroes",
    description: `4 Rounds For Time
27 Box Jumps 24in
20 Burpees
11 Squat Clean 145lb`,
    rxWeight: { men: "145lb / 65kg", women: "100lb / 45kg" },
    expectedDuration: "20-35 min",
  },
  {
    id: "manion",
    name: "Manion",
    category: "Heroes",
    description: `7 Rounds For Time
400m Run
29 Back Squats 135lb`,
    rxWeight: { men: "135lb / 61kg", women: "95lb / 43kg" },
    expectedDuration: "25-40 min",
  },
  {
    id: "mcghee",
    name: "McGhee",
    category: "Heroes",
    description: `AMRAP 30 min
5 Deadlift 275lb
13 Push-Ups
9 Box Jumps 24in`,
    rxWeight: { men: "275lb / 125kg", women: "185lb / 84kg" },
    expectedDuration: "30 min",
  },
  {
    id: "michael",
    name: "Michael",
    category: "Heroes",
    description: `3 Rounds For Time
800m Run
50 Back Extensions
50 Sit-Ups`,
    expectedDuration: "20-30 min",
  },

  // ─── OPEN ────────────────────────────────────────────────────────────────
  {
    id: "open-11-1",
    name: "Open 11.1",
    category: "Open",
    description: `AMRAP 10 min
30 Double Unders
15 Power Snatch 75lb`,
    rxWeight: { men: "75lb / 34kg", women: "55lb / 25kg" },
    expectedDuration: "10 min",
  },
  {
    id: "open-14-5",
    name: "Open 14.5",
    category: "Open",
    description: `For Time
21-18-15-12-9-6-3
Thrusters 95lb
Bar Facing Burpees`,
    rxWeight: { men: "95lb / 43kg", women: "65lb / 30kg" },
    expectedDuration: "15-30 min",
  },
  {
    id: "open-17-5",
    name: "Open 17.5",
    category: "Open",
    description: `For Time
10 Rounds
9 Thrusters 95lb
35 Double Unders`,
    rxWeight: { men: "95lb / 43kg", women: "65lb / 30kg" },
    expectedDuration: "15-25 min",
  },
  {
    id: "open-18-4",
    name: "Open 18.4",
    category: "Open",
    description: `For Time (9 min cap)
21-15-9
Deadlift 225lb
Handstand Push-Ups
Puis 21-15-9
Deadlift 315lb
Handstand Walk`,
    rxWeight: { men: "225/315lb", women: "155/205lb" },
    expectedDuration: "5-9 min",
  },
  {
    id: "open-19-5",
    name: "Open 19.5",
    category: "Open",
    description: `For Time (20 min cap)
33-27-21-15-9
Thrusters 95lb
Chest to Bar Pull-Ups`,
    rxWeight: { men: "95lb / 43kg", women: "65lb / 30kg" },
    expectedDuration: "12-20 min",
  },
  {
    id: "open-23-1",
    name: "Open 23.1",
    category: "Open",
    description: `AMRAP 14 min
60 cal Row
50 Toes to Bar
40 Wall Balls 20lb
30 Cleans 135lb
20 Muscle-Ups`,
    rxWeight: { men: "135lb / 61kg", women: "95lb / 43kg" },
    expectedDuration: "14 min",
  },
  {
    id: "open-24-2",
    name: "Open 24.2",
    category: "Open",
    description: `AMRAP 20 min
300m Row
10 Deadlift 185lb
50 Double Unders`,
    rxWeight: { men: "185lb / 84kg", women: "125lb / 57kg" },
    expectedDuration: "20 min",
  },
  {
    id: "open-25-3",
    name: "Open 25.3",
    category: "Open",
    description: `For Time
5 Wall Walks
50 cal Row
5 Wall Walks
25 Deadlift 225lb
5 Wall Walks
25 Cleans 135lb
5 Wall Walks
25 Snatch 95lb
5 Wall Walks`,
    rxWeight: { men: "225/135/95lb", women: "155/95/65lb" },
    expectedDuration: "15-30 min",
  },
];

export function getBenchmarksByCategory(cat: BenchmarkCategory): BenchmarkWod[] {
  return BENCHMARK_WODS.filter((w) => w.category === cat);
}

export function findBenchmark(id: string): BenchmarkWod | undefined {
  return BENCHMARK_WODS.find((w) => w.id === id);
}
