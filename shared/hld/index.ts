import type { DesignProblem } from '../types.ts';
import { AD_CLICK_AGGREGATION } from './ad-click-aggregation.ts';
import { CHAT_SYSTEM } from './chat-system.ts';
import { CONSISTENT_HASHING_DESIGN } from './consistent-hashing-design.ts';
import { DIGITAL_WALLET } from './digital-wallet.ts';
import { DISTRIBUTED_CACHE } from './distributed-cache.ts';
import { DISTRIBUTED_EMAIL_SERVICE } from './distributed-email-service.ts';
import { DISTRIBUTED_KEY_VALUE_STORE } from './distributed-key-value-store.ts';
import { DISTRIBUTED_MESSAGE_QUEUE } from './distributed-message-queue.ts';
import { DISTRIBUTED_RATE_LIMITER } from './distributed-rate-limiter.ts';
import { FILE_SYNC } from './file-sync.ts';
import { FLASH_SALE } from './flash-sale.ts';
import { GAMING_LEADERBOARD } from './gaming-leaderboard.ts';
import { GOOGLE_MAPS } from './google-maps.ts';
import { HOTEL_RESERVATION_SYSTEM } from './hotel-reservation-system.ts';
import { METRICS_MONITORING_SYSTEM } from './metrics-monitoring-system.ts';
import { MULTI_REGION } from './multi-region.ts';
import { MULTI_TENANT } from './multi-tenant.ts';
import { NEARBY_FRIENDS } from './nearby-friends.ts';
import { NEWS_FEED } from './news-feed.ts';
import { NOTIFICATION_SYSTEM } from './notification-system.ts';
import { OBJECT_STORAGE_SYSTEM } from './object-storage-system.ts';
import { PASTEBIN } from './pastebin.ts';
import { PAYMENT_SYSTEM } from './payment-system.ts';
import { PROXIMITY_SERVICE } from './proximity-service.ts';
import { RIDE_SHARING } from './ride-sharing.ts';
import { STOCK_EXCHANGE } from './stock-exchange.ts';
import { TICKET_BOOKING } from './ticket-booking.ts';
import { TYPEAHEAD_SYSTEM } from './typeahead-system.ts';
import { UNIQUE_ID_GENERATOR } from './unique-id-generator.ts';
import { URL_SHORTENER } from './url-shortener.ts';
import { VIDEO_STREAMING_PLATFORM } from './video-streaming-platform.ts';
import { WEB_CRAWLER } from './web-crawler.ts';

/** The curated HLD problem set. */
export const HLD_PROBLEMS: DesignProblem[] = [
  PASTEBIN,
  UNIQUE_ID_GENERATOR,
  URL_SHORTENER,
  TYPEAHEAD_SYSTEM,
  NOTIFICATION_SYSTEM,
  NEWS_FEED,
  CHAT_SYSTEM,
  FLASH_SALE,
  MULTI_REGION,
  MULTI_TENANT,
  RIDE_SHARING,
  TICKET_BOOKING,
  WEB_CRAWLER,
  PAYMENT_SYSTEM,
  FILE_SYNC,
  DISTRIBUTED_CACHE,
  DISTRIBUTED_RATE_LIMITER,
  CONSISTENT_HASHING_DESIGN,
  DISTRIBUTED_KEY_VALUE_STORE,
  VIDEO_STREAMING_PLATFORM,
  PROXIMITY_SERVICE,
  NEARBY_FRIENDS,
  GOOGLE_MAPS,
  DISTRIBUTED_MESSAGE_QUEUE,
  METRICS_MONITORING_SYSTEM,
  AD_CLICK_AGGREGATION,
  HOTEL_RESERVATION_SYSTEM,
  DISTRIBUTED_EMAIL_SERVICE,
  OBJECT_STORAGE_SYSTEM,
  GAMING_LEADERBOARD,
  DIGITAL_WALLET,
  STOCK_EXCHANGE,
];

export function getHldProblem(slug: string): DesignProblem | undefined {
  return HLD_PROBLEMS.find((p) => p.slug === slug);
}
