import type { DesignProblem } from '../types.ts';
import { ATM_MACHINE } from './atm-machine.ts';
import { BLACKJACK_GAME } from './blackjack-game.ts';
import { CHESS_GAME } from './chess-game.ts';
import { ELEVATOR_SYSTEM } from './elevator-system.ts';
import { GROCERY_STORE_SYSTEM } from './grocery-store-system.ts';
import { IN_MEMORY_FILE_SYSTEM } from './in-memory-file-system.ts';
import { LIBRARY_MANAGEMENT_SYSTEM } from './library-management-system.ts';
import { LRU_CACHE } from './lru-cache.ts';
import { MOVIE_TICKET_BOOKING_SYSTEM } from './movie-ticket-booking-system.ts';
import { PARKING_LOT } from './parking-lot.ts';
import { RATE_LIMITER } from './rate-limiter.ts';
import { RESTAURANT_MANAGEMENT_SYSTEM } from './restaurant-management-system.ts';
import { SHIPPING_LOCKER_SYSTEM } from './shipping-locker-system.ts';
import { SPLITWISE } from './splitwise.ts';
import { TIC_TAC_TOE } from './tic-tac-toe.ts';
import { VENDING_MACHINE } from './vending-machine.ts';

/** The curated LLD problem set. */
export const LLD_PROBLEMS: DesignProblem[] = [
  TIC_TAC_TOE,
  LIBRARY_MANAGEMENT_SYSTEM,
  ATM_MACHINE,
  PARKING_LOT,
  RATE_LIMITER,
  IN_MEMORY_FILE_SYSTEM,
  MOVIE_TICKET_BOOKING_SYSTEM,
  ELEVATOR_SYSTEM,
  VENDING_MACHINE,
  LRU_CACHE,
  SPLITWISE,
  CHESS_GAME,
  GROCERY_STORE_SYSTEM,
  BLACKJACK_GAME,
  SHIPPING_LOCKER_SYSTEM,
  RESTAURANT_MANAGEMENT_SYSTEM,
];

export function getLldProblem(slug: string): DesignProblem | undefined {
  return LLD_PROBLEMS.find((p) => p.slug === slug);
}
