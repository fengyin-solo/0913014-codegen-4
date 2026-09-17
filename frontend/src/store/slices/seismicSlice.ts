import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { seismicAPI } from '../../services/api';
import { SeismicData, Annotation, Well } from '../../types';

interface SeismicState {
  seismicList: SeismicData[];
  currentSeismic: SeismicData | null;
  annotations: Annotation[];
  wells: Well[];
  loading: boolean;
  uploadProgress: number;
  error: string | null;
}

const initialState: SeismicState = {
  seismicList: [],
  currentSeismic: null,
  annotations: [],
  wells: [],
  loading: false,
  uploadProgress: 0,
  error: null,
};

export const fetchSeismicData = createAsyncThunk(
  'seismic/fetchSeismicData',
  async (projectId: number, { rejectWithValue }) => {
    try {
      const response = await seismicAPI.list(projectId);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || '获取地震数据列表失败');
    }
  }
);

export const fetchSeismicById = createAsyncThunk(
  'seismic/fetchSeismicById',
  async (id: number, { rejectWithValue }) => {
    try {
      const response = await seismicAPI.get(id);
      return response.data;
    } catch (error: any) {
      return rejectWithValue({
        message: error.response?.data?.detail || '获取地震数据失败',
        status: error.response?.status,
      });
    }
  }
);

export const uploadSeismicData = createAsyncThunk(
  'seismic/uploadSeismicData',
  async (
    { projectId, name, description, file }: { projectId: number; name: string; description: string; file: File },
    { rejectWithValue, dispatch }
  ) => {
    try {
      const response = await seismicAPI.upload(projectId, name, description, file, (progress) => {
        dispatch(setUploadProgress(progress));
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || '上传地震数据失败');
    }
  }
);

export const deleteSeismicData = createAsyncThunk(
  'seismic/deleteSeismicData',
  async (id: number, { rejectWithValue }) => {
    try {
      await seismicAPI.delete(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || '删除地震数据失败');
    }
  }
);

export const fetchAnnotations = createAsyncThunk(
  'seismic/fetchAnnotations',
  async (seismicId: number, { rejectWithValue }) => {
    try {
      const response = await seismicAPI.list(seismicId);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || '获取标注列表失败');
    }
  }
);

const seismicSlice = createSlice({
  name: 'seismic',
  initialState,
  reducers: {
    setCurrentSeismic: (state, action: PayloadAction<SeismicData | null>) => {
      state.currentSeismic = action.payload;
    },
    setUploadProgress: (state, action: PayloadAction<number>) => {
      state.uploadProgress = action.payload;
    },
    addAnnotation: (state, action: PayloadAction<Annotation>) => {
      state.annotations.push(action.payload);
    },
    updateAnnotation: (state, action: PayloadAction<Annotation>) => {
      const index = state.annotations.findIndex((a) => a.id === action.payload.id);
      if (index !== -1) {
        state.annotations[index] = action.payload;
      }
    },
    removeAnnotation: (state, action: PayloadAction<number>) => {
      state.annotations = state.annotations.filter((a) => a.id !== action.payload);
    },
    clearSeismicError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSeismicData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSeismicData.fulfilled, (state, action: PayloadAction<SeismicData[]>) => {
        state.loading = false;
        state.seismicList = action.payload;
      })
      .addCase(fetchSeismicData.rejected, (state, action: PayloadAction<any>) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(uploadSeismicData.pending, (state) => {
        state.loading = true;
        state.uploadProgress = 0;
        state.error = null;
      })
      .addCase(uploadSeismicData.fulfilled, (state, action: PayloadAction<SeismicData>) => {
        state.loading = false;
        state.uploadProgress = 100;
        state.seismicList.push(action.payload);
      })
      .addCase(uploadSeismicData.rejected, (state, action: PayloadAction<any>) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(deleteSeismicData.fulfilled, (state, action: PayloadAction<number>) => {
        state.seismicList = state.seismicList.filter((s) => s.id !== action.payload);
        if (state.currentSeismic?.id === action.payload) {
          state.currentSeismic = null;
        }
      })
      .addCase(fetchAnnotations.fulfilled, (state, action: PayloadAction<Annotation[]>) => {
        state.annotations = action.payload;
      });
  },
});

export const {
  setCurrentSeismic,
  setUploadProgress,
  addAnnotation,
  updateAnnotation,
  removeAnnotation,
  clearSeismicError,
} = seismicSlice.actions;
export default seismicSlice.reducer;
