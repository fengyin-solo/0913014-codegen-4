import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import projectReducer from './slices/projectSlice';
import seismicReducer from './slices/seismicSlice';
import viewerReducer from './slices/viewerSlice';
import recentReducer from './slices/recentSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    projects: projectReducer,
    seismic: seismicReducer,
    viewer: viewerReducer,
    recent: recentReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
