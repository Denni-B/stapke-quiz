import { ID, Query } from "node-appwrite";

import { parseCards, serializeCards } from "@/lib/blackjack/cards";
import { buildBlackjackAnswerQuestionId } from "@/lib/blackjack/constants";
import { drawCard, freshShuffledDeck } from "@/lib/blackjack/deck";
import {
  canSplit,
  handValue,
  isBlackjack,
  isTwentyOne,
  resolveHandStatusAfterCards,
} from "@/lib/blackjack/hand";
import { getAllowedActions, dealerShouldHit } from "@/lib/blackjack/rules";
import { calculateHandPayout } from "@/lib/blackjack/scoring";
import { createAnswer, getParticipantAnswerState } from "@/lib/answers";
import { appwriteConfig } from "@/lib/appwrite/config";
import { createServerClient } from "@/lib/appwrite/server";
import type {
  BlackjackHand,
  BlackjackHandOutcome,
  BlackjackHandStatus,
  BlackjackHostState,
  BlackjackPlayerState,
  BlackjackPublicHand,
  BlackjackSeat,
  BlackjackSession,
  Chapter,
  Participant,
} from "@/lib/types";

function parseDealerCards(session: BlackjackSession) {
  return parseCards(session.dealerCards);
}

function parseDeck(session: BlackjackSession) {
  return parseCards(session.deck);
}

async function getSessionByChapter(chapterId: string): Promise<BlackjackSession | null> {
  const { tablesDB } = createServerClient();

  const response = await tablesDB.listRows<BlackjackSession>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.blackjackSessionsTableId,
    queries: [Query.equal("chapterId", chapterId), Query.limit(1)],
  });

  return response.rows[0] ?? null;
}

async function getSeats(chapterId: string): Promise<BlackjackSeat[]> {
  const { tablesDB } = createServerClient();

  const response = await tablesDB.listRows<BlackjackSeat>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.blackjackSeatsTableId,
    queries: [Query.equal("chapterId", chapterId)],
  });

  return response.rows.sort((a, b) => a.seatNumber - b.seatNumber);
}

async function getHandsForRound(
  chapterId: string,
  roundNumber: number,
): Promise<BlackjackHand[]> {
  const { tablesDB } = createServerClient();

  const response = await tablesDB.listRows<BlackjackHand>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.blackjackHandsTableId,
    queries: [
      Query.equal("chapterId", chapterId),
      Query.equal("roundNumber", roundNumber),
    ],
  });

  return response.rows.sort((a, b) => {
    if (a.seatNumber !== b.seatNumber) {
      return a.seatNumber - b.seatNumber;
    }

    return a.handIndex - b.handIndex;
  });
}

async function getParticipantsForQuiz(quizId: string): Promise<Participant[]> {
  const { tablesDB } = createServerClient();

  const response = await tablesDB.listRows<Participant>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.participantsTableId,
    queries: [Query.equal("quizId", quizId)],
  });

  return response.rows;
}

function countEligibleBlackjackPlayers(participants: Participant[]): number {
  return participants.filter((participant) => !participant.groupId).length;
}

async function ensureBlackjackSession(
  quizId: string,
  chapterId: string,
  options?: { participants?: Participant[] },
): Promise<BlackjackSession> {
  const { tablesDB } = createServerClient();

  let participants = options?.participants;
  let existing: BlackjackSession | null;

  if (participants) {
    existing = await getSessionByChapter(chapterId);
  } else {
    [participants, existing] = await Promise.all([
      getParticipantsForQuiz(quizId),
      getSessionByChapter(chapterId),
    ]);
  }

  const seatCount = countEligibleBlackjackPlayers(participants);

  if (existing) {
    if (existing.phase === "seating" && existing.seatCount !== seatCount) {
      return tablesDB.updateRow<BlackjackSession>({
        databaseId: appwriteConfig.databaseId,
        tableId: appwriteConfig.blackjackSessionsTableId,
        rowId: existing.$id,
        data: { seatCount },
      });
    }

    return existing;
  }

  const deck = freshShuffledDeck();

  return tablesDB.createRow<BlackjackSession>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.blackjackSessionsTableId,
    rowId: ID.unique(),
    data: {
      quizId,
      chapterId,
      phase: "seating",
      roundNumber: 1,
      seatCount,
      deck: serializeCards(deck),
      dealerCards: serializeCards([]),
      currentSeat: 0,
      currentHandIndex: 0,
    },
  });
}

