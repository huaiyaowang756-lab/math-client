import { useState } from 'react';
import { Form, Input, Button, Tabs, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { login, register, setAuthToken } from '../api';
import './AuthPage.css';

export default function AuthPage({ onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [form] = Form.useForm();
  const [formReg] = Form.useForm();

  const handleLogin = async (values) => {
    setLoading(true);
    try {
      const data = await login(values.username, values.password);
      setAuthToken(data.token, data.expires_at, data.user?.username ?? values.username);
      message.success('登录成功');
      onSuccess?.();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || '登录失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values) => {
    if (values.password !== values.password2) {
      message.error('两次密码不一致');
      return;
    }
    setLoading(true);
    try {
      const data = await register(values.username, values.password);
      setAuthToken(data.token, data.expires_at, data.user?.username ?? values.username);
      message.success('注册成功');
      onSuccess?.();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || '注册失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          centered
          items={[
            {
              key: 'login',
              label: '登录',
              children: (
                <Form form={form} onFinish={handleLogin} layout="vertical" size="large">
                  <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
                    <Input prefix={<UserOutlined />} placeholder="用户名" />
                  </Form.Item>
                  <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                    <Input.Password prefix={<LockOutlined />} placeholder="密码" />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" block loading={loading}>
                      登录
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'register',
              label: '注册',
              children: (
                <Form form={formReg} onFinish={handleRegister} layout="vertical" size="large">
                  <Form.Item
                    name="username"
                    rules={[
                      { required: true, message: '请输入用户名' },
                      { min: 2, message: '至少 2 个字符' },
                    ]}
                  >
                    <Input prefix={<UserOutlined />} placeholder="用户名" />
                  </Form.Item>
                  <Form.Item
                    name="password"
                    rules={[
                      { required: true, message: '请输入密码' },
                      { min: 6, message: '至少 6 位' },
                    ]}
                  >
                    <Input.Password prefix={<LockOutlined />} placeholder="密码" />
                  </Form.Item>
                  <Form.Item
                    name="password2"
                    rules={[{ required: true, message: '请再次输入密码' }]}
                  >
                    <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" block loading={loading}>
                      注册
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
