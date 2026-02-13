
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSyncState, onSyncState, queuePushToSupabase, forceSync, syncPush, syncPull, initAutoSync } from './autosync';
import { db } from '../data/db';
import { supa } from '../data/supabase';

vi.mock('../data/db', () => ({
  db: {
    clientes: {
      toArray: vi.fn(),
      clear: vi.fn(),
      bulkAdd: vi.fn(),
    },
    equipos: {
      toArray: vi.fn(),
      clear: vi.fn(),
      bulkAdd: vi.fn(),
    },
    ordenes: {
      toArray: vi.fn(),
      count: vi.fn(),
      orderBy: vi.fn(() => ({
        last: vi.fn(),
      })),
      clear: vi.fn(),
      bulkAdd: vi.fn(),
    },
    adjuntos: {
      toArray: vi.fn(),
      clear: vi.fn(),
      bulkAdd: vi.fn(),
    },
    transaction: vi.fn(),
    on: vi.fn(),
  },
}));

vi.mock('../data/supabase', () => ({
  supa: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      upsert: vi.fn(),
    })),
  },
}));

describe('autosync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getSyncState should return the current sync state', () => {
    expect(getSyncState()).toBe('ok');
  });

  it('onSyncState should register a handler and be called on state change', () => {
    const handler = vi.fn();
    const unsubscribe = onSyncState(handler);

    forceSync();

    expect(handler).toHaveBeenCalledWith('syncing');

    unsubscribe();
  });

  it('queuePushToSupabase should queue a push to Supabase', () => {
    queuePushToSupabase();
    vi.runAllTimers();
    expect(supa.from).toHaveBeenCalledWith('backups');
  });

  it('forceSync should force a sync', async () => {
    await forceSync();
    expect(supa.from).toHaveBeenCalledWith('backups');
  });

  it('syncPush should push data to Supabase', async () => {
    vi.mocked(db.ordenes.toArray).mockResolvedValue([]);
    await syncPush();
    expect(supa.from).toHaveBeenCalledWith('backups');
  });

  it('syncPull should pull data from Supabase', async () => {
    vi.mocked(supa.from('backups').select().eq().single).mockResolvedValue({
      data: {
        payload: {
          clientes: [],
          equipos: [],
          ordenes: [],
          adjuntos: [],
        },
        fecha: new Date().toISOString(),
      },
      error: null,
    });
    await syncPull();
    expect(db.transaction).toHaveBeenCalled();
  });

  it('initAutoSync should initialize auto-sync', () => {
    initAutoSync();
    expect(db.on).toHaveBeenCalledWith('changes', expect.any(Function));
  });
});
