import {describe, it, expect} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import {useTuningAdmin} from '../useTuningAdmin';

const PATH = ['ruleTexts', 'shift-targets', 'curve.gap3', 'score'];

describe('useTuningAdmin', () => {
  it('stages a valid score edit as one pending entry', () => {
    const {result} = renderHook(() => useTuningAdmin('tok'));
    act(() => {
      result.current.stageEdit({path: PATH, rawValue: '6', kind: 'score', oldValue: 5, label: 'Shift Targets · Wide 3-turn gap · score'});
    });
    expect(result.current.pending).toHaveLength(1);
    expect(result.current.pending[0]).toMatchObject({valid: true, value: 6, oldValue: 5});
  });

  it('upserts on the same path so only the last value is kept', () => {
    const {result} = renderHook(() => useTuningAdmin('tok'));
    act(() => {
      result.current.stageEdit({path: PATH, rawValue: '6', kind: 'score', oldValue: 5, label: 'label'});
    });
    act(() => {
      result.current.stageEdit({path: PATH, rawValue: '7', kind: 'score', oldValue: 5, label: 'label'});
    });
    expect(result.current.pending).toHaveLength(1);
    expect(result.current.pending[0].value).toBe(7);
  });

  it('removes the pending entry when edited back to the original value', () => {
    const {result} = renderHook(() => useTuningAdmin('tok'));
    act(() => {
      result.current.stageEdit({path: PATH, rawValue: '6', kind: 'score', oldValue: 5, label: 'label'});
    });
    act(() => {
      result.current.stageEdit({path: PATH, rawValue: '5', kind: 'score', oldValue: 5, label: 'label'});
    });
    expect(result.current.pending).toHaveLength(0);
  });

  it('marks an out-of-range score invalid and disables publish', () => {
    const {result} = renderHook(() => useTuningAdmin('tok'));
    act(() => {
      result.current.stageEdit({path: PATH, rawValue: '11', kind: 'score', oldValue: 5, label: 'label'});
    });
    expect(result.current.pending[0].valid).toBe(false);
    expect(result.current.publishDisabled).toBe(true);
  });

  it('revertEdit removes a single entry; clear empties all', () => {
    const {result} = renderHook(() => useTuningAdmin('tok'));
    act(() => {
      result.current.stageEdit({path: PATH, rawValue: '6', kind: 'score', oldValue: 5, label: 'a'});
      result.current.stageEdit({path: ['playstyles', 'ramp', 'name'], rawValue: 'Ramp!', kind: 'text', oldValue: 'Ramp', label: 'b'});
    });
    expect(result.current.pending).toHaveLength(2);

    act(() => {
      result.current.revertEdit(JSON.stringify(PATH));
    });
    expect(result.current.pending).toHaveLength(1);

    act(() => {
      result.current.clear();
    });
    expect(result.current.pending).toHaveLength(0);
  });

  it('publishDisabled is true with zero edits and false with one valid edit', () => {
    const {result} = renderHook(() => useTuningAdmin('tok'));
    expect(result.current.publishDisabled).toBe(true);

    act(() => {
      result.current.stageEdit({path: PATH, rawValue: '6', kind: 'score', oldValue: 5, label: 'label'});
    });
    expect(result.current.publishDisabled).toBe(false);
  });
});
