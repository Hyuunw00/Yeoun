import type { SFSymbol } from 'expo-symbols';

export type Transport = 'plane' | 'train' | 'bus' | 'car' | 'ship';

type TransportStyle = {
  label: string;
  symbol: SFSymbol;
  // Printed across the top of the ticket
  ticketTitle: string;
  // Band color of the ticket
  color: string;
  // Route line on the map: dash and gap lengths in screen points, and how much it arcs
  dash: [number, number];
  arc: number;
};

export const TRANSPORTS: Record<Transport, TransportStyle> = {
  plane: {
    label: '비행기',
    symbol: 'airplane',
    ticketTitle: 'BOARDING PASS',
    color: '#2f4f7a',
    dash: [7, 5],
    arc: 0.28,
  },
  train: {
    label: '기차',
    symbol: 'tram.fill',
    ticketTitle: '승차권 · RAIL',
    color: '#3e6b45',
    dash: [10, 3],
    arc: 0.08,
  },
  bus: { label: '버스', symbol: 'bus.fill', ticketTitle: 'BUS TICKET', color: '#b5603f', dash: [3, 4], arc: 0.06 },
  car: { label: '차', symbol: 'car.fill', ticketTitle: 'ROAD TRIP', color: '#6b3f7a', dash: [1, 4], arc: 0.04 },
  ship: { label: '배', symbol: 'ferry.fill', ticketTitle: 'FERRY', color: '#2a6f7a', dash: [12, 6], arc: 0.12 },
};

export const TRANSPORT_ORDER: Transport[] = ['plane', 'train', 'bus', 'car', 'ship'];

export function asTransport(value: string | null | undefined): Transport | null {
  return value && value in TRANSPORTS ? (value as Transport) : null;
}
