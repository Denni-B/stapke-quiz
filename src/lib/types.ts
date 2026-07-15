import type { Models } from "appwrite";

export type QuizStatus = "draft" | "open" | "active" | "closed";
export type ChapterType = "multipleChoice" | "ranking" | "jeopardy" | "blackjack";
export type QuestionType = "multipleChoice" | "scale1to10" | "jeopardy";

export interface JeopardyQuestionMeta {
  category: string;
  pointValue: number;
  answer: string;
  isPlayed?: boolean;
}

export interface QuestionOption {
  text: string;
  isCorrect: boolean;
  imageFileId?: string;
}

export interface Quiz extends Models.Row {
  title: string;
  code: string;
  creatorId: string;
  status: QuizStatus;
  description?: string;
  activeQuestionId?: string;
  activeQuestionStartedAt?: number;
}

export interface Chapter extends Models.Row {
  quizId: string;
  title: string;
  order: number;
  isOpen: number; // 0/1 (Appwrite integer)
  type?: ChapterType;
}

export interface Question extends Models.Row {
  quizId: string;
  chapterId?: string;
  type: QuestionType;
  scaleMin?: number;
  scaleMax?: number;
  text: string;
  order: number;
  options: string;
  imageFileId?: string;
}

export interface ParsedQuestion extends Omit<Question, "options"> {
  options: QuestionOption[];
  jeopardyMeta?: JeopardyQuestionMeta;
}

export interface Group extends Models.Row {
  quizId: string;
  name: string;
  createdAt: number;
}

export interface Participant extends Models.Row {
  quizId: string;
  displayName: string;
  sessionToken: string;
  groupId?: string | null;
}

export interface Answer extends Models.Row {
  quizId: string;
  questionId: string;
  participantId: string;
  value: number;
  points?: number;
  groupId?: string | null;
}

export interface Buzz extends Models.Row {
  quizId: string;
  questionId: string;
  participantId: string;
  groupId?: string | null;
  buzzedAt: number;
}

export interface BuzzEntry {
  order: number;
  participantId: string;
  displayName: string;
  groupId?: string | null;
  groupName?: string | null;
  buzzedAt: number;
  scoredPoints?: number | null;
  isCorrect?: boolean | null;
}

export interface JeopardyPlayState {
  canBuzz: boolean;
  hasBuzzed: boolean;
  myBuzzOrder?: number;
  teamBuzzedBy?: string;
}

export interface ScaleQuestionResult {
  questionId: string;
  text: string;
  imageFileId?: string;
  scaleMin: number;
  scaleMax: number;
  chapterId?: string;
  responseCount: number;
  average: number | null;
  distribution: Record<number, number>;
}

export interface MultipleChoiceQuestionResult {
  questionId: string;
  text: string;
  chapterId?: string;
  options: { text: string; imageFileId?: string }[];
  responseCount: number;
  distribution: Record<number, number>;
  responses: {
    participantId: string;
    displayName: string;
    optionIndex: number;
    points: number;
  }[];
}

export interface HostChapterResults {
  scaleResults: ScaleQuestionResult[];
  multipleChoiceResults: MultipleChoiceQuestionResult[];
  participantCount: number;
}

export interface LeaderboardEntry {
  participantId: string;
  displayName: string;
  totalScore: number;
  rank: number;
}

export interface TeamLeaderboardEntry {
  groupId: string;
  name: string;
  memberNames: string[];
  totalScore: number;
  rank: number;
}

export type LeaderboardMode = "individual" | "teams" | "mixed";

export interface QuizLeaderboard {
  mode: LeaderboardMode;
  entries: LeaderboardEntry[];
  teams: TeamLeaderboardEntry[];
}

export interface GroupWithMembers {
  id: string;
  name: string;
  memberIds: string[];
  memberNames: string[];
  totalScore: number;
  createdAt: number;
}

export interface QuizFormData {
  title: string;
  description: string;
  chapters: {
    id: string;
    title: string;
    order: number;
    type: ChapterType;
  }[];
  questions: {
    type: QuestionType;
    text: string;
    imageFileId?: string;
    chapterId?: string;
    scaleMin?: number;
    scaleMax?: number;
    options: QuestionOption[];
    jeopardyMeta?: JeopardyQuestionMeta;
  }[];
}

export interface GuestSession {
  quizId: string;
  displayName: string;
  sessionToken: string;
}

export const GUEST_SESSION_KEY = "stapke_guest_session";

export type BlackjackPhase =
  | "seating"
  | "betting"
  | "insurance"
  | "playing"
  | "dealer"
  | "results";

export type BlackjackSuit = "hearts" | "diamonds" | "clubs" | "spades";
export type BlackjackRank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export interface BlackjackCard {
  suit: BlackjackSuit;
  rank: BlackjackRank;
}

export type BlackjackHandStatus =
  | "betting"
  | "active"
  | "stand"
  | "bust"
  | "blackjack"
  | "settled";

export type BlackjackHandOutcome = "won" | "lost" | "push";

export interface BlackjackSession extends Models.Row {
  quizId: string;
  chapterId: string;
  phase: BlackjackPhase;
  roundNumber: number;
  seatCount: number;
  deck: string;
  dealerCards: string;
  currentSeat: number;
  currentHandIndex: number;
}

export interface BlackjackSeat extends Models.Row {
  chapterId: string;
  participantId: string;
  seatNumber: number;
}

export interface BlackjackHand extends Models.Row {
  chapterId: string;
  roundNumber: number;
  participantId: string;
  seatNumber: number;
  handIndex: number;
  cards: string;
  bet: number;
  insuranceBet: number;
  betConfirmed: number;
  insuranceConfirmed: number;
  status: BlackjackHandStatus;
  outcome?: string;
  payout: number;
}

export interface BlackjackPublicHand {
  seatNumber: number;
  handIndex: number;
  displayName: string;
  cards: BlackjackCard[];
  handValue?: number;
  status: BlackjackHandStatus;
  bet: number;
  outcome?: BlackjackHandOutcome;
  payout?: number;
}

export interface BlackjackPlayerState {
  phase: BlackjackPhase;
  roundNumber: number;
  seatCount: number;
  mySeatNumber?: number;
  myHands: {
    handIndex: number;
    cards: BlackjackCard[];
    handValue: number;
    status: BlackjackHandStatus;
    bet: number;
    insuranceBet: number;
    betConfirmed: boolean;
    outcome?: BlackjackHandOutcome;
    payout?: number;
  }[];
  dealerUpCard?: BlackjackCard;
  dealerCards?: BlackjackCard[];
  dealerValue?: number;
  currentSeat?: number;
  currentHandIndex?: number;
  isMyTurn: boolean;
  availableBalance: number;
  totalScore: number;
  canAct: boolean;
  allowedActions: ("hit" | "stand" | "double" | "split")[];
  needsInsurance: boolean;
  insuranceTaken?: boolean;
  occupiedSeats: { seatNumber: number; displayName: string }[];
}

export interface BlackjackHostState {
  phase: BlackjackPhase;
  roundNumber: number;
  seatCount: number;
  seats: { seatNumber: number; participantId: string; displayName: string }[];
  dealerCards: BlackjackCard[];
  dealerValue?: number;
  showDealerHole: boolean;
  playerHands: BlackjackPublicHand[];
  currentSeat?: number;
  currentHandIndex?: number;
  bettingStatus: {
    seatNumber: number;
    displayName: string;
    bet: number;
    betConfirmed: boolean;
  }[];
  allBetsConfirmed: boolean;
  allSeatsTaken: boolean;
  allInsuranceDecided: boolean;
}
