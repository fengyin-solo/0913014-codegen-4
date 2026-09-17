import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Spin, message, Space, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { RootState, AppDispatch } from '../store';
import {
  fetchSeismicById,
  setCurrentSeismic,
} from '../store/slices/seismicSlice';
import { fetchProjects } from '../store/slices/projectSlice';
import { addRecent } from '../store/slices/recentSlice';
import { SeismicData, Project } from '../types';
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

  const { seismicList } = useSelector((state: RootState) => state.seismic);
  const { projects } = useSelector((state: RootState) => state.projects);
  const [currentData, setCurrentData] = useState<SeismicData | null>(null);
  const [loading, setLoading] = useState(false);

  // 同一条数据在一次查看过程中只记录一次最近访问；切到另一条时重置
  const recordedIdRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      const id = parseInt(seismicId || '0');
      if (!id) return;

      const existing = seismicList.find((s) => s.id === id);
      if (existing) {
        if (!cancelled) {
          setCurrentData(existing);
          dispatch(setCurrentSeismic(existing));
        }
        return;
      }

      // 从最近访问进入或直接刷新页面时，列表里没有该数据，按 ID 拉取
      setLoading(true);
      const result = await dispatch(fetchSeismicById(id));
      if (cancelled) return;
      setLoading(false);

      if (fetchSeismicById.fulfilled.match(result)) {
        setCurrentData(result.payload);
        dispatch(setCurrentSeismic(result.payload));
      } else {
        const payload = result.payload as { message?: string; status?: number } | undefined;
        if (payload?.status === 404) {
          message.error('该地震数据已被删除');
        } else if (payload?.status === 403) {
          message.error('当前账号无权访问该地震数据');
        } else {
          message.error(payload?.message || '未找到地震数据');
        }
        navigate('/projects');
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [seismicId, seismicList, dispatch, navigate]);

  // 数据成功打开后写入最近访问（项目名称缺失时先补拉项目列表）
  useEffect(() => {
    if (!currentData || currentData.status !== 'ready') return;
    if (recordedIdRef.current === currentData.id) return;
    recordedIdRef.current = currentData.id;

    const record = (projectName?: string) => {
      dispatch(
        addRecent({
          seismicId: currentData.id,
          name: currentData.name,
          projectId: currentData.project_id,
          projectName,
          viewedAt: new Date().toISOString(),
        })
      );
    };

    const projectName = projects.find((p) => p.id === currentData.project_id)?.name;
    if (projectName) {
      record(projectName);
    } else {
      dispatch(fetchProjects()).then((result) => {
        if (fetchProjects.fulfilled.match(result)) {
          const fetchedProjects = result.payload as Project[];
          record(fetchedProjects.find((p) => p.id === currentData.project_id)?.name);
        } else {
          record();
        }
      });
    }
  }, [currentData, projects, dispatch]);

  if (loading || !currentData) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
        }}
      >
        <Spin size="large" />
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
