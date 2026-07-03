export interface VoteLogRow {
  a: string;
  b: string;
  aName: string;
  bName: string;
  score: number | null;
  accuracy: number | null;
  isReal: boolean | null;
  wouldPlay: boolean | null;
  difficulty: number | null;
  whoCarries: string | null;
  ts: string;
  voter: number;
}

export interface VoteLog {
  generatedAt: string;
  votes: VoteLogRow[];
  voterCount: number;
}
