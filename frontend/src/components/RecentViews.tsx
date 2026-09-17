import React, { useEffect, useRef, useState } from 'react';
import { Button, Popover, Badge, Spin, Empty, Typography, App } from 'antd';
import { HistoryOutlined, FileSearchOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { verifyRecents, VERIFY_INTERVAL_MS } from '../store/slices/recentSlice';

const { Text } = Typography;

const formatRelativeTime = (iso: string): string => {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return '';
  const diff = Date.now() - time;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const RecentViews: React.FC = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const { message } = App.useApp();
  const { recents, loading, lastVerifiedAt } = useSelector((state: RootState) => state.recent);

  const activeSeismicId = (() => {
    const match = location.pathname.match(/^\/viewer\/(\d+)/);
    return match ? Number(match[1]) : null;
  })();

  // 同一次会话内同批失效记录只提示一次
  const warnedRemovalsRef = useRef<Set<string>>(new Set());

  const runVerification = async (silent = false) => {
    const result = await dispatch(verifyRecents());
    if (verifyRecents.fulfilled.match(result) && !silent) {
      const { removedNames } = result.payload;
      const fresh = removedNames.filter((name) => !warnedRemovalsRef.current.has(name));
      if (fresh.length > 0) {
        fresh.forEach((name) => warnedRemovalsRef.current.add(name));
        message.warning(
          `以下 ${fresh.length} 条记录对应的数据已删除或当前账号无权访问，已从概览中移除：${fresh.join('、')}`
        );
      }
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (
      nextOpen &&
      recents.length > 0 &&
      (!lastVerifiedAt || Date.now() - lastVerifiedAt > VERIFY_INTERVAL_MS)
    ) {
      runVerification();
    }
  };

  // 重新登录进入后静默校验一次
  useEffect(() => {
    if (recents.length > 0 && !lastVerifiedAt) {
      runVerification(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recents.length]);

  const content = (
    <div style={{ width: 320 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <Text strong>最近访问</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          按打开时间倒序
        </Text>
      </div>

      {loading && recents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Spin size="small" />
        </div>
      ) : recents.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span style={{ fontSize: 13 }}>
              暂无最近访问记录
              <br />
              从项目管理中打开地震数据后，会显示在这里
            </span>
          }
          style={{ margin: '16px 0' }}
        />
      ) : (
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {recents.map((item) => {
            const active = item.seismicId === activeSeismicId;
            return (
              <div
                key={item.seismicId}
                onClick={() => {
                  setOpen(false);
                  navigate(`/viewer/${item.seismicId}`);
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  marginBottom: 4,
                  background: active ? '#e6f4ff' : 'transparent',
                  border: active ? '1px solid #91caff' : '1px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = '#f5f5f5';
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileSearchOutlined style={{ color: active ? '#1677ff' : '#8c8c8c' }} />
                  <Text
                    strong={active}
                    ellipsis
                    style={{ flex: 1, color: active ? '#1677ff' : undefined }}
                  >
                    {item.name}
                  </Text>
                  {active && (
                    <Badge
                      status="processing"
                      text={<Text style={{ color: '#1677ff' }}>查看中</Text>}
                    />
                  )}
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: 4,
                    paddingLeft: 22,
                  }}
                >
                  <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                    {item.projectName ? `项目：${item.projectName}` : ''}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12, flexShrink: 0, marginLeft: 8 }}>
                    {formatRelativeTime(item.viewedAt)}
                  </Text>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={handleOpenChange}
      placement="bottomRight"
    >
      <Button
        type="text"
        icon={
          <Badge count={recents.length} size="small" offset={[-4, 4]}>
            <HistoryOutlined style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16 }} />
          </Badge>
        }
        style={{ color: 'rgba(255,255,255,0.85)', marginRight: 8 }}
      >
        最近访问
      </Button>
    </Popover>
  );
};

export default RecentViews;
