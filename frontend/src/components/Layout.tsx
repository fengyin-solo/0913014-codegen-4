import React from 'react';
import { Layout as AntLayout, Menu, Dropdown, Avatar, Space } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  AppstoreOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { logout } from '../store/slices/authSlice';
import { RootState, AppDispatch } from '../store';
import RecentSeismicDropdown from './RecentSeismicDropdown';

const { Header, Sider, Content } = AntLayout;

const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);

  const menuItems = [
    {
      key: '/projects',
      icon: <AppstoreOutlined />,
      label: '项目管理',
      onClick: () => navigate('/projects'),
    },
  ];

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料',
      onClick: () => {},
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置',
      onClick: () => {},
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => {
        dispatch(logout());
        navigate('/login');
      },
    },
  ];

  const selectedKey = menuItems.find(
    (item) => location.pathname.startsWith(item.key)
  )?.key;

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          background: '#001529',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
            }}
          >
            S
          </div>
          <span style={{ color: 'white', fontSize: 18, fontWeight: 600 }}>
            SeismicVision
          </span>
        </div>

        <Space size="middle" align="center">
          <RecentSeismicDropdown />
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer', color: 'white' }}>
              <Avatar size="small" icon={<UserOutlined />} />
              <span>{user?.full_name || user?.username}</span>
            </Space>
          </Dropdown>
        </Space>
      </Header>

      <AntLayout>
        <Sider width={220} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={selectedKey ? [selectedKey] : []}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
          />
        </Sider>

        <Content style={{ margin: 0, background: '#f0f2f5', overflow: 'auto' }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;