export async function assertBlackjackChapterOpen(
  quizId: string,
  chapterId: string,
): Promise<Chapter> {
  const { tablesDB } = createServerClient();

  const chapter = await tablesDB.getRow<Chapter>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.chaptersTableId,
    rowId: chapterId,
  });

  if (chapter.quizId !== quizId || chapter.type !== "blackjack" || chapter.isOpen !== 1) {
    throw new Error("Blackjack chapter is not open.");
  }

  return chapter;
}

export async function initBlackjackSession(
  quizId: string,
  chapterId: string,
): Promise<BlackjackSession> {
  return ensureBlackjackSession(quizId, chapterId);
}

export async function getBlackjackSession(chapterId: string): Promise<BlackjackSession | null> {
  return getSessionByChapter(chapterId);
}

export async function chooseSeat(
  chapterId: string,
  participantId: string,
  seatNumber: number,
): Promise<BlackjackSeat> {
  const { tablesDB } = createServerClient();
  const session = await getSessionByChapter(chapterId);

  if (!session || session.phase !== "seating") {
    throw new Error("Seat selection is not available.");
  }

  if (seatNumber < 1 || seatNumber > session.seatCount) {
    throw new Error("Invalid seat number.");
  }

  const seats = await getSeats(chapterId);
  const occupiedSeat = seats.find((seat) => seat.seatNumber === seatNumber);
  const existingSeat = seats.find((seat) => seat.participantId === participantId);

  if (occupiedSeat && occupiedSeat.participantId !== participantId) {
    throw new Error("This seat is already taken.");
  }

  if (existingSeat) {
    return tablesDB.updateRow<BlackjackSeat>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.blackjackSeatsTableId,
      rowId: existingSeat.$id,
      data: { seatNumber },
    });
  }

  return tablesDB.createRow<BlackjackSeat>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.blackjackSeatsTableId,
    rowId: ID.unique(),
    data: { chapterId, participantId, seatNumber },
  });
}

async function getAvailableBalance(
  quizId: string,
  participantId: string,
  chapterId: string,
  roundNumber: number,
): Promise<number> {
  const answerState = await getParticipantAnswerState(quizId, participantId);
  const hands = await getHandsForRound(chapterId, roundNumber);
  const myCommitted = hands
    .filter((hand) => hand.participantId === participantId && hand.betConfirmed === 1)
    .reduce((sum, hand) => sum + hand.bet + hand.insuranceBet, 0);

  return Math.max(0, answerState.totalScore - myCommitted);
}

export async function setBet(
  chapterId: string,
  participantId: string,
  bet: number,
): Promise<BlackjackHand> {
  const { tablesDB } = createServerClient();
  const session = await getSessionByChapter(chapterId);

  if (!session || session.phase !== "betting") {
    throw new Error("Betting is not available.");
  }

  if (!Number.isInteger(bet) || bet <= 0) {
    throw new Error("Bet must be a positive whole number.");
  }

  const seats = await getSeats(chapterId);
  const mySeat = seats.find((seat) => seat.participantId === participantId);

  if (!mySeat) {
    throw new Error("You must choose a seat first.");
  }

  const available = await getAvailableBalance(
    session.quizId,
    participantId,
    chapterId,
    session.roundNumber,
  );

  if (bet > available) {
    throw new Error("Insufficient balance for this bet.");
  }

  const hands = await getHandsForRound(chapterId, session.roundNumber);
  const existing = hands.find(
    (hand) => hand.participantId === participantId && hand.handIndex === 0,
  );

  if (existing?.betConfirmed === 1) {
    throw new Error("Bet is already confirmed.");
  }

  if (existing) {
    return tablesDB.updateRow<BlackjackHand>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.blackjackHandsTableId,
      rowId: existing.$id,
      data: { bet },
    });
  }

  return tablesDB.createRow<BlackjackHand>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.blackjackHandsTableId,
    rowId: ID.unique(),
    data: {
      chapterId,
      roundNumber: session.roundNumber,
      participantId,
      seatNumber: mySeat.seatNumber,
      handIndex: 0,
      cards: serializeCards([]),
      bet,
      insuranceBet: 0,
      betConfirmed: 0,
      insuranceConfirmed: 0,
      status: "betting",
      payout: 0,
    },
  });
}

