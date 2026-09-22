import api from './api';

const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const checkPushSupport = () => {
  return 'serviceWorker' in navigator && 'PushManager' in window;
};

export const registerServiceWorker = async () => {
  if (!checkPushSupport()) return null;
  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js');
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
};

export const subscribeUserToPush = async () => {
  if (!checkPushSupport()) throw new Error('Push notifications are not supported by this browser.');
  
  if (Notification.permission === 'denied') {
    throw new Error('Push notification permission denied.');
  }

  const registration = await registerServiceWorker();
  if (!registration) throw new Error('Could not register service worker.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permission not granted for push notifications.');
  }

  // Get public key from backend if not in env
  let publicKey = VAPID_PUBLIC_KEY;
  if (!publicKey) {
    try {
      const res = await api.getVapidPublicKey();
      publicKey = res.public_key;
    } catch (err) {
      throw new Error('Could not retrieve VAPID public key.');
    }
  }

  const subscribeOptions = {
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey)
  };

  let pushSubscription;
  try {
    pushSubscription = await registration.pushManager.subscribe(subscribeOptions);
  } catch (err) {
    if (err.message.includes('push service error') || err.message.includes('Registration failed')) {
      throw new Error('Your browser failed to connect to the push service. This can happen in Incognito mode, or if push services are disabled in your browser settings (e.g., Brave).');
    }
    throw err;
  }

  // Send to backend
  await api.subscribeToPush(pushSubscription.toJSON());
  
  return pushSubscription;
};

export const unsubscribeUserFromPush = async () => {
  if (!checkPushSupport()) return;
  
  const registration = await navigator.serviceWorker.ready;
  const pushSubscription = await registration.pushManager.getSubscription();
  
  if (pushSubscription) {
    await pushSubscription.unsubscribe();
    await api.unsubscribeFromPush(pushSubscription.toJSON());
  }
};

export const getPushSubscriptionStatus = async () => {
  if (!checkPushSupport()) return false;
  
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return !!subscription;
};
