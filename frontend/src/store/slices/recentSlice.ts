import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { seismicAPI } from '../../services/api';
import { SeismicData } from '../../types';
import { logout } from './authSlice';

export interface RecentSeismicItem {
  seismicId: number;
  projectId: number;
  name: string;
  visitedAt: string;
}

interface RecentState {
  items: RecentSeismicItem[];
  hydrated: boolean;
}

const MAX_RECENT_ITEMS = 10;

const storageKey = (userId: number) => `recent_seismic_${userId}`;

const initialState: RecentState = {
  items: [],
  hydrated: false,
};

function isValidItem(item: any): item is RecentSeismicItem {
  return (
    item &&
    typeof item.seismicId === 'number' &&
    typeof item.projectId === 'number' &&
    typeof item.name === 'string' &&
    typeof item.visitedAt === 'string'
  );
}

function loadItems(userId: number): RecentSeismicItem[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidItem);
  } catch {
    return [];
  }
}

function persist(userId: number, items: RecentSeismicItem[]) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(items));
  } catch {
    // localStorage 不可用时仅保留内存状态
  }
}

/** 访问记录入参：地震数据主键、所属项目、名称、当前账号 */
interface RecordVisitPayload {
  userId: number;
  seismicId: number;
  projectId: number;
  name: string;
  visitedAt?: string;
}

interface RemovePayload {
  userId: number;
  seismicId: number;
}

/**
 * 校验概览中的记录是否仍然可访问：
 * - 404：数据已被删除
 * - 403：当前账号不再拥有访问权限
 * 以上两种情况从概览中移除并给出原因；网络或服务异常无法判定时保留记录。
 */
export const validateRecentAccess = createAsyncThunk(
  'recent/validateRecentAccess',
  async (
    { items, userId }: { items: RecentSeismicItem[]; userId: number },
    { rejectWithValue }
  ) => {
    const results = await Promise.all(
      items.map(async (item) => {
        try {
          const response = await seismicAPI.get(item.seismicId);
          return { item, ok: true as const, data: response.data as SeismicData };
        } catch (error: any) {
          return { item, ok: false as const, status: error.response?.status };
        }
      })
    );

    const available: RecentSeismicItem[] = [];
    const removed: { seismicId: number; name: string; reason: 'deleted' | 'forbidden' }[] = [];

    for (const result of results) {
      if (result.ok) {
        // 顺带刷新名称与项目归属，保持与服务端一致
        available.push({
          ...result.item,
          projectId: result.data.project_id,
          name: result.data.name,
        });
      } else if (result.status === 404) {
        removed.push({ seismicId: result.item.seismicId, name: result.item.name, reason: 'deleted' });
      } else if (result.status === 403) {
        removed.push({ seismicId: result.item.seismicId, name: result.item.name, reason: 'forbidden' });
      } else {
        available.push(result.item);
      }
    }

    persist(userId, available);
    return { available, removed };
  }
);

const recentSlice = createSlice({
  name: 'recent',
  initialState,
  reducers: {
    /** 按账号从 localStorage 载入最近访问 */
    hydrateRecent: (state, action: PayloadAction<number>) => {
      state.items = loadItems(action.payload);
      state.hydrated = true;
    },
    /** 记录一次打开（或更新已有记录的时间），最新访问排在最前 */
    recordRecentVisit: (state, action: PayloadAction<RecordVisitPayload>) => {
      const { userId, seismicId, projectId, name, visitedAt } = action.payload;
      const visited = visitedAt || new Date().toISOString();
      state.items = [
        { seismicId, projectId, name, visitedAt: visited },
        ...state.items.filter((item) => item.seismicId !== seismicId),
      ].slice(0, MAX_RECENT_ITEMS);
      persist(userId, state.items);
    },
    /** 移除单条记录（如打开时发现 404/403） */
    removeRecent: (state, action: PayloadAction<RemovePayload>) => {
      state.items = state.items.filter((item) => item.seismicId !== action.payload.seismicId);
      persist(action.payload.userId, state.items);
    },
    /** 清空内存中的记录（切换账号/退出登录时避免串号） */
    clearRecent: (state) => {
      state.items = [];
      state.hydrated = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(validateRecentAccess.fulfilled, (state, action) => {
        state.items = action.payload.available;
      })
      .addCase(logout.fulfilled, (state) => {
        state.items = [];
        state.hydrated = false;
      });
  },
});

export const { hydrateRecent, recordRecentVisit, removeRecent, clearRecent } = recentSlice.actions;
export default recentSlice.reducer;
