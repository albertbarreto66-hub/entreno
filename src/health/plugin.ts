import { Capacitor, registerPlugin } from '@capacitor/core';

export interface RawSample {
  uuid: string;
  start: number;
  end: number;
  value: number;
  value2?: number | null;
  value3?: number | null;
  label?: string | null;
  sourceName: string;
  sourceId: string;
  productType?: string | null;
  deviceName?: string | null;
  userEntered: boolean;
}
export type ChangeType = 'steps' | 'sleep' | 'restingHr' | 'workout';
export interface ChangesResult { samples: RawSample[]; deleted: string[]; anchor: string | null }
export interface HrDailyRow { date: string; sourceId: string; sourceName: string; productType?: string | null; avg: number; min: number; max: number }

/** Interfaz del plugin nativo (Swift) incluido en ios/App/App/HealthBridgePlugin.swift. */
export interface HealthBridgePlugin {
  isAvailable(): Promise<{ available: boolean }>;
  requestReadAuthorization(): Promise<{ requested: boolean }>;
  fetchChanges(o: { type: ChangeType; anchor: string | null; startMs: number }): Promise<ChangesResult>;
  fetchHeartRateDaily(o: { startMs: number; endMs: number; timeZone: string }): Promise<{ rows: HrDailyRow[] }>;
}

export const HealthBridge = registerPlugin<HealthBridgePlugin>('HealthBridge');

export const isNative = () => Capacitor.isNativePlatform();
export const isIOSNative = () => Capacitor.getPlatform() === 'ios';
/** El plugin Swift viaja dentro del proyecto iOS, así que en la app iOS siempre está presente. */
export const hasHealthBridge = () => isIOSNative();
