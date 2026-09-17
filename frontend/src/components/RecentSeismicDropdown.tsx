import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Badge,
  Button,
  Dropdown,
  Empty,
  MenuProps,
  Spin,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import {
  hydrateRecent,
  recordRecentVisit,
  validateRecentAccess,
  RecentSeismicItem,
} from '../store/slices/recentSlice';

const { Text } = Typography;

/** 概览中展示的相对打开时间，悬浮可见精确时间 */
export function formatRelativeTime(iso: string): string {
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
  return new Date(iso).toLocaleString('zh-CN', { hour12: false });
}

const RecentSeismicDropdown: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();

  const { user } = useSelector((state: RootState) => state.auth);
  const { items, hydrated } = useSelector((state: RootState) => state.recent);

  const [validating, setValidating] = useState(false);
  const [open, setOpen] = useState(false);
  const validatingRef = useRef(false);

  // 校验概览中的记录：已删除（404）或无权访问（403）的提示后移除，其余保留
  const runValidation = useCallback(
    (snapshot: RecentSeismicItem[]) => {
      if (!user?.id || snapshot.length === 0 || validatingRef.current) return;
      validatingRef.current = true;
      setValidating(true);
      dispatch(validateRecentAccess({ items: snapshot, userId: user.id }))
        .unwrap()
        .then(({ removed }) => {
          if (removed.length === 0) return;
          const deleted = removed.filter((r) => r.reason === 'deleted');
          const forbidden = removed.filter((r) => r.reason === 'forbidden');
          const notes: string[] = [];
          if (deleted.length > 0) {
            notes.push(`「${deleted.map((r) => r.name).join('、')}」已被删除`);
          }
          if (forbidden.length > 0) {
            notes.push(`「${forbidden.map((r) => r.name).join('、')}」当前账号无权访问`);
          }
          message.warning(`${notes.join('；')}，已从概览中移除`);
        })
        .catch(() => {
          // 校验整体失败（如网络问题）时保留现有记录，不打扰用户
        })
        .finally(() => {
          validatingRef.current = false;
          setValidating(false);
        });
    },
    [dispatch, user?.id]
  );

  // 按账号载入最近访问；登录/切换账号后 hydrate 对应的数据
  useEffect(() => {
    if (user?.id) {
      dispatch(hydrateRecent(user.id));
    }
  }, [user?.id, dispatch]);

  // hydrate 完成后校验一次；items 变化（如打开新数据）不再重复校验
  useEffect(() => {
    if (hydrated && user?.id) {
      runValidation(items);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, user?.id]);

  const activeSeismicId = useMemo(() => {
    const match = location.pathname.match(/^\/viewer\/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }, [location.pathname]);

  const handleClick = (item: RecentSeismicItem) => {
    // 回到当时的查看页面；Viewer 加载成功后会以最新时间刷新该条
    dispatch(
      recordRecentVisit({
        userId: user!.id,
        seismicId: item.seismicId,
        projectId: item.projectId,
        name: item.name,
      })
    );
    setOpen(false);
    navigate(`/viewer/${item.seismicId}`);
  };

  const menuItems: MenuProps['items'] = useMemo(
    () =>
      items.map((item) => ({
        key: String(item.seismicId),
        onClick: () => handleClick(item),
        label: (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              minWidth: 280,
              padding: '2px 0',
            }}
          >
            <Text strong={activeSeismicId === item.seismicId} style={{ maxWidth: 220 }} ellipsis>
              {item.name}
            </Text>
            <Tooltip title={new Date(item.visitedAt).toLocaleString('zh-CN', { hour12: false })}>
              <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                {formatRelativeTime(item.visitedAt)}
              </Text>
            </Tooltip>
          </div>
        ),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, activeSeismicId, user?.id, navigate]
  );

  const dropdownRender = (menu: React.ReactNode) => (
    <div
      style={{
        background: '#fff',
        borderRadius: 8,
        boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
        padding: '8px 0',
        minWidth: 360,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 16px 8px',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <Text strong>最近访问概览</Text>
        {validating && <Spin size="small" />}
      </div>
      {items.length === 0 ? (
        <div style={{ padding: '16px 0' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无最近访问，打开地震数据后将显示在这里"
          />
        </div>
      ) : (
        menu
      )}
    </div>
  );

  return (
    <Dropdown
      menu={{
        items: menuItems,
        selectedKeys: activeSeismicId ? [String(activeSeismicId)] : [],
      }}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        // 每次展开时即时校验，删除/失权的记录不会残留
        if (nextOpen) runValidation(items);
      }}
      trigger={['click']}
      placement="bottomRight"
      dropdownRender={dropdownRender}
    >
      <Tooltip title="最近访问的地震数据">
        <Badge count={items.length} size="small" offset={[-4, 4]}>
          <Button
            type="text"
            icon={<ClockCircleOutlined />}
            style={{ color: 'rgba(255,255,255,0.85)' }}
          >
            最近访问
          </Button>
        </Badge>
      </Tooltip>
    </Dropdown>
  );
};

export default RecentSeismicDropdown;
