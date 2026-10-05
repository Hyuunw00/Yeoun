/// <reference types="jest" />

import { withoutOrphans } from '@/lib/backup';

// Only the pure helper is tested; the module's native and network deps are stubbed out
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/lib/photos', () => ({ photoDir: jest.fn(), photoFile: jest.fn() }));
jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: {} }));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));

describe('withoutOrphans', () => {
  it('keeps rows whose parents exist', () => {
    const tables = {
      works: [{ id: 1 }],
      records: [{ id: 10, work_id: 1 }],
      record_photos: [{ id: 100, record_id: 10 }],
      record_quotes: [{ id: 200, record_id: 10 }],
    };
    expect(withoutOrphans(tables)).toEqual(tables);
  });

  it('drops records without a work, and photos and quotes of dropped records', () => {
    const result = withoutOrphans({
      works: [{ id: 1 }],
      records: [
        { id: 10, work_id: 1 },
        { id: 11, work_id: 2 },
      ],
      record_photos: [
        { id: 100, record_id: 10 },
        { id: 101, record_id: 11 },
      ],
      record_quotes: [
        { id: 200, record_id: 11 },
        { id: 201, record_id: 99 },
      ],
    });
    expect(result.records.map((r) => r.id)).toEqual([10]);
    expect(result.record_photos.map((p) => p.id)).toEqual([100]);
    expect(result.record_quotes).toEqual([]);
  });

  it('matches ids across number and string forms', () => {
    const result = withoutOrphans({
      works: [{ id: '1' }],
      records: [{ id: 10, work_id: 1 }],
      record_photos: [],
      record_quotes: [{ id: 200, record_id: '10' }],
    });
    expect(result.records).toHaveLength(1);
    expect(result.record_quotes).toHaveLength(1);
  });
});
