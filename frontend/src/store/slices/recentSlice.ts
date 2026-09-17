import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { seismicAPI } from '../../services/api';
import { RecentSeismic } from '../../types';
import type { RootState } from '..';

const MAX_RECENT = 10;
// 同一条记录两次校验之间的最小间隔，避免每次展开下拉都打接口
const VERIFY_INTERVAL_MS = 30 * 1000;

interface RecentState {
  recents: RecentSeismic[];
  userId: number | null;
  loading: boolean;
  lastVerifiedAt: number | null;
}

const initialState: RecentState = {
  recents: [],
  userId: null,
  loading: false,
  lastVerifiedAt: null,
};

const storageKey = (userId: number) => `recent_seismic_${userId}`;

const readFromStorage = (userId: number): RecentSeismic[] => {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is RecentSeismic =>
        typeof item?.seismicId === 'number' &&
        typeof item?.name === 'string' &&
        typeof item?.viewedAt === 'string'
    );
  } catch {
    return [];
  }
};

const writeToStorage = (userId: number, recents: RecentSeismic[]) => {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(recents));
  } catch {
    // localStorage 不可用或已满时静默降级为内存态
  }
};

/**
 * 逐条校验概览里的数据是否仍然存在、当前账号是否仍可访问。
 * 404（已删除）/403（无权访问）的记录会被移除；
 * 网络异常等其他错误保留原记录，避免误删。
 */
export const verifyRecents = createAsyncThunk(
  'recent/verifyRecents',
  async (_, { getState }) => {
    const { recents, userId } = (getState() as RootState).recent;
    if (!userId || recents.length === 0) {
      return { valid: [], removedNames: [] as string[] };
    }

    const valid: RecentSeismic[] = [];
    const removedNames: string[] = [];

    await Promise.all(
      recents.map(async (item) => {
        try {
          const response = await seismicAPI.get(item.seismicId);
          valid.push({
            ...item,
            name: response.data?.name || item.name,
            projectId: response.data?.project_id ?? item.projectId,
          });
        } catch (error: any) {
          const status = error.response?.status;
          if (status === 404 || status === 403) {
            removedNames.push(item.name);
          } else {
            valid.push(item);
          }
        }
      })
    );

    // Promise.all 打乱了顺序，按概览中的原始顺序还原
    valid.sort(
      (a, b) =>
        recents.findIndex((r) => r.seismicId === a.seismicId) -
        recents.findIndex((r) => r.seismicId === b.seismicId)
    );

    if (valid.length !== recents.length) {
      writeToStorage(userId, valid);
    }

    return { valid, removedNames };
  }
);

const recentSlice = createSlice({
  name: 'recent',
  initialState,
  reducers: {
    loadRecents: (state, action: PayloadAction<number>) => {
      state.userId = action.payload;
      state.recents = readFromStorage(action.payload);
      state.lastVerifiedAt = null;
    },
    addRecent: (state, action: PayloadAction<RecentSeismic>) => {
      const others = state.recents.filter((r) => r.seismicId !== action.payload.seismicId);
      state.recents = [action.payload, ...others].slice(0, MAX_RECENT);
      if (state.userId) {
        writeToStorage(state.userId, state.recents);
      }
    },
    removeRecent: (state, action: PayloadAction<number>) => {
      state.recents = state.recents.filter((r) => r.seismicId !== action.payload);
      if (state.userId) {
        writeToStorage(state.userId, state.recents);
      }
    },
    clearRecents: (state) => {
      state.recents = [];
      state.userId = null;
      state.lastVerifiedAt = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(verifyRecents.pending, (state) => {
        state.loading = true;
      })
      .addCase(
        verifyRecents.fulfilled,
        (state, action: PayloadAction<{ valid: RecentSeismic[]; removedNames: string[] }>) => {
          state.loading = false;
          state.recents = action.payload.valid;
          state.lastVerifiedAt = Date.now();
        }
      )
      .addCase(verifyRecents.rejected, (state) => {
        state.loading = false;
      });
  },
});

export const { loadRecents, addRecent, removeRecent, clearRecents } = recentSlice.actions;
export { VERIFY_INTERVAL_MS };
export default recentSlice.reducer;