export async function confirmBet(
  chapterId: string,
  participantId: string,
): Promise<BlackjackHand> {
  const { tablesDB } = createServerClient();
  const session = await getSessionByChapter(chapterId);

  if (!session || session.phase !== "betting") {
    throw new Error("Betting is not available.");
  }

  const hands = await getHandsForRound(chapterId, session.roundNumber);
  const hand = hands.find(
    (item) => item.participantId === participantId && item.handIndex === 0,
  );

  if (!hand || hand.bet <= 0) {
    throw new Error("Set a bet before confirming.");
  }

  if (hand.betConfirmed === 1) {
    return hand;
  }

  return tablesDB.updateRow<BlackjackHand>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.blackjackHandsTableId,
    rowId: hand.$id,
    data: { betConfirmed: 1 },
  });
}

export async function startBettingPhase(
  chapterId: string,
): Promise<BlackjackSession> {
  const { tablesDB } = createServerClient();
  const session = await getSessionByChapter(chapterId);

  if (!session || session.phase !== "seating") {
    throw new Error("Cannot start betting right now.");
  }

  const seats = await getSeats(chapterId);

  if (seats.length < session.seatCount) {
    throw new Error("All seats must be taken before starting.");
  }

  return tablesDB.updateRow<BlackjackSession>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.blackjackSessionsTableId,
    rowId: session.$id,
    data: { phase: "betting" },
  });
}

async function createHandRow(
  chapterId: string,
  roundNumber: number,
  participantId: string,
  seatNumber: number,
  handIndex: number,
  bet: number,
  cards: ReturnType<typeof parseCards>,
  status: BlackjackHandStatus,
): Promise<BlackjackHand> {
  const { tablesDB } = createServerClient();

  return tablesDB.createRow<BlackjackHand>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.blackjackHandsTableId,
    rowId: ID.unique(),
    data: {
      chapterId,
      roundNumber,
      participantId,
      seatNumber,
      handIndex,
      cards: serializeCards(cards),
      bet,
      insuranceBet: 0,
      betConfirmed: 1,
      insuranceConfirmed: 0,
      status,
      payout: 0,
    },
  });
}

async function updateSession(
  sessionId: string,
  data: Partial<BlackjackSession>,
): Promise<BlackjackSession> {
  const { tablesDB } = createServerClient();

  return tablesDB.updateRow<BlackjackSession>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.blackjackSessionsTableId,
    rowId: sessionId,
    data,
  });
}

async function findFirstActiveTurn(
  chapterId: string,
  roundNumber: number,
  seatCount: number,
): Promise<{ seat: number; handIndex: number } | null> {
  const hands = await getHandsForRound(chapterId, roundNumber);

  for (let seat = 1; seat <= seatCount; seat += 1) {
    const seatHands = hands
      .filter((hand) => hand.seatNumber === seat)
      .sort((a, b) => a.handIndex - b.handIndex);

    for (const hand of seatHands) {
      if (hand.status === "active") {
        return { seat, handIndex: hand.handIndex };
      }
    }
  }

  return null;
}

