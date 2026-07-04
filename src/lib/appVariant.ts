import { Capacitor } from '@capacitor/core';

export const APP_VARIANT_OPERATOR_MOBILE = 'operator-mobile';

export const getAppVariant = () => import.meta.env.VITE_APP_VARIANT || 'default';

export const isOperatorMobileVariant = () =>
  getAppVariant() === APP_VARIANT_OPERATOR_MOBILE;

export const isNativePlatform = () => Capacitor.isNativePlatform();

export const isNativeOperatorMobileApp = () =>
  isNativePlatform() && isOperatorMobileVariant();
