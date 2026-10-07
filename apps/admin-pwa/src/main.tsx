import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, App as AntApp } from 'antd';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});

// Ant Design v5 theme — matches the existing brand/light design system
const antTheme = {
  token: {
    // Brand
    colorPrimary:      '#4F46E5',
    colorPrimaryHover: '#4338CA',
    colorLink:         '#4F46E5',

    // Surface / backgrounds
    colorBgBase:       '#FFFFFF',
    colorBgContainer:  '#FFFFFF',
    colorBgLayout:     '#F4F6FA',
    colorBgElevated:   '#FFFFFF',

    // Text
    colorText:         '#1F2937',
    colorTextSecondary:'#4B5563',
    colorTextTertiary: '#9CA3AF',
    colorTextDisabled: '#D1D5DB',
    colorTextHeading:  '#111827',

    // Borders
    colorBorder:       '#E8ECF0',
    colorBorderSecondary: '#F1F5F9',
    colorSplit:        '#E8ECF0',

    // Success / Warning / Error
    colorSuccess:      '#10B981',
    colorWarning:      '#F59E0B',
    colorError:        '#EF4444',
    colorInfo:         '#3B82F6',

    // Radius — matches --r-md
    borderRadius:      8,
    borderRadiusSM:    6,
    borderRadiusLG:    12,
    borderRadiusXS:    4,

    // Font
    fontFamily:        "'Inter', system-ui, -apple-system, sans-serif",
    fontSize:          14,
    fontSizeSM:        12,
    fontSizeLG:        16,

    // Shadows
    boxShadow:         '0 1px 4px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
    boxShadowSecondary:'0 4px 16px rgba(15,23,42,0.08), 0 2px 6px rgba(15,23,42,0.04)',

    // Input / control height
    controlHeight:      36,
    controlHeightSM:    30,
    controlHeightLG:    42,

    // Motion
    motionDurationMid: '0.18s',
    motionDurationSlow:'0.25s',
    motionDurationFast:'0.12s',
  },
  components: {
    Button: {
      primaryShadow: '0 4px 14px rgba(79,70,229,0.28)',
      defaultShadow: 'none',
      fontWeight: 500,
    },
    Table: {
      headerBg:         '#F8FAFC',
      headerColor:      '#374151',
      headerSortActiveBg: '#EEF2FF',
      rowHoverBg:       '#F8FAFF',
      borderColor:      '#E8ECF0',
      footerBg:         '#F8FAFC',
      cellPaddingBlock:  10,
      cellPaddingInline: 14,
      headerSplitColor: 'transparent',
      fontSize:          13,
    },
    Input: {
      activeShadow: '0 0 0 3px rgba(79,70,229,0.12)',
    },
    Select: {
      optionSelectedBg: '#EEF2FF',
      optionActiveBg:   '#F5F3FF',
    },
    Drawer: {
      colorBgElevated: '#FFFFFF',
      footerPaddingBlock: 14,
      footerPaddingInline: 20,
    },
    Modal: {
      titleFontSize: 15,
      titleColor:    '#111827',
    },
    Tag: {
      borderRadiusSM: 6,
    },
    Badge: {
      colorBgContainer: '#FFFFFF',
    },
    Card: {
      headerBg: 'transparent',
    },
    Divider: {
      colorSplit: '#E8ECF0',
    },
    Form: {
      labelColor:     '#374151',
      labelFontSize:  13,
      itemMarginBottom: 16,
    },
    Pagination: {
      itemActiveBg: '#4F46E5',
    },
    Message: {
      contentBg: '#FFFFFF',
    },
    Notification: {
      colorBgElevated: '#FFFFFF',
    },
    Tooltip: {
      colorBgSpotlight: '#1F2937',
    },
  },
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={antTheme} prefixCls="ant">
        <AntApp>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