export async function dealHand(chapterId: string): Promise<BlackjackSession> {
  const { tablesDB } = createServerClient();
  const session = await getSessionByChapter(chapterId);

  if (!session || session.phase !== "betting") {
    throw new Error("Cannot deal right now.");
  }

  const seats = await getSeats(chapterId);
  const existingHands = await getHandsForRound(chapterId, session.roundNumber);
  const confirmedHands = existingHands.filter((hand) => hand.betConfirmed === 1);

  if (confirmedHands.length < seats.length) {
    throw new Error("All players must confirm their bets.");
  }

  let deck = freshShuffledDeck();
  const dealerCards: ReturnType<typeof parseCards> = [];

  for (const seat of seats.sort((a, b) => a.seatNumber - b.seatNumber)) {
    const handRow = confirmedHands.find(
      (hand) => hand.participantId === seat.participantId && hand.handIndex === 0,
    );

    if (!handRow) {
      continue;
    }

    const draw1 = drawCard(deck);
    deck = draw1.remaining;
    const draw2 = drawCard(deck);
    deck = draw2.remaining;

    const cards = [draw1.card, draw2.card];
    const status: BlackjackHandStatus = isBlackjack(cards) ? "blackjack" : "active";

    await tablesDB.updateRow<BlackjackHand>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.blackjackHandsTableId,
      rowId: handRow.$id,
      data: {
        cards: serializeCards(cards),
        status,
      },
    });
  }

  const dealerDraw1 = drawCard(deck);
  deck = dealerDraw1.remaining;
  dealerCards.push(dealerDraw1.card);
  const dealerDraw2 = drawCard(deck);
  deck = dealerDraw2.remaining;
  dealerCards.push(dealerDraw2.card);

  const dealerUpCard = dealerCards[0];
  const nextPhase = dealerUpCard.rank === "A" ? "insurance" : "playing";

  let currentSeat = 0;
  let currentHandIndex = 0;

  if (nextPhase === "playing") {
    const firstTurn = await findFirstActiveTurn(
      chapterId,
      session.roundNumber,
      session.seatCount,
    );

    if (firstTurn) {
      currentSeat = firstTurn.seat;
      currentHandIndex = firstTurn.handIndex;
    } else {
      return updateSession(session.$id, {
        phase: "dealer",
        deck: serializeCards(deck),
        dealerCards: serializeCards(dealerCards),
        currentSeat: 0,
        currentHandIndex: 0,
      });
    }
  }

  let updated = await updateSession(session.$id, {
    phase: nextPhase,
    deck: serializeCards(deck),
    dealerCards: serializeCards(dealerCards),
    currentSeat,
    currentHandIndex,
  });

  if (updated.phase === "playing") {
    updated = await autoResolveTwentyOneTurn(updated);
  }

  return updated;
}

export async function setInsurance(
  chapterId: string,
  participantId: string,
  takeInsurance: boolean,
): Promise<BlackjackHand> {
  const { tablesDB } = createServerClient();
  const session = await getSessionByChapter(chapterId);

  if (!session || session.phase !== "insurance") {
    throw new Error("Insurance is not available.");
  }

  const hands = await getHandsForRound(chapterId, session.roundNumber);
  const hand = hands.find(
    (item) => item.participantId === participantId && item.handIndex === 0,
  );

  if (!hand) {
    throw new Error("No hand found.");
  }

  if (hand.insuranceConfirmed === 1) {
    return hand;
  }

  const insuranceBet = takeInsurance ? Math.floor(hand.bet / 2) : 0;

  if (takeInsurance) {
    const available = await getAvailableBalance(
      session.quizId,
      participantId,
      chapterId,
      session.roundNumber,
    );

    if (insuranceBet > available) {
      throw new Error("Insufficient balance for insurance.");
    }
  }

  return tablesDB.updateRow<BlackjackHand>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.blackjackHandsTableId,
    rowId: hand.$id,
    data: {
      insuranceBet,
      insuranceConfirmed: 1,
    },
  });
}

export async function advanceFromInsurance(chapterId: string): Promise<BlackjackSession> {
  const session = await getSessionByChapter(chapterId);

  if (!session || session.phase !== "insurance") {
    throw new Error("Not in insurance phase.");
  }

  const hands = await getHandsForRound(chapterId, session.roundNumber);
  const seats = await getSeats(chapterId);
  const allConfirmed = seats.every((seat) => {
    const hand = hands.find(
      (item) => item.participantId === seat.participantId && item.handIndex === 0,
    );
    return hand && hand.insuranceConfirmed === 1;
  });

  if (!allConfirmed) {
    throw new Error("Not all players have decided on insurance.");
  }

  const firstTurn = await findFirstActiveTurn(
    chapterId,
    session.roundNumber,
    session.seatCount,
  );

  if (!firstTurn) {
    return updateSession(session.$id, {
      phase: "dealer",
      currentSeat: 0,
      currentHandIndex: 0,
    });
  }

  const updated = await updateSession(session.$id, {
    phase: "playing",
    currentSeat: firstTurn.seat,
    currentHandIndex: firstTurn.handIndex,
  });

  return autoResolveTwentyOneTurn(updated);
}

