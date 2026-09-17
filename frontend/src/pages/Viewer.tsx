import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Spin, message, Space, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { RootState, AppDispatch } from '../store';
import { setCurrentSeismic } from '../store/slices/seismicSlice';
import { recordRecentVisit, removeRecent } from '../store/slices/recentSlice';
import { seismicAPI } from '../services/api';
import { SeismicData } from '../types';
import SeismicCanvas from '../components/SeismicCanvas';
import ControlPanel from '../components/ControlPanel';
import Toolbar from '../components/Toolbar';
import StatusBar from '../components/StatusBar';

const { Title } = Typography;

const Viewer: React.FC = () => {
  const { seismicId } = useParams<{ seismicId: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const containerRef = useRef<HTMLDivElement>(null);
  const handledRef = useRef<number | null>(null);

  const { seismicList } = useSelector((state: RootState) => state.seismic);
  const user = useSelector((state: RootState) => state.auth.user);
  const [currentData, setCurrentData] = useState<SeismicData | null>(null);
  const [notFound, setNotFound] = useState(false);

  // 列表可能在 Viewer 挂载期间变化，但不应重复触发当前数据的加载
  const seismicListRef = useRef(seismicList);
  seismicListRef.current = seismicList;

  useEffect(() => {
    const id = parseInt(seismicId || '0');
    if (!id || handledRef.current === id) return;
    handledRef.current = id;
    let cancelled = false;

    const resolveData = async (): Promise<SeismicData | null> => {
      const existing = seismicListRef.current.find((s) => s.id === id);
      if (existing) return existing;
      // 直接通过链接进入（刷新、从最近访问进入）时，按主键向后端查询
      try {
        const response = await seismicAPI.get(id);
        return response.data as SeismicData;
      } catch (error: any) {
        const status = error.response?.status;
        if (status === 404) {
          message.error('该地震数据已被删除，已从最近访问概览中移除');
        } else if (status === 403) {
          message.error('当前账号无权访问该地震数据，已从最近访问概览中移除');
        } else {
          message.error('打开地震数据失败，请稍后重试');
        }
        if (user?.id) {
          dispatch(removeRecent({ userId: user.id, seismicId: id }));
        }
        if (!cancelled) setNotFound(true);
        return null;
      }
    };

    resolveData().then((data) => {
      if (!data || cancelled) return;
      setCurrentData(data);
      dispatch(setCurrentSeismic(data));
      // 记录最近访问（已存在则更新打开时间并置顶），
      // 与从项目列表再次打开时的排列顺序保持一致
      if (user?.id) {
        dispatch(
          recordRecentVisit({
            userId: user.id,
            seismicId: data.id,
            projectId: data.project_id,
            name: data.name,
          })
        );
      }
    });

    return () => {
      cancelled = true;
      handledRef.current = null;
    };
  }, [seismicId, dispatch, user?.id]);

  if (!currentData) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
        }}
      >
        {notFound ? (
          <Space direction="vertical" align="center">
            <Title level={4}>无法打开该地震数据</Title>
            <Button type="primary" onClick={() => navigate('/projects', { replace: true })}>
              返回项目列表
            </Button>
          </Space>
        ) : (
          <Spin size="large" />
        )}
      </div>
    );
  }

  if (currentData.status !== 'ready') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 16,
        }}
      >
        <Title level={4}>数据尚未就绪</Title>
        <p>当前状态: {currentData.status}</p>
        <Button type="primary" onClick={() => navigate('/projects')}>
          返回项目列表
        </Button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="seismic-canvas-container">
      <SeismicCanvas seismicData={currentData} containerRef={containerRef} />

      <Toolbar />

      <ControlPanel seismicData={currentData} />

      <StatusBar seismicData={currentData} />

      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 100,
        }}
      >
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/projects')}>
            返回
          </Button>
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.9)',
              padding: '8px 16px',
              borderRadius: 4,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          >
            <strong>{currentData.name}</strong>
          </div>
        </Space>
      </div>
    </div>
  );
};

export default Viewer;
