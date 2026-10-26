// The avatar used to be embedded as a ~64 KB base64 string in the JS bundle.
// Keeping it in /public makes the initial bundle smaller and lets the browser
// cache the image independently. Legacy base64 copies are migrated on read by
// normalizeAvatarUrl() in storage.ts.
export const CAMILO_SAVED_AVATAR = '/camilo-avatar.jpg';