async function autoResolveTwentyOneTurn(
  session: BlackjackSession,
): Promise<BlackjackSession> {
  if (session.phase !== "playing" || session.currentSeat <= 0) {
    return session;
  }

  const { tablesDB } = createServerClient();
  const hands = await getHandsForRound(session.chapterId, session.roundNumber);
  const hand = hands.find(
    (item) =>
      item.seatNumber === session.currentSeat &&
      item.handIndex === session.currentHandIndex &&
      item.status === "active",
  );

  if (!hand) {
    return session;
  }

  const cards = parseCards(hand.cards);

  if (!isTwentyOne(cards)) {
    return session;
  }

  await tablesDB.updateRow<BlackjackHand>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.blackjackHandsTableId,
    rowId: hand.$id,
    data: { status: "stand" },
  });

  session = await advanceTurn(session);

  if (session.phase === "dealer") {
    return playDealer(session);
  }

  return autoResolveTwentyOneTurn(session);
}

async function afterTurnAdvance(session: BlackjackSession): Promise<BlackjackSession> {
  if (session.phase === "dealer") {
    return playDealer(session);
  }

  if (session.phase === "playing") {
    return autoResolveTwentyOneTurn(session);
  }

  return session;
}

async function advanceTurn(session: BlackjackSession): Promise<BlackjackSession> {
  const hands = await getHandsForRound(session.chapterId, session.roundNumber);
  const seatHands = hands
    .filter((hand) => hand.seatNumber === session.currentSeat)
    .sort((a, b) => a.handIndex - b.handIndex);

  const currentIndex = seatHands.findIndex(
    (hand) => hand.handIndex === session.currentHandIndex && hand.status === "active",
  );

  if (currentIndex >= 0) {
    for (let index = currentIndex + 1; index < seatHands.length; index += 1) {
      if (seatHands[index].status === "active") {
        return updateSession(session.$id, {
          currentHandIndex: seatHands[index].handIndex,
        });
      }
    }
  }

  for (let seat = session.currentSeat + 1; seat <= session.seatCount; seat += 1) {
    const nextSeatHands = hands
      .filter((hand) => hand.seatNumber === seat)
      .sort((a, b) => a.handIndex - b.handIndex);

    for (const hand of nextSeatHands) {
      if (hand.status === "active") {
        return updateSession(session.$id, {
          currentSeat: seat,
          currentHandIndex: hand.handIndex,
        });
      }
    }
  }

  return updateSession(session.$id, {
    phase: "dealer",
    currentSeat: 0,
    currentHandIndex: 0,
  });
}

async function settleRound(session: BlackjackSession): Promise<BlackjackSession> {
  const { tablesDB } = createServerClient();
  const dealerCards = parseDealerCards(session);
  const hands = await getHandsForRound(session.chapterId, session.roundNumber);

  for (const hand of hands) {
    if (hand.status === "settled") {
      continue;
    }

    const cards = parseCards(hand.cards);
    const { outcome, payout } = calculateHandPayout(
      cards,
      dealerCards,
      hand.bet,
      hand.insuranceBet,
    );

    await tablesDB.updateRow<BlackjackHand>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.blackjackHandsTableId,
      rowId: hand.$id,
      data: {
        status: "settled",
        outcome,
        payout,
      },
    });

    await createAnswer({
      quizId: session.quizId,
      questionId: buildBlackjackAnswerQuestionId(hand.$id),
      participantId: hand.participantId,
      value: 0,
      points: payout,
    });
  }

  return updateSession(session.$id, { phase: "results" });
}

async function playDealer(session: BlackjackSession): Promise<BlackjackSession> {
  let dealerCards = parseDealerCards(session);
  let deck = parseDeck(session);

  while (dealerShouldHit(dealerCards)) {
    const draw = drawCard(deck);
    dealerCards = [...dealerCards, draw.card];
    deck = draw.remaining;
  }

  const updated = await updateSession(session.$id, {
    dealerCards: serializeCards(dealerCards),
    deck: serializeCards(deck),
  });

  return settleRound(updated);
}

export async function performAction(
  chapterId: string,
  participantId: string,
  action: "hit" | "stand" | "double" | "split",
): Promise<BlackjackSession> {
  const { tablesDB } = createServerClient();
  let session = await getSessionByChapter(chapterId);

  if (!session || session.phase !== "playing") {
    throw new Error("Actions are not available right now.");
  }

  const hands = await getHandsForRound(chapterId, session.roundNumber);
  const hand = hands.find(
    (item) =>
      item.participantId === participantId &&
      item.seatNumber === session!.currentSeat &&
      item.handIndex === session!.currentHandIndex,
  );

  if (!hand || hand.status !== "active") {
    throw new Error("It is not your turn.");
  }

  const cards = parseCards(hand.cards);
  const hasSplit = hands.some(
    (item) => item.participantId === participantId && item.handIndex > 0,
  );
  const allowed = getAllowedActions(cards, hasSplit);

  if (!allowed.includes(action)) {
    throw new Error("Action not allowed.");
  }

  let deck = parseDeck(session);

  if (action === "hit") {
    const draw = drawCard(deck);
    const newCards = [...cards, draw.card];
    deck = draw.remaining;
    const newStatus = resolveHandStatusAfterCards(newCards, {
      allowNaturalBlackjack: false,
    });

    await tablesDB.updateRow<BlackjackHand>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.blackjackHandsTableId,
      rowId: hand.$id,
      data: {
        cards: serializeCards(newCards),
        status: newStatus,
      },
    });

    session = await updateSession(session.$id, { deck: serializeCards(deck) });

    if (newStatus !== "active") {
      return afterTurnAdvance(await advanceTurn(session));
    }

    return session;
  }

  if (action === "stand") {
    await tablesDB.updateRow<BlackjackHand>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.blackjackHandsTableId,
      rowId: hand.$id,
      data: { status: "stand" },
    });

    return afterTurnAdvance(await advanceTurn(session));
  }

  if (action === "double") {
    const available = await getAvailableBalance(
      session.quizId,
      participantId,
      chapterId,
      session.roundNumber,
    );

    if (hand.bet > available) {
      throw new Error("Insufficient balance to double down.");
    }

    const draw = drawCard(deck);
    const newCards = [...cards, draw.card];
    deck = draw.remaining;
    const newStatus = resolveHandStatusAfterCards(newCards, {
      allowNaturalBlackjack: false,
    });

    await tablesDB.updateRow<BlackjackHand>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.blackjackHandsTableId,
      rowId: hand.$id,
      data: {
        cards: serializeCards(newCards),
        bet: hand.bet * 2,
        status: newStatus === "active" ? "stand" : newStatus,
      },
    });

    session = await updateSession(session.$id, { deck: serializeCards(deck) });
    return afterTurnAdvance(await advanceTurn(session));
  }

  if (action === "split") {
    if (!canSplit(cards)) {
      throw new Error("Cannot split this hand.");
    }

    const available = await getAvailableBalance(
      session.quizId,
      participantId,
      chapterId,
      session.roundNumber,
    );

    if (hand.bet > available) {
      throw new Error("Insufficient balance to split.");
    }

    const draw1 = drawCard(deck);
    deck = draw1.remaining;
    const draw2 = drawCard(deck);
    deck = draw2.remaining;

    const firstHand = [cards[0], draw1.card];
    const secondHand = [cards[1], draw2.card];

    await tablesDB.updateRow<BlackjackHand>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.blackjackHandsTableId,
      rowId: hand.$id,
      data: {
        cards: serializeCards(firstHand),
        status: resolveHandStatusAfterCards(firstHand, {
          allowNaturalBlackjack: false,
        }),
      },
    });

    await createHandRow(
      chapterId,
      session.roundNumber,
      participantId,
      hand.seatNumber,
      1,
      hand.bet,
      secondHand,
      resolveHandStatusAfterCards(secondHand, { allowNaturalBlackjack: false }),
    );

    const currentSeat = session.currentSeat;
    const currentHandIndex = session.currentHandIndex;
    session = await updateSession(session.$id, { deck: serializeCards(deck) });

    const refreshedHands = await getHandsForRound(chapterId, session.roundNumber);
    const stillActive = refreshedHands.find(
      (item) =>
        item.participantId === participantId &&
        item.seatNumber === currentSeat &&
        item.handIndex === currentHandIndex &&
        item.status === "active",
    );

    if (!stillActive) {
      return afterTurnAdvance(await advanceTurn(session));
    }

    return autoResolveTwentyOneTurn(session);
  }

  throw new Error("Unknown action.");
}

export async function startNextRound(chapterId: string): Promise<BlackjackSession> {
  const session = await getSessionByChapter(chapterId);

  if (!session || session.phase !== "results") {
    throw new Error("Cannot start next round right now.");
  }

  const deck = freshShuffledDeck();

  return updateSession(session.$id, {
    phase: "betting",
    roundNumber: session.roundNumber + 1,
    deck: serializeCards(deck),
    dealerCards: serializeCards([]),
    currentSeat: 0,
    currentHandIndex: 0,
  });
}

export async function resetBlackjackGame(
  quizId: string,
  chapterId: string,
): Promise<BlackjackSession> {
  const { tablesDB } = createServerClient();
  const session = await getSessionByChapter(chapterId);

  if (!session) {
    return initBlackjackSession(quizId, chapterId);
  }

  const [seats, handsResponse, participants] = await Promise.all([
    getSeats(chapterId),
    tablesDB.listRows<BlackjackHand>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.blackjackHandsTableId,
      queries: [Query.equal("chapterId", chapterId)],
    }),
    getParticipantsForQuiz(quizId),
  ]);

  await Promise.all([
    ...seats.map((seat) =>
      tablesDB.deleteRow({
        databaseId: appwriteConfig.databaseId,
        tableId: appwriteConfig.blackjackSeatsTableId,
        rowId: seat.$id,
      }),
    ),
    ...handsResponse.rows.map((hand) =>
      tablesDB.deleteRow({
        databaseId: appwriteConfig.databaseId,
        tableId: appwriteConfig.blackjackHandsTableId,
        rowId: hand.$id,
      }),
    ),
  ]);

  const deck = freshShuffledDeck();

  return updateSession(session.$id, {
    phase: "seating",
    roundNumber: 1,
    seatCount: countEligibleBlackjackPlayers(participants),
    deck: serializeCards(deck),
    dealerCards: serializeCards([]),
    currentSeat: 0,
    currentHandIndex: 0,
  });
}

export async function buildPlayerState(
  quizId: string,
  chapterId: string,
  participant: Participant,
  options?: { totalScore?: number },
): Promise<BlackjackPlayerState | null> {
  const participants = await getParticipantsForQuiz(quizId);
  const participantMap = new Map(
    participants.map((entry) => [entry.$id, entry]),
  );

  const session = await ensureBlackjackSession(quizId, chapterId, { participants });

  const [seats, hands] = await Promise.all([
    getSeats(chapterId),
    getHandsForRound(chapterId, session.roundNumber),
  ]);

  const mySeat = seats.find((seat) => seat.participantId === participant.$id);
  const myHands = hands
    .filter((hand) => hand.participantId === participant.$id)
    .sort((a, b) => a.handIndex - b.handIndex);

  const totalScore =
    options?.totalScore ??
    (await getParticipantAnswerState(quizId, participant.$id)).totalScore;

  const committed = myHands
    .filter((hand) => hand.betConfirmed === 1)
    .reduce((sum, hand) => sum + hand.bet + hand.insuranceBet, 0);
  const availableBalance = Math.max(0, totalScore - committed);

  const dealerCards = parseDealerCards(session);
  const showAllDealer = session.phase === "dealer" || session.phase === "results";
  const dealerUpCard = dealerCards[0];
  const isMyTurn =
    session.phase === "playing" &&
    mySeat !== undefined &&
    session.currentSeat === mySeat.seatNumber &&
    myHands.some(
      (hand) =>
        hand.handIndex === session.currentHandIndex && hand.status === "active",
    );

  const activeHand = myHands.find(
    (hand) => hand.handIndex === session.currentHandIndex && hand.status === "active",
  );
  const activeCards = activeHand ? parseCards(activeHand.cards) : [];
  const hasSplit = myHands.length > 1;
  const allowedActions = isMyTurn
    ? getAllowedActions(activeCards, hasSplit)
    : [];

  const needsInsurance =
    session.phase === "insurance" &&
    myHands.some((hand) => hand.insuranceConfirmed === 0);

  return {
    phase: session.phase,
    roundNumber: session.roundNumber,
    seatCount: session.seatCount,
    mySeatNumber: mySeat?.seatNumber,
    myHands: myHands.map((hand) => {
      const cards = parseCards(hand.cards);
      return {
        handIndex: hand.handIndex,
        cards,
        handValue: cards.length > 0 ? handValue(cards).value : 0,
        status: hand.status,
        bet: hand.bet,
        insuranceBet: hand.insuranceBet,
        betConfirmed: hand.betConfirmed === 1,
        outcome: hand.outcome as BlackjackHandOutcome | undefined,
        payout: hand.payout,
      };
    }),
    dealerUpCard,
    dealerCards: showAllDealer ? dealerCards : dealerUpCard ? [dealerUpCard] : undefined,
    dealerValue:
      showAllDealer && dealerCards.length > 0
        ? handValue(dealerCards).value
        : undefined,
    currentSeat: session.currentSeat || undefined,
    currentHandIndex: session.currentHandIndex,
    isMyTurn,
    availableBalance,
    totalScore,
    canAct: isMyTurn && allowedActions.length > 0,
    allowedActions,
    needsInsurance,
    insuranceTaken: myHands[0]?.insuranceConfirmed === 1
      ? myHands[0].insuranceBet > 0
      : undefined,
    occupiedSeats: seats.map((seat) => ({
      seatNumber: seat.seatNumber,
      displayName:
        participantMap.get(seat.participantId)?.displayName ?? "Speler",
    })),
  };
}

export async function buildHostState(
  quizId: string,
  chapterId: string,
): Promise<BlackjackHostState | null> {
  const participants = await getParticipantsForQuiz(quizId);
  const participantMap = new Map(
    participants.map((entry) => [entry.$id, entry]),
  );

  const session = await ensureBlackjackSession(quizId, chapterId, { participants });

  const [seats, hands] = await Promise.all([
    getSeats(chapterId),
    getHandsForRound(chapterId, session.roundNumber),
  ]);
  const dealerCards = parseDealerCards(session);
  const showDealerHole = session.phase === "dealer" || session.phase === "results";

  const playerHands: BlackjackPublicHand[] = hands.map((hand) => {
    const cards = parseCards(hand.cards);
    return {
      seatNumber: hand.seatNumber,
      handIndex: hand.handIndex,
      displayName:
        participantMap.get(hand.participantId)?.displayName ?? "Speler",
      cards,
      handValue: cards.length > 0 ? handValue(cards).value : undefined,
      status: hand.status,
      bet: hand.bet,
      outcome: hand.outcome as BlackjackHandOutcome | undefined,
      payout: hand.payout,
    };
  });

  const bettingStatus = seats.map((seat) => {
    const hand = hands.find(
      (item) => item.participantId === seat.participantId && item.handIndex === 0,
    );

    return {
      seatNumber: seat.seatNumber,
      displayName:
        participantMap.get(seat.participantId)?.displayName ?? "Speler",
      bet: hand?.bet ?? 0,
      betConfirmed: hand?.betConfirmed === 1,
    };
  });

  const allBetsConfirmed =
    seats.length > 0 &&
    bettingStatus.every((item) => item.betConfirmed && item.bet > 0);

  const allInsuranceDecided =
    session.phase !== "insurance" ||
    (seats.length > 0 &&
      seats.every((seat) => {
        const hand = hands.find(
          (item) => item.participantId === seat.participantId && item.handIndex === 0,
        );
        return hand && hand.insuranceConfirmed === 1;
      }));

  return {
    phase: session.phase,
    roundNumber: session.roundNumber,
    seatCount: session.seatCount,
    seats: seats.map((seat) => ({
      seatNumber: seat.seatNumber,
      participantId: seat.participantId,
      displayName:
        participantMap.get(seat.participantId)?.displayName ?? "Speler",
    })),
    dealerCards: showDealerHole
      ? dealerCards
      : dealerCards.length > 0
        ? [dealerCards[0]]
        : [],
    dealerValue:
      showDealerHole && dealerCards.length > 0
        ? handValue(dealerCards).value
        : undefined,
    showDealerHole,
    playerHands,
    currentSeat: session.currentSeat || undefined,
    currentHandIndex: session.currentHandIndex,
    bettingStatus,
    allBetsConfirmed,
    allSeatsTaken: seats.length >= session.seatCount,
    allInsuranceDecided,
  };
}

export async function getOpenBlackjackChapterId(
  quizId: string,
): Promise<string | null> {
  const { tablesDB } = createServerClient();

  const response = await tablesDB.listRows<Chapter>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.chaptersTableId,
    queries: [
      Query.equal("quizId", quizId),
      Query.equal("isOpen", 1),
      Query.equal("type", "blackjack"),
      Query.limit(1),
    ],
  });

  return response.rows[0]?.$id ?? null;
}
